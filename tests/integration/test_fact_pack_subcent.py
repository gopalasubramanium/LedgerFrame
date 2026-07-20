# SPDX-License-Identifier: AGPL-3.0-or-later
"""A SUB-CENT PRICE MUST NEVER RENDER AS 0.00 IN THE FACT PACK — R-54 F-3(i).

THE DEFECT
----------
The fact pack carried its own money renderer, ``_fmt = f"{value:,.2f} {ccy}"``, so a token priced
at ``0.00004567`` reached the user as **``0.00 USD``** — a fabricated-looking number on the one
surface built to be honest about where numbers come from. ``app/core/money.py:19-20`` states the
D-105 intent verbatim, and it governs the pack too:

    crypto → up to 6 significant digits (so sub-cent tokens aren't truncated to "0.00")

**It compounded with R-56.** ``safety._sig3("0.00")`` reduces to ``""`` and is discarded from the
traceable-fact set, so a fact rendered ``0.00`` could not be narrated either: the holder of a
sub-cent token saw ``0.00`` in the fact list AND got no narration of it.

**Invisible on the demo dataset**, whose only crypto is high-priced — this is a §26-bis
real-shaped-data case, which is why the test seeds a real sub-cent instrument rather than trusting
the fixture.

ASSERTED AT THE SERVED PACK (the F5 level): drives ``POST /ai/chat`` and reads the ``facts`` event
the panel renders, because the defect was in what the user was SHOWN.

Owner ruling 2026-07-21: the pack's price rendering adopts the sub-cent precision rule; ``_fmt`` is
deleted and ``money.py`` owns all rendering; the pack's ratified conventions (thousands grouping +
currency suffix) become a named variant sharing the D-105 core. **The compact price style is NOT
adopted** — ``68,000.50`` stays ``68,000.50``.
"""

from __future__ import annotations

import json
from decimal import Decimal

from app.core.money import format_fact_display

SUBCENT = Decimal("0.00004567")


async def _seed_subcent_token(symbol: str = "SHIBX") -> None:
    """Insert a real sub-cent crypto instrument, quoted, ON A WATCHLIST — real-shaped (§26-bis).

    ⚠ THE WATCHLIST PATH IS CHOSEN DELIBERATELY, AND FINDING OUT WHY WAS PART OF THE WORK.
    The first draft asked about the token directly, which routes through `_one_instrument_facts`
    → `refresh_quote` — a LIVE fetch (`tools.py:476`). Under the deterministic mock provider that
    **overwrote the seeded price with 100.74**, so the test was green-ish against a price the
    fixture invented rather than the sub-cent one the defect needs. `watchlist_quote_facts` reads
    `get_cached_quote` (`tools.py:138`), which honours the stored row — so the assertion measures
    the seeded value. *A fixture that quietly replaces the number under test proves nothing.*
    """
    from app.db.base import get_sessionmaker
    from app.models import AssetClass, Instrument, Quote, Watchlist, WatchlistItem

    sessionmaker = get_sessionmaker()
    async with sessionmaker() as s:
        instr = Instrument(symbol=symbol, name="Shiba Test Token",
                           currency="USD", asset_class=AssetClass.CRYPTO)
        s.add(instr)
        await s.flush()
        s.add(Quote(instrument_id=instr.id, price=SUBCENT, previous_close=SUBCENT,
                    currency="USD", source="mock"))
        # Into the FIRST watchlist, at the FRONT. `watchlist_quote_facts` takes `.first()` and
        # caps at `items[:8]` (`tools.py:125`) — and the demo seed already fills all eight, so a
        # new list is never read and a ninth item is sliced off. Two ways for this fixture to be
        # silently absent from the pack it is meant to exercise.
        from sqlalchemy import select

        wl = (await s.execute(select(Watchlist).order_by(Watchlist.id))).scalars().first()
        assert wl is not None, "no watchlist in the demo seed — fixture assumption drifted"

        # ⚠ `Watchlist.items` declares NO `order_by` (`models/__init__.py:492`), so it comes back in
        # ID order and `tools.py:125` then slices `items[:8]`. The demo seed already fills all
        # eight, so an appended row is sliced off — which is why the first two attempts at this
        # fixture were invisible in the pack. Room is made explicitly rather than by hoping.
        # (Noted in passing, NOT this delta's business: because the slice runs over an unordered
        #  relationship, the AI's watchlist facts follow INSERTION order and ignore the user's
        #  `sort_order` entirely.)
        existing = (await s.execute(
            select(WatchlistItem).where(WatchlistItem.watchlist_id == wl.id)
            .order_by(WatchlistItem.id)
        )).scalars().all()
        assert len(existing) >= 8, "demo watchlist smaller than assumed — re-check the slice"
        await s.delete(existing[-1])
        await s.flush()
        s.add(WatchlistItem(watchlist_id=wl.id, instrument_id=instr.id, sort_order=0))
        await s.commit()


async def _facts(app_client, question: str) -> list[dict]:
    r = await app_client.post("/api/v1/ai/chat", json={"question": question})
    assert r.status_code == 200
    facts: list[dict] = []
    for line in r.text.splitlines():
        if line.startswith("data:"):
            ev = json.loads(line[5:].strip())
            if ev.get("type") == "facts":
                facts = ev["facts"]
    return facts


