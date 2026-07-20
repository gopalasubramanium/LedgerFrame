# SPDX-License-Identifier: AGPL-3.0-or-later
"""THE STUB NARRATOR'S FIXED SENTENCES — one home, so they can be guarded.

Owner ruling, AI-surfaces §17-2 (2026-07-20).

WHY A TEST DOUBLE'S COPY IS GUARDED AT ALL
------------------------------------------
Because it reaches the reader. The stub narrator exists so the Ask panel's PRIMARY state — a
grounded, validated, model-narrated answer — can be photographed at all (§12-4); no configured
provider produces one on demand, so the only narrow path through the validator is a double that
re-states the fact pack. **Its sentences are therefore what appears in the walk evidence**, and
walk evidence is what the owner ratifies by looking. A phantom claim in a stub sentence is a
phantom claim in the record of the product.

**THE DEFECT THIS MODULE EXISTS FOR.** The 3a drive's stub ended every narration with:

    "These figures come from the facts shown above, as of the timestamps listed there."

There are no timestamps listed there. The fact list renders a label and a value; the as-of is
carried by a `StalenessChip` that renders **only when the fact is stale** — deliberately, because a
fresh figure has nothing to disclose and a chip on every row would train the reader to ignore all of
them. So on the photographed answer, whose facts were fresh, the sentence pointed at UI that was not
on screen. **A sentence that cites an element the product did not render is the same defect class as
a figure that traces to no fact** — it is an unsupported claim, and the fact that the claim is about
the interface rather than about money does not lower the bar.

⚠ **OUR FIXED SENTENCES MEET THE SAME TRUTH BAR AS SERVED COPY.** The validator (`app/ai/safety.py`)
polices what the MODEL says. Nothing polices what WE hardcode into a model's mouth — and a fixed
sentence is more dangerous than a generated one precisely because it is fixed: it ships in every
narration, in every screenshot, unexamined, because it was written once by someone who was thinking
about something else. `tests/unit/test_stub_narration_sentences.py` is the guard.

THE HARNESS STUB IMPORTS FROM HERE
----------------------------------
The 3a/3b drive stub is a throwaway (built per drive, deleted before staging — §16-D), so a guard
cannot bind it directly. It binds these constants instead, and the drive stub is written to use
them. That is the whole reason this module is committed while the stub that uses it is not: a
throwaway rebuilt each drive is exactly the artefact that re-invents a sentence nobody reviewed.
"""

from __future__ import annotations

#: The stub's closing sentence, appended after it re-states a fact.
#:
#: It may name **the facts** because the fact list renders whenever there are facts to render — it
#: is the section the panel exists to show, and clause 7 puts it before the answer. It names nothing
#: else. Earlier wording added *"as of the timestamps listed there"*; see the module docstring.
STUB_CLOSING_SENTENCE = "These figures come from the facts shown above."

#: Every fixed sentence the stub narrator may emit. The guard iterates THIS, so a new one that
#: forgets to register is caught rather than shipping unreviewed into the walk evidence — the same
#: shape as `POSTURE_COPY` (§12-3) and `PROVENANCE_COPY` (§15-4).
STUB_FIXED_SENTENCES: tuple[str, ...] = (STUB_CLOSING_SENTENCE,)

#: ⚑ THE SPECIMEN — the sentence the owner rejected at the 3b walk, kept verbatim.
#:
#: It is here to be REJECTED by the guard, every run. A rule with no specimen is a rule nobody has
#: watched work: this milestone has already shipped three guards that were green through their own
#: scaffolding (§15-4), and the cheapest protection against a fourth is a known-bad input that must
#: keep failing. If the checker is ever loosened into uselessness, this string goes green and the
#: guard reds on that.
STUB_SENTENCE_SPECIMEN_REJECTED = (
    "These figures come from the facts shown above, as of the timestamps listed there."
)

#: Referents a fixed sentence may NOT point at, each with why it is not on screen to be pointed at.
#:
#: This is a list of PHRASES rather than a cleverer analysis on purpose. The question a reviewer has
#: to answer — *does the panel render this?* — is a fact about the component, not something a
#: matcher can derive, so the reasons are written down and re-checkable against `AskPanel.tsx`
#: rather than inferred.
PHANTOM_REFERENTS: dict[str, str] = {
    "timestamps listed": (
        "the fact list renders label + value only; the as-of is a StalenessChip that renders ONLY "
        "when the fact is stale, so fresh facts show no timestamp at all (AskPanel.tsx FactRow)"
    ),
    "as of the timestamp": "same — no timestamp renders beside a fresh fact",
    "timestamps above": "same",
    "timestamps below": "same",
    "the table above": "the facts are a <ul> list, not a table; no table renders in the panel",
    "the table below": "same",
    "the column": "the fact list has no columns the reader can be pointed at by name",
    "the chart": "the Ask panel renders no chart",
    "the link above": "fact rows carry no links",
    "the link below": "same",
    "the source column": "sources are not rendered beside facts; source is prompt-side metadata",
    "listed sources": "same — the reader is shown no source list",
    "see below": "nothing renders below the answer but the legend and the disclaimer, and a fixed "
                 "sentence must not send the reader to either as if they answered the question",
}
