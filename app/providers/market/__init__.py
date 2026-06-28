"""Market data provider registry.

Business logic never imports a concrete provider — it asks :func:`get_provider`
for whatever is configured, so new vendors slot in without touching services.
"""

from __future__ import annotations

from app.core.config import get_settings
from app.providers.market.base import MarketDataProvider
from app.providers.market.csv_provider import CSVMarketDataProvider
from app.providers.market.mock import MockMarketDataProvider

_PROVIDER: MarketDataProvider | None = None


def get_provider() -> MarketDataProvider:
    global _PROVIDER
    if _PROVIDER is not None:
        return _PROVIDER

    settings = get_settings()
    name = settings.market_provider.lower()
    if name == "csv":
        _PROVIDER = CSVMarketDataProvider(settings.imports_dir)
    elif name in ("mock", "demo", ""):
        _PROVIDER = MockMarketDataProvider()
    elif name == "yahoo":
        # Free, no API key. Import lazily so it never breaks demo mode.
        try:
            from app.providers.market.yahoo import YahooMarketDataProvider

            _PROVIDER = YahooMarketDataProvider()
        except Exception:  # noqa: BLE001
            _PROVIDER = MockMarketDataProvider()
    else:
        # External adapter, opt-in. Import lazily so a missing dependency or key
        # never breaks demo mode.
        try:
            from app.providers.market.external import ExternalMarketDataProvider

            _PROVIDER = ExternalMarketDataProvider(name, settings.market_api_key)
        except Exception:  # noqa: BLE001 — degrade to demo rather than crash
            _PROVIDER = MockMarketDataProvider()
    return _PROVIDER


def reset_provider() -> None:
    """Drop the cached provider (used by settings changes & tests)."""
    global _PROVIDER
    _PROVIDER = None


__all__ = ["MarketDataProvider", "get_provider", "reset_provider"]
