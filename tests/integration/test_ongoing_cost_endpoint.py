# SPDX-License-Identifier: AGPL-3.0-or-later
"""§4.6 Unit C — PUT /instruments/{symbol}/ongoing-cost (metadata-only write).

R7 (the honesty contract): setting annual_cost_bps writes ONLY that column and does NOT trigger a
holdings rebuild or recompute any cost basis. The proof is holding-PK stability — a rebuild
delete+re-INSERTs derived holdings (new id), so the same row surviving with the same id/qty/avg_cost
means no rebuild fired. Plus: non-negative validation, and an unknown symbol returns 404.
"""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select

from app.db.base import get_sessionmaker
from app.models import AssetClass, AuditEvent, Holding, Instrument


async def test_set_ongoing_cost_is_metadata_only_no_rebuild(app_client):  # R7
    # A derived holding from the demo ledger + its instrument symbol; the rate starts unset.
    async with get_sessionmaker()() as s:
        h = (await s.execute(select(Holding).where(
            Holding.instrument_id.isnot(None), Holding.manual_value.is_(None)))).scalars().first()
        assert h is not None, "demo data should seed a transaction-derived holding"
        before_id, before_qty, before_avg = h.id, h.quantity, h.avg_cost
        instr = await s.get(Instrument, h.instrument_id)
        symbol = instr.symbol
        instr.asset_class = AssetClass.ETF   # D-099: expense ratio is fund-class only
        await s.commit()
        assert instr.annual_cost_bps is None                       # not set yet

    r = await app_client.put(f"/api/v1/instruments/{symbol}/ongoing-cost", json={"annual_cost_bps": 45})
    assert r.status_code == 200
    assert r.json()["annual_cost_bps"] == 45.0

    async with get_sessionmaker()() as s:
        # The rate persisted on the instrument…
        instr = (await s.execute(
            select(Instrument).where(Instrument.symbol == symbol.upper()))).scalars().first()
        assert instr.annual_cost_bps == Decimal("45")
        # …and the derived holding row is UNTOUCHED: same PK (no delete/recreate → no rebuild), same
        # quantity and avg_cost. A rebuild would have replaced the row under a new id.
        h2 = await s.get(Holding, before_id)
        assert h2 is not None
        assert h2.quantity == before_qty and h2.avg_cost == before_avg
        # Audit-logged like other mutations.
        actions = [a.action for a in (await s.execute(select(AuditEvent))).scalars()]
        assert "set_ongoing_cost" in actions


async def test_set_ongoing_cost_can_clear_to_null(app_client):
    async with get_sessionmaker()() as s:
        instr = (await s.execute(select(Instrument))).scalars().first()
        symbol = instr.symbol
        instr.asset_class = AssetClass.MUTUAL_FUND   # D-099: fund-class carries an expense ratio
        await s.commit()
    await app_client.put(f"/api/v1/instruments/{symbol}/ongoing-cost", json={"annual_cost_bps": 30})
    r = await app_client.put(f"/api/v1/instruments/{symbol}/ongoing-cost", json={"annual_cost_bps": None})
    assert r.status_code == 200
    assert r.json()["annual_cost_bps"] is None                     # cleared to 'not set', not 0
    async with get_sessionmaker()() as s:
        instr = (await s.execute(
            select(Instrument).where(Instrument.symbol == symbol.upper()))).scalars().first()
        assert instr.annual_cost_bps is None


async def test_ongoing_cost_rejects_negative(app_client):
    async with get_sessionmaker()() as s:
        symbol = (await s.execute(select(Instrument))).scalars().first().symbol
    r = await app_client.put(f"/api/v1/instruments/{symbol}/ongoing-cost", json={"annual_cost_bps": -5})
    assert r.status_code == 400


async def test_ongoing_cost_unknown_symbol_404(app_client):
    r = await app_client.put("/api/v1/instruments/NOPE__NOT_REAL/ongoing-cost", json={"annual_cost_bps": 10})
    assert r.status_code == 404


async def test_ongoing_cost_rejects_non_fund_class(app_client):
    """D-099 — an expense ratio applies to fund wrappers only; setting one on equity
    is a category error and is rejected. Clearing (null) is always allowed."""
    async with get_sessionmaker()() as s:
        instr = (await s.execute(select(Instrument))).scalars().first()
        symbol = instr.symbol
        instr.asset_class = AssetClass.EQUITY
        await s.commit()
    bad = await app_client.put(f"/api/v1/instruments/{symbol}/ongoing-cost", json={"annual_cost_bps": 20})
    assert bad.status_code == 400 and "fund" in bad.json()["detail"].lower()
    # But clearing a non-fund row is allowed (so a bad row can be fixed).
    ok = await app_client.put(f"/api/v1/instruments/{symbol}/ongoing-cost", json={"annual_cost_bps": None})
    assert ok.status_code == 200
