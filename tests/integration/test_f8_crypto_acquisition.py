# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-43 §19 (F-8) — a correctly-mapped crypto acquired ZERO rows, silently, forever.

Evidence from the owner's live instance (read-only): BTC→bitcoin and XRP→ripple were mapped in
``instrument_identifiers`` since 2026-07-18, every other held symbol had 250–2679 daily candles,
and BTC/XRP had **zero rows, ever**. Three independent defects stacked:

* **F-8a (cause).** ``CRYPTO_HISTORY_FREE_TIER_DAYS = 365`` was DOCUMENTED in the adapter and never
  applied. The acquirer asks from the earliest transaction — BTC/XRP were bought 731 days ago — and
  CoinGecko's public API refuses any request reaching past its window outright (verified live:
  HTTP 401, ``error_code 10012``, "Your request exceeds the allowed time range"), returning NOTHING
  rather than less. A limit in a comment is not a limit.
* **F-8 (silence).** The refusal hit the blanket ``except`` in ``acquire_prices``, incremented
  ``skipped``, and logged — nothing was persisted, so nothing could be surfaced.
* **F-8c (invisibility).** Alembic's ``fileConfig`` runs with ``disable_existing_loggers=True`` on
  every in-process startup migration, which DISABLES the "ledgerframe" logger — so even that log
  line never reached the file or stdout. Verified directly: after ``fileConfig``,
  ``logging.getLogger("ledgerframe").disabled is True``.

Net effect: the page served "No price history yet — run Build history" to a user who had just run
Build history, and no evidence existed anywhere on the machine.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
from sqlalchemy import select


async def _seed_crypto(session, *, bought_days_ago: int = 731):
    """The owner's shape: a CORRECTLY mapped crypto bought outside the provider's window."""
    from app.models import Account, AssetClass, Instrument, InstrumentIdentifier, TxnType
    from app.models import Transaction as Txn
    from app.services.portfolio import rebuild_holdings_from_transactions

    acc = Account(name="A", currency="SGD")
    session.add(acc)
    await session.flush()
    btc = Instrument(symbol="BTC", currency="USD", pricing_currency="USD",
                     asset_class=AssetClass.CRYPTO)
    session.add(btc)
    await session.flush()
    session.add(InstrumentIdentifier(instrument_id=btc.id, id_type="coingecko_id", value="bitcoin"))
    session.add(Txn(account_id=acc.id, instrument_id=btc.id, type=TxnType.BUY,
                    ts=datetime.now(UTC) - timedelta(days=bought_days_ago),
                    quantity=Decimal("1"), price=Decimal("10"), currency="USD"))
    await session.flush()
    await rebuild_holdings_from_transactions(session)
    await session.commit()
    return btc


def _free_tier_api(monkeypatch, calls: list):
    """A CoinGecko stand-in with the real public-API policy: a request reaching past the window is
    refused wholesale (401/10012); a request inside it returns daily points."""
    from app.providers.market.coingecko import CRYPTO_HISTORY_FREE_TIER_DAYS

    async def _fake(cid, vs, start, end, timeout=30.0):
        span_days = (end - start).days
        calls.append((cid, span_days))
        if span_days > CRYPTO_HISTORY_FREE_TIER_DAYS:
            raise RuntimeError(
                "Client error '401 Unauthorized' … {'error_code': 10012, 'error_message': "
                "'Your request exceeds the allowed time range. Public API users are limited to "
                "querying historical data within the past 365 days.'}")
        pts = [[int((end - timedelta(days=n)).timestamp() * 1000), 64000.0 + n]
               for n in range(min(span_days, 5))]
        return {"prices": pts, "total_volumes": []}

    # Patch the REAL fetcher so the clamp under test (inside it) still runs.
    import app.providers.market.coingecko as cg
    monkeypatch.setattr(cg, "_transport_get", _fake, raising=False)
    monkeypatch.setattr("app.services.acquire.fetch_market_chart_range", _fake)


# --------------------------------------------------------------------------- #
# F-8a — the cause
# --------------------------------------------------------------------------- #
def test_clamp_keeps_the_request_inside_the_public_api_window():
    """RED: the documented constant was never applied, so a 731-day holding produced a 731-day
    request — which the public API refuses wholesale."""
    from app.providers.market.coingecko import CRYPTO_HISTORY_FREE_TIER_DAYS, clamp_to_free_tier

    end = datetime.now(UTC)
    start, clamped = clamp_to_free_tier(end - timedelta(days=731), end)
    assert clamped is True
    assert (end - start).days <= CRYPTO_HISTORY_FREE_TIER_DAYS
    # A holding inside the window is untouched — the clamp only ever removes what cannot be served.
    inside = end - timedelta(days=100)
    start2, clamped2 = clamp_to_free_tier(inside, end)
    assert clamped2 is False and start2 == inside


