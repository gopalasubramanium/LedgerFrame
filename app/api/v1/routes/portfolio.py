"""Portfolio: summary, holdings, transactions, CSV import, net-worth history."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_auth
from app.core.config import get_settings
from app.core.money import D, money, to_display
from app.models import (
    Account,
    AssetClass,
    AuditEvent,
    Holding,
    Instrument,
    NetWorthSnapshot,
    Transaction,
    TxnType,
)
from app.services.csv_import import TRANSACTION_TEMPLATE, import_transactions_csv
from app.services.portfolio import (
    rebuild_holdings_from_transactions,
    top_movers,
    value_portfolio,
)

router = APIRouter()


def _hv(h) -> dict:
    return {
        "id": h.holding_id, "label": h.label, "name": h.name, "symbol": h.symbol,
        "asset_class": h.asset_class, "quantity": to_display(h.quantity),
        "currency": h.native_currency, "price": to_display(h.price),
        "market_value": to_display(h.market_value_base),
        "cost_basis": to_display(h.cost_basis_base),
        "unrealised_pl": to_display(h.unrealised_pl_base),
        "day_change": to_display(h.day_change_base),
        "day_change_pct": to_display(h.day_change_pct),
        "is_stale": h.is_stale, "is_priced": h.is_priced,
    }


@router.get("/portfolio/summary")
async def portfolio_summary(session: AsyncSession = Depends(get_db)) -> dict:
    base = get_settings().base_currency
    val = await value_portfolio(session, base)
    gainers, losers = top_movers(val)
    return {
        "base_currency": base,
        "total_value": to_display(val.total_value),
        "cost_basis": to_display(val.cost_basis),
        "unrealised_pl": to_display(val.unrealised_pl),
        "day_change": to_display(val.day_change),
        "total_return_pct": to_display(val.total_return_pct),
        "has_stale": val.has_stale,
        "allocation_by_class": {k: to_display(v) for k, v in val.allocation("asset_class").items()},
        "allocation_by_currency": {k: to_display(v) for k, v in val.allocation("native_currency").items()},
        "allocation_by_sector": {k: to_display(v) for k, v in val.sector_allocation().items()},
        "top_gainers": [_hv(h) for h in gainers],
        "top_losers": [_hv(h) for h in losers],
    }


@router.get("/portfolio/holdings")
async def portfolio_holdings(session: AsyncSession = Depends(get_db)) -> dict:
    base = get_settings().base_currency
    val = await value_portfolio(session, base)
    return {"base_currency": base, "holdings": [_hv(h) for h in val.holdings]}


@router.get("/portfolio/performance")
async def portfolio_performance(
    days: int = 365, benchmark: str = "SPY", include_manual: bool = False,
    session: AsyncSession = Depends(get_db),
) -> dict:
    from app.services.analytics import performance_series

    base = get_settings().base_currency
    data = await performance_series(
        session, base, max(7, min(days, 3650)), benchmark, include_manual=include_manual
    )
    data["base_currency"] = base
    return data


# Benchmarks the picker offers (symbol -> label). ETF proxies so live providers work.
_BENCHMARKS = {
    "SPY": "S&P 500", "QQQ": "Nasdaq 100", "DIA": "Dow 30",
    "EWS": "Singapore", "GLD": "Gold", "BTC": "Bitcoin",
}


@router.get("/portfolio/benchmarks")
async def list_benchmarks() -> dict:
    return {"benchmarks": [{"symbol": s, "label": label} for s, label in _BENCHMARKS.items()]}


@router.get("/portfolio/stats")
async def portfolio_stats(benchmark: str = "SPY", session: AsyncSession = Depends(get_db)) -> dict:
    from app.services.analytics import key_stats

    return await key_stats(session, get_settings().base_currency, benchmark)


class TransactionIn(BaseModel):
    account_id: int | None = None
    symbol: str | None = None
    type: TxnType
    ts: datetime
    quantity: float = 0
    price: float = 0
    fees: float = 0
    taxes: float = 0
    currency: str = "USD"
    note: str | None = None


def _naive_utc(dt: datetime) -> datetime:
    """Store timestamps as naive UTC for consistency with SQLite reads."""
    if dt.tzinfo is not None:
        return dt.astimezone(UTC).replace(tzinfo=None)
    return dt


def _txn_cash_impact(t: TransactionIn):
    """Signed cash impact, mirroring the CSV importer's convention."""
    gross = D(t.quantity) * D(t.price)
    costs = D(t.fees) + D(t.taxes)
    if t.type == TxnType.BUY:
        return -(gross + costs)
    if t.type == TxnType.SELL:
        return gross - costs
    if t.type in (TxnType.DIVIDEND, TxnType.INTEREST, TxnType.DEPOSIT):
        return gross - costs if gross else -costs
    if t.type in (TxnType.WITHDRAWAL, TxnType.FEE):
        return -(gross + costs) if gross else -costs
    return D(0)


