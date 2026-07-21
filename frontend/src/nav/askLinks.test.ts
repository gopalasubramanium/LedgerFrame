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

import { KNOWN_LINK_KINDS, KNOWN_PAGE_ROUTES, resolveAskLink } from "./askLinks";

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
});
