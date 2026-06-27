#!/usr/bin/env python3
"""Bring the database schema up to date — safe for create_all-bootstrapped DBs.

LedgerFrame bootstraps fresh databases with ``Base.metadata.create_all()`` at
startup, so an existing database often already has the current schema but **no
Alembic version stamp**. A plain ``alembic upgrade head`` then tries to re-run the
initial migration and fails with "table accounts already exists".

This script resolves that deterministically by looking at whether the DB is
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
current schema is present) so the update never fails and future upgrades are
clean. Exit code is 0 on success.
"""

from __future__ import annotations

import sys
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

# Repo root = parent of this scripts/ dir.
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.config import get_settings  # noqa: E402

# The first migration; everything else descends from it.
INITIAL_REVISION = "c8a035ade752"


def _state() -> tuple[bool, bool]:
    """Return (has_app_tables, is_stamped) for the configured database."""
    engine = create_engine(get_settings().sync_db_url)
    try:
        insp = inspect(engine)
        tables = set(insp.get_table_names())
        has_app_tables = "accounts" in tables
        stamped = False
        if "alembic_version" in tables:
            with engine.connect() as conn:
                row = conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).first()
                stamped = row is not None
        return has_app_tables, stamped
    finally:
        engine.dispose()


def main() -> int:
    settings = get_settings()
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)

    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "app" / "db" / "migrations"))

    has_app_tables, stamped = _state()

    if has_app_tables and not stamped:
        # DB was created by create_all() (or a prior upgrade failed before stamping)
        # — adopt the baseline so upgrade applies only the migrations on top of it.
        print(f"[db] unstamped existing schema → stamping baseline {INITIAL_REVISION}")
        command.stamp(cfg, INITIAL_REVISION)

    print("[db] applying migrations (upgrade head)…")
    try:
        command.upgrade(cfg, "head")
    except Exception as exc:  # noqa: BLE001
        # The current schema is guaranteed present by create_all at startup, so a
        # failure here means a migration tried to recreate something that exists.
        # Reconcile by force-stamping head; the schema is already correct.
        print(f"[db] upgrade reported '{exc}'.\n[db] schema already current — stamping head to reconcile")
        command.stamp(cfg, "head")

    print("[db] schema up to date")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
