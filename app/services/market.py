# SPDX-License-Identifier: AGPL-3.0-or-later
"""Market service: fetch quotes via the provider, persist with provenance, and
expose staleness. Never silently substitutes stale data for live — staleness is
computed from the stored ``received_at`` against the configured threshold and
returned explicitly on every quote.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.money import format_price_display, pct_change
from app.models import Instrument
from app.models import Quote as QuoteRow
from app.providers.market import get_provider
from app.schemas.common import EntitlementStatus, Quote, ValuationMethod

log = logging.getLogger(__name__)


# An end-of-day / NAV quote is the authoritative value for the whole day — it is not
# "stale" 15 minutes later. Only flag it once it's a full day old (missed a publish).
_EOD_STALE_SECONDS = 30 * 3600


def _is_stale(received_at: datetime, entitlement: str | None = None) -> bool:
    if received_at.tzinfo is None:
        received_at = received_at.replace(tzinfo=UTC)
    age = (datetime.now(UTC) - received_at).total_seconds()
    threshold = get_settings().stale_after_seconds
    if entitlement in ("end-of-day", "official_nav"):
        threshold = max(threshold, _EOD_STALE_SECONDS)   # daily data is fresh for the day
    return age > threshold


def _history_source(diag, active_name: str) -> tuple[str | None, str | None]:
    """Which source (if any) may fetch *history* for this instrument (§4). Returns
    ``(source, reason)`` — ``source=None`` means no fetch (cache-only) with a reason."""
    from app.providers.market.router import capabilities_for

    src = diag.source_selected
    if src is None:
        return None, diag.reason or "no source can price this holding"
    if src == "manual":
        return None, "manual valuation — no market history"
    if src == "amfi_nav":
        return None, "NAV history not available yet"
    if src == "coingecko":
        return None, "canonical-id price history not available yet"
    if not capabilities_for(src).history:
        return None, f"{src} does not provide history"
    if src != active_name:
        return None, f"history owned by {src}, not the active provider"
    return src, None


async def history_status_for_instrument(session: AsyncSession, instrument) -> str | None:
    """Human reason why market history is unavailable for an instrument, or None if it
    is available. Surfaced in instrument detail (§4)."""
    diag = await route_for_instrument(session, instrument)
    _src, reason = _history_source(diag, getattr(get_provider(), "name", "mock"))
    return reason


def provider_availability() -> dict:
    """Runtime availability of keyed sources, for the router's real ``auth_required``
    (§6). Keyless sources (AMFI/CoinGecko/ECB) never gate on credentials."""
    from app.providers.market.router import ProviderAvailability, capabilities_for

    s = get_settings()
    active = s.market_provider
    caps = capabilities_for(active)
    av = {active: ProviderAvailability(
        name=active, configured=True,
        has_credentials=(not caps.needs_key) or bool(s.market_api_key), enabled=True)}
    # Kite is "configured" once the user has entered any Kite credential; it's only
    # usable with BOTH api key and access token.
    if s.kite_api_key or s.kite_access_token:
        av["kite"] = ProviderAvailability(
            name="kite", configured=True,
            has_credentials=bool(s.kite_api_key and s.kite_access_token), enabled=True)
    return av


async def validate_source_override(session: AsyncSession, instrument, value: str | None) -> tuple[str | None, str | None]:
    """Validate a per-instrument source override (§5). Returns ``(normalized, error)``:
    ``normalized=None, error=None`` clears it; a non-None error means reject and keep the
    current override. Rejects unknown sources, unsuitable asset-class/region, missing
    identifier mappings, and sources whose credentials are absent."""
    from app.models import InstrumentIdentifier
    from app.providers.market.router import (
        _MANUAL_LANES,
        CAPABILITIES,
        capabilities_for,
        lane_for,
    )

    v = (value or "").strip().lower()
    if v in ("", "auto", "none"):
        return None, None
    if v not in CAPABILITIES:
        return None, f"unknown source '{value}'"

    caps = capabilities_for(v)
    ac = instrument.asset_class.value if hasattr(instrument.asset_class, "value") else str(instrument.asset_class)
    country = (instrument.listing_country or instrument.country or "").upper()
    lane = lane_for(ac, instrument.asset_subclass, country)

    if lane in _MANUAL_LANES:
        return None, f"{ac} is valued manually — a market source can't price it"
    if caps.asset_classes and ac not in caps.asset_classes and "*" not in caps.asset_classes:
        return None, f"{v} can't price a {ac}"
    if caps.regions and country and country not in caps.regions and "*" not in caps.regions:
        return None, f"{v} doesn't cover {country}"

    ids = set((await session.execute(
        select(InstrumentIdentifier.id_type).where(InstrumentIdentifier.instrument_id == instrument.id)
    )).scalars().all())
    if v == "amfi_nav" and (ac != "mutual_fund" or "amfi_code" not in ids):
        return None, "amfi_nav needs an AMFI scheme mapping on a mutual fund"
    if v == "coingecko" and (ac != "crypto" or "coingecko_id" not in ids):
        return None, "coingecko needs a canonical id mapping on a crypto"

    if caps.needs_key:
        av = provider_availability().get(v)
        if not av or not av.has_credentials:
            return None, f"{v} needs credentials — add them in Settings first"
    return v, None


def validate_matrix_provider(
    asset_class: str, listing_country: str, provider: str,
) -> tuple[str | None, str | None, bool, str | None]:
    """Validate a routing-matrix cell (R-38; data-feed-routing §9-3/§9-7).

    A cell is a *class × country* preference, NOT an instrument — so only class and
    region coverage are checked (no per-instrument id-mapping). Returns
    ``(normalized_provider, error, degraded, caveat)``:

    * ``error`` non-None → **reject** with an honest 400 (unknown source, or a
      capability mismatch the owner can read).
    * ``degraded`` True + ``caveat`` → **accept-with-caveat** (§9-7): the provider is
      *capable* for this cell but ``needs_key`` and no credentials are set. The cell is
      stored and shown degraded until the key lands; ``route()`` falls through via
      ``_auth_gap`` in the meantime — never a silent dead cell.
    """
    from app.providers.market.router import CAPABILITIES, capabilities_for

    prov = (provider or "").strip().lower()
    ac = (asset_class or "").strip().lower()
    country = (listing_country or "").strip().upper()
    if prov not in CAPABILITIES:
        return None, f"unknown source '{provider}'", False, None
    caps = capabilities_for(prov)
    if caps.asset_classes and ac not in caps.asset_classes and "*" not in caps.asset_classes:
        return None, f"{prov} can't price a {ac}", False, None
    if caps.regions:
        if country == "*":
            if "*" not in caps.regions:
                covered = ", ".join(sorted(caps.regions))
                return None, f"{prov} doesn't cover every market (*) — it covers {covered}", False, None
        elif country and country not in caps.regions and "*" not in caps.regions:
            return None, f"{prov} doesn't cover {country}", False, None
    # Capable-but-unkeyed (§9-7): accept, but flag degraded until credentials land.
    if caps.needs_key:
        av = provider_availability().get(prov)
        if not av or not av.has_credentials:
            return prov, None, True, f"{prov} needs credentials — add them in Settings"
    return prov, None, False, None


def matrix_cell_state(
    asset_class: str, listing_country: str, provider: str, updated_at=None,
) -> dict:
    """The served display state of one stored cell (D-005 served strings). A stored
    cell whose provider is no longer capable is shown degraded with the honest reason
    (the §9-3 stale-cell case), never removed silently."""
    _norm, error, degraded, caveat = validate_matrix_provider(asset_class, listing_country, provider)
    if error:  # a persisted cell that has since become incapable/unknown (stale)
        degraded, caveat = True, error
    return {
        "asset_class": asset_class, "listing_country": listing_country, "provider": provider,
        "degraded": degraded, "caveat": caveat,
        "updated_at": updated_at.isoformat() if updated_at else None,
    }


def av_tier_note(source: str | None, av_tier: str | None) -> str | None:
    """The honest served string for an Alpha Vantage tier-degraded case (§9-8). Grounded
    strictly in ``external.py`` — ``av_tier`` is *learned* from the key (premium prices
    real index levels; free/unknown falls back to ETF proxies). Returns ``None`` when it
    doesn't apply; invents NO new tier semantics — it only formats the existing signal."""
    if source == "alphavantage" and av_tier in ("free", "unknown"):
        return "index via ETF proxy — key not premium"
    return None


