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

    from app.db.base import Base, get_engine
    from app.main import create_app

    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    app = create_app()
    async with app.router.lifespan_context(app), AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client
