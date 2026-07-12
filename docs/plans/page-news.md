# page-news.md — News page build plan

**Status: §9 RESOLVED (owner, 2026-07-13) — BUILDING.** Phase 0 = the ND-2 no-egress guard
(backend-first, contract unchanged); Phase 0a composition-confirm (extract the InstrumentDetail
news-list; no §5 amendment expected). Drafted 2026-07-13 from
`TEMPLATE-page-build.md` (incl. the tooling-guard fail-first + the ⚠ verify-first divergence-flag +
vertical-single-scroll additions, and the Markets-group hybrid-shape precedent). Verify-first pass done
(§10 — read what the news/briefing/feeds readers actually serve before assuming shapes, D-019).
**Nothing is built.** Every ambiguity is in §9; the owner resolves them. **I resolved none.**

News is the third **Markets-group** page (Markets · Heatmap · News) and the canonical home for the
**market briefing** and **grouped headlines** (IA §2/§5, D-037/D-068). It **receives Markets' region
links** — Markets dropped its region-news blocks and links here (D-051; that contract is defined from
the Markets side). It **inherits the Markets-group overview + worklist hybrid shape** (page-markets
ND-3 precedent — confirm §9 ND-4). **Per-instrument news stays a P-3 scoped view on InstrumentDetail**
(already shipped); News is the global/grouped home (D-037).

> **⚠ HEADLINE ISSUE (ND-1, ND-2) — read first.** Two things dominate this plan:
> **(1) The briefing is AI-capable.** `/briefing` serves a **deterministic factual template** and, *if
> an AI provider is reachable*, an LLM **narrates the same facts** (grounded-safety validated, may add
> no numbers), falling back to the template otherwise (D-068, P-6). **The AI-narration path is DEFERRED
> to the AI-surfaces milestone** (D-067/D-068; R-22 provider config), exactly as the Instrument-Detail
> explainer was deferred. **What News ships WITHOUT AI = the deterministic briefing** (the endpoint
> self-degrades to it today, since the default AI provider is `disabled`) + grouped headlines. Owner
> confirms scope (ND-1).
> **(2) News fetching is EGRESS and is NOT currently guarded under no-egress.** Verified: no
> `privacy_mode` check in the feeds/briefing readers — they will attempt RSS/provider fetches even under
> no-egress. The honest degradation must be built (ND-2).

---

## 1. IDENTITY

*Source: INFORMATION-ARCHITECTURE.md §2 (page map), §3 (nav + rotation); DESIGN-SYSTEM.md §3.*

| Field | Value | Spec ref |
|-------|-------|----------|
| Page name (H1 = nav label = route) | **News** | IA §2, D-022 |
| Route | `/news` | IA §2 |
| Nav group | **Markets** (Markets · Heatmap · News) | IA §3 |
| Page template | **Overview + worklist hybrid** — a **briefing** header (overview-ish) over a **grouped-headlines** body. **Markets-group shape (ND-3 precedent); confirm ND-4.** | DESIGN-SYSTEM §3 |
| Rotation eligibility | **Confirm ND-10** (live Markets-group page → YES, D-044, like Markets) | IA §3 (D-044) |
| One-line purpose | **News** — the market **briefing** (deterministic; richer AI narration deferred) and **grouped headlines** by area (My holdings · India · Singapore · US · Global · Macro / FX), My-holdings ranked by relevance. Per-instrument news is a P-3 scoped view on InstrumentDetail. | IA §2/§5 |

---

## 2. OWNERSHIP TABLE

*Copied verbatim from INFORMATION-ARCHITECTURE.md §5 (News). Never re-derived.*

**Owns (canonical, authoritative, fully explained here):**
- **The briefing** — a deterministic factual template + **optional validated narration** (the model may
  add no numbers); **worker-refreshed + manual refresh**; canonical here (D-037/D-068). **The AI
  narration is DEFERRED (ND-1)** — News ships the deterministic briefing.
