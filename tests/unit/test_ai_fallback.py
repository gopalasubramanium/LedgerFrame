"""Grounded answer stream is resilient: it never leaves an empty answer box.

Covers the failures that made remote Ollama "produce no output": a model that
errors, and a reasoning model that emits only <think>…</think>. In both cases the
stream must still deliver the deterministic data fallback (and surface the error).
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest

from app.ai import grounding
from app.schemas.ai import AIChunk, GroundingFact, HealthStatus


class _FakeProvider:
    name = "openai_compatible"

    def __init__(self, mode: str):
        self.mode = mode

    async def health(self) -> HealthStatus:
        return HealthStatus(available=True, provider=self.name, models=["m"])

    async def chat(self, request) -> AsyncIterator[AIChunk]:
        if self.mode == "error":
            raise RuntimeError("500 from model endpoint: boom")
        if self.mode == "think":
            yield AIChunk(delta="<think>reasoning only</think>", done=False)
            yield AIChunk(delta="", done=True)
        else:
            yield AIChunk(delta="Real answer.", done=False)
            yield AIChunk(delta="", done=True)


@pytest.fixture(autouse=True)
def _patch(monkeypatch):
    async def fake_facts(session, question):
        return [GroundingFact(label="Portfolio total value", value="100 SGD")]

    monkeypatch.setattr(grounding, "gather_facts", fake_facts)
    grounding._request_times.clear()


async def _collect(mode):
    monkeyprovider = _FakeProvider(mode)
    import app.providers.ai as ai_mod
    orig = ai_mod.get_ai_provider
    ai_mod.get_ai_provider = lambda: monkeyprovider
    grounding.get_ai_provider = lambda: monkeyprovider
    try:
        events = [e async for e in grounding.answer_stream(None, "How is my portfolio?")]
    finally:
        ai_mod.get_ai_provider = orig
    text = "".join(e["delta"] for e in events if e["type"] == "delta")
    done = next(e for e in events if e["type"] == "done")
    return text, done


async def test_model_error_falls_back_with_reason():
    text, done = await _collect("error")
    assert "didn't return an answer" in text
    assert "Portfolio total value" in text  # data fallback shown
    assert done["provider"] == "fallback"
    assert done["error"]


async def test_reasoning_only_falls_back_to_data():
    text, done = await _collect("think")
    assert "Portfolio total value" in text  # only-reasoning → data shown
    assert done["provider"] == "fallback"


async def test_real_answer_passes_through():
    text, done = await _collect("normal")
    assert "Real answer." in text
    assert done["provider"] == "openai_compatible"
