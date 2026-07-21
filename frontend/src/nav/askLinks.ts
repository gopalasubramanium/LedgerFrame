// SPDX-License-Identifier: AGPL-3.0-or-later
// THE FRONTEND-OWNED ID→ROUTE REGISTRY (R-54 §9-D). The backend issues semantic link IDs of the
// form `<kind>:<key>` (`app/services/figure_registry.py` canonical_page → `page:<route>`;
// `app/ai/tools.py` help hits → `help:<entry-id>`); this module is the ONLY place that turns one
// into a destination the Ask panel can navigate to. Same principle as `holdingsLink.ts`: a single
// builder so a served ID and its route can never silently diverge — two hand-built hrefs to one
// destination is how one rots (page-accounts §14ac-5).
//
// Owner ruling (R-54 §9-D): "Strict separation of concerns — backend issues semantic IDs, frontend
// maps them to routes — coupled with a bidirectional resolution guard eliminates silent dead-link
// failures." The guard lives in `askLinks.test.ts` (this half) and `tests/integration/
// test_served_link_ids.py` (the served half): every served ID is registered here, and every route
// this registry accepts resolves against the LIVE router (`AppRoutes.tsx`).
//
// Returns a react-router `to` value ("/net-worth", "/help?topic=term-xirr-twr"). Navigate through
// react-router (<Link to> / useNavigate), NEVER a manual `window.location.hash` write — the
// HashRouter renders `to` as `#<to>`, and a hash write mounts the destination before the router's
// location reflects the query (§14ac-2). A link that cannot resolve returns **null**: tier-1
// declines rather than inventing a destination — a link that resolves to nothing is a dead
// affordance with extra steps (§0-F dead-affordance 3).

import { NAV_GROUPS } from "../components/ui/nav";

/** The kinds the backend serves. MUST equal `KNOWN_KINDS` in `test_served_link_ids.py`; the
 *  bidirectional guard reads this literal so a backend kind the frontend cannot map reds. */
export const KNOWN_LINK_KINDS = ["help", "page"] as const;

/** Every route a `page:` ID may target — the BUILT nav pages, derived from the one nav model
 *  (D-043) rather than hand-listed a second time. A `page:` key IS a route ("/net-worth"), so a
 *  served route outside this set is refused here and reds in the guard, never navigated blindly. */
export const KNOWN_PAGE_ROUTES: ReadonlySet<string> = new Set(
  NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.built).map((i) => i.path),
);

/** Every built nav page's human label, keyed by route — the ONE source (D-043) the pointer
 *  affordance names its destination from, so a renamed page renames the pointer automatically. */
const NAV_LABEL_BY_PATH: ReadonlyMap<string, string> = new Map(
  NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.built).map((i) => [i.path, i.label]),
);

/**
 * Resolve a served `<kind>:<key>` link ID to a react-router `to` value, or `null` if it names no
 * destination this registry knows (unknown kind, unbuilt/unknown page route, or a malformed ID).
 *
 * `help:` topic validity is NOT checked here — it is resolved by `Help.tsx` against the SERVED
 * catalogue on arrival (`Help.tsx:334`), and the backend served-half guard already guarantees every
 * served `help:` ID names a real entry. This builder trusts that guarantee and only shapes the URL.
 */
export function resolveAskLink(linkId: string | null | undefined): string | null {
  if (!linkId) return null;
  const sep = linkId.indexOf(":");
  if (sep <= 0) return null; // no kind, or empty kind
  const kind = linkId.slice(0, sep);
  const key = linkId.slice(sep + 1);
  if (!key) return null; // kind but no key

  if (kind === "help") return `/help?topic=${encodeURIComponent(key)}`;
  if (kind === "page") {
    // R-54 delta 4b / R1(iii): a `page:` route MAY carry a query — `page:/settings?tab=appearance`
    // (tab-level pointing, §9-D). Validate the PATH against the accepted set and PRESERVE the query
    // verbatim; a query-less link keeps its exact prior contract. The query part is not a route, so
    // it is never validated as one — only the path is.
    const q = key.indexOf("?");
    const path = q === -1 ? key : key.slice(0, q);
    if (!KNOWN_PAGE_ROUTES.has(path)) return null;
    return key; // path is a real nav page → the full `to` (path + any ?query) navigates
  }
  return null; // unknown kind → no destination (honest, never a guess)
}

/**
 * The human label for a resolved link's DESTINATION — the pointer affordance's accessible name
 * (R-54 delta 4b). A `page:` link is named by its nav label (the query notwithstanding); a `help:`
 * link is named for the Help page it opens. A link the resolver refuses gets `null` — no label, so
 * no dangling arrow to a destination that does not exist.
 */
export function askLinkLabel(linkId: string | null | undefined): string | null {
  const to = resolveAskLink(linkId);
  if (!to) return null;
  if (to.startsWith("/help")) return "Help";
  const path = to.split("?", 1)[0];
  return NAV_LABEL_BY_PATH.get(path) ?? null;
}