async def matrix_provider_for(session: AsyncSession, asset_class: str, listing_country: str | None) -> str | None:
    """The routing-matrix provider for an instrument's (class, country), or None if the
    matrix has no cell. Exact country wins over the ``"*"`` wildcard (data-feed-routing
    §9-5). Pure lookup — capability re-validation happens inside ``route()`` (§9-3)."""
    from app.models import RoutingMatrix

    ac = (asset_class or "").strip().lower()
    country = (listing_country or "").strip().upper()
    rows = {
        r.listing_country: r.provider
        for r in (await session.execute(
            select(RoutingMatrix).where(RoutingMatrix.asset_class == ac)
        )).scalars().all()
    }
    if country and country in rows:
        return rows[country]
    return rows.get("*")


async def route_for_instrument(session: AsyncSession, instrument):
    """Per-instrument routing decision (which source owns this price). Pure policy in
    :func:`app.providers.market.router.route`; here we gather the live context."""
    from app.models import Holding, InstrumentIdentifier
    from app.providers.market.router import route

    ids = (await session.execute(
        select(InstrumentIdentifier.id_type).where(InstrumentIdentifier.instrument_id == instrument.id)
    )).scalars().all()
    has_manual = (await session.execute(
        # §3.5 R12: a soft-deleted manual holding must not mark its instrument "manual" for routing.
        select(Holding.id).where(Holding.instrument_id == instrument.id, Holding.manual_value.isnot(None),
                                 Holding.deleted_at.is_(None)).limit(1)
    )).first() is not None
    cached = await session.get(QuoteRow, instrument.id)
    ac = instrument.asset_class.value if hasattr(instrument.asset_class, "value") else str(instrument.asset_class)
    country = instrument.listing_country or instrument.country
    return route(
        instrument_id=instrument.id, symbol=instrument.symbol, asset_class=ac,
        asset_subclass=instrument.asset_subclass,
        listing_country=country,
        mappings=set(ids), active_provider=getattr(get_provider(), "name", "mock"),
        has_manual=has_manual, source_override=instrument.source_override,
        cached_source=cached.source if cached else None,
        availability=provider_availability(),
        matrix_provider=await matrix_provider_for(session, ac, country),
    )


