"""FX conversion is triangulated through USD (reliable legs)."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

import pytest

from app.providers.market import get_provider
from app.schemas.common import FxRate
from app.services import fx


@pytest.fixture(autouse=True)
def _clear_fx_cache():
    fx.clear_cache()
    yield
    fx.clear_cache()


async def test_cross_rate_triangulates_via_usd(monkeypatch):
    """INR->SGD must equal (USD->SGD)/(USD->INR), using only USD pairs — never a
    direct (unreliable) cross."""
    provider = get_provider()
    calls: list[tuple[str, str]] = []

    async def fake_fx(base, quote):
        calls.append((base, quote))
        rates = {"INR": Decimal("83.5"), "SGD": Decimal("1.35"), "USD": Decimal("1")}
        # provider only ever asked for USD-based pairs here
        assert base == "USD"
        return FxRate(base=base, quote=quote, rate=rates[quote], source="test", received_at=datetime.now(UTC))

    monkeypatch.setattr(provider, "get_fx_rate", fake_fx)

    rate = await fx.get_rate("INR", "SGD")
    expected = Decimal("1.35") / Decimal("83.5")
    assert abs(rate - expected) < Decimal("1e-9")
    # Only USD legs were requested (no direct INR->SGD call).
    assert ("USD", "INR") in calls and ("USD", "SGD") in calls
    assert all(b == "USD" for b, _ in calls)


async def test_same_currency_is_identity():
    assert await fx.get_rate("SGD", "SGD") == Decimal("1")
