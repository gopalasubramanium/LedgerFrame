"""Portfolio: summary, holdings, transactions, CSV import, net-worth history."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_auth
from app.core.config import get_settings
from app.core.money import D, money, to_display
from app.models import AuditEvent, NetWorthSnapshot, Transaction, TxnType
from app.services.csv_import import TRANSACTION_TEMPLATE, import_transactions_csv
from app.services.portfolio import (
    rebuild_holdings_from_transactions,
    top_movers,
    value_portfolio,
)

router = APIRouter()


def _hv(h) -> dict:
    return {
        "id": h.holding_id, "label": h.label, "symbol": h.symbol,
        "asset_class": h.asset_class, "quantity": to_display(h.quantity),
        "currency": h.native_currency, "price": to_display(h.price),
        "market_value": to_display(h.market_value_base),
        "cost_basis": to_display(h.cost_basis_base),
        "unrealised_pl": to_display(h.unrealised_pl_base),
        "day_change": to_display(h.day_change_base),
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
        "top_gainers": [_hv(h) for h in gainers],
        "top_losers": [_hv(h) for h in losers],
    }


@router.get("/portfolio/holdings")
async def portfolio_holdings(session: AsyncSession = Depends(get_db)) -> dict:
    base = get_settings().base_currency
    val = await value_portfolio(session, base)
    return {"base_currency": base, "holdings": [_hv(h) for h in val.holdings]}


class TransactionIn(BaseModel):
    account_id: int | None = None
    symbol: str | None = None
    type: TxnType
    ts: datetime
    quantity: float = 0
    price: float = 0
    fees: float = 0
    currency: str = "USD"
    note: str | None = None


@router.post("/portfolio/transactions", dependencies=[Depends(require_auth)])
async def add_transaction(payload: TransactionIn, session: AsyncSession = Depends(get_db)) -> dict:
    from app.services.csv_import import _ensure_account, _ensure_instrument

    account = await _ensure_account(session, payload.account_id)
    instrument = await _ensure_instrument(session, payload.symbol.upper()) if payload.symbol else None
    txn = Transaction(
        account_id=account.id,
        instrument_id=instrument.id if instrument else None,
        type=payload.type,
        ts=payload.ts.replace(tzinfo=payload.ts.tzinfo or timezone.utc),
        quantity=D(payload.quantity), price=D(payload.price), fees=D(payload.fees),
        amount=money(D(payload.quantity) * D(payload.price)),
        currency=payload.currency.upper(), note=payload.note,
    )
    session.add(txn)
    session.add(AuditEvent(category="mutation", action="add_transaction",
                           detail=f"{payload.type.value} {payload.symbol or ''}"))
    await session.flush()
    rebuilt = await rebuild_holdings_from_transactions(session)
    return {"ok": True, "transaction_id": txn.id, "holdings_rebuilt": rebuilt}


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
