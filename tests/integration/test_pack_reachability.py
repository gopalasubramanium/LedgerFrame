# SPDX-License-Identifier: AGPL-3.0-or-later
"""FIGURES REACH THE READER ONLY THROUGH THE PROJECTION — R-54 §9-C, Phase 0-4.

*Owner:* "Enforcing strict data projection pipelines — where figures only flow through verified
fact-packs — prevents raw data leaks and UI formatting inconsistencies."

Three properties, and the third is the one with teeth:

1.  **The census is DECLARED** (ruling item 2). Every registry row carries ``pack_reachable``, and
    it must match what the pack can actually produce. A map that drifts from the territory is worse
    than no map — it is a map you trust.
2.  **Extensions are narrow-by-demand** (item 1). The pack gained exactly the rows tier-1 can
    resolve to; it did not gain everything the engine computes.
3.  **THE BOUNDARY IS GUARDED** (item 3). Tier-1 must never name a figure whose row is not
    pack-reachable — such a question takes the ratified honest-miss shape. *The registry is a map of
    where figures live, never a promise that the AI serves them all.*

Plus §9-C's two fail-firsts: a ``to_display`` float must not reach the pack, and no fact value may
bypass the single rendering path.
"""

from __future__ import annotations

import ast
import json
import re
from pathlib import Path

from app.services.figure_registry import REGISTRY, figure_for_label, figures_for_term

REPO = Path(__file__).resolve().parents[2]

# A money-shaped fact value as the pack renders it: grouped thousands, then a currency code.
_MONEY_FACT = re.compile(r"^-?[\d,]+(?:\.\d+)? [A-Z]{3}$")


async def _pack_labels(app_client, question: str) -> list[dict]:
    r = await app_client.post("/api/v1/ai/chat", json={"question": question})
    assert r.status_code == 200
    facts: list[dict] = []
    for line in r.text.splitlines():
        if line.startswith("data:"):
            ev = json.loads(line[5:].strip())
            if ev.get("type") == "facts":
                facts = ev["facts"]
    return facts


# ── (1) The declared census matches reality ──────────────────────────────────────────────────

async def test_every_row_declared_reachable_can_actually_be_produced(app_client):
    """`pack_reachable=True` is a claim about behaviour, so it is checked against behaviour."""
    from app.ai import tools as T
    from app.db.base import get_sessionmaker

    produced: set[str] = set()
    async with get_sessionmaker()() as s:
        for name in ("portfolio_facts", "networth_facts", "performance_facts",
                     "allocation_facts", "movers_facts", "holdings_facts"):
            for f in await getattr(T, name)(s):
                fig = figure_for_label(f.label)
                if fig:
                    produced.add(fig.figure_id)

    # The per-class allocation rows (F-2) are pack_reachable but HELD-CONDITIONAL: `allocation_facts`
    # produces one per HELD positive class, so a class absent from the demo (commodity/private/other)
    # is legitimately not produced here. Their reachability + enum-completeness is proven by the F-2
    # census guard below (`test_the_allocation_census_is_enum_complete_and_sums_to_100`); this guard
    # keeps its exact meaning for the non-conditional rows.
    claimed = {f.figure_id for f in REGISTRY if f.pack_reachable and not f.figure_id.startswith("alloc_")}
    missing = sorted(claimed - produced)
    assert not missing, (
        f"rows declare pack_reachable=True but the pack does not produce them: {missing}. "
        f"The census has drifted from the code — a map you trust is worse than no map."
    )
    # And every HELD class's allocation row IS produced — the conditional half, asserted not assumed.
    produced_alloc = {fid for fid in produced if fid.startswith("alloc_")}
    assert produced_alloc, "no per-class allocation figure was produced — the F-2 re-point is unexercised"


def test_unreachable_rows_are_declared_deliberately_not_by_omission():
    """An unreachable row is a decision, so it is written down as one."""
    unreachable = [f for f in REGISTRY if not f.pack_reachable]
    assert unreachable, (
        "no row is declared unreachable — either the census changed or the field went vacuous; "
        "this guard would then be asserting nothing"
    )
    for f in unreachable:
        assert f.endpoint, f"{f.figure_id}: unreachable rows must still name their canonical source"


