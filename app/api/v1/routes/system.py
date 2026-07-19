# SPDX-License-Identifier: AGPL-3.0-or-later
"""System status, health, AI status, and scoped admin controls."""

from __future__ import annotations

import asyncio
import os
import shutil

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app import __version__
from app.api.deps import PinConfirm, get_db, pin_is_set, require_auth, require_pin, verify_fresh_pin
from app.core.config import get_settings
from app.core.egress import egress_client
from app.providers.ai import get_ai_provider

router = APIRouter()

# Allow-list of admin actions the Settings page may trigger via the root helper.
# Maps action -> allowed argument values (None = no argument).
_ADMIN_ACTIONS: dict[str, set[str] | None] = {
    "status": None,
    "restart": None,
    "restart-worker": None,
    "doctor": None,
    "backup": None,
    "lan": {"on", "off"},
    "voice": {"on", "off"},
    "ai": {"on", "off"},
    "kiosk": {"on", "off"},
    "update": None,
}
_GITHUB_REPO = "gopalasubramanium/LedgerFrame"
_ADMIN_BIN = "/usr/local/sbin/ledgerframe-admin"


@router.get("/system/status")
async def system_status(session: AsyncSession = Depends(get_db)) -> dict:
    settings = get_settings()
    db_ok = True
    try:
        await session.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        db_ok = False
    data_writable = os.access(settings.data_dir, os.W_OK) if settings.data_dir.exists() else False
    return {
        "version": __version__,
        "env": settings.env,
        "demo_mode": settings.is_demo,
        "market_provider": settings.market_provider,
        "base_currency": settings.base_currency,
        "timezone": settings.timezone,
        "ai_enabled": settings.ai_enabled,
        "voice_enabled": settings.voice_enabled,
        "allow_lan": settings.allow_lan,
        "pin_set": await pin_is_set(session),
        "db_ok": db_ok,
        "data_dir": str(settings.data_dir),
        "data_writable": data_writable,
        "stale_after_seconds": settings.stale_after_seconds,
    }


@router.get("/ai/status")
async def ai_status() -> dict:
    provider = get_ai_provider()
    health = await provider.health()
    return health.model_dump()


# Market-data providers the UI may select. mock/csv/yahoo need no key.
_MARKET_PROVIDERS = {"mock", "csv", "alphavantage", "yahoo", "eodhd", "kite"}


@router.get("/system/providers")
async def get_providers() -> dict:
    """Provider capability metadata + the default source-priority policy (read-only).

    Foundation for the Settings → Data Sources view. Contains NO secrets — only what
    each provider can do and the ordered priority lanes routing will consult."""
    from dataclasses import asdict

    from app.providers.market import get_provider
    from app.providers.market.router import CAPABILITIES, DEFAULT_PRIORITY

    def _cap(c) -> dict:
        d = asdict(c)
        d["asset_classes"] = sorted(c.asset_classes)
        d["regions"] = sorted(c.regions)
        return d

    return {
        "active": getattr(get_provider(), "name", "unknown"),
        "capabilities": {name: _cap(c) for name, c in CAPABILITIES.items()},
        "default_priority": DEFAULT_PRIORITY,
    }


@router.get("/system/identifier-duplicates")
async def identifier_duplicates(session: AsyncSession = Depends(get_db)) -> dict:
    """Ambiguous identifier mappings (one id → several instruments). A data-quality
    report the user resolves — LedgerFrame never guesses which mapping is correct."""
    from app.services.identity import duplicate_identifiers

    dups = await duplicate_identifiers(session)
    return {"duplicates": dups, "count": len(dups)}


@router.get("/system/data-source")
async def get_data_source() -> dict:
    from app.core.envfile import read_env

    env = read_env()
    settings = get_settings()
    provider = env.get("LEDGERFRAME_MARKET_PROVIDER", settings.market_provider)

    # Capabilities: does the *live* provider give real index levels? Alpha Vantage
    # only does on a premium (Index Data) plan — we learn the tier from the key by
    # probing one index, then cache it on the provider for the process lifetime.
    supports_indices = False
    av_tier: str | None = None
    if provider != "mock" and bool(env.get("LEDGERFRAME_MARKET_API_KEY", settings.market_api_key)):
        try:
            from app.providers.market import get_provider

            prov = get_provider()
            if provider == "alphavantage" and getattr(prov, "_index_entitled", "n/a") is None:
                await prov.get_quote("DJI")  # one probe; sets the learned tier
            supports_indices = bool(getattr(prov, "supports_indices", False))
            av_tier = getattr(prov, "av_tier", None)
        except Exception:  # noqa: BLE001 — capabilities are best-effort, never fatal
            pass

    return {
        "provider": provider,
        "has_api_key": bool(env.get("LEDGERFRAME_MARKET_API_KEY", settings.market_api_key)),
        "base_currency": env.get("LEDGERFRAME_BASE_CURRENCY", settings.base_currency),
        "stale_after_seconds": env.get("LEDGERFRAME_STALE_AFTER_SECONDS", str(settings.stale_after_seconds)),
        "providers": sorted(_MARKET_PROVIDERS),
        "supports_indices": supports_indices,
        "av_tier": av_tier,  # "premium" | "free" | "unknown" | null (non-AV)
        "restart_required": True,
        "admin_available": os.path.exists(_ADMIN_BIN),
    }


class DataSourceIn(BaseModel):
    # Partial update: every field is optional; only what's sent is applied. `provider`
    # was once required, which 422'd the Save-key control (it posts {api_key} only) —
    # data-feed-routing §14dr-1. Omitting `provider` leaves the persisted provider as-is.
    provider: str | None = None
    api_key: str | None = None  # write-only; never returned
    base_currency: str | None = None
    stale_after_seconds: int | None = None


