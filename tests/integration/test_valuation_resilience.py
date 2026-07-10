# SPDX-License-Identifier: AGPL-3.0-or-later
"""Regression: the valuation reader (value_portfolio — shared by holdings,
holdings.csv and summary) must never HTTP 500 because one holding fails to value.
A failing holding degrades to Unavailable (honest, not fabricated) and is logged;
the page and export still render. Guards against the class of bug behind the
reported 500 (whatever the specific per-holding trigger)."""

from __future__ import annotations

from decimal import Decimal

import app.services.portfolio as pf
from app.models import Account, AssetClass, Holding, Instrument


async def test_reader_survives_a_bad_holding(app_client, session, monkeypatch):
    acc = Account(name="Broker", currency="USD")
    session.add(acc)
    await session.flush()
    instr = Instrument(symbol="AAPL", name="Apple", asset_class=AssetClass.EQUITY)
    session.add(instr)
    await session.flush()
    session.add(Holding(
        account_id=acc.id, instrument_id=instr.id, label="Apple",
        asset_class=AssetClass.EQUITY, quantity=Decimal("10"), avg_cost=Decimal("100"),
    ))
    await session.commit()

    # Simulate ANY per-holding valuation failure (bad data, provider edge, …).
    async def boom(_session, _h, _base, _warm):
        raise RuntimeError("simulated per-holding valuation failure")

    monkeypatch.setattr(pf, "_value_one_holding", boom)

    # None of the value_portfolio-backed endpoints may 500.
    assert (await app_client.get("/api/v1/portfolio/holdings")).status_code == 200
    assert (await app_client.get("/api/v1/portfolio/holdings.csv")).status_code == 200
    assert (await app_client.get("/api/v1/portfolio/summary")).status_code == 200

    # The bad holding is shown honestly as Unavailable, contributing nothing.
    body = (await app_client.get("/api/v1/portfolio/holdings")).json()
    row = body["holdings"][0]
    assert row["valuation_method"] == "unavailable"
    assert row["is_priced"] is False
    assert row["market_value"] == 0
