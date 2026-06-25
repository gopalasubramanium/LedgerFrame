"""Disabled AI provider — always available, never calls anything.

Used when AI is turned off or the Hailo service is unreachable. The grounding
layer detects this and renders deterministic template answers instead, so the
"Ask" feature still returns structured facts (just without natural-language
narration).
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from app.schemas.ai import AIChunk, AIRequest, HealthStatus, ModelInfo


class DisabledAIProvider:
    name = "disabled"

    async def health(self) -> HealthStatus:
        return HealthStatus(available=False, provider="disabled", detail="AI is disabled")

    async def list_models(self) -> list[ModelInfo]:
        return []

    async def chat(self, request: AIRequest) -> AsyncIterator[AIChunk]:
        yield AIChunk(delta="", done=True)
