"""System status, health, AI status, and scoped admin controls."""

from __future__ import annotations

import asyncio
import os
import shutil

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app import __version__
from app.api.deps import get_db, pin_is_set, require_auth
from app.core.config import get_settings
from app.providers.ai import get_ai_provider

router = APIRouter()

# Allow-list of admin actions the Settings page may trigger via the root helper.
# Maps action -> allowed argument values (None = no argument).
_ADMIN_ACTIONS: dict[str, set[str] | None] = {
    "status": None,
    "restart": None,
    "doctor": None,
    "backup": None,
    "lan": {"on", "off"},
    "voice": {"on", "off"},
    "ai": {"on", "off"},
}
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


# Market-data providers the UI may select. mock/csv need no key.
_MARKET_PROVIDERS = {"mock", "csv", "alphavantage"}


@router.get("/system/data-source")
async def get_data_source() -> dict:
    from app.core.envfile import read_env

    env = read_env()
    settings = get_settings()
    return {
        "provider": env.get("LEDGERFRAME_MARKET_PROVIDER", settings.market_provider),
        "has_api_key": bool(env.get("LEDGERFRAME_MARKET_API_KEY", settings.market_api_key)),
        "base_currency": env.get("LEDGERFRAME_BASE_CURRENCY", settings.base_currency),
        "stale_after_seconds": env.get("LEDGERFRAME_STALE_AFTER_SECONDS", str(settings.stale_after_seconds)),
        "providers": sorted(_MARKET_PROVIDERS),
        "restart_required": True,
        "admin_available": os.path.exists(_ADMIN_BIN),
    }


class DataSourceIn(BaseModel):
    provider: str
    api_key: str | None = None  # write-only; never returned
    base_currency: str | None = None
    stale_after_seconds: int | None = None


@router.put("/system/data-source", dependencies=[Depends(require_auth)])
async def set_data_source(payload: DataSourceIn) -> dict:
    from app.core.envfile import update_env

    if payload.provider not in _MARKET_PROVIDERS:
        raise HTTPException(400, f"unknown provider; choose one of {sorted(_MARKET_PROVIDERS)}")
    updates = {"LEDGERFRAME_MARKET_PROVIDER": payload.provider}
    if payload.api_key is not None:
        updates["LEDGERFRAME_MARKET_API_KEY"] = payload.api_key.strip()
    if payload.base_currency:
        updates["LEDGERFRAME_BASE_CURRENCY"] = payload.base_currency.upper()
    if payload.stale_after_seconds:
        updates["LEDGERFRAME_STALE_AFTER_SECONDS"] = str(payload.stale_after_seconds)
    update_env(updates)
    # Try to apply immediately via the privileged helper; fall back to a manual note.
    applied = False
    if os.path.exists(_ADMIN_BIN):
        try:
            proc = await asyncio.create_subprocess_exec(
                "sudo", "-n", _ADMIN_BIN, "restart",
                stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
            )
            await asyncio.wait_for(proc.communicate(), timeout=60)
            applied = proc.returncode == 0
        except Exception:  # noqa: BLE001
            applied = False
    return {"ok": True, "applied": applied,
            "note": "Saved." if applied else "Saved — restart services to apply."}


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
        return {
            "ok": proc.returncode == 0,
            "action": payload.action,
            "arg": payload.arg,
            "output": (out or b"").decode(errors="replace")[-4000:],
        }
    except TimeoutError:
        raise HTTPException(504, "admin action timed out") from None
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(500, f"admin action failed: {exc}") from exc
