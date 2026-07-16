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


def test_statements_csv_honours_the_selected_year():
    """§12rp-1 (page-reports gate ruling — fail-first, pinned): the Year control scopes BOTH the
    on-screen Realised stat AND the statements export, so the SELECTED YEAR must reach the artifact.
    The by-year rollup stays all-years; the year scopes the title + a selected-year summary block.
    RED on the pre-ruling builder (no year anywhere in the file → the two years produced identical
    text and the control governed a file it could not change)."""
    from app.services.statements import statements_csv

    def rep_for(year: int) -> dict:
        return {
            "base_currency": "SGD",
            "year": year,
            "income": {"dividend": 500.0, "interest": 200.0, "total": 700.0},
            "fees": {"commissions": 50.0, "taxes": 0.0, "total": 50.0,
                     "by_year": [{"year": year, "commissions": 50.0, "taxes": 0.0, "total": 50.0}]},
            "cashflow": {"deposits": 10000.0, "withdrawals": -3000.0, "net": 7000.0,
                         "by_year": [{"year": year, "deposits": 10000.0, "withdrawals": -3000.0, "net": 7000.0}]},
            "income_by_year": [{"year": year, "dividend": 500.0, "interest": 200.0, "total": 700.0}],
            "disclaimer": "Organisation for review / your accountant — not tax or financial advice.",
        }

    text_2024 = statements_csv(rep_for(2024))
    text_2023 = statements_csv(rep_for(2023))
    # The selected year rides the title + the selected-year summary block.
    assert "2024" in text_2024 and "Selected year, 2024" in text_2024
    assert "2023" in text_2023 and "Selected year, 2023" in text_2023
    # THE TEETH: changing the year changes the artifact — the control's scope reaches the file.
    assert text_2024 != text_2023
    # The disclaimer still travels (the Phase-0 §9-5 pin must not regress).
    assert rep_for(2024)["disclaimer"] in text_2024


def test_statements_csv_carries_the_realised_and_unrealised_stat_block():
    """§14rp-1 (owner walk 2026-07-17 — fail-first, pinned): the Statements CARD renders Realised
    (selected year) and Unrealised (open positions, now); an export MIRRORS its section, so the
    card's ARTIFACT must carry both. Realised is a YEAR-SCOPED row (it is the SAME one-derivation
    figure as realised-gains.csv — §12rp-3); Unrealised is an EXPLICIT AS-OF row (a now-snapshot must
    not read as a year figure inside a yearly artifact). RED on the pre-walk builder, which wrote
    neither (the realised-vs-unrealised block was deliberately omitted before the walk)."""
    from app.services.statements import statements_csv

    rep = {
        "base_currency": "SGD",
        "year": 2024,
        "as_of": "2026-07-17",
        "income": {"dividend": 500.0, "interest": 200.0, "total": 700.0},
        "fees": {"commissions": 50.0, "taxes": 0.0, "total": 50.0,
                 "by_year": [{"year": 2024, "commissions": 50.0, "taxes": 0.0, "total": 50.0}]},
        "cashflow": {"deposits": 10000.0, "withdrawals": -3000.0, "net": 7000.0,
                     "by_year": [{"year": 2024, "deposits": 10000.0, "withdrawals": -3000.0, "net": 7000.0}]},
        "income_by_year": [{"year": 2024, "dividend": 500.0, "interest": 200.0, "total": 700.0}],
        "realised_unrealised": {"realised": 804.5, "unrealised": 1234.56},
        "disclaimer": "Organisation for review / your accountant — not tax or financial advice.",
    }
    text = statements_csv(rep)
    lines = text.splitlines()
    # Realised — a YEAR-scoped row carrying the figure the card shows.
    assert any("Realised P/L (selected year, 2024)" in ln and "804.5" in ln for ln in lines), text
    # Unrealised — an EXPLICIT as-of row (open positions, now) so it never reads as a 2024 figure.
    assert any("Unrealised P/L (open positions, as of 2026-07-17)" in ln and "1234.56" in ln
               for ln in lines), text


async def test_statements_realised_equals_the_realised_gains_reader(app_client):
    """§12rp-3 (page-reports gate condition — fail-first, pinned): the Statements card's Realised
    stat and the Realised P/L report's current-FX total are ONE TRUTH. `statements_report` derives
    its realised figure by CALLING `realised_gains_report` and consuming `base_realised_total_current_fx`;
    it must render byte-identical — served at the SAME 2dp precision, never re-rounded to whole units.
    A realised gain WITH CENTS makes this discriminating: RED on the pre-ruling `_f` default p=0
    (123 != 123.40), GREEN once served at 2dp."""
    base = (await app_client.get("/api/v1/portfolio/statements")).json()["base_currency"]
    # Buy then sell in the base currency (no FX) so the realised gain is exact and carries CENTS.
    buy = {"type": "buy", "symbol": "ONE", "ts": "2026-01-05T00:00:00", "quantity": 10, "price": 100, "currency": base}
    sell = {"type": "sell", "symbol": "ONE", "ts": "2026-06-05T00:00:00", "quantity": 10, "price": 112.34, "currency": base}
    for body in (buy, sell):
        r = await app_client.post("/api/v1/portfolio/transactions", json=body)
        assert r.status_code == 200, r.text

    st = (await app_client.get("/api/v1/portfolio/statements", params={"year": 2026})).json()
    rg = (await app_client.get("/api/v1/portfolio/realised-gains", params={"year": 2026})).json()
    realised_stat = st["realised_unrealised"]["realised"]
    realised_report_total = rg["base_realised_total_current_fx"]
    # Discriminating fixture: the gain has cents (proceeds 1123.40 − cost 1000.00 = 123.40).
    assert realised_report_total != round(realised_report_total)  # not a whole number → the guard has teeth
    assert realised_stat == realised_report_total  # ONE TRUTH — identical served output
