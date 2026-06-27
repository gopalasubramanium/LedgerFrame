#!/usr/bin/env python3
"""Bring the database schema up to date — safe for create_all-bootstrapped DBs.

LedgerFrame bootstraps fresh databases with ``Base.metadata.create_all()`` at
startup, so an existing database often already has the current schema but **no
Alembic version stamp**. A plain ``alembic upgrade head`` then tries to re-run the
initial migration and fails with "table accounts already exists".

This script resolves that deterministically:
  • no DB / no tables      → ``upgrade head`` (create everything via migrations)
  • tables but no stamp     → ``stamp`` the initial revision, then ``upgrade head``
                              (adopt the create_all schema, apply only newer steps)
  • already stamped         → ``upgrade head`` (normal path)

Migrations are written to be idempotent, so adopting a create_all schema and then
upgrading never double-applies a change. Exit code is always 0 on success.
"""

from __future__ import annotations

import sys
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

# Repo root = parent of this scripts/ dir.
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.config import get_settings  # noqa: E402

# The very first migration; everything else descends from it.
INITIAL_REVISION = "c8a035ade752"


def main() -> int:
    settings = get_settings()
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)

    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "app" / "db" / "migrations"))

    engine = create_engine(settings.sync_db_url)
    try:
        insp = inspect(engine)
        tables = set(insp.get_table_names())
    finally:
        engine.dispose()

    if tables and "alembic_version" not in tables:
        # DB was created by create_all() — adopt the baseline so upgrade applies
        # only the migrations layered on top of the initial schema.
        print(f"[db] adopting create_all schema → stamping {INITIAL_REVISION}")
        command.stamp(cfg, INITIAL_REVISION)

    print("[db] applying migrations (upgrade head)…")
    command.upgrade(cfg, "head")
    print("[db] schema up to date")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
