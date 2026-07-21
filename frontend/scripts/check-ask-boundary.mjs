#!/usr/bin/env node
/*
 * THE ASK-PANEL BOUNDARY CHECK — R-54 §9-E (owner ruling 2026-07-20), the `check:primitives` shape.
 *
 * "THE PANEL EXPLAINS AND POINTS; THE PAGE ACTS." The Ask panel's answer surface may contain the
 * question input, the submit button, the incidental two (the Dialog trigger + the per-fact Show
 * more/less toggle), and the LINK affordance (§9-D) — and NOTHING interactive besides. A control
 * rendered inside the panel — a model picker, a tab strip, a settings toggle, a form — would let a
 * conversational surface ACT, which is the boundary this milestone exists to hold.
 *
 * §0-M found the boundary is CURRENTLY held and no live violation exists, so — like check:primitives
 * before it — this guard is proven RED against a deliberate specimen, not a real defect. It is the
 * answer to "what turns red?" for the §1 boundary: today, nothing did; now this does.
 *
 * WHAT IT CHECKS, two arms, both static over the ONE owner file:
 *   (1) every component the panel imports from a SIBLING ui module (`./X`) is on the ratified §4
 *       allow-list. A new control component the panel renders is a `./`-import outside the list.
 *       The link affordance is react-router's `Link` (from `react-router-dom`, not `./`) and the
 *       arrow is a lucide icon — neither is a `./` control, so neither is in scope: links and icons
 *       are sanctioned, controls are not.
 *   (2) no RAW interactive HTML element (`<select>`, `<textarea>`, `<input>`, `<button>`) appears in
 *       the panel source — those belong INSIDE their primitives (TextInput, Button), never hand-
 *       rolled here (the check:primitives lesson, one surface over).
 *
 * PINNED AGAINST GOING BLIND: if the owner file vanishes, stops rendering the panel, or stops
 * composing from the allow-listed primitives, the guard exits 1 rather than passing by protecting
 * nothing (CLAUDE.md: a guard must fail loudly rather than pass by protecting nothing).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

// The ONE surface this boundary governs.
const OWNER = "src/components/ui/AskPanel.tsx";

// The ratified §4 composition set — the primitives the panel may render. A control outside this set
// is a control the panel must not embed (§1 boundary). Extending it is a deliberate DS act, not a
// regex someone widens on a hunch.
const ALLOWED = new Set([
  "Dialog",
  "TextInput",
  "Button",
  "Skeleton",
  "EmptyState",
  "StalenessChip",
]);

// Raw interactive HTML that must never be hand-rolled in the panel — it belongs inside a primitive.
const RAW_CONTROL = /<(select|textarea|input|button)\b/g;

// Sibling ui-component imports: `import { A, B } from "./X"` (NOT "./x.css" side-effect imports).
const SIBLING_IMPORT = /import\s*\{([^}]*)\}\s*from\s*["']\.\/[A-Z][^"']*["']/g;

function stripComments(src) {
  // Preserve newlines so reported line numbers stay accurate (the check:primitives lesson).
  const blank = (m) => "\n".repeat((m.match(/\n/g) ?? []).length);
  return src.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

let raw;
try {
  raw = readFileSync(join(root, OWNER), "utf8");
} catch (e) {
  console.error(`\n✗ Ask-boundary check is BLIND: ${OWNER} is missing (${e.message}).\n`);
  process.exit(1);
}

// Blindness pin: the panel must still render (its root class) AND still compose from the primitives.
// A file that stopped doing either would make every check below vacuous.
if (!/lf-ask\b/.test(raw) || !/from\s*["']\.\/Dialog["']/.test(raw)) {
  console.error(
    `\n✗ Ask-boundary check is BLIND: ${OWNER} no longer renders the panel (\`lf-ask\`) or no\n` +
      `  longer composes from the ratified primitives (Dialog). The guard would pass by\n` +
      `  protecting nothing.\n`,
  );
  process.exit(1);
}

const src = stripComments(raw);
const findings = [];

for (const m of src.matchAll(SIBLING_IMPORT)) {
  const names = m[1]
    .split(",")
    .map((s) => s.replace(/\btype\b/, "").trim())
    .filter(Boolean);
  for (const name of names) {
    if (!ALLOWED.has(name)) {
      findings.push({
        line: src.slice(0, m.index).split("\n").length,
        detail: `imports control component <${name}> — not in the ratified §4 set`,
      });
    }
  }
}

for (const m of src.matchAll(RAW_CONTROL)) {
  findings.push({
    line: src.slice(0, m.index).split("\n").length,
    detail: `raw <${m[1]}> — an interactive control belongs inside a primitive, never hand-rolled here`,
  });
}

if (findings.length > 0) {
  console.error(
    `\n✗ Ask-panel boundary: ${findings.length} interactive control(s) in the answer surface.\n` +
      `  R-54 §9-E — the panel EXPLAINS AND POINTS; the page ACTS. The answer body may carry the\n` +
      `  question input, submit, the incidental two, and LINKS — nothing else interactive.\n`,
  );
  for (const f of findings) console.error(`  ${OWNER}:${f.line} — ${f.detail}`);
  console.error("");
  process.exit(1);
}

console.log(`✓ Ask-panel boundary: the panel points and does not act (${OWNER}).`);