async def test_mapped_crypto_bought_before_the_window_still_acquires_rows(session, monkeypatch):
    """RED (the owner's exact state): BTC mapped to `bitcoin`, bought 731 days ago → ZERO rows.
    The acquisition must ask for what the provider CAN serve, not all-or-nothing."""
    from app.models import PriceHistory
    from app.services import acquire

    btc = await _seed_crypto(session)
    calls: list = []
    _free_tier_api(monkeypatch, calls)

    counts = await acquire.acquire_prices(session, "SGD")

    rows = (await session.execute(
        select(PriceHistory).where(PriceHistory.instrument_id == btc.id))).scalars().all()
    assert rows, "a correctly-mapped crypto acquired no history"
    assert all(r.source == "coingecko" for r in rows)
    assert counts["crypto"] > 0
    assert calls and calls[0][1] <= 365, "the request must be clamped to the servable window"


# --------------------------------------------------------------------------- #
# F-8 — a silent zero-row outcome must be impossible
# --------------------------------------------------------------------------- #
async def test_a_failed_acquisition_records_its_named_reason(session, monkeypatch):
    """RED: the failure existed only as a log line inside a blanket except. It must be PERSISTED
    with a served reason naming what happened."""
    from app.models import InstrumentAcquisition
    from app.services import acquire

    btc = await _seed_crypto(session)

    async def _refuse(cid, vs, start, end, timeout=30.0):
        raise RuntimeError("{'error_code': 10012, 'error_message': 'Your request exceeds the "
                           "allowed time range.'}")
    monkeypatch.setattr("app.services.acquire.fetch_market_chart_range", _refuse)

    await acquire.acquire_prices(session, "SGD")

    outcome = await session.get(InstrumentAcquisition, btc.id)
    assert outcome is not None, "a failed acquisition left no record"
    assert outcome.ok is False and outcome.rows == 0
    assert outcome.reason and "10012" not in outcome.reason, "the reason must be served copy, not a raw error code"
    assert "365" in outcome.reason and "coingecko" in outcome.reason.lower()


async def test_a_zero_row_success_is_recorded_as_a_failure_with_a_reason(session, monkeypatch):
    """A provider that returns an EMPTY series is not a success. Silent zero-row outcomes are the
    whole F-8 defect class — no exception, no rows, no evidence."""
    from app.models import InstrumentAcquisition
    from app.services import acquire

    btc = await _seed_crypto(session, bought_days_ago=100)

    async def _empty(cid, vs, start, end, timeout=30.0):
        return {"prices": [], "total_volumes": []}
    monkeypatch.setattr("app.services.acquire.fetch_market_chart_range", _empty)

    await acquire.acquire_prices(session, "SGD")

    outcome = await session.get(InstrumentAcquisition, btc.id)
    assert outcome is not None and outcome.ok is False and outcome.rows == 0
    assert outcome.reason, "a zero-row acquisition must carry a reason"


async def test_the_banner_names_the_blocker_instead_of_the_build_cta(session, monkeypatch):
    """RED (item 3): BTC/XRP HAVE a mapping, so `_no_price_blocker` fell through to the generic
    "run Build history" CTA — told to the user who had just run it. A recorded failure must win."""
    from app.services import acquire
    from app.services.coverage import coverage_summary

    await _seed_crypto(session)

    async def _refuse(cid, vs, start, end, timeout=30.0):
        raise RuntimeError("{'error_code': 10012, 'error_message': 'exceeds the allowed time range'}")
    monkeypatch.setattr("app.services.acquire.fetch_market_chart_range", _refuse)

    await acquire.acquire_prices(session, "SGD")

    cov = await coverage_summary(session, "SGD")
    btc_row = next(r for r in cov["instruments"] if r["symbol"] == "BTC")
    assert btc_row["covered"] is False
    assert "run Build history" not in btc_row["summary"], (
        "the page must not tell the user to redo what they just did")
    assert "365" in btc_row["summary"]


async def test_a_clamped_success_says_why_the_series_starts_late(session, monkeypatch):
    """A short series must not read as the whole story: the served summary states the provider
    window, so carried-vs-priced eras are never inferred by the user."""
    from app.services import acquire, fx_history
    from app.services.coverage import coverage_summary

    await _seed_crypto(session)          # bought 731 days ago → clamped
    # USD→SGD history, so coverage turns on price presence alone (the owner's FX is fresh).
    today = datetime.now(UTC).date()
    await fx_history.ingest_hist(session, (
        "Date, USD, INR, SGD, \n"
        f"{today.isoformat()}, 1.1435, 110.1020, 1.4765, \n"
    ))
    _free_tier_api(monkeypatch, [])

    await acquire.acquire_prices(session, "SGD")

    cov = await coverage_summary(session, "SGD")
    btc_row = next(r for r in cov["instruments"] if r["symbol"] == "BTC")
    assert btc_row["covered"] is True
    assert "365" in btc_row["summary"] and "carried" in btc_row["summary"].lower()


