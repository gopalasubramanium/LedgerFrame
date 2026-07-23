# SPDX-License-Identifier: AGPL-3.0-or-later
"""Markets overview, search, and instrument detail/history."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_auth
from app.core.config import get_settings
from app.core.symbols import currency_for_symbol
from app.models import AssetClass, Holding, Instrument, WatchlistItem
from app.providers.market import get_provider
from app.services.identity import resolve_or_create_instrument
from app.services.market import display_quote, refresh_quote

router = APIRouter()

# Baseline symbols always shown. Uses live-provider-friendly ETF proxies instead of
# raw indices (^GSPC etc.), which Alpha Vantage doesn't serve.
_DEFAULT_OVERVIEW = [
    "SPY", "QQQ", "DIA", "EWJ", "FEZ", "EWU", "EWH", "INDA", "EWS",
    "AAPL", "MSFT", "NVDA", "GLD", "BTC", "ETH",
]


async def _overview_instruments(session: AsyncSession) -> list[Instrument]:
    """All instruments to show on market views: defaults + watchlist + holdings."""
    held_ids = (
        await session.execute(select(Holding.instrument_id)  # §3.5 R12: don't target soft-deleted holdings
                              .where(Holding.instrument_id.isnot(None)).where(Holding.deleted_at.is_(None)))
    ).scalars().all()
    wl_ids = (await session.execute(select(WatchlistItem.instrument_id))).scalars().all()
    by_id = {
        i.id: i
        for i in (await session.execute(select(Instrument).where(Instrument.id.in_({*held_ids, *wl_ids})))).scalars()
    }
    ordered: list[Instrument] = []
    seen: set[str] = set()
    # Defaults first (create rows if missing), then held/watchlist extras.
    for sym in _DEFAULT_OVERVIEW:
        # R-63 I-6: one shared identity resolution (case-insensitive, savepoint-tolerant).
        instr, _ = await resolve_or_create_instrument(session, sym)
        if instr.symbol not in seen:
            ordered.append(instr)
            seen.add(instr.symbol)
    for instr in by_id.values():
        if instr.symbol not in seen:
            ordered.append(instr)
            seen.add(instr.symbol)
    return ordered


@router.get("/markets/overview")
async def markets_overview(session: AsyncSession = Depends(get_db)) -> dict:
    held_ids = set(  # §3.5 R12: don't target soft-deleted holdings
        (await session.execute(select(Holding.instrument_id)
                               .where(Holding.instrument_id.isnot(None)).where(Holding.deleted_at.is_(None)))).scalars().all()
    )
    instruments = await _overview_instruments(session)
    items = []
    for instr in instruments:
        q = await display_quote(session, instr.symbol, instr.exchange)
        items.append({
            "symbol": instr.symbol,
            "name": instr.name,
            "asset_class": instr.asset_class.value if hasattr(instr.asset_class, "value") else str(instr.asset_class),
            "currency": currency_for_symbol(instr.symbol, instr.exchange) or instr.currency,
            "country": instr.listing_country or instr.country,
            "held": instr.id in held_ids,
            "quote": q.model_dump(mode="json"),
        })
    status = await get_provider().get_market_status("US")
    return {
        # `quotes` kept for backward-compat (flat quote list); `instruments` is richer.
        "quotes": [it["quote"] for it in items],
        "instruments": items,
        "market_status": status.model_dump(mode="json"),
        "demo_mode": get_settings().is_demo,
    }


# Major world indices + cross-asset benchmarks, grouped for the Global page.
# World markets via liquid, broadly-supported ETF proxies (so a live provider like
# Alpha Vantage — which doesn't serve raw indices such as ^GSPC — returns real
# values). Each entry is (symbol, label).
# Each entry is (proxy_symbol, index_symbol, label). On providers that serve raw
# indices (e.g. Yahoo: supports_indices=True) the real index level is shown; on
# others (Alpha Vantage, mock) the liquid ETF proxy is used so a value still
# renders. For commodities/crypto the two are the same.
_GLOBAL_MARKETS: dict[str, list[tuple[str, str, str]]] = {
    "Americas": [("SPY", "^GSPC", "US · S&P 500"), ("QQQ", "^NDX", "US · Nasdaq 100"),
                 ("DIA", "^DJI", "US · Dow Jones")],
    "Europe": [("EWU", "^FTSE", "UK · FTSE 100"), ("FEZ", "^STOXX50E", "Europe · Euro Stoxx 50"),
               ("EWG", "^GDAXI", "Germany · DAX")],
    "Asia-Pacific": [("EWJ", "^N225", "Japan · Nikkei 225"), ("EWH", "^HSI", "Hong Kong · Hang Seng"),
                     ("INDA", "^NSEI", "India · Nifty 50"), ("EWS", "^STI", "Singapore · STI")],
    "Commodities": [("GLD", "GLD", "Gold"), ("SLV", "SLV", "Silver"), ("USO", "USO", "Oil")],
    "Crypto": [("BTC", "BTC", "Bitcoin"), ("ETH", "ETH", "Ethereum")],
}


# Canonical (Yahoo ^) index symbol → Alpha Vantage Index Data symbol. Only US
# indices are mapped; for the rest, AV uses the ETF proxy (Yahoo serves all ^).
_AV_INDEX = {"^GSPC": "SPX", "^IXIC": "COMP", "^NDX": "NDX", "^DJI": "DJI"}


def _global_symbol(proxy: str, index: str) -> str:
    """The symbol to query for a global-market entry on the current provider:
    a real index symbol where the provider supports it, else the ETF proxy."""
    provider = get_provider()
    if not getattr(provider, "supports_indices", False) or index == proxy:
        return proxy
    if getattr(provider, "name", "") == "yahoo":
        return index  # Yahoo serves all ^ indices
    return _AV_INDEX.get(index, proxy)  # AV: US indices only, else proxy


def global_market_symbols() -> list[str]:
    """Symbols the worker should keep fresh for the Global page. Includes the ETF
    proxy alongside the index on providers that may fall back (AV non-premium), so
    the fallback always has cached data. Yahoo serves all indices, so no proxies."""
    is_yahoo = getattr(get_provider(), "name", "") == "yahoo"
    out: list[str] = []
    for items in _GLOBAL_MARKETS.values():
        for proxy, idx, _ in items:
            sym = _global_symbol(proxy, idx)
            out.append(sym)
            if sym != proxy and not is_yahoo:
                out.append(proxy)  # keep the proxy cached for the AV fallback
    return list(dict.fromkeys(out))


@router.get("/markets/global")
async def markets_global(session: AsyncSession = Depends(get_db)) -> dict:
    indices = getattr(get_provider(), "supports_indices", False)
    groups = []
    shown_real = False
    for region, items_def in _GLOBAL_MARKETS.items():
        items = []
        for proxy, idx, label in items_def:
            sym = _global_symbol(proxy, idx)
            q = await display_quote(session, sym)
            # "Check the response and update accordingly": if a real-index quote is
            # unavailable (e.g. key isn't premium), fall back to the ETF proxy.
            if sym != proxy and q.price is None:
                sym, q = proxy, await display_quote(session, proxy)
            elif sym != proxy and q.price is not None:
                shown_real = True
            items.append({"symbol": sym, "label": label, "quote": q.model_dump(mode="json")})
        groups.append({"region": region, "items": items})
    status = await get_provider().get_market_status("US")
    return {
        "groups": groups, "market_status": status.model_dump(mode="json"),
        "demo_mode": get_settings().is_demo, "real_indices": indices and shown_real,
    }


@router.get("/markets/search")
async def markets_search(q: str = Query(min_length=1, max_length=40)) -> dict:
    results = await get_provider().search_instruments(q)
    return {"results": [r.model_dump(mode="json") for r in results]}


@router.get("/instruments/search")
async def instruments_search(
    q: str = Query(min_length=1, max_length=40),
    asset_class: str | None = Query(default=None),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """D-097 — class-aware instrument search for the Add-flow picker. Returns three
    honest buckets so an autocomplete can never misclassify:
      · `existing`     — ledger instruments of the picked class (selectable),
      · `other_class`  — ledger instruments matching under a DIFFERENT class
                         (navigate-to links only, never selectable into this flow),
      · `suggestions`  — provider search routed to the picked class's provider
                         (AMFI for mutual_fund, CoinGecko for crypto, the market
                         provider otherwise) — never a cross-provider mix.
    """
    ql = q.strip().lower()
    like = f"%{ql}%"
    rows = (await session.execute(
        select(Instrument).where(or_(
            func.lower(Instrument.symbol).like(like),
            func.lower(Instrument.name).like(like),
        )).limit(30)
    )).scalars().all()
    existing: list[dict] = []
    other_class: list[dict] = []
    for r in rows:
        ac = r.asset_class.value if hasattr(r.asset_class, "value") else str(r.asset_class)
        item = {"id": r.id, "symbol": r.symbol, "name": r.name or "", "asset_class": ac, "currency": r.currency}
        (other_class if (asset_class and ac != asset_class) else existing).append(item)

    suggestions: list[dict] = []
    try:
        if asset_class == "mutual_fund":
            from app.services import amfi as amfi_svc
            suggestions = [{"symbol": s["code"], "name": s["name"]} for s in await amfi_svc.search_schemes(session, q)]
        elif asset_class == "crypto":
            from app.services import coingecko as cg
            suggestions = [{"symbol": (c["symbol"] or "").upper(), "name": c["name"]} for c in await cg.search_coins(session, q)]
        else:
            # equity / etf / everything else → the general market provider.
            suggestions = [{"symbol": i.symbol, "name": getattr(i, "name", "") or ""}
                           for i in await get_provider().search_instruments(q)]
    except Exception:  # noqa: BLE001 — a provider outage must not break the picker
        suggestions = []

    # §14dr-13 — the class's instrument master state, so the picker's honest empty can say
    # WHY a class returned nothing: an empty crypto/mutual-fund master (never synced) is a
    # different, actionable emptiness than "no match". Served fact (D-105), null for classes
    # with no dedicated master (equity/etf → live provider search, nothing to sync).
    master: dict | None = None
    if asset_class == "mutual_fund":
        from app.services import amfi as amfi_svc
        master = {"provider": "amfi", "synced": ((await amfi_svc.status(session)).get("schemes") or 0) > 0}
    elif asset_class == "crypto":
        from app.services import coingecko as cg
        master = {"provider": "coingecko", "synced": ((await cg.status(session)).get("coins") or 0) > 0}

    return {"existing": existing, "other_class": other_class,
            "suggestions": suggestions, "master": master}


async def _asset_detail(session: AsyncSession, identifiers: list[dict]) -> dict:
    """Per-asset facts pulled from any linked adapter cache — official NAV for a
    mapped mutual fund, canonical id + market cap for a mapped crypto, and F&O
    identity (expiry/strike/lot) for a mapped derivative. Only shows what's actually
    linked; never inferred."""
    from app.core.money import to_display
    from app.models import AmfiScheme, CoingeckoCoin, KiteInstrument

    ids = {i["id_type"]: i["value"] for i in identifiers}
    detail: dict = {}
    if "amfi_code" in ids:
        sch = await session.get(AmfiScheme, ids["amfi_code"])
        if sch:
            detail["mutual_fund"] = {
                "amfi_code": sch.code, "fund_house": sch.fund_house, "category": sch.category,
                "isin": sch.isin_growth, "nav_date": sch.nav_date,
                "nav": to_display(sch.nav) if sch.nav is not None else None,
            }
    if "coingecko_id" in ids:
        coin = await session.get(CoingeckoCoin, ids["coingecko_id"])
        if coin:
            detail["crypto"] = {
                "coingecko_id": coin.id, "symbol": coin.symbol, "name": coin.name,
                "market_cap_usd": to_display(coin.market_cap_usd) if coin.market_cap_usd is not None else None,
            }
    if "kite_token" in ids:
        try:
            krow = await session.get(KiteInstrument, int(ids["kite_token"]))
        except (ValueError, TypeError):
            krow = None
        if krow:
            detail["derivative"] = {
                "tradingsymbol": krow.tradingsymbol, "exchange": krow.exchange,
                "segment": krow.segment, "instrument_type": krow.instrument_type,
                "lot_size": krow.lot_size, "expiry": krow.expiry,
                "strike": to_display(krow.strike) if krow.strike is not None else None,
            }
    return detail


# D-099 — the classes an ongoing cost (expense ratio) applies to: fund wrappers
# only. Equity/crypto/manual carry no expense ratio (MASTER-DATA §11).
FUND_WRAPPED_CLASSES = frozenset({"mutual_fund", "etf"})


class InstrumentPatch(BaseModel):
    asset_class: AssetClass | None = None
    country: str | None = None
    name: str | None = None
    source_override: str | None = None   # force a provider; "" or "auto" clears it


@router.patch("/instruments/{symbol}", dependencies=[Depends(require_auth)])
async def edit_instrument(symbol: str, payload: InstrumentPatch,
                          session: AsyncSession = Depends(get_db)) -> dict:
    """Manually correct an instrument's asset class / country / display name."""
    from app.models import AuditEvent

    instr = (await session.execute(
        select(Instrument).where(Instrument.symbol == symbol.upper())
    )).scalars().first()
    if instr is None:
        raise HTTPException(404, "unknown instrument")
    if payload.asset_class is not None:
        instr.asset_class = payload.asset_class
    if payload.country is not None:
        instr.country = payload.country.upper().strip() or None
    if payload.name is not None:
        instr.name = payload.name.strip()[:160] or instr.symbol
    if payload.source_override is not None:
        # §5: validate the override against this instrument (updated class/country/maps);
        # an unknown/unsuitable/uncredentialed source is rejected rather than stored.
        from app.services.market import validate_source_override

        normalized, err = await validate_source_override(session, instr, payload.source_override)
        if err:
            raise HTTPException(400, f"source override rejected: {err}")
        instr.source_override = normalized
    session.add(AuditEvent(category="mutation", action="edit_instrument", detail=instr.symbol))
    await session.flush()
    from app.services.portfolio import rebuild_holdings_from_transactions

    await rebuild_holdings_from_transactions(session)
    return {"ok": True, "symbol": instr.symbol,
            "asset_class": instr.asset_class.value if hasattr(instr.asset_class, "value") else str(instr.asset_class),
            "country": instr.country, "name": instr.name, "source_override": instr.source_override}


