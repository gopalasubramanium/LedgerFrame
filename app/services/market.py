# SPDX-License-Identifier: AGPL-3.0-or-later
"""Market service: fetch quotes via the provider, persist with provenance, and
expose staleness. Never silently substitutes stale data for live — staleness is
computed from the stored ``received_at`` against the configured threshold and
returned explicitly on every quote.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, time
from decimal import Decimal
from typing import NamedTuple
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
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


def _history_source(diag, active_name: str, interval: str | None = None) -> tuple[str | None, str | None]:
    """Which source (if any) may fetch *history* for this instrument (§4). Returns
    ``(source, reason)`` — ``source=None`` means no fetch (cache-only) with a reason.

    §12-R3: the capability check is PER ASSET CLASS. A source that quotes a class it cannot serve
    history for (Alpha Vantage + crypto/fx — its daily/intraday endpoints are equity-only) is
    refused HERE, at the capability layer, so the wrong-instrument fetch is impossible by
    construction. ``interval`` selects the daily vs intraday capability (defaults to daily)."""
    from app.providers.market.router import can_fetch_history, can_fetch_intraday, capabilities_for

    src = diag.source_selected
    if src is None:
        return None, diag.reason or "no source can price this holding"
    if src == "manual":
        return None, "manual valuation — no market history"
    if src == "amfi_nav":
        return None, "NAV history not available yet"
    if src == "coingecko":
        return None, "canonical-id price history not available yet"
    caps = capabilities_for(src)
    ac = diag.asset_class
    is_intraday = interval is not None and interval not in _DAILY_INTERVALS
    capable = can_fetch_intraday(caps, ac) if is_intraday else can_fetch_history(caps, ac)
    if not capable:
        kind = "intraday" if is_intraday else "history"
        return None, f"{src} does not provide {ac} {kind}"
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


async def _link_coingecko_by_symbol(session: AsyncSession, instrument) -> str | None:
    """§14dr-27(a): resolve an unmapped crypto's CoinGecko canonical id by an exact symbol
    match against the synced coin master and attach it (``coingecko_id`` identifier).

    Returns ``None`` on success (id linked), or a served error string (D-105, rendered
    verbatim) for the ambiguous / no-match cases — never a silent guess. The Flag-2
    capability validation is unchanged; this only recovers the mapping the Add flow dropped.
    """
    from app.models import CoingeckoCoin
    from app.services.identity import DuplicateIdentifierError, set_identifier

    sym = (instrument.symbol or "").strip().lower()
    coins = (await session.execute(
        select(CoingeckoCoin).where(func.lower(CoingeckoCoin.symbol) == sym)
    )).scalars().all()
    if not coins:
        return (f"no CoinGecko coin matches the symbol '{instrument.symbol}' — pick the exact "
                "coin from the instrument picker (or sync the CoinGecko master in Settings first)")
    if len(coins) > 1:
        # §17-R2 (F-6): resolve the ambiguity to the canonical TOP-MARKET-CAP primary (BTC →
        # bitcoin, XRP → ripple) when one clearly dominates; else serve candidates (never a silent
        # guess). The stored ``market_cap_usd`` is unreliable (the /coins/list sync carries no cap),
        # so we enrich the candidates' caps from one budget-aware /simple/price call before ranking.
        chosen = await _dominant_coin_by_market_cap(session, coins)
        if chosen is None:
            cands = ", ".join(sorted(c.id for c in coins)[:8])
            return (f"'{instrument.symbol}' matches multiple CoinGecko coins ({cands}) — pick the "
                    "exact one from the instrument picker")
    else:
        chosen = coins[0]
    try:
        await set_identifier(session, instrument.id, "coingecko_id", chosen.id,
                             provider="coingecko", is_primary=True)
    except DuplicateIdentifierError as exc:
        return str(exc)
    return None


# §17-R2: the market-cap dominance factor. The primary's cap must be at least this many times the
# runner-up's (or the runner-up must have no cap at all) to be the "clear primary" — else the
# symbol is genuinely ambiguous and we serve candidates rather than guess.
_MCAP_DOMINANCE = 10


async def _dominant_coin_by_market_cap(session: AsyncSession, coins: list):
    """§17-R2 (F-6): pick the single canonical primary among symbol-collision candidates by
    market cap, or ``None`` when none clearly dominates. Enriches the candidates' caps from ONE
    live ``/simple/price?include_market_cap`` call (persisted to the master); on any fetch failure
    (no-egress / network / rate-limit) it falls back to the stored caps — so a coin with a real
    stored cap (e.g. bitcoin) still resolves offline. Never fabricates a cap."""
    from app.providers.market.coingecko import fetch_prices, parse_simple_price

    live: dict[str, Decimal] = {}
    try:
        parsed = parse_simple_price(await fetch_prices([c.id for c in coins]))
        for cid, cp in parsed.items():
            if cp.market_cap_usd is not None:
                live[cid] = cp.market_cap_usd
    except Exception as exc:  # noqa: BLE001 — degrade to stored caps; never crash the linker
        log.info("coingecko market-cap disambiguation offline for '%s' — using stored caps: %s",
                 coins[0].symbol if coins else "?", exc)
    # Persist any freshly-learned caps to the master (enrichment; harmless if unchanged).
    for c in coins:
        if c.id in live:
            c.market_cap_usd = live[c.id]

    def _cap(c):
        return live.get(c.id) if c.id in live else c.market_cap_usd

    ranked = sorted(coins, key=lambda c: _cap(c) or Decimal(0), reverse=True)
    top, runner = ranked[0], ranked[1]
    top_cap, runner_cap = _cap(top) or Decimal(0), _cap(runner) or Decimal(0)
    if top_cap > 0 and (runner_cap <= 0 or top_cap >= runner_cap * _MCAP_DOMINANCE):
        return top
    return None


async def recognise_amfi_fund(session: AsyncSession, instrument, code: str) -> int:
    """D1 (data-feed-routing POST-CLOSE DELTA) — the ONE India-MF recognition derivation.

    Fully converts ``instrument`` to an AMFI official-NAV mutual fund (asset_class,
    asset_subclass, asset_category, liquidity_profile, valuation_method, pricing_currency,
    listing_country, and the ``amfi_code`` identifier) AND publishes the scheme's current
    NAV inline via the existing publish path (``publish_navs_to_instruments``). This is the
    single source of truth for BOTH the ``map_amfi`` route and ``_link_amfi_by_symbol``
    (the Add-flow inference) — the two paths call it, so they cannot drift (the 145834
    finding was exactly such a drift: the Add flow linked the code but left pricing_currency
    USD / valuation_method market_quote and never published the known NAV).

    Idempotent/convergent: ``set_identifier`` upserts the code, the field writes are
    constants, and the NAV publish is an upsert on ``(instrument_id)`` — re-running changes
    nothing. Preserves the cache-publish guarantee: the amfi-owned NAV is published from the
    master (never matrix-overwritten). Raises ``DuplicateIdentifierError`` when the code is
    already mapped to another instrument — the caller renders/raises per its surface (a
    served string for the Add flow, a 409 for the route). Returns the NAV publish count."""
    from app.models import AssetClass
    from app.services.amfi import publish_navs_to_instruments
    from app.services.identity import set_identifier

    await set_identifier(session, instrument.id, "amfi_code", code,
                         provider="amfi_nav", is_primary=True)
    # Broad + detailed classification (an AMFI-mapped fund is an official-NAV mutual fund).
    instrument.asset_class = AssetClass.MUTUAL_FUND
    instrument.asset_subclass = "mutual_fund"
    instrument.asset_category = "fund"
    instrument.liquidity_profile = "redeemable"
    instrument.valuation_method = "official_nav"
    instrument.pricing_currency = "INR"
    # W-2 (R-42 3b): reconcile the LEGACY currency field too — an India-fund recognition
    # must leave no USD residue in any currency field the UI renders (the Identity card
    # renders `currency_for_symbol(...) or instrument.currency`, markets.py:75/:408; an AMFI
    # scheme code has no exchange suffix so it falls through to instrument.currency).
    instrument.currency = "INR"
    instrument.listing_country = "IN"
    return await publish_navs_to_instruments(session)


async def recognise_unconverted_amfi_funds(session: AsyncSession) -> dict:
    """D1-b — one-time idempotent repair (the dr-25 cleanup pattern). Heals the 145834
    residue: instruments carrying an ``amfi_code`` identifier but left unconverted by the
    PRE-D1 Add-flow linker (pricing_currency != INR or valuation_method != official_nav)
    and/or missing an ``amfi_nav`` quote while the master has a NAV. Runs the shared
    :func:`recognise_amfi_fund` over each, converging it. Idempotent (a second run finds
    nothing), logged with counts, and strictly ADDITIVE — never deletes user data. Ships as
    normal product-upgrade code (runs once at startup on the live instance)."""
    from app.models import AmfiScheme, AuditEvent, Instrument, InstrumentIdentifier
    from app.models import Quote as QuoteRow

    idents = (await session.execute(
        select(InstrumentIdentifier).where(InstrumentIdentifier.id_type == "amfi_code")
    )).scalars().all()
    repaired = 0
    for ident in idents:
        instr = await session.get(Instrument, ident.instrument_id)
        if instr is None:
            continue
        needs_fields = (instr.pricing_currency != "INR"
                        or instr.currency != "INR"  # W-2: heal the legacy currency residue too
                        or instr.valuation_method != "official_nav")
        has_amfi_quote = (await session.execute(
            select(QuoteRow.instrument_id).where(
                QuoteRow.instrument_id == instr.id, QuoteRow.source == "amfi_nav")
        )).first() is not None
        scheme = await session.get(AmfiScheme, ident.value)
        missing_nav_quote = (scheme is not None and scheme.nav is not None
                             and not has_amfi_quote)
        if needs_fields or missing_nav_quote:
            await recognise_amfi_fund(session, instr, ident.value)
            repaired += 1
    if repaired:
        session.add(AuditEvent(
            category="mutation", action="recognise_unconverted_amfi_funds",
            detail=f"recognised {repaired} mapped-but-unconverted India MF(s)"))
        await session.flush()
    log.info("D1-b AMFI recognition repair: converted %d mapped-but-unconverted fund(s)",
             repaired)
    return {"repaired": repaired}


async def _link_amfi_by_symbol(session: AsyncSession, instrument) -> str | None:
    """§14dr-27(c/d): if a mutual fund's symbol is exactly a synced AMFI scheme code, attach
    the ``amfi_code`` mapping and recognise it as an India-listed official-NAV fund. This
    recovers the mapping the Add flow drops (it sends the scheme code only as the symbol), so
    amfi_nav owns the NAV and the code persists for the edit form. Returns ``None`` on success,
    or a served error string (D-105) when no synced scheme matches — never fabricated. Unlike
    ``map_amfi`` (which trusts a user-entered code), this INFERS from the symbol, so it verifies
    the code against the master first, then defers to the shared :func:`recognise_amfi_fund`
    (D1-a — one recognition derivation; no divergent partial logic here)."""
    from app.models import AmfiScheme
    from app.services.identity import DuplicateIdentifierError

    code = (instrument.symbol or "").strip()
    scheme = await session.get(AmfiScheme, code)
    if scheme is None:
        return (f"no AMFI scheme has the code '{instrument.symbol}' — pick the scheme from the "
                "instrument picker, or sync the AMFI master in Settings first")
    try:
        await recognise_amfi_fund(session, instrument, code)
    except DuplicateIdentifierError as exc:
        return str(exc)
    return None


async def validate_source_override(session: AsyncSession, instrument, value: str | None) -> tuple[str | None, str | None]:
    """Validate a per-instrument source override (§5). Returns ``(normalized, error)``:
    ``normalized=None, error=None`` clears it; a non-None error means reject and keep the
    current override. Rejects unknown sources, unsuitable asset-class/region, missing
    identifier mappings, and sources whose credentials are absent. §14dr-27(a): correcting
    an unmapped crypto to coingecko attaches the canonical id by an unambiguous symbol match
    (a mutation on the passed session, persisted by the caller's commit) rather than dead-
    ending — see :func:`_link_coingecko_by_symbol`."""
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
        # §14dr-27(b): name the field evaluated (the instrument's listing country) so the
        # rejection is self-diagnosing — a US-listed instrument vs an India-only source reads
        # as a market mismatch, not an opaque failure (D-105).
        covers = ", ".join(sorted(r for r in caps.regions if r != "*")) or "no market"
        return None, f"{v} doesn't cover the listing country {country} (it covers {covers})"

    ids = set((await session.execute(
        select(InstrumentIdentifier.id_type).where(InstrumentIdentifier.instrument_id == instrument.id)
    )).scalars().all())
    if v == "amfi_nav" and ac == "mutual_fund" and "amfi_code" not in ids:
        # §14dr-27(c/d): attach-at-correction, symmetric to coingecko. The Add flow sends the
        # AMFI scheme code as the bare symbol and never maps it, so an India MF reaches here
        # unmapped. Auto-link by exact scheme-code match against the synced master (also stamps
        # the IN listing so the fund is owned by amfi_nav), or return a served string (D-105). A
        # non-fund is already rejected by the asset_classes check above.
        err = await _link_amfi_by_symbol(session, instrument)
        if err:
            return None, err
    if v == "coingecko" and ac == "crypto" and "coingecko_id" not in ids:
        # §14dr-27(a): attach-at-correction. The Add flow drops the picker's canonical id
        # (it is sent as the bare symbol), so an unmapped crypto reaches here. Auto-match the
        # symbol against the synced CoinGecko master: an unambiguous hit links the id and the
        # override proceeds; ambiguous / no match returns a served string (D-105) pointing to
        # the picker. Capability rejection for a non-crypto is already handled above.
        err = await _link_coingecko_by_symbol(session, instrument)
        if err:
            return None, err

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


# --------------------------------------------------------------------------- #
# R-42 — intraday availability (§9-2/§9-3/§9-9). The range→interval mapping and the
# enabled/disabled + REASON decision are server-side and SERVED (D-105/P-1): the frontend
# renders them, never decides them. This is the ONE canonical derivation the fetch trigger
# also enforces, so the UI can never disagree with what the backend will actually do.
# --------------------------------------------------------------------------- #
# The ranges the owner mapped to intraday intervals (§9-2): 1D → 1-minute, 5D → 5-minute.
# Every other range stays daily and is untouched by this milestone.
INTRADAY_RANGES: dict[str, dict] = {
    "1D": {"interval": "1min", "days": 1},
    "5D": {"interval": "5min", "days": 5},
}
# §9-5: the benchmark overlay is hidden on intraday ranges with a SERVED reason (not a
# frontend literal). Instrument-Detail-only; benchmark-on-intraday is ROADMAP R-48.
_BENCHMARK_INTRADAY_REASON = "Benchmark comparison is daily-range only."
# §9-3: the av_tier gate is server-side and tier-keyed — a free/unknown key is refused an
# intraday interval by the backend, not merely greyed by the UI.
_AV_INTRADAY_TIER_REASON = {
    "free": "Intraday needs an Alpha Vantage premium key — this key is on the free tier.",
    "unknown": "Intraday needs an Alpha Vantage premium key — this key's tier isn't confirmed yet.",
}
# Local providers make no outbound call, so no-egress mode never disables their intraday.
_LOCAL_PROVIDERS = frozenset({"mock", "csv"})
_PROVIDER_LABELS = {
    "alphavantage": "Alpha Vantage", "yahoo": "Yahoo", "coingecko": "CoinGecko",
    "kite": "Kite", "eodhd": "EODHD", "csv": "CSV", "mock": "the demo provider", "amfi_nav": "AMFI",
}


def _provider_label(name: str) -> str:
    return _PROVIDER_LABELS.get(name, name)


async def intraday_marker_fresh(session: AsyncSession, instrument_id, interval: str,
                                max_age_hours: int = 12) -> bool:
    """True when the 12h ``hist_fetched:{id}:{interval}`` freshness marker is still fresh —
    i.e. a re-trigger will be served from cache without re-spending budget (§9-3). Read-only;
    the same marker get_history_cached writes."""
    from app.models import Setting

    if instrument_id is None:
        return False
    marker = (await session.execute(
        select(Setting).where(Setting.key == f"hist_fetched:{instrument_id}:{interval}")
    )).scalars().first()
    if not marker:
        return False
    try:
        ts = datetime.fromisoformat(marker.value)
    except ValueError:
        return False
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=UTC)
    return (datetime.now(UTC) - ts).total_seconds() < max_age_hours * 3600


async def intraday_availability(session: AsyncSession, instrument, *, no_egress: bool) -> dict:
    """Served per-range intraday availability (D-105): for each intraday range, the mapped
    interval + ``enabled`` + a served ``reason``/``state`` for every disabled case. Decides
    the single gate once, in priority order (class → routing → capability → tier → egress),
    since 1D and 5D differ only in interval."""
    from app.providers.market.router import can_fetch_intraday, capabilities_for

    provider = get_provider()
    active = getattr(provider, "name", "mock")
    av_tier = getattr(provider, "av_tier", None)
    caps = capabilities_for(active)
    ac = instrument.asset_class.value if hasattr(instrument.asset_class, "value") else str(instrument.asset_class)

    state, reason = "available", None
    if ac == "mutual_fund":
        state = "class_disabled"
        reason = "Mutual-fund NAV is published once daily — no intraday series."
    else:
        diag = await route_for_instrument(session, instrument)
        # §12-R3: the daily history-source check already refuses a class the provider can't serve at
        # all (AV + crypto/fx — its endpoints are equity-only), so a wrong-class intraday fetch is
        # impossible. The provider-level intraday-incapability check stays distinct below.
        hsrc, hreason = _history_source(diag, active)
        if hsrc is None:
            state = "class_disabled"
            reason = hreason or "Intraday prices aren't available for this holding."
        elif not caps.intraday:
            state = "provider_incapable"
            reason = f"{_provider_label(active)} doesn't provide intraday prices."
        elif not can_fetch_intraday(caps, ac):
            # A provider that does intraday for SOME classes but not this one (per-class §12-R3).
            state = "class_disabled"
            reason = f"{_provider_label(active)} doesn't provide intraday prices for this asset class."
        elif active == "alphavantage" and av_tier != "premium":
            state = "tier_disabled"
            reason = _AV_INTRADAY_TIER_REASON.get(av_tier or "unknown", _AV_INTRADAY_TIER_REASON["unknown"])
        elif no_egress and active not in _LOCAL_PROVIDERS:
            state = "no_egress"
            reason = "Intraday prices need network access — no-egress mode is on."

    ranges = {
        r: {"interval": spec["interval"], "enabled": reason is None, "state": state, "reason": reason}
        for r, spec in INTRADAY_RANGES.items()
    }
    return {"ranges": ranges, "benchmark_reason": _BENCHMARK_INTRADAY_REASON}


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


async def _refetch_route_mismatched(session: AsyncSession, instrument, diag) -> Quote | None:
    """§18-R3 (F-7a) — refetch a ROUTE-MISMATCHED quote from the source the route now names.

    A quote is route-mismatched when its stored ``source`` differs from
    ``diag.source_selected`` — i.e. the user corrected an override (or the matrix /
    mapping changed) after the value was cached. Freshness is deliberately NOT
    consulted: the cached value is wrong-provenance, not merely old.

    Returns the refreshed quote, or ``None`` when nothing was refetched (already
    on-route, no per-instrument fetch path for that source, egress off, unmapped, or the
    fetch failed) — the caller then serves the cache exactly as before. Never raises.
    """
    src = diag.source_selected
    if src is None:
        return None
    cached = await session.get(QuoteRow, instrument.id)
    if cached is None or cached.source == src:
        return None                     # nothing cached, or already on-route: unchanged behaviour
    previous_source = cached.source     # read before the upsert below invalidates the row
    # CoinGecko is the one cache-publish adapter with a per-instrument on-demand fetch
    # (`/simple/price` by canonical id). amfi_nav publishes the whole NAVAll file on its own
    # cadence, and manual/statement lanes are never fetched — those keep serving the cache.
    if src != "coingecko":
        return None
    from app.core.egress import egress_allowed
    from app.models import InstrumentIdentifier

    if not await egress_allowed():
        return None                     # no-egress: honest stale cache, never a fabricated value
    cid = (await session.execute(
        select(InstrumentIdentifier.value).where(
            InstrumentIdentifier.instrument_id == instrument.id,
            InstrumentIdentifier.id_type == "coingecko_id",
        ).limit(1)
    )).scalars().first()
    if not cid:
        return None                     # unmapped: routing already reports mapping_required
    try:
        from app.providers.market import coingecko as cg_provider
        from app.services.coingecko import publish_prices

        if await publish_prices(session, await cg_provider.fetch_prices([cid])) == 0:
            return None
        # publish_prices writes via a raw upsert, so the row we loaded above is stale in
        # the identity map — reload it or we'd re-serve the very value we just replaced.
        await session.refresh(cached)
    except Exception as exc:  # noqa: BLE001 — a failed refetch degrades to the cache, never raises
        log.warning("route-mismatch refetch failed for %s from %s: %s", instrument.symbol, src, exc)
        return None
    log.info("route-mismatch refetch: %s moved from %s to %s", instrument.symbol, previous_source, src)
    return await get_cached_quote(session, instrument.symbol, instrument.exchange)


class QuoteRefresh(NamedTuple):
    """What one refresh attempt actually did — so callers can report honestly.

    §18-R2 (F-7b): ``refresh_data`` used to count "refreshed" as *"the returned quote has a
    price"*, which is true of a pure cache read. A pass that fetched nothing could
    therefore toast "Refreshed 26 of 26" while the underlying quotes stayed stale.
    ``outcome`` distinguishes a real fetch from a cache fallback, and ``reason`` carries
    the per-instrument explanation to the surface.
    """

    quote: Quote
    outcome: str                  # "fetched" | "not_owned" | "no_data" | "error"
    reason: str | None = None
    # §9-1 provenance: the source the route CHOSE (head) vs the source that actually PRICED it
    # (priced-by). They differ exactly when the execution net fell through from a failed head to
    # a fallback lane — carried so Pricing Health / the refresh report can be honest about it.
    route_head: str | None = None
    priced_by: str | None = None

    @property
    def fetched(self) -> bool:
        return self.outcome == "fetched"


async def refresh_quote(session: AsyncSession, symbol: str, exchange: str | None = None) -> Quote:
    """Fetch a fresh quote and upsert it. On provider failure, return the last
    cached quote marked stale/cached rather than raising. See :func:`refresh_quote_detailed`
    for the outcome-carrying form used by the refresh report.
    """
    return (await refresh_quote_detailed(session, symbol, exchange)).quote


async def refresh_quote_detailed(
    session: AsyncSession, symbol: str, exchange: str | None = None
) -> QuoteRefresh:
    """:func:`refresh_quote`, plus WHAT HAPPENED (fetched vs served from cache, and why).

    Routes per instrument: the active market provider only fetches instruments it
    actually owns. AMFI/CoinGecko-published, manual, or unmapped instruments are served
    from the stored quote so a live equity feed never overwrites a NAV / canonical-id
    price with a wrong one.
    """
    from app.providers.market.router import _CACHE_PUBLISH, _TERMINAL_SOURCES, capabilities_for

    provider = get_provider()
    instrument = await _get_or_create_instrument(session, symbol, exchange)
    diag = await route_for_instrument(session, instrument)
    head = diag.source_selected

    # §9-1 — a MARKET-FETCHABLE head goes through the EXECUTION NET: fetch the head, then walk
    # the priority chain through every capable+keyed market lane. A cache-publish adapter, a
    # manual/terminal lane, or "no configured source" is NOT fetched here — it keeps the existing
    # cache-owning behaviour below (the route-change refetch remains coingecko's per-instrument path).
    if head and head not in _TERMINAL_SOURCES and head not in _CACHE_PUBLISH \
            and capabilities_for(head).quote:
        return await _refresh_via_net(session, instrument, diag, exchange)

    # Authoritative source is a cache-publish adapter, manual, or unavailable — never let the
    # active provider fetch/overwrite it. But first honour a ROUTE CHANGE (§18-R3 (F-7a)): a
    # cached quote whose source is not the source the route NOW names is route-mismatched, and
    # serving it verbatim strands the holding on the previous provider forever (the owner's
    # BTC/XRP: corrected to CoinGecko, Source stayed alphavantage across every refresh). Refetch
    # from the new route regardless of freshness; fall back to the cache only if that can't be done.
    refetched = await _refetch_route_mismatched(session, instrument, diag)
    if refetched is not None:
        return QuoteRefresh(refetched, "fetched")
    active = getattr(provider, "name", "mock")
    owner = head or "no configured source"
    return QuoteRefresh(
        await get_cached_quote(session, symbol, exchange), "not_owned",
        diag.reason or f"served from cache — {owner} owns this price, not the active "
                       f"provider ({active})")


async def _refresh_via_net(
    session: AsyncSession, instrument, diag, exchange: str | None,
) -> QuoteRefresh:
    """§9-1 execution net. Walk :func:`fetch_chain` (head-first, capable+keyed market lanes),
    fetching from each until one prices the instrument. Pin-head-keep-net: the head is tried
    first, but a failed head falls through to the fallback lanes — the priority chain is now
    REAL at fetch time, not a display artefact. Records ``priced_by`` so a net catch is honest
    (head=X, priced-by=Y). Never writes a null price; never raises."""
    from app.db.upsert import upsert
    from app.providers.market import build_provider
    from app.providers.market.router import fetch_chain

    ac = instrument.asset_class.value if hasattr(instrument.asset_class, "value") \
        else str(instrument.asset_class)
    head = diag.source_selected
    active_name = getattr(get_provider(), "name", "mock")
    candidates = fetch_chain(diag, ac, provider_availability())
    last_reason: str | None = None

    for name in candidates:
        # Reuse the cached active provider; build any other lane fresh (None → skip, never mock).
        prov = get_provider() if name == active_name else build_provider(name)
        if prov is None:
            continue
        try:
            q = await prov.get_quote(instrument.symbol, exchange)
        except Exception as exc:  # noqa: BLE001 — a lane that errors is skipped; the net walks on
            last_reason = f"{name}: {str(exc)[:120]}"
            log.warning("net: %s could not price %s: %s", name, instrument.symbol, exc)
            continue
        if q.price is None:
            last_reason = f"no data from {name}"
            continue
        priced_by = q.source or name
        values = {
            "instrument_id": instrument.id, "price": q.price,
            "previous_close": q.previous_close, "currency": q.currency,
            "source": priced_by, "entitlement": q.entitlement.value,
            "market_time": q.market_time, "received_at": datetime.now(UTC),
        }
        stmt = upsert(QuoteRow).values(**values).on_conflict_do_update(
            index_elements=[QuoteRow.instrument_id],
            set_={k: v for k, v in values.items() if k != "instrument_id"},
        )
        await session.execute(stmt)
        await session.flush()
        q.is_stale = False
        q.price_display = format_price_display(q.price, instrument.asset_class)  # D-105
        reason = None if priced_by == head else (
            f"{head} could not price this — the fallback net priced it via {priced_by}")
        return QuoteRefresh(q, "fetched", reason, route_head=head, priced_by=priced_by)

    # Head and every fallback failed → honest no-data (last cached, never a null/fabricated price).
    return QuoteRefresh(
        await get_cached_quote(session, instrument.symbol, exchange), "no_data",
        last_reason or f"no configured source could price {instrument.symbol}",
        route_head=head, priced_by=None)


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


# --------------------------------------------------------------------------- #
# §14dr-25 — history-cache integrity. One candle per (instrument, trading DATE,
# interval): daily candles are date-normalised (ts → 00:00:00 UTC, tz-safe) so
# the (instrument, interval, ts) unique key is one-row-per-date for daily; and
# REAL provider candles supersede demo/mock residue for the same date.
# --------------------------------------------------------------------------- #
_DAILY_INTERVALS = frozenset({"1d", "1w", "1mo"})
_DEMO_SOURCES = frozenset({"mock", "demo"})


def _hist_is_midnight(ts: datetime) -> bool:
    return ts.hour == 0 and ts.minute == 0 and ts.second == 0 and ts.microsecond == 0


def _norm_hist_ts(ts: datetime, interval: str) -> datetime:
    """Date-normalise a DAILY candle's timestamp to 00:00:00 UTC (tz-safe). Intraday
    intervals (R-42) keep their real per-bar ts — the normalisation is daily-only."""
    if interval not in _DAILY_INTERVALS:
        return ts
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=UTC)
    return ts.astimezone(UTC).replace(hour=0, minute=0, second=0, microsecond=0)


def _hist_row_is_demo(row, interval: str) -> bool:
    """True when a cached PriceHistory row is demo/mock residue, not real provider
    data. New rows carry a `source`; legacy rows (source NULL) are told apart by the
    demo generator's tell — a daily candle NOT at midnight UTC (mock ts carries now's
    time-of-day; alphavantage/eodhd stamp midnight)."""
    src = (getattr(row, "source", None) or "").lower()
    if src in _DEMO_SOURCES:
        return True
    if src:  # any real provider name (alphavantage/eodhd/yahoo/kite/csv…)
        return False
    return interval in _DAILY_INTERVALS and not _hist_is_midnight(row.ts)


def _collapse_daily_rows(rows: list, interval: str) -> list:
    """§14dr-25 read-time guarantee: collapse cached rows to one per trading date for
    daily intervals — REAL supersedes demo — so the SERVED series has strictly unique
    ascending dates even before the row-level purge runs. Non-daily rows pass through."""
    if interval not in _DAILY_INTERVALS:
        return rows
    by_date: dict = {}
    for r in rows:
        d = r.ts.date()
        cur = by_date.get(d)
        if cur is None or (_hist_row_is_demo(cur, interval) and not _hist_row_is_demo(r, interval)):
            by_date[d] = r
    return [by_date[d] for d in sorted(by_date)]


async def repair_history_demo_residue(session: AsyncSession) -> dict:
    """§14dr-25 — a served, idempotent, logged repair (the dr-16 pattern): purge
    demo/mock residue candles for any (instrument, interval, trading date) where a REAL
    provider row also exists. Real supersedes demo. Reports counts; a second run finds
    nothing. Only removes a demo row when a real row protects that date (conservative)."""
    from collections import defaultdict

    from app.models import AuditEvent, PriceHistory

    rows = (
        await session.execute(
            select(PriceHistory).where(PriceHistory.interval.in_(tuple(_DAILY_INTERVALS)))
        )
    ).scalars().all()
    groups: dict = defaultdict(list)
    for r in rows:
        groups[(r.instrument_id, r.interval, r.ts.date())].append(r)
    purged = 0
    instruments: set = set()
    for (instr_id, interval, _d), grp in groups.items():
        if len(grp) < 2:
            continue
        demos = [r for r in grp if _hist_row_is_demo(r, interval)]
        reals = [r for r in grp if not _hist_row_is_demo(r, interval)]
        if reals and demos:
            for r in demos:
                await session.delete(r)
                purged += 1
                instruments.add(instr_id)
    if purged:
        session.add(AuditEvent(
            category="mutation", action="repair_history_demo_residue",
            detail=f"purged {purged} demo candle(s) across {len(instruments)} instrument(s)"))
        await session.flush()
    log.info("§14dr-25 history demo-residue repair: purged %d demo candle(s) across %d instrument(s)",
             purged, len(instruments))
    return {"purged": purged, "instruments": len(instruments)}


# W-3 (R-42 3b): US regular trading session (DST-correct via the zone). Intraday is a
# US-equity-only lane (Alpha Vantage TIME_SERIES_INTRADAY), so the US session is the frame.
_US_MARKET_TZ = ZoneInfo("America/New_York")
_REGULAR_OPEN = time(9, 30)
_REGULAR_CLOSE = time(16, 0)


async def repair_extended_hours_intraday(session: AsyncSession) -> dict:
    """W-3 — a served, idempotent, logged purge of EXTENDED-HOURS intraday candles (the
    dr-25 cleanup pattern). Alpha Vantage's ``TIME_SERIES_INTRADAY`` defaulted
    ``extended_hours=true``, so persisted 1-/5-min windows carried 04:00–20:00 ET
    pre/post-market bars; their thin volume against the regular-session open/close rendered
    as the session-boundary spikes the owner saw on 5D. The client now sends
    ``extended_hours=false``; this removes rows already stored. A candle is extended-hours
    when its US/Eastern wall-clock time is outside the regular session [09:30, 16:00]. Reports
    counts; a second run finds nothing. Additive to USER data — it only removes
    provider-fetched extended-hours bars, never a daily row (scoped to non-daily intervals)."""
    from app.models import AuditEvent, PriceHistory

    rows = (await session.execute(
        select(PriceHistory).where(PriceHistory.interval.notin_(tuple(_DAILY_INTERVALS)))
    )).scalars().all()
    purged = 0
    instruments: set = set()
    for r in rows:
        ts = r.ts if r.ts.tzinfo else r.ts.replace(tzinfo=UTC)
        et = ts.astimezone(_US_MARKET_TZ).time()
        if not (_REGULAR_OPEN <= et <= _REGULAR_CLOSE):
            await session.delete(r)
            purged += 1
            instruments.add(r.instrument_id)
    if purged:
        session.add(AuditEvent(
            category="mutation", action="repair_extended_hours_intraday",
            detail=f"purged {purged} extended-hours intraday candle(s) across "
                   f"{len(instruments)} instrument(s)"))
        await session.flush()
    log.info("W-3 extended-hours intraday purge: purged %d candle(s) across %d instrument(s)",
             purged, len(instruments))
    return {"purged": purged, "instruments": len(instruments)}


async def repair_wrong_class_candles(session: AsyncSession) -> dict:
    """§12-R3 — a served, idempotent, logged purge of WRONG-INSTRUMENT candles (the dr-25/W-3
    pattern). A candle stored from a provider that cannot serve that instrument's asset class as
    history/intraday is garbage: Alpha Vantage's TIME_SERIES_DAILY is an equity endpoint, so the
    BTC/XRP daily rows it cached (live BTC 64,024 vs AV "BTC" close 28.38) are a different
    instrument's numbers entirely (the F-1/F-3 root). A row is wrong-instrument when its ``source``
    provider can serve NEITHER history NOR intraday for the instrument's class. Reports counts; a
    second run finds nothing. Never removes a candle from a source that legitimately owns the class."""
    from app.models import AuditEvent, Instrument, PriceHistory
    from app.providers.market.router import can_fetch_history, can_fetch_intraday, capabilities_for

    rows = (await session.execute(
        select(PriceHistory, Instrument.asset_class)
        .join(Instrument, Instrument.id == PriceHistory.instrument_id)
    )).all()
    purged = 0
    instruments: set = set()
    by_source: dict[str, int] = {}
    for row, ac_raw in rows:
        src = (row.source or "").strip()
        if not src:
            continue  # a sourceless (manual/seed) row is not a provider mistake — leave it
        ac = ac_raw.value if hasattr(ac_raw, "value") else str(ac_raw or "")
        caps = capabilities_for(src)
        # Interval-precise: a DAILY candle is garbage only when the source HAS a daily endpoint that
        # does not cover this class (so it came from the wrong-class endpoint — AV crypto). A source
        # with no daily endpoint at all (its candles weren't fetched from a mismatched endpoint) is
        # left alone. Same logic for intraday. This never purges a legit candle whose source simply
        # lacks the OTHER kind of endpoint.
        is_daily = row.interval in _DAILY_INTERVALS
        if is_daily:
            wrong = caps.history and not can_fetch_history(caps, ac)
        else:
            wrong = caps.intraday and not can_fetch_intraday(caps, ac)
        if wrong:
            await session.delete(row)
            purged += 1
            instruments.add(row.instrument_id)
            by_source[src] = by_source.get(src, 0) + 1
    if purged:
        detail = ", ".join(f"{n}×{s}" for s, n in sorted(by_source.items()))
        session.add(AuditEvent(
            category="mutation", action="repair_wrong_class_candles",
            detail=f"purged {purged} wrong-instrument candle(s) across {len(instruments)} "
                   f"instrument(s) [{detail}]"))
        await session.flush()
    log.info("§12-R3 wrong-instrument candle purge: purged %d candle(s) across %d instrument(s) %s",
             purged, len(instruments), by_source)
    return {"purged": purged, "instruments": len(instruments), "by_source": by_source}


async def _claim_marker(session: AsyncSession, key: str) -> bool:
    """Insert a ``Setting`` marker, tolerating a concurrent claimer. True if WE inserted it.

    F10. Every marker in ``get_history_cached`` was written as ``SELECT key -> if absent,
    session.add(Setting(...)) -> flush()`` — a check-then-insert race. Two concurrent requests
    both read the key as absent, both insert, and the loser dies on
    ``UNIQUE constraint failed: settings.key``, 500ing a request that had done nothing wrong.

    The insert goes inside a SAVEPOINT so the loser's ``IntegrityError`` rolls back to that
    savepoint instead of poisoning the caller's transaction — the request continues and serves
    its history. Absorbing the error is correct rather than merely convenient: the marker
    exists afterwards either way, which is the whole contract a marker has.

    Used by every marker write in this function so the four sites cannot drift apart.
    """
    from app.models import Setting

    try:
        async with session.begin_nested():
            session.add(Setting(key=key, value=datetime.now(UTC).isoformat()))
        return True
    except IntegrityError:
        log.debug("marker %s was claimed by a concurrent request", key)
        return False


async def _repair_once_per_install(session: AsyncSession, marker_key: str, repair) -> None:
    """Run a one-time repair at most once per install, tolerating concurrent first-loads.

    Ordering is repair-then-claim, deliberately. Claiming first would mark the repair done
    even if it then failed, and the repair would never run again on that install.
    """
    from app.models import Setting

    if (await session.execute(
        select(Setting).where(Setting.key == marker_key)
    )).scalars().first() is not None:
        return
    await repair(session)
    await _claim_marker(session, marker_key)


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

    # §14dr-25: one-time served purge of demo residue (idempotent, guarded by a Setting
    # marker so it scans once per instance, not per request). Belt to the migration's
    # data-fix — a fresh create_all DB has no residue, so this is a cheap no-op there.
    await _repair_once_per_install(
        session, "hist_demo_residue_repaired_v1", repair_history_demo_residue)

    # W-3 (R-42 3b): one-time served purge of already-stored extended-hours intraday bars
    # (idempotent, guarded by a Setting marker so it scans once per instance). Belt to the
    # extended_hours=false client fix — a fresh DB has no such rows, so this is a cheap no-op.
    await _repair_once_per_install(
        session, "hist_extended_hours_purged_v1", repair_extended_hours_intraday)

    # §12-R3: one-time served purge of wrong-instrument candles (crypto rows cached from AV's
    # equity endpoint, the F-1/F-3 root), idempotent + guarded by a Setting marker. A fresh DB has
    # no such rows, so this is a cheap no-op there; it is the belt to the class-aware capability gate.
    await _repair_once_per_install(
        session, "hist_wrong_class_candles_purged_v1", repair_wrong_class_candles)

    instrument = await _get_or_create_instrument(session, symbol, None)
    # §14dr-24: the mock/demo provider is deterministic and free, so its PriceHistory cache
    # is redundant AND would FREEZE a generator change (the dr-18 per-symbol diversification)
    # in pre-existing rows — the upsert below never overwrites an existing timestamp. So for
    # demo we always regenerate from the live generator; real providers keep their (costly,
    # rate-limited) cache untouched.
    # §14dr-25 (2026-07-18) — AMENDMENT to the upsert-never-overwrites policy: it protects a
    # REAL provider row from being overwritten (avoids refetch churn); it does NOT protect
    # DEMO/mock residue — a real candle now SUPERSEDES a demo candle for the same trading date
    # (see the upsert precedence below). The dedup key is the trading DATE, not the exact ts.
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
        # §14dr-25: serve one candle per trading date (real supersedes demo), ts
        # date-normalised — strictly unique ascending dates, no comb.
        rows = _collapse_daily_rows(rows, interval)
        return [
            Candle(ts=_norm_hist_ts(r.ts, interval), open=r.open, high=r.high,
                   low=r.low, close=r.close, volume=r.volume)
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
    hsrc, hreason = _history_source(diag, active_name, interval)
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

    # §14dr-25: key existing rows by trading date (daily) with a REAL row preferred as
    # the representative, so precedence is decided per date, not per exact timestamp.
    existing_rows = (
        await session.execute(
            select(PriceHistory).where(
                PriceHistory.instrument_id == instrument.id,
                PriceHistory.interval == interval,
            )
        )
    ).scalars().all()
    existing_by_key: dict = {}
    for r in existing_rows:
        key = _norm_hist_ts(r.ts, interval)
        cur = existing_by_key.get(key)
        if cur is None or (_hist_row_is_demo(cur, interval) and not _hist_row_is_demo(r, interval)):
            existing_by_key[key] = r
    for c in candles:
        key = _norm_hist_ts(c.ts, interval)
        existing = existing_by_key.get(key)
        if existing is None:
            row = PriceHistory(
                instrument_id=instrument.id, interval=interval, ts=key,
                open=c.open, high=c.high, low=c.low, close=c.close, volume=c.volume,
                source=active_name,
            )
            session.add(row)
            existing_by_key[key] = row
        elif _hist_row_is_demo(existing, interval):
            # §14dr-25 precedence: a REAL provider candle SUPERSEDES demo/mock residue
            # for this date. (The never-overwrite policy still protects a REAL row —
            # the `else` below skips it — it just no longer shields demo rows.)
            existing.ts = key
            existing.open, existing.high, existing.low = c.open, c.high, c.low
            existing.close, existing.volume, existing.source = c.close, c.volume, active_name
        # else: an existing REAL row for this date — never overwrite (unchanged policy).
    # Only mark "freshly fetched" when we actually got data. An empty result
    # (provider error, rate limit, throttle) must NOT lock in an empty series for
    # max_age_hours — otherwise Performance/Net-worth charts stay blank until the
    # marker expires. Leaving it unset means we retry on the next view.
    if candles:
        if marker:
            marker.value = datetime.now(UTC).isoformat()
        else:
            # F10 fourth site: same check-then-insert race as the three repair markers above.
            # It needs the instrument to already exist to appear — with a NEW instrument the
            # preceding `_get_or_create_instrument` write serialises callers and hides it —
            # which makes it the ordinary case, not the exotic one: any previously-viewed
            # holding whose 12h marker has expired.
            await _claim_marker(session, marker_key)
    await session.flush()
    # §14dr-25: serve from the (now merged + deduped) cache so the returned series is
    # date-collapsed — strictly unique ascending dates — regardless of upsert path.
    return await _from_db()


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
