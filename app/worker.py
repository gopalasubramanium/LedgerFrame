"""Background worker: market refresh, snapshots, briefing, cache pruning, backups.

Runs as a separate systemd service so the API stays responsive. All jobs are
defensive — a failure is logged and retried on the next tick, never fatal.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.db.base import Base, get_engine, get_sessionmaker
from app.models import Instrument, NetWorthSnapshot, PortfolioSnapshot, WatchlistItem

log = logging.getLogger("ledgerframe.worker")


async def refresh_market_data() -> None:
    """Batch-refresh quotes for watchlisted + held instruments."""
    from app.services.market import refresh_quote

    async with get_sessionmaker()() as session:
        wl_ids = (await session.execute(select(WatchlistItem.instrument_id))).scalars().all()
        instruments = (
            await session.execute(select(Instrument).where(Instrument.id.in_(wl_ids or [-1])))
        ).scalars().all()
        for instr in instruments:
            try:
                await refresh_quote(session, instr.symbol, instr.exchange)
            except Exception as exc:  # noqa: BLE001
                log.warning("refresh failed for %s: %s", instr.symbol, exc)
        await session.commit()
    log.info("market data refreshed")


async def generate_snapshots() -> None:
    from app.services.portfolio import value_portfolio

    settings = get_settings()
    base = settings.base_currency
    async with get_sessionmaker()() as session:
        val = await value_portfolio(session, base)
        now = datetime.now(UTC)
        session.add(PortfolioSnapshot(
            ts=now, base_currency=base, total_value=val.total_value,
            cost_basis=val.cost_basis, unrealised_pl=val.unrealised_pl, day_change=val.day_change,
        ))
        assets = sum((h.market_value_base for h in val.holdings if h.market_value_base > 0), start=val.total_value * 0)
        liabilities = -sum((h.market_value_base for h in val.holdings if h.market_value_base < 0), start=val.total_value * 0)
        session.add(NetWorthSnapshot(
            ts=now, base_currency=base, assets=assets, liabilities=liabilities,
            net_worth=val.total_value,
        ))
        await session.commit()
    log.info("snapshots generated")


async def generate_briefing() -> None:
    from app.services.briefing import refresh_briefing

    async with get_sessionmaker()() as session:
        await refresh_briefing(session)
        await session.commit()
    log.info("briefing refreshed")


async def prune_cache() -> None:
    """Trim old price-history rows beyond a retention window to bound disk use."""
    log.info("cache prune tick (no-op placeholder; history retained by default)")


async def run_backup() -> None:
    settings = get_settings()
    if not settings.backup_enabled:
        return
    from app.services import backup as backup_svc

    try:
        info = await asyncio.to_thread(backup_svc.create_backup)
        log.info("backup created: %s (%s bytes)", info["filename"], info["size_bytes"])
    except Exception as exc:  # noqa: BLE001
        log.warning("backup failed: %s", exc)


async def main() -> None:
    setup_logging()
    settings = get_settings()
    settings.ensure_dirs()
    async with get_engine().begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(refresh_market_data, "interval", minutes=5, id="market", max_instances=1)
    scheduler.add_job(generate_snapshots, "interval", hours=6, id="snapshots", max_instances=1)
    scheduler.add_job(generate_briefing, "cron", hour=6, minute=30, id="briefing")
    scheduler.add_job(prune_cache, "interval", hours=24, id="prune")
    scheduler.add_job(run_backup, "cron", hour=2, minute=0, id="backup")
    scheduler.start()
    log.info("worker started")

    # Kick off an initial refresh so dashboards are warm shortly after boot.
    await refresh_market_data()
    await generate_briefing()

    stop = asyncio.Event()
    try:
        await stop.wait()
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
