// Canonical sidebar nav model (D-043; INFORMATION-ARCHITECTURE §3). Six fixed
// groups, fixed order, NOT user-reorderable — the nav-customization control was
// removed (D-043/D-069). Group names are guessable from contents (P-4). Routes
// are the IA canonical routes (D-022); redirects (/snapshot, /planning, /global)
// are handled by the shell router, not listed here.
export interface NavItem {
  /** Nav label = H1 = route (D-022). Must match the IA page map spelling. */
  label: string;
  path: string;
  /** Whether the page is actually built + routed. Only built pages appear as nav
      entries; a group with none built shows its header only (progressive reveal of
      the fixed D-043 skeleton — page-chrome Phase 0a). Flip to true as each page ships. */
  built?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// The six groups, verbatim from INFORMATION-ARCHITECTURE §3. Do not reorder or
// rename without a D-043 amendment.
export const NAV_GROUPS: NavGroup[] = [
  { label: "Overview", items: [{ label: "Home", path: "/" }] },
  {
    label: "Wealth",
    items: [
      { label: "Net worth", path: "/net-worth", built: true },
      { label: "Portfolio", path: "/portfolio", built: true },
      { label: "Holdings", path: "/holdings", built: true },
      { label: "Accounts", path: "/accounts" },
    ],
  },
  {
    label: "Markets",
    items: [
      { label: "Markets", path: "/markets", built: true },
      { label: "Heatmap", path: "/heatmap", built: true },
      { label: "News", path: "/news", built: true },
    ],
  },
  {
    label: "Planning",
    items: [
      { label: "Review", path: "/review", built: true },
      { label: "Policy", path: "/policy" },
      { label: "Cash flow", path: "/cash-flow" },
      { label: "Scenarios", path: "/scenarios" },
      { label: "Insurance", path: "/insurance" },
      { label: "Estate", path: "/estate" },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "Reports", path: "/reports" },
      { label: "Pricing Health", path: "/pricing-health", built: true },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Settings", path: "/settings" },
      { label: "Help", path: "/help" },
      { label: "Legal", path: "/legal" },
    ],
  },
];
