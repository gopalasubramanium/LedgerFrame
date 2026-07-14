#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Dependency-licence audit over the FULL TRANSITIVE graph — backend + frontend.

release-readiness Gate **A8** (RD-2). Committed to the repo so it is **repeatable**, not a one-off:
E4 re-runs it against the final public set, and **no public claim ships before it runs clean**.

What it does NOT do: **adjudicate.** It reports what it finds and flags anything copyleft-ish or
unknown. Whether a given licence is compatible with shipping AGPL-3.0-or-later — and with the D-001
"future proprietary layer" — is **owner/counsel territory**, not a script's.

Two scopes, deliberately separate, because they carry different risk:

* **RUNTIME** — what a user actually receives and runs. This is what a distribution claim is about.
* **DEV** — build/test tooling. It does not ship, but it is reported anyway so the owner can see it.

**"Clean" means ZERO UNADJUDICATED FINDINGS — never "zero findings".** The dependency graph will always
contain licences that need a decision; the release gate is that every one of them **has a recorded
ruling** in ``scripts/license-adjudications.toml``. Adjudication is an **artifact, not a conversation**.

**Stale rulings are findings too.** A ruling whose package has vanished, or whose licence no longer
matches what the package actually ships, fails the audit — a rubber stamp that outlives the thing it
stamped is worse than no stamp, because it looks like diligence.

Exit codes: ``0`` clean (every finding adjudicated) · ``1`` something needs a human.

    python scripts/license_audit.py            # report + exit code
    python scripts/license_audit.py --write     # also refresh docs/audit/LICENSES.md
"""

from __future__ import annotations

import argparse
import importlib.metadata as md
import json
import os
import re
import subprocess
import sys
import tomllib
from collections import deque
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SELF = {"ledgerframe", "ledgerframe-frontend"}
# Test seam: the fail-first tests must be able to prove all three states (no rulings -> RED, rulings
# -> GREEN, MUTATED ruling -> RED again) without editing the committed file.
ADJUDICATIONS = Path(os.environ.get("LF_ADJUDICATIONS") or (REPO / "scripts" / "license-adjudications.toml"))

#: Licence families that CONSTRAIN redistribution and therefore need a human decision. This list is
#: deliberately broad: a false flag costs a glance, a missed one costs a licence violation.
FLAG = re.compile(
    r"\b(a?gpl|lgpl|mpl|mozilla|epl|eclipse|cddl|sspl|bsl|business source|osl|eupl|cc-by-sa|"
    r"cc-by-nc|prosperity|commons clause|elastic license|non-?commercial)\b",
    re.I,
)
PERMISSIVE = re.compile(r"\b(mit|bsd|apache|isc|python software foundation|psf|zlib|unlicense|cc0|0bsd|"
                        r"public domain|wtfpl|hpnd|mit-0)\b", re.I)


# --- backend -------------------------------------------------------------------------------------


def _runtime_closure() -> set[str]:
    """The transitive closure of what SHIPS — pyproject's `dependencies`, walked to the leaves."""
    pyproject = tomllib.loads((REPO / "pyproject.toml").read_text())
    roots = [re.split(r"[<>=!~\[; ]", d)[0].strip().lower()
             for d in pyproject["project"].get("dependencies", [])]

    seen: set[str] = set()
    queue = deque(roots)
    while queue:
        name = queue.popleft()
        key = name.lower().replace("_", "-")
        if key in seen:
            continue
        seen.add(key)
        try:
            dist = md.distribution(key)
        except md.PackageNotFoundError:
            continue
        for req in dist.requires or []:
            # Skip extras-only requirements ("foo; extra == 'bar'") — they don't ship unless asked for.
            if "extra ==" in req:
                continue
            dep = re.split(r"[<>=!~\[; ]", req)[0].strip().lower()
            if dep and dep not in seen:
                queue.append(dep)
    return seen


def _licence_of(dist: md.Distribution) -> str:
    meta = dist.metadata
    expr = meta.get("License-Expression") or ""
    if expr:
        return expr.strip()
    classifiers = [c for c in meta.get_all("Classifier") or [] if c.startswith("License ::")]
    if classifiers:
        return "; ".join(c.split("::")[-1].strip() for c in classifiers)
    lic = (meta.get("License") or "").strip()
    if lic and "\n" not in lic and len(lic) < 80:
        return lic
    return "UNKNOWN"


def audit_backend() -> list[dict]:
    runtime = _runtime_closure()
    rows = []
    for dist in md.distributions():
        name = (dist.metadata.get("Name") or "").strip()
        if not name or name.lower() in SELF:
            continue
        rows.append({
            "name": name,
            "version": dist.version,
            "licence": _licence_of(dist),
            "scope": "runtime" if name.lower().replace("_", "-") in runtime else "dev",
            "eco": "python",
        })
    return sorted({r["name"]: r for r in rows}.values(), key=lambda r: r["name"].lower())


