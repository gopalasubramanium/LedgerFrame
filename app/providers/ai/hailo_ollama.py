"""Hailo AI HAT+ 2 client via the local ``hailo-ollama`` REST service.

Talks only to localhost (default ``http://127.0.0.1:8000``). Models are discovered
dynamically through ``/hailo/v1/list`` so no model package version is hard-coded.
If the service is down, every method degrades cleanly: ``health`` reports
unavailable and ``chat`` yields nothing, letting the grounding layer fall back to
deterministic templates.
"""

from __future__ import annotations

import json
import logging
import re
from collections.abc import AsyncIterator

import httpx

from app.schemas.ai import AIChunk, AIRequest, HealthStatus, ModelInfo

log = logging.getLogger(__name__)

# Prefer a small instruct model (1B–2B) for responsiveness on the NPU.
_SIZE_RE = re.compile(r"(\d+(?:\.\d+)?)\s*[bB]")


def _model_rank(name: str) -> float:
    """Lower is better. Parse a parameter count; unknown sizes sink to the back."""
    m = _SIZE_RE.search(name)
    if not m:
        return 999.0
    size = float(m.group(1))
    # Penalise anything well outside the 1–2B sweet spot.
    return abs(size - 1.5) + (0 if size <= 3 else 100)


class HailoOllamaProvider:
    name = "hailo"

    def __init__(self, base_url: str, model: str = "", timeout: int = 30):
        self.base_url = base_url.rstrip("/")
        self._configured_model = model
        self.timeout = timeout
        self._resolved_model: str | None = model or None

    async def _client(self, timeout: float | None = None) -> httpx.AsyncClient:
        # Bounded connect so an unreachable host fails fast; long read only for
        # generation (slow local models).
        t = httpx.Timeout(float(timeout if timeout is not None else self.timeout), connect=10.0)
        return httpx.AsyncClient(base_url=self.base_url, timeout=t)

    async def list_models(self) -> list[ModelInfo]:
        try:
            async with await self._client(timeout=10) as client:  # health/discovery is quick
                r = await client.get("/hailo/v1/list")
                r.raise_for_status()
                payload = r.json()
        except Exception as exc:  # noqa: BLE001
            log.warning("hailo list_models failed: %s", exc)
            return []
        # Be tolerant of shape: {"models": [...]} or a bare list of names/objects.
        raw = payload.get("models", payload) if isinstance(payload, dict) else payload
        out: list[ModelInfo] = []
        for item in raw or []:
            if isinstance(item, str):
                out.append(ModelInfo(name=item))
            elif isinstance(item, dict):
                out.append(
                    ModelInfo(
                        name=item.get("name") or item.get("model") or "unknown",
                        size=str(item.get("size")) if item.get("size") else None,
                        family=item.get("family"),
                    )
                )
        return out

    async def _select_model(self) -> str | None:
        if self._resolved_model:
            return self._resolved_model
        models = await self.list_models()
        if not models:
            return None
        best = sorted(models, key=lambda m: _model_rank(m.name))[0]
        self._resolved_model = best.name
        log.info("hailo auto-selected model: %s", best.name)
        return best.name

    async def health(self) -> HealthStatus:
        try:
            models = await self.list_models()
            if not models:
                return HealthStatus(
                    available=False, provider="hailo",
                    detail="hailo-ollama reachable but no models listed",
                )
            return HealthStatus(
                available=True, provider="hailo",
                detail=f"{len(models)} model(s) available",
                models=[m.name for m in models],
            )
        except Exception as exc:  # noqa: BLE001
            return HealthStatus(available=False, provider="hailo", detail=str(exc))

    async def chat(self, request: AIRequest) -> AsyncIterator[AIChunk]:
        model = request.model or await self._select_model()
        if not model:
            yield AIChunk(delta="", done=True)
            return

        body = {
            "model": model,
            "messages": [m.model_dump() for m in request.messages],
            "stream": True,
            "options": {"temperature": request.temperature, "num_predict": request.max_tokens},
        }
        produced = False
        try:
            async with await self._client() as client:
                async with client.stream("POST", "/api/chat", json=body) as resp:
                    if resp.status_code >= 400:
                        detail = (await resp.aread()).decode(errors="replace")[:300]
                        raise RuntimeError(f"{resp.status_code} from hailo-ollama: {detail}")
                    async for line in resp.aiter_lines():
                        if not line.strip():
                            continue
                        try:
                            obj = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        delta = (obj.get("message") or {}).get("content", "")
                        done = bool(obj.get("done"))
                        if delta:
                            produced = True
                            yield AIChunk(delta=delta, done=False)
                        if done:
                            yield AIChunk(delta="", done=True)
                            return
            yield AIChunk(delta="", done=True)
        except Exception as exc:  # noqa: BLE001
            log.warning("hailo chat failed: %s", exc)
            if not produced:
                # Surface the reason so the grounding layer can show it (not a blank box).
                raise RuntimeError(str(exc)) from exc
            yield AIChunk(delta="", done=True)
