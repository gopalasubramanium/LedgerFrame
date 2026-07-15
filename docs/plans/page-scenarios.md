# page-scenarios — build plan

**Status: NOT DRAFTED. This file currently holds SCOPE-NOTES only.**

Scenarios is a **Planning**-group page (IA §2/§3): **deterministic what-if shocks on today's values — a
scenario, never a forecast** (D-058). It owns the fixed shock set, exposures, and liquidity what-ifs;
runway what-ifs consume the **canonical runway reader** (Net worth), never a private copy (D-036/D-058).

When drafted, this plan copies `TEMPLATE-page-build.md`, fills from the specs, and stops at §9 — with a
**verify-first pass (D-019)** over what `services/scenarios.py` actually serves and guards, before anything
is assumed.

The notes below are recorded ahead of the draft. They are inputs to §9, not resolutions of it.

---

## SCOPE-NOTES

### SN-1 — inherits the §12cf1-2 "Income & expenses" vocabulary *(page-cash-flow walk, 2026-07-15)*

Cash flow's walk ruled that the records the model calls **obligations** are shown to the user as
**"Income & expenses"** (§12cf1-2) — calling an incoming salary an *obligation* is the model's word, not the
user's. Review was aligned in the same milestone (page-review §12rv2-1).

**Scenarios has a SERVED string with the same mislabel that was DEFERRED to this build:** the
`obligation_due` what-if serves the note *"If the next 12 months of recorded **obligations** were paid from
liquid assets now."* (`services/scenarios.py`, the `obligation_due` shock).

- **Verify at Phase 0:** grep every served Scenarios string for the model's vocabulary (`obligation`), and
  **align it to "income and expenses"** where it faces the user — a served-string edit (D-005), fail-first,
  the §12cf1-2 / §12rv2-1 precedent. The shock's internal **key** (`obligation_due`) may stay a machine
  token; only the served **note/label** changes.
- ⚠ **Also confirm the reverse routing while here:** Review's `AREA_ROUTE` was corrected so goals and
  income/expenses point at **Cash flow**, not Scenarios (ND-7). Scenarios must not re-introduce itself as
  the canonical home for either.
