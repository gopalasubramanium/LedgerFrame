# SPDX-License-Identifier: AGPL-3.0-or-later
"""Phase 2b — realised gains & tax lots (read-only FIFO report; organisation, not advice)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace

from app.models import TxnType
from app.services.tax import fifo_report


def _txn(ttype, ts, qty, px, fees=0, taxes=0, ccy="USD"):
    return SimpleNamespace(type=ttype, ts=ts, quantity=Decimal(str(qty)), price=Decimal(str(px)),
                           fees=Decimal(str(fees)), taxes=Decimal(str(taxes)), currency=ccy)


def test_fifo_report_single_realised_event():
    txns = [_txn(TxnType.BUY, datetime(2023, 1, 1), 10, 100),
            _txn(TxnType.SELL, datetime(2024, 1, 1), 4, 150)]
    events, lots = fifo_report(txns)
    assert len(events) == 1
    e = events[0]
    assert e.quantity == Decimal("4") and e.gain == Decimal("200")   # (150-100)*4
    assert e.holding_days == 365
    assert len(lots) == 1 and lots[0].quantity == Decimal("6")


def test_fifo_report_matches_multiple_lots():
    txns = [_txn(TxnType.BUY, datetime(2023, 1, 1), 10, 100),
            _txn(TxnType.BUY, datetime(2023, 6, 1), 10, 120),
            _txn(TxnType.SELL, datetime(2024, 1, 1), 15, 150)]
    events, lots = fifo_report(txns)
    assert len(events) == 2                       # 10 from lot 1, 5 from lot 2
    assert events[0].quantity == Decimal("10") and events[0].cost == Decimal("1000")
    assert events[1].quantity == Decimal("5") and events[1].cost == Decimal("600")
    assert len(lots) == 1 and lots[0].quantity == Decimal("5")


def test_fifo_report_split_scales_lots():
    txns = [_txn(TxnType.BUY, datetime(2023, 1, 1), 10, 100),
            _txn(TxnType.SPLIT, datetime(2023, 6, 1), 0, 2),      # 2-for-1
            _txn(TxnType.SELL, datetime(2024, 1, 1), 5, 60)]
    events, lots = fifo_report(txns)
    assert events[0].cost == Decimal("250")       # 5 units at split-adjusted 50 cost
    assert lots[0].quantity == Decimal("15")      # 20 post-split minus 5 sold


# --- §4.3 Unit 1: corporate-action vectors that PIN the existing behaviour (no logic change) ---

def test_fifo_report_bonus_adds_zero_cost_lot_dated_at_event():
    """A bonus issue adds shares at zero cost: quantity up, total cost unchanged. BONUS-DATE
    POLICY (intentional): the bonus lot's acquisition date is the BONUS-EVENT date, not the
    original purchase date. Some tax regimes carry the original date; this app does not."""
    txns = [_txn(TxnType.BUY, datetime(2023, 1, 1), 10, 100),
            _txn(TxnType.BONUS, datetime(2023, 6, 1), 10, 0)]   # 10 free shares
    events, lots = fifo_report(txns)
    assert events == []                                          # a bonus realises nothing
    assert sum(lot.quantity for lot in lots) == Decimal("20")   # quantity up
    assert sum(lot.quantity * lot.unit_cost for lot in lots) == Decimal("1000")  # total cost unchanged
    bonus_lot = next(lot for lot in lots if lot.unit_cost == Decimal("0"))
    orig_lot = next(lot for lot in lots if lot.unit_cost == Decimal("100"))
    assert bonus_lot.acquired_ts == datetime(2023, 6, 1)        # bonus lot dated at the event
    assert orig_lot.acquired_ts == datetime(2023, 1, 1)         # original lot's date untouched


def test_fifo_report_corporate_action_order_independent():
    """fifo_report sorts by timestamp, so a split/bonus interleaved with trades in scrambled
    input order produces the identical result."""
    ordered = [_txn(TxnType.BUY, datetime(2023, 1, 1), 10, 100),
               _txn(TxnType.SPLIT, datetime(2023, 6, 1), 0, 2),
               _txn(TxnType.BONUS, datetime(2023, 9, 1), 5, 0),
               _txn(TxnType.SELL, datetime(2024, 1, 1), 8, 60)]
    scrambled = [ordered[3], ordered[1], ordered[0], ordered[2]]
    eo, lo = fifo_report(ordered)
    es, ls = fifo_report(scrambled)
    assert [(e.quantity, e.proceeds, e.cost) for e in eo] == [(e.quantity, e.proceeds, e.cost) for e in es]
    assert [(lot.quantity, lot.unit_cost, lot.acquired_ts) for lot in lo] \
        == [(lot.quantity, lot.unit_cost, lot.acquired_ts) for lot in ls]


def test_fifo_report_split_then_partial_sell_uses_adjusted_basis():
    """A partial sell after a split realises a gain on the split-adjusted cost, and the
    holding period runs from the ORIGINAL acquisition (a split preserves the lot's date)."""
    # Buy 10 @ 100 (cost 1000). 4:1 split → 40 @ 25 (cost still 1000). Sell 10 @ 40.
    txns = [_txn(TxnType.BUY, datetime(2023, 1, 1), 10, 100),
            _txn(TxnType.SPLIT, datetime(2023, 6, 1), 0, 4),
            _txn(TxnType.SELL, datetime(2024, 1, 1), 10, 40)]
    events, lots = fifo_report(txns)
    assert len(events) == 1
    e = events[0]
    assert e.cost == Decimal("250")            # 10 × split-adjusted 25
    assert e.proceeds == Decimal("400")        # 10 × 40
    assert e.gain == Decimal("150")            # 400 − 250, on the adjusted basis
    assert e.acquired_ts == datetime(2023, 1, 1)   # holding period from the original buy
    assert lots[0].quantity == Decimal("30")   # 40 − 10 sold


async def test_realised_gains_endpoint(app_client):
    d = (await app_client.get("/api/v1/portfolio/realised-gains")).json()
    assert "currency_groups" in d and "not tax advice" in d["disclaimer"].lower()
    assert "base_realised_total_current_fx" in d and d["years"]


async def test_short_long_split_respects_threshold(app_client):
    long = (await app_client.get("/api/v1/portfolio/realised-gains?long_term_days=1")).json()
    short = (await app_client.get("/api/v1/portfolio/realised-gains?long_term_days=3660")).json()
    for g in long["currency_groups"]:
        assert g["short_term"] == 0.0 and abs(g["long_term"] - g["realised_total"]) < 0.01
    for g in short["currency_groups"]:
        assert g["long_term"] == 0.0 and abs(g["short_term"] - g["realised_total"]) < 0.01


async def test_tax_lots_endpoint(app_client):
    d = (await app_client.get("/api/v1/portfolio/tax-lots")).json()
    assert d["lots"] and all("acquired_date" in lot and "holding_days" in lot for lot in d["lots"])


async def test_realised_gains_csv(app_client):
    r = await app_client.get("/api/v1/portfolio/realised-gains.csv")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    # §9-5: the per-event table header is present (no longer line 0 — a disclaimer/totals block
    # now leads the file so the served honesty payload travels with every export).
    assert any(line.startswith("currency,symbol,name,sell_date") for line in r.text.splitlines())


def _sample_realised_report() -> dict:
    """A minimal realised-gains report dict shaped exactly like realised_gains_report's output
    (tax.py:352-370) — used to PIN the CSV builder's rows without a DB (§3b value-test discipline)."""
    return {
        "year": 2024, "years": [2024], "long_term_days": 365, "base_currency": "SGD",
        "currency_groups": [{
            "currency": "USD", "realised_total": 100.0, "short_term": 40.0,
            "long_term": 60.0, "income": 0.0,
            "events": [{"symbol": "AAPL", "name": "Apple Inc.", "sell_date": "2024-03-01",
                        "acquired_date": "2022-01-01", "quantity": 10.0, "proceeds": 200.0,
                        "cost": 100.0, "gain": 100.0, "holding_days": 790, "long_term": True}],
        }],
        "base_realised_total_current_fx": 135.0,
        "base_realised_total_historical_fx": 128.5,
        "realised_fx_events_excluded": 2,
        "disclaimer": "Organisation & reporting only — NOT tax advice. VERIFY WITH YOUR BROKER.",
    }


async def test_tax_lots_csv_exists_and_carries_its_disclaimer(app_client):
    """§9-4 (add) + §9-5 (born with its disclaimer, fail-first): GET /portfolio/tax-lots.csv exists,
    serves text/csv with an attachment disposition, leads with the served disclaimer, and carries
    the per-lot table header (the lot keys). RED before the route/builder exist (404 — the SPA does
    not serve this API path, so the shape, not the status, discriminates)."""
    r = await app_client.get("/api/v1/portfolio/tax-lots.csv")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    assert "attachment" in r.headers.get("content-disposition", "")
    lines = r.text.splitlines()
    assert any("not tax advice" in ln.lower() for ln in lines)   # the served disclaimer travels in
    assert any(ln.startswith("symbol,name,acquired_date,quantity,unit_cost,cost") for ln in lines)


def test_realised_gains_csv_carries_served_disclaimer_and_both_totals():
    """§9-5 (honesty — fail-first, pinned): the export must carry (a) the SERVED disclaimer
    verbatim, (b) the trade-date-FX (historical) base total row, and (c) the excluded-events
    count row. An export that sheds any of these is a Guarantee-3 / D-020/D-076/D-077 violation.
    RED on the pre-§9-5 builder, which emitted only the bare per-event table."""
    from app.services.tax import realised_gains_csv

    rep = _sample_realised_report()
    text = realised_gains_csv(rep)
    lines = text.splitlines()

    # (a) the served disclaimer travels into the file, verbatim.
    assert rep["disclaimer"] in text
    # (b) the trade-date-FX (historical) base total row — labelled + valued.
    assert any("trade-date fx" in ln.lower() and "128.5" in ln for ln in lines), text
    # the current-FX total is retained too (the comparison figure).
    assert any("current fx" in ln.lower() and "135.0" in ln for ln in lines), text
    # (c) the excluded-events count row — labelled + valued.
    assert any("excluded" in ln.lower() and ",2" in ln for ln in lines), text
