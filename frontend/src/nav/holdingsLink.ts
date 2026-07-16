// SPDX-License-Identifier: AGPL-3.0-or-later
// The ONE source for the account-scoped Holdings destination (page-accounts §14ac-5). Both entry
// points — the account Name link and the RowMenu "View holdings" item — consume this builder, so the
// two affordances can never silently diverge (two hand-built hrefs to one destination is how one rots).
//
// Returns a react-router `to` value ("/holdings?account=<id>"). Navigate through react-router
// (<Link to> / useNavigate) — NOT a manual `window.location.hash` write, which makes the destination
// mount before the router's location.search reflects the query and fires an unfiltered fetch
// (§14ac-2). The HashRouter renders it as `#/holdings?account=<id>`.
export function holdingsForAccount(accountId: number): string {
  return `/holdings?account=${accountId}`;
}
