# SPDX-License-Identifier: AGPL-3.0-or-later
"""F10 — the fresh-DB `get_history_cached` race.

`get_history_cached` opened with one-time repair blocks each shaped
``SELECT marker -> if absent, session.add(Setting(...)) -> flush()``. Two concurrent
first-load requests both read the marker as absent and both insert it; the loser hits
``UNIQUE constraint failed: settings.key`` and the request 500s.

This is the fresh-DB path EVERY NEW INSTALL takes: the Portfolio page issues its first
`/portfolio/performance` while another surface is issuing its own first history read.

The test drives CONCURRENT REQUESTS AGAINST THE APP — not a unit call on one session, and
not a mocked flush. A race that is only reasoned about is a race that gets "fixed" by a
change nobody watched work.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import delete, select

# The markers `get_history_cached` writes exactly once per install. Named here so this test
# fails loudly if a marker is renamed or a fourth is added without being considered — a guard
# that silently protects nothing is worse than no guard.
MARKER_KEYS = (
    "hist_demo_residue_repaired_v1",
    "hist_extended_hours_purged_v1",
    "hist_wrong_class_candles_purged_v1",
)


async def _clear_markers() -> None:
    """Put the install back into its genuine first-load state.

    The `app_client` fixture boots the app and seeds demo data, which may already have
    driven a history read and written the markers. Deleting them reconstructs the fresh-DB
    condition rather than assuming it.
    """
    from app.db.base import get_sessionmaker
    from app.models import Setting

    async with get_sessionmaker()() as s:
        await s.execute(delete(Setting).where(Setting.key.in_(MARKER_KEYS)))
        await s.commit()


async def _assert_markers_absent() -> None:
    from app.db.base import get_sessionmaker
    from app.models import Setting

    async with get_sessionmaker()() as s:
        rows = (await s.execute(select(Setting.key).where(Setting.key.in_(MARKER_KEYS)))).scalars().all()
    assert not rows, f"precondition failed — this is not a first load; markers present: {rows}"


async def test_concurrent_first_load_does_not_race_on_repair_markers(app_client):
    """Concurrent first-load history reads must all succeed on a fresh DB."""
    await _clear_markers()
    await _assert_markers_absent()

    responses = await asyncio.gather(*(
        app_client.get(
            "/api/v1/portfolio/performance",
            params={"days": 365, "benchmark": "SPY", "include_manual": False},
        )
        for _ in range(4)
    ), return_exceptions=True)

    failures = [r for r in responses if isinstance(r, BaseException) or r.status_code != 200]
    assert not failures, (
        "concurrent first-load requests did not all succeed — "
        f"{[(r if isinstance(r, BaseException) else (r.status_code, r.text[:400])) for r in failures]}"
    )


class _IntradayStub:
    """A NON-mock ('real') provider, so `get_history_cached` actually caches what it fetched.

    This matters for the fourth site: under the demo provider intraday is regenerated and
    never persisted, so the `hist_fetched` write is skipped entirely and a test using it
    would be VACUOUSLY green — it would never reach the insert it claims to guard.
    (Same stub shape as `test_intraday_storage.py`.)
    """

    name = "alphavantage"
    fetch_on_demand = False
    # Premium, or `intraday_availability` gates the range off as `tier_disabled` (market.py:510)
    # and the route returns before ever calling get_history_cached.
    av_tier = "premium"

    def __init__(self, candles):
        self._candles = candles

    async def get_history(self, *a, **k):
        return self._candles


def _intraday_candles(n: int = 5):
    from datetime import UTC, datetime, timedelta
    from decimal import Decimal

    from app.schemas.common import Candle

    base = datetime.now(UTC).replace(second=0, microsecond=0) - timedelta(minutes=n)
    out = []
    for i in range(n):
        c = Decimal(str(195 + i))
        out.append(Candle(ts=base + timedelta(minutes=i), open=c, high=c, low=c, close=c,
                          volume=Decimal("1000")))
    return out


async def test_concurrent_intraday_first_fetch_does_not_race_on_the_fetched_marker(
    app_client, monkeypatch
):
    """F10, fourth site: the `hist_fetched:{id}:{interval}` marker is the SAME shape.

    `get_history_cached` closes with `SELECT hist_fetched marker -> if absent,
    session.add(Setting(...)) -> flush()`. Concurrent first fetches of the same
    instrument+interval race exactly as the three repair markers did.

    Found by the isolation review §17-5 required — the fourth instance of a defect whose
    ruling had counted three.

    POSTURE MATTERS, and getting it wrong hides the bug. With a BRAND-NEW instrument the
    race does not appear: `_get_or_create_instrument` writes the instrument first, and that
    write takes SQLite's lock, serialising every concurrent caller so only one ever reaches
    the marker check while it is absent. The race needs the instrument to ALREADY EXIST —
    which is the ordinary case, not the exotic one: any holding the user has viewed before,
    whose 12h marker has since expired. So the test warms up first, then clears only the
    marker.
    """
    import app.services.market as market

    monkeypatch.setattr(market, "get_provider", lambda: _IntradayStub(_intraday_candles()))

    from app.db.base import get_sessionmaker
    from app.models import Setting

    warm = await app_client.get("/api/v1/instruments/AAPL/history", params={"range": "1D"})
    assert warm.status_code == 200, warm.text
    async with get_sessionmaker()() as s:
        await s.execute(delete(Setting).where(Setting.key.like("hist_fetched:%")))
        await s.commit()

    responses = await asyncio.gather(*(
        app_client.get("/api/v1/instruments/AAPL/history", params={"range": "1D"})
        for _ in range(8)
    ), return_exceptions=True)

    failures = [r for r in responses if isinstance(r, BaseException) or r.status_code != 200]
    assert not failures, (
        "concurrent intraday first fetches did not all succeed — "
        f"{[(r if isinstance(r, BaseException) else (r.status_code, r.text[:400])) for r in failures]}"
    )

    # The guard must not go blind: prove the run actually REACHED the insert this test exists
    # to protect. Without this, a posture change that stops caching intraday would leave the
    # test passing while guarding nothing. It caught exactly that while this test was written.
    async with get_sessionmaker()() as s:
        marks = (await s.execute(
            select(Setting.key).where(Setting.key.like("hist_fetched:%"))
        )).scalars().all()
    assert marks, "test reached no `hist_fetched` insert — it would be vacuously green"


async def test_repair_markers_are_written_exactly_once(app_client):
    """The upsert must not weaken the once-per-install contract.

    Sequential behaviour is unchanged: after any number of history reads each marker exists
    exactly once, so each repair still runs once per install rather than on every request.
    """
    from app.db.base import get_sessionmaker
    from app.models import Setting

    await _clear_markers()

    for _ in range(3):
        r = await app_client.get(
            "/api/v1/portfolio/performance",
            params={"days": 365, "benchmark": "SPY", "include_manual": False},
        )
        assert r.status_code == 200, r.text

    async with get_sessionmaker()() as s:
        keys = (await s.execute(select(Setting.key).where(Setting.key.in_(MARKER_KEYS)))).scalars().all()

    assert sorted(keys) == sorted(MARKER_KEYS), f"markers not written exactly once: {keys}"
