# SPDX-License-Identifier: AGPL-3.0-or-later
"""THE FIGURE REGISTRY GUARDS — R-54 §9-B, Phase 0-2a.

*Owner:* "Centralizing fact identity into a single parity-guarded backend table prevents drift and
ensures robust reverse-indexing for analytics."

The two ruled fail-firsts:

1.  **A term must not resolve to two sources.** This is F6's lesson (*two sources of truth for one
    fact is the whole defect*) turned into a table and then into a test.
2.  **No row for a figure the engine does not serve.** A registry row is a promise that a number
    exists; a row for a figure nothing serves is a fabricated number with a lookup table in front
    of it. **CAGR is the named case** — D-086 forbids it outright.

Plus the **transitional parity tripwire**: Phase 0-2a deliberately leaves `analytics.py`'s inline
`term_id`s in place (0-2b deletes them), so for one delta the fact lives in two places. That is
made safe the F6 way — a guard that holds them equal — rather than by intending to be careful.
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

from app.services.figure_registry import (
    LABELS_NOT_IN_GLOSSARY,
    REGISTRY,
    canonical_label,
    figure_for_label,
    figures_for_term,
)

REPO = Path(__file__).resolve().parents[2]
SPEC = REPO / "docs" / "specs" / "GLOSSARY.md"


# ── Ruled fail-first #1 — one figure, one source ──────────────────────────────────────────────

def test_no_two_rows_claim_the_same_canonical_source():
    """One (endpoint, field) pair may back exactly ONE figure.

    Two rows pointing at the same served value would mean the registry itself had become the
    second source of truth it exists to prevent.
    """
    seen: dict[tuple[str, str], str] = {}
    for f in REGISTRY:
        key = (f.endpoint, f.field)
        assert key not in seen, (
            f"{f.figure_id!r} and {seen[key]!r} both claim {f.endpoint} → {f.field!r}. "
            f"One figure, one source (F6)."
        )
        seen[key] = f.figure_id


def test_no_label_resolves_to_two_figures():
    """A label — canonical or alias — may name exactly one figure.

    THE FAIL-FIRST: proven RED by adding "net worth" as an alias of `gross_assets`, which is the
    real-world shape of the mistake (Net worth and Gross assets are EQUAL for a user with no
    liabilities, so a value-coincidence invites exactly this collapse — `tools.py:28-52`).
    """
    owners: dict[str, str] = {}
    for f in REGISTRY:
        assert f.canonical_label.lower() not in f.aliases, (
            f"{f.figure_id}: the canonical label is repeated in its own aliases — redundant, and "
            f"it makes a self-collision look like an ambiguity."
        )
        for name in (f.canonical_label.lower(), *f.aliases):
            assert owners.get(name, f.figure_id) == f.figure_id, (
                f"label {name!r} resolves to both {owners[name]!r} and {f.figure_id!r} — "
                f"a coincidence of values is not an identity."
            )
            owners[name] = f.figure_id


def test_figure_ids_are_unique():
    ids = [f.figure_id for f in REGISTRY]
    assert len(ids) == len(set(ids)), "duplicate figure_id in REGISTRY"


# ── Ruled fail-first #2 — no row for a figure the engine does not serve ───────────────────────

def test_every_row_names_an_endpoint_the_app_actually_routes():
    """A registry row must point at a real route, verified against the frozen contract.

    Not "a plausible path" — the contract is the list of paths this app serves, so a typo or an
    aspirational endpoint reds here rather than shipping as a dead promise.
    """
    import json

    contract = json.loads((REPO / "docs" / "specs" / "API-CONTRACT.json").read_text())
    paths = set(contract["paths"])
    for f in REGISTRY:
        method, path = f.endpoint.split(" ", 1)
        assert path in paths, f"{f.figure_id}: {path} is not in the frozen API contract"
        assert method.lower() in contract["paths"][path], (
            f"{f.figure_id}: {path} has no {method} operation"
        )


def test_no_registry_row_for_a_prohibited_figure():
    """CAGR is the named case — D-086 (`PRODUCT-SPEC.md:152`) forbids an annualised figure.

    A registry row would give tier-1 a term→endpoint route to a number the product deliberately
    does not compute, which is how a lookup table becomes a fabrication.
    """
    for f in REGISTRY:
        haystack = f"{f.figure_id} {f.canonical_label} {' '.join(f.aliases)}".lower()
        assert "cagr" not in haystack, (
            f"{f.figure_id} names CAGR — D-086 forbids an annualised/CAGR figure. "
            f"The engine does not serve it and the registry must not promise it."
        )
        assert "annualis" not in haystack and "annualiz" not in haystack, (
            f"{f.figure_id} names an annualised figure — see D-086"
        )


# ── GLOSSARY spelling — strict, with exemptions declared BY NAME WITH A REASON ────────────────

def test_every_canonical_label_is_a_glossary_term_or_a_declared_exemption():
    """CLAUDE.md's hard rule, applied to the AI's fact labels for the first time.

    ⚠ THIS GUARD FOUND A LIVE VIOLATION AT PHASE 0-2a. `FIGURE_IDENTITY` — the map whose whole job
    is relabelling figures to their GLOSSARY spelling — itself carried **"Total assets"** and
    **"Total liabilities"**, and GLOSSARY has neither (`:66` is **Gross assets**, `:67` is
    **Liability**). `networth_facts` has been serving both to users. Nothing caught it because
    `test_glossary_parity` measures the HELP store against the spec and never the AI's labels.

    ⊕ BOTH RESOLVED. "Total assets" → "Gross assets" was applied at 0-2a (an existing ratified
    spelling, D-021 cited in the same GLOSSARY row). **F-1 — "Total liabilities" — was ratified by
    the owner at 0-2b as a GLOSSARY CATCH-UP**: verifying the reading made it stronger than the
    finding, since D-032 and D-054 already ratify **Liabilities** by name and `NetWorth.tsx:204`
    has been shipping that label — while `:208` rendered "…− Liabilities (GLOSSARY)", a user-facing
    string citing a spec entry that did not exist. GLOSSARY gained the row (spec-first), the
    registry's canonical label is now **Liabilities**, and **the carve-out is gone: this figure is
    an ordinary row with zero exceptions.**
    """
    spec = SPEC.read_text(encoding="utf-8")
    for f in REGISTRY:
        if f.canonical_label in LABELS_NOT_IN_GLOSSARY:
            continue
        assert f"**{f.canonical_label}**" in spec, (
            f'{f.figure_id}: canonical label "{f.canonical_label}" is not in GLOSSARY.md with '
            f"that exact spelling. Add it to the SPEC first, or declare it in "
            f"LABELS_NOT_IN_GLOSSARY with a reason."
        )


def test_exemptions_are_not_stale():
    """Every carve-out must be BOTH used and NECESSARY.

    ⊕ R-54 Phase 0-2b — the second half was missing, and it mattered. The first version only asked
    whether an exemption named a label some row used; it never asked whether the exemption was
    NEEDED. An audit at F-1 found **"Cash & deposits"** and **"Return / volatility"** carved out
    while both are perfectly good GLOSSARY terms — two holes in a strict guard, each wearing a
    plausible reason, neither doing any work.

    *An unnecessary carve-out is worse than no carve-out: it is an exception the reader trusts, and
    it is exactly where the next real violation will hide.* Both halves are asserted here so the
    list can only ever hold entries that are load-bearing.
    """
    labels = {f.canonical_label for f in REGISTRY}
    stale = sorted(set(LABELS_NOT_IN_GLOSSARY) - labels)
    assert not stale, f"LABELS_NOT_IN_GLOSSARY declares labels no figure uses: {stale}"

    spec = SPEC.read_text(encoding="utf-8")
    unnecessary = sorted(lbl for lbl in LABELS_NOT_IN_GLOSSARY if f"**{lbl}**" in spec)
    assert not unnecessary, (
        f"these labels are carved out but ARE GLOSSARY terms, so the exemption is unnecessary "
        f"and only weakens the guard: {unnecessary}. Delete the entry."
    )


def test_gross_assets_carries_the_retired_label_as_an_alias():
    """The old spelling must still RESOLVE, or absorbing FIGURE_IDENTITY would drop a mapping."""
    assert figure_for_label("total assets") is figure_for_label("gross assets")
    assert canonical_label("Total assets") == "Gross assets"


# ── term_id: the reverse index, and its one-to-many shape ─────────────────────────────────────

def test_every_declared_term_id_is_a_real_help_glossary_entry():
    from app.services.help import HELP

    known = {e["id"] for e in HELP if e["category"] == "Glossary"}
    for f in REGISTRY:
        if f.term_id is not None:
            assert f.term_id in known, f"{f.figure_id}: {f.term_id!r} is not a Help glossary entry"


def test_the_reverse_index_is_one_to_many_and_says_so():
    """`term-xirr-twr` explains TWO figures — the reverse index must not collapse them.

    Tier-1(a) shows the entry alongside every figure it explains; a reverse index that returned one
    row would silently pick a winner.
    """
    assert {f.figure_id for f in figures_for_term("term-xirr-twr")} == {"xirr", "twr"}
    # ⊕ F-2 (2026-07-22): term-allocation-weight now reverse-indexes to the PER-CLASS census — one
    # row per positive AssetClass (12), enum-derived — not the four deleted hardcoded buckets.
    assert len(figures_for_term("term-allocation-weight")) == 12
    assert {f.figure_id for f in figures_for_term("term-concentration")} == {
        "largest_position", "concentration_top5"
    }


def test_a_figure_may_have_no_help_entry_and_that_is_a_real_answer():
    """Net worth is the striking case: a GLOSSARY term and the headline figure, with no `term-*`
    Help entry. Tier-1 may show the figure without an explanation; it must never invent one."""
    net_worth = figure_for_label("net worth")
    assert net_worth is not None and net_worth.term_id is None


# ── The Phase 0-2a transitional tripwire is GONE ─────────────────────────────────────────────
#
# `test_analytics_inline_term_id_equals_the_registry` lived here for exactly one delta, holding
# analytics' 18 inline `term_id` literals equal to the registry while both existed. Phase 0-2b
# deleted the literals, so the tripwire has nothing left to compare and is **deleted in the same
# delta that made it obsolete** — as its own docstring promised. A tripwire outliving its
# transition is a test asserting a tautology, and it reads to the next person as though the risk is
# still being managed.
#
# What replaces it is not another comparison but the absence of a second source:
# `test_analytics_declares_no_inline_term_id` below proves the literals cannot come back.


def test_analytics_declares_no_inline_term_id():
    """analytics.py must never re-declare a `term_id` — the registry is the only source.

    This is the durable form of the deleted tripwire: rather than checking two copies agree, it
    checks THERE IS ONLY ONE. AST-parsed, so a mention in a comment cannot satisfy or trip it
    (the Phase 0-1 lesson).
    """
    tree = ast.parse((REPO / "app" / "services" / "analytics.py").read_text(encoding="utf-8"))
    inline = [
        node.lineno
        for node in ast.walk(tree)
        if isinstance(node, ast.Dict)
        for k in node.keys
        if isinstance(k, ast.Constant) and k.value == "term_id"
    ]
    assert not inline, (
        f"analytics.py re-declares term_id inline at line(s) {inline} — §9-B ruled it DERIVED "
        f"from the figure registry. Two sources for one fact is the whole defect (F6)."
    )


def test_analytics_still_derives_term_ids_at_all():
    """Blindness pin for the test above, which would pass happily if term_ids simply vanished."""
    from app.services.analytics import _with_term_ids

    metrics = _with_term_ids([{"label": "Gross assets"}, {"label": "Positions"}])
    assert metrics[0]["term_id"] == "term-gross-assets", "derivation no longer attaches term ids"
    assert "term_id" not in metrics[1], (
        "a metric with no registry row must carry NO term_id key — emitting None would be a new "
        "key on the wire and would break the byte-identity this delta proves"
    )


# ── FIGURE_IDENTITY is absorbed, not duplicated ───────────────────────────────────────────────

def test_figure_identity_no_longer_exists_as_a_second_table():
    """Absorbed means GONE. A surviving copy is precisely the two-tables defect."""
    src = (REPO / "app" / "ai" / "tools.py").read_text(encoding="utf-8")
    tree = ast.parse(src)
    assigned = {
        t.id
        for node in ast.walk(tree)
        if isinstance(node, (ast.Assign, ast.AnnAssign))
        for t in ([node.target] if isinstance(node, ast.AnnAssign) else node.targets)
        if isinstance(t, ast.Name)
    }
    assert "FIGURE_IDENTITY" not in assigned, (
        "app/ai/tools.py still defines FIGURE_IDENTITY — §9-B ruled it ABSORBED into the "
        "figure registry, and two tables for one fact is the defect."
    )
    # Blindness pin: prove tools.py still routes through the registry, so deleting the
    # integration would not make this guard pass by having nothing to check.
    assert re.search(r"from app\.services\.figure_registry import", src), (
        "tools.py no longer imports the figure registry — this guard has gone blind."
    )
