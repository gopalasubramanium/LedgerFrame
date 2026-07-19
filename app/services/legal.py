# SPDX-License-Identifier: AGPL-3.0-or-later
"""The Legal page's served copy (§ legal).

WHY THIS IS SERVED AND NOT A FRONTEND CONSTANT (page-legal §9-3, owner, 2026-07-19).
Legal is static, never personalised, and needs no database — client constants were a defensible
and cheaper option, and the Settings→About licence line is client-rendered today. **The deciding
question was the guard bar, not the transport.** Accuracy guards bind SERVER-SIDE corpora
(`tests/unit/test_help_content_accuracy.py`), so served copy inherits the same truth bar as Help;
a frontend constant inherits nothing. It also puts the Pack footer string on the same side of the
wire as the Pack, which composes server-side — one source, two renderers, no second code path.

WHAT THIS PAGE OWNS, AND WHAT IT DELIBERATELY DOES NOT (page-legal §9-2 / D-106).
Disclaimers are TWO KINDS of thing and the distinction is load-bearing:

* a **scoped caveat** is served by the reader that owns a figure, sits at the point of use, and is
  **part of the figure** (`tax.py`: *"Open lots by FIFO. Organisation only — not tax advice."*).
  There are ten of them, exports carry them into the file, and **Legal does not own, absorb,
  shorten or centralise any of them**;
* the **product-level position** — no advice, no execution, reporting only — is stated **once**,
  here.

The one-canonical-home rule applies to the second and NOT to the first. **Removing a scoped caveat
is an honesty regression, not a de-duplication** (guarded: AC-L6).

THE NEVER LIST (page-legal §9-8, owner) — binding constraints on every string below, guarded by
AC-L5. This copy never (a) claims compliance with any named jurisdiction's regulation, statute or
tax code — the product has no jurisdiction logic at all, so any such claim is a fabrication;
(b) offers indemnity, warranty or limitation-of-liability terms **beyond what the AGPL already
states** — restating its sections 15/16 in the product's own words risks CONTRADICTING the licence
it ships under, so this page names them and stops; (c) calls itself "secure", "compliant" or
"audited" in the abstract; (d) implies review by counsel.

⚠ EVERY PROSE STRING BELOW IS **PROPOSED**, not ratified. §9-8 bars this CLI from drafting legal
text; what is here is composed from **already-ratified primitives** (the Commitments, the Help
orientation entries, the per-reader disclaimers, D-060's "for your accountant"). The owner
ratifies each string by looking, at the 0a.
"""

from __future__ import annotations

from app.services.help_markup import MARKUP_DIALECT