async def refresh_quote(session: AsyncSession, symbol: str, exchange: str | None = None) -> Quote:
    """Fetch a fresh quote and upsert it. On provider failure, return the last
    cached quote marked stale/cached rather than raising.

    Routes per instrument: the active market provider only fetches instruments it
    actually owns. AMFI/CoinGecko-published, manual, or unmapped instruments are served
    from the stored quote so a live equity feed never overwrites a NAV / canonical-id
    price with a wrong one.
    """
    provider = get_provider()
    instrument = await _get_or_create_instrument(session, symbol, exchange)
    diag = await route_for_instrument(session, instrument)
    if diag.source_selected != getattr(provider, "name", "mock"):
        # Authoritative source is a cache-publish adapter, manual, or unavailable —
        # never let the active provider fetch/overwrite it.
        return await get_cached_quote(session, symbol, exchange)
    try:
        q = await provider.get_quote(symbol, exchange)
        if q.price is None:
            # Provider couldn't deliver (e.g. rate-limited). Do NOT write a null
            # price (the column is NOT NULL, and a null would poison the session).
            # Return the last cached quote, or an explicit "unavailable".
            return await get_cached_quote(session, symbol, exchange)
        # Race-safe upsert: concurrent dashboard requests often refresh the same
        # symbol at once (SPY appears on Home, Markets and Global). A check-then-
        # insert would hit "UNIQUE constraint failed: quotes.instrument_id"; an
        # atomic ON CONFLICT DO UPDATE can't.
        from app.db.upsert import upsert

        values = {
            "instrument_id": instrument.id,
            "price": q.price,
            "previous_close": q.previous_close,
            "currency": q.currency,
            "source": q.source,
            "entitlement": q.entitlement.value,
            "market_time": q.market_time,
            "received_at": datetime.now(UTC),
        }
        stmt = upsert(QuoteRow).values(**values)
        stmt = stmt.on_conflict_do_update(
            index_elements=[QuoteRow.instrument_id],
            set_={k: v for k, v in values.items() if k != "instrument_id"},
        )
        await session.execute(stmt)
        await session.flush()
        q.is_stale = False
        q.price_display = format_price_display(q.price, instrument.asset_class)  # D-105
        return q
    except Exception as exc:  # noqa: BLE001
        log.warning("quote refresh failed for %s: %s", symbol, exc)
        return await get_cached_quote(session, symbol, exchange)


