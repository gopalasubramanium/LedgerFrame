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
}


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
        },
    }


class SettingsPatch(BaseModel):
    values: dict[str, str]


@router.put("/settings", dependencies=[Depends(require_auth)])
async def update_settings(patch: SettingsPatch, session: AsyncSession = Depends(get_db)) -> dict:
    # Validate the reporting currency up front so we never persist a bad value.
    if "base_currency" in patch.values and patch.values["base_currency"].upper() not in SUPPORTED_CURRENCIES:
        raise HTTPException(400, f"base_currency must be one of {SUPPORTED_CURRENCIES}")
    applied = {}
    for key, value in patch.values.items():
        if key not in _ALLOWED_KEYS:
            continue
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
        from app.core.envfile import update_env
        from app.core.service_control import restart_worker
        from app.services import fx

        update_env({"LEDGERFRAME_BASE_CURRENCY": applied["base_currency"].upper()})
        reload_settings()
        fx.clear_cache()
        restarted = await restart_worker()

    return {"ok": True, "applied": applied, "restarted_worker": restarted}
