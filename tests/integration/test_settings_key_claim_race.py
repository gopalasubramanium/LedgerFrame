# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-58 — the `settings.key` check-then-insert race at the four filed sites.

The F10 delta fixed this race at four sites INSIDE `get_history_cached`; the ruling required a
read-only sweep of `app/` for the same shape rather than stopping at the reported defect. Four more
sites carry it, each shaped ``SELECT Setting -> if absent, session.add(Setting(...)) -> flush()`` on
`settings.key`: two concurrent callers both read absent, both insert, and the loser dies on
``UNIQUE constraint failed: settings.key`` — a 500 on a request that did nothing wrong.

The fix promotes F10's `_claim_marker` savepoint primitive to a shared home
(`app/db/claim.py::claim_setting`): the insert goes inside a SAVEPOINT so the loser's
``IntegrityError`` rolls back to the savepoint instead of poisoning the caller's transaction, and the
caller learns whether it won. The four filed sites keep their SELECT-first update-if-present branch
(the genuine already-present case is not a race) and delegate only the absent-INSERT to the primitive.

Two layers of proof, per F10's hardest-won lessons:
  * a DETERMINISTIC collision test on the primitive — the raw shape RAISES (documented, fix-independent),
    the primitive ABSORBS and leaves the session usable;
  * a CONCURRENT test per site driving real requests against the app — a race only reasoned about is a
    race "fixed" by a change nobody watched work. Each asserts it REACHED the guarded insert (the F10
    blindness pin: a green test that never arrived is indistinguishable from one that found nothing).
