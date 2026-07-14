# CLA options — a factual memo (release-readiness Gate B2 / RD-2)

**Status: SELECTION MADE (owner, 2026-07-14). The memo below is preserved as the considered options.**

## ✅ OWNER SELECTION — 2026-07-14

| | Selected |
|---|---|
| **Instrument** | **Apache-style ICLA + CCLA** (individual *and* corporate — the pair, not the individual alone) |
| **Enforcement** | **CLA-assistant-style bot**, blocking on PRs |
| **Gate** | **PRE-FIRST-EXTERNAL-MERGE.** Not a release gate — a *contribution* gate. |

**Recorded verbatim, at the owner's instruction:**

> "Counsel deliberately deferred by the owner; the CLA and this selection MUST receive counsel review
> before the first external contribution merges. A CLA cannot be applied retroactively."

**What automation may now do:** fill the standard Apache ICLA/CCLA texts with the project and owner
names. **What it may not do:** author, alter, or ship CLA terms. The filled documents carry a 🛑 **owner
STOP before shipping** — the RD-2 bar stands, narrowed only to mechanical name-filling.

**Why the "cannot be applied retroactively" line is load-bearing:** the moment an outside patch merges
under AGPL alone, that patch is *not* covered, and the D-001 dual-licence path closes for it — not by
anyone's decision, but by default. **The deadline is the first external merge, and it is not moveable.**

---

*(The considered options are preserved below, unchanged.)*

> ⚠ **NO CLA TEXT IS DRAFTED HERE, AND NONE WILL BE.** RD-2 bars automation from drafting or shipping
> CLA text, and that bar **remains in force** under the 2026-07-14 authorship amendment (which converted
> B5/B8/B10 to draft-PROPOSED but **explicitly did not convert B2**).
>
> **Nothing to discard:** no CLA text was ever produced under the earlier instruction. This memo is the
> first artefact Gate B2 has generated, and it is a description of the instruments — not one of them.
>
> ⚖ **This is not legal advice.** It is a factual summary of what these instruments are commonly
> understood to do, assembled so the owner can have a shorter conversation with counsel — not instead
> of one.

---

## Why RD-2 wants one at all

The owner's RD-2 ruling was **AGPL-3.0-or-later + a CLA**, and the CLA is doing specific work there:

**The owner can relicense their *own* code freely — they hold the copyright.** They cannot relicense
*someone else's* contribution. So the moment a third party's patch lands under AGPL, the **D-001 future
proprietary layer** (a hosted/SaaS engine) can no longer include that patch without either their
permission or a rewrite. A CLA is the instrument that keeps that path open **before** the first outside
patch arrives — which is why the timing matters more than the wording.

**The corollary is worth stating plainly:** a CLA asks contributors to give the project something they
do not get back. It is a real cost in goodwill, and some contributors decline on principle. That is a
trade-off, not an oversight, and it belongs to the owner.

---

## The instruments

### 1. CLA — Contributor Licence Agreement (the actual thing RD-2 is asking for)

Two adaptations are standard, and a project that wants one normally needs **both**:

| | Individual CLA | Entity / Corporate CLA |
|---|---|---|
| Signed by | the contributor personally | an authorised signatory of their employer |
| Exists because | the person owns their work | **the employer usually owns work done on their time** — so an individual signature can be worthless if the contributor was employed when they wrote it |
| Typically lists | — | the employees authorised to contribute under it |

**What a CLA typically grants** (varies by instrument — this is the common shape, not a promise about any specific text):

- a **copyright licence** to the project, broad enough to relicense — **this is the clause that
  preserves the dual-licence path**, and it is the entire reason RD-2 asks for one;
- a **patent licence** (and usually a defensive-termination clause);
- **representations**: the contributor actually has the right to contribute this, and it is their work;
- **no transfer of ownership** — the contributor keeps their copyright. *(This is the distinction
  between a **licence** CLA and a **copyright assignment**, which is a heavier instrument the FSF has
  historically used and most modern projects do not.)*

**Two widely-used reference families** (named as reference points, **not** recommendations, and **not**
reproduced here): the **Apache ICLA/CCLA** pair, and the **Linux-Foundation-style** CLA. Counsel will
have a view on which base to start from and what to change.

### 2. DCO — Developer Certificate of Origin ⚠ **NOT a CLA**

**This is the distinction most likely to cost the owner the thing RD-2 is protecting, so it is stated
bluntly:**

The DCO is a **provenance attestation**. A contributor adds `Signed-off-by:` to a commit, certifying
they have the right to submit the code. It is lightweight, developer-friendly, and enforceable by a bot.

**It grants NO relicensing rights.** Contributions under a DCO arrive under the project's **inbound =
outbound** licence — i.e. **AGPL** — and the project gets **no licence to relicense them**.

**A DCO therefore does NOT serve the RD-2 dual-licence intent.** If the DCO is adopted *instead of* a
CLA, the D-001 proprietary path closes for every outside contribution, quietly, the first time one is
merged. **It is not a lighter-weight CLA. It is a different instrument that solves a different problem.**

*(A project can run **both** — DCO for provenance, CLA for rights. Some do.)*

---

## Operational hookup — how signatures are actually collected

| Option | How it works | Costs / notes |
|---|---|---|
| **Bot-enforced on PRs** (e.g. CLA-assistant and its equivalents) | A check blocks the PR until the contributor signs, usually via a GitHub OAuth click. Signatures are recorded (commonly in a repo or a store the project controls). | The default in practice, because it is the only version that **cannot be forgotten**. Adds a third-party app with write access to PR statuses, and a **signature store the owner must be able to produce years later** — that store is the asset, not the bot. |
| **Manual** (email a signed copy; maintainer records it) | The maintainer keeps the register. | Zero tooling. Scales badly and **fails exactly the way unrecorded processes always fail** — the same reason A8's adjudications became a committed file rather than a conversation. |
| **CLA-assistant defaults, as commonly configured** | Signature required once per contributor; re-signature triggered when the CLA text version changes; allow-list for bots/maintainers. | The **re-sign-on-version-change** behaviour is the one to check against counsel's text, since it determines what happens when the CLA is ever amended. |

---

## What the owner decides at this STOP

1. **CLA or DCO or both** — with the DCO's limitation above understood, not assumed away.
2. **Individual only, or individual + entity** — an individual-only CLA is a common gap.
3. **Licence-grant CLA or copyright assignment** — RD-2's intent is served by the former; the latter is
   heavier and less commonly accepted.
4. **Which base text**, and who drafts it. **Not automation** — that bar stands.
5. **Bot-enforced or manual**, and **where the signature register lives**.
6. Whether the CLA lands **before the repository goes public** (RD-10) — *the practical answer is
   usually yes, because a CLA cannot be applied retroactively to a patch that has already been merged
   under AGPL alone.* **This is the item with a deadline attached.**

---

**Selection made 2026-07-14 (see the top of this file). No CLA text exists in this repository, and none
will be AUTHORED by automation — the bar narrows only to mechanically filling the standard Apache
ICLA/CCLA texts with the project and owner names, behind an owner STOP.**

**🛑 COUNSEL REVIEW REMAINS OUTSTANDING, BY THE OWNER'S DELIBERATE CHOICE, AND IT HAS A DEADLINE: THE
FIRST EXTERNAL CONTRIBUTION MERGE.** A CLA cannot be applied retroactively.