# ── (2) Narrow-by-demand: the extension is exactly the demanded rows ──────────────────────────

def test_the_tier1a_worked_example_is_reachable():
    """"What is XIRR" is the ROADMAP's own tier-1(a) example, and it reaches TWO figures."""
    figs = figures_for_term("term-xirr-twr")
    assert {f.figure_id for f in figs} == {"xirr", "twr"}
    for f in figs:
        assert f.pack_reachable, (
            f"{f.figure_id} is demanded by term-xirr-twr — the ROADMAP's worked tier-1(a) example — "
            f"but the pack cannot produce it"
        )


async def test_xirr_and_twr_actually_appear_in_a_performance_pack(app_client):
    """THE FAIL-FIRST for the extension: seen RED before `want` gained the two labels."""
    facts = await _pack_labels(app_client, "How is my portfolio performing?")
    labels = {f["label"] for f in facts}
    figs = {figure_for_label(x).figure_id for x in labels if figure_for_label(x)}
    assert "xirr" in figs or "twr" in figs, (
        f"neither XIRR nor TWR reached the pack; figures present were {sorted(figs)}"
    )


# ── R-54 delta 4a / R2 — a term question surfaces the term's own figure (owner ruling 2026-07-22)
#
# The composition ruling: "extend gather so a term question pulls that term's registry figures
# (figures_for_term) into the pack when live; when the figure is null/uncovered, render an
# 'unavailable'-style served string rather than omitting it silently." The perf-pack test above
# walks the PERFORMANCE question; these walk the TERM/explanation question, which gathered no figure
# source at all (EXPLANATION_OF_METRIC → frozenset()), so the pack carried the explanation alone.


async def test_a_term_question_surfaces_the_terms_own_figures(app_client):
    """R2 (covered state): 'what is XIRR' — the TERM question, not the perf question — surfaces the
    term's canonical figures beside the explanation.

    FAIL-FIRST: RED before delta 4a — the dump showed `help:term-xirr-twr` alone, no XIRR/TWR figure.

    REDUNDANT-ROUTE AUDIT: distinct from `test_xirr_and_twr_actually_appear_in_a_performance_pack`,
    which reaches the figures through the PERFORMANCE intent. This asserts the composition path R2
    builds — a term explanation carrying its own figures — so a regression in either is
    distinguishable from the other.
    """
    facts = await _pack_labels(app_client, "what is XIRR")
    figs = {figure_for_label(f["label"]).figure_id for f in facts if figure_for_label(f["label"])}
    assert {"xirr", "twr"} <= figs, (
        f"'what is XIRR' did not surface both XIRR and TWR; figures present were {sorted(figs)}"
    )


async def test_a_null_term_figure_renders_unavailable_not_silently_omitted(app_client, monkeypatch):
    """R2 (null state): a term's uncovered figure renders an 'unavailable'-style served fact — the
    watchlist/GLD pattern (`tools.py:180`) — NEVER a silent omit (§7-B: a term with no live figure
    'explains the term and says so'; 'says so' wants a visible statement).

    FORCED NULL, DETERMINISTICALLY. TWR is date-aware and nulls on a fresh instance, but the demo
    seed happens to cover it — so the null is induced by withholding TWR from performance_facts,
    exactly the coverage-null shape. The RULE (present, not omitted) is what turns red; the
    'unavailable' STRING itself is PROPOSED and ratified by looking at 0a-ii (covered AND uncovered).

    FAIL-FIRST: on the pre-delta build `term_figure_facts` does not exist and the null figure was
    omitted entirely; RED as an AttributeError, then as a missing fact.
    """
    from app.ai import tools as T
    from app.db.base import get_sessionmaker

    real_perf = T.performance_facts

    async def _withhold_twr(session):
        return [f for f in await real_perf(session) if "TWR" not in f.label]

    monkeypatch.setattr(T, "performance_facts", _withhold_twr)
    async with get_sessionmaker()() as s:
        facts = await T.term_figure_facts(s, {"term-xirr-twr"})

    by_label = {f.label: f.value for f in facts}
    assert by_label.get("Money-weighted return (XIRR)"), (
        f"the covered figure did not carry a value; facts were {by_label}"
    )
    assert by_label.get("Time-weighted return (TWR)") == "unavailable", (
        f"the null figure was omitted or mis-rendered instead of 'unavailable'; facts were {by_label}"
    )


