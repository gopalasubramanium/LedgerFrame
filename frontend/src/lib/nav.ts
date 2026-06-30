// User-customisable navigation: order + labels are stored per-device in
// localStorage (like theme). Routes/paths are fixed in App; only the sidebar
// order and display labels change. New app pages are appended automatically.

export interface NavItem {
  path: string;
  label: string;
}

// Canonical pages (path → default label). The order here is the default order.
export const DEFAULT_NAV: NavItem[] = [
  { path: "/", label: "Home" },
  { path: "/portfolio", label: "Portfolio" },
  { path: "/holdings", label: "Holdings" },
  { path: "/markets", label: "Markets" },
  { path: "/heatmap", label: "Heatmap" },
  { path: "/news", label: "News" },
  { path: "/snapshot", label: "Snapshot" },
  { path: "/settings", label: "Settings" },
  { path: "/legal", label: "Legal" },
];

const KEY = "lf_nav_v1";
const CHANGED = "lf:nav-changed";

export function loadNav(): NavItem[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null") as NavItem[] | null;
    if (!Array.isArray(saved) || !saved.length) return DEFAULT_NAV;
    const defaults = new Map(DEFAULT_NAV.map((n) => [n.path, n.label]));
    const out: NavItem[] = [];
    // Keep saved order + custom labels for still-valid paths…
    for (const s of saved) {
      if (s && defaults.has(s.path)) {
        out.push({ path: s.path, label: (s.label || defaults.get(s.path)!).slice(0, 20) });
        defaults.delete(s.path);
      }
    }
    // …then append any pages added since the user last customised.
    for (const [path, label] of defaults) out.push({ path, label });
    return out;
  } catch {
    return DEFAULT_NAV;
  }
}

export function saveNav(items: NavItem[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CHANGED));
}

export function resetNav(): void {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(CHANGED));
}

export const NAV_CHANGED_EVENT = CHANGED;