async def get_cached_quote(
    session: AsyncSession, symbol: str, exchange: str | None = None
) -> Quote:
    """Return the last stored quote, marked stale if older than the threshold.
    If nothing is cached, mark the symbol UNAVAILABLE (no fabricated price)."""
    instrument = await _get_or_create_instrument(session, symbol, exchange)
    row = await session.get(QuoteRow, instrument.id)
    now = datetime.now(UTC)
    if row is None:
        return Quote(
            symbol=symbol.upper(), exchange=exchange, price=None,  # type: ignore[arg-type]
            currency=instrument.currency, source="none",
            entitlement=EntitlementStatus.UNAVAILABLE,
            valuation_method=ValuationMethod.UNAVAILABLE,
            received_at=now, is_stale=True,
        )
    stale = _is_stale(row.received_at, row.entitlement)
    return Quote(
        symbol=symbol.upper(),
        exchange=exchange,
        price=row.price,
        price_display=format_price_display(row.price, instrument.asset_class),  # D-105
        previous_close=row.previous_close,
        change=(row.price - row.previous_close) if row.previous_close else None,
        change_pct=pct_change(row.price, row.previous_close) if row.previous_close else None,
        currency=row.currency,
        source=row.source,
        entitlement=EntitlementStatus.CACHED if stale else EntitlementStatus(row.entitlement),
        market_time=row.market_time,
        received_at=row.received_at,
        is_stale=stale,
    )


async def display_quote(session: AsyncSession, symbol: str, exchange: str | None = None) -> Quote:
    """Quote for page rendering. Serves the cache when fresh; only does a live
    fetch for 'cheap' providers (mock/csv). For rate-limited live providers it
    returns cached data so a page load never blocks on many serial API calls
    (refresh those via the worker or the Settings 'Refresh live data' button)."""
    cached = await get_cached_quote(session, symbol, exchange)
    if cached.price is not None and not cached.is_stale:
        return cached
    if getattr(get_provider(), "fetch_on_demand", True):
        return await refresh_quote(session, symbol, exchange)
    return cached