# ── (3) THE BOUNDARY GUARD — tier-1 may never name an unreachable figure ─────────────────────

def test_no_tier1_term_resolves_to_an_unreachable_figure():
    """THE RULED BOUNDARY (item 3). A term-* entry must not promise a figure the pack cannot serve.

    This is the resolution path tier-1(a) walks: `term-*` → reverse index → figure. If it lands on
    an unreachable row, the panel would name a number it cannot show — which is exactly the
    dead-affordance shape, in figures rather than links.

    **⊕ F-2 LANDED 2026-07-22 — the DEFERRED_TO_F2 exemption is DELETED.** The allocation rows were
    the live exception (unreachable; deferred because the four hardcoded buckets summed to 92.1%);
    F-2 re-pointed them to the per-class enum-derived census (sums to 100) and made them
    `pack_reachable=True`, so the carve-out — and the companion `test_the_f2_deferral_list_is_not_stale`
    that was built to red at this moment — are gone. This guard now runs with NO exemption: every
    figure a `term-*` entry resolves to must be pack-reachable, full stop.
    """
    term_ids = {f.term_id for f in REGISTRY if f.term_id}
    offenders = [
        f.figure_id
        for term_id in term_ids
        for f in figures_for_term(term_id)
        if not f.pack_reachable
    ]
    assert not offenders, (
        f"tier-1(a) can resolve these terms to figures the pack cannot produce: {offenders}. "
        f"Either extend the pack (narrow-by-demand) or the question must take the honest-miss shape."
    )


# ── F-2 THE CENSUS GUARD (owner ruling 2026-07-22) — enum-complete + sums to 100 ─────────────
#
# The four hardcoded key_stats buckets (`analytics.py`) omitted bond/retirement/other and summed to
# 92.1% — an untrue census, rendered nowhere. F-2 DELETES them and RE-POINTS the registry to the
# per-class, enum-derived census (allocation_by_class, the donut's source — one derivation). Two
# halves, both asserted here:


async def test_the_allocation_census_is_enum_complete_and_sums_to_100(app_client):
    """F-2 census guard. (a) ENUM-COMPLETE — the registry has an allocation row for EVERY positive
    AssetClass value, so no class can be silently dropped. (b) SUMS TO 100 — the SERVED allocation
    weights (per-class `allocation_facts`) sum to ~100 on real-shaped multi-class demo data (the set
    the four buckets rendered as 92.1%).

    FAIL-FIRST: RED today on (a) — the registry declares four COARSE `alloc_*` rows (cash_deposits /
    equities_etfs / crypto / alternatives), not per-class, so bond/retirement/other/… have no row.
    """
    from app.models import AssetClass

    positive = {ac.value for ac in AssetClass if ac is not AssetClass.LIABILITY}
    alloc_classes = {f.figure_id[len("alloc_"):] for f in REGISTRY if f.figure_id.startswith("alloc_")}
    assert positive <= alloc_classes, (
        f"the allocation census is not enum-complete — no registry row for: "
        f"{sorted(positive - alloc_classes)}. A class in no bucket is a silent drop (F-2 no-silent-drop)."
    )

    weights = []
    for f in await _pack_labels(app_client, "what is my allocation"):
        m = re.search(r"\(([\d,.]+)%\)$", f["value"])
        if f["label"].startswith("Allocation") and m:
            weights.append(float(m.group(1).replace(",", "")))
    assert weights, "no allocation weight facts served — (b) is vacuous"
    total = sum(weights)
    assert 99.5 <= total <= 100.5, (
        f"served allocation weights sum to {total:.2f}%, not ~100 — the F-2 shortfall survives"
    )