@router.put("/system/data-source", dependencies=[Depends(require_auth)])
async def set_data_source(payload: DataSourceIn) -> dict:
    from app.core.envfile import apply_env

    updates: dict[str, str] = {}
    if payload.provider is not None:
        if payload.provider not in _MARKET_PROVIDERS:
            raise HTTPException(400, f"unknown provider; choose one of {sorted(_MARKET_PROVIDERS)}")
        updates["LEDGERFRAME_MARKET_PROVIDER"] = payload.provider
    if payload.api_key is not None:
        updates["LEDGERFRAME_MARKET_API_KEY"] = payload.api_key.strip()
    if payload.base_currency:
        updates["LEDGERFRAME_BASE_CURRENCY"] = payload.base_currency.upper()
    if payload.stale_after_seconds:
        updates["LEDGERFRAME_STALE_AFTER_SECONDS"] = str(payload.stale_after_seconds)
    apply_env(updates)
    # Apply immediately in this process (no restart needed): re-read .env and reset
    # provider/FX caches. Restart only the WORKER (never the API — that would drop
    # this response) so its background refreshes use the new provider too.
    from app.core.config import reload_settings
    from app.core.service_control import restart_worker
    from app.services import fx

    reload_settings()
    fx.clear_cache()
    await restart_worker()
    note = (
        f"Applied — now using '{payload.provider}'." if payload.provider else "Saved."
    )
    return {"ok": True, "applied": True, "note": note}


# --- R-38: provider routing matrix (data-feed-routing §9-RESOLVED) --------------
# A user-declared refinement layer: one provider per asset-class × listing-country.
# Empty by default (an empty matrix changes nothing — routing falls through to the
# lane chain / active provider). Capability-validated at edit-time here; re-validated
# at resolve-time in route(). Writes are require_auth (the source_override precedent).


@router.get("/system/routing-matrix")
async def get_routing_matrix(session: AsyncSession = Depends(get_db)) -> dict:
    """List all matrix cells with served display state (degraded/caveat flags) for the
    Settings → Data feeds editor. Read-only; no secrets."""
    from app.models import RoutingMatrix
    from app.services.market import matrix_cell_state

    rows = (await session.execute(
        select(RoutingMatrix).order_by(RoutingMatrix.asset_class, RoutingMatrix.listing_country)
    )).scalars().all()
    return {"cells": [
        matrix_cell_state(r.asset_class, r.listing_country, r.provider, updated_at=r.updated_at)
        for r in rows
    ]}


class RoutingCellIn(BaseModel):
    asset_class: str
    listing_country: str  # ISO-3166 alpha-2 or "*"
    provider: str


@router.put("/system/routing-matrix", dependencies=[Depends(require_auth)])
async def put_routing_cell(payload: RoutingCellIn, session: AsyncSession = Depends(get_db)) -> dict:
    """Upsert one cell (class × country → provider). Edit-time validated (§9-3): an
    honest 400 on an unknown source or a capability mismatch; a capable-but-unkeyed
    provider is ACCEPTED with a degraded caveat (§9-7)."""
    from app.models import AssetClass, RoutingMatrix
    from app.services.market import matrix_cell_state, validate_matrix_provider

    ac = payload.asset_class.strip().lower()
    country = payload.listing_country.strip().upper()
    if ac not in {c.value for c in AssetClass}:
        raise HTTPException(400, f"unknown asset class '{payload.asset_class}'")
    if country != "*" and not (len(country) == 2 and country.isalpha()):
        raise HTTPException(
            400, f"listing country must be an ISO-3166 alpha-2 code or '*' (got '{payload.listing_country}')")

    norm, error, _degraded, _caveat = validate_matrix_provider(ac, country, payload.provider)
    if error:
        raise HTTPException(400, error)

    row = (await session.execute(
        select(RoutingMatrix).where(
            RoutingMatrix.asset_class == ac, RoutingMatrix.listing_country == country)
    )).scalars().first()
    if row is None:
        row = RoutingMatrix(asset_class=ac, listing_country=country, provider=norm)
        session.add(row)
    else:
        row.provider = norm
    await session.flush()
    return {"ok": True, "cell": matrix_cell_state(ac, country, norm, updated_at=row.updated_at)}


@router.delete("/system/routing-matrix/{asset_class}/{listing_country}",
               dependencies=[Depends(require_auth)])
async def delete_routing_cell(
    asset_class: str, listing_country: str, session: AsyncSession = Depends(get_db),
) -> dict:
    """Clear a cell → routing falls back to the lane chain / active provider (§9-2).
    Idempotent: a missing cell is a clean no-op (``deleted: false``)."""
    from sqlalchemy import delete as sa_delete

    from app.models import RoutingMatrix

    ac = asset_class.strip().lower()
    country = listing_country.strip().upper()
    res = await session.execute(
        sa_delete(RoutingMatrix).where(
            RoutingMatrix.asset_class == ac, RoutingMatrix.listing_country == country))
    return {"ok": True, "deleted": (res.rowcount or 0) > 0,
            "asset_class": ac, "listing_country": country}


# Env-backed app config the Settings page may edit (key -> env var).
_CONFIG_KEYS = {
    "timezone": "LEDGERFRAME_TIMEZONE",
    "api_port": "LEDGERFRAME_API_PORT",
    "stale_after_seconds": "LEDGERFRAME_STALE_AFTER_SECONDS",
    "autolock_minutes": "LEDGERFRAME_AUTOLOCK_MINUTES",
    "rotation_default_seconds": "LEDGERFRAME_ROTATION_DEFAULT_SECONDS",
    "data_dir": "LEDGERFRAME_DATA_DIR",
    "backup_keep": "LEDGERFRAME_BACKUP_KEEP",
    "backup_age_recipient": "LEDGERFRAME_BACKUP_AGE_RECIPIENT",
    "kiosk_url": "LEDGERFRAME_KIOSK_URL",
}


