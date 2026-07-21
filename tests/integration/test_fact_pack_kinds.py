# SPDX-License-Identifier: AGPL-3.0-or-later
"""PER-KIND RENDERING IN THE FACT PACK — R-54 F-5 (owner ruling 2026-07-21, Q1/Q2 2026-07-21).

THE DEFECT
----------
F-3 moved the pack's MONEY rendering into ``money.py`` and deleted ``_fmt``. Three value kinds
survived that fix, still rendered INLINE in ``performance_facts`` (``app/ai/tools.py``)::

    if kind == "pct":   value = f"{round(float(v), 2)}%"
    elif kind == "ratio": value = f"{round(float(v), 2)}"
    elif kind == "count": value = f"{v}"

``round(float(v), 2)`` is float-based (banker's rounding — the same F-3(ii) class) AND it drops
trailing zeros, so the pack rendered percentages at a VARIABLE number of decimals: a Top-5
concentration of ``94.60375…`` reached the user as ``94.6%`` and a zero income yield as ``0.0%``,
directly beneath money figures rendered at fixed 2dp. One list, two rounding conventions.

THE RULING
----------
(a) The figure registry gains ``value_kind`` (money/pct/ratio/count) as a DECLARED column;
    rendering dispatches on the declared kind, NEVER inferred from the value (the F5-identity lesson
    applied to units). Its authority is cited per row: stats-served figures cite ``analytics.py``'s
    per-metric ``kind`` (parity-guarded here); summary-served figures cite the canonical page's
    derivation clause.
(b) ``money.py`` owns per-kind named variants — no value_kind-dispatched inline formatting survives.
    (Scoped 2026-07-21: per-item annotations like allocation weights are NOT registry figures and
    ride F-7, not this delta. Their byte-identity is asserted below.)
(c) Blast radius proven the F-3 way — byte-identity for every unaffected rendering, movers
    enumerated by ruled class.
(d) 0a gains one fact per kind (count excepted — no count fact is pack-reachable, Q2).
(e) ``Return / volatility`` stays a UNITLESS RATIO — the false-positive lesson rides the record.

Q2 (count): Positions is the only count figure and is ``pack_reachable=False``, so no count fact
reaches the panel. It DECLARES ``value_kind="count"`` for parity completeness, but there is NO
``format_count_display`` — a formatter with no live caller is the code shape of a dead affordance.
A tripwire reds the moment a ``pack_reachable`` count row appears without a renderer.

ASSERTED AT THE SERVED PACK (the F5 level) for the capability, and at the unit level for the
blast radius. The capability probes carry the redundant-route audit (F-6 consequence).
"""

from __future__ import annotations

import ast
import json
import re
from decimal import Decimal
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]


async def _pack(app_client, question: str) -> list[dict]:
    r = await app_client.post("/api/v1/ai/chat", json={"question": question})
    assert r.status_code == 200
    facts: list[dict] = []
    for line in r.text.splitlines():
        if line.startswith("data:"):
            ev = json.loads(line[5:].strip())
            if ev.get("type") == "facts":
                facts = ev["facts"]
    return facts


def _find(facts: list[dict], label: str) -> dict | None:
    for f in facts:
        if f["label"] == label:
            return f
    return None


# ── THE FAIL-FIRST — the served pack, real (demo) values ─────────────────────────────────────
# Redundant-route audit (F-6): asserting "some pct fact has 2dp" would pass on a value that already
# had two decimals and tell us nothing. The GUARANTEED served RED is Income yield below — 0.0 on the
# demo seed, so its old render is always the one-decimal '0.0%', deterministically. The computed
# probe asserts the fixed-2dp SHAPE on a genuinely-computed non-zero value; its exact number is NOT
# pinned (Top-5 concentration shifts with FX/quote state across suite contexts — a separate concern
# from this delta's rendering), and the exact trailing-zero → fixed-2dp proof lives in the
# deterministic unit blast-radius test below (controlled input 94.60375 → 94.60).

