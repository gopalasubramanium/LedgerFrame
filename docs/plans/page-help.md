# page-help — build plan

**Status: NOT DRAFTED. This file currently holds SCOPE-NOTES only.**

Help is **release-blocking** (release-readiness **Gate C2**, RD-9): the `[Help]` popovers **already ship
across the built pages and point at a page that does not exist**. It is queued **plan-only first**, per
the standing rule that nothing is built without a plan file.

When drafted, this plan is a copy of `TEMPLATE-page-build.md`, filled from the specs, stopping at §9 —
with a **verify-first pass (D-019)** over what `GET /api/v1/help` actually serves and what its honesty
guards are, before anything is assumed.

The notes below are **owner rulings recorded ahead of the draft**. They are inputs to §9, not resolutions
of it.

---

## SCOPE-NOTES

### SN-1 — `[Help]` retrofit to the pre-affordance pages *(owner, 2026-07-14)*

**Retrofit `[Help]` to the pages built BEFORE the affordance existed — Holdings, Instrument Detail,
Portfolio, and the chrome.**

- **Targets are owner-picked, per page.** Which terms get a popover is a **judgment call the owner makes
  page by page** — not a rule automation applies.
- **Copy is PROPOSED → ratified at the walk.** Every popover body is drafted as PROPOSED and **ratified by
  the owner at the page walk**, like all user-facing copy.
- **Blanket-tooltip-everything is DECLINED.** Reason recorded: **noise + an unbounded copy burden**. A
  popover on every term trains the user to ignore all of them, and every one of them is a string somebody
  has to write, ratify, and keep true.

**Binding on the retrofit (from the existing rules, not new ones):**

- **A GLOSSARY term ships to the SPEC, not just the popover data** (page-heatmap §13-1). The glossary has
  **two stores** — `docs/specs/GLOSSARY.md` (canonical) and `frontend/src/mocks/glossary.ts` (what
  `[Help]` renders). **Add to `GLOSSARY.md` FIRST**, then the popover data.
  `tests/unit/test_glossary_parity.py` polices them: every popover term must exist in the spec with the
  **identical spelling**.
- Every retrofitted term must already exist in GLOSSARY with that exact spelling (CLAUDE.md hard rule), or
  its addition is a §9 item — **not an improvisation at build time**.