@router.get("/system/config")
async def get_config() -> dict:
    from app.core.envfile import read_env

    env = read_env()
    s = get_settings()
    return {
        "timezone": env.get("LEDGERFRAME_TIMEZONE", s.timezone),
        "api_port": env.get("LEDGERFRAME_API_PORT", str(s.api_port)),
        "stale_after_seconds": env.get("LEDGERFRAME_STALE_AFTER_SECONDS", str(s.stale_after_seconds)),
        "autolock_minutes": env.get("LEDGERFRAME_AUTOLOCK_MINUTES", str(s.autolock_minutes)),
        "rotation_default_seconds": env.get("LEDGERFRAME_ROTATION_DEFAULT_SECONDS", str(s.rotation_default_seconds)),
        "data_dir": env.get("LEDGERFRAME_DATA_DIR", str(s.data_dir)),
        "backup_keep": env.get("LEDGERFRAME_BACKUP_KEEP", str(s.backup_keep)),
        "backup_age_recipient": env.get("LEDGERFRAME_BACKUP_AGE_RECIPIENT", s.backup_age_recipient),
        "kiosk_url": env.get("LEDGERFRAME_KIOSK_URL", s.kiosk_url),
    }


class ConfigIn(BaseModel):
    values: dict[str, str]


@router.put("/system/config", dependencies=[Depends(require_auth)])
async def set_config(payload: ConfigIn) -> dict:
    from app.core.config import reload_settings
    from app.core.envfile import apply_env

    updates, restart_needed = {}, []
    for key, value in payload.values.items():
        env_key = _CONFIG_KEYS.get(key)
        if not env_key:
            continue
        updates[env_key] = value.strip()
        if key in ("data_dir", "backup_keep", "rotation_default_seconds", "api_port"):
            restart_needed.append(key)
    if not updates:
        raise HTTPException(400, "no recognised config keys")
    apply_env(updates)
    reload_settings()
    note = "Saved."
    if "data_dir" in payload.values:
        note = ("Saved. The data folder change takes effect after a restart — your "
                "existing data is NOT moved automatically; move it first, then restart.")
    elif restart_needed:
        note = "Saved — restart services to fully apply."
    return {"ok": True, "note": note}


_AI_PROVIDERS = {"hailo", "openai_compatible", "disabled"}


@router.get("/system/ai-config")
async def get_ai_config() -> dict:
    from app.core.envfile import read_env

    env = read_env()
    s = get_settings()
    return {
        "enabled": env.get("LEDGERFRAME_AI_ENABLED", str(s.ai_enabled)).lower() in ("1", "true", "yes"),
        "provider": env.get("LEDGERFRAME_AI_PROVIDER", s.ai_provider),
        "hailo_base_url": env.get("LEDGERFRAME_HAILO_BASE_URL", s.hailo_base_url),
        "model": env.get("LEDGERFRAME_AI_MODEL", s.ai_model),
        "openai_base_url": env.get("LEDGERFRAME_OPENAI_BASE_URL", s.openai_base_url),
        "has_openai_key": bool(env.get("LEDGERFRAME_OPENAI_API_KEY", s.openai_api_key)),
        "providers": sorted(_AI_PROVIDERS),
    }


class AIConfigIn(BaseModel):
    enabled: bool = True
    provider: str
    hailo_base_url: str | None = None
    model: str | None = None
    openai_base_url: str | None = None
    openai_api_key: str | None = None  # write-only


@router.put("/system/ai-config", dependencies=[Depends(require_auth)])
async def set_ai_config(payload: AIConfigIn) -> dict:
    from app.core.config import reload_settings
    from app.core.envfile import apply_env

    if payload.provider not in _AI_PROVIDERS:
        raise HTTPException(400, f"unknown AI provider; choose one of {sorted(_AI_PROVIDERS)}")
    updates = {
        "LEDGERFRAME_AI_ENABLED": "true" if payload.enabled else "false",
        "LEDGERFRAME_AI_PROVIDER": payload.provider,
    }
    if payload.hailo_base_url is not None:
        updates["LEDGERFRAME_HAILO_BASE_URL"] = payload.hailo_base_url.strip()
    if payload.model is not None:
        updates["LEDGERFRAME_AI_MODEL"] = payload.model.strip()
    if payload.openai_base_url is not None:
        updates["LEDGERFRAME_OPENAI_BASE_URL"] = payload.openai_base_url.strip()
    if payload.openai_api_key is not None:
        updates["LEDGERFRAME_OPENAI_API_KEY"] = payload.openai_api_key.strip()
    apply_env(updates)
    reload_settings()
    # Report whether the new config can reach a model (tests the NEW provider now
    # that os.environ is updated), then restart the worker so its briefings use it.
    health = await get_ai_provider().health()
    from app.core.service_control import restart_worker

    await restart_worker()
    return {"ok": True, "available": health.available, "detail": health.detail}


