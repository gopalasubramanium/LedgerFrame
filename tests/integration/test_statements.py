# SPDX-License-Identifier: AGPL-3.0-or-later
"""Financial statements (W5) — income, fees, cash flow from transactions."""

from __future__ import annotations


async def test_statements_income_fees_and_cashflow(app_client):
    # Base currency so amounts are identity (no FX) and assertions are exact.
    base = (await app_client.get("/api/v1/portfolio/statements")).json()["base_currency"]
    ts = "2026-06-01T00:00:00"
    seeds = [
        {"type": "dividend", "symbol": "AAPL", "ts": ts, "quantity": 1, "price": 500, "currency": base},
        {"type": "interest", "ts": ts, "quantity": 1, "price": 200, "currency": base},
        {"type": "deposit", "ts": ts, "quantity": 1, "price": 10000, "currency": base},
        {"type": "withdrawal", "ts": ts, "quantity": 1, "price": 3000, "currency": base},
        {"type": "fee", "ts": ts, "quantity": 1, "price": 50, "currency": base},
    ]
    for body in seeds:
        r = await app_client.post("/api/v1/portfolio/transactions", json=body)
        assert r.status_code == 200, r.text

    rep = (await app_client.get("/api/v1/portfolio/statements", params={"year": 2026})).json()
    assert rep["income"]["dividend"] == 500
    assert rep["income"]["interest"] == 200
    assert rep["income"]["total"] == 700
    assert rep["cashflow"]["deposits"] == 10000
    assert rep["cashflow"]["withdrawals"] == -3000
    assert rep["cashflow"]["net"] == 7000
    assert rep["fees"]["commissions"] >= 50   # the standalone fee txn
    assert 2026 in rep["years"]

    csv = (await app_client.get("/api/v1/portfolio/statements.csv", params={"year": 2026})).text
    assert "Income by year" in csv and "Cash flow by year" in csv and "Fees by year" in csv


def test_statements_csv_carries_the_full_D077_disclaimer():
    """§9-5 (page-reports, honesty — fail-first, pinned): the export must carry the FULL served
    D-077 disclaimer (the "for your accountant / not tax or financial advice" line), not only the
    partial current-FX caveat it shipped. RED on the pre-§9-5 builder."""
    from app.services.statements import statements_csv

    rep = {
        "base_currency": "SGD",
        "income_by_year": [{"year": 2026, "dividend": 500.0, "interest": 200.0, "total": 700.0}],
        "fees": {"by_year": [{"year": 2026, "commissions": 50.0, "taxes": 0.0, "total": 50.0}]},
        "cashflow": {"by_year": [{"year": 2026, "deposits": 10000.0, "withdrawals": -3000.0, "net": 7000.0}]},
        "disclaimer": ("Organisation for review / your accountant — not tax or financial advice. "
                       "Base-currency figures use current FX and are indicative, not for filing."),
    }
    text = statements_csv(rep)
    assert rep["disclaimer"] in text
