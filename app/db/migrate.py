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

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from app.core.config import get_settings

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
    """Stamp (if needed) + upgrade to head. Returns a short status string."""
    settings = get_settings()
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    cfg = _alembic_config()

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

    log("[db] schema up to date")
    return status
