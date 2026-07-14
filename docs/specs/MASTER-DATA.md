# MASTER-DATA.md — LedgerFrame v2 Controlled Vocabularies & Masters

**Normative.** This file is the single register of every controlled vocabulary
and reference master in v2. CLAUDE.md hard rule: every categorical field
references this file; no free-text enums. D-005 completeness rule: **every
vocabulary must appear here with its complete seed value list — no vocabulary is
confirmed without its values.** The DEF backfill extracted the pending
vocabularies verbatim from the legacy v1 source (read-only reference); the two
that have no definition in code — `asset_subclass` (§2 †) and the sector seed
(§6 †) — are **authored proposals** (no extraction was possible), every value
tagged **PROPOSED** and ratified at review. Nothing is guessed. [§9](#9-blocked-extractions)
is now empty.

---

## 1. Architecture (D-005, "hybrid")

Two mechanisms, no third:

**A. Fixed vocabularies** — code-defined enums.
- Defined once in backend code.
- Served to the frontend via a **single `/refdata` endpoint**. There is no
  second copy anywhere.
- Enforced at the database with **CHECK constraints** (today these fields are
  unconstrained `String` columns — see 02-DATA-MODEL §4; v2 adds the CHECK).
- Not user-editable.

**B. User-extensible masters** — database reference tables.
- Rows live in DB tables; referencing columns are **FK-enforced**.
- Users add/rename/merge rows through an admin screen (§7).

**Frontend carries zero vocabulary copies.** `refdata.ts`, `policyTemplates.ts`,
and every inline list (`CURRENCIES`, `COUNTRIES`, `ASSET_CLASSES`,
`TXN_ASSET_CLASSES`, …) are retired (D-005, D-049). The frontend obtains fixed
vocabularies from `/refdata` and extensible masters from their own endpoints.
The 6-value `TXN_ASSET_CLASSES` subset is deleted; forms use the full 13-value
`AssetClass` from `/refdata` (D-049).

Governing rule for confirmation: a vocabulary is "confirmed" only when its
complete value list is written here. Fixed vocabularies whose values are fully
recorded in DECISIONS.md D-010 or the schema audit are confirmed below (§2);
those whose values live only in un-extracted service code are **not confirmed**
(§9).

---

## 2. Fixed vocabularies (served via `/refdata`, DB CHECK)

Each is code-defined and enumerated in full. "Column(s)" names the storage from
02-DATA-MODEL. Source column: `D-010` = enumerated verbatim in DECISIONS.md
D-010; `02` = from the schema audit.

| Vocabulary | Column(s) | Count | Complete seed values | Source |
|------------|-----------|-------|----------------------|--------|
| **TxnType** | `transactions.type` | 11 | `buy, sell, dividend, interest, deposit, withdrawal, fee, split, bonus, merger, transfer` | D-010 |
| **AssetClass** | `instruments.asset_class`, `holdings.asset_class` | 13 | `equity, etf, mutual_fund, bond, cash, fixed_deposit, commodity, crypto, property, private, retirement, liability, other` | D-010 |
| **liquidity_profile** | `instruments.liquidity_profile` | 5 | `listed, redeemable, locked, illiquid, manual` | D-010 |
| **Entity.kind** | `entities.kind` | 5 | `self, spouse, trust, company, other` | D-010 |
| **Goal.basis** | `goals.basis` | 3 | `net_worth, liquid, none` | D-010 |
| **Obligation.recurrence** | `obligations.recurrence` | 4 | `once, monthly, quarterly, annual` | D-010 |
| **Obligation.kind** | `obligations.kind` | 2 | `expense, income` | D-010 |
| **Contribution.frequency** | `contribution.frequency` | 4 | `monthly, quarterly, annual, once` | D-010 |
| **Contribution.kind** | `contribution.kind` | 3 | `invest, withdraw, prepay` | D-010 |
| **EstateProfile.will_status** | `estate_profile.will_status` | 4 | `none, draft, executed, needs_update` | D-010 |
| **EstateDocument.status** | `estate_document.status` | 3 | `present, missing, outdated` | D-010 |
| **ValuationMethod** | `instruments.valuation_method`, provenance | 9 | `market_quote, official_nav, broker_quote, manual_valuation, statement_import, calculated_accrual, estimated_value, fx_reference, unavailable` | D-010 |
| **EntitlementStatus** | `quotes.entitlement`, provenance | 5 | `real-time, delayed, end-of-day, cached, unavailable` | D-010 |
| **PolicyTarget.dimension** | `policy_targets.dimension` | 3 | `asset_class, currency, region` | 02 §2.8 |
| **InstrumentIdentifier.id_type** | `instrument_identifiers.id_type` | 8 | `isin, cusip, figi, sedol, amfi_code, kite_token, coingecko_id, provider_symbol` | 02 §2.2 |
| **cost_basis_method** | `accounts.cost_basis_method` | 2 (v2) | `fifo, average` (v2 lanes; `spec` is ROADMAP R-6, D-018 — not a v2 value) | D-018 |
| **Account.kind** | `accounts.kind` | 7 | `brokerage, bank, retirement, wallet, property, manual, other` | DEF-3 |
| **InsurancePolicy.policy_type** | `insurance_policy.policy_type` | 10 | `term_life, whole_life, health, critical_illness, disability, personal_accident, property, motor, travel, other` | DEF-4 |
| **InsurancePolicy.premium_frequency** | `insurance_policy.premium_frequency` | 4 | `monthly, quarterly, annual, single` | DEF-4 |
| **EstateDocument.category** | `estate_document.category` | 9 | `will, insurance, property, loan, identity, bank, tax, medical, other` | DEF-5 |
| **EstateContact roles** | `estate_contact.roles` (JSON list) | 5 | `nominee, beneficiary, executor, emergency, guardian` | DEF-5 |
| **Instrument.asset_subclass** | `instruments.asset_subclass` | 6 (PROPOSED) | `crypto, derivative, equity, etf, mutual_fund, reit` (authored — per-value table below) | DEF-2 † |

**Notes on specific vocabularies:**
- `TxnType` — the frontend gains `merger` (previously omitted from the 10-value
  client list); the canonical set is the 11 backend values (D-010).
- `ValuationMethod` — `calculated_accrual` and `statement_import` remain in the
  vocabulary but **no v2 lane emits them** (D-073). The values are retained; the
  routing chains do not produce them.
- `EntitlementStatus` — LedgerFrame never claims `real-time` for its own data;
  the value exists to record a source's *claim* (GLOSSARY, D-027).
- `id_type` — the high-confidence subset (globally unique per instrument) is
  `{isin, cusip, figi, sedol, amfi_code, kite_token, coingecko_id}`;
  `provider_symbol` is the non-high-confidence remainder (02 §2.2).
- **`other` across vocabularies (D-087)** — `other` is **retained** in every
  fixed vocabulary that carries it (`AssetClass`, `Account.kind`,
  `InsurancePolicy.policy_type`, `EstateDocument.category`, `Entity.kind`, …) as
  the **honest escape valve**: a user is never forced into a wrong specific
  value. Over-use of `other` on holdings is surfaced by the Review signal
  `_OTHER_CLASS_OVERUSE_PCT = 10` (%) (PRODUCT-SPEC §5), prompting proper
  reclassification — the value stays, the nudge is separate.

**Notes on the backfilled vocabularies (DEF-3/4/5):**
- `Account.kind` — extracted from `ACCOUNT_KINDS` verbatim (DEF-3 resolved).
- `InsurancePolicy.premium_frequency` — the value set is `..., single` (a
  paid-once policy), **not** `once`; distinct from `Contribution.frequency`
  (`..., once`). Do not conflate them.
- `EstateContact roles` — this is the `CONTACT_ROLES` vocabulary into which the
  former free-text `relationship` field is **folded** (D-010); the separate
  `relationship` field is dropped. Stored as a JSON list on `estate_contact.roles`.
- `estate.py` also confirms `WILL_STATUSES` and `DOC_STATUSES` match the D-010
  values already in the table above (bonus confirmation from the same source).

### `Instrument.asset_subclass` — authored fixed vocabulary (DEF-2 †)

D-009 specifies `asset_subclass` as a **fixed vocabulary**, but there is **no
enum in code** — it is a free `String(40)` populated ad hoc. This vocabulary is
therefore **authored, not extracted** (†): confirmed values come from code, the
rest are **PROPOSED** and ratified at review. Each value states which consumer
reads it.

| Value | Status | Consumer (reads it) | Source / justification |
|-------|--------|---------------------|------------------------|
| `derivative` | **confirmed** | **PriceSourceRouter** — `lane_for` routes `sub == "derivative"` → the `derivative` lane (`kite → statement → manual`). The **only** subclass value read for behaviour. | assigned `kite.py:94`, `market.py:417/433`; read `router.py:131`, lane `router.py:123` |
| `crypto` | **confirmed** | display-only (routing keys on `asset_class == crypto`, not the subclass) | assigned `coingecko.py:89` |
| `equity` | **confirmed** | display-only | assigned `kite.py:97` |
| `mutual_fund` | **confirmed** | display-only | assigned `amfi.py:75` |
| `etf` | **PROPOSED** | display-only | named by D-009; distinguishes ETFs from direct equity in taxonomy/reporting. Not assigned anywhere in code. |
| `reit` | **PROPOSED** | display-only | named by D-009; distinguishes REITs (property-like listed equity) for display. Not assigned anywhere in code. |

**Deliberately excluded:** `bond`, `deposit`/`fixed_deposit`, `retirement`.
Although D-073's manual lanes exist for these, `lane_for` selects them by
**`asset_class`** (`bond` / `fixed_deposit` / `retirement`), **not** by
`asset_subclass` (`router.py:128-145`) — no subclass value is read for them, so
adding one would be redundant and misleading. The historical migration
`a3d21f7e5b10:70` backfilled `asset_subclass = asset_class`; a v2 migration
should normalise any such rows to the vocabulary above (unmapped → null).

**Classification guidance (D-085).** `asset_class` describes economic
**exposure**; `asset_subclass` describes the **wrapper**. The two are set
independently: a listed REIT is `asset_class = property` with
`asset_subclass = reit` (property exposure, listed-equity wrapper); an equity
ETF is `asset_class = equity` with `asset_subclass = etf`; a bond fund's class
stays `bond` regardless of wrapper. This resolves the `etf`/`reit` review
challenge (REVIEW-GUIDE A1): both PROPOSED values are kept, and this rule governs
how they are assigned.

---

## 3. Currency master (D-006)

> ### ⚠ AMENDED 2026-07-14 (owner) — **the currency master is `SUPPORTED_CURRENCIES`, a code constant. There is no currency TABLE.**
>
> **The spec follows the verified code. The table described below was never built.**
>
> This section previously specified a **reference table** (`code` PK + `is_base_eligible` column)
> seeded with **22 codes**. **No such table exists** — not in `app/models/`, not in any migration.
> The divergence was found by the **page-policy verify-first pass** (§10-10) while auditing where
> a policy `bucket` on the `currency` dimension must draw its vocabulary from, and it was closed
> by **Gate A9**, which had to validate against something real.
>
> **The canonical currency master is `SUPPORTED_CURRENCIES`** — `app/core/config.py:18`:
>
> ```python
> SUPPORTED_CURRENCIES = ["SGD", "USD", "INR", "EUR", "GBP", "JPY", "AUD", "CNY", "HKD"]
> ```
>
> **Nine codes.** It is not a shadow list: it is what `/settings` already **serves**
> (`supported_currencies`, `settings.py:58`), what `base_currency` is already **validated against**
> (`settings.py:78`, `config.py:115`), and — since **A9** — what a **policy `currency` bucket** is
> validated against (`services/policy.py`, `master_buckets("currency")`). One vocabulary, three
> consumers, no second list.
>
> **`is_base_eligible` restated against the constant.** The flag was a **column on a table that does
> not exist**. Its semantics are preserved by the constant itself: **every one of the 9 codes is
> base-eligible**, because `SUPPORTED_CURRENCIES` *is* the base-currency vocabulary
> (`config.py:115` rejects any base currency outside it). The `false` tier — a wider
> **transaction-only** set — **does not exist in v2**. The distinction the flag drew is therefore
> **real but currently degenerate**: base-eligible set == transaction set == the 9 codes.
>
> **Future delta (deliberate, not parked as an R-item):** if multi-currency expansion ever needs a
> genuine transaction-only tier, **that is the moment to build the real table** with
> `is_base_eligible` as a column, re-splitting the two sets. It is a **deliberate future delta**,
> recorded here in one line rather than as a ROADMAP item — because it is a **consequence of a
> product decision not yet made**, not a parked piece of work. **R-2** (user-requestable transaction
> currencies, FX-validated) is the decision that would trigger it.
>
> **Superseded text is preserved below, struck through.** A spec that quietly rewrites itself is
> worse than one that shows its corrections.

**FX-translatability rule (governing, D-006) — STILL IN FORCE:** *a currency may exist in the
master only if the FX service can translate it.* Any candidate that the FX service cannot translate
is not admitted. The 9 `SUPPORTED_CURRENCIES` satisfy this by definition — the engine's comment at
`config.py:17` states exactly that (*"Currencies the engine knows how to convert and display"*).

**Base-currency picker** draws from `SUPPORTED_CURRENCIES` (Settings → base currency). Transaction
and holding currency fields draw from the **same 9** — there is no wider tier in v2.

**FX-translatability validation is operational, not a static list.** The FX service holds no
hard-coded translatable set: `ecb_fx._RATES` is loaded at runtime from the ECB daily reference feed
(`ecb_fx.py:24,71-73`) and `fx.py` triangulates cross rates through USD with ECB as fallback
(`fx.py:51`). So D-006's rule is enforced **at admission time against the live FX service**, not by
a code constant — which is precisely why admitting a 10th currency is a **plan-file change**, not a
list edit.

**ROADMAP (R-2, D-006):** user-requestable transaction currencies, FX-validated. **This is the
decision that would build the real table** (see the amendment note above).

---

### ~~Superseded (pre-2026-07-14): the currency TABLE that was never built~~

> ~~A reference master, not a plain enum, because it carries a flag.~~
>
> | ~~Column~~ | ~~Meaning~~ |
> |--------|---------|
> | ~~`code`~~ | ~~ISO-4217 alpha-3 (e.g. SGD, USD). PK.~~ |
> | ~~`is_base_eligible`~~ | ~~Boolean. `true` = usable as **base/reporting** currency; the wider set (`false` too) is valid only as a **transaction** currency.~~ |
>
> ~~**Base-currency picker** draws from `is_base_eligible = true` only (Settings → base currency).
> Transaction/holding currency fields draw from the full master.~~
>
> ~~**Seed (DEF-1, extracted).** The seed is the **union** of three divergent legacy lists,
> deduplicated (`HKD` appears twice in the PortfolioEditor list):~~
>
> | ~~Group~~ | ~~Codes~~ | ~~`is_base_eligible`~~ | ~~Source~~ |
> |-------|-------|--------------------|--------|
> | ~~Base-eligible (`config.SUPPORTED_CURRENCIES`, 9)~~ | ~~`SGD, USD, INR, EUR, GBP, JPY, AUD, CNY, HKD`~~ | ~~**true**~~ | ~~`config.py:18`~~ |
> | ~~+ adds from `refdata.ts CURRENCIES` (14)~~ | ~~`CAD, CHF, AED, MYR, THB`~~ | ~~false~~ | ~~`refdata.ts:8`~~ |
> | ~~+ adds from PortfolioEditor inline (21 unique)~~ | ~~`KRW, TWD, SEK, NOK, DKK, ZAR, BRL, NZD`~~ | ~~false~~ | ~~`PortfolioEditor.tsx:22`~~ |
>
> ~~**Full seed = 22 unique codes**, `is_base_eligible = true` for exactly the 9
> `SUPPORTED_CURRENCIES`, `false` for the other 13.~~
>
> ~~The 13 wider codes must be confirmed translatable when the currency master is seeded (any that
> the FX service cannot translate are dropped per D-006, not carried).~~

**Why the seed never happened, honestly:** the 13 extra codes came from **two frontend lists**
(`refdata.ts`, `PortfolioEditor.tsx`) that **D-005 retired** — the frontend's inline vocabularies are
gone, and with them the only source that ever claimed those currencies. Nothing in the backend has
ever supported them. Recording the seed as "pending" would have been the fiction; the **9** are what
the engine can actually convert and display.

---

## 4. Country & region model (D-007)

**`instruments.listing_country` (ISO-3166 alpha-2) is the single authoritative
country field.** Dropped: `instruments.country` (free text) and
`instruments.domicile_country`.

- **Reference table:** the ISO-3166-1 alpha-2 standard seeds the country picker
  (the seed *is* the published ISO-3166 code list — a standard, not a decision
  to author).
- **Region is derived, never stored as a separate vocabulary** (D-007). The
  bucket set was **expanded from four to six** at review (D-083). The six values
  below are the complete `region` vocabulary (used as a policy-dimension bucket
  set, D-055/02 §2.8):

  | Region | `listing_country` members |
  |--------|---------------------------|
  | **India** | `IN` |
  | **Singapore** | `SG` |
  | **US** | `US` |
  | **Europe** | `GB, IE, FR, DE, NL, BE, LU, CH, AT, ES, PT, IT, GR, SE, NO, DK, FI, IS, PL, CZ, SK, HU, RO, BG, HR, SI, EE, LV, LT, CY, MT` |
  | **APAC** | `JP, CN, HK, MO, TW, KR, AU, NZ, MY, TH, ID, PH, VN` (Asia-Pacific excluding `IN`/`SG`) |
  | **Other** | **catch-all** — any `listing_country` not listed above (e.g. `CA, MX, BR, AR, CL, AE, SA, IL, TR, ZA, RU, …`). |

  The derivation is: match `IN`/`SG`/`US` first; then the Europe and APAC
  membership lists; anything unmatched falls to **Other**. Membership is
  authored (D-083) and may be extended by amending this table (a code +
  migration change, not a user action — region is derived, not stored).

**ROADMAP (R-3, D-007):** re-introduce a domicile field for fund-tax display.

---

## 5. Timezone (D-013)

`Settings` timezone becomes an **IANA timezone** select, replacing free-text
entry. The seed is the **IANA Time Zone Database** (`tz` database) name list — a
maintained standard, served to the picker; not a value list authored here.

---

## 6. User-extensible masters (DB reference tables, FK-enforced)

| Master | Referencing columns (FK) | Seed | Uniqueness |
|--------|--------------------------|------|-----------|
| **Institution** (D-008) | `accounts.institution`, `insurance_policy.insurer` | none (starts empty; user-populated) | by name; merge dedupes variants ("DBS" vs "DBS Bank") |
| **Sector** (D-009) | `instruments.sector` | 11 GICS sectors (authored, PROPOSED — see below) | by name |
| **Tag** (D-011) | `holding_tag.tags` (JSON list, keyed by `account_id` + `holding_key`) | none | **case-insensitive**, cap **16 tags/holding** |

**Institution (D-008).** One master, FK'd from both `accounts.institution` and
`insurance_policy.insurer`. Estate `estate_document.related_to` stays **free
text by design** (architectural invariant — the estate register deliberately
does not FK into other tables; do not "normalise" it).

**Sector (D-009) — authored seed (DEF-6 †).** User-extensible, seeded GICS-like.
There is **no sector master or GICS list in code** (only the `_SECTOR_MAP`
ticker→sector fallback, `portfolio.py:30-51`), so the seed is **authored, not
extracted** (†) and ratified at review. Proposed seed = the **11 standard GICS
sectors** (all **PROPOSED**); users may add more (extensible):

1. Energy · 2. Materials · 3. Industrials · 4. Consumer Discretionary ·
5. Consumer Staples · 6. Health Care · 7. Financials ·
8. Information Technology · 9. Communication Services · 10. Utilities ·
11. Real Estate.

**Migration mapping — code-observed `_SECTOR_MAP` (12) → seed** (no silent
merges; unmapped values are flagged, not forced):

| `_SECTOR_MAP` value | → GICS seed sector | Note |
|---------------------|--------------------|------|
| `Technology` | **Information Technology** | clean rename to the GICS canonical label |
| `Communication Services` | Communication Services | exact |
| `Consumer Discretionary` | Consumer Discretionary | exact |
| `Consumer Staples` | Consumer Staples | exact |
| `Financials` | Financials | exact |
| `Energy` | Energy | exact |
| `Health Care` | Health Care | exact |
| `Industrials` | Industrials | exact |
| `Utilities` | Utilities | exact |
| `Crypto` | **(no map)** | not a GICS sector — it is an asset class. **Migration:** set `sector = null`; allocation already handled by `asset_class`. Do **not** merge into a sector. |
| `Index / ETF` | **(no map)** | a fund wrapper, not a sector. **Migration:** `sector = null` (resolve from constituents if ever needed). Do **not** merge. |
| `Commodities` | **(no map)** | a commodity asset, not a company sector (≠ GICS *Materials*). **Migration:** `sector = null`; handled by `asset_class`. Do **not** merge into Materials. |

GICS **Materials** and **Real Estate** are seeded even though no `_SECTOR_MAP`
ticker used them (they simply start empty).

**Null-sector display (D-082).** The three no-map rows keep `sector = null` in
data (no forced merge — the honesty point of the mapping). In **sector views**
(allocation-by-sector, sector rollups) these null-sector holdings are **not
hidden**: they are collected into an explicit **"Unclassified sector"** bucket
(label amended 2026-07-11; GLOSSARY). Their allocation is already carried by
`asset_class`; the bucket makes the null visible rather than silently dropping
rows from a sector chart.

**Tag (D-011).** Uniqueness is **case-insensitive**; rename **cascades to all
tagged holdings**; the 16-tags-per-holding cap is retained. `holding_key` is the
instrument symbol or manual-asset label. **Normalise-on-write vs render-verbatim
(D-104):** user-entered tags are normalised on write (lowercase, spaces →
underscores, truncate 24, de-dupe — data hygiene), but the **UI renders every tag
verbatim with no casing transform**. The **demo seed** writes display-cased tags
(`Core`/`Dividend`/`Speculative`) directly, **bypassing the cleaner** — a
sanctioned demo-only cosmetic exception.

**Currency (§3)** is **not a table** — it is the code constant `SUPPORTED_CURRENCIES`
(§3 AMENDMENT 2026-07-14). It is neither user-extensible nor seed-managed: adding a
currency is a **code + plan-file change** gated on the FX-translatability rule
(user-requestable additions are ROADMAP R-2).

---

## 7. Admin-screen requirements (per user-extensible master)

Each extensible master needs an admin surface. Common requirements:

- **Institution** — create, rename, **merge** (fold duplicate into a survivor,
  re-pointing every referencing `accounts.institution` / `insurance_policy.insurer`
  row). **Delete blocked while any row references it** (FK guard); offer merge
  instead.
- **Sector** — create, rename, merge. Delete blocked while any instrument
  references it. Ships pre-seeded with the 11 GICS sectors (§6, PROPOSED).
- **Tag** — create, rename (**cascades** to every tagged holding), **dedupe/merge**
  for case and whitespace variants. Enforce case-insensitive uniqueness and the
  16-per-holding cap at write time.
- **Currency** — **NO admin screen** (§3 AMENDMENT 2026-07-14). Currency is a **code
  constant**, not an extensible master, so it belongs with the fixed vocabularies below,
  not here: there are no rows to view, rename or merge, and no `is_base_eligible` column
  to display (all 9 codes are base-eligible). Settings shows the **base-currency picker**
  over `SUPPORTED_CURRENCIES`, and that is the entire surface. New transaction currencies
  stay gated behind the FX-translatability rule (ROADMAP R-2).

Fixed vocabularies (§2) have **no admin screen** — they are code-defined and
change only by code + migration.

---

## 8. Migration dispositions (recorded in DECISIONS.md)

| Field / concern | Disposition | Decision |
|-----------------|-------------|----------|
| `instruments.country`, `instruments.domicile_country` (free text) | **Dropped.** `listing_country` (ISO2) is authoritative. | D-007 |
| Legacy free-text country values → ISO2 | Map to ISO-3166 alpha-2 with a **manual review list for unmappables — no silent best-guess.** | D-007 |
| `instruments.asset_category` (free text) | **Dropped.** Migration first moves surviving `asset_category` values **into tags**, then drops the column. | D-009 |
| Tag variants | **Dedupe/merge pass** for case and whitespace variants before enforcing case-insensitive uniqueness. | D-011 |
| Currency lists | **DONE, differently than planned (§3 AMENDMENT 2026-07-14).** The 3 divergent lists did collapse to **one** — but the survivor is the backend constant **`SUPPORTED_CURRENCIES` (9)**, not a new 22-row table: **D-005 retired the two frontend lists** that were the only source of the extra 13 codes. One vocabulary, FX-validated by definition. **No migration is owed.** | D-006 / D-005 |
| Instrument symbol entry | Free-text symbol entry replaced by an **instrument picker** (typeahead + provider search); explicit "create new instrument" path replaces silent auto-creation; `_get_or_create_instrument` side effects removed from GET paths. | D-012 |
| Bulk imports | Same resolution logic with a **review queue for unresolved symbols** — imports never silently auto-create instruments. | D-012 |
| Account entity assignment | Migration assigns every existing account to a default entity (schema already present, 02 §3 rev. `entities`). | 02 §2.2 |

---

## 9. Blocked extractions

**None.** All DEF items are closed:

- **DEF-1, DEF-3, DEF-4, DEF-5** — resolved by verbatim extraction from the
  legacy v1 source (cites in the footer); filled into §2/§3.
- **DEF-2** (`asset_subclass`) and **DEF-6** (sector seed) — **authored, not
  extracted** (no enum / no list exists in code). Both are now proposed in place:
  DEF-2 as the 6-value per-value table in §2 (†), DEF-6 as the 11 GICS sectors +
  migration mapping in §6 (†). Every authored value is tagged **PROPOSED** and is
  ratified at review (same regime as the DESIGN-SYSTEM tokens).
- **DEF-7** (Review thresholds) — not master data; reconciled against
  `services/review.py` in PRODUCT-SPEC §5.

---

## 10. Transaction-type applicability matrix (D-090 — **RATIFIED 2026-07-10**)

**Status: RATIFIED** (owner, 2026-07-10) **with one amendment: ETF Bonus is ON**
(ETF unit splits and consolidations do occur; offering the type costs nothing, and
omitting it would force a fake sell+buy). Confirmed as proposed: crypto corporate
actions OFF; retirement/liability interest ON; mutual-fund split+bonus ON;
FD/bond/cash interest ON (the Manual-branch transaction path this implies is
approved — it matches the FD tile's "interest recorded separately" promise). The
matrix is served from the backend at `GET /refdata/txn-applicability`
(`app/api/v1/routes/refdata.py`) so the frontend carries no copy (D-005); the Add
flow reads it live and falls back to the full type list when it is unavailable.
Holdings page-build §9-17. This table states which `TxnType`s the
Add-flow **Type dropdown offers per `AssetClass`**. It is **form-level filtering
only — the engine is unchanged** (`compute_fifo` processes every type
regardless; this narrows what the UI *offers*). **The matrix governs what the
FORM OFFERS, not what the engine ACCEPTS** (owner, 2026-07-10): **CSV imports of
odd-but-real historical events are NOT rejected by UI opinion** — the importer
validates and commits them regardless of this matrix; only the manual Add
dropdown is filtered. Derived from (a) engine behaviour
and (b) financial reality, with the owner's guidance folded in (Indian mutual
funds have splits + bonus units; interest → FD/bond/cash; dividend →
equity/ETF/MF; merger/split/bonus → provider-quoted securities).

Legend: ✓ = offered · — = not offered. Columns: Buy · Sell · Div(idend) ·
Int(erest) · Dep(osit) · W(ithdrawal) · Fee · Spl(it) · Bon(us) · M(erger) ·
X(fer/transfer).

| AssetClass | Buy | Sell | Div | Int | Dep | W | Fee | Spl | Bon | M | X |
|------------|:---:|:----:|:---:|:---:|:---:|:-:|:---:|:---:|:---:|:-:|:-:|
| equity | ✓ | ✓ | ✓ | — | — | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| etf | ✓ | ✓ | ✓ | — | — | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| mutual_fund | ✓ | ✓ | ✓ | — | — | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| bond | ✓ | ✓ | — | ✓ | — | — | ✓ | — | — | — | ✓ |
| cash | — | — | — | ✓ | ✓ | ✓ | ✓ | — | — | — | ✓ |
| fixed_deposit | — | — | — | ✓ | ✓ | ✓ | ✓ | — | — | — | ✓ |
| commodity | ✓ | ✓ | — | — | — | — | ✓ | — | — | — | ✓ |
| crypto | ✓ | ✓ | — | — | — | — | ✓ | — | — | — | ✓ |
| property | ✓ | ✓ | — | — | — | — | ✓ | — | — | — | ✓ |
| private | ✓ | ✓ | — | — | — | — | ✓ | — | — | — | ✓ |
| retirement | — | — | — | ✓ | ✓ | ✓ | ✓ | — | — | — | ✓ |
| liability | — | — | — | ✓ | ✓ | ✓ | ✓ | — | — | — | ✓ |
| other | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

**Rationale + judgment calls (all ratified 2026-07-10):**
- **Dividend** → equity/ETF/mutual_fund only (owner). **Interest** → bond, cash,
  fixed_deposit (owner) + retirement, liability (debts/accounts accrue interest)
  — **confirmed ON** at ratification.
- **Split/Bonus/Merger** → provider-quoted securities. Bonus is **on** for
  mutual_fund (Indian MF bonus units, owner), equity, **and ETF** (ratification
  amendment — ETF unit splits/consolidations occur). **Crypto corporate actions
  are OFF** (confirmed — token redenominations are atypical; enable on request).
- **Buy/Sell** → acquirable/tradeable classes; **off** for pure balances
  (cash, FD, retirement, liability). **Fee/Transfer** → all (any holding can
  incur a standalone charge or move between accounts).
- **Implementation (shipped):** in the **Listed** Add branch the Type dropdown
  filters to the picked class's row. For **manually-valued** classes the Manual
  branch now offers a **"Record transaction"** sub-mode (interest / deposit /
  withdrawal / fee / transfer — buy/sell excluded, since a manual holding *is* the
  position) that records an instrument-less cash-flow transaction via the existing
  `POST /portfolio/transactions` (`quantity 1 × price = amount`) — **no engine
  change**. Holdings page-build §9-17.

## 11. Per-class creation-time fields (D-091 — **RATIFIED 2026-07-10**)

**Status: RATIFIED** (owner, 2026-07-10) — including the two whitelist gaps
(property `cost`, private `round`, both now in `_META_KEYS`) and the
incomplete-details Review signal. page-holdings §9-18. **REQUIRED** = only what
valuation/honesty need;
**OPTIONAL-PROMPTED** = offered at creation, never a hard wall. The optional set
starts from the existing D-049 backend whitelist `_META_KEYS`
(`app/api/v1/routes/portfolio.py:466`); **verified present** unless flagged
**(gap)**.

| AssetClass | REQUIRED | OPTIONAL-PROMPTED (from `_META_KEYS` unless noted) |
|------------|----------|----------------------------------------------------|
| equity / etf / mutual_fund / crypto *(Listed)* | instrument, txn fields (qty/price or amount) | instrument-level taxonomy lives on the instrument, not here |
| bond *(Manual)* | label, value, currency | issuer, **coupon**, **maturity_date**, face_value, clean/dirty_price, accrued_interest |
| fixed_deposit | label, value, currency | **rate**, **maturity_date**, start_date, payout_frequency, principal, accrued_interest, maturity_value, issuer, renewal_reminder |
| property | label (name), value, currency | address, valuation_date, valuation_source, next_review_date, **cost (gap closed — now in `_META_KEYS`)** |
| retirement | label, value, currency | scheme_name, statement_date, contribution_balance, valuation_source |
| private | label (name), value, currency | company, ownership, valuation_date, valuation_source, next_review_date, **round (gap closed — now in `_META_KEYS`)** |
| cash | label, value, currency | issuer |
| commodity / liability / other | label, value, currency | valuation_date, valuation_source, note (base keys, always allowed) |

**Ongoing cost (expense ratio) is CLASS-SCOPED (D-099, 2026-07-10).** The
instrument-level `annual_cost_bps` applies **only to fund-wrapped classes —
`mutual_fund` and `etf`**. Equity, crypto, and manual classes carry **no** expense
ratio: the field/card is not shown, and `PUT /instruments/{symbol}/ongoing-cost`
rejects a non-null bps on a non-fund class (clearing is always allowed). Existing
non-fund rows with a bps are **surfaced for review** (Review signal), never silently
deleted. This is an instrument attribute, not a manual-holding creation field, but is
recorded here beside the other per-class field rules.

**Findings (owner's verification list):**
- **Already present** in the backend whitelist: FD rate/maturity, bond
  coupon/maturity, property address/valuation-date, retirement scheme,
  private company/ownership, cash issuer. Property/private **name** = the
  holding `label`.
- **Gaps closed (shipped):** property **`cost`** (acquisition cost) and
  private-asset **`round`** (funding round) added to `_META_KEYS`
  (`app/api/v1/routes/portfolio.py`). Backend whitelist change only, no schema
  change (`meta` is JSON).
- **Frontend (shipped):** the Manual Add form now prompts the per-class
  OPTIONAL-PROMPTED fields (`MANUAL_META_FIELDS` in `Holdings.tsx`, rendered with
  ratified inputs by kind), submitted as `meta`; the backend persists only the
  whitelisted keys.
- **Review signal (ratified, shipped):** a manual holding in {fixed_deposit, bond,
  property, retirement, private} recorded with **no** optional detail surfaces as a
  **low-priority** Review item — *"N holdings have incomplete details"* (severity
  `info`) — **never a hard wall**. Constant `_INCOMPLETE_DETAILS_MIN = 1`
  (`app/services/review.py`), per-signal try/except like the rest (D-059); recorded
  in PRODUCT-SPEC §5.

---

**Derived from:** `docs/audit/02-DATA-MODEL.md`, `docs/audit/06-UI-AND-TERMINOLOGY-AUDIT.md`
§(a), `docs/audit/DECISIONS.md`, and the **legacy v1 source**
(`~/Documents/github/LedgerFrame`, read-only) for the DEF backfill:

- DEF-1 currency union — **CLOSED by the §3 AMENDMENT (2026-07-14): there is no union and no
  table.** The canonical master is `app/core/config.py:18` (`SUPPORTED_CURRENCIES`, **9**, all
  base-eligible), verified as the list `/settings` serves and `base_currency` + the A9 policy-bucket
  validator both check against. The two frontend sources this union was drawn from —
  `frontend/src/lib/refdata.ts:8` and `frontend/src/components/PortfolioEditor.tsx:22` — were
  **retired by D-005** and no longer exist. FX-translatability behaviour is unchanged:
  `app/services/ecb_fx.py:24,71-73`, `app/services/fx.py:51`.
- DEF-3 `ACCOUNT_KINDS` — `app/services/accounts.py:24`.
- DEF-4 `POLICY_TYPES` / `FREQUENCIES` — `app/services/insurance.py:23-25`.
- DEF-5 `DOC_CATEGORIES` / `CONTACT_ROLES` (+ `WILL_STATUSES`, `DOC_STATUSES`
  confirmation) — `app/services/estate.py:19-22`.
- DEF-2 `asset_subclass` reads/assignments — `app/providers/market/router.py:123,128-145`,
  `app/services/market.py:112,417,433`, `app/api/v1/routes/{amfi.py:75,coingecko.py:89,kite.py:94,97}`,
  migration `a3d21f7e5b10_phase2_identity_taxonomy.py:70`.
- DEF-6 sector reference (`_SECTOR_MAP`) — `app/services/portfolio.py:30-51`.

**DEF-2 and DEF-6 are authored, not extracted (†):** no `asset_subclass` enum
and no sector/GICS list exist in code, so their values are **proposed** here
(§2/§6), each tagged **PROPOSED**, and ratified at review — the code cites above
are the *observed* values/consumers the authoring builds on, not a definition to
copy. Everything else in this file is extracted verbatim.

Decision IDs applied: D-005, D-006, D-007, D-008, D-009, D-010, D-011, D-012,
D-013, D-018, D-049, D-055, D-064, D-073, and the DEFERRED table, plus **Batch 12:
D-082 (non-equity sector bucket, §6), D-083 (six-bucket region mapping, §4),
D-085 (class=exposure / subclass=wrapper, §2), D-087 (`other` escape valve, §2)**. Where the audit
flagged free-text fields that "should" reference masters (02 §4), DECISIONS.md's
verdicts govern the choice of fixed-vocabulary vs extensible-master.

## Needs decision

No product decisions and no extractions outstanding. DEF-2 (`asset_subclass`, §2)
and DEF-6 (sector seed, §6) are **authored proposals** awaiting **ratification at
review** — the same regime as the DESIGN-SYSTEM tokens. Ratify or amend the
PROPOSED-tagged values there.