async def test_a_zero_percentage_renders_at_fixed_two_decimals(app_client):
    """THE FAIL-FIRST. Income yield is 0.0 on the demo seed — RED before the fix, rendering '0.0%'.

    Deterministic in every suite context (demo income is zero), so this is the guaranteed served RED
    that the fixed-2dp variant is on the wire, not the inline float-str form.
    """
    facts = await _pack(app_client, "How is my portfolio performing and what's the risk?")
    yld = _find(facts, "Income yield")
    assert yld is not None, f"no income-yield fact; labels were {[f['label'] for f in facts]}"
    assert yld["value"] == "0.00%", (
        f"Income yield rendered {yld['value']!r} — a zero percentage renders 0.00%, not 0.0%."
    )


async def test_a_computed_percentage_renders_at_fixed_two_decimals(app_client):
    """A genuinely-computed non-zero percentage renders at EXACTLY 2dp — the money.py variant's
    signature — never at float-str's variable precision.

    The SHAPE is asserted, not the exact value: Top-5 concentration is deterministically computed
    but its precise number moves with cross-test FX/quote state, so pinning it is brittle (it was,
    at the full-suite gate). The fixed-2dp property is the invariant the fix guarantees.
    """
    facts = await _pack(app_client, "How is my portfolio performing and what's the risk?")
    conc = _find(facts, "Top 5 concentration")
    assert conc is not None, f"no concentration fact; labels were {[f['label'] for f in facts]}"
    assert re.match(r"^-?\d+\.\d{2}%$", conc["value"]), (
        f"Top 5 concentration rendered {conc['value']!r} — a computed percentage must render at "
        f"fixed 2dp (money.py), not at float-str's variable precision."
    )


async def test_return_volatility_stays_a_unitless_ratio(app_client):
    """Ruling (e), the false-positive lesson: it is a RATIO — no '%', no currency, ≤2dp.

    Date-aware (None when the window is uncovered), so the probe tolerates absence but pins the
    SHAPE whenever it is present — a ratio wearing a '%' would be the regression this guards.
    """
    facts = await _pack(app_client, "How is my portfolio performing and what's the risk?")
    rv = _find(facts, "Return / volatility")
    if rv is None or rv["value"] in ("unavailable", "—"):
        pytest.skip("Return / volatility not covered on this run (date-aware) — shape untestable")
    assert "%" not in rv["value"], f"ratio rendered with a percent sign: {rv['value']!r}"
    assert not re.search(r"[A-Z]{3}", rv["value"]), f"ratio rendered with a currency: {rv['value']!r}"
    frac = re.search(r"\.(\d+)", rv["value"])
    assert frac is None or len(frac.group(1)) == 2, f"ratio not at 2dp: {rv['value']!r}"


async def test_total_return_the_dedupe_winner_renders_through_money_py(app_client):
    """total_return is rendered by portfolio_facts:89, which WINS `_dedupe` (first-wins) over
    performance_facts' copy — the F-3 'the formatter exists but is bypassed' lesson recurring at
    the DEDUPE layer (recorded, ruling disclosure 2). So the winning site must render via money.py
    too, or the user-facing Total return keeps its inline format however clean performance_facts is.

    total_return_pct is a pre-quantized 2dp Decimal, so this is byte-identical below 1000% — the
    move is for architecture, not a live defect. The probe asserts the fixed-2dp shape.
    """
    facts = await _pack(app_client, "What is my total return?")
    tr = _find(facts, "Total return")
    assert tr is not None, f"no Total return fact; labels were {[f['label'] for f in facts]}"
    assert re.match(r"^-?[\d,]+\.\d{2}%$", tr["value"]), (
        f"Total return rendered {tr['value']!r} — expected a fixed-2dp percentage."
    )


# ── F-7 CONFORMANCE (owner ruling 2026-07-22) — the pack-context annotation tier is DECLARED ──
#
# ⊕ 2026-07-22 — THIS PIN WAS DELIBERATELY UPDATED (the guard-REDs-an-accepted-surface rite).
# It formerly pinned the `.1f%` one-decimal form and the `Allocation (asset_class) — <raw enum>`
# label as byte-identical — the F-5 delta's proof that it left F-7 alone. F-7 is now RULED: sites
# 1/4/5 conform to the canonical 2dp variant (Q1, ending the two-faces defect W-2 named), and the
# allocation LABEL becomes `Allocation — <served class label>` via `label_for` (Q2 — the token
# `asset_class` and the raw enum both gone). So this pin FLIPS: it now proves the conformed form.
# DATED NOTE: the pre-F-7 one-decimal/raw-enum ratification is superseded here on 2026-07-22.

