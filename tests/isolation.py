# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-54 F-10 — the process-global reset registry + the autouse reset action.

ONE declaration, consumed by BOTH:
  * the autouse `_reset_process_globals` fixture (conftest) — resets these BETWEEN tests, so a
    `session`-only or unit test never inherits a global another test left dirty; and
  * the census guard (`tests/unit/test_module_state_census.py`) — AST-sweeps `app/` for
    module-level mutable state and asserts every RUNTIME-MUTATED global is declared here.

A new module-level mutable global that is written at runtime and NOT registered here turns the
census guard RED — the test-isolation debt class F-10 fixed can never silently regrow (ruled shape
2e). The reset list is therefore an ENUMERATION derived from the sweep, not from memory.

Background (F-10, 2026-07-23): the randomized verdict, once restored, exposed two vector classes —
Class B (fx/ecb caches reset only in `app_client` leaked to `session`-only cost-FX tests) and
Class A (unit tests reading `settings.privacy_mode` via the shared DB before any schema fixture
ran). Class A is the schema baseline (conftest); Class B is this registry.
"""

from __future__ import annotations

# Fully-qualified `module.attr` -> how it is reset. Keys must exactly match what the census guard
# derives from the AST sweep (a `__init__.py` module resolves to its package path).
RESET_REGISTRY: dict[str, str] = {
    "app.services.fx._CACHE": "fx.clear_cache()",
    "app.services.ecb_fx._RATES": "ecb_fx.clear()",
    "app.services.ecb_fx._ASOF": "ecb_fx.clear()",
    "app.core.ratelimit._STATE": "ratelimit.reset()",
    "app.core.metrics._dur_count": "metrics.reset()",
    "app.core.metrics._dur_sum": "metrics.reset()",
    "app.core.metrics._req_total": "metrics.reset()",
    "app.core.metrics._worker_jobs": "metrics.reset()",
    "app.ai.grounding._request_times": "grounding.reset_rate_limit()",
    "app.api.v1.routes.portfolio._backfill_tasks": "cleared (self-discarding asyncio task refs)",
    "app.db.base._engine": "dispose_engine() via the _fresh_engine_per_test autouse fixture",
    "app.db.base._sessionmaker": "dispose_engine() via the _fresh_engine_per_test autouse fixture",
    "app.providers.market._PROVIDER": "reset_provider()",
    "app.providers.ai._PROVIDER": "reset_ai_provider()",
    # lru_cache-backed process state (NOT a module-level assignment, so the AST sweep also walks
    # @lru_cache/@cache decorators — found because it broke a domestic-book test: a prior test set
    # base_currency via PUT /settings, the cached Settings leaked a non-SGD base to a `session`-only
    # test, and its SGD lots read as foreign → spurious cost-FX flags. R-54 F-10 Class C.
    "app.core.config.get_settings": "reload_settings() (get_settings.cache_clear())",
}


def reset_process_globals() -> None:
    """Reset every registered process global except the DB engine (its own autouse fixture owns it).

    Called at the SETUP of every test so each test starts from clean in-process state regardless of
    what ran before it. Mirrors the resets `app_client` already did — lifted so `session`-only and
    unit tests get them too, which is exactly the gap F-10 Class B was."""
    from app.ai import grounding
    from app.api.v1.routes import portfolio
    from app.core import metrics, ratelimit
    from app.core.config import reload_settings
    from app.providers.ai import reset_ai_provider
    from app.providers.market import reset_provider
    from app.services import ecb_fx, fx

    # FIRST — clear the lru_cached Settings (Class C): a leaked base_currency turns a later test's
    # domestic book foreign. Re-reads the (isolated, empty) env → defaults, which _isolate_env_file
    # has already pointed at a temp .env by the time this autouse runs.
    reload_settings()
    fx.clear_cache()
    ecb_fx.clear()
    ratelimit.reset()
    metrics.reset()
    grounding.reset_rate_limit()
    portfolio._backfill_tasks.clear()  # self-discarding task refs; drop any left by a prior test
    reset_provider()
    reset_ai_provider()
    # _engine / _sessionmaker are reset by _fresh_engine_per_test (teardown) — declared in the
    # registry, deliberately not reset here to avoid disposing an engine a fixture is mid-setup on.