- **Grouped headlines by area** — My holdings · India · Singapore · US · Global · Macro / FX;
  **deduplicated** (by normalized headline), recency-sorted, **My-holdings ranked by relevance**
  (position weight × recency); **headlines sanitised** (untrusted external input, ND-12).

**Summarises (other pages' info — via the named reader, never recomputed):**

| Summary shown | Canonical page | Shared reader reused | Link target |
|---------------|----------------|----------------------|-------------|
| Briefing's portfolio figures (value, today's change, movers, concentration) | Portfolio / Net worth | **`value_portfolio` / `top_movers`** (the canonical readers — the briefing service consumes them, never recomputes) | Portfolio / Net worth |

**Note (P-1 direction):** **Home** shows a **briefing summary + top headlines** (D-046) — that is a
**summary of THIS page**, linked here; News is canonical (D-037). News must not add a figure Portfolio
doesn't own (the briefing quotes `value_portfolio`, so it can't).

**Links to:**
- **InstrumentDetail** per symbol — a headline's `symbols[]` link to `/instrument/{symbol}` (scoped
  news is a P-3 view there, D-037).
- **External article URLs** — each headline links to its source `url` (external site; honesty note
  ND-5: opens off-app; under no-egress the honesty state applies).
- **Markets** (sibling). **News is the TARGET of Markets' region-news links** (D-051 — Markets links
  here; page-markets signpost "Market news ↗" → `/news`).

**Enforcement corollary (P-1/D-031):** the briefing's numbers come from `value_portfolio` (the canonical
reader), never a recompute; **no headline, price, or figure is ever fabricated** (Guarantee 3);
headlines are **sanitised** before display (untrusted input).

---

## 3. API SURFACE

*Source: API-CONTRACT.json (frozen) + API-CONTRACT.md. Verify-first shapes pinned in §10.*

### 3a. Endpoints consumed (already in the frozen contract)

| Method + path | Purpose on this page | Response shape (verified §10) |
|---------------|----------------------|-------------------------------|
| `GET /briefing` | the briefing card | `{text, generated_at}` — deterministic template today; AI narration deferred (ND-1) |
| `POST /briefing/refresh` (**`require_auth`**) | manual "Refresh briefing" (`[S]`, ND-8) | `{text}` — regenerates + stores; egress + AI-gated (ND-1/ND-2) |
| `GET /news/grouped` | the grouped-headlines body | `{groups:[{name, items:[{headline,source,url,published_at,symbols,relevance?}]}], total}` — buckets served, deduped, ranked (ND-3) |
| `GET /news` | flat headline list (rss + provider) | `{items:[NewsItem], rss_count}` — **overlaps `/news/grouped`; likely NOT wired here (ND-7)** |
| `GET /news/feeds` | RSS feed list (if feeds mgmt is here, ND-6) | `{feeds:[url], defaults:[url]}` |
| `PUT /news/feeds` (**`require_auth`**) | edit RSS feed URLs (`[S]`, ND-6) | `{ok, feeds}` |
| `GET /news/feeds/test` | test the configured feeds (ND-6) | `{results:[…]}` |
| `GET /instruments/{symbol}/news` | (via links) per-symbol news on InstrumentDetail — **not fetched here** | `{symbol, items:[NewsItem]}` |

**NewsItem** (`schemas/common.py`): `{headline, summary?, url?, source, published_at, symbols[]}` —
`source` + `url` are the provenance; **no confidence/staleness** (headlines, not quotes) — freshness is
`published_at` (relative age).

### 3b. Contract deltas (needed but not in the baseline — BUILD BACKEND-FIRST)

**One candidate, pending §9:**

| kind | Endpoint (current → intended) | Decision | Why this page needs it |
|------|-------------------------------|----------|------------------------|
| reshape (guard) | `/news/grouped`, `/news`, `/briefing*` → **honor `privacy_mode`** (no outbound fetch under no-egress; serve cached/empty + an honest flag) | **ND-2 ⚠** (D-002/D-069, Guarantee 5) | news fetching is egress; the readers **don't** guard no-egress today (§10). Mirror the C-3 `system/version-check` no-egress guard |

