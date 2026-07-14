# SPDX-License-Identifier: AGPL-3.0-or-later
"""Portfolio & net-worth engine.

All math is deterministic Decimal arithmetic — the AI layer is never allowed to
compute any of these numbers. Cost basis uses FIFO by default.
"""

from __future__ import annotations

import logging
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.money import ZERO, D, money, pct_change
from app.core.regions import region_of
from app.core.symbols import currency_for_symbol
from app.models import Account, AssetClass, Holding, Instrument, TxnType
from app.models import Transaction as Txn
from app.providers.market import get_provider
from app.schemas.common import ValuationMethod
from app.services import fx
from app.services.market import get_cached_quote, refresh_quote

#: D-082 served label for the sector-allocation bucket holding every positive-value holding
#: without a resolved sector (property, cash, deposits — non-equity assets have no sector; this
#: is the honest truth, not a "pending" state). Amended 2026-07-11 (DECISIONS D-082 amendment).
UNCLASSIFIED_SECTOR_LABEL = "Unclassified sector"

log = logging.getLogger("ledgerframe")

# Fallback sector classification for common tickers, used only when the market
# provider doesn't supply a sector. Keeps "sector exposure" populated on real data
# without a paid fundamentals feed. Extend freely.
_SECTOR_MAP: dict[str, str] = {
    "AAPL": "Technology", "MSFT": "Technology", "NVDA": "Technology", "AVGO": "Technology",
    "INTC": "Technology", "AMD": "Technology", "ORCL": "Technology", "CRM": "Technology",
    "ADBE": "Technology", "CSCO": "Technology", "PLTR": "Technology", "IBM": "Technology",
    "GOOGL": "Communication Services", "GOOG": "Communication Services", "META": "Communication Services",
    "NFLX": "Communication Services", "DIS": "Communication Services", "T": "Communication Services",
    "VZ": "Communication Services", "VOD.L": "Communication Services",
    "AMZN": "Consumer Discretionary", "TSLA": "Consumer Discretionary", "HD": "Consumer Discretionary",
    "NKE": "Consumer Discretionary", "MCD": "Consumer Discretionary", "SBUX": "Consumer Discretionary",
    "UBER": "Consumer Discretionary", "F": "Consumer Discretionary", "7203.T": "Consumer Discretionary",
    "WMT": "Consumer Staples", "KO": "Consumer Staples", "PEP": "Consumer Staples",
    "PG": "Consumer Staples", "COST": "Consumer Staples",
    "JPM": "Financials", "BAC": "Financials", "WFC": "Financials", "GS": "Financials",
    "MS": "Financials", "V": "Financials", "MA": "Financials", "BRK.B": "Financials",
    "HDFCBANK.BSE": "Financials", "D05": "Financials", "D05.SI": "Financials",
    "XOM": "Energy", "CVX": "Energy", "SHEL": "Energy", "BP.L": "Energy", "RELIANCE.NSE": "Energy",
    "JNJ": "Health Care", "PFE": "Health Care", "UNH": "Health Care", "MRK": "Health Care",
    "LLY": "Health Care", "ABBV": "Health Care",
    "BA": "Industrials", "CAT": "Industrials", "GE": "Industrials", "UPS": "Industrials",
    "NEE": "Utilities", "DUK": "Utilities",
    "BTC": "Crypto", "ETH": "Crypto", "SOL": "Crypto",
    "SPY": "Index / ETF", "QQQ": "Index / ETF", "VOO": "Index / ETF", "GLD": "Commodities",
}


@dataclass
class FifoResult:
    """Outcome of replaying one instrument's transactions under FIFO."""

    quantity: Decimal = ZERO
    cost_basis: Decimal = ZERO  # total remaining cost (native currency, incl. fees)
    realised_pl: Decimal = ZERO
    income: Decimal = ZERO  # dividends + interest

    @property
    def avg_cost(self) -> Decimal:
        return (self.cost_basis / self.quantity) if self.quantity > ZERO else ZERO