async def test_the_dead_four_buckets_no_longer_reach_the_stats_response(app_client):
    """F-2 fail-first (b): the four hardcoded bucket metrics are GONE from `/portfolio/stats` — the
    dead census is deleted, not merely bypassed. RED before removal (they were served)."""
    stats = (await app_client.get("/api/v1/portfolio/stats")).json()
    labels = {m["label"] for m in stats.get("metrics", [])}
    dead = {"Cash & deposits", "Equities & ETFs", "Crypto", "Alternatives"} & labels
    assert not dead, (
        f"the deleted four-bucket metrics still reach /portfolio/stats: {sorted(dead)} — F-2 removes "
        f"the dead census, it does not leave it served-but-unrendered"
    )


# ── §9-C's two fail-firsts ────────────────────────────────────────────────────────────────────

async def test_no_unprojected_float_reaches_the_served_pack(app_client):
    """A `to_display` float must never arrive as a fact value — the frontend formats nothing.

    ⚠ NARROWED, DELIBERATELY, AFTER A FALSE POSITIVE. The first draft rejected any bare decimal and
    fired on **`Return / volatility` = `11.82`** — a ratio, which is legitimately unitless and IS
    projected (2dp). *An assertion that reds on something correct is wrong about the product, not
    the other way round* (page-policy §13-1's corollary).

    What actually distinguishes an unprojected value is **precision**: `to_display` returns the raw
    float, so an escaped one carries the engine's full precision rather than the 2dp every
    projection imposes. That is what is asserted here — plus that money figures carry their
    currency, which no raw float ever does.

    **The residue F-5 exposed is now FIXED** (R-54 F-5, ruling 2026-07-21): `pct`/`ratio` render
    through money.py's per-kind variants, dispatched on the declared `value_kind`, so "no rendering
    logic outside money.py" holds for every value_kind-dispatched render. See
    `test_fact_pack_kinds.py`. (`count` has no renderer by ruling — no count fact is pack-reachable;
    per-item annotations ride F-7.)
    """
    MONEY_FIGURES = {"net_worth", "gross_assets", "liabilities", "unrealised_pl",
                     "todays_change", "realised_pl", "income"}
    for question in ("What is my net worth?", "How is my portfolio performing?"):
        for f in await _pack_labels(app_client, question):
            fig = figure_for_label(f["label"])
            if fig is None or f["value"] in ("unavailable", "—"):
                continue
            frac = re.search(r"\.(\d+)", f["value"])
            assert not (frac and len(frac.group(1)) > 2 and " " not in f["value"]), (
                f"{f['label']!r} served {f['value']!r} — more precision than any projection emits, "
                f"i.e. a raw engine float reached the pack (§9-C)."
            )
            if fig.figure_id in MONEY_FIGURES:
                assert re.search(r"[A-Z]{3}$", f["value"]), (
                    f"{f['label']!r} = {f['value']!r} carries no currency — a money figure that "
                    f"skipped the projection."
                )


async def test_money_facts_carry_the_projection_shape(app_client):
    """Money figures arrive grouped and currency-suffixed — the single rendering path's signature."""
    facts = await _pack_labels(app_client, "What is my net worth?")
    money = [f for f in facts
             if (fig := figure_for_label(f["label"])) and fig.figure_id in
             {"net_worth", "gross_assets", "liabilities", "unrealised_pl", "todays_change"}]
    assert money, f"no money figures in the pack — labels were {[f['label'] for f in facts]}"
    for f in money:
        assert _MONEY_FACT.match(f["value"]), (
            f"{f['label']!r} = {f['value']!r} does not match the projection's rendered shape"
        )


def test_the_pack_never_calls_to_display():
    """The bypass guard, AST-parsed: `to_display` returns a float and has no place in the pack."""
    tree = ast.parse((REPO / "app" / "ai" / "tools.py").read_text(encoding="utf-8"))
    hits = [
        node.lineno for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and (getattr(node.func, "id", None) or getattr(node.func, "attr", None)) == "to_display"
    ]
    assert not hits, (
        f"app/ai/tools.py calls to_display at line(s) {hits} — that returns a float "
        f"(money.py:80). Figures reach the pack through the projection only (§9-C)."
    )
    # Blindness pin: the rendering path must still be present, or this guard protects nothing.
    src = (REPO / "app" / "ai" / "tools.py").read_text(encoding="utf-8")
    assert "format_fact_display" in src, (
        "tools.py no longer renders through money.py — this guard has gone blind"
    )
