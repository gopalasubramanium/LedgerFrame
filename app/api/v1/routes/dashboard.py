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
from app.services.portfolio import top_movers, value_portfolio

router = APIRouter()

# AV-friendly proxies (raw indices like ^GSPC aren't served by live providers).
_HOME_MARKETS = ["SPY", "QQQ", "GLD", "BTC"]


async def _holding_currencies(session: AsyncSession) -> list[str]:
    """Distinct native currencies of the user's holdings (for smart FX)."""
    from sqlalchemy import select

    from app.models import Holding

    return list({c for c in (await session.execute(select(Holding.currency))).scalars().all() if c})


@router.get("/dashboard/home")
async def dashboard_home(session: AsyncSession = Depends(get_db)) -> dict:
    settings = get_settings()
    base = settings.base_currency
    val = await value_portfolio(session, base)
    gainers, losers = top_movers(val, n=4)
    provider = get_provider()

    from app.services.market import display_quote

    markets = []
    for sym in _HOME_MARKETS:
        q = await display_quote(session, sym)
        markets.append(q.model_dump(mode="json"))

    # Smart FX: base currency vs each foreign currency the user actually holds.
    pairs = [(c, base) for c in await _holding_currencies(session) if c != base]
    if not pairs:  # sensible defaults before any holdings exist
        pairs = [("USD", base)] if base != "USD" else [("EUR", "USD"), ("GBP", "USD")]
    fx = []
    for b, qc in pairs[:6]:
        try:
            rate = await provider.get_fx_rate(b, qc)
            fx.append(rate.model_dump(mode="json"))
        except Exception:  # noqa: BLE001 — never let FX block the dashboard
            pass

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
            "gainers": [{"label": h.label, "name": h.name, "symbol": h.symbol,
                         "price": to_display(h.price), "currency": h.native_currency,
                         "day_change": to_display(h.day_change_base),
                         "day_change_pct": to_display(h.day_change_pct), "is_stale": h.is_stale}
                        for h in gainers],
            "losers": [{"label": h.label, "name": h.name, "symbol": h.symbol,
                        "price": to_display(h.price), "currency": h.native_currency,
                        "day_change": to_display(h.day_change_base),
                        "day_change_pct": to_display(h.day_change_pct), "is_stale": h.is_stale}
                       for h in losers],
        },
        "markets": markets,
        "fx": fx,
        "briefing": briefing,
    }