# ---------------------------------------------------------------------------------------------
# THE SEVEN PRODUCT COMMITMENTS — VERBATIM.
#
# RENAMED 2026-07-20 (owner, page-legal §11-1) from "Product Guarantees": "guarantee" is
# warranty-family vocabulary, and the licence section below states NO WARRANTY. These seven are
# self-enforced behavioural commitments, each one tested. The CLAIMS ARE UNCHANGED.
#
# Rendering source of record: `docs/specs/PRODUCT-SPEC.md` §3, which names this page as its
# destination: *"Destined verbatim for the commitments block, THE LEGAL PAGE, and README"*.
# `DECISIONS.md` is the RATIFYING record and is no longer character-identical to §3 — §3 states
# that relationship precisely, and the apparatus §3 dropped is preserved in its annotation table.
#
# VERBATIM IS ENFORCED, NOT INTENDED: `tests/unit/test_legal_content.py` parses the spec and asserts
# STRING EQUALITY against this tuple (AC-L3). Editing either side alone goes RED. Do not "improve"
# the wording here — amend PRODUCT-SPEC.md and let the guard carry the change across.
#
# Whitespace is the spec's, re-wrapped to single spaces: the source is hard-wrapped at 76 columns
# inside a blockquote, which is a rendering of the sentence, not the sentence. The guard normalises
# both sides identically, so "verbatim" means the same words in the same order — not the same line
# breaks.
#
# THE 0a's TWO ARTEFACTS ARE RESOLVED AT THEIR SOURCE (owner, 2026-07-20, page-legal §11-2).
# The 0a shipped with a dangling cross-reference ("the contract (below, §8)") and with
# `long_term_days` rendering its backticks literally, both flagged rather than edited because
# editing them HERE would have been this CLI overriding a ruling. The owner authorized the edit to
# §3 instead. AC-L3 then carried the cleaned text into this tuple automatically — no hand-edit on
# this side, which is the whole argument for that guard existing. The decision-ID exemption in
# `test_legal_accuracy.py` was DELETED with them, and these seven now meet the full served-copy
# bar unexempted.
# ---------------------------------------------------------------------------------------------
COMMITMENTS: tuple[str, ...] = (
    "**No trades.** LedgerFrame never places or executes trades, and has no mechanism for doing "
    "so. Its market connections are read-only price data.",
    "**No advice.** Never gives buy/sell/hold, tax, or financial advice. Every AI answer ends "
    "with the fixed information-only disclaimer.",
    '**No fabrication.** Never fabricates a price, headline, or figure. Insufficient inputs '
    'produce "—"/None with a reason, never a made-up number.',
    "**No jurisdiction tax logic — ever.** The Long-term threshold is a neutral number of days "
    'you set yourself, with no jurisdiction presets. Statements and Realised P/L outputs are '
    '"for your accountant".',
    "**No egress (opt-in).** With the no-egress toggle enabled the device makes zero outbound "
    "network calls — version check, feeds, and banner included.",
    "**No stored AI conversations.** AI questions and answers are never persisted.",
    "**The validation contract never weakens.** Implementation may improve; the contract that "
    "every AI answer is checked against may not be loosened.",
)

# ---------------------------------------------------------------------------------------------
# THE PRODUCT-LEVEL POSITION — the one thing this page owns that no other surface states.
#
# Composed from ratified primitives, not authored fresh:
#   * "It reports; it does not act."      — help.py `orientation-what`, a ratified voice specimen
#   * the three no-* clauses              — Commitments 1, 2, 3
#   * "a dash and a reason"               — help.py `orientation-how`
#   * "reporting only" / "organisation"   — accounts.py:103 / tax.py:424, the scoped caveats' own
#                                            wording, generalised to the product level
# ---------------------------------------------------------------------------------------------
# ---------------------------------------------------------------------------------------------
# THE FORMAL REGISTER (page-legal §11-4, owner, 2026-07-20).
#
# The owner read the 0a and ruled that this page must READ AS A FORMAL AGREEMENT: numbered clauses
# and sub-clauses, defined-term capitals, bold/italic conventions.
#
# **REGISTER CHANGES DRESS, NEVER CLAIMS.** That is the ruling's own wording and it is the
# constraint that matters: AC-L5 (the NEVER list), AC-L6 (the scoped-caveat registry), AC-L7 (the
# accuracy corpus, markup-stripped) and AC-L8 (the Pack footer) all still bind, unchanged and
# unrelaxed. A document that acquired gravitas and lost a guard would be the exact failure this
# page exists to prevent.
#
# TWO BUILD DECISIONS, BOTH PROPOSED UNTIL THE OWNER'S RE-LOOK:
#
# 1. **NUMBERING IS STRUCTURAL, NEVER TYPED.** No clause number appears in any string below. The
#    renderer derives "2.1.a" from position — article index, clause index, item index. Typed
#    numbers are how formal documents rot: insert a clause at 2.1 and every later number in every
#    cross-reference is silently wrong, and nothing can detect it because the numbers are prose.
#    Deriving them makes renumbering free and makes a wrong number impossible rather than unlikely.
#
# 2. **DEFINED TERMS NEED NO MARKUP CONSTRUCT.** They are Capitalised in the text itself — the
#    Platform, the Commitments, the Licence — and defined once in the preamble. This was checked
#    against the alternative (a new inline marker in the sanctioned subset) and rejected: the
#    subset stays at five constructs, `validate_markup` needs no new arm, and — decisively — the
#    accuracy guards read `strip_markup` output, so a new inline marker would be one more way for a
#    phrase to be split and a guard to go quietly green on copy it exists to catch.
#
#    **THE SUBSET IS THEREFORE UNCHANGED, AND `MARKUP_DIALECT` IS NOT BUMPED.** The contract change
#    in this delta is the SHAPE of the served content (bodies become clauses), not the dialect.
# ---------------------------------------------------------------------------------------------

