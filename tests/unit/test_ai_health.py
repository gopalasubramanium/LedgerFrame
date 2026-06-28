"""OpenAI-compatible provider health does a real reachability probe."""

from __future__ import annotations

from app.providers.ai.openai_compatible import OpenAICompatibleProvider


async def test_health_no_base_url():
    p = OpenAICompatibleProvider(base_url="", api_key="", model="llama3.2")
    h = await p.health()
    assert h.available is False
    assert "no base URL" in h.detail


async def test_health_unreachable_reports_actionable_reason():
    # Nothing listening here → must report NOT available with a clear, specific
    # reason (not a false "Connected", and not an opaque "All connection attempts
    # failed"). Port 1 refuses instantly.
    p = OpenAICompatibleProvider(base_url="http://127.0.0.1:1/v1", api_key="", model="llama3.2", timeout=5)
    h = await p.health()
    assert h.available is False
    assert "refused" in h.detail.lower() or "cannot connect" in h.detail.lower()
    assert "All connection attempts failed" not in h.detail  # opaque message replaced
