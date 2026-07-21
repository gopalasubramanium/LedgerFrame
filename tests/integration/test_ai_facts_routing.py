# SPDX-License-Identifier: AGPL-3.0-or-later
"""The AI gathers the RIGHT facts for the question (markets vs net worth vs news),
not just watchlist quotes."""

from __future__ import annotations

import json

# Module-level so every model is registered on Base.metadata before the `session` fixture's
# create_all runs (the isolation test below uses that fixture; an in-body import lands too late).
from app.seed.demo import seed_demo_data


async def _fact_labels(app_client, question: str) -> list[str]:
    r = await app_client.post("/api/v1/ai/chat", json={"question": question})
    assert r.status_code == 200
    labels: list[str] = []
    for line in r.text.splitlines():
        if line.startswith("data:"):
            ev = json.loads(line[5:].strip())
            if ev.get("type") == "facts":
                labels = [f["label"] for f in ev["facts"]]
    return labels


async def test_markets_question_pulls_global_indices(app_client):
    labels = await _fact_labels(app_client, "How did the markets do today?")
    joined = " ".join(labels)
    assert "S&P 500" in joined or "Nasdaq 100" in joined or "Dow Jones" in joined


async def test_networth_question_pulls_assets_liabilities(app_client):
    labels = await _fact_labels(app_client, "What is my net worth?")
    assert any("Net worth" in label for label in labels)
    assert any("liabilities" in label.lower() for label in labels)


async def test_performance_question_pulls_risk_metrics(app_client):
    labels = await _fact_labels(app_client, "How is my portfolio performing and what's the risk?")
    joined = " ".join(labels).lower()
    assert "return" in joined and ("volatility" in joined or "drawdown" in joined)


async def test_key_stats_recovers_the_session_after_a_bounded_series_timeout(session, monkeypatch):
    """R-54 I-1 / R-43 §18-F7d — a bounded-series timeout must RECOVER the metrics session.

    `key_stats` bounds `performance_series` and `time_weighted_return` with `asyncio.wait_for`. Under
    CPU contention a starved event loop misses the wall-clock deadline even though the work is trivial
    and network-free, so the timeout fires and CANCELS the coroutine mid-query. That cancellation leaves
    the transaction INVALID, and every later query — the TWR call, and the downstream fact sources
    `gather_facts` runs after this one — then raises `PendingRollbackError`, 500-ing the Portfolio perf
    card and the Ask "performance" answer. That was R-43 §18-F7d's "fails only under contention" flake:
    a POISONED SESSION, not a nulled metric. (The Phase-0 seed-state hypothesis was confounded — the
    demo fixture is fully covered, `seed_demo_history` seeds even HDFCNIFTY's mock series, so coverage
    never nulls the metrics in pytest; the covered→uncovered decay is a live-instance phenomenon, a
    different surface.) The fix `rollback()`s in each timeout handler, clearing the invalid transaction;
    XIRR's ORM reads are moved ahead of the bounded calls so nothing after a rollback touches a stale
    ORM object, and the block is read-only so the rollback discards nothing.

    WHY THIS GUARDS THE MECHANISM, not a reproduced poison. The *poison* cannot be reproduced
    deterministically: `wait_for` converts the internal `CancelledError` to `TimeoutError`, it only
    lands when the cancellation interrupts a driver op (a ~0ms real timeout is a race — the coroutine is
    often cancelled before its first DB await, so nothing poisons), and a merely-caught statement error
    does NOT persist in async SQLAlchemy. So this drives the FIX: on a bounded-call timeout, `key_stats`
    rolls the session back. The real end-to-end recovery under a forced cancellation was verified by hand
    (5/5 clean 200s with full facts). BLINDNESS PIN: pre-fix (no rollback in the handlers) the spy counts
    zero rollbacks — RED. The coverage assertion pins against going vacuous: if the book stopped being
    date-aware-computable the bounded blocks would be skipped and no timeout handler would run.
    """
    from sqlalchemy import text

    import app.services.analytics as an
    from app.services.coverage import date_aware_computable

    await seed_demo_data(session)
    await session.commit()  # committed, as production data is — so the recovery rollback discards nothing
    assert (await date_aware_computable(session, "SGD"))["computable"], (
        "demo book must be date-aware-computable, else the bounded blocks are skipped and no handler runs"
    )

    async def times_out(*args, **kwargs):
        # Stand in for the wall-clock cancellation: raise TimeoutError, exactly as wait_for does when
        # it cancels the coroutine. (The session-poison a real cancellation also causes is not
        # reproducible here; the recovery it demands is what this test pins.)
        raise TimeoutError

    monkeypatch.setattr(an, "performance_series", times_out)
    monkeypatch.setattr(an, "time_weighted_return", times_out)

    rollbacks = {"n": 0}
    real_rollback = session.rollback

    async def counting_rollback():
        rollbacks["n"] += 1
        return await real_rollback()

    monkeypatch.setattr(session, "rollback", counting_rollback)

    ks = await an.key_stats(session, "SGD")
    assert ks["metrics"], "key_stats returned no metrics after the timeouts"
    assert rollbacks["n"] >= 1, (
        "key_stats did not roll back after a bounded-series timeout — a real cancellation would leave the "
        "session poisoned (PendingRollbackError) for the TWR call and every downstream fact source"
    )
    # And the session is left usable — the rollback cleared it, so a follow-up query succeeds.
    assert (await session.execute(text("SELECT 1"))).scalar() == 1


async def test_general_question_anchors_with_portfolio(app_client):
    """A question with no specific intent still anchors on the headline figure.

    ⚠ This assertion PINNED A DEFECT. It read `"Portfolio total value"` — a D-021-retired
    term that `app/ai/tools.py:33` served to the user and fed to the model as grounded fact
    (AI-surfaces §0-H). The test was green for months **because it agreed with the defect**,
    and a copy pass that trusted the suite would have found nothing wrong.

    The term is now **Net worth**, resolved per context rather than by precedent: the value is
    `value_portfolio(...).total_value`, which sums every holding with no liability filter, and
    liabilities are stored negative — so it is liabilities-inclusive, which `GLOSSARY.md:65`
    defines as Net worth. (`networth_facts` had labelled the identical value correctly all
    along, one function away.)

    *Third test this programme has found pinning stale content* — page-help §9-5 found three at
    once, R-52 found one in `test_performance.py`. A test that asserts a wrong string is not
    coverage; it is the defect with a second signature.
    """
    labels = await _fact_labels(app_client, "Give me an overview")
    assert any("Net worth" in label for label in labels)
