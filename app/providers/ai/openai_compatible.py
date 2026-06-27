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

    def __init__(self, base_url: str, api_key: str, model: str, timeout: int = 120):
        self.base_url = base_url.rstrip("/")
        self._key = api_key
        self.model = model or "gpt-4o-mini"
        # Generous read timeout: a local model can take a while to first token.
        self._timeout = httpx.Timeout(float(timeout), connect=10.0)

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

    @staticmethod
    def _delta_text(obj: dict) -> str:
        """Pull text from a streaming chunk, tolerating provider variations."""
        try:
            choice = obj["choices"][0]
        except (KeyError, IndexError, TypeError):
            return ""
        delta = choice.get("delta") or {}
        # OpenAI/Ollama use delta.content; some reasoning models stream
        # reasoning_content separately — surface both so nothing is lost.
        return (delta.get("content") or "") + (delta.get("reasoning_content") or "")

    async def chat(self, request: AIRequest) -> AsyncIterator[AIChunk]:
        body = {
            "model": request.model or self.model,
            "messages": [m.model_dump() for m in request.messages],
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "stream": True,
        }
        url = f"{self.base_url}/chat/completions"
        produced = False
        # 1) Try streaming. Surface HTTP errors clearly (raised → grounding shows them).
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                async with client.stream("POST", url, json=body, headers=self._headers()) as resp:
                    if resp.status_code >= 400:
                        detail = (await resp.aread()).decode(errors="replace")[:300]
                        raise RuntimeError(f"{resp.status_code} from model endpoint: {detail}")
                    async for line in resp.aiter_lines():
                        line = line.strip()
                        if not line or not line.startswith("data:"):
                            continue
                        data = line[5:].strip()
                        if data == "[DONE]":
                            if produced:
                                yield AIChunk(delta="", done=True)
                                return
                            break  # streamed nothing usable → fall through to non-stream
                        try:
                            text = self._delta_text(json.loads(data))
                        except json.JSONDecodeError:
                            continue
                        if text:
                            produced = True
                            yield AIChunk(delta=text, done=False)
            if produced:
                yield AIChunk(delta="", done=True)
                return
        except Exception as exc:  # noqa: BLE001 — retry once non-streamed before giving up
            log.warning("openai_compatible streaming failed: %s", exc)
            stream_error = exc
        else:
            stream_error = None

        # 2) Non-streaming fallback (some servers/models don't stream cleanly).
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                r = await client.post(url, json={**body, "stream": False}, headers=self._headers())
                if r.status_code >= 400:
                    raise RuntimeError(f"{r.status_code}: {r.text[:300]}")
                msg = (r.json()["choices"][0].get("message") or {})
                content = (msg.get("content") or "") + (msg.get("reasoning_content") or "")
                if content:
                    yield AIChunk(delta=content, done=False)
                yield AIChunk(delta="", done=True)
                return
        except Exception as exc:  # noqa: BLE001
            log.warning("openai_compatible non-streaming failed: %s", exc)
            # Signal the real reason to the orchestration layer (shown to the user).
            raise RuntimeError(str(stream_error or exc)) from exc
