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

---

## 11. PHASE 0a — RE-DRIVE after the Finding 1 + Finding 2 rulings (2026-07-20)

**30/30 driver assertions, both themes, zero console errors.** Same isolation discipline: owner's
`:8321`/`:5173` verified still listening and untouched, `.env` verified byte-identical afterwards,
throwaway drivers deleted, `SMOKE_ALLOW_LIVE` never set.

### 11-A. FINDING 1 — display projection (owner ruled (a))

**Fail-first, as ruled — geometry, not presence.** The new assertions were run against the
**unfixed** render first and went RED with numbers rather than opinions:

```
FAIL  D-070 signal is ON SCREEN — top=902 bottom=934 vh=900
FAIL  answer is ON SCREEN — top=946 bottom=1306
FAIL  disclaimer is ON SCREEN — top=1318 bottom=1343
FAIL  signal precedes the facts — signal top=902 vs facts top=174
FAIL  fact pack occupies less than half the viewport — 716px of 900
```

The signal sat **two pixels below the fold**. After the projection:

```
PASS  D-070 signal ON SCREEN (top=174 of 900)     PASS  answer ON SCREEN (top=500 bottom=860)
PASS  disclaimer ON SCREEN (bottom=897 of 900)    PASS  fact pack bounded at 270px of 900
PASS  D-070 signal LEADS the fact pack (174 < 218)
```

**Shipped:** a help fact renders as **title + first line + `Show more`**; the model keeps the full
widened pack. The fact list scrolls inside `max-height: 30vh`, so it can never again push the
answer off-screen. Component tests pin the projection (including that `Show more` **reveals the
full served text** — a projection is a display decision, never a redaction); the driver pins the
geometry. **Neither alone would have caught the original defect.**

**Clause 7 is untouched, and this was checked rather than assumed.** The ruling put the signal
first; the contract requires **facts before the ANSWER**. Both hold: signal → facts → answer. The
signal is not the answer.

### 11-B. FINDING 2 — a refusal reports as a refusal (owner ruled in-scope by extension of (f))

**Fail-first:**
```
AssertionError: openai_compatible: under no-egress health() blames the NETWORK ('cannot connect'):
  "cannot connect to http://127.0.0.1:9/v1 — verify it's reachable … (try: curl …)"
```

Both providers now check the gate **first** in `health()` and return one served constant,
`REFUSED_BY_POSTURE` (`app/core/egress.py`). `health()` still **reports rather than raises** — that
contract is unchanged and `test_ai_provider_makes_no_call` depends on it.

Served live at the re-drive: *"No-egress is on — no outbound call was made. This is the privacy
posture working, not a connection problem."*

**Pinned against going blind:** with egress ON, a **real** connection failure must still be
diagnosed — reporting "no-egress" unconditionally would satisfy the test above and destroy a
genuinely useful diagnosis.

**Note on wording:** `REFUSED_BY_POSTURE` deliberately does **not** reuse `EgressBlocked`'s message,
which names *"Product Guarantee 5"* — retired vocabulary kept in internal code by the §11-G
no-sweep ruling. **A string that reaches a reader does not get that exemption.**

### 11-C. ⚠ FINDING 3 — found at the re-drive, FIXED: the signal rendered twice

Looking at the first re-drive screenshot: D-070's sentence appeared **twice** — once as the served
element, once inside the answer body as `_AI answer didn't pass grounding checks — showing facts
directly._`, **markdown underscores rendered literally**, because the answer body is text.

Phase 0.8 emitted the signal as a **leading delta** *and* on the `done` event. That was right when
no client existed; once the panel rendered the served field properly it became a duplicate with
artifacts. The delta injection is removed — **one served string, rendered once, where the client
puts it.** Its ordering guarantee moved to where it now lives: the component test and the driver's
geometry.

*This was caught by looking, not by a gate — the 30/30 run was green with the duplicate present.*

### 11-D. ⚑ FINDING 4 — NOT FIXED, owner's call: the disclaimer also renders twice

`ai-0a-fallback-signal-light.png` shows *"Information only, not financial advice."* **twice**: once
ending the answer body (`_template_answer` appends it) and once as the served element the panel
renders beneath.

**I did not treat this as Finding 3.** They differ in a way that matters: the signal's duplicate was
**defective** (raw markdown artifacts), and removing it touched nothing normative. This one is
**redundant but correct** — both copies render cleanly — and the trailing line is part of how
**Commitment 2's** *"every AI answer **ends with** the fixed disclaimer"* is mechanised in the
deterministic template. Removing it is a change to a Commitment's mechanism, and that is not mine.

**⚑ Options:** **(a)** the panel renders the served disclaimer and the template stops appending it
— cleanest visually, but the answer TEXT no longer ends with the disclaimer for any raw-stream
consumer; **(b)** the template keeps it and the panel stops rendering its own element — keeps
Commitment 2 mechanised in the text, but loses the disclaimer on model-narrated answers where the
model may omit it; **(c)** leave both. **No recommendation recorded** — (a) and (b) trade the same
guarantee against two different readers, which is a ruling.

