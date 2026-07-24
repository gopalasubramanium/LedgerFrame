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


def _settings_tab_ids() -> set[str]:
    """The Settings tab ids the app registers — parsed from `Settings.tsx`'s TAB_IDS literal."""
    src = (REPO / "frontend" / "src" / "routes" / "Settings.tsx").read_text(encoding="utf-8")
    m = re.search(r"TAB_IDS:\s*TabId\[\]\s*=\s*\[([^\]]*)\]", src)
    assert m, "could not find TAB_IDS in Settings.tsx — the parser drifted, this guard is blind"
    return set(re.findall(r'"([^"]+)"', m.group(1)))


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


async def test_a_deep_link_target_still_obeys_the_acceptance_gate(app_client):
    """§9-E item 3 (owner ruling): a deep link NEVER bypasses the acceptance gate — the server
    refuses regardless. Navigation confers no authority: a tier-1 `page:` link is a URL, and the
    page it lands on reads gated endpoints like any other. REPRESENTATIVE, not a matrix.

    The link *"how do I add a holding"* → `page:/holdings` resolves to the Holdings page, whose
    primary read is `GET /portfolio/holdings` (§0-D). On an unaccepted install that read is 451, so
    following the deep link lands on a page that refuses to load its data until the terms are
    accepted — exactly as if the user had navigated there by hand. The client is NOT where this is
    enforced (§9-E), so this is a server assertion, not a UI matrix.
    """
    from sqlalchemy import delete

    from app.db.base import get_session
    from app.models import LegalAcceptanceEvent

    # The served link a user would follow, and the gated endpoint its destination page reads.
    # R-59 §59-2: tier-1(b) now serves the form DEEP LINK (page:/holdings?add=1); the destination
    # page is still /holdings, whose primary read is gated identically — navigation confers no
    # authority whether or not the URL carries the ?add= param.
    links = {f.get("link_id") for f in await _facts(app_client, "how do I add a holding")}
    assert "page:/holdings?add=1" in links, (
        f"the deep-link premise changed — page:/holdings?add=1 was not served; links were "
        f"{sorted(x for x in links if x)}"
    )
    holdings_data = "/api/v1/portfolio/holdings"

    async for s in get_session():  # return the install to 'never answered'
        await s.execute(delete(LegalAcceptanceEvent))
        await s.commit()
        break

    r = await app_client.get(holdings_data)
    assert r.status_code == 451, (
        f"{holdings_data} answered {r.status_code} on an UNACCEPTED install — a deep link would "
        f"then reach page data that skipped the gate. Navigation confers no authority (§9-E): the "
        f"451/PIN layers refuse whatever the URL says."
    )


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


# ── R-54 delta 4a / R1 — a help fact POINTS WHERE YOU ACT (owner ruling 2026-07-22) ───────────
#
# The composition ruling: an action/navigation answer links to the PAGE/TAB where the user acts,
# not back at the same help entry — the help CONTENT is already shown inline as the fact, so the
# pointer's value is going where the action happens. A `page-<route>` help fact therefore targets
# `page:/<route>`, and a Settings help fact carries the tab for the topic asked.


async def test_a_page_help_fact_points_at_the_page_not_back_at_itself(app_client):
    """R1(i): a `page-<route>` help fact targets `page:/<route>`, NOT `help:page-<route>`.

    FAIL-FIRST: RED before delta 4a — `help_facts` stamped `help:{id}` uniformly, so the
    Help·Holdings fact linked to `help:page-holdings`, re-opening the entry already shown inline.

    R-59 §59-2: an ADD-A-HOLDING question now points at the form DEEP LINK (`page:/holdings?add=1`),
    not the bare page — the R-54 tier-1(b) example, buildable now that the `?add=` route ships. The
    ordering was mechanical (test_the_add_holding_deep_link_param_is_a_param_the_route_reads): the
    form ID could not be registered before its param was honored.

    REDUNDANT-ROUTE AUDIT: asserting that SOME page: link exists would pass on the figure facts
    (Net worth → page:/net-worth) already in this pack. The Help·Holdings fact is targeted by its
    own label, so this is about the HELP fact's retargeting, not a figure's.
    """
    by_label = {f["label"]: f.get("link_id") for f in await _facts(app_client, "how do I add a holding")}
    assert by_label.get("Help · Holdings") == "page:/holdings?add=1", (
        f"the page-holdings help fact did not point at the add-form deep link; links were {by_label}"
    )


