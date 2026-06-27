"""AI provider data contracts and grounding structures."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class HealthStatus(BaseModel):
    available: bool
    provider: str
    detail: str = ""
    models: list[str] = []


class ModelInfo(BaseModel):
    name: str
    size: str | None = None
    family: str | None = None


class ChatMessage(BaseModel):
    role: str  # system | user | assistant
    content: str


class AIRequest(BaseModel):
    messages: list[ChatMessage]
    model: str | None = None
    temperature: float = 0.2
    max_tokens: int = 800  # headroom so reasoning models still reach a final answer


class AIChunk(BaseModel):
    delta: str = ""
    done: bool = False


class GroundingFact(BaseModel):
    """A single verified fact passed to the model and surfaced to the user."""

    label: str
    value: str
    source: str = "ledgerframe"
    timestamp: datetime | None = None
    entitlement: str | None = None
    is_stale: bool = False


class AIAnswer(BaseModel):
    text: str
    facts: list[GroundingFact] = []
    provider: str
    model: str | None = None
    grounded: bool = True
    disclaimer: str = "Information only, not financial advice."
