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
from app.models import AuditEvent, Setting

router = APIRouter()

# Allow-list of keys settable via the API (never includes secrets).
_ALLOWED_KEYS = {
    "base_currency", "rotation_seconds", "refresh_interval_seconds", "privacy_mode",
    "reduced_motion", "high_contrast", "voice_enabled", "display_sleep_minutes",
    "ai_model", "focus_page", "rotation_pages",
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
}

#: Home quote-card sources (D-046/D-052) — the ratified view-scope options, each with a real reader.
HOME_QUOTE_SOURCES = ("markets", "holdings", "global", "watchlist")
#: Fresh-install default (page-home §9-7, owner 2026-07-13).
HOME_QUOTE_SOURCE_DEFAULT = "holdings"


@router.get("/settings")
async def get_settings_endpoint(session: AsyncSession = Depends(get_db)) -> dict:
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
            session.add(Setting(key=key, value=value))
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
