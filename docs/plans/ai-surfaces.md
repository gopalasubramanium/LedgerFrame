# AI-surfaces — page build plan (D-067 / D-068)

**STATUS: PLAN ONLY — WRITTEN TO §9, BUILD NOT STARTED.** Per `CURRENT.md` NEXT and the
R-35/R-38/R-42/R-43/Help/Legal plan-file-first precedent: no code before the owner's §9 one-pass.
Every claim below carries a `file:line` cite and was verified at HEAD (`b01eacc`). **A claim is not
a change** (page-heatmap §13-2) — nothing in this file describes shipped behaviour unless it cites
the line that ships it.

**Milestone shape.** This is **not** a content page. It is a **cross-cutting surface milestone**:
one existing backend pipeline (`app/ai/`, already built and tested) and **zero existing frontend**.
The template is adapted the way `page-chrome.md` adapts it — §1/§2 describe **pipeline + UI-state**
ownership rather than figure ownership, and the regression surface is **every page that gains an AI
affordance**.

---

## 0. SURVEY — VERIFY-FIRST FINDINGS

*Done before §9 was drafted, because §9's items are only worth what the survey underneath them is.
Each finding is evidence for a §9 row, and the row names it.*

### 0-A. The backend pipeline EXISTS, is tested, and is not what this milestone builds

`app/ai/` is a complete grounded+validated pipeline, shipped and under test. The request path,
verified end to end:

`POST /ai/chat` (`app/api/v1/routes/ai.py:82-83`) → `answer_stream` (`app/ai/grounding.py:57`) →
`gather_facts` (`app/ai/tools.py:404`) → emit `facts` event → `classify_intent`
(`app/ai/intent.py:58`) → `build_messages` (`app/ai/prompt_builder.py:34`) → `provider.chat` →
**buffer** → `strip_reasoning` (`app/ai/prompts.py:11`) → `validate_grounded_answer`
(`app/ai/safety.py:112`) → emit, or discard and fall back.

**Test coverage is real: 43 test functions across 7 files** directly targeting `app/ai`, plus
`test_egress_guard.py`, `test_help.py`, and the two corpus-accuracy guards. Highlights:
`tests/unit/test_ai_safety.py` (13), `tests/integration/test_ai_safe_streaming.py` (10),
`tests/integration/test_ai_engine.py` (7), `tests/integration/test_ai_facts_routing.py` (4),
`tests/integration/test_ai_grounding.py` (4).

**Three routes exist**, all under the router-wide dependency (§0-F): `/ai/facts`
(`ai.py:23`, fact pack + intent, **no model call** — `:26-27`), `/ai/grounding-status` (`ai.py:46`,
mode/remote/privacy label, *"No secrets — only the base URL's host is considered, never the key"*
`:49`), `/ai/chat` (`ai.py:82`, SSE, input bound `min_length=1, max_length=500` at `:19-20`).

**Consequence for scope:** this milestone is overwhelmingly a **frontend + honesty-guard**
milestone, not a pipeline milestone. §9(b) scopes it accordingly.

### 0-B. There is NO frontend AI surface — none, anywhere

- `frontend/src/api/` has **no `ai.ts`**. Nothing in `frontend/src` calls `/ai/chat`,
  `/ai/facts`, or `/ai/grounding-status` (grep: zero hits).
- The Ask-panel slot is **reserved and empty**: `TopBar.tsx:37-38`
  (`/** Reserved slot for the Ask panel (D-067) — DEFERRED (C-2). */ askSlot?: ReactNode;`),
  rendered at `:116`, and **no caller passes it**.
- The **only** AI-adjacent frontend today is the Briefing, which is a **served deterministic
  string**, explicitly not AI narration: `frontend/src/api/news.ts:3-4` —
  *"The briefing is a SERVED display string (deterministic; AI narration is …)"*, consumed at
  `News.tsx:7`.
- The Settings **AI tab renders exactly two paragraphs** (`Settings.tsx:603-626`): a served config
  line (`:613-621`) and a static deferral note (`:622`).

So the D-067 Ask panel, the D-068 instrument explainer, and D-068's "richer narration" are **all
unbuilt on the frontend**. The dead-affordance rule (page-settings §12 (d)) governs what ships.

**⚠ Do not read `08-TECH-DEBT.md` as current state here.** Its AI rows (`AskPanel`, `AiConfigCard`,
`streamChat`, `:71`; `AIConversation`/`AIMessage`, `:14`) describe the **v1** codebase — the same
document claims *"no page/component tests"* in `frontend/src`, which v2 falsifies by ~40 files.
Those rows are useful as a **record of the v1 surface D-067/D-068 rebuild**, and misleading as debt.

### 0-C. THE DISCLAIMER IS NOT ONE SOURCE — IT IS 13 LITERALS

Commitment 2 says *"Every AI answer ends with the fixed information-only disclaimer"*
(`PRODUCT-SPEC.md:80-81`). **There is no shared constant.** The string
`Information only, not financial advice.` is a repeated literal at **13 sites**:

| file:line | site |
|---|---|
| `app/schemas/ai.py:74` | `disclaimer: str = "…"` — Pydantic default on `AIAnswer` |
| `app/ai/prompts.py:63` | inside `SYSTEM_PROMPT`: *"End with **exactly**: …"* |
| `app/ai/prompts.py:69` | tail of `REFUSAL_NO_FACTS` |
| `app/ai/grounding.py:53` | appended by `_template_answer()` |
| `app/ai/grounding.py:74, 80, 111, 119, 128` | **five** separate `done`-event literals |
| `app/api/v1/routes/ai.py:36` | `/ai/facts` response |
| `app/services/briefing.py:100` | deterministic briefing tail |
| `app/services/briefing.py:157` | narration prompt: *"End with: …"* (**no "exactly"** — diverges from `prompts.py:63`) |
| `app/services/briefing.py:175` | `if "not financial advice" not in text.lower(): text += …` |

Two hard facts make this worse than cosmetic duplication:

1. **`AIAnswer` is not used by the streaming path.** `answer_stream` yields **raw dicts**
   (`grounding.py:64, 72-74, 110-111, 118-119, 125-128`), so `app/schemas/ai.py:74` — the site that
   most *looks* canonical — governs nothing the user ever sees.
2. **`briefing.py:175` is the only idempotent site, and it tests a different string** — the
   substring `"not financial advice"`, not the full sentence. A future edit to the sentence leaves
   this check silently matching the old one.

**Nothing asserts the 13 agree.** They agree today by coincidence, not by construction — the exact
shape of CLAUDE.md's *"a hard rule without a guard is a request"*, applied to a **Commitment**.
→ §9(c).

**Do NOT conflate with the scoped caveats.** `IA:425-440` rules **D-106, the two-kind split**:
*(a)* scoped caveats served per reader at the point of use (`reports_pack.py:52`
`_REPORTING_CAPTION = "Reporting only, not advice."`, `review.py:259/:347`, `insurance.py:260`,
`analytics.py:423`) are **PART OF THE FIGURE** — *"Legal does not own, absorb, shorten, or
centralise them"*, and removing one is an **honesty regression** enforced at diff level (AC-L6);
*(b)* the product-level position, which Legal owns. **This milestone may consolidate the 13 copies
of (b). It must not touch (a).**