### 11-E. Gates

Backend **1901 / 15 skipped**, solo (`pgrep pytest` = 0) · `npm run check` **exit 0** — 41 files /
**394** vitest / **361** Playwright / lint / typecheck / tokens / copy / smoke-isolation /
primitives · `ruff check .` clean · `make lint` clean · contract **exit 0, 141 / 71** unchanged.

### 11-F. Still owed

`page-settings.md` §15st-1's pre-pass re-run. This re-drive again covered the AI surfaces, not the
Settings AI tab whose rendered copy changed.

---

## 12. PHASE 0a — FINAL FIXES after the owner's screenshot walk (2026-07-20)

The owner walked the 0a screenshots in chat on 2026-07-20. That walk produced **two roadmap
filings** and **five deltas**. This section is the record; §13 is the re-drive it ends in.

**Read the shape of this walk before the items.** Findings 1–3 at the previous re-drives were
**defects**: a signal below the fold, a refusal misreporting itself as a network error, a sentence
rendered twice with raw markdown. What the owner found by looking this time is mostly **not
defects** — it is *"the built thing is honest, and thinner than it should be"* (R-54) and *"the
built thing is undocumented in two subject areas"* (R-55). **That is what a look is for, and it is
not something a gate can produce.** The 30/30 driver run was green through every one of these.

### 12-0. Records filed (Step 0)

| Filed | Where | Status |
|---|---|---|
| **R-54** — Deterministic answer intelligence: the two-tier Ask panel | `ROADMAP.md` | ⚡ v2.0.0 scope (RD-9 Amendment 7) |
| **R-55** — Help content: asset classes & corporate actions | `ROADMAP.md` | ⚡ v2.0.0 scope (RD-9 Amendment 7) |
| **RD-9 SCOPE AMENDMENT 7** — v2.0.0 scope += R-54, R-55 | `release-readiness.md` | owner, 2026-07-20 |
| **KB-SYNC** — every session report ends with the derived list of changed KB-mirrored files | `CLAUDE.md` hard rules + `TEMPLATE-page-build.md` close ritual | standing |

**⚠ Amendment 7 was WRITTEN, not merely cited.** The owner's ruling named *"RD-9 Amendment 7"* as
the authority for pulling both rows pre-release, and **no Amendment 7 existed** — Amendment 6
(2026-07-18) was the latest. Filing the roadmap rows alone would have left **two release-blocking
items citing an amendment that was not in the file**, which is precisely the drift the amendment
mechanism exists to prevent: under **Amendment 3 the release gate is FULL COMPLETION of an
enumerated set**, so a row that moves the finish line is only real if the finish line says so.
Amendment 7 is now written at the top of `release-readiness.md`, and the status line above it
updated to name it.

**R-54 carries a cross-reference that is easy to lose, so it is stated twice:** the **no-egress
deterministic answering that already shipped at this 0a is tier-1's SEED**, not a separate thing to
be reconciled later — §12-3 records the string as its first artifact, and R-54 **owns the
posture-copy amendment** when tier-1 formally lands.

### 12-1. The fallback echo — the projected fact list IS the answer

**Architect ruling, Finding-1's principle carried one step further.** Finding 1 established that
the fact pack is **projected** for display. The deterministic template then **re-listed those same
facts** under *"Here is what the data shows:"* — so the projection Finding 1 introduced was
immediately **echoed underneath it**, and every fact appeared on screen **twice**.

**Fail-first** (`tests/unit/test_ask_answer_projection.py`, against the unfixed build):

```
FAIL [down] the answer body repeats the fact LABEL 'Net worth', which the panel already
            renders in the fact list above it
FAIL [down] the duplicate block's header survived: "Here is what the data shows:"
```

Asserted across **all three fallback paths** — provider down, validator rejection, empty model
reply — because they reach the template for **different reasons**, and a fix that cleaned one and
left the others is exactly the shape this guard exists to catch.

**Shipped:** the fallback body carries **no facts**. Panel = **signal → fact list once →
disclaimer**. **Nothing is redacted** — the same projection, shown once — and nothing is lost to a
raw-stream consumer, because the facts travel on their own `facts` event, which is where a consumer
should read them rather than re-parsing them out of prose. With **no** facts there is no list to be
the answer, so the refusal **is** the body; that asymmetry is the rule itself: *the body says what
the screen does not already say.*

