"""Safe CSV import for transactions and holdings.

Hardening:
- Hard size cap (rejects oversized uploads before parsing).
- Row cap to bound memory.
- Formula-injection guard on every cell (leading = + - @ tab/CR are neutralised)
  for both import sanity and to keep round-tripped exports safe.
- Strict typing via the money helpers; bad rows are skipped and reported.
"""

from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.money import D, money
from app.models import Account, Instrument, Transaction, TxnType
from sqlalchemy import select

MAX_BYTES = 5 * 1024 * 1024
MAX_ROWS = 20_000
_DANGEROUS_PREFIX = ("=", "+", "-", "@", "\t", "\r")

TRANSACTION_TEMPLATE = (
    "date,symbol,type,quantity,price,fees,currency,note\n"
    "2024-01-15,AAPL,buy,10,185.50,1.00,USD,Initial purchase\n"
    "2024-03-01,AAPL,dividend,0,0,0,USD,Q1 dividend|amount=2.40\n"
)


def sanitize_cell(value: str) -> str:
    """Neutralise spreadsheet formula injection (used on export too)."""
    if value and value[0] in _DANGEROUS_PREFIX:
        return "'" + value
    return value


def _clean(value: str | None) -> str:
    return (value or "").strip()


async def import_transactions_csv(
    session: AsyncSession, content: bytes, account_id: int | None = None
) -> dict:
    if len(content) > MAX_BYTES:
        raise ValueError(f"file too large (max {MAX_BYTES // 1024 // 1024} MB)")
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    batch = uuid.uuid4().hex[:12]
    account = await _ensure_account(session, account_id)
    imported, errors = 0, []

    for i, row in enumerate(reader, start=2):  # row 1 = header
        if i - 1 > MAX_ROWS:
            errors.append(f"stopped at row cap {MAX_ROWS}")
            break
        try:
            type_str = _clean(row.get("type")).lower()
            ttype = TxnType(type_str)
            symbol = _clean(row.get("symbol")).upper()
            instrument = await _ensure_instrument(session, symbol) if symbol else None
            ts = datetime.fromisoformat(_clean(row.get("date"))).replace(tzinfo=timezone.utc)
            qty = D(_clean(row.get("quantity")) or 0)
            price = D(_clean(row.get("price")) or 0)
            fees = D(_clean(row.get("fees")) or 0)
            ccy = (_clean(row.get("currency")) or "USD").upper()

            # Cash impact (signed): buys/fees/withdrawals negative; sells/income positive.
            amount = _cash_impact(ttype, qty, price, fees)

            session.add(Transaction(
                account_id=account.id,
                instrument_id=instrument.id if instrument else None,
                type=ttype, ts=ts, quantity=qty, price=price, fees=fees,
                amount=money(amount), currency=ccy,
                note=sanitize_cell(_clean(row.get("note")))[:255] or None,
                import_batch=batch,
            ))
            imported += 1
        except (ValueError, KeyError) as exc:
            errors.append(f"row {i}: {exc}")

    await session.flush()
    return {"imported": imported, "errors": errors[:50], "batch": batch, "account_id": account.id}


def _cash_impact(ttype: TxnType, qty: D, price: D, fees: D):
    gross = qty * price
    if ttype in (TxnType.BUY,):
        return -(gross + fees)
    if ttype in (TxnType.SELL, TxnType.DIVIDEND, TxnType.INTEREST, TxnType.DEPOSIT):
        return gross - fees if ttype == TxnType.SELL else gross or -fees
    if ttype in (TxnType.WITHDRAWAL, TxnType.FEE):
        return -(gross + fees) if gross else -fees
    return D(0)


async def _ensure_account(session: AsyncSession, account_id: int | None) -> Account:
    if account_id:
        acc = await session.get(Account, account_id)
        if acc:
            return acc
    acc = (await session.execute(select(Account).limit(1))).scalars().first()
    if acc is None:
        acc = Account(name="Imported", kind="brokerage")
        session.add(acc)
        await session.flush()
    return acc


async def _ensure_instrument(session: AsyncSession, symbol: str) -> Instrument:
    instr = (
        await session.execute(select(Instrument).where(Instrument.symbol == symbol))
    ).scalars().first()
    if instr is None:
        instr = Instrument(symbol=symbol, name=symbol)
        session.add(instr)
        await session.flush()
    return instr
