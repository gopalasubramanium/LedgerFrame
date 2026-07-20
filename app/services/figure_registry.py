# SPDX-License-Identifier: AGPL-3.0-or-later
"""THE FIGURE REGISTRY — one table: figure identity → canonical label → canonical endpoint.

R-54 §9-B (owner ruling, chat 2026-07-20). *"Centralizing fact identity into a single
parity-guarded backend table prevents drift and ensures robust reverse-indexing for analytics."*

WHY THIS MODULE EXISTS
----------------------
Before it, the product had **no** term → endpoint registry at all (r54 §0-E) and two partial,
adjacent maps pointing in opposite directions:

* ``app/ai/tools.py::FIGURE_IDENTITY`` — label → fact identity, 9 entries, no endpoint. Built for
  the F5 fix (*a coincidence of values is not an identity*: Net worth and Gross assets are equal
  for a user with no liabilities and are still two figures).
* ``app/services/analytics.py`` — 18 metrics each carrying an inline ``term_id``, i.e. metric →
  help entry, which is the *reverse* of what tier-1 needs.

This module is the one table both collapse into. ``FIGURE_IDENTITY`` is **absorbed**: its
label→identity lookups are now served from here.

WHY IT LIVES IN ``app/services`` AND NOT ``app/ai``
--------------------------------------------------
``analytics.py`` derives from it at R-54 Phase 0-2b, and analytics is a **portfolio** surface. A
registry under ``app/ai/`` would make a non-AI page import the AI package to know its own figures'
names — a layering inversion, and the sort that is very hard to undo later. Nothing here imports
from ``app/ai``.

**term_id IS ONE-TO-MANY, AND THAT IS NOT A DEFECT.** ``term-xirr-twr`` covers two figures (XIRR
and TWR — the Help entry itself is a two-term heading, which ``test_glossary_parity`` already
declares), ``term-allocation-weight`` covers four asset-class weights, ``term-concentration``
covers two. So the table is keyed by ``figure_id`` — which *is* unique — and the reverse index
``figures_for_term()`` returns a **set**. Tier-1(a) wants exactly that: *"what is XIRR"* should
show the explanation alongside **both** XIRR and TWR.

WHAT A ROW ASSERTS
------------------
``endpoint`` is the ONE canonical source for the figure — the one-derivation law made
machine-readable. Where a second surface also serves the number (``/portfolio/stats`` re-serves
several ``/portfolio/summary`` figures), the registry names the canonical one and the duplicate is
just a duplicate. That is the property ``test_figure_registry`` proves, and it is the whole reason
to write endpoints down rather than leave them in prose.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# Canonical endpoints, named once so a typo cannot make two rows disagree about the same surface.
_SUMMARY = "GET /api/v1/portfolio/summary"
_STATS = "GET /api/v1/portfolio/stats"


@dataclass(frozen=True)
class Figure:
    """One figure the product can name, and where its single canonical value comes from."""

    figure_id: str
    canonical_label: str
    endpoint: str
    #: The response field (or metric label) on `endpoint` that carries this figure.
    field: str
    #: The Help glossary entry explaining it, when one exists. `None` is a REAL answer here —
    #: several headline figures have a GLOSSARY row but no `term-*` Help entry (Net worth is the
    #: striking one). Tier-1(a) can show the figure without an explanation; it must not invent one.
    term_id: str | None = None
    #: Other lower-cased labels that name this same figure — NOT including the canonical label
    #: itself, which is always resolvable. (A row that repeated it tripped the collision guard on
    #: its own alias at Phase 0-2a: the guard was right, the data was redundant.)
    aliases: tuple[str, ...] = field(default_factory=tuple)


# ── THE TABLE ────────────────────────────────────────────────────────────────────────────────
#
# Every endpoint below was verified against the serving route in the R-54 §0-D survey; none is
# recalled. A figure with no shipped endpoint HAS NO ROW — notably **CAGR**, which D-086
# (`PRODUCT-SPEC.md:152`) forbids the product from showing at all. A registry row for a figure the
# engine does not serve would be a fabricated number with a lookup table in front of it, and
# `test_figure_registry` proves each row's endpoint is one the app actually routes.
REGISTRY: tuple[Figure, ...] = (
    # ── Headline figures — canonical on /portfolio/summary ──
    Figure("net_worth", "Net worth", _SUMMARY, "total_value",
           term_id=None, aliases=()),
    # ⚠ GLOSSARY:66 spells this **Gross assets**; `FIGURE_IDENTITY` called it "Total assets",
    # which is NOT a GLOSSARY term (see LABELS_NOT_IN_GLOSSARY below). The canonical label here is
    # the GLOSSARY one and "total assets" survives as an alias so old labels still resolve.
    Figure("gross_assets", "Gross assets", _SUMMARY, "gross_assets",
           term_id="term-gross-assets", aliases=("total assets",)),
    # ⊕ R-54 F-1, owner-ratified 2026-07-20 as a GLOSSARY CATCH-UP. The canonical label is
    # **Liabilities** — the spelling D-032 and D-054 already ratified and `NetWorth.tsx:204` has
    # been shipping. `networth_facts` served "Total liabilities", which was in no spec; it survives
    # as an alias so old labels still resolve and `_dedupe` relabels them to the ratified spelling.
    Figure("liabilities", "Liabilities", _SUMMARY, "liabilities",
           term_id=None, aliases=("total liabilities",)),
    Figure("unrealised_pl", "Unrealised P/L", _SUMMARY, "unrealised_pl",
           term_id="term-unrealised-pl", aliases=("total unrealised p/l",)),
    Figure("todays_change", "Today's change", _SUMMARY, "day_change",
           term_id=None, aliases=()),
    Figure("total_return", "Total return", _SUMMARY, "total_return_pct",
           term_id="term-total-return", aliases=("total return %",)),

    # ── Return / risk metrics — canonical on /portfolio/stats ──
    Figure("realised_pl", "Realised P/L", _STATS, "Realised P/L",
           term_id="term-realised-pl", aliases=()),
    Figure("xirr", "Money-weighted return (XIRR)", _STATS, "Money-weighted return (XIRR)",
           term_id="term-xirr-twr"),
    Figure("twr", "Time-weighted return (TWR)", _STATS, "Time-weighted return (TWR)",
           term_id="term-xirr-twr"),
    Figure("income", "Income (div/int)", _STATS, "Income (div/int)",
           term_id="term-income"),
    Figure("income_yield", "Income yield", _STATS, "Income yield",
           term_id="term-income-yield"),
    Figure("period_return_1y", "1Y return", _STATS, "1Y return",
           term_id="term-period-return"),
    Figure("volatility_1y", "1Y volatility", _STATS, "1Y volatility",
           term_id="term-volatility"),
    Figure("return_volatility", "Return / volatility", _STATS, "Return / volatility",
           term_id="term-return-volatility"),
    Figure("max_drawdown_1y", "Max drawdown (1Y)", _STATS, "Max drawdown (1Y)",
           term_id="term-max-drawdown"),
    Figure("largest_position", "Largest position", _STATS, "Largest position",
           term_id="term-concentration"),
    Figure("concentration_top5", "Top 5 concentration", _STATS, "Top 5 concentration",
           term_id="term-concentration"),

    # ── Allocation buckets. Their labels are MASTER-DATA asset-class names, not GLOSSARY terms;
    #    the shared `term-allocation-weight` entry explains what a weight IS. ──
    Figure("alloc_cash_deposits", "Cash & deposits", _STATS, "Cash & deposits",
           term_id="term-allocation-weight"),
    Figure("alloc_equities_etfs", "Equities & ETFs", _STATS, "Equities & ETFs",
           term_id="term-allocation-weight"),
    Figure("alloc_crypto", "Crypto", _STATS, "Crypto",
           term_id="term-allocation-weight"),
    Figure("alloc_alternatives", "Alternatives", _STATS, "Alternatives",
           term_id="term-allocation-weight"),
)


# ── DECLARED EXEMPTIONS — BY NAME, WITH A REASON, NEVER BY SILENCE ───────────────────────────
#
# Same convention as `test_glossary_parity._HEADING_NOT_A_TERM`. A canonical label that is not a
# GLOSSARY term is either a defect or a declared non-term; the difference is written down here so
# the guard stays strict and the open questions stay visible.
#
# ⊕ R-54 Phase 0-2b — EVERY ENTRY MUST BE NECESSARY, and that is now guarded. An audit at F-1 found
# **"Cash & deposits"** and **"Return / volatility"** carved out while both ARE GLOSSARY terms: the
# exemptions were never needed, and an unnecessary carve-out is worse than none — it is a hole with
# a reason attached, and it hides the next real one. `test_exemptions_are_not_stale` now reds on any
# entry whose label IS in GLOSSARY, so this list can only ever contain entries that are load-bearing.
LABELS_NOT_IN_GLOSSARY: dict[str, str] = {
    # Asset-class bucket names come from MASTER-DATA, not GLOSSARY. `term-allocation-weight`
    # explains the weight; the bucket names are vocabulary, not terms.
    "Equities & ETFs": "MASTER-DATA asset class, not a GLOSSARY term",
    "Crypto": "MASTER-DATA asset class, not a GLOSSARY term",
    "Alternatives": "MASTER-DATA asset class, not a GLOSSARY term",
    # Metric headings that pair a term with its parenthetical expansion or window, exactly as
    # `_HEADING_NOT_A_TERM` already declares for the Help store.
    "Money-weighted return (XIRR)": "term plus its parenthetical expansion (GLOSSARY: XIRR)",
    "Time-weighted return (TWR)": "term plus its parenthetical expansion (GLOSSARY: TWR)",
    "1Y return": "a windowed instance of Period return",
    "1Y volatility": "a windowed instance of Volatility",
    "Max drawdown (1Y)": "a windowed instance of Maximum drawdown",
    "Income (div/int)": "sanctioned GLOSSARY-first at ai-surfaces §17-3",
    "Top 5 concentration": "a windowed instance of Concentration",
}


_BY_ID = {f.figure_id: f for f in REGISTRY}
_BY_LABEL: dict[str, Figure] = {}
for _f in REGISTRY:
    for _name in (_f.canonical_label.lower(), *_f.aliases):
        _BY_LABEL[_name] = _f


def figure_by_id(figure_id: str) -> Figure | None:
    """The registry row for a figure identity, or None."""
    return _BY_ID.get(figure_id)


def figure_for_label(label: str) -> Figure | None:
    """The figure a label names, or None if the label has no declared identity.

    None means "nothing to collide with" — most labels are per-instrument or per-bucket and are
    already unique. Only figures a second source can also produce need declaring. (This is
    `FIGURE_IDENTITY`'s contract, preserved verbatim as it is absorbed.)
    """
    return _BY_LABEL.get(label.strip().lower())


def canonical_label(label: str) -> str:
    """The GLOSSARY spelling for a label, or the label unchanged when it names no known figure."""
    fig = figure_for_label(label)
    return fig.canonical_label if fig else label


def figures_for_term(term_id: str) -> tuple[Figure, ...]:
    """Every figure a Help glossary entry explains — the REVERSE INDEX, and it returns a SET.

    One entry may explain several figures (`term-xirr-twr` → XIRR and TWR), which is why this
    returns a tuple rather than a single row. Tier-1(a) shows the entry alongside *all* of them.
    """
    return tuple(f for f in REGISTRY if f.term_id == term_id)


def term_id_for_label(label: str) -> str | None:
    """The Help glossary entry for a served metric label — what analytics' inline ids duplicate.

    R-54 Phase 0-2a ships this alongside the inline `term_id`s in `analytics.py`, which is a
    DELIBERATE, BRIEF two-sources state; `test_figure_registry_analytics_parity` is the tripwire
    that holds them equal until Phase 0-2b deletes the inline copies. Stated rather than left to
    be noticed — two sources for one fact is the defect this registry exists to end (F6).
    """
    fig = figure_for_label(label)
    return fig.term_id if fig else None
