# SPDX-License-Identifier: AGPL-3.0-or-later
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
    elif name == "eodhd":
        # Opt-in, keyed broad-market provider. Import lazily; degrade to demo on error.
        try:
            from app.providers.market.eodhd import EodhdProvider

            _PROVIDER = EodhdProvider(name, settings.market_api_key)
        except Exception:  # noqa: BLE001
            _PROVIDER = MockMarketDataProvider()
    elif name == "kite":
        # Opt-in, READ-ONLY Kite market data. Two credentials from env (never the DB).
        try:
            from app.providers.market.kite import KiteProvider

            _PROVIDER = KiteProvider(settings.kite_api_key, settings.kite_access_token)
        except Exception:  # noqa: BLE001 — missing token → demo, never crash
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


def build_provider(name: str) -> MarketDataProvider | None:
    """Construct a market provider BY NAME (not the configured one), for the R-63 §9-1
    execution net — which walks the routing chain and must fetch from a lane other than the
    active provider. Unlike :func:`get_provider` this never caches and never degrades to demo:
    it returns ``None`` when the named provider can't be built (missing key/dependency), so the
    net simply skips that lane rather than silently substituting mock data.

    Keys still come from the single configured slot (per-provider keys are R-41, post-release);
    the caller gates keyed lanes on :func:`app.services.market.provider_availability` first, so a
    keyed lane only reaches here when this instance actually holds its credential.
    """
    settings = get_settings()
    name = (name or "").lower()
    try:
        if name == "csv":
            return CSVMarketDataProvider(settings.imports_dir)
        if name in ("mock", "demo", ""):
            return MockMarketDataProvider()
        if name == "yahoo":
            from app.providers.market.yahoo import YahooMarketDataProvider

            return YahooMarketDataProvider()
        if name == "eodhd":
            from app.providers.market.eodhd import EodhdProvider

            return EodhdProvider(name, settings.market_api_key)
        if name == "kite":
            from app.providers.market.kite import KiteProvider

            return KiteProvider(settings.kite_api_key, settings.kite_access_token)
        if name in ("alphavantage", "av"):
            from app.providers.market.external import ExternalMarketDataProvider

            return ExternalMarketDataProvider(name, settings.market_api_key)
    except Exception:  # noqa: BLE001 — an un-buildable lane is skipped by the net, never mocked
        return None
    return None


def reset_provider() -> None:
    """Drop the cached provider (used by settings changes & tests)."""
    global _PROVIDER
    _PROVIDER = None


__all__ = ["MarketDataProvider", "build_provider", "get_provider", "reset_provider"]
