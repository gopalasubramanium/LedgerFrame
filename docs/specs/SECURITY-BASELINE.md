# SECURITY-BASELINE.md — LedgerFrame v2

**Normative.** The security posture, threat model, and privacy guarantees for v2
core. Protected items (the AI validation contract, the Product Guarantees) may
not be weakened. Terms match GLOSSARY.md.

---

## 1. Threat model (D-001)

v2 core is a **single-user, local-first appliance**. The model it defends:

- **Default bind is loopback** (`127.0.0.1`). Out of the box the app is reachable
  only from the same machine.
- **LAN exposure is opt-in and requires a PIN** (D-001/D-002). Binding beyond
  loopback without a PIN drops into a setup/lock state; the first PIN may only be
  set from loopback (first-PIN takeover guard).
- **Internet exposure is out of scope.** v2 core is **not** designed for direct
  internet exposure or multi-user use. No TLS, CSRF tokens, or multi-user
  isolation are built into v2 core (the accepted omissions are enumerated in §2).
- **Sanctioned remote access = VPN / Tailscale** (D-001). Remote use is achieved
  by joining the appliance's private network — where TLS and access control live
  at the network layer — not by exposing the app to the public internet.
- **SaaS/PaaS hardening is a future proprietary layer** (D-001, ADR note). v2 must
  not preclude it but must not build for it. The rebuild "Add for exposure" list
  (TLS + secure cookies, CSRF, shared/durable rate limiting, per-user isolation,
  secret-manager integration) belongs to that layer.

The PIN is an **access lock, not data-at-rest protection** (§3); confidentiality
of the stored ledger relies on **OS disk encryption**.

---

## 2. Gap disposition (D-004)

Each of the 14 audited gaps (07-SECURITY-POSTURE §Gaps) is either **fixed in v2**
or **accepted with rationale** (recorded in an ADR). No gap is left unclassified.

| # | Gap | Disposition | Rationale / where |
|---|-----|-------------|-------------------|
| 1 | No multi-user model | **Accept (ADR)** | Single-user appliance by design (D-001); Entity is ownership metadata, not access control. Multi-user isolation is the future proprietary layer. |
| 2 | Cookie `secure=False` / no in-app TLS | **Accept (ADR)** | Loopback by default; remote access via VPN/Tailscale, where TLS lives at the network layer (D-001). |
| 3 | No CSRF token | **Accept (ADR)** | `samesite=strict` cookie + single-user local model; a dedicated CSRF token is out of scope for v2 core (D-004). |
| 4 | Rate limiter is in-process | **Fix in v2** | **Durable rate-limiter state that survives restart** (D-004). |
| 5 | App writes its own `.env` + runs sudo helper | **Accept (ADR)** | Guardrailed per D-003 (§4): fixed allow-list, write-only keys, `.env` 0600, install-time opt-in. |
| 6 | PIN entropy (numeric) | **Accept (ADR)** | Mitigated per D-002 (§3): min 6 digits, Argon2 + exponential lockout; access-lock posture; passphrase mode is ROADMAP R-1. |
| 7 | No auth on read when no PIN set | **Accept (ADR)** | Deliberate no-PIN-open-local convenience (D-004); LAN exposure requires a PIN; first-PIN-from-loopback guard. |
| 8 | Secrets reachable by the process (no OS keyring) | **Accept (ADR)** | Env-only secrets at `.env` 0600, write-only key API; OS keyring/secret-manager is deferred to the exposure layer (D-004). |
| 9 | AI validator is heuristic | **Accept (ADR)** | Defence-in-depth; posture set by D-070/D-071 — the fallback is a **correct deterministic template**, and the contract may not weaken (§5). |
| 10 | `/system/version-check` egress | **Fix in v2** | Gated by the **no-egress toggle** — zero outbound calls including the version check (D-004/§7). |
| 11 | No tamper-evidence on the audit log | **Fix in v2** | **Hash-chained audit log** (tamper-evidence) (D-004/§8). |
| 12 | Dependency risk / no SBOM-pin-audit | **Fix in v2** | **Dependency pinning + CVE scanning in CI** (D-004/§9). |
| 13 | Restore trusts backup content | **Accept (ADR)** | SHA-256 self-consistency + path-traversal guards + pre-restore safety copy; wholesale trust of a restored DB is accepted (D-004). |
| 14 | CORS credentials in dev | **Fix in v2** | **Assert CORS-credentials cannot ship in production builds** (D-004/§9). |