# The preamble is register apparatus, NOT a seventh content: it introduces no claim and states no
# limit, it only fixes what the document's capitalised words refer to. The six contents the IA
# fixes are unchanged and are the six articles below.
_PREAMBLE = (
    "This page states the terms on which you have LedgerFrame, and what it undertakes never to "
    "do. In this document **the Platform** means LedgerFrame, the software running on this "
    "device; **the Licence** means the licence named in Article 3; **the Commitments** means the "
    "seven undertakings set out in Article 5; and **you** means the person operating this "
    "installation.\n"
    "\n"
    "*The Platform is operated by you, on your own device, on your own data. There is no other "
    "party to this document.*"
)

_POSITION_CLAUSES: tuple[dict, ...] = (
    {"text": "The Platform **reports; it does not act.**"},
    {"text": "Specifically, and without qualification:",
     "items": (
         "It **never places or executes trades**, and has no mechanism for doing so — the "
         "capability was never built into it.",
         "It **never gives buy, sell or hold recommendations**, and never gives tax or financial "
         "advice. Nothing it shows you is a recommendation, and nothing it shows you is a "
         "forecast.",
         "It **never fabricates a price, headline or figure**. Where a value cannot be "
         "established it shows a dash and a reason rather than a guess.",
     )},
    {"text": "Every figure the Platform shows is a record of what you entered and what the "
             "sources you configured returned — **organisation and reporting only**."},
    {"text": "What you do with that record is your decision, taken with whatever professional "
             "advice you choose to seek. The Platform does not participate in that decision."},
)

# The general position does NOT replace the scoped caveats — this article exists so that a reader
# who arrives here first is told where the real limits live, and so that a future reviewer reading
# "one canonical home" does not delete twenty-five of them (D-106).
_SCOPED_CLAUSES: tuple[dict, ...] = (
    {"text": "Individual figures carry their own limits, stated **where the figure is shown**."},
    {"text": "Those limits are **part of the figure**, and not a copy of anything on this page:",
     "items": (
         "each says what that particular number **is and is not**, in the place you read it;",
         "exports and the Reports Pack **carry them into the file**, so a figure never travels "
         "without the limit it was published under.",
     )},
    {"text": "This page states the Platform's position at the level of the product. It **does "
             "not restate, replace or shorten** the limit on any individual figure, and the limit "
             "on an individual figure is never satisfied by this page."},
)

_LICENCE_CLAUSES: tuple[dict, ...] = (
    {"text": "The Platform is released under the **AGPL-3.0-or-later** Licence. Your rights to "
             "use, study, modify and redistribute it are the rights that Licence grants, and it "
             "grants them in its own words."},
    {"text": "**The warranty and liability position is the one stated in the Licence itself, at "
             "its sections 15 and 16.** This page does **not** restate that position in other "
             "words, and nothing on this page adds to it, narrows it, or interprets it. A "
             "paraphrase that drifted would contradict the Licence the Platform actually ships "
             "under, and the Licence would govern."},
    {"text": "The Platform is built on open-source software. The full dependency and licence "
             "record, the third-party notices, and the provenance of every vendored asset are "
             "**generated and ship with the source**. They are not reproduced here, because a "
             "copy of a generated file is stale the moment that file regenerates. Article 6 says "
             "where each one is."},
)