"""

from __future__ import annotations

import asyncio

import pytest
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

# Enough concurrent callers on ONE contended key that the pre-fix insert race is reliably reached;
# post-fix every interleaving is absorbed, so the count only affects how fast the RED shows, never green.
_N = 10


# --------------------------------------------------------------------------------------------------
# helpers (cross-session reads — each request commits via get_session, so a fresh session sees the row)
# --------------------------------------------------------------------------------------------------
async def _get_setting(key: str):
    from app.db.base import get_sessionmaker
    from app.models import Setting

    async with get_sessionmaker()() as s:
        return (await s.execute(select(Setting).where(Setting.key == key))).scalars().first()


async def _clear_setting(key: str) -> None:
    """Force the absent/insert posture — the branch that races. A pre-existing row takes the
    update branch and no insert ever fires (the F10 posture lesson: pick the posture that EXPOSES
    the race, not the forgiving one)."""
    from app.db.base import get_sessionmaker
    from app.models import Setting

    async with get_sessionmaker()() as s:
        await s.execute(delete(Setting).where(Setting.key == key))
        await s.commit()


def _assert_all_ok(responses, what: str) -> None:
    failures = [
        r for r in responses if isinstance(r, BaseException) or r.status_code != 200
    ]
    assert not failures, (
        f"concurrent {what} requests did not all succeed — "
        f"{[(r if isinstance(r, BaseException) else (r.status_code, r.text[:400])) for r in failures]}"
    )


# --------------------------------------------------------------------------------------------------
# the shared primitive — DETERMINISTIC collision (RED shape + GREEN absorb + reach)
# --------------------------------------------------------------------------------------------------
async def test_claim_setting_absorbs_a_losing_insert_deterministically():
    """The promoted primitive absorbs the loser of a settings.key insert race, deterministically.

    The losing interleaving is constructed rather than raced: a winner commits the key, then a
    second caller inserts the SAME key. The raw check-then-insert shape RAISES ``IntegrityError``
    (documented here, independent of the fix); `claim_setting` ABSORBS it, returns False, leaves the
    winner's value untouched (claim-vs-collide — never what a winner writes), and — the property a
    bare flush cannot give — leaves the caller's transaction usable.
    """
    from app.db.base import get_sessionmaker
    from app.db.claim import claim_setting
    from app.models import Setting

    K = "r58_probe_key"
    sm = get_sessionmaker()

    # A winner claims the key and commits it. `True` is the reach assertion for the happy path.
    async with sm() as winner:
        assert await claim_setting(winner, K, "winner") is True
        await winner.commit()

    # RED SHAPE (fix-independent): the raw check-then-insert loser raises on flush.
    async with sm() as raw:
        raw.add(Setting(key=K, value="loser"))
        with pytest.raises(IntegrityError):
            await raw.flush()

    # GREEN: claim_setting absorbs the collision, reports the loss, and does NOT poison the session.
    async with sm() as loser:
        assert await claim_setting(loser, K, "loser") is False
        row = (await loser.execute(select(Setting).where(Setting.key == K))).scalars().first()
        assert row is not None and row.value == "winner", "the winner's value must be untouched"
        # transaction still usable after the absorbed collision — a subsequent write succeeds
        assert await claim_setting(loser, "r58_probe_key_2", "ok") is True
        await loser.commit()


async def test_claim_setting_inserts_when_absent_and_reports_the_win():
    """Absent key: claim_setting inserts it and returns True (reach + happy path)."""
    from app.db.base import get_sessionmaker
    from app.db.claim import claim_setting

    sm = get_sessionmaker()
    async with sm() as s:
        assert await claim_setting(s, "r58_fresh_key", "v") is True
        await s.commit()
    row = await _get_setting("r58_fresh_key")
    assert row is not None and row.value == "v"


# --------------------------------------------------------------------------------------------------
# Site 1 — briefing.py `_set()` (generic helper, widest blast radius)  [POST /briefing/refresh]
# --------------------------------------------------------------------------------------------------
async def test_concurrent_briefing_refresh_does_not_race_on_daily_briefing(app_client):
    """Concurrent briefing refreshes on a fresh install must all succeed.

    `refresh_briefing` builds the text (read-only), then `_set(daily_briefing, ...)` — so on an
    install with no briefing yet, that insert is the request's FIRST write and nothing serialises
    the callers ahead of it (the exposing posture)."""
    await _clear_setting("daily_briefing")
    await _clear_setting("daily_briefing_ts")

    responses = await asyncio.gather(
        *(app_client.post("/api/v1/briefing/refresh") for _ in range(_N)),
        return_exceptions=True,
    )
    _assert_all_ok(responses, "briefing-refresh")
    assert await _get_setting("daily_briefing") is not None, (
        "the run never reached the daily_briefing insert — it would be vacuously green"
    )


# --------------------------------------------------------------------------------------------------
# Site 2 — feeds.py `set_feed_urls()`  [PUT /news/feeds]
# --------------------------------------------------------------------------------------------------
async def test_concurrent_feed_save_does_not_race_on_news_feeds(app_client):
    """Concurrent feed saves on a never-configured install must all succeed.

    `news_feeds` absent → `set_feed_urls` takes the insert branch (a present row is the update
    branch, which is not a race). Clear it first to guarantee the exposing posture."""
    await _clear_setting("news_feeds")
    body = {"feeds": ["https://example.com/rss.xml", "https://example.org/atom.xml"]}

    responses = await asyncio.gather(
        *(app_client.put("/api/v1/news/feeds", json=body) for _ in range(_N)),
        return_exceptions=True,
    )
    _assert_all_ok(responses, "feed-save")
    assert await _get_setting("news_feeds") is not None, (
        "the run never reached the news_feeds insert — it would be vacuously green"
    )


# --------------------------------------------------------------------------------------------------
# Site 3 — settings.py PUT loop (user-triggered)  [PUT /settings]
# --------------------------------------------------------------------------------------------------
async def test_concurrent_settings_put_does_not_race_on_the_written_key(app_client):
    """Concurrent settings writes of the same absent key must all succeed.

    The handler validates (read-only) then writes the key as the request's first write; clearing
    `home_quote_source` forces the insert branch. `home_quote_source` is chosen deliberately — it
    is a light-side-effect key (unlike `base_currency`, which rewrites .env and restarts the worker)."""
    await _clear_setting("home_quote_source")
    body = {"values": {"home_quote_source": "holdings"}}

    responses = await asyncio.gather(
        *(app_client.put("/api/v1/settings", json=body) for _ in range(_N)),
        return_exceptions=True,
    )
    _assert_all_ok(responses, "settings-put")
    assert await _get_setting("home_quote_source") is not None, (
        "the run never reached the settings insert — it would be vacuously green"
    )


# --------------------------------------------------------------------------------------------------
# Site 4 — system.py reset writing SEED_FLAG_KEY  [POST /system/reset-data] — POSTURE RECORDED
# --------------------------------------------------------------------------------------------------
async def test_reset_reaches_the_seed_flag_insert(app_client):
    """Site 4 — the posture is recorded, not forced.

    The reset runs a full ``table.delete()`` loop BEFORE writing SEED_FLAG_KEY. Those deletes take
    SQLite's write lock and SERIALISE concurrent resets: a second reset's flag SELECT sees the
    first's committed flag and takes the update branch, so the route-level insert race is
    latent-not-live. The RED for this site's SHAPE is `test_claim_setting_absorbs_...` above — the
    exact code the site now runs. This test is the BLINDNESS PIN: it proves a reset actually REACHES
    the seed-flag insert, so the shared-primitive migration is not vacuously green."""
    assert (await app_client.post("/api/v1/auth/set-pin", json={"pin": "581321"})).status_code == 200
    r = await app_client.post("/api/v1/system/reset-data", json={"pin": "581321"})
    assert r.status_code == 200, r.text

    from app.seed.demo import SEED_FLAG_KEY

    assert await _get_setting(SEED_FLAG_KEY) is not None, (
        "the reset never reached the seed-flag insert — it would be vacuously green"
    )