Fixed in v2: #4, #10, #11, #12, #14 (plus the no-egress toggle as the mechanism
for #10). Accepted-with-ADR: #1, #2, #3, #5, #6, #7, #8, #9, #13.

---

## 3. PIN policy (D-002)

- **Numeric PIN, minimum 6 digits** (D-002; raises the legacy 4-char minimum).
- **Argon2 hashing + exponential lockout** retained (backoff after 5 failures,
  hard 15-min lockout after 10; 429 + `Retry-After`), plus per-token revocation
  and revoke-all on any PIN set/change.
- **The PIN is an access lock, not data-at-rest protection.** It gates access to
  a running instance; it does not encrypt the database. A stolen database file
  with a weak PIN is offline-brute-forceable (Argon2 slows, does not stop).
- **Disk-encryption guidance (normative):** confidentiality of the stored ledger
  relies on **OS disk encryption** (FileVault / LUKS / BitLocker). SECURITY-BASELINE
  and first-run guidance must state this plainly.
- **Purge-PIN never binds to the unlock session (D-103).** The destructive purge
  is the only irreversible action; it **always demands fresh PIN entry**, regardless
  of lock state. An unlocked or ambient session does **not** satisfy the purge PIN —
  there is deliberately **no** purge-PIN→session binding. Rationale: on a wall-mounted
  appliance an unlocked session is ambient, so the point of no return requires a
  deliberate, explicit re-entry rather than ambient session authority. (This is the
  standing resolution of the page-holdings purge-PIN follow-up.)
- **ROADMAP R-1:** optional passphrase mode (8–64 chars) (D-002).

---

## 4. Sudo admin helper & `.env` writes (D-003)

In-app `.env` writes and the sudo admin helper are **kept**, guardrailed:

- **Fixed action allow-list, never free-form shell.** `/system/admin` executes a
  fixed allow-list of actions/args via `sudo -n /usr/local/sbin/ledgerframe-admin`;
  requires auth; 120s timeout.
- **Write-only key API.** API keys are write-only — values are **never readable
  back** (`has_api_key` boolean only); secrets live in `.env` / environment,
  **never the DB**.
- **`.env` is chmod 0600.**
- **Install-time opt-in + graceful degradation.** The sudo helper is a
  **documented install-time opt-in**. When it is absent the app **degrades
  gracefully**: System controls are hidden/disabled with an explanation — no
  errors, no partial privileged actions.

**Action allow-list (exact, extracted).** `_ADMIN_ACTIONS`
(`app/api/v1/routes/system.py:24-36`, legacy v1 source, read-only) is the
complete allow-list — action → permitted argument set (`None` = no argument;
any action or argument not listed is rejected `400` before `sudo` is invoked):

| Action | Allowed arguments |
|--------|-------------------|
| `status` | — (none) |
| `restart` | — (none) |
| `restart-worker` | — (none) |
| `doctor` | — (none) |
| `backup` | — (none) |
| `update` | — (none) |
| `lan` | `on`, `off` |
| `voice` | `on`, `off` |
| `ai` | `on`, `off` |
| `kiosk` | `on`, `off` |

Invocation is `sudo -n /usr/local/sbin/ledgerframe-admin <action> [arg]`
(`system.py:37,565-573`); an unknown action or invalid argument is a `400`, and a
missing binary / missing sudoers rule surfaces an actionable hint rather than a
password prompt. **No free-form input ever reaches the shell.**

---

## 5. AI validation contract (D-071 — normative, protected)

This contract is **normative spec with protected status** (Product Guarantee 7).
**Implementation may improve; the contract may not weaken** (D-071).

The contract, gating **chat, briefing, and instrument explainers alike** via the
single AI pipeline (P-6):

1. **Buffered, never streamed raw.** Model output is buffered server-side and
   validated **before** any of it is displayed; reasoning/`<think>` blocks are
   stripped.
