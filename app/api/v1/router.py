"""Aggregate all v1 routes under a single router."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.routes import (
    ai,
    auth,
    backup,
    dashboard,
    markets,
    news,
    portfolio,
    settings,
    system,
    watchlists,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(system.router, tags=["system"])
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(dashboard.router, tags=["dashboard"])
api_router.include_router(markets.router, tags=["markets"])
api_router.include_router(portfolio.router, tags=["portfolio"])
api_router.include_router(watchlists.router, tags=["watchlists"])
api_router.include_router(news.router, tags=["news"])
api_router.include_router(ai.router, tags=["ai"])
api_router.include_router(settings.router, tags=["settings"])
api_router.include_router(backup.router, tags=["backup"])
