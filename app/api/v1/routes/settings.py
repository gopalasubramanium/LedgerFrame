"""Settings: read/update user-facing preferences stored in the DB.

Secrets (API keys) are NEVER read or written here — those live only in the
environment / protected secrets file. This endpoint handles display preferences,
watchlist defaults, rotation, refresh intervals, privacy and voice toggles.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
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
    return {"ok": True, "applied": applied}