### 0-D. COMMITMENT 6 HAS NO GUARD

`legal.py:90` serves *"**No stored AI conversations.** AI questions and answers are never
persisted."* The enforcement today is **absence**, twice over:

- The tables were **dropped**: `app/db/migrations/versions/f9e1a2b3c4d5_drop_retired_tables.py:6`
  — *"ai_conversations, ai_messages (D-016 — AI chat is ephemeral, never persisted)"*, dropped at
  `:32-33`, **re-created by the downgrade** at `:113-131`.
- Nothing writes them: `ai_chat` (`ai.py:82-92`) writes nothing; `answer_stream`
  (`grounding.py:57-128`) uses the session for **reads only**.

**But no test keeps it that way.** Grep across `tests/` for `ai_conversations|ai_messages|never
persisted` returns only unrelated hits. This sits directly against `help.py:650`, which tells the
user each Commitment *has a test behind it*. → §9(e).

*One adjacent write exists and is correctly not a conversation:* `refresh_briefing`
(`briefing.py:182-186`) persists the **derived briefing string** to settings (`:184`). That is
stored *output*, not a stored *conversation* — §9(e) must say so explicitly so the guard does not
red on it.

### 0-E. EGRESS IS THE STRONGEST THING HERE — with one typed-refusal gap

`app/core/egress.py` is a genuine single choke point: `egress_client` (`:73`) is
*"The ONLY way to get an HTTP client in this codebase"* (`:74`); it gates **before** constructing
(`:82-83`). Both AI providers go through it (`hailo_ollama.py:52`, `openai_compatible.py:99, 159,
197`); `DisabledAIProvider` never touches the network (`disabled.py:26-27`).

**It is structurally guarded**, which is rare and worth preserving:
`tests/integration/test_egress_guard.py:39`
`test_no_module_may_construct_an_http_client_outside_the_egress_gate` — a **source scan** for
`httpx.(AsyncClient|Client)(` outside the gate (`:50`). Plus behavioural
`test_ai_provider_makes_no_call` (`:120`) and `test_ai_chat_makes_no_call` (`:137`).

Briefing short-circuits before the provider under no-egress (`briefing.py:123-128`).

**The gap:** `openai_compatible.py:184-188` deliberately re-raises `EgressBlocked` **before** its
generic retry, with the reason written out — *"No-egress is a REFUSAL, not a transient failure. …
retrying it would be the very thing Guarantee 5 forbids."* **`hailo_ollama.py` has no such case**:
its `except Exception` (`:141`) swallows `EgressBlocked` into `log.warning` (`:142`) and re-raises
as `RuntimeError(str(exc))` (`:145`). Functionally still a refusal — no client was built — but the
**type is lost**, so the caller cannot distinguish *"you turned this off"* from *"it broke"*, which
is exactly the honesty distinction Commitment 3 turns on. → §9(f).

### 0-F. THE 451 GATE ALREADY COVERS AI — verified, not assumed

`app/main.py:211` mounts the whole v1 router behind it:
`app.include_router(api_router, dependencies=[Depends(require_read_auth)])`, and `ai.router` is in
that router (`app/api/v1/router.py:47`). The gate runs **before the PIN check** inside
`require_read_auth` (`deps.py:224-231`).