@router.get("/portfolio/transactions")
async def list_transactions(limit: int = 500, session: AsyncSession = Depends(get_db)) -> dict:
    rows = (
        await session.execute(select(Transaction).order_by(Transaction.ts.desc()).limit(limit))
    ).scalars().all()
    out = []
    for t in rows:
        symbol = None
        if t.instrument_id:
            instr = await session.get(Instrument, t.instrument_id)
            symbol = instr.symbol if instr else None
        out.append({
            "id": t.id, "account_id": t.account_id, "symbol": symbol,
            "type": t.type.value if hasattr(t.type, "value") else str(t.type),
            "ts": t.ts.isoformat(),
            "quantity": to_display(D(t.quantity)), "price": to_display(D(t.price)),
            "fees": to_display(D(t.fees)), "taxes": to_display(D(getattr(t, "taxes", 0) or 0)),
            "amount": to_display(D(t.amount)), "currency": t.currency, "note": t.note,
        })
    return {"transactions": out}


@router.post("/portfolio/transactions", dependencies=[Depends(require_auth)])
async def add_transaction(payload: TransactionIn, session: AsyncSession = Depends(get_db)) -> dict:
    from app.services.csv_import import _ensure_account, _ensure_instrument

    account = await _ensure_account(session, payload.account_id)
    instrument = await _ensure_instrument(session, payload.symbol.upper()) if payload.symbol else None
    txn = Transaction(
        account_id=account.id,
        instrument_id=instrument.id if instrument else None,
        type=payload.type,
        ts=_naive_utc(payload.ts),
        quantity=D(payload.quantity), price=D(payload.price),
        fees=D(payload.fees), taxes=D(payload.taxes),
        amount=money(_txn_cash_impact(payload)),
        currency=payload.currency.upper(), note=payload.note,
    )
    session.add(txn)
    session.add(AuditEvent(category="mutation", action="add_transaction",
                           detail=f"{payload.type.value} {payload.symbol or ''}"))
    await session.flush()
    rebuilt = await rebuild_holdings_from_transactions(session)
    return {"ok": True, "transaction_id": txn.id, "holdings_rebuilt": rebuilt}


@router.put("/portfolio/transactions/{txn_id}", dependencies=[Depends(require_auth)])
async def update_transaction(
    txn_id: int, payload: TransactionIn, session: AsyncSession = Depends(get_db)
) -> dict:
    from app.services.csv_import import _ensure_instrument

    txn = await session.get(Transaction, txn_id)
    if txn is None:
        raise HTTPException(404, "transaction not found")
    instrument = await _ensure_instrument(session, payload.symbol.upper()) if payload.symbol else None
    txn.instrument_id = instrument.id if instrument else None
    txn.type = payload.type
    txn.ts = _naive_utc(payload.ts)
    txn.quantity = D(payload.quantity)
    txn.price = D(payload.price)
    txn.fees = D(payload.fees)
    txn.taxes = D(payload.taxes)
    txn.amount = money(_txn_cash_impact(payload))
    txn.currency = payload.currency.upper()
    txn.note = payload.note
    if payload.account_id:
        txn.account_id = payload.account_id
    session.add(AuditEvent(category="mutation", action="edit_transaction", detail=str(txn_id)))
    await session.flush()
    rebuilt = await rebuild_holdings_from_transactions(session)
    return {"ok": True, "holdings_rebuilt": rebuilt}


@router.delete("/portfolio/transactions/{txn_id}", dependencies=[Depends(require_auth)])
async def delete_transaction(txn_id: int, session: AsyncSession = Depends(get_db)) -> dict:
    txn = await session.get(Transaction, txn_id)
    if txn is None:
        raise HTTPException(404, "transaction not found")
    await session.delete(txn)
    session.add(AuditEvent(category="mutation", action="delete_transaction", detail=str(txn_id)))
    await session.flush()
    rebuilt = await rebuild_holdings_from_transactions(session)
    return {"ok": True, "holdings_rebuilt": rebuilt}


