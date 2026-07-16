# SPDX-License-Identifier: AGPL-3.0-or-later
"""Aggregate all v1 routes under a single router."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.routes import (
    accounts,
    ai,
    amfi,
    auth,
    backup,
    coingecko,
    ecb,
    estate,
    institutions,
    insurance,
    kite,
    markets,
    news,
    planning,
    policy,
    portfolio,
    refdata,
    settings,
    system,
    tokens,
    watchlists,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(system.router, tags=["system"])
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(markets.router, tags=["markets"])
api_router.include_router(portfolio.router, tags=["portfolio"])
api_router.include_router(refdata.router, tags=["refdata"])
api_router.include_router(policy.router, tags=["policy"])
api_router.include_router(planning.router, tags=["planning"])
api_router.include_router(insurance.router, tags=["insurance"])
api_router.include_router(estate.router, tags=["estate"])
api_router.include_router(institutions.router, tags=["institutions"])
api_router.include_router(tokens.router, tags=["tokens"])
api_router.include_router(accounts.router, tags=["accounts"])
api_router.include_router(watchlists.router, tags=["watchlists"])
api_router.include_router(news.router, tags=["news"])
api_router.include_router(ai.router, tags=["ai"])
api_router.include_router(settings.router, tags=["settings"])
api_router.include_router(backup.router, tags=["backup"])
api_router.include_router(amfi.router, tags=["amfi"])
api_router.include_router(coingecko.router, tags=["coingecko"])
api_router.include_router(ecb.router, tags=["fx"])
api_router.include_router(kite.router, tags=["kite"])