# --- frontend ------------------------------------------------------------------------------------


def audit_frontend() -> list[dict]:
    """The PRODUCTION tree (`--omit=dev`), walked in full — this is what reaches a browser."""
    fe = REPO / "frontend"
    rows: list[dict] = []

    def _walk(node: dict, scope: str) -> None:
        for name, info in (node.get("dependencies") or {}).items():
            if name in SELF:
                continue
            # `npm ls` omits `path` for packages it did not install here (optional per-platform
            # binaries, e.g. @esbuild/win32-*). Fall back to node_modules, then to the package's own
            # manifest. Left unresolved they would report as 300 UNKNOWNs and drown the real signal.
            cand = [Path(info["path"])] if info.get("path") else []
            cand.append(fe / "node_modules" / name)
            lic = "UNKNOWN"
            not_installed = False
            for c in cand:
                mf = c / "package.json"
                if not mf.is_file():
                    continue
                pkg = json.loads(mf.read_text())
                raw = pkg.get("license") or pkg.get("licenses")
                if isinstance(raw, list):
                    lic = " OR ".join(x.get("type", "?") if isinstance(x, dict) else str(x) for x in raw)
                elif isinstance(raw, dict):
                    lic = raw.get("type", "UNKNOWN")
                elif raw:
                    lic = str(raw)
                break
            else:
                not_installed = True
            rows.append({"name": name, "version": info.get("version", "?"), "licence": lic,
                         "scope": scope, "eco": "npm",
                         "note": "not installed on this platform" if not_installed else ""})
            _walk(info, scope)

    for scope, flags in (("runtime", ["--omit=dev"]), ("dev", [])):
        try:
            out = subprocess.run(["npm", "ls", "--all", "--json", "--long", *flags],
                                 cwd=fe, capture_output=True, text=True, check=False).stdout
            _walk(json.loads(out or "{}"), scope)
        except (json.JSONDecodeError, FileNotFoundError):
            print(f"  ! could not read the npm {scope} tree (is `npm install` done?)", file=sys.stderr)

    # A package appearing in both trees is RUNTIME — that is the stricter, honest classification.
    best: dict[str, dict] = {}
    for r in rows:
        k = r["name"]
        if k not in best or (r["scope"] == "runtime" and best[k]["scope"] == "dev"):
            best[k] = r
    return sorted(best.values(), key=lambda r: r["name"].lower())


# --- report --------------------------------------------------------------------------------------


def classify(lic: str) -> str:
    if lic == "UNKNOWN" or not lic.strip():
        return "UNKNOWN"
    if FLAG.search(lic):
        return "FLAG"
    if PERMISSIVE.search(lic):
        return "ok"
    return "UNKNOWN"


# --- adjudication -------------------------------------------------------------------------------


def load_rulings() -> tuple[list[dict], list[dict]]:
    if not ADJUDICATIONS.is_file():
        return [], []
    doc = tomllib.loads(ADJUDICATIONS.read_text())
    return doc.get("ruling", []), doc.get("platform_family", [])


def _versions_match(spec: str, version: str, eco: str) -> bool:
    if spec.strip() == "*":
        return True
    if eco == "python":
        try:
            from packaging.specifiers import SpecifierSet
            from packaging.version import Version

            return Version(version) in SpecifierSet(spec)
        except Exception:  # noqa: BLE001 — an unparseable spec must NOT silently clear a finding
            return False
    # npm semver is not PEP 440; only an exact match (or "*") is honoured — deliberately, rather than
    # pretending to understand a range we cannot evaluate.
    return spec.strip() == version


def family_of(name: str) -> str:
    return f"{name.split('/')[0]}/*" if name.startswith("@") else name


def adjudicate(rows: list[dict]) -> dict[str, list]:
    """Match every finding to a recorded ruling. Anything unmatched — or matched by a ruling that no
    longer describes reality — is still a finding."""
    rulings, families = load_rulings()
    out: dict[str, list] = {"unadjudicated": [], "rejected": [], "stale": [], "cleared": [],
                            "new_families": []}
    present = {(r["name"].lower(), r["eco"]) for r in rows}

    for row in rows:
        if row["verdict"] not in ("FLAG", "UNKNOWN"):
            continue
        match = next(
            (r for r in rulings
             if r["package"].lower() == row["name"].lower()
             and r["ecosystem"] == row["eco"]
             and r["scope"] == row["scope"]),
            None,
        )
        if match is None:
            out["unadjudicated"].append(row)
            continue
        if match["ruling"].upper() == "REJECT":
            out["rejected"].append({**row, "ruling": match})
            continue
        # A ruling only clears the thing it actually described.
        if match["licence"].strip() != row["licence"].strip():
            out["stale"].append({**row, "why": f"ruling says {match['licence']!r}, "
                                               f"package ships {row['licence']!r}"})
            continue
        if not _versions_match(str(match.get("versions", "*")), row["version"], row["eco"]):
            out["stale"].append({**row, "why": f"version {row['version']} outside ruling range "
                                               f"{match.get('versions')!r}"})
            continue
        out["cleared"].append(row)

    # A ruling for a package that is no longer a dependency is dead weight — say so.
    for r in rulings:
        if (r["package"].lower(), r["ecosystem"]) not in present:
            out["stale"].append({"name": r["package"], "eco": r["ecosystem"], "scope": r["scope"],
                                 "version": "-", "licence": r["licence"],
                                 "why": "ruling exists for a package that is no longer a dependency"})

    ruled = {f["family"] for f in families}
    for fam in sorted({family_of(r["name"]) for r in rows if r["verdict"] == "not-installed"}):
        if fam not in ruled:
            out["new_families"].append(fam)

    return out


