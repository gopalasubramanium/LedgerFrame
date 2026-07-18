# SPDX-License-Identifier: AGPL-3.0-or-later
"""POST-CLOSE DELTA D1-d — the internal-literal leak (found in the R-42 Phase-0 specimen).

An unmapped India mutual fund's routing reason was ``"map to a amfi_code (or set a
manual value)"`` — leaking the internal id_type literal ``amfi_code`` into a served
user-facing string. It reached the user via BOTH the Pricing Health routing reason AND
the Instrument-Detail daily-history empty state (``history_status``). Fixed at the ONE
canonical source (``router.py`` step-3 reason) so both surfaces are clean.
"""

from __future__ import annotations

from sqlalchemy import select

# The reworded, user-facing copy (no internal field names; GLOSSARY vocabulary).
EXPECTED = "map this fund to an AMFI scheme (or set a manual value)"


def test_unmapped_in_mf_reason_is_user_facing():
    # Pure route() — the canonical source of the reason string. RED before: the reason
    # contains the internal literal "amfi_code".
    from app.providers.market.router import route

    d = route(instrument_id=1, symbol="X", asset_class="mutual_fund", asset_subclass=None,
              listing_country="IN", mappings=set(), active_provider="mock", has_manual=False)
    assert d.mapping_required
    assert "amfi_code" not in (d.reason or "")
    assert d.reason == EXPECTED


async def test_served_history_status_has_no_internal_literal(app_client):
    # The served daily-history empty state (the specimen finding). Seed an unmapped IN MF
    # directly, then read the served history_status. RED before: "...amfi_code...".
    from app.db.base import get_sessionmaker
    from app.models import AssetClass, Instrument
    from app.services.market import history_status_for_instrument

    async with get_sessionmaker()() as s:
        instr = Instrument(
            symbol="UNMAPPEDINMF", name="Unmapped IN MF", currency="INR",
            asset_class=AssetClass.MUTUAL_FUND, listing_country="IN",
        )
        s.add(instr)
        await s.commit()

    async with get_sessionmaker()() as s:
        instr = (await s.execute(
            select(Instrument).where(Instrument.symbol == "UNMAPPEDINMF")
        )).scalars().first()
        status = await history_status_for_instrument(s, instr)

    assert status is not None
    assert "amfi_code" not in status
    assert status == EXPECTED
