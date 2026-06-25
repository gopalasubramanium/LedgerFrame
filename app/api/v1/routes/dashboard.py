"""Home dashboard aggregate — one call to populate the landing screen fast."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.config import get_settings
from app.core.money import to_display
from app.providers.market import get_provider
from app.services.briefing import get_briefing
from app.services.market import get_cached_quote
from app.services.portfolio import top_movers, value_portfolio

router = APIRouter()

_HOME_MARKETS = ["^GSPC", "^STI", "GLD", "BTC"]
_HOME_FX = [("USD", "SGD"), ("EUR", "USD"), ("USD", "INR")]


@router.get("/dashboard/home")
async def dashboard_home(session: AsyncSession = Depends(get_db)) -> dict:
    settings = get_settings()
    base = settings.base_currency
    val = await value_portfolio(session, base)
    gainers, losers = top_movers(val, n=4)
    provider = get_provider()

    markets = []
    for sym in _HOME_MARKETS:
        q = await get_cached_quote(session, sym)
        if q.price is None:  # warm the cache once on first load
            from app.services.market import refresh_quote

            q = await refresh_quote(session, sym)
        markets.append(q.model_dump(mode="json"))

    fx = []
    for b, qc in _HOME_FX:
        rate = await provider.get_fx_rate(b, qc)
        fx.append(rate.model_dump(mode="json"))

    status = await provider.get_market_status("US")
    briefing = await get_briefing(session)
    if not briefing.get("generated_at"):
        # Generate once lazily on first load so the card isn't empty before the
        # worker's scheduled run (the worker refreshes it daily thereafter).
        from app.services.briefing import refresh_briefing

        text = await refresh_briefing(session)
        briefing = {"text": text, "generated_at": datetime.now(UTC).isoformat()}

    return {
        "now": datetime.now(UTC).isoformat(),
        "timezone": settings.timezone,
        "demo_mode": settings.is_demo,
        "market_status": status.model_dump(mode="json"),
        "portfolio": {
            "total_value": to_display(val.total_value),
            "day_change": to_display(val.day_change),
            "unrealised_pl": to_display(val.unrealised_pl),
            "total_return_pct": to_display(val.total_return_pct),
            "base_currency": base,
            "has_stale": val.has_stale,
        },
        "top_movers": {
            "gainers": [{"label": h.label, "symbol": h.symbol,
                         "day_change": to_display(h.day_change_base), "is_stale": h.is_stale}
                        for h in gainers],
            "losers": [{"label": h.label, "symbol": h.symbol,
                        "day_change": to_display(h.day_change_base), "is_stale": h.is_stale}
                       for h in losers],
        },
        "markets": markets,
        "fx": fx,
        "briefing": briefing,
    }