_JURISDICTION_CLAUSES: tuple[dict, ...] = (
    {"text": "The Platform contains **no tax logic for any country, and never will.**"},
    {"text": "It holds none of the following, for anywhere:",
     "items": (
         "rates;",
         "thresholds;",
         "residency rules;",
         "filing calendars.",
     )},
    {"text": "The Long-term threshold is a neutral number of days **you set yourself**, with no "
             "jurisdiction presets. The Platform does not know where you are and never assumes "
             "which rules apply to you."},
    {"text": "Statements and Realised P/L are prepared **for your accountant**, who knows both "
             "your circumstances and your jurisdiction. They are an organised record of what "
             "happened — **not a tax computation, and not a filing.**"},
)

# ---------------------------------------------------------------------------------------------
# THE POINTERS (page-legal §9-5, owner).
#
# "Pointer" here means: NAMES THE FILE THAT SHIPS WITH THE SOURCE. Never a URL — a local-first
# product cannot link to a hosted licence page, and a URL would be the one thing on this page that
# stops working offline. Legal reproduces none of these files (§9-5): three of the four are
# GENERATED, and `LICENSES.md` says of itself *"This file reports; it does not adjudicate"*.
# ---------------------------------------------------------------------------------------------
# 9-5-bis AMENDS THE "NEVER A URL" RULE (owner, 2026-07-20, page-legal §11-3) — narrowly.
#
# The shipped file REMAINS CANONICAL. What is now permitted is a CONVENIENCE link to an external
# authoritative text, and the three conditions are the whole of the amendment:
#   * it is MARKED as a convenience, in the served copy, so no reader mistakes it for the source;
#   * it carries rel="noreferrer noopener" (applied by the renderer, guarded in Legal.test.tsx);
#   * it is NEVER LOAD-BEARING — this page must remain complete and true with every link dead.
#
# That last condition is the one with teeth, and it is why `url` is OPTIONAL and separate from
# `file` rather than replacing it. A reader offline, or running with no-egress on, sees the file
# name and the description and loses nothing but a shortcut. Test the amendment by deleting every
# url: the page must still say everything it says now.
#
# NOTE FOR THE RE-LOOK: a convenience link is an EGRESS AFFORDANCE on a local-first product. It
# does not itself make a call — nothing is fetched, prefetched or preconnected, and the anchor is
# inert until the reader clicks it — but clicking it does leave the device. Flagged rather than
# assumed to be fine.
_POINTERS: tuple[dict, ...] = (
    {"file": "LICENSE",
     "what": "The full text of the GNU Affero General Public License, version 3, exactly as the "
             "Platform ships it. This file is the Licence; anything else is a convenience.",
     "url": "https://www.gnu.org/licenses/agpl-3.0.html"},
    {"file": "NOTICE", "what": "Third-party notices. Generated."},
    {"file": "docs/audit/LICENSES.md",
     "what": "The licence of every dependency, with its full transitive graph. Generated."},
    {"file": "docs/audit/ASSETS.md",
     "what": "Where each vendored asset came from and under what terms."},
)

# ---------------------------------------------------------------------------------------------
# THE REPORTS PACK FOOTER (page-legal §9-4, owner; D-038 lane).
#
# ONE product-level line, and the Pack renders THIS STRING — not a copy of it. One source, two
# renderers; `test_reports_pack_footer.py` asserts byte-for-byte equality with what Legal serves
# (AC-L8), so the two can never drift.
#
# The seven Commitments deliberately DO NOT go into the Pack: they are a page, not a report footer,
# and would bloat every print artifact. The Pack's per-reader disclaimers and its reporting-only
# fallback caption are UNCHANGED by this — the footer is an addition, never a replacement.
# ---------------------------------------------------------------------------------------------
PACK_FOOTER = (
    "Reporting only. LedgerFrame does not give financial, tax or investment advice and does not "
    "place trades. Figures are a record of what was entered and what the configured sources "
    "returned."
)

# THE SIX ARTICLES — the IA's four contents plus the two the 0a added and justified (the
# per-figure limits, which is D-106 stated to the reader, and the pointer list, which is §9-5's).
# Order is served, and the ARTICLE NUMBER IS THE INDEX: the renderer never reorders.
_SECTIONS: tuple[dict, ...] = (
    {"id": "position", "title": "The Platform's Position", "clauses": _POSITION_CLAUSES},
    {"id": "scoped-caveats", "title": "Limits Stated With Each Figure",
     "clauses": _SCOPED_CLAUSES},
    {"id": "licence", "title": "Licence", "clauses": _LICENCE_CLAUSES},
    {"id": "jurisdiction", "title": "No Jurisdiction Tax Logic", "clauses": _JURISDICTION_CLAUSES},
)

