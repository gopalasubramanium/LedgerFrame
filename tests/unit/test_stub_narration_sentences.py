# SPDX-License-Identifier: AGPL-3.0-or-later
"""§17-2 — A FIXED SENTENCE MAY NOT CITE UI THAT DOES NOT RENDER (owner ruling, 2026-07-20).

The stub narrator's closing line claimed the facts were shown *"as of the timestamps listed
there"*. No timestamps are listed there — the fact list renders label and value, and the as-of is a
`StalenessChip` shown **only when the fact is stale**. The sentence pointed at UI that was not on
screen, in the one screenshot the phase exists to produce.

**The bar is the one we hold the model to.** `app/ai/safety.py` clause 2 rejects a figure that
traces to no fact. This rejects a REFERENT that traces to no rendered element. Same defect —
an unsupported claim — and a fixed sentence is the more dangerous carrier of it, because it ships
in every narration unexamined on the strength of having been written once.
"""

from __future__ import annotations

import pytest

from tests.stub_narration import (
    PHANTOM_REFERENTS,
    STUB_FIXED_SENTENCES,
    STUB_SENTENCE_SPECIMEN_REJECTED,
)


def phantom_referents_in(sentence: str) -> list[str]:
    """Every banned referent this sentence cites. THE checker — the guard and the specimen share it.

    Sharing it is the point: a specimen checked by a second, kinder copy of the rule proves nothing
    about the rule that actually runs.
    """
    low = sentence.lower()
    return sorted(phrase for phrase in PHANTOM_REFERENTS if phrase in low)


# --- The rule ---------------------------------------------------------------------------------- #


@pytest.mark.parametrize("sentence", STUB_FIXED_SENTENCES)
def test_no_fixed_sentence_cites_ui_that_does_not_render(sentence: str) -> None:
    found = phantom_referents_in(sentence)
    assert not found, (
        f"the stub's fixed sentence cites UI that does not render: {found}\n"
        f"  sentence: {sentence!r}\n"
        + "\n".join(f"  {p!r}: {PHANTOM_REFERENTS[p]}" for p in found)
        + "\nA fixed sentence appears in every narration and in the walk evidence. It meets the "
          "same truth bar as served copy (§17-2)."
    )


# --- The specimen, and the pins that keep this from passing on nothing -------------------------- #


def test_the_rejected_specimen_is_still_rejected() -> None:
    """⚑ The owner's actual sentence, kept verbatim, must keep failing.

    A rule with no known-bad input is a rule nobody has watched work — and this milestone has
    already shipped three guards that were green through their own scaffolding rather than through
    the product (§15-4). If the checker is ever loosened into uselessness, this is what reds.
    """
    found = phantom_referents_in(STUB_SENTENCE_SPECIMEN_REJECTED)
    assert "timestamps listed" in found, (
        "THE GUARD HAS GONE BLIND: the sentence the owner rejected at the 3b walk now passes the "
        f"phantom-referent check. specimen={STUB_SENTENCE_SPECIMEN_REJECTED!r}"
    )


def test_the_guard_is_pinned_against_protecting_nothing() -> None:
    """CLAUDE.md: a guard must fail loudly if the thing it protects disappears.

    Both halves can go blind quietly. An emptied `STUB_FIXED_SENTENCES` makes the parametrized
    test above vanish — pytest reports zero cases, not a failure. An emptied `PHANTOM_REFERENTS`
    makes every sentence pass. Neither is visible in a green run without this.
    """
    assert STUB_FIXED_SENTENCES, "no fixed sentences registered — the rule above guards nothing"
    assert PHANTOM_REFERENTS, "no banned referents — the checker accepts everything"


def test_the_closing_sentence_may_still_name_the_facts() -> None:
    """The rule bans phantom referents, NOT reference to the UI.

    Written down because the over-correction is real and worse: a stub forbidden from naming
    anything on screen would say *"These figures come from somewhere"*, which is less honest than
    the sentence being fixed. The fact list DOES render — clause 7 puts it before the answer — so
    pointing at it is a true claim, and the sentence should keep making it.
    """
    from tests.stub_narration import STUB_CLOSING_SENTENCE

    assert "facts shown above" in STUB_CLOSING_SENTENCE
    assert not phantom_referents_in(STUB_CLOSING_SENTENCE)
