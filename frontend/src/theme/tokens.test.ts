// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// ⚑ THE UNDEFINED-TOKEN GUARD (page-help §9-bis-14 delta 2).
//
// THE DEFECT THIS EXISTS FOR. `Settings.css` and `Help.css` shipped 23 references to custom
// properties that DO NOT EXIST — `--text-muted`, `--text-sm`, `--text-xl`, `--text`, `--focus`,
// `--text-md`, `--text-xs`. The token layer defines `--text-primary`/`--text-secondary`/
// `--text-tertiary`, `--font-size-*` and `--focus-ring`; the others were invented at the point of
// use and never noticed.
//
// A `var()` with no fallback and no definition is INVALID AT COMPUTED-VALUE TIME, and the failure is
// silent by design:
//   * `color: var(--text-muted)` → the declaration is dropped → the property INHERITS. Prose meant
//     to be muted rendered at full primary contrast, which looks deliberate.
//   * `font-size: var(--text-sm)` → same → text rendered at its parent's size.
//   * `outline: var(--focus-width) solid var(--focus)` → the whole SHORTHAND is invalid → NO OUTLINE
//     AT ALL. Three of Help's focus-visible rules were dead: the accordion toggle, the topic link
//     and the jump link had **no visible keyboard focus ring**. That is an accessibility defect, and
//     it is the one that proves the class is not cosmetic.
//
// WHY NO EXISTING GUARD CAUGHT IT — THE GUARD GAP. The unit suites assert TEXT and STRUCTURE; not
// one of them asserts a COMPUTED STYLE, and jsdom does not load these stylesheets anyway. The
// Playwright pre-passes assert CONTAINMENT and CONSOLE ERRORS; a dropped declaration overflows
// nothing and logs nothing. So every gate was green on all 23, for as long as they existed.
//
// THIS GUARD IS SOURCE-LEVEL ON PURPOSE. It reads the CSS as text, so it covers every rule in the
// codebase including ones no test ever renders — where a live computed-style assertion only covers
// the elements a test happens to visit. The live counterpart (`help-markup-prepass.spec.ts`) proves
// the tokens actually resolve in a browser; this proves none of them is missing anywhere.

const SRC = dirname(dirname(fileURLToPath(import.meta.url)));

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return cssFiles(p);
    return e.name.endsWith(".css") ? [p] : [];
  });
}

// Custom properties set from TSX (`style={{ "--tx": … }}`) are legitimately absent from the CSS —
// the element supplies them at runtime. They are listed rather than pattern-matched so that adding
// one is a deliberate act with a reviewer, not something a regex quietly starts forgiving.
const RUNTIME_SET = new Set([
  "--tx", "--ty", "--tw", "--th", // Treemap tile geometry (Treemap.tsx)
  "--bar", "--swatch",            // KitchenSink specimen boards
  "--toast-ms",                   // Toast countdown duration (Toast.tsx)
]);

test("every CSS custom property referenced without a fallback is actually defined", () => {
  const files = cssFiles(SRC);
  expect(files.length, "no CSS files found — the guard is looking in the wrong place").toBeGreaterThan(5);

  const defined = new Set<string>();
  for (const f of files) {
    for (const m of readFileSync(f, "utf8").matchAll(/^\s*(--[A-Za-z0-9-]+)\s*:/gm)) defined.add(m[1]);
  }
  // Sanity: if the token layer ever stops being parsed, this guard would "pass" by finding nothing
  // to complain about. Pin a token that must exist so a blind guard fails loudly instead.
  expect(defined.has("--text-primary"), "the token layer was not parsed — this guard is blind").toBe(true);

  const missing: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    // `var(--x)` with NO fallback. `var(--x, 0)` is deliberate and safe, so it is not flagged.
    for (const m of src.matchAll(/var\(\s*(--[A-Za-z0-9-]+)\s*\)/g)) {
      const name = m[1];
      if (defined.has(name) || RUNTIME_SET.has(name)) continue;
      const line = src.slice(0, m.index).split("\n").length;
      missing.push(`${relative(SRC, f)}:${line} → var(${name})`);
    }
  }

  expect(
    missing,
    "Undefined custom properties. Each of these is INVALID AT COMPUTED-VALUE TIME: the declaration " +
      "is dropped and the property inherits — silently. In an `outline`/`border`/`font` shorthand it " +
      "kills the WHOLE declaration (this is how Help shipped with no focus ring). Use a real token " +
      "from theme/tokens.css, or give the var an explicit fallback:\n  " + missing.join("\n  "),
  ).toEqual([]);
});
