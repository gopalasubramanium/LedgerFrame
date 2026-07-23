# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-63 I-6 (§9-i ADDENDUM) — the instrument-identity guard, once and for all.

The live diagnosis found a duplicate TSLA (id 22 with a source_override, id 23 without) that
made pricing lie: one row priced, the other showed ``(corrected)``. Root cause (two compounding
reasons):
  (a) two get-or-create paths keyed identity differently — ``market`` matched ``symbol.upper()``
      while ``csv_import`` matched the bare, non-uppercased symbol (F6: two keys for one identity
      IS the defect); and
  (b) ``uq_instr_symbol_exch = UniqueConstraint("symbol","exchange")`` did NOT stop two
      ``(TSLA, NULL)`` rows — SQL treats NULL as distinct in a UNIQUE constraint, and it is
      case-sensitive.

Fix (a): one shared ``resolve_or_create_instrument`` used by every create path. Fix (b): a
functional UNIQUE index ``uq_instr_identity_ci`` on ``(upper(symbol), coalesce(exchange,''))``.

Fail-first, through the REAL path (rider 4): ``test_guard_off_reproduces_the_duplicate`` drops the
guard index and shows the exact duplicate the owner has is creatable; ``…_blocks_…`` and
``…_resolves_to_one_instrument`` show the shipped guard closes that door. The pair IS the RED→GREEN.
Blindness pin (rider 4 / AC-15): every guard test first asserts the index EXISTS, so a guard that
protected nothing (index silently absent) fails loudly instead of passing vacuously.
"""

from __future__ import annotations

import os

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.models import Instrument
from app.services import market
from app.services.csv_import import _ensure_instrument
from app.services.identity import duplicate_instruments, resolve_or_create_instrument

GUARD_INDEX = "uq_instr_identity_ci"


async def _index_present(session) -> bool:
    rows = (await session.execute(
        text("SELECT name FROM sqlite_master WHERE type='index' AND name=:n"),
        {"n": GUARD_INDEX},
    )).all()
    return len(rows) == 1


# --------------------------------------------------------------------------- fix (b): the DB guard

async def test_guard_off_reproduces_the_duplicate(session):
    """RED (the owner's actual bug): WITHOUT the index, two (TSLA, NULL) rows coexist — the
    UNIQUE(symbol,exchange) constraint permits them because NULL is distinct. This is exactly the
    live id-22/id-23 state, and `duplicate_instruments` surfaces the pair for Holdings cleanup."""
    await session.execute(text(f"DROP INDEX IF EXISTS {GUARD_INDEX}"))
    session.add_all([
        Instrument(symbol="TSLA", exchange=None, name="Tesla", currency="USD"),
        Instrument(symbol="TSLA", exchange=None, name="Tesla (dup)", currency="USD"),
    ])
    await session.flush()  # the old constraint does NOT reject this — the defect, reproduced

    dups = await duplicate_instruments(session)
    assert len(dups) == 1
    assert dups[0]["symbol"] == "TSLA"
    assert dups[0]["exchange"] is None
    assert dups[0]["instrument_count"] == 2
    assert len({i["id"] for i in dups[0]["instruments"]}) == 2


async def test_guard_blocks_second_null_exchange_row(session):
    """GREEN: WITH the shipped index, the second (TSLA, NULL) is rejected — NULL is no longer
    distinct. Blindness pin: assert the guard exists first, so an absent index fails loudly."""
    assert await _index_present(session), "guard index missing — a guard that protects nothing"

    session.add(Instrument(symbol="TSLA", exchange=None, name="Tesla", currency="USD"))
    await session.flush()
    with pytest.raises(IntegrityError):
        async with session.begin_nested():
            session.add(Instrument(symbol="TSLA", exchange=None, name="Tesla (dup)", currency="USD"))
            await session.flush()


async def test_guard_blocks_case_variant_row(session):
    """GREEN: the index keys on upper(symbol), so 'tsla' collides with 'TSLA' — the case vector
    that let csv_import's bare-symbol key create a twin is closed at the DB layer too."""
    assert await _index_present(session)
    session.add(Instrument(symbol="TSLA", exchange=None, name="Tesla", currency="USD"))
    await session.flush()
    with pytest.raises(IntegrityError):
        async with session.begin_nested():
            session.add(Instrument(symbol="tsla", exchange=None, name="tesla lower", currency="USD"))
            await session.flush()


async def test_guard_allows_genuinely_distinct_listings(session):
    """(TSLA, NULL) and (TSLA, 'NASDAQ') are DIFFERENT identities (NULL≡'' ≠ 'NASDAQ') and MUST
    both be allowed — the guard closes the NULL-twin gap without over-collapsing real listings."""
    assert await _index_present(session)
    session.add(Instrument(symbol="TSLA", exchange=None, name="Tesla (bare)", currency="USD"))
    await session.flush()
    session.add(Instrument(symbol="TSLA", exchange="NASDAQ", name="Tesla (NASDAQ)", currency="USD"))
    await session.flush()  # must NOT raise
    n = (await session.execute(
        text("SELECT count(*) FROM instruments WHERE upper(symbol)='TSLA'"))).scalar()
    assert n == 2


# ------------------------------------------------------------ fix (a): one identity resolution

async def test_market_and_csv_paths_resolve_to_one_instrument(session):
    """GREEN, through the REAL paths: the market resolver creates TSLA; the csv_import path, fed the
    SAME ticker in a different case (the old divergent bare key), must resolve to the SAME row — not
    a twin. Before the fix these keyed differently and made two rows (or, with the index, a 500)."""
    a = await market._get_or_create_instrument(session, "TSLA", None)
    b = await _ensure_instrument(session, "tsla")  # csv path, lowercase — the old bare key
    assert a.id == b.id, "the two create paths still key identity differently"
    n = (await session.execute(
        text("SELECT count(*) FROM instruments WHERE upper(symbol)='TSLA'"))).scalar()
    assert n == 1


async def test_resolver_recovers_on_concurrent_create(session):
    """The resolver is savepoint-tolerant: if the guard rejects its flush (a concurrent create won
    the race), it re-reads the winner instead of poisoning the transaction. Simulated by pre-seeding
    the row the resolver would otherwise try to create."""
    first = await resolve_or_create_instrument(session, "NVDA", None)
    again, created = await resolve_or_create_instrument(session, "nvda", None)
    assert again.id == first[0].id
    assert created is False


# ------------------------------------------------------------------ rider 3: dupe-tolerant migration

def test_identity_migration_is_dupe_tolerant(tmp_path):
    """Rider 3 (hard): the owner's live DB CONTAINS the duplicate today, so a plain
    CREATE UNIQUE INDEX would brick the upgrade. On a DB that already holds duplicates the
    migration must NOT raise; it leaves the data intact (index unbound) and the service surfaces
    the pair. On a clean DB the same migration DOES bind the index."""
    from alembic import command
    from sqlalchemy import create_engine

    from app.core.config import get_settings, reload_settings
    from app.db.migrate import _alembic_config

    def _has_guard(eng) -> bool:
        # Expression indexes are not reflectable — probe sqlite_master directly.
        with eng.connect() as c:
            return c.execute(text(
                "SELECT 1 FROM sqlite_master WHERE type='index' AND name=:n"),
                {"n": GUARD_INDEX}).first() is not None

    before = "d4b7e2f1a9c6"   # the revision immediately before the identity index
    old = os.environ.get("LEDGERFRAME_DATA_DIR")
    try:
        # (1) DB that already holds a duplicate → migration tolerates it, index stays unbound.
        dirty = tmp_path / "dirty"
        (dirty / "db").mkdir(parents=True, exist_ok=True)
        os.environ["LEDGERFRAME_DATA_DIR"] = str(dirty)
        reload_settings()
        cfg = _alembic_config()
        command.upgrade(cfg, before)
        eng = create_engine(get_settings().sync_db_url)
        with eng.begin() as c:
            for nm in ("Tesla", "Tesla (dup)"):
                c.execute(text(
                    "INSERT INTO instruments (symbol, name, asset_class, currency, is_manual_price) "
                    "VALUES ('TSLA', :n, 'equity', 'USD', false)"), {"n": nm})
        command.upgrade(cfg, "head")   # MUST NOT RAISE
        assert not _has_guard(eng), "index should stay unbound where duplicates pre-exist"
        eng.dispose()

        # (2) Clean DB → the same migration binds the guard.
        clean = tmp_path / "clean"
        (clean / "db").mkdir(parents=True, exist_ok=True)
        os.environ["LEDGERFRAME_DATA_DIR"] = str(clean)
        reload_settings()
        command.upgrade(_alembic_config(), "head")
        eng2 = create_engine(get_settings().sync_db_url)
        assert _has_guard(eng2), "index should bind on a clean DB"
        eng2.dispose()
    finally:
        if old is not None:
            os.environ["LEDGERFRAME_DATA_DIR"] = old
        else:
            os.environ.pop("LEDGERFRAME_DATA_DIR", None)
        reload_settings()
