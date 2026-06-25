"""Optional OpenAI-compatible provider — DISABLED by default.

This sends prompts (which include your structured portfolio facts) to an external
endpoint. It is only constructed when ``LEDGERFRAME_AI_PROVIDER=openai_compatible``
AND a base URL is set. Off-device transmission is opt-in and surfaced in the UI.
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator

import httpx

from app.schemas.ai import AIChunk, AIRequest, HealthStatus, ModelInfo

log = logging.getLogger(__name__)


class OpenAICompatibleProvider:
    name = "openai_compatible"

    def __init__(self, base_url: str, api_key: str, model: str):
        self.base_url = base_url.rstrip("/")
        self._key = api_key
        self.model = model or "gpt-4o-mini"

    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self._key:
            h["Authorization"] = f"Bearer {self._key}"
        return h

    async def health(self) -> HealthStatus:
        return HealthStatus(
            available=bool(self.base_url),
            provider="openai_compatible",
            detail="WARNING: sends data off-device",
            models=[self.model],
        )

    async def list_models(self) -> list[ModelInfo]:
        return [ModelInfo(name=self.model, family="openai_compatible")]

    async def chat(self, request: AIRequest) -> AsyncIterator[AIChunk]:
        body = {
            "model": request.model or self.model,
            "messages": [m.model_dump() for m in request.messages],
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "stream": True,
        }
        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=60) as client:
                async with client.stream(
                    "POST", "/chat/completions", json=body, headers=self._headers()
                ) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        data = line[5:].strip()
                        if data == "[DONE]":
                            yield AIChunk(delta="", done=True)
                            return
                        try:
                            obj = json.loads(data)
                            delta = obj["choices"][0]["delta"].get("content", "")
                            if delta:
                                yield AIChunk(delta=delta, done=False)
                        except (json.JSONDecodeError, KeyError, IndexError):
                            continue
            yield AIChunk(delta="", done=True)
        except Exception as exc:  # noqa: BLE001
            log.warning("openai_compatible chat failed: %s", exc)
            yield AIChunk(delta="", done=True)
