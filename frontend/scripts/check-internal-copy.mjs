#!/usr/bin/env node
/*
 * Internal-copy drift check (§14dr-10, data-feed-routing Phase 3b re-walk batch 3).
 *
 * A leftover dev annotation ("[PIN]") once shipped inside a real button label
 * ("Purge 2 deleted [PIN]"). Internal/dev markers must NEVER reach a production
 * user surface. This check fails (exit 1) if a bracketed dev marker appears in
 * production route/component source, OUTSIDE code comments — so CI enforces it.
 *
 * Scoped out (legitimate homes for such annotations):
 *   - the KitchenSink developer playground + the RoutingMatrix mockup
 *   - test files
 *   - code comments (stripped before scanning) — the guard is about RENDERED copy
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const SCAN = [join(root, "src", "routes"), join(root, "src", "components")];

const SCAN_EXT = new Set([".ts", ".tsx"]);
const SKIP = /KitchenSink|RoutingMatrixMockup|\.test\.tsx?$/;

// Bracketed dev annotations that must not render: [PIN], [TODO], [FIXME], [DEBUG], [WIP], [HACK], [XXX].
const MARKER = /\[(PIN|TODO|FIXME|DEBUG|WIP|HACK|XXX)\]/g;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments (incl. JSX {/* ... */})
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1"); // line comments (keep ://)
}

const findings = [];
for (const base of SCAN) {
  for (const file of walk(base)) {
    const ext = file.slice(file.lastIndexOf("."));
    if (!SCAN_EXT.has(ext) || SKIP.test(file)) continue;
    const cleaned = stripComments(readFileSync(file, "utf8"));
    cleaned.split("\n").forEach((line, i) => {
      MARKER.lastIndex = 0;
      let m;
      while ((m = MARKER.exec(line)) !== null) {
        findings.push({ rel: relative(root, file), line: i + 1, text: m[0] });
      }
    });
  }
}

if (findings.length > 0) {
  console.error(
    `\n✗ Internal-copy drift: ${findings.length} dev annotation(s) on a user surface.\n` +
      `  Internal markers ([PIN] and kin) must never render (§14dr-10).\n`,
  );
  for (const f of findings) console.error(`  ${f.rel}:${f.line}  ${f.text}`);
  console.error("");
  process.exit(1);
}

console.log("✓ Internal-copy check: no dev annotations on user surfaces.");
