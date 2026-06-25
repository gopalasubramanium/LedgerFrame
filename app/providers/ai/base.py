"""AI provider Protocol — implemented by Hailo, disabled, and OpenAI-compatible."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Protocol, runtime_checkable

from app.schemas.ai import AIChunk, AIRequest, HealthStatus, ModelInfo


@runtime_checkable
class AIProvider(Protocol):
    name: str

    async def health(self) -> HealthStatus: ...

    async def list_models(self) -> list[ModelInfo]: ...

    def chat(self, request: AIRequest) -> AsyncIterator[AIChunk]: ...