class OngoingCostPatch(BaseModel):
    annual_cost_bps: float | None = None   # null/omitted clears the rate; must be >= 0 when set


@router.put("/instruments/{symbol}/ongoing-cost", dependencies=[Depends(require_auth)])
async def set_instrument_ongoing_cost(symbol: str, payload: OngoingCostPatch,
                                      session: AsyncSession = Depends(get_db)) -> dict:
    """§4.6 set an instrument's annual ongoing cost (expense ratio) in basis points.

    A METADATA-ONLY write: it touches nothing but ``annual_cost_bps``. Unlike PATCH
    /instruments/{symbol}, it does NOT rebuild holdings or recompute any cost basis — the expense
    ratio doesn't affect quantities, FIFO, or valuation, so no rebuild is warranted, and this
    handler deliberately contains no such call. Null (or omitted) clears the rate to 'not set'
    (NOT 0, which would fabricate a fact); a negative value is rejected."""
    from decimal import Decimal

    from app.models import AuditEvent

    bps = payload.annual_cost_bps
    if bps is not None and bps < 0:
        raise HTTPException(400, "Ongoing cost can't be negative.")
    instr = (await session.execute(
        select(Instrument).where(Instrument.symbol == symbol.upper())
    )).scalars().first()
    if instr is None:
        raise HTTPException(404, "unknown instrument")
    # D-099: an ongoing cost (expense ratio) is CLASS-SCOPED — it belongs only to
    # fund-wrapped classes. Setting one on equity/crypto/manual is a category error;
    # reject it. Clearing (bps=None) is always allowed so an existing bad row can be
    # fixed.
    ac = instr.asset_class.value if hasattr(instr.asset_class, "value") else str(instr.asset_class)
    if bps is not None and ac not in FUND_WRAPPED_CLASSES:
        raise HTTPException(400, f"expense ratio applies only to fund-wrapped classes ({', '.join(sorted(FUND_WRAPPED_CLASSES))}), not {ac}")
    instr.annual_cost_bps = Decimal(str(bps)) if bps is not None else None
    session.add(AuditEvent(category="mutation", action="set_ongoing_cost", detail=instr.symbol))
    await session.flush()
    return {"ok": True, "symbol": instr.symbol,
            "annual_cost_bps": float(instr.annual_cost_bps) if instr.annual_cost_bps is not None else None}


