# SPDX-License-Identifier: AGPL-3.0-or-later
"""page-home Phase 0 (§9-3, §9-4, §9-7) — the Home contract deltas.

FAIL-FIRST: every test here was RED before the Phase-0 commit —
* `home_quote_source` was not allow-listed, so a PUT was **silently ignored** (the writer
  `continue`s past unknown keys and returns `applied={}`) and the read served no default;
* `GET /dashboard/home` returned **200** with the legacy v1 aggregate.

§12ho1-6 (owner, 2026-07-13) REMOVED the Simple layout: Home ships ONE layout, the ratified grid.
So `home_layout` is **gone from the allow-list, the defaults, and the served vocabulary** — keeping it
would leave exactly the WRITE-ONLY key D-078 forbids (the same class we just recorded against the
rotation keys). The tests below flipped with it: key-accepted became key-REJECTED.
"""

from __future__ import annotations

import pytest

# --- §9-3 / §9-7: the Home settings keys (server-persisted — D-078: they must survive a browser
# wipe, and the layout "defines what rotation shows"). ------------------------------------------


async def test_settings_serve_the_home_defaults(app_client):
    """A fresh install has a DEFAULT quote source — served, never guessed by the client."""
    d = (await app_client.get("/api/v1/settings")).json()
    assert d["defaults"]["home_quote_source"] == "holdings"  # §9-7 owner default


# --- §12ho1-6: the Simple layout is REMOVED; `home_layout` is retired from the contract ---------


@pytest.mark.parametrize("value", ["simple", "full"])
async def test_home_layout_is_no_longer_a_settable_key(app_client, value):
    """Home has ONE layout (§12ho1-6), so there is nothing for this key to choose. It must not
    linger as a write-only key (D-078): a PUT is REFUSED, not silently swallowed."""
    r = await app_client.put("/api/v1/settings", json={"values": {"home_layout": value}})
    assert r.status_code == 400, "home_layout is retired — writing it must be an honest refusal"


async def test_home_layout_is_neither_served_nor_stored(app_client):
    """Shape-discriminating (the Review lesson): a 400 alone could be an accident. The key must be
    absent from the served defaults AND the served vocabularies — no client can read a layout."""
    d = (await app_client.get("/api/v1/settings")).json()
    assert "home_layout" not in d["defaults"]
    assert "home_layouts" not in d["defaults"]
    assert "home_layout" not in d["stored"]


async def test_home_quote_source_is_writable_and_read_back(app_client):
    r = await app_client.put("/api/v1/settings", json={"values": {"home_quote_source": "global"}})
    assert r.status_code == 200
    assert r.json()["applied"]["home_quote_source"] == "global"
    d = (await app_client.get("/api/v1/settings")).json()
    assert d["stored"]["home_quote_source"] == "global"


@pytest.mark.parametrize(
    "key,bad",
    [("home_layout", "expert"), ("home_layout", ""), ("home_quote_source", "twitter")],
)
async def test_invalid_home_values_are_an_honest_400_never_a_silent_default(app_client, key, bad):
    """The backend is the validation truth: a value we don't recognise is refused, not coerced
    (the timezone/base_currency precedent). 'expert' is REFUSED — §9-1 retired that vocabulary."""
    r = await app_client.put("/api/v1/settings", json={"values": {key: bad}})
    assert r.status_code == 400


# --- §9-4: /dashboard/home is RETIRED (a deliberate contract DELETION) --------------------------


async def test_dashboard_home_is_retired(app_client):
    """The legacy v1 aggregate is GONE. Shape-discriminating (the Review lesson — a status code
    alone can be satisfied by an accident): assert the route 404s AND that none of the v1 payload's
    distinctive keys can be served from it. Home composes from the canonical readers (D-038)."""
    r = await app_client.get("/api/v1/dashboard/home")
    assert r.status_code == 404
    body = r.json()
    for legacy_key in ("portfolio", "top_movers", "markets", "fx", "briefing"):
        assert legacy_key not in body, f"the retired v1 aggregate still serves {legacy_key!r}"


async def test_the_canonical_readers_still_serve_what_home_needs(app_client):
    """Retiring the aggregate must not remove a figure — every widget's reader still answers."""
    s = (await app_client.get("/api/v1/portfolio/summary")).json()
    assert s["total_value"] is not None and "day_change" in s
    assert "allocation_by_class" in s and "top_gainers" in s and "top_losers" in s
    assert (await app_client.get("/api/v1/portfolio/review")).status_code == 200
    assert (await app_client.get("/api/v1/briefing")).status_code == 200
    assert (await app_client.get("/api/v1/news/grouped")).status_code == 200
    for src in ("/api/v1/markets/overview", "/api/v1/markets/global", "/api/v1/watchlists"):
        assert (await app_client.get(src)).status_code == 200


async def test_watchlists_serve_a_quote_per_item(app_client):
    """§9-7: the Watchlist quote source needs NO new endpoint and NO composition — `/watchlists`
    already serves a quote per item. (Verified before building; recorded so it is not re-litigated.)"""
    d = (await app_client.get("/api/v1/watchlists")).json()
    assert d["watchlists"], "demo should seed a watchlist"
    for wl in d["watchlists"]:
        for it in wl["items"]:
            assert "quote" in it and it["quote"]["symbol"]


async def test_refresh_coverage_did_not_shrink_when_the_home_tiles_list_died(app_client):
    """The retired module owned `_HOME_MARKETS = [SPY, QQQ, GLD, BTC]`, which fed the refresh
    warm-list. Those symbols are a strict SUBSET of the markets overview defaults, so dropping the
    curated 'home tiles' list must not shrink what gets refreshed."""
    from app.api.v1.routes.markets import _DEFAULT_OVERVIEW

    assert {"SPY", "QQQ", "GLD", "BTC"} <= set(_DEFAULT_OVERVIEW)