async def test_a_subcent_price_is_not_rendered_as_zero(app_client):
    """THE FAIL-FIRST. Seen RED before the fix, rendering `0.00 USD`."""
    await _seed_subcent_token()
    facts = await _facts(app_client, "What is on my watchlist?")
    priced = [f for f in facts if f["label"] == "SHIBX"]
    assert priced, f"no SHIBX price fact in the pack — labels were {[f['label'] for f in facts]}"

    for f in priced:
        assert not f["value"].startswith("0.00 "), (
            f"{f['label']!r} rendered {f['value']!r} — a sub-cent price shown as 0.00 is a "
            f"fabricated-looking number (money.py:19-20, D-105)."
        )
        assert "0.00004567" in f["value"], (
            f"{f['label']!r} rendered {f['value']!r} — the sub-cent price must survive at up to "
            f"6 significant digits."
        )


async def test_the_subcent_fact_carries_its_currency_suffix(app_client):
    """The pack's ratified convention is preserved — the fix changes precision, not style."""
    await _seed_subcent_token()
    facts = await _facts(app_client, "What is on my watchlist?")
    priced = [f for f in facts if f["label"] == "SHIBX"]
    assert priced
    assert any("USD" in f["value"] for f in priced), (
        f"the currency suffix was lost: {[f['value'] for f in priced]}"
    )


# ── THE BLAST-RADIUS PIN (ruling 5) ──────────────────────────────────────────────────────────
# The change's reach is PROVEN, not assumed: every rendering the fix was not meant to touch is
# asserted byte-identical to what `_fmt` produced, and every rendering that DID move is enumerated
# by name. A formatter change on a ratified surface is only safe if you can say exactly what moved.

def _legacy_fmt(value, ccy: str) -> str:
    """`_fmt` exactly as it stood before R-54 F-3 — kept here as the comparison baseline only."""
    return f"{value:,.2f} {ccy}"


UNAFFECTED = [
    "0.00", "12.34", "-4567.89", "-250000.00", "772126.26", "12345678.90",
    "68000.50", "0.01", "-0.01", "999999999.99", "-9876543.21", "103907.53", "0.00999",
]

# The two ruled classes, and nothing else may appear here.
MOVED_SUBCENT = {"0.004": "0.004", "0.00004567": "0.00004567",
                 "0.000012": "0.000012", "0.0031": "0.0031"}
MOVED_HALF_UP = {"1.005": "1.01", "2.005": "2.01", "0.125": "0.13", "0.005": "0.01"}


def test_every_unaffected_rendering_is_byte_identical():
    """13 corpus values across negatives, zero, grouping and large magnitudes — all unchanged."""
    for v in UNAFFECTED:
        d = Decimal(v)
        assert format_fact_display(d, "SGD") == _legacy_fmt(d, "SGD"), (
            f"{v} rendered differently — this value was NOT in the fix's intended blast radius"
        )


def test_the_subcent_escalation_is_the_only_precision_change():
    """F-3(i): a non-zero value that would print 0.00 escalates to significant digits."""
    for v, expected in MOVED_SUBCENT.items():
        assert format_fact_display(Decimal(v), "SGD") == f"{expected} SGD"
        assert _legacy_fmt(Decimal(v), "SGD") == "0.00 SGD", (
            f"{v} did not previously render 0.00 — the baseline assumption has drifted"
        )


def test_half_cent_rounding_is_unified_to_half_up():
    """F-3(ii): banker's rounding is gone; the pack rounds like the rest of the product.

    Unified while still LATENT — `portfolio.py:577` cent-quantizes holdings before the pack sees
    them, so no shipped figure was reaching this boundary. Fixing it now costs nothing; fixing it
    after a caller started passing unquantized values would have been a silent figure change.
    """
    for v, expected in MOVED_HALF_UP.items():
        assert format_fact_display(Decimal(v), "SGD") == f"{expected} SGD"


def test_none_passes_through_instead_of_raising():
    """F-3(iii), closed by construction: an unpriced fact stays honestly empty (Guarantee 3)."""
    assert format_fact_display(None, "SGD") is None
    import pytest
    with pytest.raises(TypeError):
        _legacy_fmt(None, "SGD")  # the behaviour that was replaced


def test_the_pack_did_not_adopt_the_compact_price_style():
    """Ruling 3: the pack keeps its TRAILING ZEROS. 68,000.50 does not become 68,000.5.

    ⚠ CORRECTION OF THE F-3 SURVEY, MADE BY WRITING THIS ASSERTION. The survey report claimed the
    D-105 crypto path "drops thousands grouping and trims trailing zeros". The grouping half was
    **wrong** — `format(_SIG6.create_decimal(p), ",f")` keeps the separator, so the compact style
    is `68,000.5`, not `68000.5`. The trailing-zero difference is real and is the whole of what
    ruling 3 protects. *Recorded rather than quietly fixed: the survey is the evidence a ruling was
    made on, so an error in it is worth more visible than corrected in silence.*
    """
    from app.core.money import format_price_display

    assert format_fact_display(Decimal("68000.50"), "USD") == "68,000.50 USD"
    assert format_price_display(Decimal("68000.50"), "crypto") == "68,000.5"


def test_fmt_no_longer_exists_in_the_pack():
    """One home for rendering. A second one is how F-3 happened."""
    import app.ai.tools as tools

    assert not hasattr(tools, "_fmt"), (
        "app/ai/tools.py still defines `_fmt` — rendering logic outside money.py is the F6 shape"
    )