class InstrumentMeta(BaseModel):
    """ND-4 — the typed footprint of one instrument's metadata (contract hygiene,
    like the Holdings §9-6 reshape). Fields are nullable at the JSON boundary; the
    class-conditional `asset_detail` (AMFI NAV / CoinGecko cap / F&O identity) and
    `history_status` (why history is unavailable) stay open dicts."""
    symbol: str
    name: str | None = None
    asset_class: str | None = None
    currency: str | None = None
    exchange: str | None = None
    sector: str | None = None
    country: str | None = None
    asset_subclass: str | None = None
    asset_category: str | None = None
    liquidity_profile: str | None = None
    listing_country: str | None = None
    exchange_mic: str | None = None
    source_override: str | None = None
    annual_cost_bps: float | None = None
    identifiers: list[dict] | None = None
    asset_detail: dict | None = None
    history_status: Any = None  # a dict OR a plain "why unavailable" string, or None


class InstrumentDetailResponse(BaseModel):
    quote: dict  # a typed Quote at source (`Quote.model_dump`)
    instrument: InstrumentMeta


@router.get("/instruments/{symbol}", response_model=InstrumentDetailResponse)
async def instrument_detail(symbol: str, session: AsyncSession = Depends(get_db)) -> dict:
    q = await refresh_quote(session, symbol)
    # Prefer stored instrument metadata (covers held/watchlisted symbols); fall back
    # to a provider search for anything else.
    instr = (
        await session.execute(select(Instrument).where(Instrument.symbol == symbol.upper()))
    ).scalars().first()
    if instr is not None:
        from app.services.market import backfill_instrument_name

        await backfill_instrument_name(session, instr.symbol)  # fill the display name once
        from app.services.identity import identifiers_for
        from app.services.portfolio import _SECTOR_MAP

        meta: dict[str, Any] = {
            "symbol": instr.symbol, "name": instr.name,
            "asset_class": instr.asset_class.value if hasattr(instr.asset_class, "value") else str(instr.asset_class),
            "currency": currency_for_symbol(instr.symbol, instr.exchange) or instr.currency,
            "exchange": instr.exchange,
            "sector": instr.sector or _SECTOR_MAP.get(instr.symbol.upper()), "country": instr.country,
            # Phase 2: taxonomy + normalized identifiers.
            "asset_subclass": instr.asset_subclass,
            "asset_category": instr.asset_category,
            "liquidity_profile": instr.liquidity_profile,
            "listing_country": instr.listing_country,
            "exchange_mic": instr.exchange_mic,
            "source_override": instr.source_override,
            # §4.6: the fund's ongoing cost (expense ratio) in bps, or None when not set — read-only
            # here so the editor can prefill; it is written via PUT /instruments/{symbol}/ongoing-cost.
            "annual_cost_bps": float(instr.annual_cost_bps) if instr.annual_cost_bps is not None else None,
            "identifiers": await identifiers_for(session, instr.id),
        }
        meta["asset_detail"] = await _asset_detail(session, meta["identifiers"])
        # §4: why price history is unavailable (mapping/NAV/manual), or None if it is.
        from app.services.market import history_status_for_instrument

        meta["history_status"] = await history_status_for_instrument(session, instr)
    else:
        results = await get_provider().search_instruments(symbol)
        match = next((r for r in results if r.symbol == symbol.upper()), None)
        meta = match.model_dump(mode="json") if match else {"symbol": symbol.upper()}
    return {"quote": q.model_dump(mode="json"), "instrument": meta}