async def test_allocation_weight_annotation_conforms_to_2dp_and_the_served_class_label(app_client):
    """F-7 Q1+Q2: the allocation weight renders at 2dp through money.py, and the label is
    `Allocation — <served class label>` (label_for/MASTER-DATA) — no `(asset_class)` wrapper, no raw
    enum. FAIL-FIRST: RED on the pre-F-7 build (`.1f` inline + `Allocation (asset_class) — equity`)."""
    facts = await _pack(app_client, "What is my allocation?")
    allocs = [f for f in facts if f["label"].startswith("Allocation")]
    assert allocs, f"no allocation facts; labels were {[f['label'] for f in facts]}"
    for f in allocs:
        assert f["label"].startswith("Allocation — "), (
            f"{f['label']!r} — the label must read `Allocation — <class label>`; the `(asset_class)` "
            f"wrapper and the raw enum leak into user copy (F-7 Q2, W-2)."
        )
        assert "asset_class" not in f["label"] and "native_currency" not in f["label"], (
            f"{f['label']!r} still carries an internal dimension token (F-7 Q2)."
        )
        assert re.search(r"\(\d[\d,]*\.\d{2}%\)$", f["value"]), (
            f"{f['label']!r} = {f['value']!r} — the weight must render at fixed 2dp through money.py "
            f"(F-7 Q1), ending the two-faces split with the 2dp concentration figures."
        )


async def test_holdings_weight_annotation_conforms_to_2dp(app_client):
    """F-7 Q1: the per-holding weight renders at 2dp, so the largest holding no longer wears two
    faces — `Largest position NN.NN%` (registry) and its holdings-weight annotation now agree.
    FAIL-FIRST: RED on the pre-F-7 `.1f` form."""
    facts = await _pack(app_client, "What are my largest holdings?")
    weighted = [f for f in facts if re.search(r"\([\d,.]+%\)$", f["value"]) and not f["label"].startswith(("Allocation", "Help"))]
    assert weighted, f"no per-holding weight annotations; labels were {[f['label'] for f in facts]}"
    for f in weighted:
        assert re.search(r"\(\d[\d,]*\.\d{2}%\)$", f["value"]), (
            f"{f['label']!r} = {f['value']!r} — the holdings weight must render at fixed 2dp (F-7 Q1)."
        )


def test_no_ambient_pct_fstring_survives_in_the_pack():
    """F-7 CENSUS GUARD (ruling 2026-07-22): the pack-context annotation tier is DECLARED — every
    non-registry pct annotation renders through a money.py variant, never an inline f-string. This
    AST-scans `app/ai/tools.py` and reds if any f-string still formats a float AND appends a '%'
    (the five sites F-7 conformed). The registry figures were the F-5 census; this is the second-
    tier census — *no ambient annotation f-string survives in either.*

    FAIL-FIRST: RED on the pre-F-7 build (5 inline `:.1f}%`/`:+.2f}%` sites).
    """
    tree = ast.parse((REPO / "app" / "ai" / "tools.py").read_text(encoding="utf-8"))
    offenders = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.JoinedStr):
            continue
        has_pct = any(
            isinstance(p, ast.Constant) and isinstance(p.value, str) and "%" in p.value
            for p in node.values
        )
        floaty = [
            spec
            for p in node.values
            if isinstance(p, ast.FormattedValue) and p.format_spec is not None
            for spec in ["".join(
                c.value for c in p.format_spec.values
                if isinstance(c, ast.Constant) and isinstance(c.value, str)
            )]
            if re.search(r"\.\d+f", spec)
        ]
        if has_pct and floaty:
            offenders.append(node.lineno)
    assert not offenders, (
        f"ambient pct f-string(s) survive in app/ai/tools.py at line(s) {sorted(offenders)} — "
        f"every pack-context annotation must render through a money.py variant (F-7 declared tier), "
        f"never an inline float-and-'%'."
    )