async def get_history_cached(
    session: AsyncSession,
    symbol: str,
    interval: str,
    start: datetime,
    end: datetime,
    max_age_hours: int = 12,
    allow_fetch: bool = True,
):
    """Return historical candles, cached in price_history.

    Refetches from the provider at most once per ``max_age_hours`` per
    instrument+interval — critical for rate-limited providers (Alpha Vantage's
    free tier is ~25 requests/day). Cheap providers (mock/csv) also benefit.
    """
    from app.models import PriceHistory, Setting
    from app.schemas.common import Candle

    instrument = await _get_or_create_instrument(session, symbol, None)
    # §14dr-24: the mock/demo provider is deterministic and free, so its PriceHistory cache
    # is redundant AND would FREEZE a generator change (the dr-18 per-symbol diversification)
    # in pre-existing rows — the upsert below never overwrites an existing timestamp. So for
    # demo we always regenerate from the live generator; real providers keep their (costly,
    # rate-limited) cache untouched.
    active_name = getattr(get_provider(), "name", "mock")
    is_demo = active_name == "mock"
    marker_key = f"hist_fetched:{instrument.id}:{interval}"
    marker = (await session.execute(select(Setting).where(Setting.key == marker_key))).scalars().first()
    fresh = False
    if marker:
        try:
            ts = datetime.fromisoformat(marker.value)
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=UTC)
            fresh = (datetime.now(UTC) - ts).total_seconds() < max_age_hours * 3600
        except ValueError:
            fresh = False

    async def _from_db() -> list:
        rows = (
            await session.execute(
                select(PriceHistory)
                .where(
                    PriceHistory.instrument_id == instrument.id,
                    PriceHistory.interval == interval,
                    PriceHistory.ts >= start,
                    PriceHistory.ts <= end,
                )
                .order_by(PriceHistory.ts)
            )
        ).scalars().all()
        return [
            Candle(ts=r.ts, open=r.open, high=r.high, low=r.low, close=r.close, volume=r.volume)
            for r in rows
        ]

    if (fresh or not allow_fetch) and not is_demo:
        # Serve cached data without a (possibly slow) provider call. When fetching
        # isn't allowed (time-budget exceeded), return whatever we have, even empty.
        # Demo is exempt (§14dr-24): its generator is instant + authoritative, so we
        # never serve its frozen cache.
        cached = await _from_db()
        if cached or not allow_fetch:
            return cached

    # §4: route history like quotes. The active provider only fetches history for
    # instruments it actually owns — a mutual fund (AMFI), a canonical-id crypto
    # (CoinGecko), a manual asset, or an instrument overridden to a different source is
    # served from cache and never sent to the wrong (e.g. equity) history endpoint.
    diag = await route_for_instrument(session, instrument)
    hsrc, hreason = _history_source(diag, active_name)
    if hsrc is None:
        log.debug("history not routed to active provider for %s: %s", symbol, hreason)
        return await _from_db()

    # Fetch from provider and upsert new candles.
    try:
        candles = await get_provider().get_history(symbol, interval, start, end)
    except Exception as exc:  # noqa: BLE001
        log.warning("history fetch failed for %s: %s", symbol, exc)
        return await _from_db()

    if is_demo:
        # §14dr-24: demo is deterministic + free — return the freshly generated series
        # WITHOUT caching it. Caching would only freeze a generator change; re-upserting
        # on every view would also risk duplicate PriceHistory rows. Return as-is.
        return candles if candles else await _from_db()

    existing_ts = set(
        (
            await session.execute(
                select(PriceHistory.ts).where(
                    PriceHistory.instrument_id == instrument.id,
                    PriceHistory.interval == interval,
                )
            )
        ).scalars().all()
    )
    for c in candles:
        cts = c.ts.replace(tzinfo=None) if c.ts.tzinfo else c.ts
        if cts in existing_ts or c.ts in existing_ts:
            continue
        session.add(PriceHistory(
            instrument_id=instrument.id, interval=interval, ts=c.ts,
            open=c.open, high=c.high, low=c.low, close=c.close, volume=c.volume,
        ))
    # Only mark "freshly fetched" when we actually got data. An empty result
    # (provider error, rate limit, throttle) must NOT lock in an empty series for
    # max_age_hours — otherwise Performance/Net-worth charts stay blank until the
    # marker expires. Leaving it unset means we retry on the next view.
    if candles:
        if marker:
            marker.value = datetime.now(UTC).isoformat()
        else:
            session.add(Setting(key=marker_key, value=datetime.now(UTC).isoformat()))
    await session.flush()
    return candles if candles else await _from_db()


def _has_real_name(instr: Instrument) -> bool:
    """True when the instrument already has a human name (not just its ticker)."""
    n = (instr.name or "").strip()
    return bool(n) and n.upper() != instr.symbol.upper() and "(DEMO)" not in n and "(CSV)" not in n


# Well-known crypto tickers, so existing holdings added by bare symbol can be
# reclassified even when they were never mapped to a CoinGecko id.
_COMMON_CRYPTO = {
    "BTC", "ETH", "XRP", "SOL", "ADA", "DOGE", "DOT", "LTC", "BCH", "LINK", "AVAX",
    "MATIC", "BNB", "TRX", "USDT", "USDC", "SHIB", "ATOM", "XLM", "ALGO", "NEAR",
    "APT", "ARB", "OP", "SUI", "TON", "FIL", "ICP", "HBAR", "VET", "GRT",
}
# Tokens that betray a mis-scraped equity/ETF name on a non-equity instrument.
_EQUITY_NAME_TOKENS = ("ETF", "TRUST", "SHARES", "INTEREST", "BENEFICIAL", "HOLDINGS",
                       "INC", "CORP", " LTD", "PLC", "N.V.", "FUND")


