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
- **THE HELP CURRENCY LAW** (owner, 2026-07-19, page-help §9-bis-11(d)): *Help is live
  documentation: any platform change updates Help in the same milestone, unsaid, as a
  mandatory part of every close.* Every close states either the Help delta that shipped,
  or an explicit **guard-corroborated** "no Help impact". The guards are the **HELP
  CURRENCY SUITE** (TEMPLATE-page-build.md §8) and they run at every close.

## Session protocol
- Start: read the current plan file; state what you will do; get confirmation.
- Work in small commits with descriptive messages.
- End: update the plan file with DONE / IN-PROGRESS / NEXT, and update any
  spec that changed. The next session starts from files, not memory.
