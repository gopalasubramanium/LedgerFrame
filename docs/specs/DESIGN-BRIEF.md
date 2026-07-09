# DESIGN-BRIEF.md — LedgerFrame v2 Rebuild Playbook (Design brief)

Committed so this design source never leaves the repo again. This is the
authoritative brief; `DESIGN-SYSTEM.md` operationalises it into tokens,
templates, and a component inventory. Where DESIGN-SYSTEM.md proposes concrete
values not fixed here (hex palette, spacing, weights/line-heights), those are
marked "PROPOSED — ratify at kitchen-sink review".

---

**Goal:** the visual language of institutional wealth platforms (Addepar,
private-bank client portals) — not a startup dashboard, not default shadcn.

**Principles:**

- **Numbers are the interface.** Tabular (monospaced-figure) numerals
  everywhere, right-aligned, consistent decimal places per unit type, thin
  table rules, generous row density options (comfortable/compact).
- **Colour is semantic only.** A near-monochrome slate base; one accent;
  green/red reserved strictly for gain/loss; amber strictly for
  staleness/attention. Never decorative colour.
- **Hierarchy through typography, not boxes.** Max two font families (a quality
  grotesque for UI with tabular figures; optional serif for report headers).
  Type scale: 12/13/14/16/20/28. Minimal borders and shadows.
- **Provenance is a first-class UI element.** One standardized badge component
  renders source · freshness · confidence identically on every number that has
  them.
- **One page template system:** overview, entity-detail, worklist, settings —
  four templates, every page uses exactly one.
- **Responsive and theme-complete from day one:** light/dark/system, phone →
  wall kiosk, keyboard navigable, WCAG AA contrast.

**Component library (built before any page):** MoneyInput (currency-aware),
QuantityInput, PercentInput, DateInput, InstrumentPicker, MasterSelect,
DataTable (sort/filter/export/sticky header — one implementation),
ProvenanceBadge, StalenessChip, TrendStat, AllocationDonut, PriceChart (candles
+ MA/BB/RSI), EmptyState, PageHeader, ReviewCard — plus the components the
feature verdicts require (treemap per D-053, quote-card row per D-046, ticker
strip scoped to Home Full per D-047).

**Pages compose components; pages never style primitives.**