# --------------------------------------------------------------------------- #
# Manual assets & liabilities (cash, fixed deposits, property, private, loans).
# These carry a manual_value and are preserved across holdings rebuilds.
# --------------------------------------------------------------------------- #
class ManualHoldingIn(BaseModel):
    label: str
    asset_class: AssetClass = AssetClass.OTHER
    value: float
    currency: str = "SGD"
    account_id: int | None = None


async def _ensure_manual_account(session: AsyncSession) -> Account:
    acc = (
        await session.execute(select(Account).where(Account.kind == "manual"))
    ).scalars().first()
    if acc is None:
        acc = Account(name="Manual Assets", kind="manual", currency=get_settings().base_currency)
        session.add(acc)
        await session.flush()
    return acc


@router.get("/portfolio/manual-holdings")
async def list_manual_holdings(session: AsyncSession = Depends(get_db)) -> dict:
    rows = (
        await session.execute(select(Holding).where(Holding.manual_value.isnot(None)))
    ).scalars().all()
    return {"holdings": [
        {
            "id": h.id, "label": h.label,
            "asset_class": h.asset_class.value if hasattr(h.asset_class, "value") else str(h.asset_class),
            "value": to_display(D(h.manual_value)), "currency": h.currency,
            "account_id": h.account_id,
        }
        for h in rows
    ]}


@router.post("/portfolio/manual-holdings", dependencies=[Depends(require_auth)])
async def add_manual_holding(payload: ManualHoldingIn, session: AsyncSession = Depends(get_db)) -> dict:
    account = (
        await session.get(Account, payload.account_id) if payload.account_id else None
    ) or await _ensure_manual_account(session)
    holding = Holding(
        account_id=account.id, label=payload.label, asset_class=payload.asset_class,
        quantity=D(1), avg_cost=D(payload.value), manual_value=D(payload.value),
        currency=payload.currency.upper(),
    )
    session.add(holding)
    session.add(AuditEvent(category="mutation", action="add_manual_holding", detail=payload.label))
    await session.flush()
    return {"ok": True, "id": holding.id}


@router.put("/portfolio/manual-holdings/{holding_id}", dependencies=[Depends(require_auth)])
async def update_manual_holding(
    holding_id: int, payload: ManualHoldingIn, session: AsyncSession = Depends(get_db)
) -> dict:
    h = await session.get(Holding, holding_id)
    if h is None or h.manual_value is None:
        raise HTTPException(404, "manual holding not found")
    h.label = payload.label
    h.asset_class = payload.asset_class
    h.avg_cost = D(payload.value)
    h.manual_value = D(payload.value)
    h.currency = payload.currency.upper()
    session.add(AuditEvent(category="mutation", action="edit_manual_holding", detail=str(holding_id)))
    await session.flush()
    return {"ok": True}


@router.delete("/portfolio/manual-holdings/{holding_id}", dependencies=[Depends(require_auth)])
async def delete_manual_holding(holding_id: int, session: AsyncSession = Depends(get_db)) -> dict:
    h = await session.get(Holding, holding_id)
    if h is None or h.manual_value is None:
        raise HTTPException(404, "manual holding not found")
    await session.delete(h)
    session.add(AuditEvent(category="mutation", action="delete_manual_holding", detail=str(holding_id)))
    await session.flush()
    return {"ok": True}


@router.get("/portfolio/import/template", response_class=PlainTextResponse)
async def csv_template() -> str:
    return TRANSACTION_TEMPLATE


@router.post("/portfolio/import/csv", dependencies=[Depends(require_auth)])
async def import_csv(
    file: UploadFile = File(...),
    account_id: int | None = None,
    session: AsyncSession = Depends(get_db),
) -> dict:
    content = await file.read()
    try:
        result = await import_transactions_csv(session, content, account_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    session.add(AuditEvent(category="mutation", action="import_csv",
                           detail=f"{result['imported']} rows"))
    result["holdings_rebuilt"] = await rebuild_holdings_from_transactions(session)
    return result


@router.get("/net-worth/history")
async def net_worth_history(session: AsyncSession = Depends(get_db)) -> dict:
    rows = (
        await session.execute(select(NetWorthSnapshot).order_by(NetWorthSnapshot.ts))
    ).scalars().all()
    return {
        "history": [
            {"ts": r.ts.isoformat(), "assets": to_display(r.assets),
             "liabilities": to_display(r.liabilities), "net_worth": to_display(r.net_worth),
             "currency": r.base_currency}
            for r in rows
        ]
    }