# §14dr-26 — tables "Erase all data" PRESERVES. Everything else in Base.metadata is
# user data and is purged; a NEW table is purged by default (the safe direction — the
# owner's erase-and-rebuild walk found insurance/estate rows surviving because the old
# hardcoded delete list predated those milestones). Each exclusion is spec-grounded:
#   settings/PIN/access — D-103 docstring "Keeps your settings, PIN"; users holds the
#     PIN hash; api_token/revoked_token are the access-credential + session-revocation
#     bookkeeping (SECURITY-BASELINE §1.7/§2.4), not portfolio data.
#   security/backup bookkeeping — audit_events is the tamper-evident hash-chained log
#     (the erase itself is a recorded action; wiping it would destroy that record);
#     backup_records is backup metadata.
#   provider reference caches — amfi_schemes/coingecko_coins/ecb_fx_rates/kite_instruments
#     are opt-in, re-syncable public master/reference data (their model docstrings), not
#     the user's holdings; routing_matrix is the user's provider-routing preference,
#     which D-103 preserves as "provider config".
# (alembic_version is preserved automatically — it is not a mapped model, so it never
# appears in the Base.metadata purge walk.)
#
# LEGAL CONSENT IS *NOT* KEPT, AND THAT ABSENCE IS RULED, NOT OVERLOOKED (page-legal §11-D3,
# architect under delegation, 2026-07-20). `legal_acceptance_events` is named here precisely
# because §14dr-26's premise is that every table's fate is triaged — "absent from the keep list"
# and "nobody thought about it" are indistinguishable by inspection, and this comment is the
# difference.
#
# It was briefly KEPT, on a defensible argument: acceptance is install-level, it sits in the same
# family as the PIN this list preserves, and "clear my holdings" is not obviously a request to
# withdraw consent. The ruling INVERTED that. The gate binds the PERSON using the install, not the
# machine; a reset returns the install to first-run posture, and the commonest reason to press it
# is to hand the install to somebody else. A surviving acceptance would then be the PREVIOUS
# user's, and the app would treat a new person as having read and accepted a document they have
# never seen — a FALSE RECORD OF CONSENT, which is the one thing this table must never hold.
#
# The two failure modes are not symmetric, which is what decided it: keeping the record fails by
# attributing an agreement to someone who never gave it; erasing it fails by asking a returning
# user to press Accept again. Only one of those is a lie.
#
# THE ERASURE IS STATED IN THE CONFIRMATION COPY (Settings.tsx `ResetDataControl`), and that is a
# CONDITION of the ruling rather than a courtesy — an unannounced erase is a silent re-lock, which
# is what the preceding decision refused. Pinned from both ends:
#   * `test_a_data_reset_ERASES_acceptance_and_the_gate_RE_FIRES` (test_legal_acceptance.py)
#   * `test_the_reset_confirmation_copy_STATES_the_erasure`       (test_reset_data.py)
# ⚑ REVERSIBLE — a delegated ruling, carried to the owner at the re-look.
RESET_KEEP_TABLES: frozenset[str] = frozenset({
    "settings", "users", "api_token", "revoked_token",
    "audit_events", "backup_records",
    "amfi_schemes", "coingecko_coins", "ecb_fx_rates", "kite_instruments",
    "routing_matrix",
})


@router.post("/system/reset-data", dependencies=[Depends(require_pin)])
async def reset_data(body: PinConfirm, session: AsyncSession = Depends(get_db)) -> dict:
    """Delete all demo/portfolio/market data so you can start fresh with live data.

    D-103 — a destructive, irreversible action: gated by ``require_pin`` (off API tokens /
    unprotected installs) AND a FRESH PIN (§14dr-20, the purge-deleted precedent) — an
    ambient/unlocked session never satisfies it, so wiping the ledger requires deliberate
    re-entry, not ambient authority (SECURITY-BASELINE §3). The Settings control pairs it
    with the danger Button variant + a ConfirmDialog fresh-PIN gesture.

    Removes EVERY user-data table — portfolio (holdings/transactions/instruments/quotes/
    history/snapshots), planning (goals/obligations/contributions/investment policy),
    protection (insurance), estate, tags, watchlists, entities, news — deriving the set
    from live metadata minus :data:`RESET_KEEP_TABLES` (§14dr-26) so a table added by a
    future milestone can never silently survive an erase. Keeps your settings, PIN, and
    provider config. Sets a flag so demo data is NOT re-seeded afterwards.

    ALSO ERASES YOUR ACCEPTANCE OF THE LEGAL TERMS (page-legal §11-D3), which re-locks the app
    behind the acceptance gate — the install is returned to first-run posture, terms included,
    because a reset commonly means handing the install to someone else and the next person must
    be asked for themselves. Stated in the confirmation copy; see :data:`RESET_KEEP_TABLES`.
    """
    await verify_fresh_pin(session, body.pin)
    from app.db.base import Base
    from app.models import Setting
    from app.seed.demo import SEED_FLAG_KEY

    # sorted_tables is FK-dependency order (parents before children); reverse it to delete
    # children first and satisfy every foreign key without a hand-maintained order.
    for table in reversed(Base.metadata.sorted_tables):
        if table.name in RESET_KEEP_TABLES:
            continue
        await session.execute(table.delete())
    # Prevent demo re-seeding on the next boot.
    flag = (await session.execute(select(Setting).where(Setting.key == SEED_FLAG_KEY))).scalars().first()
    if flag:
        flag.value = "1"
    else:
        session.add(Setting(key=SEED_FLAG_KEY, value="1"))
    await session.flush()
    return {"ok": True, "note": "All portfolio & market data cleared. Add your holdings to begin."}


