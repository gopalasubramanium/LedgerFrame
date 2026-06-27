"""OpenAI-compatible provider health does a real reachability probe."""

from __future__ import annotations

from app.providers.ai.openai_compatible import OpenAICompatibleProvider


async def test_health_no_base_url():
    p = OpenAICompatibleProvider(base_url="", api_key="", model="llama3.2")
    h = await p.health()
    assert h.available is False
    assert "no base URL" in h.detail


async def test_health_unreachable_reports_failure():
    # Nothing listening here → must report NOT available (not a false "Connected").
    p = OpenAICompatibleProvider(base_url="http://127.0.0.1:9/v1", api_key="", model="llama3.2")
    h = await p.health()
    assert h.available is False
    assert "unreachable" in h.detail.lower()