async def reclassify_instruments(session: AsyncSession) -> dict:
    """Fix existing instruments: infer asset class from linked identifiers (and a
    crypto-symbol heuristic), backfill listing country, and repair names that were
    mis-scraped from an equity search onto a crypto/fund. Idempotent."""
    from app.core.symbols import country_for_symbol
    from app.models import AmfiScheme, AssetClass, CoingeckoCoin, InstrumentIdentifier, KiteInstrument

    instrs = (await session.execute(select(Instrument))).scalars().all()
    reclassified = renamed = countries = 0
    for instr in instrs:
        ids = {
            i.id_type: i.value for i in (
                await session.execute(
                    select(InstrumentIdentifier).where(InstrumentIdentifier.instrument_id == instr.id)
                )
            ).scalars().all()
        }
        cur = instr.asset_class.value if hasattr(instr.asset_class, "value") else str(instr.asset_class or "")

        new_ac: str | None = None
        new_sub: str | None = None
        if "coingecko_id" in ids:
            new_ac = "crypto"
        elif "amfi_code" in ids:
            new_ac = "mutual_fund"
        elif "kite_token" in ids:
            try:
                krow = await session.get(KiteInstrument, int(ids["kite_token"]))
                if krow and krow.instrument_type in ("FUT", "CE", "PE"):
                    # Derivative is a SUBCLASS — the enum has no "derivative"; the broad
                    # class is the underlying market (MCX→commodity, else equity).
                    new_ac = "commodity" if (krow.exchange or "").upper() == "MCX" else "equity"
                    new_sub = "derivative"
                elif krow:
                    new_ac = "equity"
            except (ValueError, TypeError):
                new_ac = None
        elif instr.symbol.upper().split(".")[0] in _COMMON_CRYPTO and cur in ("equity", ""):
            new_ac = "crypto"

        if new_ac and new_ac != cur:
            try:
                instr.asset_class = AssetClass(new_ac)
                reclassified += 1
                cur = new_ac
            except ValueError:
                pass
        if new_sub and instr.asset_subclass != new_sub:
            instr.asset_subclass = new_sub

        # Country backfill.
        if not instr.country:
            c = country_for_symbol(instr.symbol, instr.exchange, instr.currency)
            if c:
                instr.country = c
                countries += 1

        # Repair a mis-scraped name on crypto / mutual funds.
        if cur in ("crypto", "mutual_fund"):
            cache_name = None
            if cur == "crypto" and "coingecko_id" in ids:
                coin = await session.get(CoingeckoCoin, ids["coingecko_id"])
                cache_name = coin.name if coin else None
            elif cur == "mutual_fund" and "amfi_code" in ids:
                sch = await session.get(AmfiScheme, ids["amfi_code"])
                cache_name = sch.name if sch else None
            nm = (instr.name or "").upper()
            looks_wrong = any(t in nm for t in _EQUITY_NAME_TOKENS)
            if cache_name and instr.name != cache_name:
                instr.name = cache_name[:160]
                renamed += 1
            elif not cache_name and looks_wrong:
                instr.name = instr.symbol  # clear the wrong name; show the ticker
                renamed += 1

    await session.flush()
    return {"reclassified": reclassified, "renamed": renamed, "countries_set": countries,
            "total": len(instrs)}


async def backfill_instrument_name(session: AsyncSession, symbol: str) -> str | None:
    """Best-effort: fill an instrument's display name from the provider's search.

    Quotes (e.g. Alpha Vantage GLOBAL_QUOTE) don't carry names, so a ticker added
    by symbol shows only the ticker. This resolves the company/fund name once and
    persists it. Cheap on repeat calls (skips instruments that already have a name).
    """
    instr = (
        await session.execute(select(Instrument).where(Instrument.symbol == symbol.upper()))
    ).scalars().first()
    if instr is None or _has_real_name(instr):
        return instr.name if instr else None

    ac = instr.asset_class.value if hasattr(instr.asset_class, "value") else str(instr.asset_class or "")
    # Crypto & mutual funds must NOT take a name from an equity/ETF search — that's how
    # "BTC" ended up named "Grayscale Bitcoin Mini Trust ETF". Their names come from
    # their own caches (or stay as the ticker).
    if ac in ("crypto", "mutual_fund"):
        name = await _name_from_cache(session, instr, ac)
        if name:
            instr.name = name[:160]
            await session.flush()
        return instr.name
    try:
        results = await get_provider().search_instruments(symbol)
        # Only accept an EXACT ticker match of a compatible asset class — never a random
        # first result (which grabbed an unrelated instrument).
        match = next(
            (r for r in results
             if r.symbol.upper() == symbol.upper() and _class_compatible(ac, getattr(r, "asset_class", None))),
            None,
        )
        if match and match.name and match.name.strip().upper() != symbol.upper():
            instr.name = match.name.strip()[:160]
            await session.flush()
    except Exception:  # noqa: BLE001 — names are cosmetic; never fail a refresh
        pass
    return instr.name