async def _display_symbols(session: AsyncSession) -> list[str]:
    """All symbols shown across the app: holdings + watchlist + the curated market
    lists (overview, global proxies).

    page-home §9-4: the retired `/dashboard/home` owned a curated "home tiles" list
    (`_HOME_MARKETS = SPY, QQQ, GLD, BTC`) that also fed this warm-list. Home no longer has curated
    tiles (its quote cards read holdings/overview/global/watchlist), and those four symbols are a
    strict SUBSET of `_DEFAULT_OVERVIEW` — so dropping the list shrinks NO refresh coverage
    (pinned by `test_refresh_coverage_did_not_shrink_when_the_home_tiles_list_died`).
    """
    from app.api.v1.routes.markets import _DEFAULT_OVERVIEW, global_market_symbols
    from app.models import Holding, Instrument, WatchlistItem

    ids = {
        *(await session.execute(select(Holding.instrument_id)  # §3.5 R12: skip soft-deleted holdings
                                .where(Holding.instrument_id.isnot(None)).where(Holding.deleted_at.is_(None)))).scalars().all(),
        *(await session.execute(select(WatchlistItem.instrument_id))).scalars().all(),
    }
    instr_syms = (
        await session.execute(select(Instrument.symbol).where(Instrument.id.in_(ids or [-1])))
    ).scalars().all()
    ordered: list[str] = []
    for sym in [*instr_syms, *_DEFAULT_OVERVIEW, *global_market_symbols()]:
        if sym not in ordered:
            ordered.append(sym)
    return ordered


@router.get("/system/staleness")
async def staleness(session: AsyncSession = Depends(get_db)) -> dict:
    """Cheap, read-only staleness signal for the one-click refresh prompt. No fetching,
    no mutation — just counts held market-priced holdings whose cached quote is older
    than the stale threshold (using the canonical ``is_stale``). ``refreshable`` is only
    true when a provider that fetches on demand is active, so we never suggest a refresh
    that can't help."""
    from app.services.portfolio import value_portfolio

    base = get_settings().base_currency
    val = await value_portfolio(session, base)
    stale = [h for h in val.holdings if h.is_stale and h.symbol]
    # A refresh can only help if the active provider fetches quotes (csv is offline-only).
    provider_can_fetch = get_settings().market_provider != "csv"
    return {
        "stale": len(stale) > 0,
        "count": len(stale),
        "refreshable": bool(stale) and provider_can_fetch,
    }


@router.post("/system/refresh-data", dependencies=[Depends(require_auth)])
async def refresh_data(session: AsyncSession = Depends(get_db)) -> dict:
    """Force-refresh quotes for everything shown (holdings, watchlist, market &
    global tiles) from the current provider. Reports exactly what updated/failed."""
    import time

    from app.services.market import backfill_instrument_name, refresh_quote_detailed

    provider = get_settings().market_provider
    symbols = await _display_symbols(session)
    # Bulletproof timing: an overall budget AND a hard per-symbol timeout, so a single
    # hung/rate-limited provider call can never make the whole refresh "time out". A
    # per-symbol timeout cancels only that symbol; we commit successful symbols as we go
    # and roll back a cancelled one, so the session stays healthy and prior work isn't lost.
    budget_s = 40.0
    per_symbol_s = 8.0
    start = time.monotonic()
    # §18-R2 (F-7b) — the report is PER-INSTRUMENT HONEST. `refreshed` counts symbols this pass
    # actually FETCHED (``outcome == "fetched"``), never a cache read that merely happened to
    # carry a price. Everything not fetched lands in `failed` with its own reason, so the
    # count can no longer read "N of N" while quotes it covers stay stale.
    refreshed, succeeded, failed, skipped = 0, [], [], 0
    stale_after: list[str] = []
    for sym in symbols:
        if time.monotonic() - start > budget_s:
            skipped += 1
            continue
        try:
            r = await asyncio.wait_for(refresh_quote_detailed(session, sym), timeout=per_symbol_s)
            await backfill_instrument_name(session, sym)
            await session.commit()                      # persist per symbol; isolates failures
            if r.fetched:
                refreshed += 1
                succeeded.append(sym)
            else:
                failed.append({"symbol": sym, "reason": r.reason or f"not refreshed from {provider}"})
            if r.quote.is_stale or r.quote.price is None:
                stale_after.append(sym)
        except (TimeoutError, Exception) as exc:  # noqa: BLE001
            await session.rollback()                    # discard the in-flight symbol only
            reason = "timed out" if isinstance(exc, TimeoutError) else str(exc)[:160]
            failed.append({"symbol": sym, "reason": reason})
            stale_after.append(sym)
    if skipped:
        failed.append({"symbol": f"+{skipped} more", "reason": "skipped — refresh time budget reached; try again"})
    return {
        "ok": True, "refreshed": refreshed, "total": len(symbols), "skipped": skipped,
        "succeeded": succeeded, "failed": failed,
        # The honesty pin: symbols still stale AFTER this pass. A caller rendering
        # "Refreshed N of M" must not imply everything is current while this is non-empty.
        "still_stale": stale_after,
        "errors": [f"{f['symbol']}: {f['reason']}" for f in failed],
    }


@router.post("/system/fetch-history", dependencies=[Depends(require_auth)])
async def fetch_history(days: int = 365, session: AsyncSession = Depends(get_db)) -> dict:
    """Fetch & cache daily price history for everything shown — but only where it
    isn't already cached/fresh (get_history_cached skips fresh symbols). Used to
    backfill history for newly-added holdings without re-spending API quota."""
    from datetime import UTC, datetime, timedelta

    from app.services.market import get_history_cached

    end = datetime.now(UTC)
    start = end - timedelta(days=max(30, min(days, 3650)))
    symbols = await _display_symbols(session)
    fetched: list[str] = []
    empty: list[str] = []
    for sym in symbols:
        try:
            candles = await get_history_cached(session, sym, "1d", start, end)
            (fetched if candles else empty).append(sym)
        except Exception:  # noqa: BLE001
            empty.append(sym)
    return {"ok": True, "with_history": fetched, "no_history": empty, "total": len(symbols)}


