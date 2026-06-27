"""System instructions and prompt assembly for the grounded AI assistant."""

from __future__ import annotations

from app.schemas.ai import GroundingFact

SYSTEM_PROMPT = """\
You are LedgerFrame's assistant for a private, local financial dashboard.

ABSOLUTE RULES:
- You may ONLY use the FACTS provided below. Never invent or estimate a quote,
  holding, performance number, news item, date, or data source.
- Never perform arithmetic to derive financial values. All numbers are already
  computed and given to you as FACTS. Quote them; do not recompute them.
- If a needed fact is missing or marked unavailable, say plainly that the data is
  not available. Do not guess.
- Never give personalised investment advice. Never say "buy", "sell", "hold",
  "strong buy", "guaranteed", or similar directives.
- Use cautious, neutral language. Clearly distinguish fact from inference, and
  flag uncertainty. Correlation is not causation.
- Keep answers concise — this is a desk display. A few short sentences.
- If any fact is marked stale, mention that the figure may be out of date.

Output ONLY the final answer — no reasoning, planning, preamble, or <think> tags.
End every answer with: "Information only, not financial advice."
"""

REFUSAL_NO_FACTS = (
    "I don't have the data needed to answer that right now. "
    "Try refreshing market data or check that the relevant holdings exist. "
    "Information only, not financial advice."
)


def render_facts(facts: list[GroundingFact]) -> str:
    if not facts:
        return "FACTS: (none available)"
    lines = ["FACTS (the only data you may use):"]
    for f in facts:
        parts = [f"- {f.label}: {f.value}"]
        meta = []
        if f.source:
            meta.append(f"source={f.source}")
        if f.timestamp:
            meta.append(f"as_of={f.timestamp.isoformat()}")
        if f.entitlement:
            meta.append(f"entitlement={f.entitlement}")
        if f.is_stale:
            meta.append("STALE")
        if meta:
            parts.append(f"  ({', '.join(meta)})")
        lines.append("".join(parts))
    return "\n".join(lines)
