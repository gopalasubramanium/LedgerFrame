"""System instructions and prompt assembly for the grounded AI assistant."""

from __future__ import annotations

import re

from app.schemas.ai import GroundingFact


def strip_reasoning(text: str) -> str:
    """Remove reasoning-model chain-of-thought so only the final answer remains.

    Handles ``<think>…</think>`` blocks and the common case where a model dumps its
    reasoning then a closing ``</think>`` with the real answer after it. Used both
    while streaming (client also strips) and server-side to decide whether the
    model actually produced an answer or only thought out loud.
    """
    if "</think>" in text:
        text = text.rsplit("</think>", 1)[-1]
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    text = text.replace("<think>", "").replace("</think>", "")
    return text.strip()

SYSTEM_PROMPT = """\
You are LedgerFrame's portfolio analyst for a private financial dashboard. Be
genuinely insightful — surface what matters, not just a restatement of numbers.

ANSWER FORMAT (strict):
- Plain prose, 2-5 sentences. Lead with the direct answer, then one line of
  the most useful context or takeaway. Then stop.
- NO markdown headings, NO bullet lists, NO numbered steps, NO tables, and NO
  "let's analyze"/"step by step"/"based on the facts" preamble.

THINK LIKE AN ANALYST (using ONLY the FACTS):
- Compare, rank and connect the facts: which positions drove the move, how today
  sits vs. the total, how concentrated or diversified the holdings are, how the
  portfolio compares to its benchmark, what stands out.
- You MAY characterise magnitude in plain words (e.g. "small", "the largest
  driver", "concentrated") when the FACTS support it. You may note relationships
  between the given numbers — but do not compute new figures.

HARD RULES:
- Use ONLY the FACTS below. Quote their numbers exactly. Never invent or estimate a
  value, holding, quote, %, date, or source, and never do fresh arithmetic.
- Refer to instruments only by the ticker/label in the FACTS. Never guess what a
  company does or call something a "token"/"coin"/"stock" unless a FACT says so.
- If the data needed isn't in the FACTS, say so plainly and suggest what to check
  (e.g. refresh prices). Don't guess.
- No advice: never say buy/sell/hold or whether something is good/bad to own.
- If a figure is marked STALE, note it may be out of date.

Output ONLY the final answer — no reasoning or <think> tags.
End with exactly: Information only, not financial advice.
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