def _parse_ver(tag: str) -> tuple:
    nums = "".join(ch if (ch.isdigit() or ch == ".") else " " for ch in tag.lstrip("vV")).split(".")
    try:
        return tuple(int(x) for x in nums[:3] if x.strip())
    except ValueError:
        return (0,)


async def _no_egress_enabled(session: AsyncSession) -> bool:
    """True when the no-egress toggle (``privacy_mode``) is on. Under no-egress the
    device must make ZERO outbound network calls — version check included
    (SECURITY-BASELINE §7, Product Commitment 5, D-075/D-060)."""
    from app.models import Setting

    row = (
        await session.execute(select(Setting).where(Setting.key == "privacy_mode"))
    ).scalars().first()
    return bool(row and str(row.value).strip().lower() in ("1", "true", "yes", "on"))


@router.get("/system/version-check")
async def version_check(session: AsyncSession = Depends(get_db)) -> dict:
    """Compare the running version to the latest GitHub release. Best-effort; never
    fails the call (offline → update_available False).

    No-egress (D-075/§7): when the no-egress toggle is on, make ZERO outbound calls
    and report "up to date" honestly — the UpdateBanner then simply hides."""
    current = __version__

    if await _no_egress_enabled(session):
        # Zero outbound: never construct the HTTP client. Same response shape.
        return {"current": current, "latest": current, "update_available": False, "url": ""}


    latest = current
    available = False
    url = f"https://github.com/{_GITHUB_REPO}/releases/latest"
    try:
        async with await egress_client("outbound call", timeout=6, follow_redirects=False) as client:
            # Primary: the /releases/latest redirect carries the tag in its Location
            # header and is NOT subject to the strict (60/hr) unauthenticated API
            # rate limit — so a shared/NATed IP can't yield a false "up to date".
            tag = ""
            try:
                rr = await client.get(url)
                loc = rr.headers.get("location", "")
                if "/tag/" in loc:
                    tag = loc.rsplit("/tag/", 1)[1]
                    url = loc
            except Exception:  # noqa: BLE001
                pass
            # Fallback: the JSON API (covers cases where the redirect is unavailable).
            if not tag:
                r = await client.get(
                    f"https://api.github.com/repos/{_GITHUB_REPO}/releases/latest",
                    headers={"Accept": "application/vnd.github+json"},
                )
                if r.status_code == 200:
                    tag = r.json().get("tag_name", "")
                    url = r.json().get("html_url", url)
            if tag:
                latest = tag.lstrip("vV")
                available = _parse_ver(latest) > _parse_ver(current)
    except Exception:  # noqa: BLE001
        pass
    return {"current": current, "latest": latest, "update_available": available, "url": url}


@router.get("/system/update-status")
async def update_status() -> dict:
    """Progress of a backgrounded one-click update.

    The update runs detached (it restarts this very API), writing progress to
    ``<data>/logs/update.{log,status}``. The UI polls this so it can show live
    progress, reload when the new version is live, and surface failures instead
    of hanging silently.
    """
    log_dir = get_settings().logs_dir
    status_text = ""
    log_tail = ""
    try:
        sf = log_dir / "update.status"
        if sf.exists():
            status_text = sf.read_text(errors="replace").strip()
    except Exception:  # noqa: BLE001
        pass
    try:
        lf = log_dir / "update.log"
        if lf.exists():
            log_tail = "\n".join(lf.read_text(errors="replace").splitlines()[-40:])
    except Exception:  # noqa: BLE001
        pass
    return {
        "running": status_text == "running",
        "ok": status_text.startswith("ok"),
        "failed": status_text.startswith("failed"),
        "status": status_text,
        "version": __version__,
        "log_tail": log_tail,
    }


@router.get("/system/admin/available")
async def admin_available() -> dict:
    """Whether in-app system controls are wired (root helper + sudoers present)."""
    return {"available": bool(shutil.which("sudo")) and os.path.exists(_ADMIN_BIN)}


class AdminAction(BaseModel):
    action: str
    arg: str | None = None


@router.post("/system/admin", dependencies=[Depends(require_auth)])
async def run_admin(payload: AdminAction) -> dict:
    """Run a scoped, allow-listed admin action via the root helper.

    Refuses anything not in the allow-list; never passes free-form input to a
    shell. Requires authentication (PIN).
    """
    allowed_args = _ADMIN_ACTIONS.get(payload.action, "INVALID")
    if allowed_args == "INVALID":
        raise HTTPException(400, f"unknown action: {payload.action}")
    if allowed_args is not None and payload.arg not in allowed_args:
        raise HTTPException(400, f"invalid argument for {payload.action}")
    if not os.path.exists(_ADMIN_BIN):
        raise HTTPException(503, "system controls not installed (run the installer)")

    cmd = ["sudo", "-n", _ADMIN_BIN, payload.action]
    if payload.arg:
        cmd.append(payload.arg)
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT
        )
        out, _ = await asyncio.wait_for(proc.communicate(), timeout=120)
        text_out = (out or b"").decode(errors="replace")[-4000:]
        # The web app may only run this one helper, password-less, via a scoped
        # sudoers rule the installer writes. If that rule is missing (older install),
        # `sudo -n` fails asking for a password — surface an actionable hint instead
        # of a cryptic failure, since the whole point is to avoid the terminal.
        if proc.returncode != 0 and ("password is required" in text_out or "a terminal is required" in text_out):
            text_out = (
                "The system-control sudoers rule is missing or outdated, so the web app "
                "can't run privileged actions. Re-run the installer once on the device to "
                "(re)install it: `cd ~/LedgerFrame && ./scripts/install.sh`.\n\n" + text_out
            )
        return {
            "ok": proc.returncode == 0,
            "action": payload.action,
            "arg": payload.arg,
            "output": text_out,
        }
    except TimeoutError:
        raise HTTPException(504, "admin action timed out") from None
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(500, f"admin action failed: {exc}") from exc