@router.get("/instruments/{symbol}/news")
async def instrument_news(symbol: str, session: AsyncSession = Depends(get_db)) -> dict:
    """News relevant to one instrument: provider news for the symbol + any RSS/Atom
    headlines mentioning the symbol or company name."""
    from app.services.feeds import fetch_feeds, fetch_symbol_news, no_egress_enabled

    sym = symbol.upper()
    # ND-2 / Guarantee 5: per-instrument news is egress too — none under no-egress (honest empty).
    if await no_egress_enabled(session):
        return {"symbol": sym, "items": [], "no_egress": True}
    instr = (await session.execute(select(Instrument).where(Instrument.symbol == sym))).scalars().first()
    name = (instr.name if instr else "").replace(" (DEMO)", "").strip()
    terms = {sym.lower()}
    if name:
        terms.add(name.lower())
        first = name.split()[0].lower()
        if len(first) > 3:
            terms.add(first)

    items = list(await get_provider().get_news([sym]))
    # Free per-symbol headlines (Yahoo Finance RSS) — the primary source so the page
    # isn't empty when the market provider gives no news and no RSS feeds are set.
    try:
        items.extend(await fetch_symbol_news(sym))
    except Exception:  # noqa: BLE001
        pass
    try:
        for it in await fetch_feeds(session, limit=60):
            blob = f"{it.headline} {it.summary or ''}".lower()
            if any(t in blob for t in terms):
                items.append(it)
    except Exception:  # noqa: BLE001
        pass
    # Dedupe by headline, newest first.
    seen, out = set(), []
    for it in sorted(items, key=lambda i: i.published_at, reverse=True):
        if it.headline in seen:
            continue
        seen.add(it.headline)
        out.append(it.model_dump(mode="json"))
    return {"symbol": sym, "items": out[:15]}