The exempt set (`deps.py:113-117`) is `/api/v1/auth/`, `/api/v1/legal`, `/api/v1/system/status`.
**No AI path matches any prefix** → every AI endpoint answers **451 until the terms are accepted**,
including for **API-token callers** (`deps.py:222-223`: *"a token is not a second party who can be
exempt from them"*). `/reports/pack` is likewise gated (`main.py:233`).

**So (g) is satisfied by construction rather than by new work** — but by *inheritance*, and nothing
tests it at the AI paths specifically. → §9(g), which is a guard row, not a build row.

### 0-G. D-070's VISIBLE FALLBACK SIGNAL IS UNIMPLEMENTED

D-070 (`DECISIONS.md:349-353`) and `SECURITY-BASELINE.md:165-168` both mandate a **visible signal**
on fallback, with a ruled string: *"AI answer didn't pass grounding checks — showing facts
directly."*

**That string exists nowhere** — grep across `app/`, `frontend/src/`, `tests/`: **zero hits.**

What actually happens on validation failure (`grounding.py:114-120`): the model text is correctly
discarded, the deterministic template is emitted — and **no signal accompanies it**. The reason
travels only as `"validation": reason` in the `done` **event metadata** (`:118`), which no frontend
reads because no frontend exists (§0-B).

The *model-error* path does emit a visible line (`:106-108`, *"The AI model didn't return an answer
(…). Showing the underlying data instead."*) — so the product has **one of the two** signals, in
different wording from the ruled one.

This is a **ruled, normative, user-visible behaviour that has never shipped**, and this milestone
builds the surface that would show it. → §9(d).

### 0-H. A RETIRED TERM IS IN THE AI's MOUTH

`app/ai/tools.py:33` emits `GroundingFact(label="Portfolio total value", …)`.

**"Total value" is D-021-retired.** It is in the deprecated-terms table the accuracy guard reads
(`tests/unit/test_help_content_accuracy.py:215`: `"Total value": r"\btotal value\b"`). The guard
does not fire because **its corpus is Help content and frontend copy — not AI fact labels.**

This matters more than an ordinary copy defect for three reasons: the fact pack is **shown to the
user before the answer** (D-067, `IA:472`); the labels are **fed to the model as grounded fact**;
and `page-help.md:745-750` already filed the *same term* on the *Portfolio* page as **ROADMAP R-52
with an owner ruling owed** — so this milestone must not resolve it unilaterally on a second
surface. → §9(h).

Confirmed by `tests/integration/test_ai_facts_routing.py:42`, which **asserts** the label:
`assert any("Portfolio total value" in label for label in labels)` — a test **pinning** the stale
term, the §9-5 *"three tests were PINNING the stale content"* pattern (`page-help.md:752-755`)
recurring.

### 0-I. THE GROUNDING CORPUS — one source, no cache, no regeneration step

The standing cross-note (`CURRENT.md:63-76`, `page-help.md:541` §9-9 ruling) requires the grounding
review to read **post-redesign, post-rename** content. Verified:

- **The corpus is a Python literal, not a generated artifact**: `app/services/help.py:14`
  `HELP: list[dict] = [` (~90 entries). Read by `search_help` (`:1321`), which iterates `for e in
  HELP:` (`:1328`) with **no `lru_cache`, no index, no build step**, scoring per call.
- **One source serves both consumers** — `help.py:4-6`: *"A single structured source of truth used
  by BOTH the Help page (`GET /help`) and the AI."*
- The AI reads it at `app/ai/tools.py:145` (`from app.services.help import search_help`), called
  `:148` with `limit=3`, prepended to the fact pack at `:466-474`.
- Markup is stripped **in the projection** (`help.py:1358`), with the reason stated at `:1352-1357`
  — *"`help_facts()`, which hands `body` to the model as a grounding fact."*

**This is the good news, and it should be stated plainly: there is no grounding cache, so there is
no cache to drift.** The §9(a) question is therefore *not* "how do we regenerate" — it is **"what
keeps the corpus itself true, and does anything bind the AI's view of it?"**

What already binds it: `test_help_content_accuracy.py:111, 127, 142, 384, 418` and
`test_glossary_parity.py:106, 157`, plus `test_help.py:147` `test_ai_facts_grounded_in_help`.

**And the corpus has already bitten the AI once, in a way the page never saw** —
`help.py:1311-1315`: adding *"What LedgerFrame is"* made `search_help("what is xirr")` return it
first, so *"the AI would have answered a question about XIRR with the platform blurb"*; fixed with
`_STOPWORDS` (`:1316`). `page-help.md:1084-1086` records the same event as
**"a ranking regression reached the AI before it reached the page."** That is the §9(a) risk in one
sentence: **the AI consumes the corpus through the *ranker*, so ranker changes are grounding
changes**, and the two rankers (server + client, `page-help.md:1071-1078`) *"could drift"* by the
Help milestone's own admission.

### 0-J. ⚠ A NUMBERING CORRECTION TO THE KICKOFF BRIEF

The kickoff named Commitments **"5.2 / 5.3 / 5.5 / 5.6 / 5.7"**. **That numbering does not exist.**
`PRODUCT-SPEC.md:58` §3 numbers the Commitments **1–7** in a single blockquote (`:76-92`); `## 5.`
in that file is `Review signal thresholds (D-059)` (`:156`), unrelated. Read as Commitments
**2, 3, 5, 6, 7**, which is how this plan cites them throughout — recorded rather than silently
fixed, per §11-H (*a claim of completeness is checked before it ships*).

### 0-K. TWO LIVE SPEC INCONSISTENCIES FOUND EN ROUTE (neither owned by this milestone)

1. **Settings tab count.** `DECISIONS.md:359` + `:762-776` say **SIX** tabs; `IA:84` + `:375-379`
   say **SEVEN** (amendment #3, About); `Settings.tsx:83-84` **ships seven**. D-069 was never
   amended for #3. *The product and IA agree; DECISIONS.md is the stale one.*
2. **GLOSSARY block subtitle.** `GLOSSARY.md:12` still reads
   `## Product Commitments (verbatim from DECISIONS.md)` — the exact relationship
   `PRODUCT-SPEC.md:67-74` records as **no longer holding** (§3 is now the rendering source;
   DECISIONS.md is the ratifying record only).
3. Minor: the shipped AI-tab deferral note (`Settings.tsx:622`, *"Model management lives with the
   AI surfaces …"*) is **worded differently** from the ruled copy (`page-settings.md:828`,
   *"Model management lands with the AI surfaces milestone."*). This milestone **deletes or
   replaces that note anyway** (§9(b)), so it is noted, not fixed separately.

**Filed, not fixed here** — items 1 and 2 are spec-hygiene on documents this milestone does not
own. They are listed in §9 as ⚑ owner-call so they are not silently absorbed.
*(This is the §14-A discipline: a milestone that touches another surface records it there.)*

---

## 1. IDENTITY

| Field | Value |
|---|---|
| **Milestone** | AI-surfaces (D-067 / D-068) |
| **Routes** | **No new route.** Surfaces mount into existing ones: global chrome (`askSlot`, `TopBar.tsx:38`), `/instrument/:symbol`, `/news`, `/settings` → AI tab |
| **Nature** | Cross-cutting surface + honesty-guard milestone; the backend pipeline is built (§0-A) |
| **Canonical homes touched** | News owns the Briefing (`IA:277-282`); Settings→AI owns the served AI-config line (`IA:375-379`); Privacy owns the "AI never persists" statement (`DECISIONS.md:359`) |
| **Principles binding** | **P-6** one AI pipeline, no direct model calls (`DECISIONS.md:53-54`) · **P-8** one path in, one out (`:58-60`) · **P-1** one canonical home |

---

## 2. OWNERSHIP — UI-state, not figures

*Adapted per the chrome/gate precedent: this milestone owns no financial figure. It owns the
**presentation of an answer** and the **state of an AI request**.*

| Owned | Where it lives | Canonical source |
|---|---|---|
| Ask-panel open/closed, question text, stream state | Client, **ephemeral** (D-067 *"ephemeral (D-016)"*, `DECISIONS.md:357`) | Nothing persisted — §0-D |
| The fact pack shown **before** the answer | Server (`/ai/facts`, `ai.py:23`) | `gather_facts` (`tools.py:404`) |
| Privacy-mode label "always visible" (D-067) | Server (`/ai/grounding-status`, `ai.py:46`) | `no_egress_enabled` (`egress.py:51`) |
| The disclaimer | **Server-served** — must become one source (§9(c)) | §9(c) resolves |
| Briefing narration on/off | Server (`briefing.py`) | News is canonical (`IA:281-282`) |

**The frontend computes nothing and stores nothing.** It renders served strings and served facts.

---

## 3. API SURFACE

### 3a. Endpoints consumed (already in the frozen contract)

| Endpoint | file:line | Note |
|---|---|---|
| `POST /api/v1/ai/chat` | `ai.py:82-83` | SSE; `ChatIn` bounded 1–500 chars (`:19-20`) |
| `GET /api/v1/ai/facts` | `ai.py:23-24` | Fact pack + intent, **no model call** |
| `GET /api/v1/ai/grounding-status` | `ai.py:46-47` | Mode/remote/privacy label; **no secrets** (`:49`) |
| `GET /api/v1/briefing` | `news.py:182-184` | Served briefing string |
| `POST /api/v1/briefing/refresh` | `news.py:187-191` | `require_auth` — a write |
| `GET /api/v1/system/ai-config` | consumed today by `Settings.tsx` via `systemConfig.ts` | Read-only served line |

### 3b. Contract deltas — **PROPOSED, pending §9**

**Likely none for chat/facts/status.** The three AI routes already return what a panel needs.
Two candidates, both dependent on §9 rulings and therefore **not asserted here**:

1. If §9(d) rules the fallback signal must be **served** (not composed client-side), the `done`
   event gains a served string field — a **schema** change to a streaming payload that
   `app/schemas/ai.py` does not currently govern (§0-C item 1).
2. If §9(b) admits the instrument explainer, it rides P-6 — **no new endpoint** (`/ai/chat` with an
   instrument-scoped question), or a scoped route. **P-6 forbids a second model path either way.**

*Backend-first, regenerated in the same commit (`make api-contract-check`) if either lands.*

---

## 4. COMPONENTS

**The ratified inventory has no AskPanel.** DS §5.5 (`DESIGN-SYSTEM.md:555-559`) describes the Ask
panel's *behaviour* — *"SSE streaming, fact-pack before answer, validated-before-display,
ephemeral, privacy-mode label always visible — D-067"* — but the **Chrome component inventory
below it lists no such component**, and `frontend/src/components/ui/` has none.

Per CLAUDE.md and the template: **a new component is forbidden without a DESIGN-SYSTEM amendment.**
→ §9(i).

Composable today, if the panel is scoped in: `Dialog`/`overlay.css`, `TextInput`, `Button`,
`Skeleton`, `EmptyState`, `StatusChip`, `ProvenanceBadge`, `StalenessChip`, `GlossaryTerm`,
`MetaStrip`. **The fact pack is a provenance surface** (source · timestamp · staleness,
`SECURITY-BASELINE.md:161-163`) — `ProvenanceBadge` + `StalenessChip` may cover it without a new
primitive. **To be settled at §9(i), not assumed.**

**And it is `check:primitives`-governed** (`scripts/check-ui-primitives.mjs`, the §11-J guard): a
hand-rolled question box would be the Legal milestone's own lesson 6 repeating in the milestone
after it.

---

## 5. VOCABULARIES

**GLOSSARY's AI vocabulary is thin — effectively two rows.** `GLOSSARY.md:177` **Briefing**
(carrying the forward reference *"Richer AI narration is a future addition (AI-surfaces milestone,
D-068) and is not shown until then"*) and `:178` **Headlines**. Plus `:324` Product Commitments
(a pointer, *"never a second copy"*) and `:325` Legal.

**No entry exists for:** *Ask panel*, *fact pack*, *grounding*, *validation contract*,
*instrument explainer*, *fallback*, *privacy mode*. Every one of those is a term this milestone may
**show a user**. → §9(h).

**Ruled precedent that limits the ask:** `page-settings.md:831-832` — *"**"AI" is a plain tab
label** — the §9-4 logic: **no GLOSSARY entry** for the label itself."* So plain labels do not
automatically owe entries; **shown domain terms do**.

Guard: `tests/unit/test_glossary_parity.py` (three-store parity + Tier-3 counter) — and the
`GLOSSARY.md`-first rule (page-heatmap §13-1) applies: **the spec first, the popover mock second.**

---

## 6. DECISIONS IN FORCE — quoted, not paraphrased

| ID | Text (verbatim) | Cite |
|---|---|---|
| **P-6** | *"All AI surfaces ride the single grounded+validated pipeline; no feature may ever add a direct model call."* | `DECISIONS.md:53-54` |
| **P-8** | *"One sanitised path in (sanitise-at-ingest, D-075) and one validated path out (P-6); no feature may bypass either."* | `:58-60` |
| **D-067** | *"Ask panel \| KEEP \| SSE streaming; fact-pack shown before answer (trust UX); validated-before-display; ephemeral (D-016); privacy-mode label always visible; P-6."* | `:357` |
| **D-068** | *"Briefing + instrument explainers \| KEEP \| Deterministic template + optional validated narration (**model may add no numbers**); stored + worker-refreshed; canonical on News. Instrument explainer rides P-6."* | `:358` |
| **D-070** | validator strictness kept; adds the visible fallback signal *"AI answer didn't pass grounding checks — showing facts directly."* | `:349-353` |
| **D-071** | *"Validation contract is normative spec … **Implementation may improve; the contract may not weaken.**"* | `:354-374` |
| **D-106** | the two-kind disclaimer split; scoped caveats are **part of the figure**, removing one is an **honesty regression** (AC-L6) | `IA:425-440` |

### The Commitments that bind — as BUILD CONSTRAINTS

*Verbatim from `PRODUCT-SPEC.md:76-92`, the **rendering source of record** (`:60-65`), kept
string-equal to `app/services/legal.py:78-93` by `test_legal_content.py` (AC-L3). Numbering
corrected per §0-J.*

| # | Verbatim | What it forbids this milestone |
|---|---|---|
| **2** | *"**No advice.** Never gives buy/sell/hold, tax, or financial advice. Every AI answer ends with the fixed information-only disclaimer."* | Shipping any answer path whose disclaimer is not **provably** the fixed one → §9(c) |
| **3** | *"**No fabrication.** Never fabricates a price, headline, or figure. Insufficient inputs produce "—"/None with a reason, never a made-up number."* | Narration that **adds** a number; D-068's own *"model may add no numbers"* → §9(d) |
| **5** | *"**No egress (opt-in).** With the no-egress toggle enabled the device makes **zero outbound network calls** — version check, feeds, and banner included."* | A remote AI call under no-egress; a **retry** of a blocked call → §9(f) |
| **6** | *"**No stored AI conversations.** AI questions and answers are never persisted."* | Any persistence of question or answer → §9(e) |
| **7** | *"**The validation contract never weakens.** Implementation may improve; the contract that every AI answer is checked against may not be loosened."* | Relaxing any of the 7 contract clauses → §9(d) |

**The 7-clause contract itself is normative in `SECURITY-BASELINE.md:140-168`** — buffered never
streamed raw · every significant number traces to a fact · unknown tickers rejected · recommendation
/ real-time / secret content rejected · quoted 25+ char strings verbatim · failure → deterministic
template · facts are the only source of numbers, shown **before** the answer.

---

## 7. ACCEPTANCE CRITERIA — PROPOSED, to be completed after the §9 one-pass

*Deliberately not enumerated in full: §9(b) decides what ships, and acceptance criteria for a
deferred surface are noise. The criteria that hold **regardless** of §9's outcome:*

- **AC-1** Every AI answer path ends with the fixed disclaimer, and the disclaimer's **identity
  across paths is asserted**, not observed (§9(c)).
- **AC-2** No AI surface renders a raw `<input>`/`<select>` — `npm run check:primitives` green.
- **AC-3** Under no-egress: **zero** outbound calls from every AI surface; the refusal is stated as
  a refusal, not as a failure (§9(f)).
- **AC-4** Nothing persists a question or an answer (§9(e)).
- **AC-5** Every AI endpoint answers **451** pre-acceptance (§9(g)).
- **AC-6** Every term shown exists in `GLOSSARY.md` with identical spelling (§9(h)).
- **AC-7** The HELP CURRENCY SUITE is green **and can see** the new surfaces (Currency Law).
- **AC-8** Fail-first evidence for every new guard — *seen RED* before it is trusted.

---

## 8. BUILD PHASES

Standard template phases. Two milestone-specific notes:

- **Phase 0 owns the intake defect.** `test_performance_question_pulls_risk_metrics`
  (`tests/integration/test_ai_facts_routing.py:34`) is **contention-fragile** — it fails only when
  the suite shares the machine with other pytest processes and passes solo
  (`r43-historical-backfill.md` §18-F7d; `CURRENT.md:78-82`). **The robustness fix belongs to this
  milestone** as the natural owner of the AI streaming surface, not to R-43.
- **Phase 3a must drive the browser under BOTH egress states and BOTH acceptance states.** The
  Legal milestone's lesson 8 (the matrix gap): an AI surface has **at least three axes** —
  no-egress on/off, provider available/unavailable, answer validated/fallen-back. A suite thorough
  along one axis and blind along the others is the shape that reads as coverage. The pre-pass
  derives its target from `frontend/e2e/smoke/smoke-target.mjs` (fail-closed; never the owner's
  live stack).

---

## 9. NEEDS DECISION — **CLOSED 2026-07-20** (owner one-pass, in chat)

**STATUS: EVERY ROW RULED. Build is authorized.** The table below is the **PROPOSED** state as it
went into the one-pass and is **left standing unedited** — it is what the owner was asked, and a
plan that rewrites its own questions to match the answers cannot be audited (the `IA:396-410`
convention). **The rulings are in §9-CLOSED, immediately after the table, and they govern.** Where
a ruling differs from the proposal, §9-CLOSED says so explicitly.

**⚑ = owner call. Nothing in the TABLE is decided — read §9-CLOSED for what was.**

| # | Item | Evidence | PROPOSED resolution |
|---|---|---|---|
| **(a)** | **GROUNDING — what keeps the corpus true** | Corpus is a Python literal, `help.py:14`; no cache, no build step (`:1321-1328`); one source for page + AI (`:4-6`); AI reads via `tools.py:145-148`. Already post-redesign **and** post-Legal (`CURRENT.md:63-76`) | **Reframe the question: there is no cache, so there is no drift to regenerate.** The real exposure is the **ranker** — `help.py:1311-1315` records a ranking change that *"reached the AI before it reached the page"*, and two rankers now exist and *"could drift"* (`page-help.md:1071-1078`). **PROPOSE:** a guard pinning **what the AI actually retrieves** for a fixed question set (not what the page ranks), so a ranker edit reds the AI path explicitly. Extends `test_help.py:147`. |
| **(b) ⚑** | **SURFACE SCOPE — what ships vs defers** | Backend built (§0-A); **frontend zero** (§0-B); `askSlot` reserved+empty (`TopBar.tsx:37-38`); D-067 Ask panel `:357`; D-068 explainer + narration `:358` | **⚑ OWNER RULES THE LINE.** Recommendation: **Ask panel IN** (it is the milestone's name and the backend is complete); **instrument explainer IN** (rides P-6, no new pipeline); **D-068 "richer narration" of the Briefing ⚑ owner call** — it is the one item that *changes an accepted page's* output (News), triggering the standing delta-note + pre-pass-re-run rule. **Whatever defers must leave NO affordance** (dead-affordance rule, page-settings §12 (d)) — including deleting `Settings.tsx:622`'s deferral note if AI management lands, or keeping it exact if not. |
| **(c) ⚑** | **THE DISCLAIMER — 13 literals, one Commitment** | §0-C: 13 sites; `AIAnswer` (`schemas/ai.py:74`) governs **nothing streamed**; `briefing.py:175` idempotence tests a **different substring**; `prompts.py:63` vs `briefing.py:157` say *"exactly"* vs not | **PROPOSE: one served constant + a guard.** Define `DISCLAIMER` once, reference it at all 13 sites, and add a guard asserting **no other literal of that sentence exists in `app/`** (the closure-is-tested pattern, §11-F lesson 11) **and** that every terminal `done` event carries it. **⚑ Owner call on the Pack:** `legal.py:261` records the Commitments *"deliberately DO NOT go into the Pack"*, and `reports_pack.py:52` already serves its own `"Reporting only, not advice."` **If AI text can ever reach print, the two-disclaimer interaction needs a ruling** — and D-106 forbids consolidating the scoped one. **Recommendation: AI text does NOT enter the Pack this milestone**, which makes the question moot by scope rather than by argument. |
| **(d) ⚑** | **VALIDATION CONTRACT — and D-070's missing signal** | Contract normative `SECURITY-BASELINE.md:140-168`; implemented `safety.py:112-155`; 13+10 tests. **But D-070's ruled string exists NOWHERE** (§0-G); failure path (`grounding.py:114-120`) shows the template with **no signal**; reason travels only as `done` metadata (`:118`) | **Two separable things, and the plan says so rather than blurring them.** **(i) "Never weakens" (Commitment 7) is currently mechanised by nothing** — the tests assert the contract *holds*, not that it has not been *loosened*. **PROPOSE:** pin the contract's **clause count and identity** to `SECURITY-BASELINE.md` (spec↔code parity, the AC-L3 pattern already proven for the Commitments), so deleting a clause reds. **(ii) ⚑ D-070's signal is a ruled, user-visible behaviour that never shipped.** This milestone builds the surface that would show it. **Owner call:** ship it with the ruled wording, or amend D-070. **Recommendation: ship it, served** — a client-composed signal would be a second source of a legal-adjacent string, the §0-C mistake repeated. |
| **(e)** | **NO STORED CONVERSATIONS — the enforcement point** | Tables dropped `f9e1a2b3c4d5:6, :32-33` (**downgrade re-creates**, `:113-131`); nothing writes; **no test** (§0-D); yet `help.py:650` tells users each Commitment has a test | **PROPOSE: the guard Commitment 6 never had.** (1) A schema assertion that `ai_conversations`/`ai_messages` are **absent** from the live metadata; (2) a behavioural test that a full `/ai/chat` round-trip leaves **row counts unchanged** across all tables. **It must be pinned against going blind** (CLAUDE.md): if the tables are absent the test must still *mean* something, hence (2). **Must explicitly permit** `briefing.py:184` — stored derived **output**, not a stored conversation. |
| **(f) ⚑** | **EGRESS — refusal vs failure** | Choke point `egress.py:73-83`, structurally guarded `test_egress_guard.py:39`; `openai_compatible.py:184-188` preserves `EgressBlocked` **with the reason written out**; `hailo_ollama.py:141-145` **loses the type** into `RuntimeError` | **PROPOSE:** mirror the OpenAI provider's typed re-raise in `hailo_ollama.py` so a refusal is a refusal on both providers, and extend the egress guard to assert **both** providers propagate `EgressBlocked` un-retried. **⚑ Owner call on POSTURE COPY** (as the kickoff anticipated): Commitment 5 promises *"zero outbound network calls"*, so under no-egress a **remote** AI is off and a **local** one still works — R-22 (`DECISIONS.md:891`) says *"under no-egress AI is local-only"*. **What the user is told** in that state is unwritten copy, and D-067 requires the *"privacy-mode label always visible"*. **This is the milestone's main copy ruling.** |
| **(g)** | **THE 451 GATE** | Verified §0-F: `main.py:211` + `router.py:47` + exempt set `deps.py:113-117` → AI is gated, tokens included (`deps.py:222-223`) | **No build work — a guard row.** The posture is correct **by inheritance**, and nothing tests it *at the AI paths*. **PROPOSE:** add AI paths to the acceptance-gate test matrix so a future exemption widening reds. *(Cheap, and exactly the "pinned against going blind" clause.)* |
| **(h) ⚑** | **HELP + GLOSSARY — the Currency Law debt, and a retired term** | GLOSSARY has **no** entry for Ask panel / fact pack / grounding / validation contract / explainer (§5); `help.py` has **no** Ask/chat entry, and **one clause** on the AI tab (`:544-546`); **`tools.py:33` serves the D-021-retired `"Portfolio total value"`** and `test_ai_facts_routing.py:42` **pins it** (§0-H) | **Two parts.** **(i) Currency Law:** every surface (b) admits owes its Help entry **in-milestone, in the same commit** — plus GLOSSARY entries for shown terms, **spec-first** (page-heatmap §13-1). Precedent for a deviation is `page-help.md:718-725` (§9-5 Tier 2, Legal): a deviation is **recorded as one and mechanised**, never left to intent. **(ii) ⚑ the retired term is an owner call, not mine:** the identical term on Portfolio is **ROADMAP R-52 with a ruling owed** (`page-help.md:745-750`). Fixing it here would resolve half of an open owner question on a second surface. **PROPOSE: surface it to the R-52 ruling** and, if fixed, fix **both** call sites (label-changes-are-app-wide, page-chrome §11-4) — and extend the deprecated-term guard's corpus to **AI fact labels**, which is the real gap either way. |
| **(i) ⚑** | **DESIGN SYSTEM — no AskPanel exists** | DS §5.5 (`DESIGN-SYSTEM.md:555-559`) describes the behaviour; the **inventory lists no component**; `components/ui/` has none | **⚑ A DESIGN-SYSTEM amendment is required before build** (CLAUDE.md: new components forbidden without one). **PROPOSE:** attempt composition from ratified primitives first — `Dialog`, `TextInput`, `Button`, `Skeleton`, `EmptyState`, `ProvenanceBadge`, `StalenessChip` — and bring an amendment **only for what composition cannot express**, ratified at `/kitchen-sink` as a Phase-0a step (the chrome precedent). `check:primitives` governs regardless. |
| **(j) ⚑** | **TWO SPEC INCONSISTENCIES FOUND EN ROUTE** | §0-K: `DECISIONS.md:359` says **six** Settings tabs, `IA:84`/`:375-379` and `Settings.tsx:83-84` say **seven**; `GLOSSARY.md:12` still reads *"(verbatim from DECISIONS.md)"* against `PRODUCT-SPEC.md:67-74` | **Neither is owned by this milestone; both are recorded rather than absorbed.** **⚑ Owner call:** fix here as spec hygiene, or file. **Recommendation: file both**, so this milestone does not quietly edit two documents it has no mandate over — the §14-A discipline. |

**⚑ OWNER-CALL ROWS: (b), (c)-Pack, (d)-ii, (f)-copy, (h)-ii, (i), (j).**

---

## 9-CLOSED. THE RULINGS — owner one-pass, 2026-07-20

*Attribution is marked per row: **(owner)** = the owner ruled it; **(architect)** = an architectural
call taken under the owner's authorization, within a scope the owner set. **No ruling was typed into
this file from the CLI's own judgement** — where this file records something neither the owner nor
the architect said, it is marked **⚠ VERIFY-FIRST CORRECTION** and states what it corrects and why.*

| # | RULING | Attribution | Delta vs PROPOSED |
|---|---|---|---|
| **(a)** | **ACCEPTED as proposed.** No grounding cache exists, so nothing is regenerated; the exposure is the **ranker**. Guard pins **what the AI actually retrieves** for a fixed question set, extending `test_help.py:147`. Corpus pinned to the **POST-RENAME** Help + Legal content. | owner | none |
| **(b)** | **Ask panel IN. Instrument explainer IN. D-068 "richer narration" DEFERRED to R-45** — recorded on the R-45 row, which now owns it (`ROADMAP.md:57`). Deferred work leaves **NO affordance**. | owner | Narration deferral is the owner's line; the plan had left it ⚑ open. |
| **(c)** | **One served `DISCLAIMER` constant + closure guard** — all 13 sites reference it; no other literal of the sentence in `app/`; every terminal `done` event carries it. **AI text does NOT enter the Reports Pack this milestone** — so the two-disclaimer interaction is **moot by scope**, and the D-106 question is **deliberately left unasked** rather than answered cheaply. The scoped caveats (D-106 kind (a)) are **not touched**. | architect (constant+guard) · owner (Pack scope) | none |
| **(d-i)** | **Commitment 7 gets a mechanism:** the validation contract's **clause count AND clause identity** are pinned to `SECURITY-BASELINE.md:140-168`. Deleting or loosening a clause reds. This is the **AC-L3 spec↔code parity pattern** applied to the contract. | architect | none |
| **(d-ii)** | **D-070's visible fallback signal SHIPS, SERVED, with the ruled wording** — *"AI answer didn't pass grounding checks — showing facts directly."* Served, not client-composed: a client-composed legal-adjacent string would be §0-C's mistake repeated in the milestone that fixes it. | owner | none |
| **(e)** | **ACCEPTED as proposed.** Test asserts `ai_conversations` / `ai_messages` **ABSENT at head**; the migration **downgrade** that re-creates them is **FIXED** (`f9e1a2b3c4d5:113-131`), alembic on the legacy chain per ADR-0001. `briefing.py:184` is explicitly permitted — stored derived **output**, not a stored conversation. | owner | none |
| **(f)** | **`hailo_ollama.py:141-145` mirrors the typed `EgressBlocked` re-raise**; the egress guard is extended to assert **both** providers propagate it **un-retried**. **POSTURE COPY approach (owner): mode-and-consequence, unapologetic — a refusal renders as the product's posture WORKING, never as an error.** Strings stay **PROPOSED until 0a**. | architect (typed re-raise + guard) · owner (copy approach) | none |
| **(g)** | **ACCEPTED as proposed.** A guard row, not a build row: 451 tested **at the AI paths themselves**, so a future widening of the exempt set reds. | owner | none |
| **(h-i)** | **HELP CURRENCY LAW applies in full:** every shipped surface's Help entry and every shown term's GLOSSARY entry land **in-milestone, same-commit, spec-first**. No Tier-2-style deviation is taken. | owner | none |
| **(h-ii)** | **The retired term is FIXED NOW**, as its **own delta**, per the R-52 precedent — and the **deprecated-term guard's corpus is extended to AI fact labels**, which is the real gap either way. | owner | The plan proposed *surfacing it to an open R-52 ruling*. **R-52 was already RESOLVED** — see the correction below. |
| **(i)** | **AskPanel is COMPOSITION-FIRST from ratified primitives.** A DESIGN-SYSTEM amendment is brought **only for what composition cannot express**, PROPOSED at 0a, built at `/kitchen-sink`. `check:primitives` governs regardless. | owner | none |
| **(j)** | **Both spec inconsistencies CORRECTED here**, as authorized record hygiene. | owner | The plan **recommended filing both** so this milestone would not edit documents it does not own. **The owner overruled that and authorized the fix.** Executed in commit `92383ee`. |

### ⚠ VERIFY-FIRST CORRECTIONS — found while recording the closure, 2026-07-20

*Recorded rather than silently absorbed (§11-H). Both concern (h-ii), and both were verified at
`92383ee` with the cites below. **Neither is a ruling** — each reports that a premise the ruling
rested on had already moved.*

**1. R-52 is RESOLVED, not open — and the plan's §0-H/§9(h-ii) premise is stale.**
`page-help.md:745-750` filed R-52 as *"owner ruling owed"*, and this plan quoted it that way. But
`ROADMAP.md:64` records R-52 **✅ RESOLVED pre-release**, owner ruling **2026-07-19**, commit
`cc2daab` — the day **before** this plan was written. The concern in §9(h-ii) that fixing the term
here would *"resolve half of an open owner question"* therefore **does not apply**: there is no open
question, only a settled ruling and its precedent. **This strengthens the (h-ii) ruling rather than
altering it** — the fix now follows a decided precedent instead of pre-empting a pending one.

**2. The replacement term at `tools.py:33` is "Net worth", NOT "Gross assets" — and there is ONE
production call site, not two.**

R-52's own commit message reads: *"Both are holdings BEFORE liabilities, so the term is **Gross
assets**."* **That reasoning does not transfer to this site, and applying the R-52 string
mechanically would ship a WRONG label into the model's grounded facts.**

- `tools.py:33` renders `val.total_value` from `value_portfolio` (`app/services/portfolio.py:627`).
- That function sums `hv.market_value_base` over **every** holding row with **no liability filter**
  (`portfolio.py:662-683`).
- Liabilities are **stored negative** (`GLOSSARY.md:67`).
- ∴ `value_portfolio.total_value` is **liabilities-inclusive** — which `GLOSSARY.md:65` states
  outright: *"**Net worth** … In code this equals `value_portfolio.total_value` because liabilities
  are already stored negative."*

`GLOSSARY.md:350` retires *Total value* → *"Net worth (with liabilities) / Gross assets (positive
holdings), **per context**"*. **This context is with-liabilities. The term is `Net worth`.** No term
is invented: the mapping is read from the deprecated-terms table and the Net-worth definition.

**Call-site count.** The app-wide grep (`"Portfolio total value"`, the page-chrome §11-4 rule) finds
**exactly one production site — `app/ai/tools.py:33`.** The other hits are **five test sites**
(`test_ai_engine.py:22`, `test_ai_facts_routing.py:42`, `test_ai_fallback.py:42, 66, 73`,
`test_ai_safety.py:80`) and this plan's own prose. `app/ai/intent.py:51` matches `total value` in a
**user-input regex** and is **deliberately NOT changed** — it matches what a *user types*, and users
will keep typing the retired phrase; narrowing it would break intent routing to serve a copy rule.

**Consequence for the build:** §9-2 item 6 executes as **`"Portfolio total value"` → `"Net worth"`
at `tools.py:33`**, with `test_ai_facts_routing.py:42` fixed fail-first (it **pins** the defect —
the **third** such test this programme has found; noted for §15), and the deprecated-term guard's
corpus extended to AI fact labels so the class cannot recur.

---

**§9 IS CLOSED. BUILD IS AUTHORIZED. The build stops at the Phase-0a specimen and waits for the
owner** — 0a is ratified by looking, not by report.

---

## 9-BIS. R-22 vs the shipped egress gate — **RULED (b), 2026-07-20** (owner, in chat)

**Status: CLOSED. Was build-blocking for one posture state; unblocked.** The conflict and both
options are left standing below exactly as they were put to the owner — the ruling is at the end.

### The conflict

**R-22 is normative and says local AI keeps working under no-egress:**

> *"no-egress interaction is **normative** — **under no-egress AI is local-only (Ollama)**, a cloud
> provider makes zero calls"* — `ROADMAP.md:36`; same text `DECISIONS.md:909`.

**The shipped gate blocks local AI too.** `egress_client` is the only way to get an HTTP client
(`app/core/egress.py:73`) and it calls `assert_egress_allowed` **before it looks at anything**
(`:82-83`). It takes no URL and has **no loopback exemption** — grep for `127.0.0.1|localhost|
is_local` across `app/core/egress.py` returns **nothing**. So under no-egress the local Hailo/Ollama
call at `hailo_ollama.py:52` raises `EgressBlocked` exactly like a cloud call.

**A ratified test already pins the blocking behaviour**, which is what makes this a ruling and not a
bug report. `tests/integration/test_egress_guard.py:120` `test_ai_provider_makes_no_call` constructs
the provider with **`base_url="http://127.0.0.1:9/v1"` — a loopback URL** — and asserts under
no-egress that no client is constructed and `status.available is False`. The current behaviour is
therefore **deliberate and guarded**, not an oversight.

### Why it blocks Step 3

The (f) ruling authorised **mode-and-consequence** posture copy, with this PROPOSED string for
no-egress + a local provider:

> *"No-egress is on — AI runs on this device only"*

**As shipped, that sentence is false.** With no-egress on there is no local AI either: `health()`
reports unavailable, `answer_stream` takes the deterministic-fallback branch, and the user gets
fact-only answers. Writing that string would be the product describing itself falsely on the exact
surface built to be honest about its posture — and `check:*` would never catch it, because a false
sentence is a working sentence (§11-J's own lesson).

The other two posture states are unaffected and buildable today.

### The two ways out — ⚑ OWNER

| | Ruling | What ships | Cost |
|---|---|---|---|
| **(a)** | **R-22 stands; the gate is wrong.** Exempt loopback from the egress gate so local AI works under no-egress. | The proposed copy becomes true. | Edits `SECURITY-BASELINE.md`'s choke point and **reverses a ratified test's assertion**. Defensible on Commitment 5's own wording — *"zero **outbound** network calls"*, and a loopback call never leaves the device — but it is a change to the product's strongest guarantee and needs the owner, not an inference. |
| **(b)** | **The gate stands; R-22 is superseded.** No-egress means zero calls **including loopback**. | R-22 gains a dated amendment; the posture copy is re-worded to the truth — no-egress + local provider is **the same state** as no-egress + no provider: AI is off, answers are deterministic fact-only. Three posture states collapse to two. | Strictly safer, and matches every line of code and test shipping today. Costs R-22 its normative claim. |

**No recommendation was recorded.** The plan's §9 proposals were written where the evidence
supported one; here the evidence supported *both*, and the choice was about what the product's
strongest promise means — the owner's, not the architect's and certainly not this CLI's.

### ⚖ THE RULING — **(b)**, owner, 2026-07-20

**The gate stands. R-22's "local-only" clause is superseded** by a dated amendment
(`DECISIONS.md` R-22 AMENDMENT; `ROADMAP.md:36`). **No-egress means zero calls including
loopback.**

**The rationale is the durable part, and it is stronger than the question asked.** Option (a) was
framed here as *"a loopback call never leaves the device"*. The owner's answer is that this
frames the wrong object: **a loopback exemption delegates the promise to a process LedgerFrame
does not control.** A local Ollama server is a **separate program that makes its own outbound
calls** — **model pull is the counterexample** — so *"we only talked to localhost"* would stop
being a statement about the device's network behaviour and become a statement about someone
else's software. Commitment 5 promises zero outbound calls as an **observable property of the
device**; it cannot rest on a component whose egress the product can neither see nor prevent.
*(This retires the (a) column's Commitment-5 argument outright — the plan had it as the strongest
point for (a), and it was answered rather than outweighed.)*

**What could reopen it: in-process inference only** — inference inside the LedgerFrame process,
no separate server, no delegated egress. A loopback allow-list does not clear that bar, and no
future proposal should be read as clearing it by being local.

**Consequence for Step 3 — TWO posture states, not three.** *no-egress + local provider* and
*no-egress + no provider* are **the same state**: AI is off, answers are the deterministic
fact-only template. The third state (egress on) is unchanged. The unwritten string is **deleted
rather than worded**, exactly as §9-BIS said it would be if (b) were ruled. Posture copy is
PROPOSED at 0a.

### What proceeds meanwhile

*(Recorded before the ruling: Phase 0 deltas 6–8 were unaffected and continued; the string was left
unwritten rather than guessed. (b) was ruled, and the state was deleted rather than worded.)*

---

## 10. PHASE 0a — THE SPECIMEN (isolated instance, 2026-07-20)

**Driven on an isolated stack** — backend `:8399` on a temp data dir with the demo seed, Vite dev
`:5199`, and a local stub model on `:8401`. The owner's `:8321`/`:5173` were **verified still
listening and untouched**; `.env` was snapshotted and **verified byte-identical afterwards**;
throwaway drivers deleted. `SMOKE_ALLOW_LIVE` was never set.

*The stub model is the only faked component, and it is the one the specimen cannot ship: it returns
a deliberately ungrounded answer so the **real** validator, the **real** fallback and D-070's
**real** served signal are exercised end to end rather than mocked.*

### 10-A. What the driver asserted — 18/18, both themes, zero console errors

Privacy label visible on open · fact pack rendered · `Net worth` label live in a served answer (the
Phase 0.6 fix) · served disclaimer present · **D-070's signal byte-identical to the ruled wording**
· reopening discards the exchange · no-egress posture stated · an answer still complete under
no-egress · explainer opens seeded with its scoped question. Console errors excluding the
acceptance-gate 451s: **none**.

**451 at the AI paths, on a genuinely unaccepted install** — `/ai/facts`, `/ai/grounding-status`,
`/ai/status`, `/ai/chat`, `/briefing`, `/system/ai-config` all **451**, and **451 for a
token-bearing caller** too.

### 10-B. ⛔ FINDING 1 — THE FACT PACK IS UNREADABLE, AND EVERY ASSERTION PASSED THROUGH IT

**This is the specimen's whole justification, and it is a defect I shipped.**

`docs/plans/assets/ai-0a-ask-grounded-light.png` and `…-fallback-signal-dark.png` show the panel
answering *"what is my net worth?"*. The four real figures render correctly at the top — and then
**three help entries render their entire bodies plus `Interpret:` sections as walls of prose**,
consuming the whole panel. In the file named **`fallback-signal`**, **D-070's signal is not visible
at all.** Neither is the answer. Neither is the disclaimer. All three are below the fold.

**Cause — and it is a seam I created, not a rendering bug.** Phase 0.9 widened the fact pack on the
owner's ruling, correctly, *for the model*: `body` + `interpret` unconditional so the AI stops
answering an acceptance question from a table of contents. But the panel renders **the same list to
the user**, so a change scoped to *what the model reads* silently became a change to *what the
person sees*. **The pack fed to the model and the pack shown to the reader were never separated,
because until Phase 1 there was no reader.**

**Why no gate caught it.** Every assertion queried the **DOM**, and every one was true — the signal
*is* present, the disclaimer *is* present, the facts *do* precede the answer. Nothing asked whether
any of it was **on screen**. That is page-legal §11-J's lesson recurring inside my own driver: *a
check that asks whether a thing WORKS cannot see that it is unusable* — and a screenshot assertion
of DOM presence is exactly that check wearing a camera.

**⚑ OWNER CALL, not fixed here.** The fix is a **display projection**: show each help fact by its
title and first line, expandable, while the model keeps the full widened text. But *"what the reader
sees versus what the model gets"* is the same scoping question the owner just ruled on for the
model side — and this finding **is what guessing at that scope produced the first time**. Options:
**(a)** display projection as above, pack unchanged; **(b)** separate `display_facts` from
`model_facts` on the server, which is honest but a contract change; **(c)** rule the walls
acceptable. **Recommendation: (a)** — smallest, keeps one served list, and the fact pack's job is
*"you can see what this rests on"*, which a wall of prose defeats rather than serves.

### 10-C. ⚠ FINDING 2 — a refusal is still described as a connectivity failure, in a served field

Under no-egress, `/ai/grounding-status` serves the correct posture **and** this `last_error`:

> *"cannot connect to `http://127.0.0.1:8401/v1` — verify it's reachable from the device running
> LedgerFrame (try: `curl …`)"*

Nothing failed to connect. **The product refused to call it.** Phase 0.5 fixed exactly this
confusion in `chat()` via the typed `EgressBlocked` re-raise; `health()` → `list_models()` still
swallows it into a generic "cannot connect" and `last_error` **serves that to the client**.

**Not user-visible today** — the Ask panel does not render `last_error` — so it is a finding, not a
regression. But it is a **served string that misdescribes the product's own posture**, which is the
exact class this milestone exists to close, and it would mislead the first operator to read it.
Small fix, deliberately **not** taken unilaterally: it is outside the ruled (f) scope.

### 10-D. Gates at the specimen

Backend **1899 / 15 skipped**, solo (`pgrep pytest` = 0), ordered · `npm run check` **exit 0** —
41 files / **390** vitest / **361** Playwright / lint / typecheck / `check:tokens` /
`check:copy` / `check:smoke-isolation` / `check:primitives` · `ruff check .` **clean** ·
`make lint` **clean** (it was RED at `06dbe15` — §14-D) · contract **exit 0, 141 paths / 71
schemas**, unchanged.

### 10-E. PROPOSED — awaiting the owner's look

Posture copy (both states) · the Ask panel's empty-state and composer copy · the four new GLOSSARY
entries (Ask panel · Fact pack · Grounding · Validation contract) · the `ask` Help entry · the
Settings AI-tab note. **No DESIGN-SYSTEM amendment is proposed** — the panel and the explainer are
composition-only, and `check:primitives` is green.

### 10-F. Owed, and stated as owed

`page-settings.md` §15st-1's **pre-pass re-run** is **still incomplete**: this run drove the AI
surfaces, not the Settings AI tab whose rendered copy changed. It runs with the fix for Finding 1.
