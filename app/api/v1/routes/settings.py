# SPDX-License-Identifier: AGPL-3.0-or-later
"""Settings: read/update user-facing preferences stored in the DB.

Secrets (API keys) are NEVER read or written here — those live only in the
environment / protected secrets file. This endpoint handles display preferences,
watchlist defaults, rotation, refresh intervals, privacy and voice toggles.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_auth
from app.core.config import SUPPORTED_CURRENCIES, get_settings
from app.db.claim import claim_setting
from app.models import AuditEvent, Setting

router = APIRouter()

# Allow-list of keys settable via the API (never includes secrets).
#
# page-settings §9 / Phase 0 delta 3 (D-078 reconciliation, owner 2026-07-18): the seven
# WRITE-ONLY keys with no consumer were REMOVED — `rotation_seconds`, `rotation_pages`,
# `focus_page` (§9-2(b): rotation parked to R-37, re-added spec-first WITH its engine),
# `reduced_motion`, `high_contrast` (§9-6: per-device localStorage is their only home),
# and `refresh_interval_seconds`, `display_sleep_minutes` (§9-7: no consumer, no spec home).
# A PUT of any of them is now an honest 400 (the unknown-key path below), pinned by
# test_settings_allowlist.py. `voice_enabled` / `ai_model` STAY by recorded deferral (Voice
# R-32 / AI-surfaces D-067/D-068) — exempt from this milestone's sweep by owner ruling.
_ALLOWED_KEYS = {
    "base_currency", "privacy_mode", "voice_enabled", "ai_model",
    # First-run checklist (D-045, page-first-run-checklist F-3/F-5):
    # - timezone: the device timezone becomes settable via this write surface (server
    #   zoneinfo is the validation truth — a client value we reject surfaces an honest
    #   error, never a silent default).
    # - first_run_complete: server-persisted flag (D-078 precedent) — set on the
    #   checklist's complete OR dismiss, so it never re-nags across browsers.
    "timezone", "first_run_complete",
    # Home (page-home §9-7). SERVER-persisted, not per-device (D-078's kiosk posture: it must
    # survive a browser wipe). NOTE: `home_layout` was here until §12ho1-6 removed the Simple
    # layout — Home ships ONE layout, so a layout key would store a choice nothing can make. A
    # write-only key is the very thing D-078 forbids, so it is GONE, not left as dead surface.
    "home_quote_source",
    # Long-term holding threshold (page-settings §9-1, Amendment A; D-077/Guarantee 4 — a
    # NEUTRAL user-set integer, no jurisdiction presets). The stored value is resolved as the
    # default for the realised-gains / tax-lots readers in ONE place (`tax.resolve_long_term_days`,
    # A11 — no per-route re-reads); an explicit query param still wins (PARAM-WINS). The numeric
    # validator below mirrors the route's `ge=0, le=3660`.
    "long_term_days",
}

#: Home quote-card sources (D-046/D-052) — the ratified view-scope options, each with a real reader.
HOME_QUOTE_SOURCES = ("markets", "holdings", "global", "watchlist")
#: Fresh-install default (page-home §9-7, owner 2026-07-13).
HOME_QUOTE_SOURCE_DEFAULT = "holdings"


@router.get("/settings")
async def get_settings_endpoint(session: AsyncSession = Depends(get_db)) -> dict:
    from app.services.tax import resolve_long_term_days

    rows = (await session.execute(select(Setting))).scalars().all()
    stored = {r.key: r.value for r in rows if r.key in _ALLOWED_KEYS}
    s = get_settings()
    return {
        "stored": stored,
        "defaults": {
            "base_currency": s.base_currency,
            "rotation_seconds": s.rotation_default_seconds,
            "timezone": s.timezone,
            "supported_currencies": SUPPORTED_CURRENCIES,
            "market_provider": s.market_provider,
            "ai_enabled": s.ai_enabled,
            "voice_enabled": s.voice_enabled,
            "demo_mode": s.is_demo,
            # page-home §9-7: the fresh-install quote source is SERVED, so the frontend never has to
            # guess it — and never carries a vocabulary copy (D-005).
            "home_quote_source": HOME_QUOTE_SOURCE_DEFAULT,
            "home_quote_sources": list(HOME_QUOTE_SOURCES),
            # page-settings §9-1 / Amendment A — the RESOLVED long-term threshold (the ONE helper, the
            # same value the tax/realised-gains readers use), SERVED so the Settings field renders it
            # verbatim (D-105) instead of the frontend carrying a 365 literal.
            "long_term_days": await resolve_long_term_days(session, None),
        },
    }


class SettingsPatch(BaseModel):
    values: dict[str, str]


@router.put("/settings", dependencies=[Depends(require_auth)])
async def update_settings(patch: SettingsPatch, session: AsyncSession = Depends(get_db)) -> dict:
    # Validate the reporting currency up front so we never persist a bad value.
    if "base_currency" in patch.values and patch.values["base_currency"].upper() not in SUPPORTED_CURRENCIES:
        raise HTTPException(400, f"Base currency must be one of: {', '.join(SUPPORTED_CURRENCIES)}.")
    # Validate the timezone against the server's IANA zoneinfo (F-3/F-4: the backend is
    # the validation truth; a client value we don't recognise is an honest 400, never a
    # silent default).
    if "timezone" in patch.values:
        from zoneinfo import available_timezones

        if patch.values["timezone"] not in available_timezones():
            raise HTTPException(400, "timezone must be a valid IANA timezone name")
    # page-home §9-7 — the backend is the validation truth here too: an unrecognised quote source is
    # an honest 400, never silently coerced to a default.
    if "home_quote_source" in patch.values and patch.values["home_quote_source"] not in HOME_QUOTE_SOURCES:
        raise HTTPException(400, f"That is not a quote source — choose one of: {', '.join(HOME_QUOTE_SOURCES)}.")
    # Long-term threshold (page-settings §9-1) — a whole number of days, validated to mirror the
    # realised-gains / tax-lots route bound (`ge=0, le=3660`, `portfolio.py`). A non-numeric or
    # out-of-range value is an honest 400, never a silently-stored bad threshold.
    if "long_term_days" in patch.values:
        try:
            _ltd = int(patch.values["long_term_days"])
        except (TypeError, ValueError):
            raise HTTPException(400, "long_term_days must be a whole number of days between 0 and 3660.") from None
        if not 0 <= _ltd <= 3660:
            raise HTTPException(400, "long_term_days must be between 0 and 3660 days.")
    # An unknown key is REFUSED, not skipped. It used to `continue` here — which is exactly why a PUT
    # of the (then unlisted) `home_layout` looked like it worked and changed nothing (page-home Phase
    # 0). A write surface that accepts a key it does not store is lying to its caller, and it hid a
    # real bug for a whole build. Retiring `home_layout` (§12ho1-6) would have re-armed that trap, so
    # the trap goes instead.
    unknown = sorted(set(patch.values) - _ALLOWED_KEYS)
    if unknown:
        raise HTTPException(400, f"Unknown setting: {', '.join(unknown)}.")
    applied = {}
    for key, value in patch.values.items():
        row = (await session.execute(select(Setting).where(Setting.key == key))).scalars().first()
        if row:
            row.value = value
        else:
            # R-58: absent-INSERT check-then-insert race — two concurrent PUTs of the same
            # never-set key both read absent and both insert; absorb the loser rather than 500.
            await claim_setting(session, key, value)
        applied[key] = value
    session.add(AuditEvent(category="mutation", action="update_settings",
                           detail=",".join(applied.keys())))
    await session.flush()

    # Base/reporting currency is a core setting consumed by the valuation engine
    # via get_settings() (the env), not the DB row above. Persist it to .env,
    # reload in-process (so every page re-reports immediately), reset the FX cache,
    # and restart the worker so its snapshots use the new currency too.
    restarted = False
    if "base_currency" in applied:
        from app.core.config import reload_settings
        from app.core.envfile import apply_env
        from app.core.service_control import restart_worker
        from app.services import fx

        apply_env({"LEDGERFRAME_BASE_CURRENCY": applied["base_currency"].upper()})
        reload_settings()
        fx.clear_cache()
        restarted = await restart_worker()

    # Timezone is read from get_settings() (the env) — e.g. GET /settings.defaults and
    # the chrome Clock. Persist it to .env + reload so the new zone shows immediately.
    # Display-only (no valuation impact) → no FX reset / worker restart.
    if "timezone" in applied:
        from app.core.config import reload_settings
        from app.core.envfile import apply_env

        apply_env({"LEDGERFRAME_TIMEZONE": applied["timezone"]})
        reload_settings()

    return {"ok": True, "applied": applied, "restarted_worker": restarted}