def _sort_ts(ts):
    """Normalise a datetime to naive-UTC so naive (from SQLite) and aware (freshly
    created) timestamps can be ordered together without a TypeError."""

    if ts.tzinfo is not None:
        return ts.astimezone(UTC).replace(tzinfo=None)
    return ts


def compute_fifo(transactions: list[Txn]) -> FifoResult:
    """Replay a single instrument's transactions in time order under FIFO.

    Buys push lots (unit cost includes fees); sells consume oldest lots first and
    accrue realised P/L. Splits scale open lots. Dividends/interest accrue income.
    Pure function — no DB, no IO — so it is trivially testable.
    """
    lots: deque[list[Decimal]] = deque()  # each lot = [qty, unit_cost]
    res = FifoResult()
    for t in sorted(transactions, key=lambda x: _sort_ts(x.ts)):
        qty, px = D(t.quantity), D(t.price)
        # Fees (commissions/charges) and taxes both add to cost / reduce proceeds.
        costs = D(t.fees) + D(getattr(t, "taxes", 0) or 0)
        if t.type == TxnType.BUY:
            if qty <= ZERO:
                continue
            unit_cost = px + (costs / qty if qty else ZERO)
            lots.append([qty, unit_cost])
        elif t.type == TxnType.SELL:
            remaining = qty
            proceeds = qty * px - costs
            cost_of_sold = ZERO
            while remaining > ZERO and lots:
                lot = lots[0]
                take = min(lot[0], remaining)
                cost_of_sold += take * lot[1]
                lot[0] -= take
                remaining -= take
                if lot[0] <= ZERO:
                    lots.popleft()
            res.realised_pl += proceeds - cost_of_sold
        elif t.type == TxnType.SPLIT:
            ratio = px if px > ZERO else Decimal("1")  # price field carries split ratio
            for lot in lots:
                lot[0] *= ratio
                lot[1] /= ratio
        elif t.type == TxnType.BONUS:
            # Bonus issue: extra shares at zero cost → quantity up, total cost
            # unchanged, average cost falls. `quantity` holds the bonus shares.
            if qty > ZERO:
                lots.append([qty, ZERO])
        elif t.type in (TxnType.DIVIDEND, TxnType.INTEREST):
            res.income += D(t.amount) if t.amount else qty * px
        elif t.type == TxnType.MERGER:
            # §4.3: instrument A absorbed into B. A's remaining lots are carried into B by
            # resolve_mergers (as synthetic buys on B); here we terminate A's position with NO
            # realised gain (a merger is not a sale).
            lots.clear()

    res.quantity = sum((lot[0] for lot in lots), ZERO)
    res.cost_basis = sum((lot[0] * lot[1] for lot in lots), ZERO)
    return res


@dataclass
class HoldingValue:
    holding_id: int
    label: str
    name: str | None
    symbol: str | None
    asset_class: str
    sector: str | None
    quantity: Decimal
    native_currency: str
    price: Decimal | None
    market_value_base: Decimal
    cost_basis_base: Decimal
    unrealised_pl_base: Decimal
    day_change_base: Decimal
    is_stale: bool
    is_priced: bool
    valuation_method: str = ValuationMethod.MARKET_QUOTE.value
    # Pricing-health provenance (populated from the quote where one was used).
    exchange: str | None = None
    source: str | None = None
    entitlement: str | None = None
    price_ts: datetime | None = None
    source_override: str | None = None
    country: str | None = None          # ISO-2 listing/domicile country (for region drift)
    liquidity_profile: str | None = None  # listed|redeemable|locked|illiquid|manual (ladder override)
    account_id: int | None = None       # which account/institution holds this (W7)

    @property
    def day_change_pct(self) -> Decimal | None:
        """Today's % change, derived from the day's base-currency move vs the
        previous value (current value minus today's change)."""
        prev = self.market_value_base - self.day_change_base
        return pct_change(self.market_value_base, prev) if prev else None

    @property
    def region(self) -> str:
        """The D-083 six-bucket region, derived from `listing_country` (never stored, D-007).

        Exposed as an ATTRIBUTE so region is an ``allocation()`` key like any other — which is
        what lets the policy region dimension read through the canonical allocation reader
        instead of re-deriving its own buckets (A11 / P-1 / D-038). One derivation of a weight.
        """
        return region_of(self.country)