2. **Every significant money/% number must trace to a fact** (matched to a fact
   value; years 1900–2100 exempt). Ungrounded numbers fail.
3. **Unknown tickers rejected** — every ticker-like token must appear in the
   facts or the question (minus a small allow-list).
4. **Recommendation, real-time-claim, and secret-like content rejected** —
   buy/sell/hold language, "real-time/live data" claims, and secret-like strings
   (`sk-…`, `api_key=`, `LEDGERFRAME_*=`, bearer tokens) all hard-fail.
5. **Quoted long strings must be verbatim** — any quoted 25+ char string
   (headline) must appear verbatim in the facts.
6. **Failure → deterministic template.** On any failure the model text is
   **discarded** and a deterministic fact-only answer is shown. Every answer ends
   with the fixed "Information only, not financial advice." disclaimer.
7. **Facts are the only source of numbers.** The AI never computes money and
   never calls providers directly; the deterministic engine is the single source
   (P-1). Facts (source · timestamp · staleness) are shown **before** the answer.

**Visible fallback signal (D-070).** When the answer falls back, the user sees a
**visible signal**: "AI answer didn't pass grounding checks — showing facts
directly." False rejections are the **accepted cost** — the fallback is a correct
deterministic template. **ROADMAP R-12:** revisit strictness only if fallback
frequency proves high in practice.

---

## 6. Ingress/egress symmetry (P-8; D-075 / D-060)

**One sanitised path in, one validated path out; no feature bypasses either.**

- **One sanitised path in (D-075).** Untrusted feed/news text is sanitised
  **once at ingest** (`sanitize_untrusted`: HTML/script strip, injection-phrase
  filtering, length cap) as the worker writes the `market_news` cache — **not
  per-read**. All endpoints (and per-instrument scoped views, P-3) read the
  sanitised cache. There is one cached feed reader; the manual refresh button
  stays.
- **One validated path out (P-6 / §5).** Every AI surface rides the single
  grounded+validated pipeline; **no feature may add a direct model call** and
  none may emit un-validated model text. The Reports "explain this report" helper
  (D-060) and instrument explainers (D-068) ride this pipeline only.

---

## 7. No-egress toggle

When the no-egress toggle is enabled the device makes **zero outbound network
calls** (Product Guarantee 5; D-004/D-066/D-075):

- **Version check + update banner:** suppressed (no outbound HTTPS to GitHub).
- **Feed fetches:** suppressed — the cache is served with **honest staleness
  marking**, never hidden or faked (D-075).
- **All other outbound calls** (quote/FX providers, remote AI base URLs) are not
  made.

**State shown, not merely offered (D-069).** The Settings → Privacy section
displays the **current egress state as a plain statement** — e.g. **"This device
makes no network calls"** when enabled — alongside the toggle, the privacy-mode
indicator, and the "AI never persists" statement.

---

## 8. Positive privacy guarantees

- **AI questions and answers are never persisted (D-016).** The
  `AIConversation`/`AIMessage` tables are dropped; AI chat is ephemeral (Product
  Guarantee 6). Off-device AI transmission happens only via `openai_compatible`
  with a non-loopback base URL and is **surfaced in the UI** (privacy-mode label
  always visible).