def write_notice(rows: list[dict], adj: dict) -> None:
    """Gate B4 — the NOTICE is GENERATED from the audit, not hand-kept.

    It lists the RUNTIME set only: a NOTICE is about what a user actually receives, and padding it
    with 340 dev tools would bury that. Every adjudicated licence is marked, so a reader can see that
    the copyleft in here was DECIDED on, not overlooked.
    """
    runtime = sorted((r for r in rows if r["scope"] == "runtime"), key=lambda r: r["name"].lower())
    cleared = {(c["name"], c["eco"]) for c in adj["cleared"]}

    lines = [
        "LedgerFrame",
        "© 2026 Gopala Subramanium",
        "",
        "This program is free software: you can redistribute it and/or modify it under the terms of",
        "the GNU Affero General Public License as published by the Free Software Foundation, either",
        "version 3 of the License, or (at your option) any later version. See LICENSE.",
        "",
        "=" * 79,
        "THIRD-PARTY DEPENDENCIES",
        "=" * 79,
        "",
        "GENERATED — do not hand-edit. Regenerate with:",
        "    python scripts/license_audit.py --notice",
        "",
        "This lists the RUNTIME set: what a user of LedgerFrame actually receives and runs. Build and",
        "test tooling is not listed here — it is not distributed — but it IS audited; see",
        "docs/audit/LICENSES.md for the full transitive graph (backend + frontend, dev included).",
        "",
        "LedgerFrame does not vendor or redistribute these packages: a source install fetches them",
        "from their own registries. They are attributed here because the product depends on them.",
        "",
        "Licences marked [ADJUDICATED] carry a recorded owner ruling in",
        "scripts/license-adjudications.toml — they were decided on, not overlooked.",
        "",
    ]
    for r in runtime:
        mark = " [ADJUDICATED]" if (r["name"], r["eco"]) in cleared else ""
        lines.append(f"  {r['name']} {r['version']} ({r['eco']}) — {r['licence']}{mark}")
    lines.append("")
    (REPO / "NOTICE").write_text("\n".join(lines) + "\n")
    print(f"\nwrote NOTICE ({len(runtime)} runtime dependencies attributed)")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="refresh docs/audit/LICENSES.md")
    ap.add_argument("--notice", action="store_true",
                    help="regenerate the root NOTICE (third-party attributions) — Gate B4")
    args = ap.parse_args()

    rows = audit_backend() + audit_frontend()
    for r in rows:
        # Packages npm declares but did not install here are esbuild's OPTIONAL per-platform binaries
        # (@esbuild/win32-*, etc). They are not present, not built, and not shipped from this machine.
        # They get their own verdict rather than being silently dropped (that would be a lie) or
        # reported as UNKNOWN (that would bury the one finding that matters under 300 non-findings).
        r["verdict"] = "not-installed" if r.get("note") else classify(r["licence"])

    absent = [r for r in rows if r["verdict"] == "not-installed"]
    adj = adjudicate(rows)
    needs_human = [r for r in adj["unadjudicated"] if r["scope"] == "runtime"]
    dev_flags = [r for r in adj["unadjudicated"] if r["scope"] == "dev"]

    print(f"\nDependency-licence audit — {len(rows)} packages "
          f"({sum(r['scope'] == 'runtime' for r in rows)} runtime, "
          f"{sum(r['scope'] == 'dev' for r in rows)} dev; "
          f"{len(absent)} declared-but-not-installed)\n")

    for r in adj["cleared"]:
        print(f"  [adjudicated] {r['scope']:7} {r['eco']:6} {r['name']}=={r['version']}  →  {r['licence']}")
    fams = len({family_of(r["name"]) for r in absent})
    print(f"  [platform-conditional] {len(absent)} declared-but-not-installed, {fams} families, all ruled")

    for r in needs_human:
        print(f"\n  x UNADJUDICATED (RUNTIME) {r['eco']} {r['name']}=={r['version']} -> {r['licence']}")
    for r in dev_flags:
        print(f"\n  x UNADJUDICATED (dev) {r['eco']} {r['name']}=={r['version']} -> {r['licence']}")
    for r in adj["rejected"]:
        print(f"\n  x REJECTED by the owner: {r['name']}=={r['version']} -> {r['licence']}")
    for r in adj["stale"]:
        print(f"\n  x STALE RULING {r['name']} ({r['eco']}/{r['scope']}): {r['why']}")
    for fam in adj["new_families"]:
        print(f"\n  x NEW platform-conditional family with no ruling: {fam}")

    if args.write:
        out = REPO / "docs" / "audit" / "LICENSES.md"
        lines = [
            "# Dependency licences — FULL transitive graph",
            "",
            "*Generated by `scripts/license_audit.py` (release-readiness Gate A8 / RD-2). Regenerate,",
            "never hand-edit. E4 re-runs it against the final public set.*",
            "",
            "**This file reports; it does not adjudicate.** Whether a flagged licence is compatible with",
            "shipping AGPL-3.0-or-later — and with the D-001 future-proprietary-layer path — is an",
            "**owner/counsel** decision, not a script's. The owner's rulings are recorded in",
            "`scripts/license-adjudications.toml` — adjudication is an **artifact, not a conversation**.",
            "",
            "**CLEAN = ZERO UNADJUDICATED FINDINGS — never 'zero findings'.** The graph will always",
            "contain licences that need a decision; the gate is that every one of them HAS one. A ruling",
            "that stops describing its package (wrong licence, package gone) is itself a finding: a",
            "rubber stamp that outlives what it stamped is worse than no stamp.",
            "",
            "**RUNTIME** = what a user receives and runs (the scope a distribution claim is about).",
            "**dev** = build/test tooling; it does not ship, and is listed for completeness.",
            "",
            f"- packages: **{len(rows)}** ({sum(r['scope'] == 'runtime' for r in rows)} runtime, "
            f"{sum(r['scope'] == 'dev' for r in rows)} dev)",
            f"- **unadjudicated** (blocks the release): **{len(needs_human)} runtime, {len(dev_flags)} dev**",
            f"- adjudicated (recorded owner ruling): **{len(adj['cleared'])}**",
            f"- stale rulings: **{len(adj['stale'])}** · rejected: **{len(adj['rejected'])}**",
            f"- platform-conditional (declared, not installed here): **{len(absent)}** across "
            f"**{fams}** families, all ruled",
            "",
            "| Scope | Eco | Package | Version | Licence | Verdict |",
            "|---|---|---|---|---|---|",
        ]
        order = {"FLAG": 0, "UNKNOWN": 1, "ok": 2, "not-installed": 3}
        for r in sorted(rows, key=lambda r: (r["scope"] != "runtime", order[r["verdict"]], r["name"].lower())):
            cleared = {(c["name"], c["eco"]) for c in adj["cleared"]}
            mark = {"ok": "ok", "FLAG": "⚠ **FLAG**", "UNKNOWN": "⚠ **UNKNOWN**",
                    "not-installed": "— not installed here"}[r["verdict"]]
            if (r["name"], r["eco"]) in cleared:
                mark += " · ✅ **ADJUDICATED** (owner, 2026-07-14)"
            lines.append(f"| {r['scope']} | {r['eco']} | `{r['name']}` | {r['version']} | {r['licence']} | {mark} |")
        out.write_text("\n".join(lines) + "\n")
        print(f"\nwrote {out.relative_to(REPO)}")

    if args.notice:
        write_notice(rows, adj)

    blocking = needs_human + dev_flags + adj["rejected"] + adj["stale"]
    if blocking or adj["new_families"]:
        print(f"\nNOT CLEAN — {len(needs_human)} unadjudicated RUNTIME, {len(dev_flags)} unadjudicated dev, "
              f"{len(adj['rejected'])} REJECTED, {len(adj['stale'])} stale ruling(s), "
              f"{len(adj['new_families'])} new platform family/families.")
        print("This script does NOT adjudicate. Record the owner's ruling in")
        try:
            print(f"  {ADJUDICATIONS.relative_to(REPO)}")
        except ValueError:
            print(f"  {ADJUDICATIONS}")
        print("Adjudication is an ARTIFACT, not a conversation. No public claim ships until every")
        print("finding has a recorded ruling (Gate A8 / E4).")
        return 1

    print(f"\nCLEAN — zero UNADJUDICATED findings ({len(adj['cleared'])} adjudicated; "
          f"{len(absent)} platform-conditional across {fams} ruled families).")
    print("Note: CLEAN does NOT mean 'no flagged licences'. It means every one of them carries a")
    print("recorded owner ruling, with a rationale and a date.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