@dataclass
class PortfolioValuation:
    base_currency: str
    total_value: Decimal = ZERO
    cost_basis: Decimal = ZERO
    unrealised_pl: Decimal = ZERO
    day_change: Decimal = ZERO
    holdings: list[HoldingValue] = field(default_factory=list)
    has_stale: bool = False

    @property
    def total_return_pct(self) -> Decimal | None:
        return pct_change(self.total_value, self.cost_basis) if self.cost_basis else None

    def gross_assets(self) -> Decimal:
        """**Gross assets** — the allocation denominator (positive-value holdings only).

        The ONE definition of the denominator every weight on the platform divides by, so a
        weight and its base can never be computed by different rules (A11). Liabilities are
        excluded by construction: a mortgage cannot distort a weight (D-033).
        ``sum(allocation(k).values()) == gross_assets()`` for every key ``k``, by construction.
        """
        return sum((h.market_value_base for h in self.holdings if h.market_value_base > 0), ZERO)

    def allocation(self, key: str) -> dict[str, Decimal]:
        """Allocation map (base-currency value) keyed by an attribute name.

        Only **positive-value holdings (gross assets)** are counted: liabilities are NEVER
        allocation rows and negative/zero values are excluded, so weights read as a share of
        **gross assets** (GLOSSARY 'Allocation weight'; D-033; page-portfolio ND-4). A liability
        must not net against an asset class or appear as its own negative slice.
        """
        out: dict[str, Decimal] = defaultdict(lambda: ZERO)
        for h in self.holdings:
            if h.market_value_base > 0:
                out[getattr(h, key, "Other") or "Other"] += h.market_value_base
        return dict(out)

    def sector_allocation(self) -> dict[str, Decimal]:
        """Sector exposure over **gross assets** (positive-value holdings). Holdings without a
        resolved sector roll into an explicit **'Not sector-classified (non-equity)'** bucket
        (D-082) rather than being silently dropped, so the donut sums to gross assets and no
        exposure is hidden (D-033 / page-portfolio ND-4)."""
        out: dict[str, Decimal] = defaultdict(lambda: ZERO)
        for h in self.holdings:
            if h.market_value_base > 0:
                out[h.sector or UNCLASSIFIED_SECTOR_LABEL] += h.market_value_base
        return dict(out)

    def class_statement(self) -> list[tuple[str, Decimal]]:
        """Signed net-worth **statement** by asset class (D-033 / page-net-worth ND-4).

        An itemised BALANCE: every asset class as a (positive) row, **liabilities NEGATIVE**,
        ordered assets-desc then liabilities. ``Σ(values)`` reconciles exactly to
        ``total_value`` — the Net worth headline. This is deliberately **NOT** ``allocation()``:
        allocation is a gross-asset WEIGHT (positive-only, liabilities excluded, sums to gross);
        the statement is a signed balance that INCLUDES liabilities and nets to the headline.
        **Statement ≠ allocation — never interchange them.**
        """
        per_class: dict[str, Decimal] = defaultdict(lambda: ZERO)
        for h in self.holdings:
            per_class[getattr(h, "asset_class", "other") or "other"] += h.market_value_base
        assets = sorted(((c, v) for c, v in per_class.items() if c != "liability"),
                        key=lambda cv: cv[1], reverse=True)
        liabilities = [(c, v) for c, v in per_class.items() if c == "liability"]
        return [*assets, *liabilities]


