"""The migration runner is safe for create_all-bootstrapped databases.

Reproduces the Pi failure ("table accounts already exists"): a DB created by
create_all() has no Alembic stamp, so a plain `alembic upgrade head` re-runs the
initial migration. scripts/db_migrate.py must instead stamp + upgrade cleanly.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _env(data_dir: Path) -> dict:
    return {
        **os.environ,
        "LEDGERFRAME_DATA_DIR": str(data_dir),
        "LEDGERFRAME_SECRET_KEY": "x" * 32,
        "LEDGERFRAME_ENV": "development",
        "LEDGERFRAME_MARKET_PROVIDER": "mock",
    }


def _run(args: list[str], data_dir: Path) -> subprocess.CompletedProcess:
    return subprocess.run(args, env=_env(data_dir), capture_output=True, text=True, cwd=ROOT)


def test_db_migrate_fresh_database(tmp_path):
    r = _run([sys.executable, "scripts/db_migrate.py"], tmp_path)
    assert r.returncode == 0, r.stderr
    assert "schema up to date" in r.stdout


def test_db_migrate_adopts_create_all_schema(tmp_path):
    # Bootstrap the schema via create_all() — no alembic_version table.
    boot = _run([
        sys.executable, "-c",
        "from sqlalchemy import create_engine; import app.models; "
        "from app.db.base import Base; from app.core.config import get_settings; "
        "s=get_settings(); s.db_path.parent.mkdir(parents=True, exist_ok=True); "
        "e=create_engine(s.sync_db_url); Base.metadata.create_all(e)",
    ], tmp_path)
    assert boot.returncode == 0, boot.stderr

    # Must stamp + upgrade without "table already exists".
    r = _run([sys.executable, "scripts/db_migrate.py"], tmp_path)
    assert r.returncode == 0, r.stderr
    assert "stamping" in r.stdout
    assert "already exists" not in (r.stdout + r.stderr)


def test_db_migrate_recovers_empty_alembic_version(tmp_path):
    # The Pi's exact broken state: a prior failed `alembic upgrade head` left an
    # EMPTY alembic_version table alongside a full create_all schema.
    boot = _run([
        sys.executable, "-c",
        "from sqlalchemy import create_engine, text; import app.models; "
        "from app.db.base import Base; from app.core.config import get_settings; "
        "s=get_settings(); s.db_path.parent.mkdir(parents=True, exist_ok=True); "
        "e=create_engine(s.sync_db_url); Base.metadata.create_all(e); "
        "c=e.connect(); c.execute(text('CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)')); c.commit()",
    ], tmp_path)
    assert boot.returncode == 0, boot.stderr

    r = _run([sys.executable, "scripts/db_migrate.py"], tmp_path)
    assert r.returncode == 0, r.stderr
    assert "stamping baseline" in r.stdout
    assert "schema up to date" in r.stdout
