<!-- RATIFIED + SHIPPED 2026-07-14 (release-readiness Gate B8).
     B7 CLOSED: security@ledgerframe.org is live; the owner sent and received the
     verification mail on 2026-07-14. This file could not ship before that — an
     unmonitored disclosure inbox is the same defect class as an untested
     "tested-on" claim: it tells someone holding a vulnerability that a door
     exists, and the door goes nowhere. -->

# Security Policy

## Posture: yours, not ours

**Privacy, network egress, and exposure are the user's choice — the platform imposes no posture of its
own.** Its job is to honour the chosen posture faithfully. Some choices are enforced **structurally and
absolutely**: **no-egress means ZERO outbound calls**, enforced at a single choke point a provider
*physically cannot bypass*. Others are delivered **best-effort, and say so plainly.**

This matters for what you should report. **A best-effort control behaving best-effort is not a bug.
An ABSOLUTE control that turns out not to be absolute is the most serious bug this project can have** —
and Guarantee 5 is absolute whenever it is enabled.

## Reporting a vulnerability

**Email: security@ledgerframe.org**

Please do **not** open a public GitHub issue for a security problem. Send it to the address above and
give us a chance to fix it before it is public.

Useful things to include, if you have them: what you found, how to reproduce it, what an attacker could
actually do with it, and the version/commit you were on. A rough report is much better than no report —
do not polish it into never sending it.

## What to expect

**This is a single-maintainer project. There is no SLA, and pretending otherwise would be the first
untrue thing on this page.**

- Your report will be **acknowledged when it is read** — not within a guaranteed window.
- Fixes are prioritised by real-world impact on a **single-user, local-first** appliance.
- You will be credited if you want to be, and not if you don't.
- There is **no bug bounty**, and no payment.

## Scope — read this first, it will save you time

LedgerFrame is a **single-user, local-first** appliance. Several things that look like vulnerabilities
in a multi-tenant web app are **documented, deliberate design decisions** here — and they are written
down, with their reasoning, in [`docs/specs/SECURITY-BASELINE.md`](docs/specs/SECURITY-BASELINE.md).
That document is the place to start.

Specifically, and stated openly so nobody wastes their time proving it to us:

- **There is no multi-user model.** No permissions, no tenant isolation. By design.
- **No in-app TLS**, and the session cookie is not `Secure`. The app expects loopback, or a VPN where
  TLS lives at the network layer.
- **No PIN is required on a loopback-only install.** Enabling LAN access *does* require one.
- **Secrets live in `.env` (mode 0600)**, reachable by the process. There is no OS keyring.

**These are in `SECURITY-BASELINE.md` with their rationale. A report that simply restates one of them is
not a finding.** A report that shows one of them is *worse than we documented*, or is exploitable in a
way we did not anticipate — **that is very much a finding**, and we want it.

## Product Guarantee 5 — no-egress

With no-egress enabled, the device must make **zero** outbound network calls. Not fewer: zero.

It is enforced at a **single choke point** — every HTTP client in the codebase must be created through
it — and the build fails if any code constructs one another way. The complete, per-call-site inventory
is maintained in
[`docs/specs/SECURITY-BASELINE.md` → *Guarantee 5 — the outbound-call inventory*](docs/specs/SECURITY-BASELINE.md).

**Any outbound call that escapes that gate is a security bug, and we want to hear about it.**

## Supported versions

Only the **latest release** receives security fixes. There is no long-term-support branch.