def entity_account_filter(model, entity_id: int | None):
    """§4.1 optional entity filter for a holdings/transactions query.

    Holdings and transactions inherit their entity through the owning account, so this
    restricts to rows whose account belongs to ``entity_id``. Returns ``None`` when
    ``entity_id`` is None — the pre-4.1 whole-portfolio default — so an unfiltered query is
    byte-identical to before. Add it with ``.where(...)`` only when it is not None, so the
    default query text is unchanged.
    """
    if entity_id is None:
        return None
    return model.account_id.in_(select(Account.id).where(Account.entity_id == entity_id))


async def _value_one_holding(session: AsyncSession, h, base_currency: str, warm: bool) -> HoldingValue:
    """Value a single holding at its latest cached quote, converted to base
    currency. May raise on edge data — value_portfolio catches it and degrades
    the holding to Unavailable rather than crashing the whole reader."""
    instrument = (
        await session.get(Instrument, h.instrument_id) if h.instrument_id else None
    )
    symbol = instrument.symbol if instrument else None
    # Authoritative native currency, with a guaranteed non-null fallback to base
    # currency so a NULL/empty currency never reaches fx.convert as None.
    native_ccy = (
        currency_for_symbol(symbol, instrument.exchange if instrument else None)
        or h.currency
        or (instrument.currency if instrument else None)
        or base_currency
    )

    price_native: Decimal | None = None
    is_stale = False
    is_priced = True

    quote = None
    val_method = ValuationMethod.MARKET_QUOTE.value
    if h.manual_value is not None:
        mv_native = D(h.manual_value)
        val_method = ValuationMethod.MANUAL_VALUATION.value
    elif symbol and instrument and not instrument.is_manual_price:
        quote = await get_cached_quote(session, symbol, instrument.exchange)
        if quote.price is None and warm and getattr(get_provider(), "fetch_on_demand", True):
            # No cached quote yet — fetch one for cheap providers (mock/csv).
            quote = await refresh_quote(session, symbol, instrument.exchange)
        if quote.price is not None:
            price_native = D(quote.price)
            mv_native = D(h.quantity) * price_native
            is_stale = quote.is_stale
            val_method = (ValuationMethod.OFFICIAL_NAV.value
                          if quote.source == "amfi_nav" else ValuationMethod.MARKET_QUOTE.value)
        else:
            mv_native = D(h.quantity) * D(h.avg_cost)  # fall back to cost; mark unpriced
            is_priced = False
            val_method = ValuationMethod.ESTIMATED_VALUE.value
    else:
        # A manual-priced instrument or a manual asset with no live source.
        mv_native = D(h.quantity) * D(h.avg_cost)
        is_priced = False
        val_method = ValuationMethod.MANUAL_VALUATION.value

    cost_native = D(h.quantity) * D(h.avg_cost)

    day_change_native = ZERO
    if price_native is not None and quote is not None and quote.previous_close:
        day_change_native = (price_native - D(quote.previous_close)) * D(h.quantity)

    mv_base = await fx.convert(mv_native, native_ccy, base_currency)
    cost_base = await fx.convert(cost_native, native_ccy, base_currency)
    day_base = await fx.convert(day_change_native, native_ccy, base_currency)

    sign = Decimal("-1") if h.asset_class == AssetClass.LIABILITY else Decimal("1")
    mv_base *= sign
    cost_base *= sign

    iname = (instrument.name or "").strip() if instrument else ""
    display_name = iname if (iname and symbol and iname.upper() != symbol.upper()
                             and "(DEMO)" not in iname and "(CSV)" not in iname) else None
    sector = (instrument.sector if instrument and instrument.sector else None) \
        or (_SECTOR_MAP.get(symbol.upper()) if symbol else None)

    return HoldingValue(
        holding_id=h.id,
        label=h.label or (symbol or "Manual asset"),
        name=display_name,
        symbol=symbol,
        asset_class=h.asset_class.value if hasattr(h.asset_class, "value") else str(h.asset_class),
        sector=sector,
        quantity=D(h.quantity),
        native_currency=native_ccy,
        price=price_native,
        market_value_base=money(mv_base),
        cost_basis_base=money(cost_base),
        unrealised_pl_base=money(mv_base - cost_base),
        day_change_base=money(day_base),
        is_stale=is_stale,
        is_priced=is_priced,
        valuation_method=val_method,
        exchange=instrument.exchange if instrument else None,
        source=quote.source if quote else None,
        entitlement=quote.entitlement.value if quote else None,
        price_ts=quote.received_at if quote else None,
        source_override=getattr(instrument, "source_override", None) if instrument else None,
        country=((instrument.listing_country or instrument.country) if instrument else None),
        liquidity_profile=(getattr(instrument, "liquidity_profile", None) if instrument else None),
        account_id=h.account_id,
    )


