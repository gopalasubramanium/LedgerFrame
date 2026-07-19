# SPDX-License-Identifier: AGPL-3.0-or-later
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
        return [GroundingFact(label="Net worth", value="100 SGD")]

    monkeypatch.setattr(grounding, "gather_facts", fake_facts)
    grounding._request_times.clear()


async def _collect(monkeypatch, mode):
    """Patch the provider for the duration of ONE test, and no longer.

    ⚠ This used to assign ``grounding.get_ai_provider`` directly and restore only
    ``app.providers.ai.get_ai_provider`` — so the fake provider **leaked into every
    test that ran after this file in the same process**. It was invisible when this
    file ran alone and turned
    ``test_ai_grounding.py::test_answer_includes_grounding_facts_with_timestamps``
    red whenever it ran after: that test asks for the deterministic fallback and got
    this file's ``"Real answer."`` instead. An order-dependent failure that blames an
    innocent file is the worst kind to debug, so the patch is now scoped by
    ``monkeypatch``, which restores at teardown unconditionally.

    Patching ``grounding``'s binding is the correct and sufficient target:
    ``grounding.py`` does ``from app.providers.ai import get_ai_provider``, so it
    holds its own reference and never re-reads the source module.
    """
    monkeypatch.setattr(grounding, "get_ai_provider", lambda: _FakeProvider(mode))
    events = [e async for e in grounding.answer_stream(None, "How is my portfolio?")]
    text = "".join(e["delta"] for e in events if e["type"] == "delta")
    done = next(e for e in events if e["type"] == "done")
    return text, done


async def test_model_error_falls_back_with_reason(monkeypatch):
    text, done = await _collect(monkeypatch, "error")
    assert "didn't return an answer" in text
    assert "Net worth" in text  # data fallback shown
    assert done["provider"] == "fallback"
    assert done["error"]


async def test_reasoning_only_falls_back_to_data(monkeypatch):
    text, done = await _collect(monkeypatch, "think")
    assert "Net worth" in text  # only-reasoning → data shown
    assert done["provider"] == "fallback"


async def test_real_answer_passes_through(monkeypatch):
    text, done = await _collect(monkeypatch, "normal")
    assert "Real answer." in text
    assert done["provider"] == "openai_compatible"
