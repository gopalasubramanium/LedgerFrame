# SPDX-License-Identifier: AGPL-3.0-or-later
"""Instrument identity & taxonomy helpers (Phase 2).

Normalized identifiers (ISIN / FIGI / AMFI code / CoinGecko id / provider symbol)
live in ``instrument_identifiers`` so identity is keyed by (id_type, value), never a
bare ticker — a US/IN/SG symbol collision is impossible. Also provides sensible
taxonomy defaults so newly-created instruments are classified consistently with the
migration backfill.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import HIGH_CONFIDENCE_IDS, Instrument, InstrumentIdentifier


class DuplicateIdentifierError(ValueError):
    """A high-confidence identifier is already mapped to a different instrument."""


# Sentinel so ``resolve_or_create_instrument`` can tell "caller omitted country → compute a
# default" from "caller passed country=None → leave it unknown" (§14dr-27b).
_UNSET: object = object()

# Recognised identifier namespaces.
ID_TYPES = (
    "isin", "cusip", "figi", "sedol", "amfi_code", "kite_token",
    "coingecko_id", "provider_symbol",
)


def classify_defaults(asset_class: str, *, is_manual_price: bool, currency: str) -> dict:
    """Sensible taxonomy defaults for a new instrument — mirrors the Phase 2 migration
    backfill so create_all-created rows and migrated rows agree."""
    ac = asset_class.value if hasattr(asset_class, "value") else str(asset_class)
    return {
        "asset_category": ac,
        "asset_subclass": ac,
        "pricing_currency": currency,
        "liquidity_profile": "manual" if is_manual_price else "listed",
        "valuation_method": "manual_valuation" if is_manual_price else "market_quote",
    }


async def resolve_or_create_instrument(
    session: AsyncSession,
    symbol: str,
    exchange: str | None = None,
    *,
    name: str | None = None,
    asset_class=None,
    currency: str | None = None,
    country: str | None = _UNSET,
    extra: dict | None = None,
) -> tuple[Instrument, bool]:
    """The ONE identity resolution for every instrument-create path (R-63 I-6, §9-i ADDENDUM).

    Two get-or-create paths used to key identity differently — ``market`` matched
    ``symbol.upper()`` while ``csv_import`` matched the bare (non-uppercased) symbol — so the
    same logical ticker resolved to two rows (the live TSLA id-22/id-23 pair). This collapses
    them to a single resolution whose **lookup key equals the DB uniqueness key**
    (``upper(symbol)`` + exchange, with NULL≡NULL): the F6 principle — two keys for one
    identity IS the defect.

    Case-normalizes the symbol on both lookup and create (SQLite ``=`` is case-sensitive, so the
    lookup uses ``upper(symbol)`` to catch a case-variant row). Savepoint-tolerant against a
    concurrent create: if the ``uq_instr_identity_ci`` guard rejects the flush, the winner is
    re-read rather than poisoning the outer transaction. Returns ``(instrument, created)``.
    """
    from sqlalchemy.exc import IntegrityError

    from app.core.symbols import country_for_symbol, currency_for_symbol
    from app.models import AssetClass

    sym = symbol.upper()
    stmt = select(Instrument).where(func.upper(Instrument.symbol) == sym)
    if exchange:
        stmt = stmt.where(Instrument.exchange == exchange)
    instrument = (await session.execute(stmt)).scalars().first()
    if instrument is not None:
        return instrument, False

    ac = asset_class if asset_class is not None else AssetClass.EQUITY
    ccy = currency or currency_for_symbol(symbol, exchange) or "USD"
    # ``country`` is authoritative when the caller passes it (even as None — csv_import
    # deliberately leaves a non-equity's country unknown, §14dr-27b); only the _UNSET default
    # falls back to the bare-ticker heuristic (the pre-existing market.py behaviour).
    ctry = country if country is not _UNSET else country_for_symbol(symbol, exchange, ccy)
    fields: dict = dict(
        symbol=sym, exchange=exchange, name=name or sym, currency=ccy,
        country=ctry,
        asset_class=ac,
        **classify_defaults(ac, is_manual_price=False, currency=ccy),
    )
    if extra:
        fields.update(extra)
    instrument = Instrument(**fields)
    session.add(instrument)
    try:
        # Savepoint so a concurrent create (uq_instr_identity_ci) can be recovered without
        # poisoning the outer transaction — mirrors the pre-existing market.py pattern.
        async with session.begin_nested():
            await session.flush()
    except IntegrityError:
        instrument = (await session.execute(stmt)).scalars().first()
        assert instrument is not None  # the IntegrityError means a concurrent create won
        return instrument, False
    return instrument, True


async def duplicate_instruments(session: AsyncSession) -> list[dict]:
    """Instruments that share one identity — same ``upper(symbol)`` and equivalent exchange
    (NULL≡NULL) — split across more than one row. A data-quality problem the user resolves on
    Holdings; we report, never auto-merge (we never guess which row is canonical). Mirrors
    ``duplicate_identifiers``. This is the honest face of the dupe-tolerant identity migration:
    where the ``uq_instr_identity_ci`` index could not bind (a DB that already held duplicates),
    this surfaces exactly which rows to reconcile."""
    key_symbol = func.upper(Instrument.symbol)
    key_exch = func.coalesce(Instrument.exchange, "")
    groups = (
        await session.execute(
            select(key_symbol.label("sym"), key_exch.label("exch"), func.count().label("n"))
            .group_by(key_symbol, key_exch)
            .having(func.count() > 1)
        )
    ).all()
    out: list[dict] = []
    for sym, exch, n in groups:
        rows = (
            await session.execute(
                select(Instrument.id, Instrument.symbol, Instrument.name, Instrument.exchange)
                .where(func.upper(Instrument.symbol) == sym, func.coalesce(Instrument.exchange, "") == exch)
                .order_by(Instrument.id)
            )
        ).all()
        out.append({
            "symbol": sym, "exchange": exch or None, "instrument_count": n,
            "instruments": [
                {"id": i, "symbol": s, "name": nm, "exchange": ex} for i, s, nm, ex in rows
            ],
        })
    return out


async def find_instrument_by_identifier(
    session: AsyncSession, id_type: str, value: str
) -> Instrument | None:
    """Resolve an instrument by a normalized identifier (e.g. an ISIN). Returns None
    if unmapped OR if the mapping is **ambiguous** (the same id points at more than one
    instrument) — we never guess which is correct; surface it via ``duplicate_identifiers``."""
    rows = (
        await session.execute(
            select(InstrumentIdentifier).where(
                InstrumentIdentifier.id_type == id_type.lower(),
                InstrumentIdentifier.value == value,
            )
        )
    ).scalars().all()
    instrument_ids = {r.instrument_id for r in rows}
    if len(instrument_ids) != 1:
        return None  # unmapped (0) or ambiguous (>1) → don't guess
    return await session.get(Instrument, next(iter(instrument_ids)))


async def duplicate_identifiers(session: AsyncSession) -> list[dict]:
    """Any (id_type, value) mapped to more than one instrument — a data-quality
    problem the user must resolve. We report, never auto-merge."""
    rows = (
        await session.execute(
            select(
                InstrumentIdentifier.id_type, InstrumentIdentifier.value,
                func.count(func.distinct(InstrumentIdentifier.instrument_id)).label("n"),
            )
            .group_by(InstrumentIdentifier.id_type, InstrumentIdentifier.value)
            .having(func.count(func.distinct(InstrumentIdentifier.instrument_id)) > 1)
        )
    ).all()
    out: list[dict] = []
    for id_type, value, n in rows:
        instrs = (
            await session.execute(
                select(Instrument.id, Instrument.symbol, Instrument.name)
                .join(InstrumentIdentifier, InstrumentIdentifier.instrument_id == Instrument.id)
                .where(InstrumentIdentifier.id_type == id_type, InstrumentIdentifier.value == value)
            )
        ).all()
        out.append({
            "id_type": id_type, "value": value, "instrument_count": n,
            "instruments": [{"id": i, "symbol": s, "name": nm} for i, s, nm in instrs],
        })
    return out


async def set_identifier(
    session: AsyncSession,
    instrument_id: int,
    id_type: str,
    value: str,
    *,
    provider: str | None = None,
    is_primary: bool = False,
) -> InstrumentIdentifier:
    """Idempotently attach an identifier to an instrument (no duplicate rows).

    Refuses to attach a **high-confidence** identifier (ISIN/CUSIP/FIGI/SEDOL/AMFI
    code/Kite token/CoinGecko id) that already belongs to a *different* instrument —
    that would create an ambiguous mapping. Raises ``DuplicateIdentifierError``.
    """
    id_type = id_type.lower()
    if id_type in HIGH_CONFIDENCE_IDS:
        clash = (
            await session.execute(
                select(InstrumentIdentifier).where(
                    InstrumentIdentifier.id_type == id_type,
                    InstrumentIdentifier.value == value,
                    InstrumentIdentifier.instrument_id != instrument_id,
                )
            )
        ).scalars().first()
        if clash is not None:
            raise DuplicateIdentifierError(
                f"{id_type} '{value}' is already mapped to instrument #{clash.instrument_id}"
            )
    existing = (
        await session.execute(
            select(InstrumentIdentifier).where(
                InstrumentIdentifier.instrument_id == instrument_id,
                InstrumentIdentifier.id_type == id_type,
                InstrumentIdentifier.value == value,
            )
        )
    ).scalars().first()
    if existing is not None:
        if provider is not None:
            existing.provider = provider
        if is_primary:
            existing.is_primary = True
        return existing
    ident = InstrumentIdentifier(
        instrument_id=instrument_id, id_type=id_type, value=value,
        provider=provider, is_primary=is_primary,
    )
    session.add(ident)
    await session.flush()
    return ident


async def identifiers_for(session: AsyncSession, instrument_id: int) -> list[dict]:
    rows = (
        await session.execute(
            select(InstrumentIdentifier).where(InstrumentIdentifier.instrument_id == instrument_id)
        )
    ).scalars().all()
    return [
        {"id_type": r.id_type, "value": r.value, "provider": r.provider, "is_primary": r.is_primary}
        for r in rows
    ]