# §9-12 (page-help Phase 0) — the /help shape, pinned. The route was declared `-> dict`, so
# the frozen contract recorded `additionalProperties: true`: an endpoint IN the contract whose
# shape was frozen NOT AT ALL. Typing it surfaced something the untyped dict had hidden — the
# route serves TWO shapes, the full catalogue and a search result, so it is a UNION, not one
# model. Saying so in the contract is the point; a single loose model would have re-hidden it.
class HelpTopicLink(BaseModel):
    """A pointer from Section-1 Orientation prose into a Section-2 page entry. `topic` is the
    target entry's id — the page turns it into a `?topic=` deep link (one canonical anchor per
    topic). It is a POINTER, never a figure: the IA law that Help never becomes a second home
    for a number is enforced by there being nowhere here to put one."""
    topic: str
    label: str


class HelpEntry(BaseModel):
    """A catalogue entry across all three sections (page-help 9-bis-1).

    EVERY optional field is excluded-when-unset, not declared-null. That is the lesson the
    what/why/improves triad already taught: a declared-but-unset field serves `"what": null` and
    renders an empty section on the page. The field set is now section-shaped —

    * Orientation: `links` (pointers into Section 2).
    * Pages: `inputs` / `options` / `outputs` / `interpret` — what the user fills, what they may
      choose, what they SEE (names only), and how to read it.
    * Glossary: `what` / `why` / `improves` / `example` / `level`. `example` is STATIC and
      sample-marked (9-bis-3); personalised derivation traces are R-53, post-release.

    `keywords` is served for the page's CLIENT-SIDE type-ahead (9-bis-4), which cannot rank on a
    field it never receives."""
    id: str
    category: str
    title: str
    body: str
    keywords: str | None = None
    what: str | None = None
    why: str | None = None
    improves: str | None = None
    example: str | None = None
    level: str | None = None
    inputs: list[str] | None = None
    options: list[str] | None = None
    outputs: list[str] | None = None
    interpret: str | None = None
    links: list[HelpTopicLink] | None = None


class HelpSearchEntry(BaseModel):
    """A ranked search hit — `search_help()` serves the compact four-key projection only."""
    id: str
    category: str
    title: str
    body: str


class HelpResponse(BaseModel):
    """`GET /help` — the whole catalogue.

    `markup` declares the CONSTRAINED SERVED MARKUP DIALECT the prose fields are written in
    (page-help §9-bis-11(b), `app/services/help_markup.py`). It is on the response rather than
    per-entry because the dialect is a property of the catalogue, not of any one entry, and
    versioning it (`lf-help-markup-1`) makes a future change to the sanctioned subset a VISIBLE
    contract change rather than a silent reinterpretation of unchanged strings.
    """
    markup: str
    categories: list[str]
    entries: list[HelpEntry]


class HelpSearchResponse(BaseModel):
    """`GET /help?q=` — ranked hits for a query.

    Deliberately carries NO `markup` field: this projection is served MARKUP-STRIPPED. Its
    consumers are the server-side ranker and `app/ai/tools.py` `help_facts()`, which passes
    `body` to the model as a grounding fact — neither renders markup, and markers reaching the
    AI would surface as `**` in answers the user reads. The asymmetry between the two responses
    IS the contract: full catalogue = formatted, search projection = plain.
    """
    query: str
    entries: list[HelpSearchEntry]


@router.get("/help", response_model=HelpResponse | HelpSearchResponse,
            response_model_exclude_unset=True)
async def help_content(q: str | None = None) -> dict:
    """In-app help — all entries, or ranked results for a query. Read-only, no secrets."""
    from app.services.help import all_help, search_help

    if q:
        return {"query": q, "entries": search_help(q, limit=6)}
    return all_help()


# ---------------------------------------------------------------------------------------------
# LEGAL (page-legal §9-3, owner 2026-07-19 — SERVED, not client-rendered).
#
# Sits beside `/help` deliberately: they are the same KIND of surface — static, read-only,
# markup-carrying prose whose value is that it is TRUE, and whose truth is held by server-side
# accuracy guards. The ruling's deciding rationale was that guard bar, not the transport.
# ---------------------------------------------------------------------------------------------


class LegalClause(BaseModel):
    """One numbered clause, and its lettered sub-clauses if it has any.

    THE CLAUSE CARRIES NO NUMBER, and that omission is deliberate (page-legal §11-4). Numbering is
    DERIVED FROM POSITION by the renderer — article index, clause index, item index — so "2.1.a"
    is a fact about where the clause sits rather than a string someone typed. Typed numbers are
    how a formal document rots: insert one clause and every later number is silently wrong, with
    nothing able to detect it because the numbers are prose. There is nowhere here to put one.
    """
    text: str
    items: list[str] = []


class LegalArticle(BaseModel):
    """One article of the Legal page — a numbered heading over a run of clauses.

    Was `LegalSection` with a single `body` string until page-legal §11-4 (owner, 2026-07-20)
    ruled the formal register. Rendered as a `Card` (page-legal §9-1); the template is unchanged.
    """
    id: str
    title: str
    clauses: list[LegalClause]


class LegalCommitments(BaseModel):
    """The seven Product Commitments, reproduced VERBATIM.

    `items` are byte-equal to `docs/specs/PRODUCT-SPEC.md` §3 (whitespace-normalised), asserted by
    `tests/unit/test_legal_content.py` (AC-L3) — string equality, never by eye. The page renders
    them; it does not paraphrase, summarise, reorder or number them itself.
    """
    title: str
    intro: str
    items: list[str]