async def test_a_settings_topic_question_points_at_the_relevant_tab(app_client):
    """R1(ii): a Settings help fact carries a tab-scoped link for the topic asked — 'change the
    theme' → the Appearance tab, the ruling's own worked example.

    FAIL-FIRST: RED before delta 4a (no `?tab=`, and the link was `help:page-settings`).

    REDUNDANT-ROUTE AUDIT: asserting only `page:/settings` (tab-less) would pass without the tab
    refinement. The EXACT `?tab=appearance` is asserted, so a missing or wrong tab is
    distinguishable from a bare settings link.
    """
    by_label = {f["label"]: f.get("link_id") for f in await _facts(app_client, "how do I change the theme")}
    assert by_label.get("Help · Settings") == "page:/settings?tab=appearance", (
        f"the settings help fact did not carry the Appearance tab; links were {by_label}"
    )


def test_every_pages_help_entry_maps_to_a_registered_route():
    """R1(i), the invariant behind the retarget: the `page-<slug>` → `/<slug>` derivation is exact,
    not hopeful. EVERY Pages-category help entry resolves to a route AppRoutes registers, so a slug
    that stops matching a route reds HERE rather than serving a dead `page:` link in the panel.

    Blindness pin: an empty Pages set (store renamed the category, or the derivation stopped
    recognising `page-*`) fails loudly rather than passing by checking nothing.
    """
    from app.ai.tools import _page_help_route
    from app.services.help import HELP

    routes = _registered_routes()
    pages = [e for e in HELP if e.get("category") == "Pages"]
    assert pages, "no Pages-category help entries found — the store/derivation drifted, guard is blind"
    for e in pages:
        route = _page_help_route(e["id"])
        assert route and route in routes, (
            f"{e['id']!r} derives route {route!r}, which AppRoutes does not register — the "
            f"page-<slug> → /<slug> invariant broke and this entry would serve a dead link"
        )


def test_every_settings_tab_the_map_emits_is_a_real_tab():
    """R1(ii): every tab the question→Settings-tab map can emit is a real tab id (`Settings.tsx`
    TAB_IDS). A link to a tab that does not exist is a dead affordance; the map is pinned to the
    ratified tab vocabulary so a renamed/removed tab reds rather than shipping a broken deep link."""
    from app.ai.tools import _SETTINGS_TAB_RULES

    valid = _settings_tab_ids()
    assert valid, "no tab ids parsed from Settings.tsx — the parser drifted, this guard is blind"
    emitted = {tab for tab, _ in _SETTINGS_TAB_RULES}
    assert emitted, "the tab map is empty — R1(ii) refines nothing and this guard is vacuous"
    assert emitted <= valid, (
        f"the question→tab map emits ids not in Settings.tsx TAB_IDS: {sorted(emitted - valid)}"
    )


def test_holdings_add_intent_fires_on_add_questions_only():
    """§59-2: the add-intent refinement deep-links an ADD question to `?add=1` and keeps the plain
    `page:/holdings` link otherwise. An over-firing refinement would open the dialog for every
    Holdings question (e.g. 'what's on the holdings page'); an under-firing one would miss tier-1(b)."""
    from app.ai.tools import _holdings_add_intent

    assert _holdings_add_intent("how do I add a holding")
    assert _holdings_add_intent("how do I record a new position")
    assert _holdings_add_intent("adding a crypto to my portfolio")
    assert not _holdings_add_intent("what is on the holdings page")
    assert not _holdings_add_intent("how do I export my holdings")
    assert not _holdings_add_intent("where are my holdings")