def test_the_pack_context_tier_is_declared_not_ambient():
    """The declared second tier exists and is enumerated (blindness pin for the census above): a
    census that guarded an empty declaration would pass by protecting nothing."""
    from app.ai.tools import PackContext, format_pack_context

    # Both ruled kinds are declared and render through money.py at 2dp.
    assert format_pack_context(Decimal("80.554"), PackContext.WEIGHT) == "80.55%", "weight → 2dp unsigned"
    assert format_pack_context(Decimal("-2.134"), PackContext.CHANGE) == "−2.13%", (
        "change → 2dp signed with the U+2212 minus (Q3), not an ASCII hyphen"
    )
    assert format_pack_context(Decimal("2.134"), PackContext.CHANGE) == "+2.13%", "change → explicit +"


# ── THE BLAST-RADIUS PIN (ruling c) — unit level, deterministic ──────────────────────────────
# Every rendering the fix was not meant to change is byte-identical to the inline form it replaced;
# every rendering that DID move is enumerated by its ruled class. A formatter change is only safe
# if you can name exactly what moved.

def _legacy_pct(v) -> str:
    """The pct branch exactly as it stood before F-5 — the comparison baseline only."""
    return f"{round(float(v), 2)}%"


def _legacy_ratio(v) -> str:
    """The ratio branch exactly as it stood before F-5."""
    return f"{round(float(v), 2)}"


# Values already at a clean 2dp with no boundary or grouping difference — old == new, byte-identical.
UNAFFECTED = ["14.98", "80.55", "-2.15", "0.67", "14.22", "94.61", "-0.01", "0.34"]

# Ruled class 1 — TRAILING ZEROS. float-str drops them; the fixed-2dp variant keeps them.
MOVED_TRAILING_ZERO = {
    "0.0": "0.00", "94.60375092138891": "94.60", "5.0": "5.00", "12.5": "12.50",
}
# Ruled class 2 — HALF-CENT: banker's/float rounding replaced by HALF_UP, the product's convention.
MOVED_HALF_UP = {"0.125": "0.13", "2.675": "2.68"}


def test_every_unaffected_percentage_is_byte_identical():
    from app.core.money import format_pct_display

    for v in UNAFFECTED:
        assert format_pct_display(Decimal(v)) == _legacy_pct(v), (
            f"{v}% rendered differently — this value was NOT in the fix's intended blast radius"
        )


def test_trailing_zero_percentages_move_to_fixed_two_decimals():
    from app.core.money import format_pct_display

    for v, digits in MOVED_TRAILING_ZERO.items():
        assert format_pct_display(Decimal(v)) == f"{digits}%"
        assert _legacy_pct(v) != f"{digits}%", (
            f"{v} already rendered {digits}% inline — the baseline assumption has drifted"
        )


def test_half_cent_percentages_unify_to_half_up():
    from app.core.money import format_pct_display

    for v, digits in MOVED_HALF_UP.items():
        assert format_pct_display(Decimal(v)) == f"{digits}%"


def test_ratio_rendering_matches_the_same_classes():
    from app.core.money import format_ratio_display

    assert format_ratio_display(Decimal("11.84")) == _legacy_ratio("11.84")  # unaffected
    assert format_ratio_display(Decimal("11.8")) == "11.80"                   # trailing zero
    assert _legacy_ratio("11.8") == "11.8"
    assert format_ratio_display(Decimal("0.125")) == "0.13"                   # half-up


def test_none_passes_through_for_pct_and_ratio():
    """Guarantee 3: an unavailable metric stays honestly empty, never a fabricated 0% or 0.00."""
    from app.core.money import format_pct_display, format_ratio_display

    assert format_pct_display(None) is None
    assert format_ratio_display(None) is None


# ── THE COUNT TRIPWIRE (Q2 ruling) ────────────────────────────────────────────────────────────

