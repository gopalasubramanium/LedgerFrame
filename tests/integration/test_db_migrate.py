"""The migration runner is safe for create_all-bootstrapped databases.

Reproduces the Pi failure ("table accounts already exists"): a DB created by
create_all() has no Alembic stamp (or an empty alembic_version table from a prior
failed upgrade), so a plain `alembic upgrade head` re-runs the initial migration.
``run_migrations`` must instead stamp + upgrade cleanly. Runs in-process (fast).
"""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text

import app.models  # noqa: F401 — register models on Base.metadata
from app.core.config import get_settings, reload_settings
from app.db.base import Base
from app.db.migrate import run_migrations


@pytest.fixture
def db_url(tmp_path, monkeypatch):
    """Point settings at an isolated temp database, restoring afterwards."""
    monkeypatch.setenv("LEDGERFRAME_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("LEDGERFRAME_SECRET_KEY", "x" * 32)
    reload_settings()
    url = get_settings().sync_db_url
    get_settings().db_path.parent.mkdir(parents=True, exist_ok=True)
    yield url
    reload_settings()  # restore the normal (test) settings for other tests


def _version(url: str) -> str | None:
    eng = create_engine(url)
    try:
        with eng.connect() as c:
            row = c.execute(text("SELECT version_num FROM alembic_version")).first()
            return row[0] if row else None
    finally:
        eng.dispose()


def _create_all(url: str):
    eng = create_engine(url)
    try:
        Base.metadata.create_all(eng)
    finally:
        eng.dispose()


def test_fresh_database(db_url):
    status = run_migrations(log=lambda *a: None)
    assert status in ("upgraded", "adopted")
    assert _version(db_url)  # stamped at head


def test_adopts_create_all_schema(db_url):
    _create_all(db_url)  # full schema, no alembic_version
    status = run_migrations(log=lambda *a: None)
    assert status == "adopted"
    assert _version(db_url)


def test_recovers_empty_alembic_version(db_url):
    # The Pi's exact broken state: full create_all schema + EMPTY alembic_version.
    _create_all(db_url)
    eng = create_engine(db_url)
    with eng.connect() as c:
        c.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        c.commit()
    eng.dispose()
    status = run_migrations(log=lambda *a: None)
    assert status in ("adopted", "reconciled")
    assert _version(db_url)


def test_idempotent_second_run(db_url):
    run_migrations(log=lambda *a: None)
    # Running again must be a clean no-op.
    run_migrations(log=lambda *a: None)
    assert _version(db_url)