def _unavailable_holding(h, base_currency: str) -> HoldingValue:
    """A holding whose valuation raised: shown Unavailable (0, unpriced) — never a
    fabricated number — and contributes nothing to totals (honesty invariant)."""
    try:
        ac = h.asset_class.value if hasattr(h.asset_class, "value") else str(h.asset_class or "other")
    except Exception:  # noqa: BLE001
        ac = "other"
    return HoldingValue(
        holding_id=h.id,
        label=getattr(h, "label", None) or "Holding",
        name=None,
        symbol=None,
        asset_class=ac,
        sector=None,
        quantity=D(getattr(h, "quantity", 0) or 0),
        native_currency=base_currency,
        price=None,
        market_value_base=ZERO,
        cost_basis_base=ZERO,
        unrealised_pl_base=ZERO,
        day_change_base=ZERO,
        is_stale=True,
        is_priced=False,
        valuation_method=ValuationMethod.UNAVAILABLE.value,
        account_id=getattr(h, "account_id", None),
    )


async def value_portfolio(
    session: AsyncSession, base_currency: str, warm: bool = True, entity_id: int | None = None
) -> PortfolioValuation:
    """Value every holding at its latest cached quote, converted to base currency.

    Manual-priced and unpriced assets use ``manual_value`` (or cost) so private
    assets, cash, and property still contribute to net worth. With ``warm=True``
    (default) a held instrument with no cached quote is fetched on demand so a
    cold start still shows priced positions and movers. ``entity_id`` optionally scopes
    the valuation to one ownership entity (§4.1); the default (None) values everything.
    """
    val = PortfolioValuation(base_currency=base_currency)
    # §3.5 R1 (chokepoint): soft-deleted holdings contribute nothing to net worth or any
    # valuation. This one filter covers the ~25 callers that value through value_portfolio.
    q = select(Holding).where(Holding.deleted_at.is_(None))
    ef = entity_account_filter(Holding, entity_id)  # §4.1: no-op when entity_id is None
    if ef is not None:
        q = q.where(ef)
    rows = (await session.execute(q)).scalars().all()

    for h in rows:
        # A reader must never 500 on one bad holding: value it in isolation and,
        # on any failure, degrade it to Unavailable (honest, not fabricated) and
        # log which holding + why, so the root cause is diagnosable from the logs.
        try:
            hv = await _value_one_holding(session, h, base_currency, warm)
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "valuation failed for holding id=%s label=%r — showing it as "
                "Unavailable (not fabricated): %s", h.id, getattr(h, "label", None), exc,
            )
            hv = _unavailable_holding(h, base_currency)
        val.holdings.append(hv)
        val.total_value += hv.market_value_base
        val.cost_basis += hv.cost_basis_base
        val.unrealised_pl += hv.unrealised_pl_base
        val.day_change += hv.day_change_base
        val.has_stale = val.has_stale or hv.is_stale

    val.total_value = money(val.total_value)
    val.cost_basis = money(val.cost_basis)
    val.unrealised_pl = money(val.unrealised_pl)
    val.day_change = money(val.day_change)
    return val


