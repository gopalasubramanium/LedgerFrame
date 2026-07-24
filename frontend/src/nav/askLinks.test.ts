// SPDX-License-Identifier: AGPL-3.0-or-later
// THE BIDIRECTIONAL RESOLUTION GUARD — frontend half (R-54 §9-D/§9-E).
//
// The backend served-half (`tests/integration/test_served_link_ids.py`) proves every SERVED ID is
// well-formed, of a known kind, and names a real route / Help entry — and, in this milestone,
// closes the loop from the file-parsing side: every served `canonical_page` is a route the frontend
// registry accepts (nav.ts built pages), every nav route is a route AppRoutes registers, and the
// served kinds equal `KNOWN_LINK_KINDS`. Those closures read `nav.ts` / `AppRoutes.tsx` as text, so
// they live in Python where file parsing is clean; jsdom/vitest has no node `fs` types here.
//
// This half proves the resolver's SEMANTICS, purely: every route it accepts round-trips, every
// served worked-example ID maps to the destination a user would follow, and anything it cannot map
// returns **null** — tier-1 declines rather than inventing a destination (§0-F dead-affordance 3).
//
// The `help:` topic direction is deliberately NOT re-checked here: an unknown `?topic=` is a silent
// no-op, topics validate against the SERVED catalogue on arrival (`Help.tsx:334`), and the backend
// guard binds served `help:` IDs to real entries. A static topic list here would be a SECOND source
// of truth for a served fact — the §0-C mistake.

import { describe, expect, test } from "vitest";

import { askLinkLabel, KNOWN_LINK_KINDS, KNOWN_PAGE_ROUTES, resolveAskLink } from "./askLinks";