def _class_compatible(a: str, b) -> bool:
    """Whether a search result's asset class is an acceptable match for an instrument."""
    if not b:
        return True  # unknown → allow (provider search often omits it)
    b = b.value if hasattr(b, "value") else str(b)
    return a == b or {a, b} <= {"equity", "etf", "mutual_fund"}


async def _name_from_cache(session: AsyncSession, instr: Instrument, ac: str) -> str | None:
    """Canonical name for a crypto (CoinGecko) or mutual fund (AMFI) from its linked
    identifier's cache. Returns None if not mapped."""
    from app.models import AmfiScheme, CoingeckoCoin, InstrumentIdentifier

    ids = {
        i.id_type: i.value for i in (
            await session.execute(select(InstrumentIdentifier).where(InstrumentIdentifier.instrument_id == instr.id))
        ).scalars().all()
    }
    if ac == "crypto" and "coingecko_id" in ids:
        coin = await session.get(CoingeckoCoin, ids["coingecko_id"])
        if coin and coin.name:
            return coin.name
    if ac == "mutual_fund":
        # §14dr-16 — resolve by the mapped amfi_code identifier, OR (the owner's "103504"
        # case) directly by SYMBOL when it IS a bare AMFI scheme code. Codes are unique, so
        # a symbol-as-code match is safe; crypto symbols are ambiguous, so crypto stays
        # identifier-only above.
        code = ids.get("amfi_code") or (instr.symbol if instr.symbol.isdigit() else None)
        if code:
            sch = await session.get(AmfiScheme, code)
            if sch and sch.name:
                return sch.name
    return None


async def backfill_master_names(session: AsyncSession) -> list[dict]:
    """§14dr-16 — a served, idempotent repair: heal instruments identified only by their
    code by resolving the display name from the synced master (AMFI scheme / CoinGecko coin).
    Runs on a master refresh. Never overwrites a real name; returns the list of repairs
    (each also logged) so the served result is honest about what it changed."""
    from app.models import AuditEvent

    instruments = (await session.execute(select(Instrument))).scalars().all()
    healed: list[dict] = []
    for instr in instruments:
        if _has_real_name(instr):
            continue
        ac = instr.asset_class.value if hasattr(instr.asset_class, "value") else str(instr.asset_class or "")
        name = await _name_from_cache(session, instr, ac)
        # Only apply a GENUINE name — not the bare code, not a placeholder cache name
        # ((DEMO)/(CSV)). This keeps the repair idempotent (a real name satisfies
        # _has_real_name → skipped next run) and avoids re-writing placeholder names.
        candidate = (name or "").strip()[:160]
        if candidate and candidate.upper() != instr.symbol.upper() \
                and "(DEMO)" not in candidate and "(CSV)" not in candidate:
            instr.name = candidate
            session.add(AuditEvent(category="mutation", action="backfill_instrument_name",
                                   detail=f"{instr.symbol} -> {instr.name}"))
            healed.append({"symbol": instr.symbol, "name": instr.name})
    if healed:
        await session.flush()
    return healed


async def _get_or_create_instrument(
    session: AsyncSession, symbol: str, exchange: str | None
) -> Instrument:
    stmt = select(Instrument).where(Instrument.symbol == symbol.upper())
    if exchange:
        stmt = stmt.where(Instrument.exchange == exchange)
    instrument = (await session.execute(stmt)).scalars().first()
    if instrument is None:
        from sqlalchemy.exc import IntegrityError

        from app.core.symbols import country_for_symbol, currency_for_symbol
        from app.models import AssetClass
        from app.services.identity import classify_defaults

        ccy = currency_for_symbol(symbol, exchange) or "USD"
        instrument = Instrument(
            symbol=symbol.upper(), exchange=exchange, name=symbol.upper(), currency=ccy,
            country=country_for_symbol(symbol, exchange, ccy),
            **classify_defaults(AssetClass.EQUITY, is_manual_price=False, currency=ccy),
        )
        session.add(instrument)
        try:
            # Savepoint so a concurrent create (UNIQUE on symbol+exchange) can be
            # recovered without poisoning the outer transaction.
            async with session.begin_nested():
                await session.flush()
        except IntegrityError:
            instrument = (await session.execute(stmt)).scalars().first()
            assert instrument is not None  # the IntegrityError means a concurrent create won
    return instrument
