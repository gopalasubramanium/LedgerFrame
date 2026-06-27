"""AI provider registry. Returns whatever is configured, defaulting to safe modes."""

from __future__ import annotations

from app.core.config import get_settings
from app.providers.ai.base import AIProvider
from app.providers.ai.disabled import DisabledAIProvider
from app.providers.ai.hailo_ollama import HailoOllamaProvider

_PROVIDER: AIProvider | None = None


def get_ai_provider() -> AIProvider:
    global _PROVIDER
    if _PROVIDER is not None:
        return _PROVIDER

    settings = get_settings()
    if not settings.ai_enabled or settings.ai_provider == "disabled":
        _PROVIDER = DisabledAIProvider()
    elif settings.ai_provider == "openai_compatible" and settings.openai_base_url:
        from app.providers.ai.openai_compatible import OpenAICompatibleProvider

        _PROVIDER = OpenAICompatibleProvider(
            settings.openai_base_url, settings.openai_api_key, settings.ai_model,
            timeout=settings.ai_timeout_seconds,
        )
    else:
        _PROVIDER = HailoOllamaProvider(
            settings.hailo_base_url, settings.ai_model, settings.ai_timeout_seconds
        )
    return _PROVIDER


def reset_ai_provider() -> None:
    global _PROVIDER
    _PROVIDER = None


__all__ = ["AIProvider", "get_ai_provider", "reset_ai_provider"]
