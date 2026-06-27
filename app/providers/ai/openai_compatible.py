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
        if not self.base_url:
            return HealthStatus(available=False, provider=self.name, detail="no base URL set")
        warn = "sends data off-device"
        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=10) as client:
                r = await client.get("/models", headers=self._headers())
                if r.status_code in (401, 403):
                    return HealthStatus(available=False, provider=self.name,
                                        detail=f"auth rejected ({r.status_code}) — check the API key")
                if r.status_code == 200:
                    data = r.json()
                    rows = data.get("data") or data.get("models") or []
                    names = [str(m.get("id") or m.get("name") or "") for m in rows if isinstance(m, dict)]
                    names = [n for n in names if n]
                    if names and not any(self.model == n or self.model in n for n in names):
                        return HealthStatus(
                            available=False, provider=self.name, models=names,
                            detail=f"reachable, but model '{self.model}' not found. Available: "
                                   f"{', '.join(names[:8])}{'…' if len(names) > 8 else ''}",
                        )
                    return HealthStatus(available=True, provider=self.name,
                                        models=names or [self.model], detail=f"reachable; {warn}")
                # /models not supported (404/405) — probe with a tiny chat call.
                probe = await client.post(
                    "/chat/completions", headers=self._headers(),
                    json={"model": self.model, "messages": [{"role": "user", "content": "ping"}],
                          "max_tokens": 1, "stream": False},
                )
                if probe.status_code == 200:
                    return HealthStatus(available=True, provider=self.name,
                                        models=[self.model], detail=f"reachable; {warn}")
                return HealthStatus(available=False, provider=self.name,
                                    detail=f"endpoint returned {probe.status_code}: {probe.text[:160]}")
        except Exception as exc:  # noqa: BLE001
            return HealthStatus(available=False, provider=self.name,
                                detail=f"unreachable: {type(exc).__name__}: {exc}")

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