**⚠ Verify-first divergence flags (§9, not §3b guesses):** **(ND-2)** the no-egress premise is
**unmet in the readers** — a real behavior gap, not assumed. **(ND-7)** `/news` (flat) overlaps
`/news/grouped` — confirm one is wired, don't ship an unwired endpoint (the `/markets/search` lesson).
Any approved delta regenerates `API-CONTRACT.json` + `docs/openapi.json` same commit
(`make api-contract-check`).

---

## 4. COMPONENTS

*Source: DESIGN-SYSTEM.md §5 (ratified) + §3 (templates). Ratified only; a missing affordance is a §9
amendment request. Data-wired to real endpoints.*

| Ratified component | Role on this page | Data source (real endpoint) | Not exercised at kitchen-sink |
|--------------------|-------------------|-----------------------------|-------------------------------|
| **PageHeader** | H1 "News" + subtitle + actions (refresh; maybe feeds mgmt, ND-6) | — | multiple actions |
| **`.lf-card` / `.lf-card__body`** (D-100) | briefing card; per-area headline blocks (the "News-block pattern", D-100/D-101) | `/briefing`, `/news/grouped` | prose briefing card; grouped list blocks |
| **EmptyState** | no news / no briefing / **no-egress honest state** / reader error | reader shapes | the no-egress reason state |
| **Skeleton** | per-card progressive loading (briefing + each group) | — | grouped-block skeletons |
| **StalenessChip / a relative-time element** | headline age (`published_at`) — **confirm ND-5** (news has no staleness; is a relative-time chip ratified, or a §5 note?) | `published_at` | relative time on a list row |
| **GlossaryTerm** | `[Help]` on "Briefing" (the honesty framing) — **confirm ND-9** | GLOSSARY | briefing definition |
| **RowMenu** | (if headline rows need actions — open / open source) — likely not needed | — | — |
| **Dialog + TextInput** (if feeds mgmt here, ND-6) | edit RSS feed URLs (`[S]`) + Test | `/news/feeds`, `/news/feeds/test` | multi-URL feeds editor |
| **ConfirmDialog (+[S])** | (if feeds mgmt) confirm feed changes | — | — |

**Affordances the ratified inventory may lack (amendment — resolve in §9 before build):**
- **Grouped-headline list (ND-5).** No ratified "news / headline list" component. Options: **(a)** compose
  plain lists (the Markets movers-list pattern) — headline (→ external `url`), `source · relative-time`,
  `symbols` (→ InstrumentDetail); OR **(b)** a `DataTable` per group. Confirm composition (a) suffices
  (no §5 amendment) or propose a `NewsList` component. **These are LISTS, not tables.**
- **Relative-time / "age" display (ND-5).** `published_at` → "2h ago"; confirm a ratified element covers
  it or it is a tiny §5 note (like the market-status pill was).

**Component usage rules the build must honour (template §4):**
- **Briefing figures via `value_portfolio`** (canonical reader) — no frontend money math; the briefing
  text is a **served display string** rendered verbatim.
- **Headlines are sanitised** (untrusted input, ND-12) — render as **plain text** (never as HTML).
- **External links** open the source `url` (off-app); a headline's `symbols` link to InstrumentDetail
  (D-098-style in-app links).
