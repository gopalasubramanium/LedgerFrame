# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-43 §12 step 3 — class-aware history/intraday capability + wrong-instrument garbage purge.

§12-R3: a provider's history/intraday capability is PER ASSET CLASS. Alpha Vantage's
TIME_SERIES_DAILY / _INTRADAY are EQUITY endpoints — fetching crypto history through them returns
wrong-instrument garbage (live BTC 64,024 vs AV daily "BTC" close 28.38, the F-1/F-3 root). The
fetch must be impossible by construction (refused at the capability layer), and candles already
stored from that mistake are purged (the dr-25/W-3 idempotent, logged pattern).
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal


def test_alphavantage_history_capability_is_equity_etf_only():
    """§12-R3: AV can fetch history for equity/etf but NOT crypto or fx (its daily endpoint is an
    equity endpoint). RED before step 3: the capability was a global bool, blind to asset class."""
    from app.providers.market.router import can_fetch_history, can_fetch_intraday, capabilities_for

    av = capabilities_for("alphavantage")
    assert can_fetch_history(av, "equity") is True
    assert can_fetch_history(av, "etf") is True
    assert can_fetch_history(av, "crypto") is False   # the wrong-instrument case
    assert can_fetch_history(av, "fx") is False
    assert can_fetch_intraday(av, "crypto") is False
    # CoinGecko (step 4) is the crypto daily-history owner — never AV.
    assert can_fetch_history(capabilities_for("coingecko"), "crypto") is True


def test_history_source_refuses_av_for_a_crypto_instrument_at_the_capability_layer():
    """§12-R3: routing a crypto instrument (source_override=alphavantage) to AV history is refused
    with a served reason — never sent to the equity endpoint. RED: _history_source only checked the
    global .history bool, so it returned 'alphavantage' and the garbage fetch proceeded."""
    from app.providers.market.router import RouteDiagnostic
    from app.services.market import _history_source

    diag = RouteDiagnostic(
        instrument_id=1, symbol="BTC", asset_class="crypto", lane="crypto",
        priority_chain=["coingecko", "alphavantage"], source_selected="alphavantage",
        valuation_method="market_quote",
    )
    src, reason = _history_source(diag, "alphavantage")
    assert src is None
    assert "crypto" in (reason or "").lower()

    # An equity through AV still fetches (no regression to the working path).
    eq = RouteDiagnostic(
        instrument_id=2, symbol="TSLA", asset_class="equity", lane="us_equity",
        priority_chain=["alphavantage"], source_selected="alphavantage",
        valuation_method="market_quote",
    )
    assert _history_source(eq, "alphavantage")[0] == "alphavantage"


async def _seed(session, symbol, asset_class, source):
    from app.models import AssetClass, Instrument, PriceHistory

    instr = Instrument(symbol=symbol, currency="USD", pricing_currency="USD",
                       asset_class=AssetClass(asset_class))
    session.add(instr)
    await session.flush()
    for day in (1, 2, 3):
        session.add(PriceHistory(instrument_id=instr.id, interval="1d",
                                 ts=datetime(2026, 1, day, tzinfo=UTC),
                                 open=Decimal("28"), high=Decimal("29"), low=Decimal("27"),
                                 close=Decimal("28.38"), source=source))
    await session.flush()
    return instr


async def test_purge_removes_wrong_instrument_crypto_candles_but_keeps_legit_equity(session):
    """§12-R3 purge: crypto candles sourced from AV (wrong-instrument garbage) are removed; an
    equity's AV candles (legit) are untouched. Logged counts; idempotent (second run = 0)."""
    from sqlalchemy import func, select

    from app.models import PriceHistory
    from app.services.market import repair_wrong_class_candles

    await _seed(session, "BTC", "crypto", "alphavantage")   # wrong-instrument
    await _seed(session, "TSLA", "equity", "alphavantage")  # legit
    await _seed(session, "XRP", "crypto", "coingecko")      # legit crypto source (kept)

    res = await repair_wrong_class_candles(session)
    assert res["purged"] == 3          # the 3 BTC AV rows
    assert res["instruments"] == 1
    remaining = (await session.execute(select(func.count()).select_from(PriceHistory))).scalar()
    assert remaining == 6              # TSLA (3) + XRP (3) kept

    second = await repair_wrong_class_candles(session)
    assert second["purged"] == 0       # idempotent — nothing wrong-instrument left
