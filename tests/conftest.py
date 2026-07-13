# SPDX-License-Identifier: AGPL-3.0-or-later
"""Shared pytest fixtures. Each test gets an isolated temp data dir + fresh DB."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

# Point all data at a throwaway dir BEFORE app config is imported anywhere.
_TMP = Path(tempfile.mkdtemp(prefix="lf-test-"))
os.environ.setdefault("LEDGERFRAME_DATA_DIR", str(_TMP))
os.environ.setdefault("LEDGERFRAME_ENV", "development")
os.environ.setdefault("LEDGERFRAME_AI_ENABLED", "false")
os.environ.setdefault("LEDGERFRAME_SECRET_KEY", "test-secret-key-not-for-production-use")
# Force the deterministic mock provider for tests, so a developer's local `.env`
# (e.g. a real alphavantage/yahoo key) can't leak in and make the suite hit the
# network or flake. These take precedence over the .env file in pydantic.
os.environ["LEDGERFRAME_MARKET_PROVIDER"] = "mock"
os.environ.pop("LEDGERFRAME_MARKET_API_KEY", None)


@pytest.fixture(autouse=True)
def _isolate_env_file(tmp_path, monkeypatch):
    """Tests must NEVER touch the real repo `.env` (page-first-run-checklist §F-11).
    `apply_env()` (base_currency/timezone/provider writes) rewrites `envfile.ENV_PATH`;
    point it at a per-test temp file so the suite can't mutate the developer's dev config."""
    import app.core.envfile as envfile

    monkeypatch.setattr(envfile, "ENV_PATH", tmp_path / ".env")


@pytest.fixture(autouse=True)
async def _fresh_engine_per_test():
    """Dispose the async engine after each test. Required on Postgres (asyncpg connections are
    event-loop-bound and pytest-asyncio uses a fresh loop per test); harmless on SQLite."""
    yield
    from app.db.base import dispose_engine

    await dispose_engine()


@pytest.fixture
async def session():
    """A fresh in-isolation async session backed by a temp SQLite file."""
    from app.db.base import Base, get_engine, get_sessionmaker

    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    async with get_sessionmaker()() as s:
        yield s
        await s.rollback()


@pytest.fixture
async def app_client():
    """An httpx client wired to the ASGI app with lifespan (seeds demo data).

    Resets the database first so each test starts from a clean, freshly-seeded
    state with no PIN — preventing cross-test contamination from auth tests.
    """
    from httpx import ASGITransport, AsyncClient

    from app.core.config import reload_settings
    from app.db.base import Base, get_engine
    from app.main import create_app
    from app.providers.market import reset_provider
    from app.services import fx

    # Force the deterministic mock provider + demo mode for every app_client, even if
    # an earlier test switched the data source (the provider is a process singleton).
    # This keeps each test's demo seeding + provider behaviour isolated.
    os.environ["LEDGERFRAME_MARKET_PROVIDER"] = "mock"
    # The suite WANTS the seeded demo fixture, so it asks for it explicitly. It used to arrive as a
    # side-effect of `provider == mock` — the same accident that seeded a stranger's first boot
    # (RD-8 / Gate A4). Wanting it in tests is fine; getting it without asking was the bug.
    os.environ["LEDGERFRAME_DEMO_SEED"] = "true"
    os.environ.pop("LEDGERFRAME_MARKET_API_KEY", None)
    reload_settings()
    reset_provider()
    fx.clear_cache()

    # Reset in-process state so it can't bleed between tests.
    from app.core import metrics, ratelimit

    ratelimit.reset()
    metrics.reset()

    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        # Tests build the schema via create_all (§2.1); the app's boot migrations then adopt
        # it. drop_all doesn't drop alembic's version table, so create_all here also keeps the
        # app tables present for run_migrations to adopt on every test.
        await conn.run_sync(Base.metadata.create_all)

    app = create_app()
    async with app.router.lifespan_context(app), AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client
