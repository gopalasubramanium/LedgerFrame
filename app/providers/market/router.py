# SPDX-License-Identifier: AGPL-3.0-or-later
"""Per-instrument price-source routing.

:func:`route` decides, per instrument, which source *owns* its price — using asset
class, subclass, listing country, identifier mappings, the active provider, a
manual value, and any explicit override — against the :data:`DEFAULT_PRIORITY`
policy and :data:`CAPABILITIES` registry. It returns a :class:`RouteDiagnostic`
(surfaced in Pricing Health / the API) and enforces the policy:

* AMFI/CoinGecko cache-publish adapters own their asset class only when the
  instrument is mapped and has actually published a value;
* a mutual fund is never priced by a market equity feed;
* manual/statement lanes are never fetched from a provider;
* nothing is fabricated (``source_selected=None`` + a reason when nothing fits).

``app.services.market.refresh_quote`` consults the decision so the active provider
only fetches instruments it truly owns — it can no longer overwrite a NAV or a
canonical-id crypto price with a wrong equity quote. :class:`PriceSourceRouter`
remains a 1:1 wrapper of the active provider for callers that just need "the
current provider"; :class:`ProviderCapabilities` declares what each source can do.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.providers.market import get_provider
from app.providers.market.base import MarketDataProvider


@dataclass(frozen=True)
class ProviderCapabilities:
    """What a provider can do — declared once, not re-derived across the codebase."""

    name: str
    quote: bool = True
    history: bool = False
    search: bool = False
    fx: bool = False
    news: bool = False
    indices: bool = False           # real index levels (vs ETF proxies)
    intraday: bool = False          # sub-daily bars (R-42 §9-6); the flag matches the adapter
    fetch_on_demand: bool = True     # False = rate-limited; serve cache, refresh via worker
    needs_key: bool = False
    asset_classes: frozenset[str] = field(default_factory=frozenset)
    # §12-R3: history/intraday capability is PER ASSET CLASS. A provider may quote a class it cannot
    # serve *history* for — Alpha Vantage's TIME_SERIES_DAILY/_INTRADAY are equity endpoints, so its
    # crypto/fx history is wrong-instrument garbage (the F-1 root). Empty = falls back to
    # ``asset_classes`` (the class-agnostic default: a provider serves history for everything it
    # covers). Set explicitly to narrow history/intraday below the class set.
    history_asset_classes: frozenset[str] = field(default_factory=frozenset)
    intraday_asset_classes: frozenset[str] = field(default_factory=frozenset)
    regions: frozenset[str] = field(default_factory=frozenset)  # ISO-3166 alpha-2, or "*"
    entitlement: str = "delayed"     # best entitlement this provider claims


# Capability registry for the bundled providers. New adapters (amfi_nav, coingecko,
# eodhd, kite, ecb_fx) register here as they land — one declaration each, no
# business-logic edits. "*" region = broad/global coverage (verify per symbol).
_ALL = frozenset({"equity", "etf", "index", "fx", "crypto", "commodity"})
CAPABILITIES: dict[str, ProviderCapabilities] = {
    "mock": ProviderCapabilities(
        name="mock", history=True, intraday=True, search=True, fx=True, news=True, indices=True,
        asset_classes=_ALL, regions=frozenset({"*"}), entitlement="delayed"),
    "csv": ProviderCapabilities(
        name="csv", history=True, asset_classes=frozenset({"equity", "etf"}),
        regions=frozenset({"*"}), entitlement="end-of-day"),
    "yahoo": ProviderCapabilities(
        name="yahoo", history=True, intraday=True, search=True, fx=True, indices=True,
        fetch_on_demand=False, asset_classes=_ALL, regions=frozenset({"*"}),
        entitlement="delayed"),
    "alphavantage": ProviderCapabilities(
        name="alphavantage", history=True, intraday=True, search=True, fx=True, indices=True,
        fetch_on_demand=False, needs_key=True,
        asset_classes=frozenset({"equity", "etf", "fx", "crypto", "index"}),
        # §12-R3: AV quotes crypto/fx but its TIME_SERIES_DAILY/_INTRADAY are EQUITY endpoints — its
        # history/intraday is equity/etf ONLY. Crypto history rides CoinGecko (step 4); AV never.
        history_asset_classes=frozenset({"equity", "etf"}),
        intraday_asset_classes=frozenset({"equity", "etf"}),
        regions=frozenset({"US", "*"}), entitlement="delayed"),
    "amfi_nav": ProviderCapabilities(
        name="amfi_nav", history=True, search=True, fetch_on_demand=False, needs_key=False,
        asset_classes=frozenset({"mutual_fund"}), regions=frozenset({"IN"}),
        entitlement="end-of-day"),
    "coingecko": ProviderCapabilities(
        name="coingecko", history=True, search=True, fetch_on_demand=False, needs_key=False,
        # §12 step 4: CoinGecko IS the crypto daily-history owner (market_chart/range, 00:00 UTC).
        # AV's crypto history is wrong-instrument garbage (§12-R3) — crypto history rides here, never AV.
        asset_classes=frozenset({"crypto"}), history_asset_classes=frozenset({"crypto"}),
        regions=frozenset({"*"}), entitlement="delayed"),
    "ecb_fx": ProviderCapabilities(
        name="ecb_fx", quote=False, fx=True, fetch_on_demand=False, needs_key=False,
        asset_classes=frozenset({"fx"}), regions=frozenset({"*"}),
        entitlement="end-of-day"),
    "eodhd": ProviderCapabilities(
        name="eodhd", history=True, search=True, fx=True, indices=True,
        fetch_on_demand=False, needs_key=True,
        asset_classes=frozenset({"equity", "etf", "fx", "crypto", "index", "mutual_fund"}),
        regions=frozenset({"US", "SG", "IN", "*"}), entitlement="delayed"),
    "kite": ProviderCapabilities(
        name="kite", search=True, fetch_on_demand=False, needs_key=True,
        asset_classes=frozenset({"equity", "derivative", "commodity"}),
        regions=frozenset({"IN"}), entitlement="delayed"),
}


def capabilities_for(name: str) -> ProviderCapabilities:
    """Capabilities for a provider name; a safe quote-only default if unknown."""
    return CAPABILITIES.get(name, ProviderCapabilities(name=name))


def _covers_class(classes: frozenset[str], asset_class: str) -> bool:
    ac = (asset_class or "").strip().lower()
    return bool(classes) and (ac in classes or "*" in classes)


def can_fetch_history(caps: ProviderCapabilities, asset_class: str) -> bool:
    """§12-R3: True only if the provider serves DAILY history for this asset class. Falls back to
    the class-agnostic ``asset_classes`` when ``history_asset_classes`` is unset (a provider that
    serves history for everything it covers). Makes fetching a class the provider cannot serve
    impossible by construction (the Flag-2 quote-capability precedent, per class)."""
    if not caps.history:
        return False
    return _covers_class(caps.history_asset_classes or caps.asset_classes, asset_class)


def can_fetch_intraday(caps: ProviderCapabilities, asset_class: str) -> bool:
    """§12-R3: True only if the provider serves INTRADAY bars for this asset class (as
    :func:`can_fetch_history`, for sub-daily)."""
    if not caps.intraday:
        return False
    return _covers_class(caps.intraday_asset_classes or caps.asset_classes, asset_class)


@dataclass(frozen=True)
class ProviderAvailability:
    """Runtime availability of a source (from settings) — lets the router set
    ``auth_required`` truthfully instead of decoratively (§6)."""

    name: str
    configured: bool = False        # user has set this source up (preferred it)
    has_credentials: bool = True     # key/token present (True for keyless sources)
    enabled: bool = True


# Default source priority policy by asset "lane". :func:`route` selects through this
# per instrument (and it's shown in Pricing Health). Entries are provider names in
# order; only *configured & capable* providers are actually used, then honest fallback.
DEFAULT_PRIORITY: dict[str, list[str]] = {
    "in_equity": ["kite", "eodhd", "alphavantage", "yahoo", "csv", "manual"],
    "sg_equity": ["eodhd", "alphavantage", "yahoo", "csv", "manual"],
    "us_equity": ["eodhd", "alphavantage", "yahoo", "csv", "manual"],
    "in_mutual_fund": ["amfi_nav", "statement", "manual"],
    "global_fund": ["eodhd", "alphavantage", "statement", "manual"],
    "crypto": ["coingecko", "alphavantage", "yahoo", "csv", "manual"],
    "fx": ["alphavantage", "yahoo", "ecb_fx", "cache"],
    "bond": ["eodhd", "statement", "manual", "accrual"],
    "deposit": ["statement", "accrual", "manual"],
    "retirement": ["amfi_nav", "statement", "manual"],
    "derivative": ["kite", "statement", "manual"],
    "manual_only": ["statement", "manual"],
}


def lane_for(asset_class: str, asset_subclass: str | None, listing_country: str | None) -> str:
    """The routing lane for an instrument, keyed to DEFAULT_PRIORITY."""
    ac = (asset_class or "").lower()
    sub = (asset_subclass or "").lower()
    country = (listing_country or "").upper()
    if ac == "mutual_fund":
        return "in_mutual_fund" if country == "IN" else "global_fund"
    if ac == "crypto":
        return "crypto"
    if ac == "bond":
        return "bond"
    if ac == "fixed_deposit":
        return "deposit"
    if ac == "retirement":
        return "retirement"
    if sub == "derivative":
        return "derivative"
    if ac in ("cash", "property", "private", "liability", "insurance", "other"):
        return "manual_only"
    if ac in ("equity", "etf"):
        return {"IN": "in_equity", "SG": "sg_equity", "US": "us_equity"}.get(country, "us_equity")
    return "manual_only"


# Cache-publish adapters own the authoritative value for their asset class (read from
# the quote cache), so the active market provider must NOT fetch/overwrite them.
_CACHE_PUBLISH = {"amfi_nav": "amfi_code", "coingecko": "coingecko_id"}
# Manual/statement lanes are never priced by a market provider.
_MANUAL_LANES = {"manual_only", "deposit"}
# Chain entries that are not fetchable market providers (never an auth gap).
_TERMINAL_SOURCES = {"manual", "statement", "accrual", "cache"}


def _is_keyed(
    src: str, availability: dict[str, ProviderAvailability] | None, *, when_unknown: bool,
) -> bool:
    """Does THIS instance hold a usable credential for ``src``? (§9-7)

    Keyless providers are always keyed. A keyed provider counts only when
    :func:`app.services.market.provider_availability` reports credentials for it —
    that function enumerates every credential the instance actually holds, so a
    *missing entry* in a supplied map means "no key here", not "unknown".

    ``when_unknown`` covers the one genuinely unknowable case — a pure-policy call with
    no availability map — and the two callers want opposite answers, so neither guesses:
    the matrix GATE says False (never price through a credential you cannot see), the
    chain ANNOTATION says True (never assert an absence you cannot see).
    """
    if not capabilities_for(src).needs_key:
        return True
    if availability is None:
        return when_unknown
    av = availability.get(src)
    return bool(av and av.has_credentials)


# §18-R4 (F-7b ruling (a)) — the served "supported but unkeyed" annotation. The chain is a
# shipped policy constant listing every provider that COULD price the lane; without this the
# entries an instance has no credential for read as phantom providers (they did, twice, at
# review). Served here so the frontend invents no copy (D-105).
UNKEYED_NOTE = "(no key)"


@dataclass(frozen=True)
class ChainEntry:
    """One priority-chain entry with its keyed state — the read-only presentation of
    ``priority_chain`` (D-072: visible, never editable)."""

    source: str
    keyed: bool
    note: str | None = None


def _chain_detail(
    chain: list[str], availability: dict[str, ProviderAvailability] | None,
) -> list[ChainEntry]:
    """Annotate each chain entry with whether this instance can actually use it.

    Terminal entries (manual/statement/accrual/cache) are not credentialed providers and
    are never annotated. Chain membership still selects nothing (see ``route``); this is
    presentation of the shipped policy, not a change to it.
    """
    out: list[ChainEntry] = []
    for src in chain:
        if src in _TERMINAL_SOURCES or _is_keyed(src, availability, when_unknown=True):
            out.append(ChainEntry(source=src, keyed=True))
        else:
            out.append(ChainEntry(source=src, keyed=False, note=UNKEYED_NOTE))
    return out


def _auth_gap(
    chain: list[str], selected: str | None,
    availability: dict[str, ProviderAvailability],
) -> tuple[bool, str | None]:
    """Is a higher-priority source *configured by the user* but missing its
    credentials? If so the holding could price better once the key is added (§6)."""
    for src in chain:
        if src == selected:
            break
        if src in _TERMINAL_SOURCES or src in _CACHE_PUBLISH:
            continue
        av = availability.get(src)
        if av and av.configured and av.enabled and not av.has_credentials and capabilities_for(src).needs_key:
            return True, f"add {src} credentials to price from it"
    return False, None


@dataclass
class RouteDiagnostic:
    """The per-instrument routing decision — surfaced through Pricing Health / API."""

    instrument_id: int | None
    symbol: str
    asset_class: str
    lane: str
    priority_chain: list[str]
    source_selected: str | None          # the source that should own this price
    valuation_method: str
    mapping_required: bool = False        # needs an AMFI code / CoinGecko id first
    auth_required: bool = False           # needs provider credentials
    has_manual_override: bool = False
    reason: str | None = None
    route_rule: str = "lane"              # which rule selected the source: override|matrix|lane|active (§9-10)
    # §18-R4: the SAME chain, per entry, with its keyed state + served annotation. Parallel to
    # `priority_chain` (unchanged for existing readers), one derivation, filled in `_finish`.
    priority_chain_detail: list[ChainEntry] = field(default_factory=list)


def route(
    *,
    instrument_id: int | None,
    symbol: str,
    asset_class: str,
    asset_subclass: str | None,
    listing_country: str | None,
    mappings: set[str],
    active_provider: str,
    has_manual: bool,
    source_override: str | None = None,
    cached_source: str | None = None,
    availability: dict[str, ProviderAvailability] | None = None,
    matrix_provider: str | None = None,
) -> RouteDiagnostic:
    """Decide the authoritative price source for one instrument (pure/testable).

    Enforces the policy: cache-publish adapters own their asset class only when the
    instrument is mapped; the active provider prices market instruments it supports;
    manual/statement lanes are never fetched from a market provider; and nothing is
    invented (``source_selected=None`` + a reason when no valid source exists).
    """
    lane = lane_for(asset_class, asset_subclass, listing_country)
    chain = list(DEFAULT_PRIORITY.get(lane, ["manual"]))
    d = RouteDiagnostic(
        instrument_id=instrument_id, symbol=symbol.upper(), asset_class=asset_class,
        lane=lane, priority_chain=chain, source_selected=None,
        valuation_method="unavailable", has_manual_override=has_manual,
    )

    def _finish(diag: RouteDiagnostic) -> RouteDiagnostic:
        # §18-R4: annotate the chain once, on every exit path (all returns come through here).
        diag.priority_chain_detail = _chain_detail(chain, availability)
        # Compute the real auth gap once, unless a more specific reason is set.
        if availability and not diag.auth_required:
            gap, why = _auth_gap(chain, diag.source_selected, availability)
            if gap:
                diag.auth_required = True
                if diag.source_selected is None and why:
                    diag.reason = why
        return diag

    # Explicit per-instrument override wins — but only if it's a real, known source
    # (§5). An unknown override is ignored (defence in depth; the API rejects it too).
    if source_override:
        if source_override in CAPABILITIES:
            d.source_selected = source_override
            d.valuation_method = "official_nav" if source_override == "amfi_nav" else "market_quote"
            d.reason = "source override"
            d.route_rule = "override"
            return _finish(d)
        d.reason = f"ignored unknown source override '{source_override}'"

    # Manual-only asset classes: value comes from the user / statement, never a feed.
    if lane in _MANUAL_LANES:
        d.source_selected = "manual" if has_manual else None
        d.valuation_method = "manual_valuation" if has_manual else "unavailable"
        d.reason = None if has_manual else "set a manual value"
        return _finish(d)

    # Cache-publish lanes (Indian MF → AMFI, crypto → CoinGecko). A cache-publish
    # source OWNS the price only when it has actually published one; a mutual fund is
    # strict (NAV or manual only — never a market feed), whereas crypto legitimately
    # falls through to the active provider when unmapped or not yet published.
    for src, needed_id in _CACHE_PUBLISH.items():
        if src in chain and asset_class in ("mutual_fund", "crypto"):
            mapped = needed_id in mappings
            if mapped and cached_source == src:
                d.source_selected = src
                d.valuation_method = "official_nav" if src == "amfi_nav" else "market_quote"
                return _finish(d)
            if asset_class == "mutual_fund":
                # Never fetch an equity quote for a fund.
                if mapped:
                    d.source_selected = "amfi_nav"
                    d.valuation_method = "official_nav"
                    d.reason = "awaiting NAV (refresh AMFI)"
                else:
                    d.mapping_required = True
                    d.source_selected = "manual" if has_manual else None
                    d.valuation_method = "manual_valuation" if has_manual else "unavailable"
                    # D1-d: user-facing copy — never the internal id_type literal (needed_id
                    # is "amfi_code" here). This reason is served on BOTH Pricing Health and
                    # the Instrument-Detail history_status empty state (D-105).
                    d.reason = "map this fund to an AMFI scheme (or set a manual value)"
                return _finish(d)
            if asset_class == "crypto" and not mapped:
                d.mapping_required = True  # canonical id recommended, but symbol pricing works
            break  # crypto → fall through to the active provider fallback

    # Step 3.5 — the routing matrix (R-38; §9-1 AMENDMENT A, PREPEND). A user-declared
    # cell REFINES which market provider prices this class×country. It is consulted ONLY
    # here — after override (1), manual-only (2) and cache-publish/NAV (3) have returned —
    # so it can NEVER overwrite a NAV or a canonical crypto price (the guarantee lives in
    # steps 2-3 returning first). AMENDMENT A: the cell prices ONLY when its provider is
    # live-capable for THIS instrument (resolve-time re-validation, §9-3) AND keyed (§9-7);
    # on any incapability / degradation / unkeyed state, resolution CONTINUES down the
    # existing step-4 chain unchanged — a cell can never price less than today. Capability,
    # not chain-membership, is the gate (the matrix is the authority that selects the
    # provider; the edit-time 400 already blocked incapable cells).
    if matrix_provider and matrix_provider in CAPABILITIES:
        mcaps = capabilities_for(matrix_provider)
        country = (listing_country or "").upper()
        capable = (
            (not mcaps.asset_classes or asset_class in mcaps.asset_classes or "*" in mcaps.asset_classes)
            and (not mcaps.regions or not country or country in mcaps.regions or "*" in mcaps.regions)
        )
        # §18-R4: the same keyed test the chain annotation uses — ONE derivation of
        # "does this instance hold a credential for this provider" (§9-7).
        if capable and _is_keyed(matrix_provider, availability, when_unknown=False):
            d.source_selected = matrix_provider
            d.valuation_method = "official_nav" if matrix_provider == "amfi_nav" else "market_quote"
            d.route_rule = "matrix"
            return _finish(d)
        # else: degraded / incapable / unkeyed → fall through unchanged (§9-1/§9-3/§9-7).

    # Otherwise: the active market provider, if it's in the chain / capable.
    if active_provider in chain or active_provider == "mock":
        d.source_selected = active_provider
        d.valuation_method = "market_quote"
        d.route_rule = "active"
        return _finish(d)
    # Live provider not eligible for this lane → cache/manual.
    d.source_selected = "manual" if has_manual else None
    d.valuation_method = "manual_valuation" if has_manual else "unavailable"
    d.reason = None if has_manual else "no configured source can price this holding"
    return _finish(d)


def fetch_chain(
    diag: RouteDiagnostic, asset_class: str,
    availability: dict[str, ProviderAvailability] | None,
) -> list[str]:
    """The R-63 §9-1 EXECUTION chain: the ordered list of market providers the refresh path
    should actually fetch, HEAD-FIRST then down the priority chain.

    Pin-head-keep-net: ``diag.source_selected`` (the head an override / matrix cell / active
    lane chose) is tried first, but it never removes the net — every following capable + keyed
    market lane remains a fallback. Excludes:

    * terminal entries (manual/statement/accrual/cache) — not fetchable providers;
    * cache-publish adapters (amfi_nav/coingecko) — owned/served elsewhere, never fetched here;
    * providers that can't quote, don't cover this asset class, or aren't keyed on this instance
      (``no_key`` lanes are SKIPPED, never stalled on — §0-B(iv)).

    Pure/testable — no network, no construction. The caller builds each name via
    :func:`app.providers.market.build_provider` and walks the list until one prices.
    """
    head = diag.source_selected
    ordered = ([head] if head else []) + [c for c in diag.priority_chain if c != head]
    out: list[str] = []
    for name in ordered:
        if name in _TERMINAL_SOURCES or name in _CACHE_PUBLISH:
            continue
        caps = capabilities_for(name)
        if not caps.quote or not _covers_class(caps.asset_classes, asset_class):
            continue
        if not _is_keyed(name, availability, when_unknown=False):
            continue
        if name not in out:
            out.append(name)
    return out


class PriceSourceRouter:
    """Convenience wrapper around the active provider (delegates 1:1) for callers that
    just need "the current provider". Per-instrument routing lives in :func:`route`;
    this class exposes :attr:`capabilities` so Settings/diagnostics can reason about the
    active provider's coverage.
    """

    def __init__(self, provider: MarketDataProvider | None = None) -> None:
        self._provider = provider or get_provider()

    @property
    def name(self) -> str:
        return getattr(self._provider, "name", "unknown")

    @property
    def capabilities(self) -> ProviderCapabilities:
        return capabilities_for(self.name)

    # --- delegation (identical to calling the provider directly) ---------------
    async def get_quote(self, symbol: str, exchange: str | None = None):
        return await self._provider.get_quote(symbol, exchange)

    async def get_history(self, *args, **kwargs):
        return await self._provider.get_history(*args, **kwargs)

    async def search_instruments(self, query: str):
        return await self._provider.search_instruments(query)

    async def get_fx_rate(self, base: str, quote: str):
        return await self._provider.get_fx_rate(base, quote)

    async def get_market_status(self, market: str):
        return await self._provider.get_market_status(market)

    async def get_news(self, instruments: list[str]):
        return await self._provider.get_news(instruments)


def get_router() -> PriceSourceRouter:
    """A router around the current active provider."""
    return PriceSourceRouter()
