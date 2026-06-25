"""Portfolio & net-worth engine.

All math is deterministic Decimal arithmetic — the AI layer is never allowed to
compute any of these numbers. Cost basis uses FIFO by default.
"""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.money import ZERO, D, money, pct_change
from app.models import AssetClass, Holding, Instrument, TxnType
from app.models import Transaction as Txn
from app.services import fx
from app.services.market import get_cached_quote


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


def compute_fifo(transactions: list[Txn]) -> FifoResult:
    """Replay a single instrument's transactions in time order under FIFO.

    Buys push lots (unit cost includes fees); sells consume oldest lots first and
    accrue realised P/L. Splits scale open lots. Dividends/interest accrue income.
    Pure function — no DB, no IO — so it is trivially testable.
    """
    lots: deque[list[Decimal]] = deque()  # each lot = [qty, unit_cost]
    res = FifoResult()
    for t in sorted(transactions, key=lambda x: x.ts):
        qty, px, fees = D(t.quantity), D(t.price), D(t.fees)
        if t.type == TxnType.BUY:
            if qty <= ZERO:
                continue
            unit_cost = px + (fees / qty if qty else ZERO)
            lots.append([qty, unit_cost])
        elif t.type == TxnType.SELL:
            remaining = qty
            proceeds = qty * px - fees
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
        elif t.type in (TxnType.DIVIDEND, TxnType.INTEREST):
            res.income += D(t.amount) if t.amount else qty * px

    res.quantity = sum((lot[0] for lot in lots), ZERO)
    res.cost_basis = sum((lot[0] * lot[1] for lot in lots), ZERO)
    return res


@dataclass
class HoldingValue:
    holding_id: int
    label: str
    symbol: str | None
    asset_class: str
    quantity: Decimal
    native_currency: str
    price: Decimal | None
    market_value_base: Decimal
    cost_basis_base: Decimal
    unrealised_pl_base: Decimal
    day_change_base: Decimal
    is_stale: bool
    is_priced: bool


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

    def allocation(self, key: str) -> dict[str, Decimal]:
        """Allocation map (base-currency value) keyed by an attribute name."""
        out: dict[str, Decimal] = defaultdict(lambda: ZERO)
        for h in self.holdings:
            out[getattr(h, key, "Other") or "Other"] += h.market_value_base
        return dict(out)


async def value_portfolio(session: AsyncSession, base_currency: str) -> PortfolioValuation:
    """Value every holding at its latest cached quote, converted to base currency.

    Manual-priced and unpriced assets use ``manual_value`` (or cost) so private
    assets, cash, and property still contribute to net worth.
    """
    val = PortfolioValuation(base_currency=base_currency)
    rows = (await session.execute(select(Holding))).scalars().all()

    for h in rows:
        instrument = (
            await session.get(Instrument, h.instrument_id) if h.instrument_id else None
        )
        symbol = instrument.symbol if instrument else None
        native_ccy = h.currency or (instrument.currency if instrument else base_currency)

        price_native: Decimal | None = None
        is_stale = False
        is_priced = True

        if h.manual_value is not None:
            mv_native = D(h.manual_value)
        elif symbol and instrument and not instrument.is_manual_price:
            q = await get_cached_quote(session, symbol, instrument.exchange)
            if q.price is not None:
                price_native = D(q.price)
                mv_native = D(h.quantity) * price_native
                is_stale = q.is_stale
            else:
                mv_native = D(h.quantity) * D(h.avg_cost)  # fall back to cost; mark unpriced
                is_priced = False
        else:
            mv_native = D(h.quantity) * D(h.avg_cost)
            is_priced = False

        cost_native = D(h.quantity) * D(h.avg_cost)

        # Day change from previous close where we have a live-ish quote.
        day_change_native = ZERO
        if price_native is not None and symbol and instrument:
            q = await get_cached_quote(session, symbol, instrument.exchange)
            if q.previous_close:
                day_change_native = (price_native - D(q.previous_close)) * D(h.quantity)

        mv_base = await fx.convert(mv_native, native_ccy, base_currency)
        cost_base = await fx.convert(cost_native, native_ccy, base_currency)
        day_base = await fx.convert(day_change_native, native_ccy, base_currency)

        # Liabilities count as negative value toward net worth.
        sign = Decimal("-1") if h.asset_class == AssetClass.LIABILITY else Decimal("1")
        mv_base *= sign
        cost_base *= sign

        hv = HoldingValue(
            holding_id=h.id,
            label=h.label or (symbol or "Manual asset"),
            symbol=symbol,
            asset_class=h.asset_class.value if hasattr(h.asset_class, "value") else str(h.asset_class),
            quantity=D(h.quantity),
            native_currency=native_ccy,
            price=price_native,
            market_value_base=money(mv_base),
            cost_basis_base=money(cost_base),
            unrealised_pl_base=money(mv_base - cost_base),
            day_change_base=money(day_base),
            is_stale=is_stale,
            is_priced=is_priced,
        )
        val.holdings.append(hv)
        val.total_value += hv.market_value_base
        val.cost_basis += hv.cost_basis_base
        val.unrealised_pl += hv.unrealised_pl_base
        val.day_change += hv.day_change_base
        val.has_stale = val.has_stale or is_stale

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
    from app.models import Account

    txns = (await session.execute(select(Txn))).scalars().all()
    by_key: dict[tuple[int, int], list[Txn]] = defaultdict(list)
    for t in txns:
        if t.instrument_id is None:
            continue
        by_key[(t.account_id, t.instrument_id)].append(t)

    # Clear existing transaction-derived holdings (those linked to an instrument).
    existing = (await session.execute(select(Holding).where(Holding.instrument_id.isnot(None)))).scalars().all()
    keep_manual = {h.id: h for h in existing if h.manual_value is not None}
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
        account = await session.get(Account, account_id)
        ccy = group[0].currency or (instrument.currency if instrument else "USD")
        session.add(Holding(
            account_id=account_id,
            instrument_id=instrument_id,
            asset_class=instrument.asset_class if instrument else AssetClass.EQUITY,
            quantity=res.quantity,
            avg_cost=res.avg_cost,
            currency=ccy,
        ))
        if account:  # keep instrument currency aligned to traded currency
            pass
        count += 1
    await session.flush()
    return count


def top_movers(val: PortfolioValuation, n: int = 5) -> tuple[list[HoldingValue], list[HoldingValue]]:
    """Return (gainers, losers) by day change in base currency."""
    priced = [h for h in val.holdings if h.is_priced]
    gainers = sorted(priced, key=lambda h: h.day_change_base, reverse=True)[:n]
    losers = sorted(priced, key=lambda h: h.day_change_base)[:n]
    return gainers, [h for h in losers if h.day_change_base < ZERO]