COMMITMENTS_TITLE = "Product Commitments"
COMMITMENTS_INTRO = (
    "The seven Commitments are what the Platform will never do. They are **not aspirations**, and "
    "**not a policy that could be revised for convenience** — each is a decision on the record, "
    "each is enforced by a test, and the wording below is reproduced **verbatim** from the "
    "specification that fixes it.\n"
    "\n"
    "*They are called Commitments and not guarantees deliberately: the Licence's warranty "
    "position, at Article 3, is that there is no warranty. These seven are undertakings the "
    "Platform enforces against itself, and the Platform will not borrow warranty language it "
    "cannot honour.*"
)


def all_legal() -> dict:
    """The whole Legal page, WITH markup — the page is this response's only consumer.

    Declares its markup dialect for the same reason `all_help()` does (§9-bis-11(b)): a consumer
    receiving `body` otherwise has no way to know the string carries markers rather than literal
    asterisks, and versioning it makes a future change to the sanctioned subset a VISIBLE contract
    change instead of a silent reinterpretation of the same strings.
    """
    return {
        "markup": MARKUP_DIALECT,
        "preamble": _PREAMBLE,
        "sections": [
            {"id": s["id"], "title": s["title"],
             "clauses": [{"text": c["text"], "items": list(c.get("items", ()))}
                         for c in s["clauses"]]}
            for s in _SECTIONS
        ],
        "commitments": {
            "title": COMMITMENTS_TITLE,
            "intro": COMMITMENTS_INTRO,
            "items": list(COMMITMENTS),
        },
        "pointers": [dict(p) for p in _POINTERS],
        "pack_footer": PACK_FOOTER,
    }


# =============================================================================================
# THE ACCEPTANCE GATE (page-legal §11-5, owner, 2026-07-20)
# =============================================================================================
#
# WHAT IS BEING RECORDED. Not "the user clicked a box" but "this person was shown THIS TEXT and
# answered". Those are different facts, and only the second is worth storing: a consent record
# that cannot say what was consented to is not a record, it is a reassurance.
#
# WHY THE HASH IS OVER THE SERVED CONTENT AND NOTHING ELSE. `content_hash()` digests exactly what
# `all_legal()` returns — every clause, every sub-clause, the Commitments, the pointers, the
# preamble. So:
#   * reword one sub-clause and the hash moves, and every install is asked again;
#   * change a code comment, a CSS rule or a test and it does NOT move, because none of that is
#     the document.
# The alternative — hashing a hand-maintained "legal version" constant — was rejected: it is a
# number someone has to remember to bump, and the failure mode is silent and one-directional
# (text changes, version doesn't, users are held to terms they were never shown).
#
# ⚠ A CONSEQUENCE, STATED PLAINLY RATHER THAN DISCOVERED LATER: because the hash covers the whole
# served document, ANY edit to this file's copy — including a typo fix — re-locks every install
# until the user accepts again. That is the honest behaviour for a consent record and it is also
# a real operational cost. It is flagged for the owner at the re-look as a PROPOSED item: the
# alternative (a curated "material change" flag) trades that cost for a judgement call about
# which edits matter, made by whoever is editing.

_ACCEPTANCE_ACTIONS = ("accepted", "declined")