- **No telemetry.** LedgerFrame emits no telemetry or analytics.
- **Hash-chained audit log (in scope — D-004 #11).** The `AuditEvent` log
  (auth/mutation/security/system categories; **never secrets**) gains
  **tamper-evidence via a hash chain**.

---

## 9. CI & hardening fixes (D-004 fix list)

- **Dependency pinning + CVE scanning in CI (#12).** Pin versions (incl. the
  external `age` binary) and run CVE scanning in CI; surface an SBOM/pin audit.
- **Durable rate-limiter state (#4).** The unlock and AI rate limiters must
  **survive restart** (no reset-on-restart), so brute-force protection holds
  across process/worker boundaries.
- **CORS-credentials production assertion (#14).** Assert that CORS with
  credentials (dev-only, fixed localhost origins) **cannot ship in production
  builds**.

---

## 10. Export sanitisation (D-050 / P-5)

**All exports are server-side; the client never generates files (P-5).** Holdings
CSV export is merged into a server-side endpoint (`/portfolio/holdings.csv`,
D-050); realised-gains and statements exports are server-side. Every exported
cell inherits **formula-injection sanitisation** (`sanitize_cell`) so a crafted
value cannot become an active spreadsheet formula.

---

## 11. Preserved baseline measures

Carried forward unchanged from the v1 posture (07 §"Notes for rebuild") — the
rebuild must preserve, not regress, these:

- **Env-only secrets**, write-only key API, `.env` 0600.
- **Secret-key enforcement:** a weak/placeholder/<32-char signing secret is a
  warning on loopback and a **hard refusal to start when LAN-exposed**.
- **PIN Argon2 + lockout + token revocation** (§3).
- **Security headers + strict CSP** (`default-src 'self'`, `script-src 'self'`,
  `connect-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, …);
  `/metrics` gated to loopback or a valid session; `security.txt` served.
- **Admin allow-list** (§4); Kite is read-only market data (no order endpoints).
- **Backup encryption (`age`) + path-traversal guards + refuse-overwrite-without-
  force + pre-restore safety copy.**
- **Input validation:** Pydantic on every write; CSV formula-injection sanitise;
  whitelisted manual-holding meta; validated `source_override`; field caps
  (tags ≤16, targets ≤200).
- **Router never-overwrite guarantee:** the active market provider can never
  overwrite a NAV or a canonical-id crypto price with a wrong equity quote
  (05 §A.6; PRODUCT-SPEC "never overwrite NAV"). `ecb_fx` is translation-reference
  only, never a quote (D-074).

---

**Derived from:** `docs/audit/07-SECURITY-POSTURE.md`,
`docs/audit/05-PROVIDERS-AND-ROUTING.md`, and `docs/audit/DECISIONS.md`
Batches 1 and 10. Decision IDs applied: D-001, D-002, D-003, D-004, D-016, D-050,
D-060, D-066, D-068, D-069, D-070, D-071, D-074, D-075, plus P-1, P-5, P-6, P-8
and Product Guarantees 5–7. Gap severities and current-measure detail are from
the audits; dispositions are from D-004. §4 sudo allow-list extracted verbatim
from the legacy v1 source `app/api/v1/routes/system.py:24-36` (read-only) in the
DEF backfill.

## Needs decision

- (none) — the sudo action allow-list is extracted verbatim into §4 from
  `app/api/v1/routes/system.py`. No product decisions outstanding.


---

## Guarantee 5 — the OUTBOUND-CALL INVENTORY (master enforcement record)

*Added 2026-07-14 (release-readiness Part B/2, RD-7). This section is the **authoritative record** of
every outbound transport path and how Guarantee 5 is enforced on it.*

**Guarantee 5 is an absolute:** with no-egress on (`privacy_mode`), the device makes **ZERO** outbound
calls. Not fewer. Not "none that matter". **Zero.**

### It was not being kept (the defect this section exists to close)

`no_egress_enabled` was consulted from the **news, briefing, markets-news and version-check** surfaces
**only**. **Every other outbound path ignored it** — the market price providers, the ECB FX feed, and
both AI providers. Under `privacy_mode` a price refresh, an FX refresh or an AI call **still went out
over the network**.

It *looked* fine because a no-egress user typically also runs `market_provider=mock` — but **that is a
configuration coincidence, not a guard.** A guarantee that holds by accident does not hold.

### The enforcement: ONE choke point, not a sprinkling of checks

`app/core/egress.py` is now **the only way to obtain an HTTP client**. It reads `privacy_mode` and,
when set, **never constructs the client at all** — no socket, no DNS lookup, no timeout to wait out —
raising `EgressBlocked`, which the surrounding services already treat as "no value, and here is why"
(Guarantee 3: withheld, never guessed).

**A guard you must remember to call is a guard you will eventually forget** — which is exactly how six
paths came to ignore this one. So it is **structurally enforced**: constructing an `httpx.AsyncClient`
anywhere outside `app/core/egress.py` is a **test failure**
(`tests/integration/test_egress_guard.py::test_no_module_may_construct_an_http_client_outside_the_egress_gate`).
**A new provider physically cannot forget to ask.**

### The inventory

| Path | Module | Guarded |
|---|---|---|
| Price refresh — Kite | `app/providers/market/kite.py` | ✅ via `egress_client` |
| Price refresh — EODHD | `app/providers/market/eodhd.py` | ✅ |
| Price refresh — Yahoo | `app/providers/market/yahoo.py` | ✅ |
| Price refresh — external/router | `app/providers/market/external.py` | ✅ |
| Crypto prices — CoinGecko | `app/providers/market/coingecko.py` | ✅ |
| Mutual-fund NAV — AMFI | `app/providers/market/amfi.py` | ✅ |
| **FX rates — ECB** | `app/providers/market/ecb.py` | ✅ |
| **AI — OpenAI-compatible** (health · models · **chat**) | `app/providers/ai/openai_compatible.py` | ✅ |
| **AI — Hailo/Ollama** | `app/providers/ai/hailo_ollama.py` | ✅ |
| News feeds | `app/services/feeds.py` | ✅ (was already guarded; now via the same gate) |
| Version check | `app/api/v1/routes/system.py` | ✅ (was already guarded; now via the same gate) |

**One behaviour worth recording:** the AI chat path had a **non-streaming retry** on failure. A
no-egress refusal was hitting it and making a **second** outbound attempt. `EgressBlocked` now
propagates past that retry — **a refusal is not a transient error to retry.**

**Fail-first:** every test in `tests/integration/test_egress_guard.py` was **RED against the unguarded
build with a live provider configured** — the client was constructed and the call went out — and green
only once the gate landed. Tests that were never red would not have been evidence of anything.


---

## Dependency-licence adjudication (release-readiness Gate A8 / RD-2)

**"Clean" means ZERO UNADJUDICATED FINDINGS — it does NOT mean "zero findings".**

The dependency graph (381 packages, full transitive) will always contain licences that need a human
decision. The release gate is not that they are absent; it is that **every one of them carries a
recorded ruling** — who decided, when, and why — in `scripts/license-adjudications.toml`.
**Adjudication is an artifact, not a conversation.**

`scripts/license_audit.py` fails on:
- any flagged/unknown licence with **no recorded ruling**;
- any ruling the owner marked **REJECT**;
- any **STALE** ruling — the package's licence has changed, its version is outside the ruling's range,
  or the package is no longer a dependency at all. *A rubber stamp that outlives what it stamped is
  worse than no stamp: it looks like diligence.*
- any **new platform-conditional family** (declared-but-not-installed packages) without a ruling.

**E4 re-runs this same mechanism against the final public set** — not a re-read of the Gate-A result,
because the final set may differ and a ruling may have gone stale in between.


---

## DISTRIBUTION POSTURE — the same 14 gaps, restated for STRANGERS

**RATIFIED 2026-07-14 (release-readiness Gate B9 / RD-7) — owner stance: DOCUMENT-PLUS-PROMPT.**

### The governing principle

**Privacy, network egress, and exposure are the USER's choice — the platform imposes no posture of its
own.** Its job is to honour the chosen posture faithfully:

- **Some choices are enforced STRUCTURALLY AND ABSOLUTELY.** **No-egress means ZERO outbound calls**,
  enforced at a **single choke point a provider physically cannot bypass** (see *Guarantee 5 — the
  outbound-call inventory*). **This is not weakened by anything below**, and it is not a best-effort
  control.
- **Others are delivered BEST-EFFORT, and say so plainly.** Every row in the table below is one of
  those, and the column exists so that nobody has to guess which kind they are relying on.

**That distinction is the whole point of this section.** A user who thinks a best-effort control is
absolute has been misled by us, even if every individual sentence was true.

**The table above is a PERSONAL-deployment document.** Every "Accept (ADR)" in it is rational for *one
person, on their own loopback, behind their own VPN*. **None of those rationales stop being true when a
stranger installs it — but several of them stop being SAFE ASSUMPTIONS, because they depend on a
deployment we no longer control.**

An ADR that says *"acceptable, because the user will only ever run this on loopback"* is not a mitigation
once we are handing the software to people who will decide that for themselves. **The gap does not
change. Who is carrying the risk does.** That is what this column records.

| # | Gap | Accepted because (personal) | What changes when a STRANGER runs it | Distribution disposition |
|---|---|---|---|---|
| **1** | No multi-user model | "Single-user appliance by design" | **Unchanged, but it must be SAID, not implied.** Someone will otherwise put it on a family NAS and assume the household members are isolated from each other. They are not. | **DOCUMENT, prominently.** README's first section + this file. *"Do not put it on a shared box."* |
| **2** | Cookie `secure=False` / no in-app TLS | "Loopback by default; TLS lives at the network layer" | A stranger who sets `LEDGERFRAME_ALLOW_LAN=true` gets **cleartext session cookies over their LAN**. Our mitigation is *a deployment assumption we cannot enforce*. | **DOCUMENT + WARN AT THE POINT OF CHOICE** — the installer's LAN question is where a person is actually deciding this, so that is where it must be said. |
| **3** | No CSRF token | "`samesite=strict` + single-user local model" | Same assumption, same exposure once LAN is on. | **DOCUMENT.** Revisit if LAN ever becomes the common case. |
| **5** | App writes its own `.env` + runs a sudo helper | "Guardrailed: fixed allow-list, `.env` 0600, install-time opt-in" | **A sudo-capable helper is a very different proposition in software handed to strangers than in one's own appliance.** The guardrails hold; the *trust required to accept them* is now being asked of someone who has not read the code. | **DOCUMENT the exact scope of what the helper may do** — an allow-list nobody can read is not a guardrail, it is a promise. |
| **6** | Numeric PIN entropy | "6+ digits, Argon2, lockout" | Fine on loopback. Thin the moment anyone exposes the port. | **DOCUMENT.** Passphrase mode is ROADMAP R-1. |
| **7** | **No auth on read when no PIN is set** | "Deliberate no-PIN-open-local convenience" | ⚠ **The sharpest one. The default install HAS NO PIN.** A stranger who enables LAN before setting one is serving their entire net worth, unauthenticated, to their network. | **OWNER STANCE — DOCUMENT-PLUS-PROMPT:** (a) the **loopback-only default is documented** plainly; (b) the **install wizard gains an ENCOURAGED, SKIPPABLE set-a-PIN step** — it asks, it recommends, it does not coerce; (c) **LAN access keeps the HARD PIN requirement** — that is not a prompt, it is a gate. *Rationale: the convenience is real and the loopback case genuinely does not need it; what was wrong was that nobody was ever ASKED.* |
| **8** | Secrets reachable by the process (no OS keyring) | "Env-only at `.env` 0600" | Technically unchanged — **but strangers will put real broker API keys in that file**, and they deserve to know exactly what protects them (file permissions, and nothing else). | **DISCLOSE explicitly** in the README's Privacy section: keys live in `.env`, mode 0600, never in the DB, never logged. |
| **9** | AI validator is heuristic | "Defence-in-depth; deterministic fallback" | Unchanged. The fallback is a correct deterministic template, not a guess. | **DOCUMENT.** No change. |
| **13** | Restore trusts backup content | "SHA-256 self-consistency + traversal guards + pre-restore safety copy" | ⚠ **A restore path that trusts its input becomes a supply-chain surface once backups can come from somewhere other than the user's own machine.** | **DOCUMENT + WARN in the restore path**: restore only backups *you* created. Hardening beyond the current guards is a future item, not a v2.0 claim. |

**#4, #10, #11, #12, #14 were FIXED in v2** and need no distribution restatement.
*(#10 — the version-check egress — is now enforced by the same single choke point as every other
outbound call. See **Guarantee 5 — the outbound-call inventory**, above.)*

### What this section is NOT

It is **not** a claim that the product has been hardened for hostile networks. It has not been, and
v2.0 does not say it has. **It is a claim that the posture is written down honestly, including the parts
that are uncomfortable** — so that a stranger can make an informed decision instead of an assumed one.

**The one behavioural change proposed here is gap 7's wizard prompt.** Everything else in this column is
disclosure — which is the correct response to a risk the *user* now owns and we cannot control.

<!-- 🛑 OWNER RATIFIES. The gap-7 prompt is a code change (installer) and must be built + tested
     separately, fail-first, once this posture is ratified. -->
