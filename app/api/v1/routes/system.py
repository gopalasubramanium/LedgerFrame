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
    # Apply immediately in this process (no restart needed): re-read .env and reset
    # provider caches. Also restart the worker via the helper if available so its
    # background refreshes use the new provider too.
    from app.core.config import reload_settings

    reload_settings()
    if os.path.exists(_ADMIN_BIN):
        try:
            proc = await asyncio.create_subprocess_exec(
                "sudo", "-n", _ADMIN_BIN, "restart",
                stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
            )
            await asyncio.wait_for(proc.communicate(), timeout=60)
        except Exception:  # noqa: BLE001
            pass
    return {"ok": True, "applied": True, "note": f"Applied — now using '{payload.provider}'."}


@router.post("/system/reset-data", dependencies=[Depends(require_auth)])
async def reset_data(session: AsyncSession = Depends(get_db)) -> dict:
    """Delete all demo/portfolio/market data so you can start fresh with live data.

    Removes transactions, holdings, instruments, quotes, price history, watchlists,
    snapshots, news and notes. Keeps your settings, PIN, and provider config. Sets a
    flag so demo data is NOT re-seeded afterwards.
    """
    from sqlalchemy import delete

    from app.models import (
        Account,
        AIConversation,
        AIMessage,
        Holding,
        Instrument,
        MarketNews,
        NetWorthSnapshot,
        Note,
        PortfolioSnapshot,
        PriceHistory,
        Quote,
        Setting,
        Transaction,
        Watchlist,
        WatchlistItem,
    )
    from app.seed.demo import SEED_FLAG_KEY

    # Delete children before parents to satisfy FK constraints.
    for model in (
        AIMessage, AIConversation, WatchlistItem, Watchlist, Note, PriceHistory,
        Quote, Transaction, Holding, PortfolioSnapshot, NetWorthSnapshot, MarketNews,
        Instrument, Account,
    ):
        await session.execute(delete(model))
    # Prevent demo re-seeding on the next boot.
    flag = (await session.execute(select(Setting).where(Setting.key == SEED_FLAG_KEY))).scalars().first()
    if flag:
        flag.value = "1"
    else:
        session.add(Setting(key=SEED_FLAG_KEY, value="1"))
    await session.flush()
    return {"ok": True, "note": "All portfolio & market data cleared. Add your holdings to begin."}


@router.post("/system/refresh-data", dependencies=[Depends(require_auth)])
async def refresh_data(session: AsyncSession = Depends(get_db)) -> dict:
    """Force-refresh quotes for held + watchlisted instruments from the current
    provider (live, if configured). Returns how many were refreshed and any errors."""
    from app.models import Holding, Instrument, WatchlistItem
    from app.services.market import refresh_quote

    held = (await session.execute(select(Holding.instrument_id).where(Holding.instrument_id.isnot(None)))).scalars().all()
    wl = (await session.execute(select(WatchlistItem.instrument_id))).scalars().all()
    ids = {*held, *wl}
    instruments = (await session.execute(select(Instrument).where(Instrument.id.in_(ids or [-1])))).scalars().all()
    refreshed, errors = 0, []
    for instr in instruments:
        try:
            q = await refresh_quote(session, instr.symbol, instr.exchange)
            if q.price is not None and q.entitlement.value != "unavailable":
                refreshed += 1
            else:
                errors.append(f"{instr.symbol}: no data")
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{instr.symbol}: {exc}")
    return {"ok": True, "refreshed": refreshed, "total": len(instruments), "errors": errors[:20]}


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