async def rebuild_holdings_from_transactions(session: AsyncSession) -> int:
    """Recompute holdings (qty + FIFO avg cost) from the transaction ledger.

    Manual holdings (no instrument_id, or manual_value set) are left untouched.
    Returns the number of instrument positions rebuilt.
    """
    # §3.5 R2 (chokepoint): derived holdings are rebuilt from the ledger, so excluding
    # soft-deleted transactions here makes every derived-holding valuation reflect the
    # deletion without touching the FIFO/valuation math.
    from app.services.tax import resolve_mergers  # local import avoids the portfolio↔tax cycle
    txns = resolve_mergers((await session.execute(select(Txn).where(Txn.deleted_at.is_(None)))).scalars().all())
    by_key: dict[tuple[int, int], list[Txn]] = defaultdict(list)
    for t in txns:
        if t.instrument_id is None:
            continue
        by_key[(t.account_id, t.instrument_id)].append(t)

    # Clear existing transaction-derived holdings (those linked to an instrument),
    # but preserve any with a manual_value override.
    existing = (await session.execute(select(Holding).where(Holding.instrument_id.isnot(None)))).scalars().all()
    for h in existing:
        if h.manual_value is None:
            await session.delete(h)
    await session.flush()

    count = 0
    for (account_id, instrument_id), group in by_key.items():
        res = compute_fifo(group)
        if res.quantity <= ZERO:
            continue
        instrument = await session.get(Instrument, instrument_id)
        # The instrument's trading currency (from its exchange suffix) is
        # authoritative — a .BSE stock trades in INR no matter what currency the
        # transaction row happened to default to. Fall back to the txn currency.
        sym = instrument.symbol if instrument else None
        inferred = currency_for_symbol(sym, instrument.exchange if instrument else None)
        ccy = inferred or group[0].currency or (instrument.currency if instrument else "USD")
        if instrument and inferred and instrument.currency != inferred:
            instrument.currency = inferred  # keep the instrument aligned to its venue
        session.add(Holding(
            account_id=account_id,
            instrument_id=instrument_id,
            asset_class=instrument.asset_class if instrument else AssetClass.EQUITY,
            quantity=res.quantity,
            avg_cost=res.avg_cost,
            currency=ccy,
        ))
        count += 1
    await session.flush()
    return count


def top_movers(val: PortfolioValuation, n: int = 5) -> tuple[list[HoldingValue], list[HoldingValue]]:
    """Return (gainers, losers) by day change in base currency."""
    priced = [h for h in val.holdings if h.is_priced]
    gainers = sorted(priced, key=lambda h: h.day_change_base, reverse=True)[:n]
    losers = sorted(priced, key=lambda h: h.day_change_base)[:n]
    return gainers, [hv for hv in losers if hv.day_change_base < ZERO]


def holdings_csv(val: PortfolioValuation) -> str:
    """Flatten holdings into CSV text for the server-side export (D-050 / P-5).

    The client never generates the file; every text cell is formula-injection
    sanitised (`sanitize_cell`). Money is rendered at full Decimal precision (not
    the display float), for an accountant.
    """
    import csv
    import io

    from app.services.csv_import import sanitize_cell

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([
        "symbol", "name", "asset_class", "currency", "quantity", "price",
        "market_value_base", "cost_basis_base", "unrealised_pl_base",
        "day_change_base", "is_stale", "valuation_method", "base_currency",
    ])
    for h in val.holdings:
        w.writerow([
            sanitize_cell(h.symbol or ""),
            sanitize_cell(getattr(h, "name", None) or h.label or ""),
            sanitize_cell(h.asset_class or ""),
            sanitize_cell(h.native_currency or ""),
            h.quantity, h.price, h.market_value_base, h.cost_basis_base,
            h.unrealised_pl_base, h.day_change_base,
            "yes" if h.is_stale else "no",
            sanitize_cell(str(getattr(h, "valuation_method", "") or "")),
            val.base_currency,
        ])
    return buf.getvalue()