def content_hash() -> str:
    """The sha256 an acceptance binds to: a digest of the served document, and only that.

    Serialised with `sort_keys` and a fixed separator so the digest is a function of the CONTENT
    and not of dict ordering — otherwise a Python version or a field reorder would silently
    re-lock every install without a word of the document having changed.
    """
    import hashlib
    import json

    payload = json.dumps(all_legal(), sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


# The gate's own copy. PROPOSED (§9-8 bars this CLI from drafting legal text) and it is the most
# consequential string in the product: it is what the user is recorded as having agreed to. It
# names exactly what is being accepted and nothing more, and it does NOT thank, reassure, or
# describe the act as a formality.
ACCEPTANCE_PROMPT = (
    "I have read the Legal page, and I accept the licence terms and the product position set out "
    "there."
)
ACCEPTANCE_EXPLAINER = (
    "LedgerFrame reports; it does not give advice and does not act. It is released under the "
    "AGPL-3.0-or-later licence, whose warranty position is stated in the licence itself. You can "
    "read the full document before answering — Legal opens without accepting anything."
)
ACCEPTANCE_STALE_NOTE = (
    "The Legal page has changed since you last accepted it. Please read it again and answer "
    "again — an earlier answer covered the earlier text, and cannot stand in for this one."
)
ACCEPTANCE_DECLINED_NOTE = (
    "You declined. Your answer is recorded and nothing has been deleted. LedgerFrame stays locked "
    "until the terms are accepted; you can read Legal at any time, or close the app."
)
# The reading-return bar (DESIGN-SYSTEM §5.1(3)) — shown only while the gate has stood down so its
# own document can be read. SERVED, not authored in the shell, by the ruling at page-legal §11-K:
# the first string is a CLAIM ABOUT THE ACCEPTANCE RECORD, not chrome, and a claim that lives in a
# .tsx file is one the accuracy corpus cannot reach. The second is the way back, and it names the
# act it returns to — never "Close" or "Back", which would describe leaving rather than answering.
ACCEPTANCE_READING_NOTE = "You are reading the Legal page. Nothing has been accepted yet."
ACCEPTANCE_READING_RETURN = "Return to accept"


async def acceptance_status(session) -> dict:
    """Where this install stands: the current hash, and whether a live acceptance covers it.

    THREE STATES, NOT TWO, and the third is the one a boolean would lose:
      * ``accepted``  — the newest event is an acceptance OF THE CURRENT HASH;
      * ``stale``     — an acceptance exists, but of an EARLIER text. The user is not a stranger
                        and should not be greeted as one; the gate says the document changed;
      * ``none``      — no answer has ever been recorded (a fresh install), or the newest answer
                        was a decline.

    "Newest event wins" is deliberate. A decline after an acceptance re-locks, which is what makes
    a decline meaningful rather than decorative — a user who changes their mind must be able to.
    """
    from sqlalchemy import select

    from app.models import LegalAcceptanceEvent

    current = content_hash()
    rows = (await session.execute(
        select(LegalAcceptanceEvent).order_by(LegalAcceptanceEvent.id.desc()).limit(1)
    )).scalars().all()

    if not rows:
        return {"status": "none", "content_sha256": current, "accepted_at": None}
    latest = rows[0]
    if latest.action != "accepted":
        return {"status": "none", "content_sha256": current, "accepted_at": None}
    if latest.content_sha256 != current:
        return {"status": "stale", "content_sha256": current, "accepted_at": None}
    return {
        "status": "accepted",
        "content_sha256": current,
        "accepted_at": latest.ts.isoformat() if latest.ts else None,
    }


async def is_accepted(session) -> bool:
    """The one question the server-side gate asks. Kept separate so the gate cannot accidentally
    treat ``stale`` as acceptable by reading a truthy dict."""
    return (await acceptance_status(session))["status"] == "accepted"


async def record_acceptance(session, action: str) -> dict:
    """Append one event. Never updates, never deletes — see the model's note on why.

    The hash is taken HERE, server-side, and never accepted from the client. A client-supplied
    hash would let a caller record acceptance of a document that was never served.
    """
    from app.models import LegalAcceptanceEvent

    if action not in _ACCEPTANCE_ACTIONS:
        raise ValueError(f"action must be one of {_ACCEPTANCE_ACTIONS}, got {action!r}")
    session.add(LegalAcceptanceEvent(action=action, content_sha256=content_hash()))
    await session.commit()
    return await acceptance_status(session)
