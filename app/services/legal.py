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
_POSITION = (
    "LedgerFrame reports; **it does not act**.\n"
    "\n"
    "- It never places or executes trades, and has no mechanism for doing so — the capability was "
    "never built into the product.\n"
    "- It never gives buy/sell/hold, tax, or financial advice. Nothing it shows you is a "
    "recommendation, and nothing it shows you is a forecast.\n"
    "- It never fabricates a price, headline, or figure. Where a value cannot be established it "
    "shows a dash and a reason rather than a guess.\n"
    "\n"
    "Every figure here is a record of what you entered and what the sources you configured "
    "returned — **organisation and reporting only**. What you do with it is your decision, taken "
    "with whatever professional advice you choose to seek."
)

# The general position does NOT replace the scoped caveats — this paragraph exists so that a
# reader who arrives here first is told where the real limits live, and so that a future reviewer
# reading "one canonical home" does not delete ten of them (D-106).
_SCOPED = (
    "Individual figures carry their own limits, stated where the figure is shown.\n"
    "\n"
    "- Those notes are **part of the figure**, not a copy of this page: they say what that "
    "particular number is and is not, in the place you read it.\n"
    "- Exports and the Reports Pack carry them into the file, so a figure never travels without "
    "the limit it was published under.\n"
    "- This page states the product's position. It does not restate, replace or shorten them."
)

_LICENCE = (
    "LedgerFrame is released under the **AGPL-3.0-or-later** licence, and your rights to use, "
    "study, modify and redistribute it are the ones that licence grants.\n"
    "\n"
    "The warranty and liability position is the one stated in the licence itself, in its sections "
    "15 and 16. **This page does not restate it in other words** — a paraphrase that drifted "
    "would contradict the licence the product actually ships under.\n"
    "\n"
    "LedgerFrame is built on open-source software. The full dependency and licence record, the "
    "third-party notices, and the provenance of every vendored asset are **generated and ship "
    "with the source**; they are not reproduced here, because a copy of a generated file goes "
    "stale the moment the file regenerates."
)

_JURISDICTION = (
    "LedgerFrame contains **no tax logic for any country, and never will**.\n"
    "\n"
    "- It holds no rates, no thresholds, no residency rules and no filing calendars for anywhere.\n"
    "- `long_term_days` is a neutral threshold **you set yourself**, with no jurisdiction "
    "presets — the product does not know where you are and never assumes which rules apply "
    "to you.\n"
    "- Statements and Realised P/L are prepared **for your accountant**, who knows both. They "
    "are an organised record of what happened, not a tax computation and not a filing."
)

# ---------------------------------------------------------------------------------------------
# THE POINTERS (page-legal §9-5, owner).
#
# "Pointer" here means: NAMES THE FILE THAT SHIPS WITH THE SOURCE. Never a URL — a local-first
# product cannot link to a hosted licence page, and a URL would be the one thing on this page that
# stops working offline. Legal reproduces none of these files (§9-5): three of the four are
# GENERATED, and `LICENSES.md` says of itself *"This file reports; it does not adjudicate"*.
# ---------------------------------------------------------------------------------------------
_POINTERS: tuple[tuple[str, str], ...] = (
    ("LICENSE", "The full text of the GNU Affero General Public License, version 3."),
    ("NOTICE", "Third-party notices. Generated."),
    ("docs/audit/LICENSES.md", "The licence of every dependency, with its full transitive "
                               "graph. Generated."),
    ("docs/audit/ASSETS.md", "Where each vendored asset came from and under what terms."),
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

_SECTIONS: tuple[dict, ...] = (
    {"id": "position", "title": "Disclaimer", "body": _POSITION},
    {"id": "scoped-caveats", "title": "The limits on each figure", "body": _SCOPED},
    {"id": "licence", "title": "Licence", "body": _LICENCE},
    {"id": "jurisdiction", "title": "No jurisdiction tax logic", "body": _JURISDICTION},
)

COMMITMENTS_TITLE = "Product Commitments"
COMMITMENTS_INTRO = (
    "These seven are what the product will never do. They are not aspirations and not a policy "
    "that could be revised for convenience — each one is a decision on the record, and the "
    "wording below is reproduced **verbatim** from the specification that fixes it."
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
        "sections": [dict(s) for s in _SECTIONS],
        "commitments": {
            "title": COMMITMENTS_TITLE,
            "intro": COMMITMENTS_INTRO,
            "items": list(COMMITMENTS),
        },
        "pointers": [{"file": f, "what": w} for f, w in _POINTERS],
        "pack_footer": PACK_FOOTER,
    }
