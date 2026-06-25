"""System status, health, and AI status endpoints."""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app import __version__
from app.api.deps import get_db, pin_is_set
from app.core.config import get_settings
from app.providers.ai import get_ai_provider

router = APIRouter()


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
