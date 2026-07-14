# ROADMAP.md — LedgerFrame Parked Items

**The rule: nothing on this list is built without a plan file in `docs/plans/`.**
These are accumulated breadcrumbs from the v2 decision audit — deliberately *not*
v2 work. Each entry is parked until a plan file covering it exists. Some carry
explicit gates or conditions (below) that a plan file must additionally satisfy.
Source: `docs/audit/DECISIONS.md` (D-001–D-080). Entries mirror that file's
merges — the historical-FX item is a single merged entry (D-020 + D-076).

---

| # | Item | Origin | Conditions / gates | Status |
|---|------|--------|--------------------|--------|
| R-1 | Optional passphrase mode (8–64 chars) | D-002 | — (PIN remains an access lock, not data-at-rest protection) | parked |
| R-2 | User-requestable transaction currencies | D-006 | Must be FX-validated — a currency may exist in the master only if the FX service can translate it | parked |
| R-3 | Domicile for fund-tax display | D-007 | Reintroduces a domicile field beyond the single authoritative `listing_country` | parked |
| R-4 | Instrument notes | D-015 | Follows the drop of the general `Note` table; per-record note fields cover the current need | parked |
| R-5 | Opt-in AI chat history | D-016 | Opt-in only; default remains ephemeral (Product Guarantee 6 — no stored AI conversations) | parked |
| R-6 | `spec` (specific-lot) cost-basis method | D-018 | Extends the per-account fifo/average selector | parked |
| R-7 | Corporate actions — de-merger / spin-off + ticker/symbol rename (v2.1 "accounting precision") | D-019 | **Owner-identified 2026-07-10.** De-merger/spin-off support + exposing a symbol/ticker rename. Splits/bonuses/mergers already engine-covered; see the v2.1 theme for the plan-file coverage. | parked |
| R-8 | Historical FX series (enables trade-date backfill + per-date realised totals) | D-020, D-076 | Merged entry. Native-currency stays the filing-grade output; base-currency realised totals stay explicitly indicative with caveats preserved | parked |
| R-9 | Insurance cash value: opt-in inclusion in Net worth | D-039 | Opt-in only; default remains permanently excluded in v2, stated visibly on Insurance and Net worth pages | parked |
| R-10 | App-wide Detail level | D-040 | Gated on per-page specs (v2 scopes Detail level to Home only) | parked |
| R-11 | User-defined scenario shocks | D-058 | Gated on a proper plan file; "scenario, never a forecast" preserved | parked |
| R-12 | Revisit AI validator strictness | D-070 | Only if fallback frequency proves high in practice; the validation contract may not weaken (Product Guarantee 7) | parked |
| R-13 | Per-lane provider priority editing | D-072 | Only on demonstrated need; no user-editable provider priority in v2 (visibility yes, editability no) | parked |
| R-14 | FD accrued-interest valuation | D-073 | First post-v2 feature. Plan file **must cover day-count conventions, compounding variants, maturity handling, and provenance labelling of calculated values**. `calculated_accrual` retained in the ValuationMethod vocabulary but no v2 lane emits it | parked |
| R-15 | User-configurable review thresholds | D-084 | The v2 defaults are owner-set (D-084: runway 3 months, goal 180 days, the rest as audited); this makes them user-editable. Each still a named constant with a rationale | parked |
| R-16 | Ticker scroll speed as a per-device display setting | D-047-amend / D-078 | **Owner-identified 2026-07-11 (page-chrome §11-18).** The ticker scroll duration (+ height/density) are tokens today; this exposes scroll speed as a **per-device** display axis (D-078, localStorage — like theme/density), for the **future Settings page plan**. NOT built now; default speed owner-ratified at 30s | parked |
| R-17 | Ticker index entries link to Markets | D-047-amend / D-098 | **✅ SHIPPED 2026-07-13 with the Markets build (page-markets ND-5, §12mk3-3; page-chrome §11-19 CLOSED).** `fetchTickerQuotes` sets the index `href` → `/markets` (holdings still → `/instrument/{symbol}`, D-098); owner verified the index-click lands on Markets live. Unit test (`chrome.test.ts`) pins the mapping | **DONE** |
| R-18 | D-101 themed scrollbar-thumb polish | D-101 | Parked cosmetic from Instrument Detail (the themed thumb didn't paint in **headless captures**; the structural fix — header-owns-gutter — is verified). **NOT addressed in page-chrome batches 1–4** (no scrollbar CSS touched). Named home for the polish/verification; a real browser is now available (ADR-0004 chromium) to confirm the thumb paints and close it | parked |
| R-19 | Customisable Home — movable/resizable widgets, user-selected set | D-046 (amends) / owner 2026-07-11 | **Amends D-046** (Home was deliberately simplified to a fixed set) — the plan file is a **decision amendment, not an addition**. Gates: the widget catalogue = **canonical-page summary readers ONLY** (P-1 + the enforcement corollary apply **per widget** — no widget adds a figure its canonical page lacks); the **D-046 fixed set stays the default + reset target**; **rotation / wall-appliance behaviour defined for custom layouts**. **v2 Home still builds to D-046 unchanged.** | parked |
| R-20 | External widget API — scoped long-lived keys for read-only summary widgets (Home Assistant / MagicMirror / kiosk) | D-069 / owner 2026-07-11 | Builds on **D-069 token semantics** (create / name / revoke; shown once; revoke severs). Gates: **read-only ONLY — no write scope exists**; **per-key scoping**; operates within the **D-001 posture** (LAN/VPN reach, never internet exposure; the plan file **must address the key-over-LAN threat model given no TLS in v2**); **inbound-serving vs no-egress semantics stated explicitly**. | parked |
| R-21 | External-connectivity adaptors (FIX, ISO 20022) as new **provider lanes** in the existing provider/routing model | Product Guarantee 1 & 5 / owner 2026-07-11 | Gates: **FIX = market-data / drop-copy READ-ONLY** — no order flow, no order endpoints (**Product Guarantee 1, protected**); **ISO 20022 = statement / position ingestion only**; adaptors **inherit provenance labelling**; under **no-egress every adaptor makes zero calls** and freshness degrades to **honest stale-flagging (Guarantee 5)**. **One plan file per protocol.** | parked |
| R-21a | MCP surface — recorded separately | D-067 / D-068 / owner 2026-07-11 | **AI-tool integration**, kin to the **AI-surfaces milestone** (D-067/D-068 pipeline), **not a market-data lane** — evaluate there, not as an R-21 provider adaptor. | parked |
| R-22 | AI provider configuration — local (Ollama) vs cloud API | D-067 / D-068 / D-069 / owner 2026-07-11 | **Explicit input to the AI-surfaces milestone plan** (D-067/D-068), not a standalone build. Gates: **API-key handling via the D-069 token pattern** (create / name / revoke; shown once; never returned); **no-egress interaction is normative — under no-egress AI is local-only (Ollama), a cloud provider makes zero calls** (D-075/D-060, honest degradation); the plan **decides whether first-run/Settings gain an AI configuration step there** (not this first-run milestone — D-045 stays the five steps, P-7). | parked |
| R-23 | RSS / user-defined news feeds as a **news provider lane** | owner 2026-07-11 | A user-defined feed lane in the existing provider/routing model. Gates: **provenance labelling** — each item carries its feed source, never presented as first-party; **zero calls under no-egress** (the lane degrades to honest stale/empty, Guarantee 5), like every other provider lane. | parked |
| R-24 | First-boot **license acceptance gate** | owner 2026-07-11 | **NOTE: cannot be a D-045 checklist step** — skippable ≠ acceptance. Would be a **separate blocking gate** (mounts before/around the shell, not the skippable first-run overlay). **Revisit only if the licensing / distribution posture demands it.** **RESOLVED 2026-07-14 (release-readiness RD-3): NOT needed for the v2.0 SOURCE release — cloning implies reading the LICENSE. R-24 STAYS PARKED.** Its revisit is now bound to a milestone, not a mood: **it is reconsidered if/when PACKAGED binaries ship** (release-readiness RD-1c), because that is the case where the user never sees a repo. *(The owner's earlier 'strike this and build it now' alternative is hereby closed.)* | parked (revisit at **packaged**) |
| R-25 | Personal-profile fields (name, for personalization) | D-045 (amend) / PRODUCT-SPEC / owner 2026-07-11 | **HARD GATES:** requires a **deliberate D-045 / PRODUCT-SPEC no-profiling amendment** (the current spec explicitly forbids profiling); **the owner must re-affirm it against the privacy identity** before any build; **DOB / gender remain out** regardless. Not a gap — a deliberately-declined-until-amended item (see page-first-run-checklist §12). | parked |
| R-28 | **Liquid-vs-illiquid net-worth trend decomposition** — a stacked-area Net worth trend split by liquidity rung | owner 2026-07-12 / page-net-worth §12b1-4 | **FORWARD-ONLY + OPT-IN** (mirrors the ND-1 no-backfill honesty ruling). Grounds — verified §12b1-4: `net_worth_snapshots` stores **scalar totals only** and `portfolio_snapshots.detail_json` is **written empty**, so **no historical split exists**. Gates: the worker **persists a liquidity/class split going forward** (snapshot detail — column vs `detail_json`, **shape TBD in the plan file**); **NO BACKFILL** — historical reconstruction needs **historical FX (R-8, parked)** and would **fabricate a split for manual assets** (property/cash have no price series, contra Guarantee 3); a **`PriceChart` stacked-area mode is a DESIGN-SYSTEM §5 amendment gate**; **plan-file gate standard** (nothing built without it). | parked |
| R-29 | **Implicit "seen" state for Review attention items** — a distinct concept from **Mark reviewed** | owner 2026-07-13 / page-review §12rv1-2 | Owner raised auto-recording a review on full-scroll + navigate-away — **DECLINED for v2** (§12rv1-2): (a) `POST /review/log` is **`require_auth` [S]** — a gated write must not fire silently; (b) a recorded review is a **deliberate `ReviewLog` attestation** (GLOSSARY), and scroll-past is not review — auto-attesting violates the trust posture; (c) it would **pollute Review history**. A future "seen" marker is a **separate concept** from Mark-reviewed and **requires its own concept, auth posture, contract delta + state model, and a plan file** (nothing built without it). Distinct from **per-signal acknowledge/dismiss** (ND-5, also ROADMAP). | parked |
| R-30 | **Postgres backend option** | owner 2026-07-14 | **Hosted-tier concern, paired with D-001's proprietary layer.** **SQLite is the appliance-correct choice for v2** — the file-based backup / restore / install story was **ratified at Gate B** (`backup.sh` + the `update.sh` backup gate + a single data dir *are* the recovery model, and they are the model precisely because the database is one file). A Postgres option is a **hosted-tier** need, not an appliance need; a plan file must state what it does to the backup/restore story, since that story is what a stranger installing the appliance actually depends on. | parked |
| R-31 | **Internationalization** — backend string catalog + per-locale GLOSSARY with parity guards | owner 2026-07-14 | **Platform milestone, and it is ENABLED BY THE ARCHITECTURE WE ALREADY BUILT:** because every user-facing label, vocabulary and money figure is a **served display string** (D-005 frontend-zero-copy; D-105 backend-formatted money), the strings are already in ONE place — the backend — instead of scattered through the components. Gates: a **backend string catalog** (the served labels become catalog keys); a **per-locale GLOSSARY**, since the hard rule is that every displayed term exists in GLOSSARY with that exact spelling — which must hold **per locale**, not just in English; and **parity guards per locale** (`test_glossary_parity.py` generalised — a locale that ships a term the spec lacks fails, exactly as today). Money/number/date formatting stays **backend-side** (D-105), so locale formatting has one home too. | parked |
| R-32 | **Voice — DEFINITION PENDING (owner)** | owner 2026-07-14 (RD-9 Timing Amendment 3) | **Named as a RELEASE-SCOPE GATE on 2026-07-14 — and it is the only item in that gate with NO definition anywhere:** no spec, no decision, no plan file, no prior ROADMAP entry. **It requires an OWNER DEFINITION and its own milestone plan before the release gate can even be EVALUATED against it.** ⚠ **No Voice behaviour has been invented, assumed, or inferred.** *What exists today is NOT a definition:* an optional `voice` extra (**vosk** + **sounddevice**) in `pyproject.toml` and an install-time prompt in `install.sh`. That is a **dependency and an installer option** — it says nothing about what Voice IS, what it does, what it may read, or what it may never do. Gates a definition must set, at minimum: **scope** (dictation? command? read-out?); **the Guarantee-1 line** (the platform never executes trades — a voice surface may not become an instruction channel); **the Guarantee-5 line** (no-egress — is recognition local-only, and does audio ever leave the device?); and whether it rides the **P-6 single AI pipeline** (D-067/D-068) or is a separate lane entirely. **This item blocks the release gate until the owner defines it.** | **DEFINITION PENDING** |

---

## Themes

### v2.1 — "accounting precision" (D-088)

The first coherent post-v2 milestone bundles three parked items that together
sharpen the ledger's accounting fidelity. They are grouped for sequencing only —
**each still requires its own plan file** before any is built, and each keeps its
individual gate:

| In the theme | Item | Individual gate (unchanged) |
|---|---|---|
| R-6 | `spec` (specific-lot) cost-basis method | extends the per-account fifo/average selector |
| R-7 | Corporate actions — de-merger / spin-off + ticker rename | **owner-identified 2026-07-10**; plan-file coverage below |
| R-8 | Historical FX series (trade-date backfill + per-date realised totals) | native currency stays filing-grade; base totals stay explicitly indicative |
| R-14 | FD accrued-interest valuation | plan file must cover day-count, compounding, maturity, and provenance labelling of calculated values |

**R-7 — de-merger / spin-off + ticker rename (owner-identified 2026-07-10).**
A de-merger/spin-off is a **merger-in-reverse**: one holding splits into several
resulting instruments. The plan file **must cover**:

- **Cost-basis apportionment** across the resulting instruments per an **approved
  ratio**, with **holding-period carry** (each resulting lot keeps the original
  acquisition date) and **zero realised gain** (a spin-off is not a sale) —
  mirroring the merger invariant in reverse.
- **Ratio as user input vs a published-ratio reference** — how the apportionment
  ratio is entered/sourced and labelled (user-entered vs referenced).
- **Multi-instrument creation flow** — recording one action that creates/updates
  several instruments (the parent + each spun-off child) in one reviewed step.
- **FX acquisition-rate carry** — each carried lot preserves its original
  acquisition FX rate (so trade-date-FX realised totals stay correct downstream).
- **Provenance labelling** — the resulting synthetic lots are marked as
  corporate-action-derived (source/valuation labelling), never presented as market
  buys.
- **Ticker / symbol rename** — expose editing an instrument's **symbol** (today
  `InstrumentPatch` edits name/class/country/source only). **Verified 2026-07-10:**
  the data model already supports this safely — transactions/holdings/lots
  reference `instruments.id` (FK), and instrument identity is `(id_type, value)`
  in `instrument_identifiers`, so a rename preserves history and price continuity;
  only the **API/UI to change the symbol** is missing. (Instrument **name** edits
  are already supported — see GLOSSARY "Ticker / name change".)

All other R-items remain independent parked breadcrumbs, not part of this theme.

---

## Not on this list (recorded, but not ROADMAP)

- **SaaS/PaaS hardening layer** (D-001) — a future proprietary layer, recorded
  in an ADR rather than here. v2 core must not make choices that preclude it,
  but it is out of scope for v2 core and is not a parked ROADMAP item.
