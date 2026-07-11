# ADR-0003 — Frontend icon set: lucide-react (bundled, tree-shaken)

**Status:** Accepted (owner, 2026-07-11 — page-chrome Phase 3 batch 3, §11-15).
**Context:** ADR-0002 forbids new frontend dependencies without an ADR.

## Decision

Adopt **`lucide-react`** as the platform icon set, replacing the ad-hoc Unicode
glyphs used for the chrome toggles and page actions.

**Hard constraints (met):**
- **Bundled locally, no CDN, no runtime fetch.** Icons are imported per-name
  (`import { Sun } from "lucide-react"`) and tree-shaken into the app bundle by Vite/
  Rollup — only the icons actually used are included. Nothing is fetched at runtime, so
  **no-egress (D-075) applies to assets**: a no-egress instance needs zero network for
  icons.
- **Centralized.** The used icons are re-exported from `src/icons.ts`, so the platform
  icon vocabulary lives in one file.
- **Theme-aware.** Icons render `currentColor` strokes and size from `--icon-size`, so
  they follow the button's text colour and the token layer (no raw px/hex — ADR-0002
  drift check stays green).

## Consequences

- The **stateful-glyph rule** (DESIGN-SYSTEM §5.5) is unchanged — a state-distinct
  icon per state; the assignment table moves from Unicode glyphs to lucide icon names.
- Version **pinned** in `package.json` (installed 1.24.0). Upgrades are deliberate.
- **Bundle-size delta** recorded in page-chrome §11-15 (tree-shaken; only the ~20 icons
  in use are bundled).
- No SVG sprite/CDN; if the icon set ever needs self-hosting differently, that's a
  further ADR.
