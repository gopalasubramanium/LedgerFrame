# SPDX-License-Identifier: AGPL-3.0-or-later
"""Bring the database schema up to date — safe for create_all-bootstrapped DBs.

LedgerFrame bootstraps fresh databases with ``Base.metadata.create_all()`` at
startup, so an existing database often already has the current schema but **no
Alembic version stamp**. A plain ``alembic upgrade head`` then tries to re-run the
initial migration and fails with "table accounts already exists".

``run_migrations`` resolves this deterministically by checking whether the DB is
*actually stamped* (an ``alembic_version`` row), not merely whether the table
exists — a previously-failed upgrade can leave an **empty** ``alembic_version``
table, which still needs adopting:

  • no app tables                    → ``upgrade head`` (create everything)
  • app tables but no version row     → ``stamp`` the initial revision, then
                                        ``upgrade head`` (idempotent migrations
                                        apply only what's missing)
  • already stamped                   → ``upgrade head`` (normal path)

As a final safety net, if ``upgrade head`` still raises against an existing
schema, we force-stamp ``head`` (the running code's create_all guarantees the
current schema is present) so the update never fails and future upgrades are clean.
"""

from __future__ import annotations

import contextlib
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from app.core.config import get_settings


@contextlib.contextmanager
def _migration_lock():
    """Cross-process exclusive lock so only ONE process runs the migration sequence at a
    time (the API and worker both migrate at startup). Others block here, then read the
    schema already at head and no-op.

    Scope (§2.2): this is a POSIX ``fcntl.flock`` on a file under ``data_dir`` — it serialises
    processes on ONE host that share that directory (the SQLite deployment target). It is a
    best-effort no-op on non-POSIX platforms, and it does NOT serialise across hosts sharing
    a networked database (e.g. Postgres) — a multi-host deployment should gate migrations with
    a DB advisory lock or a single migrate step instead."""
    settings = get_settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    try:
        import fcntl
    except ImportError:  # pragma: no cover — non-POSIX (not a deployment target)
        yield
        return
    with open(settings.data_dir / ".migrate.lock", "w") as fh:
        fcntl.flock(fh, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(fh, fcntl.LOCK_UN)

# Repo root = three levels up from this file (app/db/migrate.py -> repo/).
ROOT = Path(__file__).resolve().parents[2]
# The first migration; everything else descends from it.
INITIAL_REVISION = "c8a035ade752"


def _alembic_config() -> Config:
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "app" / "db" / "migrations"))
    return cfg


def _state(sync_db_url: str) -> tuple[bool, bool]:
    """Return (has_app_tables, is_stamped) for the database."""
    engine = create_engine(sync_db_url)
    try:
        tables = set(inspect(engine).get_table_names())
        has_app_tables = "accounts" in tables
        stamped = False
        if "alembic_version" in tables:
            with engine.connect() as conn:
                row = conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).first()
                stamped = row is not None
        return has_app_tables, stamped
    finally:
        engine.dispose()


def run_migrations(log=print) -> str:
    """Stamp (if needed) + upgrade to head. Returns a short status string.

    Serialised across processes by a file lock so the API and worker migrating at the same
    startup can't race on the SQLite file — the second waits, then finds head and no-ops."""
    settings = get_settings()
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    cfg = _alembic_config()

    with _migration_lock():
        has_app_tables, stamped = _state(settings.sync_db_url)
        status = "upgraded"
        if has_app_tables and not stamped:
            log(f"[db] unstamped existing schema → stamping baseline {INITIAL_REVISION}")
            command.stamp(cfg, INITIAL_REVISION)
            status = "adopted"

        log("[db] applying migrations (upgrade head)…")
        try:
            command.upgrade(cfg, "head")
        except Exception as exc:  # noqa: BLE001
            # create_all guarantees the current schema exists, so reconcile by stamping
            # head rather than failing the update.
            log(f"[db] upgrade reported '{exc}'.\n[db] schema already current — stamping head")
            command.stamp(cfg, "head")
            status = "reconciled"

    # F-8c: Alembic's `fileConfig` (env.py) rebuilds the ROOT handler list from alembic.ini, which
    # drops the app's stream + rotating-file handlers even with `disable_existing_loggers=False`.
    # Re-assert the application's own logging configuration so everything after startup migrations
    # keeps reaching the log file. Without this the file stopped at "[db] applying migrations" and
    # every later line — including honest acquisition failures — was lost.
    try:
        from app.core.logging import setup_logging

        setup_logging()
    except Exception as exc:  # noqa: BLE001 — logging must never break the migration path
        log(f"[db] could not re-assert application logging after migrations: {exc}")

    log("[db] schema up to date")
    return status
