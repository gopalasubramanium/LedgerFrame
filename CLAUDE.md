# LedgerFrame v2 — Working Rules for Claude Code

## Before any work
1. Read docs/specs/PRODUCT-SPEC.md and the plan file for the current task.
2. Never invent UI, terminology, or data fields. If it is not in the specs,
   STOP and add an entry to docs/plans/CURRENT.md under "Needs decision".

## Hard rules
- Every user input must use a component from src/components/ui/. Raw <input>,
  <select>, or ad-hoc styling is forbidden.
- Every categorical field must reference MASTER-DATA.md. No free-text enums.
- Every term shown to users must exist in GLOSSARY.md with that exact spelling.
- Every piece of information has ONE canonical page (INFORMATION-ARCHITECTURE.md).
  Other pages may summarize it with a link, never duplicate it.
- All money math stays in the backend (Decimal). The frontend never computes
  financial values.
- No new dependencies without an ADR.
- The platform never executes trades, never advises, never fabricates a number.
- **SPECS NEVER HARDCODE LIVE PORTS.** No test, spec, or dev driver may name the owner's
  live stack (`:8321`/`:5173`) — comments included, since a documented port becomes a
  copy-pasted port. Smoke drivers derive their target from
  `frontend/e2e/smoke/smoke-target.mjs`, which is **fail-closed**: unset config refuses,
  and an explicitly-configured live port refuses. Guard: `npm run check:smoke-isolation`.
  *Why:* 20 specs hardcoded `:8321`; an "isolated" re-run sent its writes at the owner's
  live DB and one spec would have SET A PIN on an unlocked install. It held by luck (a
  401), not by design (08-TECH-DEBT, resolved `4af11f5`).
- **THE HELP CURRENCY LAW** (owner, 2026-07-19, page-help §9-bis-11(d)): *Help is live
  documentation: any platform change updates Help in the same milestone, unsaid, as a
  mandatory part of every close.* Every close states either the Help delta that shipped,
  or an explicit **guard-corroborated** "no Help impact". The guards are the **HELP
  CURRENCY SUITE** (TEMPLATE-page-build.md §8) and they run at every close.
- **A NEW GUARD THAT REDS AN ACCEPTED SURFACE IS A DELTA ON THAT SURFACE, NOT A FOOTNOTE**
  (architect, 2026-07-19, from the Help-close review): when a guard introduced by one
  milestone goes RED on a page ratified by an earlier one, the fix ships **with a dated
  delta note in that page's plan file and that page's pre-pass re-run, in the same delta**.
  **Flagging it in a close report is not sufficient.** *Why:* the Help close fixed
  `var(--radius-2)` in `NetWorth.css` — a correct fix on an accepted surface, outside the
  ruling's scope — and only flagged it. An accepted page had then changed with no record on
  its own plan file and no re-walk, so the next reader of `page-net-worth.md` would see a
  ratified page that no longer matched its record. Same convention the About-tab amendment
  already used (IA §5 Settings: *"dated delta note in `page-settings.md` + a Settings
  pre-pass re-run"*); this makes it standing rather than per-case.

## Session protocol
- Start: read the current plan file; state what you will do; get confirmation.
- Work in small commits with descriptive messages.
- End: update the plan file with DONE / IN-PROGRESS / NEXT, and update any
  spec that changed. The next session starts from files, not memory.
