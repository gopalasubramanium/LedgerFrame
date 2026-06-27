"""Reasoning-model chain-of-thought must never appear in the briefing."""

from __future__ import annotations

from app.services.briefing import _strip_reasoning


def test_strip_closed_think_block():
    assert _strip_reasoning("<think>planning here</think>The portfolio rose.") == "The portfolio rose."


def test_strip_reasoning_before_closing_tag():
    raw = "Okay, so I need to plan this. I'll write two sentences.</think>Portfolio up 1.2% today."
    assert _strip_reasoning(raw) == "Portfolio up 1.2% today."


def test_strip_leading_preamble():
    assert "okay" not in _strip_reasoning("Okay, here goes\nMarkets were calm.").lower()