**⚠ FOUR TESTS PINNED THE ECHO IN PLACE.** `test_d070_fallback_signal` asserted `"Net worth" in
text`; `test_ai_fallback` asserted it twice, under a comment reading *"data fallback **shown**"*;
`test_validation_contract_pinned` asserted it **as clause 6**. The comment said *shown* and the
assertion checked *echoed* — **indistinguishable until something actually rendered the fact pack.**
That is now four tests this milestone found holding a defect steady (cf. R-52's retired term).

**⚠ CLAUSE 6 WAS RE-READ AGAINST THE SPEC — not adjusted to fit the code.** This is flagged for the
owner because it is a reading of a **normative** clause. `SECURITY-BASELINE.md` §5(6) says the model
text is **discarded** and a deterministic fact-only answer is **SHOWN**. It does **not** say the
answer *body* contains the facts; **clause 7 says where facts are shown** — the fact pack, before
the answer. The architect's ruling is therefore a **reading** of clause 6, not a change to it. The
test now asserts clause 6's **three actual promises separately**: the model text is gone, the facts
are served, and the text ends with the disclaimer. **The third is enforced on the TEXT for the
first time** — previously a model omitting the line broke clause 6 and **nothing went red**.

**✅ CONFIRMED BY THE OWNER, 2026-07-20 — the reading is RATIFIED, not merely recorded.** The
architect flagged the re-reading *for* the owner precisely because a normative clause is not the
architect's to re-read alone; the owner has now read it and confirmed it:

> the fact list **IS** the showing that clause 6 demands; the body need not duplicate it. Clause 7
> governs **where** facts are shown.

So clause 6's *"a deterministic fact-only answer is SHOWN"* is satisfied by the **served fact pack
rendered in the panel** — the showing is the surface, not the sentence. This closes the flag carried
at §13-E; it is no longer an open reading. **What follows from it, and is why the confirmation is
worth a record of its own:** the empty fallback body is now the *ratified* shape of clause 6, so a
future change that puts facts back into the answer prose would be a **regression against a
confirmed reading**, not a matter of taste — and `test_ask_answer_projection.py` is the guard that
holds it.

**⊕ Found while fixing:** the model-error preamble still carried **markdown underscores**
(`_The AI model didn't return an answer…_`). The **same defect as Finding 3**, at the one remaining
site, unseen only because no screenshot ever drove the model-error path. Now plain text.

### 12-2. The disclaimer — the owner's synthesis of Finding 4

Finding 4 recorded three options and **no recommendation**, because (a) and (b) traded **the same
guarantee against two different readers**. The owner ruled **neither option, but both halves**:

> the answer **TEXT** always ends with the served `DISCLAIMER` constant — **Commitment 2 binds the
> ARTIFACT**, so every export, stream and copy carries it — and the **PANEL** projects the body
> **without** the trailing line and renders the footer element **once**.

**De-duplication at display is a PROJECTION, not a redaction.** Same distinction Finding 1 settled
for the fact pack, now applied to the sentence Commitment 2 fixes.

**Fail-first, and the first attempt was TOO WEAK TO COUNT — recorded because the near-miss is the
lesson.** With a stub that emitted the disclaimer, both assertions passed on the unfixed build: the
stub was **complying**, which is precisely what Finding 4's option (b) warned could not be relied
on. A guard whose fixture supplies the property under test is **circular** — the same failure mode
`page-help` §9-bis-9(d) recorded for the Help accuracy corpus. Adding a valid answer that simply
**omits** the line:

```
FAIL [ok_no_disclaimer] the disclaimer appears 0× in the answer text; exactly one trailing
     instance is the guarantee
```

**Shipped:** `_with_disclaimer()` normalises at the single point every answer text leaves the
module — every occurrence stripped, one appended. **Not append-if-missing:** a model complying
*mid-paragraph*, or twice, would leave the constant somewhere other than the end while an `in`
check reported the guarantee satisfied.

**Display half** (`AskPanel.tsx`): the body is projected without the trailing **served** constant —
never a hardcoded one, since matching a legal sentence locally would make the component a second
source of truth for it — and when the projection leaves nothing, **no answer block renders at all**.
An empty bordered box beneath the facts reads as *"the AI said nothing"*, which is not what
happened. Fail-first: `expected ask-answer to be null, received a div containing only "Information
only, not financial advice."`

### 12-3. ⚑ NO-EGRESS POSTURE COPY — the SHIPPED string ratified over the drafted one

**Owner ruling, 2026-07-20.** The §9 (f) ruling left posture strings **PROPOSED until 0a**. At 0a
the owner ratified **what shipped**, in preference to the drafted two-state wording:

> **RATIFIED:** *"No-egress is on — this device makes no outbound calls, so answers are built from
> your data only, with no AI narration."*

**This is recorded as a DIVERGENCE FOUND AT 0a, not as a tidy-up.** The (b) ruling (§9) collapsed
three posture states to two on the finding that *no-egress + local provider* and *no-egress + no
provider* **are the same state**, and the copy drafted from it said, in effect, **that no-egress
means no AI answering at all**:

> *(drafted)* *"No-egress is on — AI runs on this device only"* → re-worded toward *AI is off,
> answers are deterministic fact-only*

**What shipped says something materially different and truer:** answers are **still built** — from
the user's own data — with the **narration** removed. Both statements describe zero outbound calls;
only one of them describes what the user actually gets.

**Why the shipped string is legitimate rather than a drift to be reverted.** The deterministic
answering it describes makes **zero network calls BY CONSTRUCTION** — it never reaches
`egress_client` at all — so it is squarely inside the R-22 amendment (option (b)) rather than an
exception to it. **No egress question can arise about a code path that cannot make a call.**

**⟶ THIS IS R-54 TIER-1'S SEED.** The capability the ratified sentence describes *is* deterministic
answering, shipped narrow (the template over the fact pack) and named in the posture copy before
the tier exists as an architecture. **The shipped banner string is tier-1's first artifact**, and
**R-54 owns the posture-copy amendment** when tier-1 formally lands — dated notes on these ratified
strings, with the accuracy guards holding **both versions true in their time**.

#### The ratified set, in full

The guard binds **every** served posture string to this table, so it is the record, not an
illustration. **Only the no-egress row was ruled explicitly**; the other four are the shipped set,
presented at this walk and ratified by the look.

| Posture | Ratified string |
|---|---|
| **no-egress** ⚑ *ruled explicitly* | No-egress is on — this device makes no outbound calls, so answers are built from your data only, with no AI narration. |
| **disabled / AI off** | Deterministic — fact-only answers; nothing is sent anywhere. |
| **local OpenAI-compatible** | On-device (local OpenAI-compatible endpoint) — data stays on this device. |
| **remote provider** | Remote — prompts (incl. portfolio facts) are sent to the configured provider. |
| **local NPU (Hailo/Ollama)** | On-device (local Hailo/Ollama) — portfolio facts stay on this device. |

**PINNED.** The five served posture strings are now named constants (`app/api/v1/routes/ai.py`) and
bound to this section by `tests/unit/test_posture_copy_ratified.py` — the **AC-L3 spec↔code parity
pattern** the fallback signal already uses: edit this record and the guard carries the change into
the product; edit the product alone and the guard goes red. **Only the no-egress string was ruled
explicitly**; the other four are the shipped set, presented at this walk and ratified by the look.
The guard also asserts **coverage** — a new posture branch that forgets to register its string reds
rather than shipping unratified copy on the one surface built to be honest about posture.

### 12-4. PASSING NARRATION — the panel's primary state, finally on camera

**Every previous 0a drive photographed a product that had fallen back.** The grounded, validated,
model-narrated answer — the state the panel exists FOR — had never been captured, because no
provider was configured that could produce one. **A specimen missing its primary state is not a
specimen of the product.**

**Shipped for the drive (test double, never committed, never in a gate):** an OpenAI-compatible
stub that answers **strictly from the fact pack** — it parses the `FACTS` block out of the prompt
it is handed and re-states those exact values. That is not "a model that behaves well"; it is the
**only narrow path** through the validator: clause 2 (every significant figure must trace to a
fact), clause 3 (no ticker outside the facts/question), clause 4 (no recommendation language).
Echoing the pack satisfies all three by construction.

Served live at the re-drive, `provider: openai_compatible`, validation **passed**:

> *"Your net worth is 772,126.26 SGD. Your total unrealised p/l is 79,326.30 SGD. Your total return
> % is 11.45%. These figures come from the facts shown above, as of the timestamps listed there."*

**⚑ FOUND WHILE BUILDING THE STUB — a zero-valued fact can never be narrated.**
`safety._sig3()` takes the first three **significant** digits, so `"0.00"` reduces to `""`, and the
empty string is then **discarded** from the traceable-fact set (`fact_sigs.discard("")`). A
legitimately zero figure — *"Today's change: 0.00 SGD"*, true and useful — therefore **traces to
nothing**, and any answer quoting it **fails clause 2** and falls back. This is why the first three
narration attempts fell back with `unsupported figure '0.00' not in the facts`.

**Not fixed — recorded.** It **errs safe** (the product falls back rather than fabricating), it is
outside the five ruled fixes, and the correct handling is a judgement: a zero is genuinely
indistinguishable from "no significant digits" under a leading-digits comparison. **⚑ For the
owner.** The stub simply avoids zero facts so the narrated state could be photographed at all.

### 12-5. The OWED page-settings §15st-1 pre-pass — RUN, and GREEN

**Owed since the AI tab's note changed; owed again after the last re-drive**, because both previous
drives covered the AI surfaces and **not the Settings tab whose rendered copy moved**. Run **by
name** this time, both themes:

```
PASS  settings-ai/light|dark: §15st-1's NEW note renders
PASS  settings-ai/light|dark: the note names what DID ship (Ask)
PASS  settings-ai/light|dark: the OLD deferral note is gone
PASS  settings-ai/light|dark: the note is ON SCREEN — 307-325 of 900
```

Screenshots: `ai-0a-settings-ai-tab-{light,dark}.png`. **§15st-1's "PRE-PASS RE-RUN: OWED, NOT YET
RUN" is discharged** — a dated note lands on `page-settings.md` with this delta.

---

## 13. PHASE 0a — THE RE-DRIVE (2026-07-20)

**78/78 driver assertions · both themes · ZERO console errors** (excluding the ~100 expected `451`s
on the unaccepted install, which are the acceptance gate working). Six states, each shot in light
and dark: **451 gate · grounded PASSING narration · fallback (echo-free, signal leading) ·
no-egress deterministic · instrument explainer · Settings AI tab (§15st-1)**.

**Reset per run, deliberately.** The 451 state only reproduces on an **unaccepted** install and the
run itself accepts the terms — so the drive begins by wiping the isolated data dir and re-seeding.
The first two attempts silently skipped the gate state for exactly this reason; the reset is now
part of the run rather than a thing to remember.

### 13-A. The assertions that carry the rulings

```
grounded/light|dark   PASS  a NARRATED answer is present          PASS  no fallback signal
                      PASS  disclaimer visible exactly once — saw 1
                      PASS  no fact label echoed in the answer body — echoed []
fallback/light|dark   PASS  the rejected model text never reached the reader
                      PASS  the fabricated figure never reached the reader
                      PASS  D-070 signal LEADS the fact pack (341 < 385)
                      PASS  signal visible exactly once — saw 1
                      PASS  no empty answer block — the fact pack IS the answer (§12-1)
no-egress/light|dark  PASS  the RATIFIED posture string is served
explainer/light|dark  PASS  opens with a SEEDED, scoped question — "Explain AAPL — …"
                      PASS  NOTHING was sent on open — no answer until the reader asks
```

The explainer assertions are worth naming: they check that the panel **did not fire on mount** —
no answer, **and no fact pack either**. An explainer that answered on open would spend the user's
device on a question they never asked, and under a metered provider that is their money.

### 13-B. ⚑ FINDING 5 — the fact pack ships the SAME figure twice, one copy unformatted

**Found by looking at the screenshot; the 78/78 run passed straight through it.** The *"What this
is built from"* list — the panel's trust surface, the product showing its working — renders:

| Label | Value |
|---|---|
| Total unrealised P/L | **79,326.30 SGD** |
| Unrealised P/L | **79326.3 SGD** |
| Total return % | 11.45% |
| Total return | 11.45% |

**The same figure, twice, under two labels — and one copy is raw.** `79326.3 SGD` has no thousands
separator and one decimal place, on a **money** surface, directly beneath a correctly-formatted copy
of itself. `Income (div/int): 0.0 SGD` is the same defect.

**Mechanism, so the finding is actionable:** the pack is merged from two sources.
`tools.portfolio_facts()` formats money through `_fmt(value, base)`; `tools.performance_facts()`
(the analytics `key_stats` path) renders it as **`f"{v} {base}"`** — no formatting at all — and the
two sources **overlap** on unrealised P/L and total return.

**Why it matters more here than elsewhere:** this list exists so the reader can check the answer
against its basis. A basis list that shows one number twice, spelled two ways, reads as a product
that does not know its own figures — on the one surface built to demonstrate that it does.

**NOT FIXED — ⚑ owner's call.** The de-duplication half is a **scoping** decision on a pack the
owner ruled at Phase 0.9 ("WIDENED, scoped"), not a typo. Options, no recommendation: **(a)**
de-duplicate at merge (one label per figure, canonical wins); **(b)** format `performance_facts`
through `_fmt` and leave the duplication (fixes the ugly half, leaves the confusing half);
**(c)** both. **(a) and (c) change what the MODEL sees**, which is why this is not a quiet fix —
though note the validator is format-insensitive (`_sig3` compares leading significant digits), so
formatting alone cannot break grounding.

### 13-C. ⚑ FINDING 6 — the Settings AI tab can name a provider that is not the one answering

**Found by looking at the §15st-1 screenshot** — at the line **above** the note the pre-pass was
checking. The tab read:

> *"AI is on — provider **hailo**, model (default)."*

while `/ai/grounding-status`, on the same instance at the same moment, served
**`openai_compatible` / `stub-narrator`** — and that was the provider actually answering.

**Mechanism.** `/system/ai-config` builds its answer from **`read_env()`** — the repo-root `.env`
**file** — falling back to settings. But **pydantic settings let OS environment override `.env`**,
so the **effective** provider (what `get_ai_provider()` constructs, what `grounding-status`
reports) and the **configured** provider (what `.env` says, what Settings displays) are **two
sources of truth for the same fact**, and they diverge whenever OS env is set.

**Stated honestly: this drive INDUCED the divergence.** OS-env overrides are exactly how the
isolated harness configures itself (prepass method), so this is not proof the owner's install is
misreporting. **What it does prove is that the two can disagree and the tab cannot tell** — and
the very note §15st-1 ratified promises *"this line reflects the **served** configuration only."*
Under a systemd `Environment=` or a container `-e`, that sentence would be false.

**This is the milestone's own defect class** — a served string that misdescribes the product's own
state — found on the surface that promises to reflect it. **NOT FIXED, ⚑ owner's call**, because
choosing between *report the CONFIGURED value* and *report the EFFECTIVE value* is a ruling, not a
repair: **(a)** serve the effective settings (what is running); **(b)** keep `.env` and change the
note to say "configured", which is a §15st-1 copy amendment; **(c)** serve both and show a drift
warning when they differ.

### 13-D. Isolation

Owner's `:8321`/`:5173` **verified still listening and untouched** before and after · `.env`
**verified byte-identical** (`2fc668e5…` both ends, `diff` clean) · isolated stack (`:8399` backend,
`:8402` stub, `:5199` vite) **confirmed fully down** at teardown · throwaway driver, vite config and
stub **deleted** · `SMOKE_ALLOW_LIVE` **never set** · every write landed in a temp data dir that was
wiped between runs.

### 13-E. Still owed / carried

- **⚑ Findings 5 and 6 above** — recorded, not fixed, awaiting the owner's ruling.
  **→ RULED 2026-07-20, see §14-2 and §14-3.**
- **⚑ The zero-fact narration gap** (§12-4) — recorded, errs safe.
  **→ RULED 2026-07-20 as Finding 7, see §14-5.**
- **⚑ Clause 6's reading** (§12-1) — flagged: a normative clause was re-read, not changed.
  **→ CONFIRMED by the owner 2026-07-20, see §12-1. Closed.**

---

## 14. THE 0a WALK RULINGS — owner, 2026-07-20

The owner walked the 0a re-drive screenshots and ruled. **This section is the record**; the rulings
below are quoted or stated in the owner's terms, and each one names what it obliges.

### 14-0. 0a RENDERS RATIFIED — by looking

The owner ratified, **by looking at them**, the renders this milestone put on camera:

| Render | §  | Status |
|---|---|---|
| Narrated answer — the panel's primary state | §12-4 | **RATIFIED** |
| Echo-free fallback (fact list once, no body facts) | §12-1 | **RATIFIED** |
| Synthesis disclaimer — text always, panel once | §12-2 | **RATIFIED** |
| No-egress posture string, as SHIPPED | §12-3 | **RATIFIED** (already pinned) |
| Explainer (seeded, does not fire on mount) + empty state | §13-A | **RATIFIED** |
| 451 renders the gate | §13-A | **RATIFIED** |

**EXCEPT** the two things the owner found *at* the walk and ruled **into** this milestone rather
than past it: **the AI tab copy** (§14-3) and **answer provenance** (§14-4). Ratification of a
render is ratification of *that* render — it does not extend to a surface the walk newly indicted.

### 14-1. The naming ruling — THREE KINDS OF INTELLIGENCE

Recorded here and in `GLOSSARY.md` **first** (spec-first; the three-store parity guard carries it
into the stores), then into code. See §14-2 for the full statement.

### 14-2. Vocabulary — the owner's three kinds

> - **"Built-in intelligence"** — deterministic answers from the user's own figures; **no model
>   involved**; works in every posture including no-egress.
> - **"On-device model"** — an LLM running on this device (Ollama or compatible); questions and
>   figures **never leave the device**, but the narration **IS** model-generated.
> - **"External model"** — a cloud API; **data leaves the device** and the copy says so plainly.

**User-facing "hailo" is RETIRED** → the served label is **"On-device model
(Ollama-compatible)"**. The owner's reasoning is worth keeping, because it is a rule about naming
and not just this name: the endpoint is **OpenAI-compatible** and works with Ollama *and its
lookalikes*, so the honest label **names the standard rather than over-pinning a vendor**. A label
that names one implementation is false the moment a second one is what is running — which is the
same defect class as §14-3 below, in the vocabulary rather than in the plumbing.

**Migration is additive, never breaking.** Old env keys are accepted as **aliases**: the owner's
live `.env` must keep working across this rename. Internal module ids stay unless the rename is
trivial — this is a **user-facing vocabulary** ruling, and renaming private symbols for tidiness
would put churn in the same delta as a copy change, hiding one in the other.

**⚠ R-52 precedent, cited because this is the second time.** A retired term was already found *in
the AI's mouth* (§0-H). Retiring a term without a parity guard is retiring it in one place; the
guard is what makes it retired.

### 14-3. FINDING 6 + THE AI TAB COPY — merged, and both halves ruled

The owner ruled Finding 6 **(a)** — *serve the effective settings* — and **merged the tab's copy
into the same delta**, because the walk found the tab wrong in **two** ways at once and fixing the
truthfulness without the vocabulary would ship a sentence that is accurate and still unreadable.

1. **Truthfulness** — served `ai-config` reports the **EFFECTIVE resolved configuration the process
   sees** (OS-env overrides included), so the tab **can never name a provider that isn't
   answering**. This restores §15st-1's ratified promise — *"this line reflects the served
   configuration only"* — to being **true**.
2. **Vocabulary** — the tab **describes the configuration in the ruled terms** (§14-2): **which
   kind of intelligence is active**, **its data-locality consequence**, and **that external models
   are configured here**.

Register example — **draft served strings, PROPOSED until the owner's 3b look**:

> *"AI is on — on-device model (Ollama-compatible); no data leaves this device. Built-in answers
> work in every mode."*

**Obliges:** fail-first on the **env-override case that induced the disagreement** (§13-C); a
**dated delta note on `page-settings.md`** and that page's pre-pass re-run, per the standing
new-guard-reds-an-accepted-surface rule in `CLAUDE.md`.

### 14-4. THE PROVENANCE LEGEND — the walk's centrepiece

**Owner ruling.** Every answer carries a **served provenance line matching its ACTUAL generation
path**. Three states, three lines:

| Generation path | Served legend |
|---|---|
| Deterministic, no model — **and the fallback state** | *"Built-in intelligence only — no model was used."* |
| Facts from the engine, narration by an on-device model | *"Facts: built-in · Narration: on-device model — nothing left this device."* |
| Facts from the engine, narration by a cloud API | *"Facts: built-in · Narration: external model."* |

**And model-generated text renders in a DISTINCT TREATMENT** — italic; a **PROPOSED DESIGN-SYSTEM
item: model-text styling, semantic and not decorative**. **Engine-served facts never carry it.**

**Why this is the centrepiece and not a nicety.** The panel already showed *what the answer is built
from*; it never showed **who wrote the sentence**. Those are different questions, and the second one
is the one a reader needs in order to weigh the first. The treatment makes it legible **without
reading a line of copy** — the reader can see, at a glance, which words came from a model and which
came from their own ledger.

**Guards, fail-first, both directions:** the legend **must match the generation path** — a
built-in-only legend on a narrated answer is **RED** — and **model text carries the treatment while
facts do not**. Strings **served**, never composed client-side (§0-C). **All PROPOSED** until the
owner's look.

### 14-5. FINDING 7 — the zero-valued-fact narration gap (POST-RELEASE)

**Ruled: file the ROADMAP polish row.** `_sig3("0.00") → ""` is discarded, so a zero-valued fact
cannot be cited by the narration. It **errs safe** — the failure mode is *no narration of a zero*,
never a fabricated one — and it is a **known limit**, not a defect this milestone repairs.
**POST-RELEASE.**

---

## 15. THE RULED FIXES — one delta each (2026-07-20)

### 15-1. FINDING 5 — one canonical fact per figure, and no raw money in the pack

**Owner ruled (c) — both halves.** Shipped in one delta because they are one defect seen twice: the
pack merged two sources that overlap, and neither the merge nor the sources knew it.

**Fail-first, on the SERVED pack** (`tests/integration/test_ai_fact_pack_canonical.py`, against the
unfixed build — 8 failures across four overlapping questions):

```
FAIL raw money in the fact pack for "How is my portfolio performing and what's the risk?":
       Unrealised P/L: '103907.53 SGD'
       Realised P/L: '802.7 SGD'
       Income (div/int): '0.0 SGD'
FAIL the pack still serves a non-canonical alias: ['Total return %', 'Total unrealised P/L']
```

**⚠ THE GUARD IS ON THE PACK, NOT ON THE FORMATTER — and that is the whole lesson of this finding.**
`_fmt` was never broken; it was **BYPASSED**. `performance_facts` rendered money as `f"{v} {base}"`,
one function away from the helper it should have called. A unit test on `_fmt` would have been green
throughout, and *was* — the 78/78 run walked straight through a screenshot showing `79326.3 SGD`.
**A guard on a helper cannot see a caller that does not call it.**

**⚠ THE CANONICAL LABEL AND THE CANONICAL VALUE CAME FROM DIFFERENT SOURCES.** This is why the fix is
not "pick a winning source and drop the other". `GLOSSARY.md:157/161` make **Unrealised P/L** and
**Total return** the canonical **spellings** — the `performance_facts` side — while the canonical
**values** come from `value_portfolio`, the canonical reader, via `portfolio_facts`. **Neither source
was wholly right.** The survivor therefore keeps the winner's **value** (first-wins, and
`gather_facts` prepends `portfolio_facts` on every portfolio intent, so that ordering is a
consequence of the architecture rather than luck) and is **relabelled** to the GLOSSARY spelling.