def test_count_has_no_renderer_and_no_reachable_row_demands_one():
    """A pack-reachable count row with no registered renderer turns RED (Q2).

    Positions declares value_kind='count' but is pack_reachable=False, so no count fact reaches the
    panel and no format_count_display exists — a formatter with no caller is a dead affordance. The
    moment a count fact becomes reachable (F-2 territory or a demand ruling), the missing renderer
    announces itself here rather than defaulting silently.
    """
    from app.core.money import _FACT_KIND_RENDERERS
    from app.services.figure_registry import REGISTRY

    offenders = [
        f.figure_id for f in REGISTRY
        if f.pack_reachable and f.value_kind == "count" and "count" not in _FACT_KIND_RENDERERS
    ]
    assert not offenders, (
        f"a pack-reachable count figure has no count renderer: {offenders}. A count fact now ships "
        f"— register format_count_display in money.py before it renders (R-54 F-5 Q2 tripwire)."
    )
    # Blindness pin: there must BE a count figure, or this guard passes by protecting nothing.
    assert any(f.value_kind == "count" for f in REGISTRY), (
        "no figure declares value_kind='count' — the tripwire has gone blind"
    )


def test_the_dispatcher_raises_on_an_unrendered_kind():
    """The code-level tripwire: a count value reaching the dispatcher fails LOUD, never silently."""
    from app.core.money import format_fact_by_kind

    with pytest.raises(ValueError, match="count"):
        format_fact_by_kind(14, "count", "SGD")


# ── PARITY: the registry's declared value_kind == analytics' authoritative kind ───────────────

async def test_value_kind_matches_analytics_for_every_stats_metric():
    """Ruling (a) sourcing: for a stats-served figure, analytics' declared `kind` is the AUTHORITY,
    and the registry's `value_kind` must equal it. Checked against the RUNTIME metrics analytics
    actually emits — the served declaration, not a re-typed copy.

    Redundant-route audit (F-6): comparing the registry to a hand-written kind map in this test
    would be circular. It reads analytics' live `kind` instead, so the two independent declarations
    must genuinely agree.
    """
    from app.db.base import get_sessionmaker
    from app.services.analytics import key_stats
    from app.services.figure_registry import figure_for_label

    async with get_sessionmaker()() as s:
        ks = await key_stats(s, "SGD")

    checked = 0
    for m in ks["metrics"]:
        fig = figure_for_label(m["label"])
        assert fig is not None, (
            f"analytics serves metric {m['label']!r} with no registry row — every served figure "
            f"must be declared (the census is the registry's job)"
        )
        assert fig.value_kind == m["kind"], (
            f"{fig.figure_id}: registry value_kind={fig.value_kind!r} but analytics declares "
            f"kind={m['kind']!r} for {m['label']!r}. Analytics is the authority; the registry cites it."
        )
        checked += 1
    assert checked >= 19, f"only {checked} analytics metrics checked — the parity guard went blind"


def test_every_registry_row_declares_a_known_value_kind():
    """A declared column is only as good as its domain. An unknown kind would dispatch to nothing."""
    from app.services.figure_registry import REGISTRY

    known = {"money", "pct", "ratio", "count"}
    for f in REGISTRY:
        assert f.value_kind in known, (
            f"{f.figure_id}: value_kind={f.value_kind!r} is not one of {sorted(known)}"
        )


# ── ONE HOME FOR RENDERING — the F-5 completion of 'no rendering logic outside money.py' ──────

def test_performance_facts_no_longer_rounds_floats_inline():
    """The F-5 inline signature `round(float(...))` is gone from the pack — money.py owns it now.

    AST-parsed, NOT a substring scan: this docstring and the code comments quote the old form
    verbatim, and *a guard that reads comments finds claims, not code* (the Phase 0-1 lesson — the
    "only one router on disk" guard first RED on a comment). Only a real `round(float(...))` call
    counts.
    """
    import ast
    from pathlib import Path

    src = (Path(__file__).resolve().parents[2] / "app" / "ai" / "tools.py").read_text()
    tree = ast.parse(src)
    inline = [
        node.lineno
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and getattr(node.func, "id", None) == "round"
        and node.args
        and isinstance(node.args[0], ast.Call)
        and getattr(node.args[0].func, "id", None) == "float"
    ]
    assert not inline, (
        f"app/ai/tools.py still rounds a float inline at line(s) {inline} — that is F-5's defect, "
        f"and rendering logic outside money.py is the F-3/F-6 shape."
    )
    # Blindness pin: the pack must still dispatch through money.py, or this guard protects nothing.
    assert re.search(r"\bformat_fact_by_kind\b", src), (
        "tools.py no longer calls format_fact_by_kind — the per-kind rendering path is gone"
    )