async def test_every_served_page_link_names_a_route_the_app_registers(app_client):
    """The served half of §9-D for `page:` links now that help facts serve them too: the PATH part
    (before any `?tab=` query) is a route AppRoutes registers. A dead page target reds HERE.

    The `?tab=` query is preserved as a link but is not part of the route — the frontend resolver's
    query handling and the full round-trip are delta 4b (`resolveAskLink`). This guards only that
    the destination page exists, closing the bidirectional loop's served half for query links.
    """
    routes = _registered_routes()
    assert routes, "no routes parsed from AppRoutes.tsx — the parser drifted, guard is blind"
    for question in ("how do I add a holding", "how do I change the theme", "What is my net worth?"):
        for f in await _facts(app_client, question):
            link = f.get("link_id")
            if link and link.startswith("page:"):
                path = link[len("page:"):].split("?", 1)[0]
                assert path in routes, (
                    f"{f['label']!r} served {link!r}, whose page {path!r} AppRoutes does not "
                    f"register — a link may only target a route that exists today"
                )


# ── R-59 §59-2a — THE BIDIRECTIONAL ORDERING GUARD, MADE MECHANICAL ────────────────────────────
#
# A `?tab=`-style query link is a DEAD affordance (silent no-op, dead-affordance-3 class) unless the
# destination route actually READS the param. The Settings-tab guard proves the tab id is real; this
# proves the Holdings form deep link's query key is a param `Holdings.tsx` reads. It is the guard the
# R-54→R-59 ordering was waiting on: the add-form ID cannot be registered before its param is honored.


def _holdings_search_params_read() -> set[str]:
    """The URL search-param KEYS `Holdings.tsx` actually reads — parsed from `searchParams.get("x")`
    calls in the route source. The R-59 `?add=` deep link is a silent no-op unless its key is here."""
    src = (REPO / "frontend" / "src" / "routes" / "Holdings.tsx").read_text(encoding="utf-8")
    return set(re.findall(r'searchParams\.get\(\s*"([^"]+)"\s*\)', src))


async def test_the_add_holding_deep_link_param_is_a_param_the_route_reads(app_client):
    """R-59 §59-2a: the served add-holding form deep link carries a query the Holdings route READS —
    so `page:/holdings?add=1` opens the dialog rather than landing on an ignored param (dead
    affordance 3). This makes the R-54→R-59 ordering mechanical: a form ID served with a param the
    route does not honor reds HERE, so the flip could not ship before the `?add=` route did.

    Blindness pins: an empty served-query set (the flip regressed to a bare page link) or an empty
    read set (the route stopped using useSearchParams / the parser drifted) fails loudly rather than
    passing by checking nothing.
    """
    from urllib.parse import parse_qs, urlparse

    by_label = {f["label"]: f.get("link_id") for f in await _facts(app_client, "how do I add a holding")}
    link = by_label.get("Help · Holdings") or ""
    assert link.startswith("page:/holdings"), (
        f"the deep-link premise changed — Help·Holdings did not serve a page:/holdings link; got {link!r}"
    )
    served_keys = set(parse_qs(urlparse(link[len("page:"):]).query))
    assert served_keys, (
        f"the served Holdings form link {link!r} carries NO query param — the R-59 form deep link is "
        f"not being served; the registry flip (§59-2) regressed to a bare page link"
    )
    reads = _holdings_search_params_read()
    assert reads, "no searchParams.get() reads parsed from Holdings.tsx — the parser drifted, guard is blind"
    missing = served_keys - reads
    assert not missing, (
        f"the served form deep link {link!r} carries ?{'/'.join(sorted(missing))}= but Holdings.tsx "
        f"reads only {sorted(reads)} — the deep link would be a SILENT no-op (dead affordance 3). A "
        f"form ID may be registered only after its param is honored (the R-54→R-59 ordering)."
    )
