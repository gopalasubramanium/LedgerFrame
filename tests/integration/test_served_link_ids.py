# SPDX-License-Identifier: AGPL-3.0-or-later
"""SERVED SEMANTIC LINK IDs — R-54 §9-D, Phase 0-5.

*Owner:* "Strict separation of concerns — backend issues semantic IDs, frontend maps them to
routes — coupled with a bidirectional resolution guard eliminates silent dead-link failures."

This file is the **served half**. The backend issues `<kind>:<key>` IDs; the frontend's ID→route
registry lands in Phase 1. What is guarded here:

* every served ID is **well-formed** and of a **known kind**;
* every `help:` ID names an entry the **served Help catalogue actually contains**;
* every `page:` ID names a route **`AppRoutes.tsx` actually registers** — checked against the real
  router, so a dead destination reds here rather than surviving to Phase 1;
* a fact with no canonical destination carries **no link at all** — `None` is the honest answer.

CAPABILITY PROBES (owner ruling 2026-07-21, item 2a). Property guards alone are what let F-6 ship:
they proved the thing that changed and never asked whether the capability still worked. So the
probes below drive **real questions end-to-end at the served surface** and assert the link a user
would actually follow.

THE REDUNDANT-ROUTE AUDIT (item 2b) is written into each probe: every assertion states what OTHER
route could satisfy it, and distinguishes them where two exist. *An assertion reachable two ways
cannot tell you which one broke.*
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from app.services.figure_registry import REGISTRY

REPO = Path(__file__).resolve().parents[2]
KNOWN_KINDS = {"help", "page"}


async def _facts(app_client, question: str) -> list[dict]:
    r = await app_client.post("/api/v1/ai/chat", json={"question": question})
    assert r.status_code == 200
    out: list[dict] = []
    for line in r.text.splitlines():
        if line.startswith("data:"):
            ev = json.loads(line[5:].strip())
            if ev.get("type") == "facts":
                out = ev["facts"]
    return out


def _registered_routes() -> set[str]:
    """Every path `AppRoutes.tsx` registers — the LIVE catalogue, read from the router itself."""
    src = (REPO / "frontend" / "src" / "AppRoutes.tsx").read_text(encoding="utf-8")
    paths = set(re.findall(r'<Route\s+path="([^"]+)"', src))
    return {("/" if p == "/" else "/" + p.lstrip("/")) for p in paths}


# ── Well-formedness and kind ─────────────────────────────────────────────────────────────────

async def test_every_served_link_id_is_wellformed_and_of_a_known_kind(app_client):
    for question in ("What is my net worth?", "what is XIRR", "how do I add a holding"):
        for f in await _facts(app_client, question):
            link = f.get("link_id")
            if link is None:
                continue
            assert ":" in link, f"{f['label']!r} served the unnamespaced link id {link!r}"
            kind = link.split(":", 1)[0]
            assert kind in KNOWN_KINDS, (
                f"{f['label']!r} served link id {link!r} of unknown kind {kind!r} — a kind the "
                f"frontend registry will not know how to resolve is a dead link by construction"
            )


# ── The served half of the bidirectional guard ───────────────────────────────────────────────

async def test_every_help_link_id_names_a_real_served_help_entry(app_client):
    """`help:<id>` must exist in the SERVED catalogue — the same store the Help page renders.

    REDUNDANT-ROUTE AUDIT: this could pass if the ids were checked against `app.services.help.HELP`
    directly, which is the store the pack itself reads — circular, and green even if the endpoint
    served something else. It is therefore checked against **`GET /api/v1/help`**, the catalogue a
    deep link actually resolves against (`Help.tsx:334` matches on served entry ids).
    """
    served = {e["id"] for e in (await app_client.get("/api/v1/help")).json()["entries"]}
    assert served, "the served help catalogue is empty — this guard would be vacuous"

    for question in ("what is XIRR", "how do I add a holding", "what is cash runway"):
        for f in await _facts(app_client, question):
            link = f.get("link_id")
            if link and link.startswith("help:"):
                assert link.split(":", 1)[1] in served, (
                    f"{f['label']!r} links to {link!r}, which the served Help catalogue does not "
                    f"contain — an unknown ?topic= is a SILENT no-op (Help.tsx:302,309), so this "
                    f"would fail invisibly in the product"
                )


def test_every_declared_canonical_page_is_a_route_the_app_registers():
    """`page:` IDs may only name routes that exist TODAY — the dead-affordance rule, in figures.

    REDUNDANT-ROUTE AUDIT: asserting against a hardcoded list of paths in this file would pass
    while `AppRoutes.tsx` said something else. The router source is parsed instead, so the claim is
    about the app rather than about this test's own expectations.
    """
    routes = _registered_routes()
    assert routes, "no routes parsed from AppRoutes.tsx — the parser drifted and this guard is blind"

    for f in REGISTRY:
        if f.canonical_page:
            assert f.canonical_page in routes, (
                f"{f.figure_id} declares canonical_page {f.canonical_page!r}, which AppRoutes.tsx "
                f"does not register. A link may only target a route that exists today."
            )


def test_every_registry_row_declares_a_canonical_page():
    """Coverage: a row with no page is a figure whose link would silently be omitted."""
    missing = [f.figure_id for f in REGISTRY if not f.canonical_page]
    assert not missing, f"rows with no declared canonical_page: {missing}"


# ── FORWARD CLOSURE: every served ID is REGISTERED in the frontend (R-54 §9-D, Phase 1 delta 3) ─
#
# The route checks above assert `canonical_page` names a route AppRoutes REGISTERS. But the
# frontend registry (`frontend/src/nav/askLinks.ts`) only resolves the BUILT NAV PAGES — a strict
# subset of AppRoutes (which also carries /kitchen-sink, redirects, /instrument/:symbol). So a
# `canonical_page` that is a real route but NOT a nav page would pass every check above and still
# resolve to `null` in the panel — a silent dead link. These close that gap by reading the
# frontend registry's OWN accepted sets, so the served IDs and the resolver can never diverge.


def _frontend_page_routes() -> set[str]:
    """The routes `askLinks.ts` will actually resolve — parsed from the frontend nav model."""
    src = (REPO / "frontend" / "src" / "components" / "ui" / "nav.ts").read_text(encoding="utf-8")
    # NAV_GROUPS items are one-per-line `{ label: "...", path: "/x", built: true }`.
    return set(re.findall(r'path:\s*"([^"]+)",\s*built:\s*true', src))


def _frontend_link_kinds() -> set[str]:
    """The kinds `askLinks.ts` maps — parsed from its `KNOWN_LINK_KINDS` literal."""
    src = (REPO / "frontend" / "src" / "nav" / "askLinks.ts").read_text(encoding="utf-8")
    m = re.search(r"KNOWN_LINK_KINDS\s*=\s*\[([^\]]*)\]", src)
    assert m, "could not find KNOWN_LINK_KINDS in askLinks.ts — the parser drifted, guard is blind"
    return set(re.findall(r'"([^"]+)"', m.group(1)))


def test_every_canonical_page_resolves_in_the_frontend_registry():
    """Every served `page:` route is one the frontend registry accepts — not merely a live route."""
    frontend_routes = _frontend_page_routes()
    assert frontend_routes, "no nav routes parsed from nav.ts — the parser drifted, guard is blind"
    for f in REGISTRY:
        if f.canonical_page:
            assert f.canonical_page in frontend_routes, (
                f"{f.figure_id} declares canonical_page {f.canonical_page!r}, which the frontend "
                f"registry (nav.ts built pages) will not resolve — the panel would omit the link "
                f"silently even though AppRoutes registers the route"
            )


def test_every_frontend_nav_route_is_a_route_the_router_registers():
    """Registered → live: every route the frontend registry accepts is one AppRoutes registers.

    Closes the last leg of the loop. The forward guard above proves `canonical_page ⊆ nav routes`;
    this proves `nav routes ⊆ AppRoutes routes`, so a served `page:` ID resolves to a route that
    actually mounts — not merely one the nav model names. (Parsed in Python because the resolver's
    accepted set is `nav.ts`, which jsdom/vitest cannot read as a file here.)
    """
    nav_routes = _frontend_page_routes()
    live = _registered_routes()
    assert nav_routes and live, "a parser drifted — one of the sets is empty and this guard is blind"
    orphans = nav_routes - live
    assert not orphans, f"nav routes the router does not register (dead links): {sorted(orphans)}"


def test_the_served_kinds_and_the_frontend_resolver_kinds_are_the_SAME_set():
    """Bidirectional kind closure: a backend kind the resolver lacks is a dead link; an extra
    resolver kind is dead code. The two literals — KNOWN_KINDS here, KNOWN_LINK_KINDS in
    askLinks.ts — are pinned equal so neither can drift without the other going red."""
    assert _frontend_link_kinds() == KNOWN_KINDS, (
        f"served kinds {KNOWN_KINDS} != frontend resolver kinds {_frontend_link_kinds()} — "
        f"one side can serve/resolve an ID the other cannot"
    )


# ── Capability probes: real questions → the link a user would follow ─────────────────────────

@pytest.mark.parametrize("question,expected_link", [
    # tier-1(a): the ROADMAP's own worked example.
    ("what is XIRR", "help:term-xirr-twr"),
    ("what is cash runway", "help:term-cash-runway"),
])
async def test_a_term_question_serves_the_link_to_that_terms_help_entry(
    app_client, question, expected_link
):
    """CAPABILITY PROBE — the end-to-end path a user walks, not the property that changed.

    REDUNDANT-ROUTE AUDIT: asserting merely that *some* `help:` link is present would pass on ANY
    help entry the ranker happened to return — including a wrong one. The EXACT expected id is
    asserted, so retrieving the wrong entry is distinguishable from retrieving none.
    """
    links = {f.get("link_id") for f in await _facts(app_client, question)}
    assert expected_link in links, (
        f"{question!r} did not serve {expected_link!r}; links present were "
        f"{sorted(x for x in links if x)}"
    )


async def test_a_figure_fact_links_to_the_page_that_owns_it(app_client):
    """CAPABILITY PROBE — Net worth links to /net-worth, and P/L links to /portfolio.

    REDUNDANT-ROUTE AUDIT: asserting only that a `page:` link exists would pass if EVERY figure
    linked to the same page — the exact failure a per-producer stamp would cause. Two figures with
    DIFFERENT owning pages are asserted, so a collapsed mapping cannot pass.
    """
    by_label = {f["label"]: f.get("link_id") for f in await _facts(app_client, "What is my net worth?")}
    assert by_label.get("Net worth") == "page:/net-worth", by_label
    assert by_label.get("Unrealised P/L") == "page:/portfolio", by_label


async def test_a_fact_with_no_canonical_destination_carries_no_link(app_client):
    """`None` is a real answer — tier-1 must not invent a destination.

    REDUNDANT-ROUTE AUDIT: a test that only checked *some* fact lacks a link would pass trivially
    on any unmatched string. A fact with no registry row is targeted specifically (per-instrument
    and per-bucket facts), so the assertion is about the RULE rather than about coincidence.
    """
    facts = await _facts(app_client, "How did the markets do today?")
    unlinked = [f for f in facts if f.get("link_id") is None]
    assert unlinked, (
        f"every fact carried a link — the None path is unexercised and this guard is vacuous; "
        f"labels were {[f['label'] for f in facts]}"
    )