- **No-egress → honest degradation** (ND-2): cached headlines if any, else an EmptyState **reason**;
  refresh unavailable (like Pricing Health's honest no-egress state).
- **Mutations are `require_auth`** (`[S]`): briefing refresh, feeds PUT.
- **Cards LAYERED (D-100); scroll = content only, header outside (D-101); single vertical scroll region**
  (page-markets §12mk1-1) — the shell owns the one scroll.
- **Progressive per-card loading** (briefing + each group resolve independently).

**Tables — dataset-size posture (D-094):** grouped headlines are **bounded** (each group capped at ~6
items server-side; `total` provided) → any list is bounded, no server-side paging needed. If rendered as
lists (ND-5a), D-094 is N/A; if `DataTable` (ND-5b), client-side is fine (bounded).

---

## 5. VOCABULARIES

*Source: MASTER-DATA.md + served data.*

| Field on this page | Vocabulary / source | Fixed / served | Ref |
|--------------------|---------------------|----------------|-----|
| **News area / group** | served `name` on `/news/grouped.groups` (My holdings · India · Singapore · US · Global · Macro / FX) | **served** — a **hardcoded backend regex-bucketing**, not a master, not user-editable | §10; news.py |
| Headline **source** | served `source` per NewsItem | **served** display string | §10 |
| Headline **symbols** | served `symbols[]` (link to InstrumentDetail) | served | §10 |
| RSS **feed URLs** (if mgmt here, ND-6) | user data (`/news/feeds`) — a user-record list, **not a master** | user data | §10 |

**⚠ THREE non-aligned region groupings (ND-3).** The News buckets (My holdings/India/Singapore/US/
Global/Macro-FX) are **NOT** the Markets Global regions (Americas/Europe/Asia-Pacific/Commodities/Crypto)
and **NOT** the D-083 six buckets (India/Singapore/US/Europe/APAC/Other). D-051 says Markets links its
"region groups" here — confirm the mismatch is acceptable (News has its own news-relevant buckets;
Markets links to `/news` plain, no per-region anchor) or whether they must align (ND-3). **Render the
served `/news/grouped` labels verbatim; no client mapping.**

---

## 6. DECISIONS IN FORCE

| Decision | What it forbids / requires on this page |
|----------|------------------------------------------|
| **D-037** | News **canonical** for briefing + grouped headlines; **Markets** canonical for quotes/indices — News **never duplicates** quotes; Home shows a briefing **summary**, linked here. |
| **D-068** | Briefing = **deterministic template + optional validated narration** (model adds no numbers), stored + worker-refreshed, **canonical on News**. Instrument explainer rides P-6. **AI narration deferred (ND-1).** |
| **D-067 / P-6** | Ask panel + all AI surfaces ride the **one AI pipeline** (fact-pack, validated-before-display, ephemeral D-016); **deferred to the AI-surfaces milestone** (page-chrome C-2). News ships **without** AI wiring. |
| **D-051** | Markets **drops region-news → links to News region groups**; News **owns** those groups (link target). |
| **D-046** | Home = briefing **summary** + top headlines (a linked summary of News). |
| **D-005 / D-050** | Served vocab/labels (zero-copy); any export server-side. |
| **D-069 / D-002** | Mutations (`briefing/refresh`, `news/feeds` PUT) `require_auth` (`[S]`); under **no-egress**, news/briefing **degrade to honest cached/empty**, never fabricated (Guarantee 5) — **ND-2**. |
| **D-016** | AI outputs are **ephemeral** (no AIConversation/AIMessage persistence) — relevant only when the deferred AI narration lands. |
| **Guarantee 3** | Never fabricate a **headline**, price, or figure; every empty region states a reason. |

---

## 7. ACCEPTANCE CRITERIA

- [ ] **Briefing (D-037/D-068):** the deterministic briefing text renders with its `generated_at`;
      figures trace to `value_portfolio` (no frontend math). **AI narration is DEFERRED** — a visible
      note that richer narration arrives with the AI-surfaces milestone (ND-1); no AI wiring on the page.
- [ ] **Grouped headlines (D-037):** each served area renders its headlines with **source + relative
      time + external link**; `symbols` link to InstrumentDetail; **My holdings** ranked by relevance;
      **deduped**; **sanitised** (plain text, no HTML injection).
- [ ] **No-egress honesty (ND-2, Guarantee 5):** under no-egress, news does **not** fetch; the page shows
      an **honest reason** (cached headlines if any, else "news needs internet — no-egress is on");
      refresh disabled with an honest state.
- [ ] **Empty / error states:** no news / no briefing / reader unreachable each show a **reason**.
- [ ] **Manual refresh (ND-8):** "Refresh briefing" is `[S]`-gated; honest in-progress; unavailable under
      no-egress.
- [ ] **Feeds management (ND-6, if in scope):** edit/test RSS feed URLs, `[S]`-gated; else confirmed on
      Settings and News just consumes.
- [ ] **Markets → News link (D-051):** the region-news link from Markets lands here honestly.
- [ ] **Terms match GLOSSARY** (ND-9); copy hygiene — no decision IDs / enum keys in user strings.
- [ ] **Both themes + both densities;** interactive OPEN states (refresh, feeds dialog) in both themes.
- [ ] **Rendered layout + overflow:** 320/375/900/1366 both themes, **zero horizontal overflow** +
      **single vertical scroll region** (extend the overflow suite to `/news`). Geometry fixes
      **fail-first** (§7/§8).

---

## 8. BUILD PHASES

*One commit per phase. Backend deltas FIRST. **Do not start until §9 clears.***

- **Phase 0 — Contract delta (only if ND-2 = a backend no-egress guard):** guard the news/briefing/feeds
  readers under `privacy_mode` (mirror the C-3 version-check guard); regenerate the contract same commit;
  drift green. *(Skip only if ND-2 is resolved frontend-only — unlikely, since the readers attempt
  egress.)*
- **Phase 0a — DESIGN-SYSTEM §5 amendment (only if ND-5 needs a `NewsList` / relative-time affordance):**
  author PROPOSED, ratify at `/kitchen-sink` before assembly. *(Skip if composition of ratified parts
  suffices.)*
- **Phase 1 — Page assembly:** compose ratified components over the readers; progressive per-card
  loading; briefing card (deterministic; AI-deferred note) + grouped-headline blocks + honest
  no-egress/empty/error states + manual refresh + (feeds mgmt if ND-6).
- **Phase 2 — Tests:** component/render + acceptance (§7); **extend the overflow + single-scroll suite to
  `/news`**; a **sanitisation test** (a headline with markup renders as text); a **no-egress honest-state
  test**; drift/typecheck/lint/build green.
- **Phase 3a — Scripted pre-pass (GREEN before the walk):** drive the live page + real backend on seeded
  demo; assert populated briefing + grouped headlines, per-symbol links, honest no-egress state, 0
  overflow, single scroll region, 0 console errors; **tooling guards demonstrated firing** (§7/§8a).
- **Phase 3b — Owner acceptance walk (LIVE, judgment items only):** each finding → a numbered
  `page-news.md §*` entry, fixed + re-verified live, geometry fixes **fail-first**. **Owner closes the
  page.**

---

## 9. NEEDS DECISION — RESOLVED (owner, 2026-07-13)

All 12 items resolved. Each matched a topic laid out at draft; a few are owner refinements of the
drafted leaning (ND-1 carries **no** AI copy; ND-8 declines the drafted refresh affordance). The
considered-options record is retained beneath.

**Resolutions (owner, 2026-07-13):**
- **ND-1 (a) — SHIP the deterministic briefing now; NO AI copy.** The briefing is a real served surface
  that self-degrades honestly today; render `/briefing.text` + `generated_at`. **LLM narration stays
  DEFERRED to the AI-surfaces milestone** (D-067/D-068, R-22) — same posture as the Instrument
  explainer; **the card carries no AI copy** (no "coming soon" note) until then.
- **ND-2 (a) — backend `privacy_mode` guard (⚠ GUARANTEE-5 ENFORCEMENT, Phase 0, HIGHEST PRIORITY).**
  Guard the **feeds/briefing readers** mirroring the **C-3 `system/version-check`** pattern: under
  no-egress, **ZERO outbound calls** — serve **cached headlines flagged stale** OR an **honest
  empty-with-reason**. **Backend test = the C-3 pattern** (zero client/provider constructions under
  no-egress; non-zero when off). **Contract unchanged — a behavioral guard** (not a reshape). **Ships
  regardless of the rest of the page.**
- **ND-3 — News renders its OWN served buckets verbatim (D-005); no client re-mapping, ever.** No
  mapping between the three groupings. **Markets' region-group links land on `/news` PAGE-LEVEL** (the
  groupings don't align; inventing a mapping would fabricate data). **Recorded as a divergence note
  against D-051's phrasing:** *linking* satisfies it; *alignment* is not invented.
- **ND-4 — Hybrid CONFIRMED.** Briefing card header + grouped-headlines body (the Markets-group shape).
- **ND-5 — Compose from existing primitives; EXTRACT the InstrumentDetail news-list to the shared
  layer** (the recurring-pattern rule) rather than author a new `NewsList`. Relative time from the
  served `published_at` (client formatting fine — **not money**); external links **labelled with the
  source, open in a new tab**. **CONDITIONAL:** if the extraction genuinely fails, **STOP and propose
  the §5 amendment** (don't invent one).
- **ND-6 — Feed management is SETTINGS territory** (config, not content — the provider-key precedent).
  **News DISPLAYS only**; feed CRUD is a **recorded item for the Settings plan** — **nothing built
  here now** (the `/news/feeds*` endpoints exist but are deferred to Settings).
- **ND-7 — Wire `/news/grouped`** (the page IS grouped headlines). **`/news` (flat) recorded as
  UNCONSUMED + a tech-debt line** (the `/system/staleness` precedent) — not wired gratuitously, not
  silently ignored.
- **ND-8 — NO page-level refresh affordance.** Freshness is **flags shown from served data**; refresh
  semantics belong to the **worker / Pricing Health**, not News. **Declines the drafted briefing-refresh
  button;** `POST /briefing/refresh` is **not wired here** (worker refreshes the briefing). Confirm
  nothing new.
- **ND-9 — `[Help]` on "Briefing" (esp. its deterministic nature) and "Headlines" — both GLOSSARY
  terms.** Author both in GLOSSARY (canonical) + the frontend slice this build.
- **ND-10 — Rotation-eligible: YES** (D-044).
- **ND-11 — No entity scope** (market news; readers take none).
- **ND-12 — Headlines render as PLAIN TEXT always** (no HTML-injection path), **length-clamped with
  ellipsis**, **source label shown**. **Add a sanitisation test** (a headline containing markup renders
  inert).

**Confirms:** served labels throughout (D-005); `[S]`-gated where any mutation remains (feeds live on
Settings, so News has none); no-egress → honest cached/empty (Guarantee 5); no fabricated headlines
(Guarantee 3); the briefing quotes `value_portfolio` (no recompute, P-1).

**Build sequence:** **Phase 0 = the ND-2 backend guard (backend-first, contract unchanged)** → **Phase
0a composition-confirm** (extract the InstrumentDetail news-list; no §5 amendment expected) → **Phase 1**
assembly (briefing card, no AI copy, no refresh; grouped headlines; GLOSSARY Briefing/Headlines) →
**Phase 2** (the **no-egress zero-call test** + the **sanitisation test**) → **Phase 3a** scripted
pre-pass **GREEN**. STOP after the pre-pass report.

---

**Considered options (draft record — the resolutions above are authoritative).**

- **ND-1 — Briefing scope & the deferred AI narration. ⚠ CROSS-MILESTONE.** `/briefing` = a
  **deterministic factual template** + **optional validated AI narration** (D-068, P-6). The AI path
  rides the **AI-surfaces milestone** (D-067/D-068; R-22 provider config; Ask panel deferred, page-chrome
  C-2) — **DEFERRED**, like the Instrument-Detail explainer (D-068 intact). Today the endpoint
  **self-degrades** to the deterministic template (default AI provider is `disabled`). Options: **(a)**
  News ships the **deterministic briefing NOW** (render `/briefing.text` + `generated_at` + `[S]` manual
  refresh) with a visible **"richer narration arrives with the AI milestone"** note; the AI path is
  deferred, **not wired** here (no provider config, no Ask panel, no streaming). **(b)** Defer the
  **entire briefing card** to the AI-surfaces milestone; News ships **only grouped headlines** now.
  *(D-068 keeps the briefing canonical on News → leans (a).)* Owner picks; **state what News ships
  without AI.**
- **ND-2 — No-egress honesty. ⚠ CONTRACT/BEHAVIOR GAP.** News fetching is **egress** (RSS via
  `fetch_feeds` + `provider.get_news`), and the readers **do NOT guard `privacy_mode`** (verified §10 — no
  such check in `feeds.py`/`briefing.py`; only `system.py`/`settings.py` guard it). Under no-egress the
  page must degrade honestly. Options: **(a)** a **Phase-0 backend delta** — guard the news/briefing/feeds
  readers under `privacy_mode` (mirror C-3 `system/version-check`): no outbound fetch, serve cached/empty
  + an honest flag; frontend renders the honest state. **(b)** frontend-only honest state *iff* the
  backend already returns empty under no-egress — **it does not** (it attempts egress), so (a) is the
  honest fix. Owner confirms the Phase-0 guard.
- **ND-3 — Region/grouping model. ⚠ THREE non-aligned groupings.** `/news/grouped` buckets = **My
  holdings · India · Singapore · US · Global · Macro / FX** (served, hardcoded regex-bucketing). These do
  **not** match Markets' Global regions (Americas/Europe/Asia-Pacific/Commodities/Crypto) **or** the D-083
  six buckets (India/Singapore/US/Europe/APAC/Other). D-051 says Markets links its "region groups" here.
  Confirm: **News renders the SERVED buckets verbatim (no client mapping)**; the Markets→News link is to
  `/news` **plain** (no per-region anchor, matching the R-17 no-deep-link precedent). Is the bucket
  mismatch acceptable (news-relevant buckets differ from market regions by design), or must they align?
- **ND-4 — Template fit (Markets-group hybrid).** News = **briefing header over grouped-headlines body**
  — an overview + worklist hybrid (the ND-3 Markets-group shape Heatmap/News inherit). Confirm the
  treatment; **grouped headlines are LISTS, not tables.**
- **ND-5 — Headline-list rendering (possible §5 amendment).** No ratified news/headline-list component.
  Options: **(a)** compose plain lists (the Markets movers-list pattern) — no amendment; **(b)** a
  `DataTable` per group; **(c)** a new `NewsList` component (§5 amendment). Also confirm the **relative-time**
  ("2h ago") display: a ratified element, or a tiny §5 note? And the **external-link** treatment (headline
  → source `url`, off-app).
- **ND-6 — Feeds management scope.** `GET/PUT /news/feeds` (+ `/news/feeds/test`) manage the RSS feed
  URLs. IA's News "Owns" **does not list feed config**. Options: **(a)** News gets a **feeds editor**
  (Dialog + TextInput list + Test, `[S]`); **(b)** feeds config lives on **Settings** (source/config
  territory, D-072-adjacent) and News just consumes. Owner picks the home.
- **ND-7 — `/news` vs `/news/grouped`. ⚠ verify-first.** `/news` (flat rss+provider, no dedup) overlaps
  `/news/grouped` (bucketed, deduped, ranked). This page uses **`/news/grouped`** (richer). Confirm `/news`
  is **intentionally not wired here** (record it, like `/markets/search` — orphaned/not this page), or give
  the reason it's also needed. **Don't ship an unwired endpoint silently.**
- **ND-8 — Refresh semantics.** `POST /briefing/refresh` (`[S]`) regenerates the briefing (egress +
  AI-gated). Headlines are **live on GET** (`/news/grouped`) — no separate headlines-refresh endpoint.
  Confirm: the refresh affordance is **briefing-refresh only** (headlines refresh via page reload); under
  no-egress refresh is **unavailable** (honest, like Pricing Health).
- **ND-9 — Terminology / GLOSSARY.** "Briefing", "Headlines"/"Grouped headlines", the group names ("My
  holdings", "Macro / FX") — **none are in GLOSSARY** (verified). Does **"Briefing"** need a GLOSSARY entry
  with its protected framing (deterministic, **no fabricated numbers**, "information only, not advice")?
  Confirm which terms get `[Help]`/a GLOSSARY entry (Guarantee 3 forbids a fabricated headline).
- **ND-10 — Rotation eligibility (D-044).** Confirm **YES** for a live Markets-group News page (like
  Markets ND-9).
- **ND-11 — Entity scope (D-065).** News is household (readers take **no `entity_id`**; verified §10) —
  confirm.
- **ND-12 — Untrusted-headline sanitisation (honesty).** `/news/grouped` runs `sanitize_untrusted` on
  headlines (external, untrusted). Confirm the frontend renders sanitised headlines as **plain text**
  (never HTML) end-to-end, and record the untrusted-input honesty note.

**Lower-risk confirms (owner ratifies with the above):** served labels throughout (D-005); `[S]`-gated
mutations (briefing refresh, feeds PUT); no-egress → honest cached/empty (Guarantee 5); no fabricated
headlines (Guarantee 3); the briefing quotes `value_portfolio` (no recompute, P-1).

---

## 10. VERIFY-FIRST FINDINGS (2026-07-13) — read before assuming shapes (D-019)

Ran the read-what-the-engine-serves pass before drafting §3/§4. **No shape was assumed; gaps went to §9,
not §3b.**

| Item | What the engine actually serves | Source |
|------|--------------------------------|--------|
| Briefing | `GET /briefing` → `{text, generated_at}`; **deterministic template + OPTIONAL validated AI narration** (grounded-safety `validate_grounded_answer`, strips `<think>`, model adds no numbers); **falls back to template** when the AI provider is unavailable; default provider is **`disabled`** → template today. `POST /briefing/refresh` (`require_auth`) regenerates + stores; worker-refreshed | `services/briefing.py`, `routes/news.py:173` |
| Grouped news | `GET /news/grouped` → `{groups:[{name, items:[{headline(sanitised),source,url,published_at,symbols[],relevance?}]}], total}`; buckets **My holdings/India/Singapore/US/Global/Macro-FX** (hardcoded regex); **deduped** by normalized headline; **My holdings ranked** by `value_portfolio` weight × recency; best-effort (12s timeout, never blocks) | `routes/news.py:65` |
| Flat news | `GET /news` → `{items:[NewsItem], rss_count}` (rss + provider, first watchlist symbols, **no dedup**) — **overlaps grouped (ND-7)** | `routes/news.py:27` |
| Feeds | `GET /news/feeds` → `{feeds:[url], defaults:[url]}`; `PUT` (`require_auth`) sets URLs; `GET /news/feeds/test` → `{results}` | `routes/news.py:153` |
| Per-symbol news | `GET /instruments/{symbol}/news` → `{symbol, items:[NewsItem]}` — **InstrumentDetail (P-3), not this page** | `routes/markets.py:422` |
| NewsItem shape | `{headline, summary?, url?, source, published_at, symbols[]}` — `source`+`url` = provenance; **no confidence/staleness** (freshness = `published_at`) | `schemas/common.py:107` |
| **No-egress** | ⚠ **NOT guarded** — no `privacy_mode` check in `feeds.py`/`briefing.py`; readers attempt RSS/provider fetch even under no-egress (only `system.py`/`settings.py` guard it). **Honest degradation must be built (ND-2)** | grep `privacy_mode` |
| Sanitisation | grouped headlines run `sanitize_untrusted` (untrusted external input) → render as plain text (ND-12) | `routes/news.py:74` |
| Demo | mock provider `get_news` returns templated demo headlines → the page is **populated** in demo | `providers/market/mock.py:173` |
| Entity scope | news readers take **no `entity_id`** (household) | route signatures |
| AI milestone | AI providers exist (`disabled` default / `hailo_ollama`); Ask panel + narration are the **AI-surfaces milestone** (D-067/D-068, R-22) — **deferred** (page-chrome C-2). News ships **without** AI wiring | `providers/ai/`, DECISIONS D-067/D-068 |

**Owner sign-off surface (all in §9):** ND-1 (briefing/AI scope — the headline call), ND-2 (no-egress
guard — the one likely §3b delta), ND-3 (region grouping mismatch), ND-5 (headline-list rendering / §5),
ND-6 (feeds mgmt home), plus ND-4/7/8/9/10/11/12. **No build until the owner resolves §9.**