describe("askLinks — the frontend ID→route registry (R-54 §9-D)", () => {
  // ── Every accepted route round-trips ────────────────────────────────────────────────────────
  test("page:<route> resolves back to <route> for every route the registry accepts", () => {
    // Blindness pin: an empty accepted-set would make this pass vacuously (no route to resolve).
    expect(KNOWN_PAGE_ROUTES.size).toBeGreaterThan(0);
    for (const route of KNOWN_PAGE_ROUTES) {
      expect(resolveAskLink(`page:${route}`)).toBe(route);
    }
  });

  // ── Kind coverage ──────────────────────────────────────────────────────────────────────────
  test("the resolver maps exactly the kinds the backend serves — no more, no fewer", () => {
    // Mirrors KNOWN_KINDS in test_served_link_ids.py (the backend pins the two literals equal). A
    // backend kind the frontend cannot resolve is a silent dead link; an extra frontend kind is
    // dead code.
    expect([...KNOWN_LINK_KINDS].sort()).toEqual(["help", "page"]);
    expect(resolveAskLink("page:/net-worth")).not.toBeNull();
    expect(resolveAskLink("help:term-xirr-twr")).not.toBeNull();
  });

  // ── Refuse, never guess (the dead-affordance specimens) ─────────────────────────────────────
  test("an unknown kind resolves to null — a link that names no destination is refused", () => {
    expect(resolveAskLink("route:/net-worth")).toBeNull();
    expect(resolveAskLink("settings:appearance")).toBeNull();
  });

  test("a page: route the registry does not accept resolves to null", () => {
    expect(resolveAskLink("page:/not-a-real-page")).toBeNull();
    expect(resolveAskLink("page:/kitchen-sink")).toBeNull(); // a real AppRoutes route, but not a nav page
  });

  test("malformed IDs resolve to null (no kind, no key, empty)", () => {
    expect(resolveAskLink("")).toBeNull();
    expect(resolveAskLink(null)).toBeNull();
    expect(resolveAskLink(undefined)).toBeNull();
    expect(resolveAskLink("net-worth")).toBeNull(); // no separator
    expect(resolveAskLink("page:")).toBeNull(); // kind, no key
    expect(resolveAskLink(":term-xirr-twr")).toBeNull(); // empty kind
  });

  // ── Capability probe — the exact IDs the served examples emit (test_served_link_ids.py) ──────
  test("the served worked-example IDs resolve to the routes a user would follow", () => {
    // "what is XIRR" emits help:term-xirr-twr + page:/net-worth + page:/portfolio. Redundant-route
    // note: `page:` keys are distinct routes, so a resolver that collapsed everything onto one page
    // would fail the DIFFERENT-pages assertion below.
    expect(resolveAskLink("help:term-xirr-twr")).toBe("/help?topic=term-xirr-twr");
    expect(resolveAskLink("page:/net-worth")).toBe("/net-worth");
    expect(resolveAskLink("page:/portfolio")).toBe("/portfolio");
    expect(resolveAskLink("page:/net-worth")).not.toBe(resolveAskLink("page:/portfolio"));
  });

  test("a help topic is URL-encoded into the ?topic= param", () => {
    // Help.tsx reads ?topic= against the served catalogue; a raw key with URL metacharacters must
    // not break the query. Real ids are slug-safe, so this is a robustness pin, not a live case.
    expect(resolveAskLink("help:a b&c")).toBe("/help?topic=a%20b%26c");
  });

  // ── R-54 delta 4b / R1(iii) — a `page:` route may carry a query (the tab), ROUND-TRIP ────────
  //
  // The composition ruling (owner 2026-07-22): a Settings help fact points at
  // `page:/settings?tab=appearance` — tab-level pointing, which §9-D already ruled sufficient. The
  // backend serves the query; this resolver was extended to VALIDATE the path against the accepted
  // set and PRESERVE the query, where before it rejected any route with a `?`.
  describe("a page: route with a ?tab= query (R1iii)", () => {
    test("the path is validated and the query preserved, so the tab survives the round-trip", () => {
      expect(resolveAskLink("page:/settings?tab=appearance")).toBe("/settings?tab=appearance");
      expect(resolveAskLink("page:/settings?tab=data-feeds")).toBe("/settings?tab=data-feeds");
    });

    test("a query on an UNKNOWN page still resolves to null — the path is what is validated", () => {
      expect(resolveAskLink("page:/not-a-real-page?tab=appearance")).toBeNull();
      expect(resolveAskLink("page:/kitchen-sink?tab=x")).toBeNull(); // real route, not a nav page
    });

    test("a query does not disturb the tab-less round-trip", () => {
      // The pre-existing contract for query-less page links is unchanged.
      expect(resolveAskLink("page:/settings")).toBe("/settings");
      expect(resolveAskLink("page:/net-worth")).toBe("/net-worth");
    });

    // ── R-59 §59-2: the add-holding form deep link (?add=1), same round-trip as ?tab= ────────────
    test("the Holdings add-form deep link round-trips (path validated, ?add= preserved)", () => {
      expect(resolveAskLink("page:/holdings?add=1")).toBe("/holdings?add=1");
      // A query-less /holdings link keeps its exact prior contract.
      expect(resolveAskLink("page:/holdings")).toBe("/holdings");
    });
  });

  // ── The destination LABEL — the pointer affordance's accessible name (delta 4b) ──────────────
  //
  // The affordance names WHERE it goes from the ONE nav model (D-043), never a hand-typed string,
  // so a renamed page renames the pointer automatically and a served link the resolver refuses
  // gets no label (null → no affordance, never a dangling arrow).
  describe("askLinkLabel — the pointer's destination name", () => {
    test("a page: link is named by its nav label; a Settings TAB link by its tab (W-4)", () => {
      expect(askLinkLabel("page:/net-worth")).toBe("Net worth");
      expect(askLinkLabel("page:/holdings")).toBe("Holdings");
      // ⊕ W-4 (owner 2026-07-22): a `page:/settings?tab=<x>` pointer is named for the TAB it opens
      // — "Appearance settings", not the bare "Settings" — so "→ Open Appearance settings" says
      // exactly where it lands. A plain `/settings` (no tab) keeps the page label.
      expect(askLinkLabel("page:/settings?tab=appearance")).toBe("Appearance settings");
      expect(askLinkLabel("page:/settings?tab=privacy")).toBe("Privacy settings");
      expect(askLinkLabel("page:/settings")).toBe("Settings");
      // ⊕ R-59 §59-2: the add-holding form deep link is named for the ACTION it opens — "Add a
      // holding", not the bare "Holdings" — so "→ Open Add a holding" says exactly where it lands.
      expect(askLinkLabel("page:/holdings?add=1")).toBe("Add a holding");
      expect(askLinkLabel("page:/holdings")).toBe("Holdings"); // no ?add= keeps the page label
    });

    test("a help: link is named for the Help page it opens", () => {
      expect(askLinkLabel("help:term-xirr-twr")).toBe("Help");
    });

    test("an unresolvable link has no label — no affordance is rendered for it", () => {
      expect(askLinkLabel("page:/not-a-real-page")).toBeNull();
      expect(askLinkLabel("route:/net-worth")).toBeNull();
      expect(askLinkLabel(null)).toBeNull();
    });
  });
});
