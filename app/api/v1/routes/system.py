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
    # provider/FX caches. Restart only the WORKER (never the API — that would drop
    # this response) so its background refreshes use the new provider too.
    from app.core.config import reload_settings
    from app.core.service_control import restart_worker
    from app.services import fx

    reload_settings()
    fx.clear_cache()
    await restart_worker()
    return {"ok": True, "applied": True, "note": f"Applied — now using '{payload.provider}'."}


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
    from app.core.envfile import update_env

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
    update_env(updates)
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
    from app.core.envfile import update_env

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
    update_env(updates)
    reload_settings()
    # Report whether the new config can reach a model.
    health = await get_ai_provider().health()
    return {"ok": True, "available": health.available, "detail": health.detail}


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


async def _display_symbols(session: AsyncSession) -> list[str]:
    """All symbols shown across the app: holdings + watchlist + the curated market
    lists (overview, home tiles, global proxies)."""
    from app.api.v1.routes.dashboard import _HOME_MARKETS
    from app.api.v1.routes.markets import _DEFAULT_OVERVIEW, global_market_symbols
    from app.models import Holding, Instrument, WatchlistItem

    ids = {
        *(await session.execute(select(Holding.instrument_id).where(Holding.instrument_id.isnot(None)))).scalars().all(),
        *(await session.execute(select(WatchlistItem.instrument_id))).scalars().all(),
    }
    instr_syms = (
        await session.execute(select(Instrument.symbol).where(Instrument.id.in_(ids or [-1])))
    ).scalars().all()
    ordered: list[str] = []
    for sym in [*instr_syms, *_DEFAULT_OVERVIEW, *_HOME_MARKETS, *global_market_symbols()]:
        if sym not in ordered:
            ordered.append(sym)
    return ordered


@router.post("/system/refresh-data", dependencies=[Depends(require_auth)])
async def refresh_data(session: AsyncSession = Depends(get_db)) -> dict:
    """Force-refresh quotes for everything shown (holdings, watchlist, market &
    global tiles) from the current provider. Reports exactly what updated/failed."""
    from app.services.market import refresh_quote

    provider = get_settings().market_provider
    symbols = await _display_symbols(session)
    refreshed, succeeded, failed = 0, [], []
    for sym in symbols:
        try:
            q = await refresh_quote(session, sym)
            if q.price is not None and q.entitlement.value != "unavailable":
                refreshed += 1
                succeeded.append(sym)
            else:
                failed.append({"symbol": sym, "reason": f"no data from {provider} "
                               "(unsupported on this provider, or limit hit)"})
        except Exception as exc:  # noqa: BLE001
            failed.append({"symbol": sym, "reason": str(exc)[:160]})
    return {
        "ok": True, "refreshed": refreshed, "total": len(symbols),
        "succeeded": succeeded, "failed": failed,
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
    fetched, empty = [], []
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


@router.get("/system/version-check")
async def version_check() -> dict:
    """Compare the running version to the latest GitHub release. Best-effort; never
    fails the call (offline → update_available False)."""
    import httpx

    current = __version__
    latest = current
    available = False
    url = f"https://github.com/{_GITHUB_REPO}/releases/latest"
    try:
        async with httpx.AsyncClient(timeout=6) as client:
            r = await client.get(
                f"https://api.github.com/repos/{_GITHUB_REPO}/releases/latest",
                headers={"Accept": "application/vnd.github+json"},
            )
            if r.status_code == 200:
                tag = r.json().get("tag_name", "")
                if tag:
                    latest = tag.lstrip("vV")
                    available = _parse_ver(latest) > _parse_ver(current)
                    url = r.json().get("html_url", url)
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