class LegalPointer(BaseModel):
    """A file that ships with the source, and optionally a convenience link to its public text.

    `file` is REQUIRED and `url` is OPTIONAL, and that asymmetry is the contract (page-legal §9-5
    as amended by §11-3, owner 2026-07-20). The shipped file is canonical; a URL is a convenience
    and never a substitute. A pointer with no `file` is unrepresentable here, which is how the
    local-first rule is kept structurally rather than remembered — the page must stay complete and
    true with every `url` dead.
    """
    file: str
    what: str
    url: str | None = None


class LegalResponse(BaseModel):
    """`GET /legal` — the whole page.

    Carries `markup` for the same reason `HelpResponse` does: the dialect is DECLARED, so a
    future change to the sanctioned subset is a visible contract change rather than a silent
    reinterpretation of the same strings.

    `pack_footer` is served here because Legal OWNS the string and the Reports Pack RENDERS it —
    one source, two renderers (page-legal §9-4, D-038 lane). It is on this response so the two
    renderers are provably reading the same bytes.
    """
    markup: str
    preamble: str
    sections: list[LegalArticle]
    commitments: LegalCommitments
    pointers: list[LegalPointer]
    pack_footer: str


@router.get("/legal", response_model=LegalResponse)
async def legal_content() -> dict:
    """The Legal page's copy — the product-level position, the Commitments, the licence, the
    no-jurisdiction-tax stance. Read-only, no secrets, no database, never personalised.

    READABLE WITHOUT ACCEPTING (page-legal §11-5). This endpoint is exempt from the acceptance
    gate, and the exemption is not a convenience: a gate that demanded acceptance of a document it
    would not let you read would be asking for consent that could not be informed.
    """
    from app.services.legal import all_legal

    return all_legal()


# --- The acceptance gate (page-legal §11-5, owner 2026-07-20) --------------------------------- #


class LegalAcceptanceStatus(BaseModel):
    """Where this install stands on the Legal terms.

    `status` is a THREE-VALUE vocabulary, not a boolean, and the third value is the reason:
      * `accepted` — a live acceptance of the CURRENT text;
      * `stale`    — an acceptance exists, but of an earlier text. The user is not a stranger and
                     the gate must not greet them as one;
      * `none`     — never answered, or the newest answer was a decline.
    """
    status: str
    #: sha256 of the served legal document. An acceptance binds to this, so a changed document
    #: requires a fresh answer — "you accepted the terms" must be a statement the product can
    #: substantiate about the terms it actually showed.
    content_sha256: str
    accepted_at: str | None = None


class LegalAcceptanceIn(BaseModel):
    """The answer. `action` only — the hash is taken SERVER-SIDE and never accepted from the
    client, or a caller could record acceptance of a document that was never served."""
    action: str


class LegalGateCopy(BaseModel):
    """The gate's served strings. PROPOSED (page-legal §9-8) until the owner's look.

    Served rather than hardcoded in the lock screen for the same reason the page is (§9-3): this
    is the most consequential copy in the product — it is what the user is recorded as having
    agreed to — and served copy is the copy the accuracy guards can reach.

    `reading_note` / `reading_return` are the reading-return bar's strings, added by the §11-K
    ruling. The bar exists only while the gate has stood down so its document can be read, so it
    is ON the consent path, and `reading_note` states what the acceptance record currently holds.
    They were authored in the shell until that ruling: the scope of "served" is the PATH, not the
    panel.
    """
    prompt: str
    explainer: str
    stale_note: str
    declined_note: str
    reading_note: str
    reading_return: str


@router.get("/legal/acceptance", response_model=LegalAcceptanceStatus)
async def legal_acceptance(session: AsyncSession = Depends(get_db)) -> dict:
    """Current acceptance state + the current content hash. Exempt from the gate — the lock
    screen has to be able to ask whether it should be showing itself."""
    from app.services.legal import acceptance_status

    return await acceptance_status(session)


@router.get("/legal/gate-copy", response_model=LegalGateCopy)
async def legal_gate_copy() -> dict:
    """The gate's own strings. Exempt from the gate, for the obvious reason."""
    from app.services import legal

    return {
        "prompt": legal.ACCEPTANCE_PROMPT,
        "explainer": legal.ACCEPTANCE_EXPLAINER,
        "stale_note": legal.ACCEPTANCE_STALE_NOTE,
        "declined_note": legal.ACCEPTANCE_DECLINED_NOTE,
        "reading_note": legal.ACCEPTANCE_READING_NOTE,
        "reading_return": legal.ACCEPTANCE_READING_RETURN,
    }


@router.post("/legal/acceptance", response_model=LegalAcceptanceStatus)
async def post_legal_acceptance(
    payload: LegalAcceptanceIn, session: AsyncSession = Depends(get_db)
) -> dict:
    """Record an answer. Append-only: a decline never erases an earlier acceptance, and an
    acceptance never erases an earlier decline.

    NOT behind `require_auth`, deliberately, and this is worth stating because it looks like an
    omission. The gate sits in FRONT of the PIN in the entry sequence: on a PIN-protected install
    the user has not unlocked yet when they answer, so requiring a session here would make the
    terms un-acceptable on exactly the installs that are most protected. The endpoint is
    loopback-reachable, writes one row to a local database, and exposes nothing — the threat it
    would defend against is a local caller who could already read the whole database.
    """
    from app.services.legal import record_acceptance

    try:
        return await record_acceptance(session, payload.action)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
