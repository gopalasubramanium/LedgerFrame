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
    point it at a per-test temp file so the suite can't mutate the developer's dev config.

    R-54 F-10 Class C: `apply_env` ALSO does `os.environ.update(...)` (`envfile.py:63`, so an
    in-process reload takes effect) — and that mutation is NOT tracked by monkeypatch, so a test
    that set e.g. `base_currency` left `LEDGERFRAME_BASE_CURRENCY` resident in `os.environ` for the
    next test. Combined with the cached `Settings` (reset in `reset_process_globals`), a later
    `session`-only test then ran with a foreign base and a domestic book read as cross-currency.
    Snapshot `os.environ` here and restore it after the test so any direct mutation is undone."""
    import app.core.envfile as envfile

    monkeypatch.setattr(envfile, "ENV_PATH", tmp_path / ".env")
    _env_snapshot = dict(os.environ)
    yield
    for k in list(os.environ):
        if k not in _env_snapshot:
            del os.environ[k]
    for k, v in _env_snapshot.items():
        if os.environ.get(k) != v:
            os.environ[k] = v
    return


@pytest.fixture(autouse=True)
async def _fresh_engine_per_test():
    """Dispose the async engine after each test. Required on Postgres (asyncpg connections are
    event-loop-bound and pytest-asyncio uses a fresh loop per test); harmless on SQLite."""
    yield
    from app.db.base import dispose_engine

    await dispose_engine()


@pytest.fixture(autouse=True)
def _reset_process_globals():
    """R-54 F-10 Class B/C — reset in-process module globals at the SETUP of every test.

    The reset list is the census-derived registry in `tests/isolation.py` (the single source of truth
    the census guard also reads). Lifts the resets `app_client` already did — `reset_provider`,
    `fx.clear_cache`, `ratelimit.reset`, `metrics.reset` — and adds the ones it never covered
    (`ecb_fx.clear`, `grounding.reset_rate_limit`, `reset_ai_provider`, the backfill-task set, and the
    lru_cached `Settings`), so a `session`-only or unit test can no longer inherit a global another
    test left dirty. Runs BEFORE `_shared_db_clean_slate` so `reload_settings()` has restored the
    default `db_path` before that fixture resets the shared DB."""
    from tests.isolation import reset_process_globals

    reset_process_globals()
    yield


# One reusable SYNC engine for the per-test DB reset — created once, keyed by URL, so the
# per-test cost is the drop+create DDL only, not a fresh engine + WAL-pragma connect each time
# (which roughly doubled the suite). Keyed by URL so a config change rebuilds it correctly.
_RESET_ENGINE: dict[str, object] = {}


@pytest.fixture(autouse=True)
def _shared_db_clean_slate():
    """R-54 F-10 Class A + committed-data leak — give EVERY test a clean shared DB.

    The suite shares ONE SQLite file (`LEDGERFRAME_DATA_DIR`, set once above). Two order-dependences
    live here, both invisible in the ordered suite because a `session`/`app_client` test usually ran
    first and left the DB in the state the next test happened to need:
      * SCHEMA — unit tests read the DB transitively (e.g. `openai_compatible.health()` runs the
        egress-posture check `SELECT ... FROM settings WHERE key='privacy_mode'`) WITHOUT a
        schema-creating fixture, so scheduled first they hit `no such table: settings`; and
      * COMMITTED DATA — a test that `commit()`s to the shared DB (e.g. the no-egress backfill tests
        write `privacy_mode=true`) leaks that row, because the `session` fixture teardown only rolls
        back. A later non-fixture test then reads a stale toggle.
    A test that passes because an earlier test left the schema/data it needed is order-dependent even
    when nobody wrote it that way — the ordered green was execution-order luck, the same species as a
    seed-lucky corroboration.

    Fixed by drop+create-ing the shared DB before EVERY test — the robust choice: it resets away ANY
    prior test's committed leak, not only the ones that happened to use a fixture. Done on a REUSED
    sync engine (keyed by URL, `_RESET_ENGINE`) so the per-test cost is the drop+create DDL only
    (~3% of the suite), not a fresh engine + WAL-pragma connect each time; and sync, so there is no
    event-loop/global-async-engine coupling. Migration/db tests are UNAFFECTED: they repoint
    `LEDGERFRAME_DATA_DIR` at their own `tmp_path` in their body (after this autouse setup) and run
    Alembic there, so resetting the DEFAULT shared file is irrelevant to them. Fixture plumbing only;
    it changes no product behaviour."""
    from sqlalchemy import create_engine

    from app.core.config import get_settings
    from app.db.base import Base

    settings = get_settings()
    if settings.is_sqlite:
        settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    url = settings.sync_db_url
    engine = _RESET_ENGINE.get(url)
    if engine is None:
        engine = _RESET_ENGINE[url] = create_engine(url)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
async def session():
    """A fresh in-isolation async session backed by a temp SQLite file."""
    from app.db.base import Base, get_engine, get_sessionmaker

    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    async with get_sessionmaker()() as s:
        # THE ACCEPTANCE GATE (page-legal §11-5) again — this fixture's `drop_all` destroys the
        # acceptance `app_client` recorded, and a test that asks for BOTH fixtures would then be
        # served 451 by every data endpoint. Found exactly that way: three tests using both went
        # red on 451 and nothing else changed about them.
        #
        # Inserted DIRECTLY here, unlike in `app_client`, and the difference is not laziness:
        # there is no HTTP client in this fixture to post with. `app_client` deliberately goes
        # through the real endpoint so the accept path stays continuously smoke-tested; this one
        # only has to put the install into the state the other fixture already established.
        from app.models import LegalAcceptanceEvent
        from app.services.legal import content_hash

        s.add(LegalAcceptanceEvent(action="accepted", content_sha256=content_hash()))
        await s.commit()
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
        # THE ACCEPTANCE GATE IS ON (page-legal §11-5): every /api/v1 read refuses with 451 until
        # the Legal terms are accepted on this install. Accept once here so the ~1700 tests that
        # exist to exercise the PRODUCT are not all re-testing the gate.
        #
        # This is done through the REAL ENDPOINT rather than by inserting a row, deliberately. A
        # direct insert would let the gate and the acceptance path drift apart and every suite
        # would stay green while the endpoint was broken — the fixture would be testing a
        # database, not a product. Going through the API means this line is itself a continuous
        # smoke test of the accept flow.
        #
        # The gate's OWN tests (`tests/integration/test_legal_acceptance.py`) clear the log and
        # drive the unaccepted, stale and declined states explicitly. They must not rely on this.
        r = await client.post("/api/v1/legal/acceptance", json={"action": "accepted"})
        assert r.status_code == 200, f"test fixture could not accept the Legal terms: {r.text}"
        yield client