@router.get("/instruments/{symbol}/history")
async def instrument_history(
    symbol: str,
    interval: str = Query("1d"),
    days: int = Query(180, ge=1, le=3650),
    range_: str | None = Query(None, alias="range"),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """Instrument price history. Always carries the served intraday availability map (D-105)
    so the range control renders its enabled/disabled + reason from a served truth, never a
    frontend constant (dr-7 gap). When ``range`` is an intraday range (1D/5D), the server maps
    it to an interval, applies the server-side gate, and — user-triggered — fetches it (or
    refuses honestly with a served reason, never a fabricated series). §9-2/§9-3/§9-9."""
    from app.services.feeds import no_egress_enabled
    from app.services.market import (
        INTRADAY_RANGES,
        get_history_cached,
        intraday_availability,
        intraday_marker_fresh,
    )

    # Resolve the instrument for the availability decision (transient equity if unseen —
    # get_history_cached persists it on fetch, mirroring the pre-R-42 behaviour).
    instrument = (await session.execute(
        select(Instrument).where(Instrument.symbol == symbol.upper())
    )).scalars().first() or Instrument(symbol=symbol.upper(), asset_class="equity", currency="USD")

    no_egress = await no_egress_enabled(session)
    avail = await intraday_availability(session, instrument, no_egress=no_egress)

    rng = (range_ or "").upper()
    fetch_state: str | None = None
    if rng in INTRADAY_RANGES:
        spec = INTRADAY_RANGES[rng]
        interval, days = spec["interval"], spec["days"]
        slot = avail["ranges"][rng]
        if not slot["enabled"]:
            # User-triggered, but the server refuses honestly — NO fetch, NO fabrication.
            return {
                "symbol": symbol.upper(), "interval": interval, "candles": [],
                "intraday": {**avail, "requested_range": rng, "fetch_state": slot["state"]},
            }
        marker_fresh = await intraday_marker_fresh(session, instrument.id, interval)

    end = datetime.now(UTC)
    start = end - timedelta(days=days)
    candles = await get_history_cached(session, symbol, interval, start, end)

    if rng in INTRADAY_RANGES:
        fetch_state = ("cached" if marker_fresh else "fetched") if candles else "pending"
    return {
        "symbol": symbol.upper(),
        "interval": interval,
        "candles": [c.model_dump(mode="json") for c in candles],
        "intraday": {
            **avail,
            "requested_range": rng if rng in INTRADAY_RANGES else None,
            "fetch_state": fetch_state,
        },
    }