**⚠ IDENTITY IS DECLARED, NEVER INFERRED FROM THE VALUE.** The cheap guard — *"no two facts render
the same number"* — is **wrong**, and would have shipped a data-loss bug waiting for the first user
with no liabilities: **Net worth** and **Total assets** are equal for that user, and they are two
different figures that merely coincide. Collapsing them would delete a fact the reader asked for. So
`FIGURE_IDENTITY` in `app/ai/tools.py` is an explicit, reviewable map, and a coincidence of values is
never treated as a duplicate. *The obvious version of this guard was the dangerous one.*

**Shipped:** `_dedupe` deduplicates by **label AND figure**, relabelling the survivor; the
`performance_facts` money branch renders through `_fmt`. **Grounding is untouched** — the validator
is format-insensitive (`_sig3` compares leading significant digits), so this changes what the reader
sees without changing what the model may cite. **17/17 new; 308 passed across the AI suites.**

**⊕ Found while fixing, NOT swept in:** `Income (div/int)` is a shown fact label with **no GLOSSARY
row** — the spelling there is **Income** (`GLOSSARY.md:158`). It is not a *retired* term, so the
deprecated-term guard cannot see it, and it is not a *collision*, so this delta's de-duplication does
not reach it. It is the same class as §0-H (a non-canonical term in the AI's mouth) at a new site.
**⚑ Recorded as FINDING 8, not fixed** — a label change is app-wide (page-chrome §11-4) and this
delta is scoped to Finding 5.

### 15-2. FINDING 7 — filed as **R-56**, POST-RELEASE

The zero-valued-fact narration gap (§12-4) is now a ROADMAP row rather than a paragraph in a plan
file, per the ruling. The row states the mechanism to the line (`safety.py:93`, `safety.py:133`), why
it **errs safe** — *the product is quieter than it could be, never wronger* — and why the repair is a
**judgement**: under a leading-significant-digits comparison a zero is genuinely indistinguishable
from *"no significant digits"*, so the discard is correct handling applied to a value that parses
empty legitimately. Any repair must separate those two cases **without widening what the validator
accepts**, because the contract may not weaken (Commitment 7 / D-071).

### 15-3. FINDING 6 + THE AI TAB COPY — one resolver, one served sentence

**Owner ruled (a) — serve the effective settings — and merged the tab copy into the same delta.**

**Fail-first** (`tests/integration/test_ai_config_effective.py`), reproducing the 0a divergence
deliberately: a `.env` **file** holding one provider while the **OS environment**, which pydantic
settings let win, holds another —

```
FAIL the AI tab reports provider 'hailo' from the .env FILE while the process is running
     'openai_compatible'. §15st-1 promises this line reflects the served configuration
FAIL KeyError: 'remote'   [the tab and the Ask panel could not even be compared]
```

**⚠ BOTH DEFECTS FOLLOWED FROM ONE FACT: THE SENTENCE WAS COMPOSED IN THE BROWSER.**
`` `AI is on — provider ${ai.provider}, model …` `` interpolated the **raw internal provider id**,
which is how the **retired vendor word** reached the screen (§14-2); and it described whatever the
payload said, which was the **`.env` file** rather than the process (§13-C). Those look like two
findings and are one: a claim the product makes **about itself** had no single author. The sentence
is now **served and rendered verbatim** — the rule the Ask panel's posture line already follows,
for the reason §0-C exists.

**ONE RESOLVER.** The five-way posture decision moved out of `/ai/grounding-status` into
`app/ai/vocabulary.py`, and `/system/ai-config` calls it too. *Two surfaces working the same fact
out separately **is** Finding 6* — so this is the fix, not a tidy-up that came with it. The module
also carries the three kinds, so §15-4's provenance legend reads the kind from where the tab reads
it, and a fourth surface cannot invent a fifth answer.

**⚠ AN EXISTING GUARD WENT RED, AND WAS RE-EXPRESSED RATHER THAN RELAXED.**
`test_posture_copy_ratified.py`'s reachability check reported **all five** ratified posture
constants as *"no longer served by the route"* the moment the route stopped naming them in
branches. **The property it guards did not change** — a ratified string nothing serves is a record
of copy the user cannot see — so the mechanism now follows the serving path through `POSTURE_COPY`,
with the second arm **conditional on the route actually referencing the dict**. Proven not blind by
breaking that reference and watching all five go red again. *A guard that reds on a refactor is
usually right about the property and wrong about the mechanism; the temptation is to fix the
verdict.*

**⚠ THE OLD FRONTEND ASSERTION COULD NOT HAVE CAUGHT THIS.** `Settings.test.tsx` matched
`/^AI is (on|off)/` against a string the **component composed**, so it could only confirm the
component's own template still ran: under Finding 6 the template renders the **wrong provider in
the right shape** and the assertion is **green**. It now asserts the **served** sentence verbatim,
and that `hailo` never reaches the screen **even though the mock's `provider` is `"hailo"`** — a
claim about the boundary rather than about the template. *Fifth test this milestone has found
incapable of seeing the defect it sat next to.*

**Dated delta note filed on `page-settings.md` §15st-3**, per the standing `CLAUDE.md` rule; that
page's pre-pass re-run lands with Phase 3a. **Contract regenerated same-commit: 141 paths / 71
schemas — unchanged**, docstrings only.

**⚑ FINDING 9 — recorded, NOT fixed, and not in this delta's scope.** Under (a) the tab is always
**true**. What it does not say is that a `PUT` writing `.env` has **no effect** while an OS-env
override is in force — `reload_settings()` re-reads, and the override still wins. The user saves,
the tab honestly reports something else, and nothing explains why. Surfacing that is **option (c)**
(serve both, warn on drift), which **the owner did not rule**. ⚑ **For the owner.**

**Strings PROPOSED until the 3b look:** the four `AI_TAB_COPY` sentences and the amended static
note.