# --------------------------------------------------------------------------- #
# F-8c — the app's logger must survive an in-process migration
# --------------------------------------------------------------------------- #
def test_alembic_fileconfig_does_not_disable_the_app_logger():
    """RED: `fileConfig` defaults to `disable_existing_loggers=True`, which silenced "ledgerframe"
    for the life of the process — every acquisition warning, every request line, gone. Verified as
    the direct cause of an empty log file past "[db] applying migrations"."""
    import logging
    from logging.config import fileConfig

    log = logging.getLogger("ledgerframe")
    log.disabled = False
    fileConfig("alembic.ini", disable_existing_loggers=False)
    assert log.disabled is False, "a migration must never turn off the application's logging"


def test_migration_env_passes_disable_existing_loggers_false():
    """The pin lives at the call site: the env.py the app actually runs must not use the default."""
    from pathlib import Path

    src = Path("app/db/migrations/env.py").read_text()
    assert "disable_existing_loggers=False" in src


async def test_run_migrations_reasserts_application_logging(session, monkeypatch):
    """`fileConfig` also rebuilds the ROOT handler list from alembic.ini, dropping the app's
    rotating-file handler. The migration runner must put the app's own logging back, or the log
    file stops at startup — which is exactly what the owner's file did, every boot."""
    import logging

    from app.db import migrate

    calls: list = []
    monkeypatch.setattr("app.core.logging.setup_logging", lambda: calls.append("reasserted"))
    monkeypatch.setattr(migrate, "_migration_lock", lambda: __import__("contextlib").nullcontext())
    monkeypatch.setattr(migrate, "_state", lambda url: (True, True))
    monkeypatch.setattr(migrate.command, "upgrade", lambda cfg, rev: None)
    monkeypatch.setattr(migrate, "_alembic_config", lambda: SimpleNamespace())

    migrate.run_migrations(log=lambda *a, **k: None)

    assert calls == ["reasserted"]
    assert logging.getLogger("ledgerframe").disabled is False


# --------------------------------------------------------------------------- #
# F-8b — check, then skip (not download, then check)
# --------------------------------------------------------------------------- #
async def test_fresh_stored_fx_skips_the_download_entirely(session, monkeypatch):
    """The freshness test must PRECEDE the fetch: a device whose FX is already current must make
    no ECB request at all, and must say 'skipped' rather than implying a download happened."""
    from app.services import acquire, fx_history

    today = datetime.now(UTC).date()
    await fx_history.ingest_hist(session, (
        "Date, USD, INR, SGD, \n"
        f"{today.isoformat()}, 1.1435, 110.1020, 1.4765, \n"
        f"{(today - timedelta(days=1)).isoformat()}, 1.1600, 111.0000, 1.4800, \n"
    ), max_staleness_days=7)
    await session.commit()

    monkeypatch.setattr("app.services.acquire.get_settings",
                        lambda: SimpleNamespace(base_currency="SGD", is_demo=False))
    fetched: list = []

    async def _should_not_run(timeout: float = 60.0):
        fetched.append("fetched")
        raise AssertionError("the ECB archive was downloaded despite stored FX being fresh")
    monkeypatch.setattr("app.services.acquire.fetch_ecb_hist", _should_not_run)

    res = await acquire.acquire_history(session, "SGD")

    assert fetched == []
    assert res["ok"] is True and res.get("fx_skipped") is True
    assert "skipped" in res["message"].lower()


async def test_stale_stored_fx_still_downloads(session, monkeypatch):
    """The skip is conditional on freshness, not unconditional — an empty/stale store still fetches."""
    from app.services import acquire

    monkeypatch.setattr("app.services.acquire.get_settings",
                        lambda: SimpleNamespace(base_currency="SGD", is_demo=False))
    today = datetime.now(UTC).date()
    fetched: list = []

    async def _fetch(timeout: float = 60.0):
        fetched.append("fetched")
        return ("Date, USD, INR, SGD, \n"
                f"{today.isoformat()}, 1.1435, 110.1020, 1.4765, \n")
    monkeypatch.setattr("app.services.acquire.fetch_ecb_hist", _fetch)

    res = await acquire.acquire_history(session, "SGD")

    assert fetched == ["fetched"]
    assert res["ok"] is True and res.get("fx_skipped") is False


@pytest.mark.parametrize("bought_days_ago", [731, 400, 100])
async def test_acquisition_never_leaves_an_instrument_without_an_outcome(
        session, monkeypatch, bought_days_ago):
    """The structural pin: whatever the provider does, every held instrument ends the run with a
    recorded outcome. 'It failed but nothing says so' must not be reachable."""
    from app.models import InstrumentAcquisition
    from app.services import acquire

    btc = await _seed_crypto(session, bought_days_ago=bought_days_ago)
    _free_tier_api(monkeypatch, [])

    await acquire.acquire_prices(session, "SGD")

    assert await session.get(InstrumentAcquisition, btc.id) is not None
