# SPDX-License-Identifier: AGPL-3.0-or-later
"""Commitment 7's mechanism: the validation contract cannot be quietly weakened.

`PRODUCT-SPEC.md` §3 Commitment 7 — *"**The validation contract never weakens.**
Implementation may improve; the contract that every AI answer is checked against may
not be loosened."* D-071 gives the contract **protected status**, and
`SECURITY-BASELINE.md` §5 states it normatively in **seven numbered clauses**.

**Nothing mechanised "never weakens" (AI-surfaces §9(d-i)).** The 23 existing safety
tests assert the contract **holds** — that a recommendation is rejected, that an
ungrounded figure is rejected. Not one of them would notice a clause being **deleted**:
remove clause 5 from the spec and the code, and every remaining test stays green while
the product quietly checks less than it promises. "Holds" and "has not been loosened"
are different claims, and only the first had a test.

This file asserts the second, in two halves:

**Half 1 — the spec's shape is pinned.** The seven clauses are pinned by **count and
identity** to `SECURITY-BASELINE.md` §5. Deleting a clause, renumbering, or rewriting
one into something weaker fails here. This is the **AC-L3 spec↔code parity pattern**
already proven for the Commitments themselves (`tests/unit/test_legal_content.py`),
applied to the contract.

**Half 2 — each clause still bites.** Identity in a document is not enforcement, so each
clause is bound to a **red specimen**: model output that clause exists to reject. If a
clause survives in the spec while its implementation is loosened, half 1 stays green and
half 2 goes red. The two halves cover each other's blind spot.

Fail-first evidence is **kept, not merely performed** (the page-legal §11-F idiom): the
last test in this file feeds the pin a deliberately-weakened spec and asserts it
*rejects* it, so the guard is proven to bite rather than assumed to.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.ai.grounding import answer_stream
from app.ai.safety import validate_grounded_answer
from app.core.disclaimer import DISCLAIMER
from app.schemas.ai import AIChunk, GroundingFact, HealthStatus

BASELINE = Path(__file__).resolve().parents[2] / "docs" / "specs" / "SECURITY-BASELINE.md"

# The seven clauses, by number and by the bolded lead that names each one. This list IS
# the pin: it is what `SECURITY-BASELINE.md` §5 is compared against. Changing it is
# changing the contract, which D-071 permits only in the strengthening direction and
# never as a side effect of an implementation edit.
CONTRACT_CLAUSES = [
    (1, "Buffered, never streamed raw."),
    (2, "Every significant money/% number must trace to a fact"),
    (3, "Unknown tickers rejected"),
    (4, "Recommendation, real-time-claim, and secret-like content rejected"),
    (5, "Quoted long strings must be verbatim"),
    (6, "Failure → deterministic template."),
    (7, "Facts are the only source of numbers."),
]


def _parse_contract(markdown: str) -> list[tuple[int, str]]:
    """Extract §5's numbered clauses as (number, bolded lead).

    Deliberately strict: it reads the section titled "AI validation contract" and takes
    top-level numbered items whose text opens with a bolded lead. A clause that loses its
    bold lead, or drifts out of the section, is not silently skipped — it simply does not
    parse, and the comparison below reports it.
    """
    section = markdown.split("## 5. AI validation contract", 1)
    if len(section) != 2:
        return []
    body = section[1].split("\n---", 1)[0]
    return [
        (int(num), lead.strip())
        for num, lead in re.findall(r"^(\d+)\.\s+\*\*(.+?)\*\*", body, flags=re.M)
    ]


# ─── half 1: the contract's count and identity are pinned to the spec ───────────

def test_the_contract_has_exactly_seven_clauses_with_the_pinned_identities():
    parsed = _parse_contract(BASELINE.read_text(encoding="utf-8"))
    assert parsed == CONTRACT_CLAUSES, (
        "SECURITY-BASELINE.md §5 no longer matches the pinned validation contract.\n"
        f"  spec:   {parsed}\n"
        f"  pinned: {CONTRACT_CLAUSES}\n\n"
        "Commitment 7 and D-071: the contract may be STRENGTHENED, never loosened, and "
        "never edited as a side effect of an implementation change. If this change is a "
        "deliberate strengthening, update CONTRACT_CLAUSES in the same commit, with the "
        "reason in the commit message. If it is not, it is the thing this guard exists "
        "to stop."
    )


def test_the_pin_is_not_vacuous():
    """A parser that silently matched nothing would make half 1 meaningless."""
    assert len(CONTRACT_CLAUSES) == 7
    assert _parse_contract(BASELINE.read_text(encoding="utf-8")), (
        "The contract section did not parse at all — the pin above compared two empty "
        "lists and passed while asserting nothing."
    )


# ─── half 2: each clause still bites ────────────────────────────────────────────

FACTS = [
    GroundingFact(label="Net worth", value="796,543.93 SGD"),
    GroundingFact(label="AAPL price", value="212.44 USD"),
]

# Model output each clause exists to reject. Clause number → (label, specimen).
RED_SPECIMENS = [
    (2, "an ungrounded figure", "Your holdings are worth 1,234,567.89 SGD today."),
    (3, "an unknown ticker", "TSLA is the standout in your portfolio."),
    (4, "a recommendation", "You should buy more AAPL right now."),
    (4, "a real-time claim", "Here is the real-time live price data for your holdings."),
    (5, "an invented quoted headline", 'The news says "Markets rally as central banks signal a pause".'),
]


@pytest.mark.parametrize(
    "clause,label,specimen", RED_SPECIMENS,
    ids=[f"clause{c}-{label}" for c, label, _ in RED_SPECIMENS],
)
def test_each_contract_clause_still_rejects_its_red_specimen(clause, label, specimen):
    ok, reason = validate_grounded_answer(specimen, FACTS, "how is my portfolio?")
    assert not ok, (
        f"Contract clause {clause} no longer rejects {label}. The clause is still written "
        f"in SECURITY-BASELINE.md §5, so the spec pin stayed green while the implementation "
        f"stopped enforcing it — exactly the weakening Commitment 7 forbids.\n"
        f"  specimen: {specimen!r}"
    )
    assert reason, "a rejection must carry a reason — clause 6 shows it to the user"


def test_a_grounded_answer_still_passes():
    """The specimens above must fail for the RIGHT reason, not because everything fails.

    A validator that rejected all input would satisfy every test above while making the
    product useless. This is the counterweight.
    """
    ok, reason = validate_grounded_answer(
        "Your net worth is 796,543.93 SGD, and AAPL trades at 212.44 USD.",
        FACTS, "how is my portfolio?",
    )
    assert ok, f"a fully grounded answer was rejected ({reason}) — the validator is over-strict"


# ─── half 2, stream-level clauses (1, 6, 7) ─────────────────────────────────────

class _UnsafeProvider:
    name = "openai_compatible"

    async def health(self) -> HealthStatus:
        return HealthStatus(available=True, provider=self.name, models=["m"])

    async def chat(self, request):
        yield AIChunk(delta="You should buy AAPL now — it is at 1,234,567.89 SGD.", done=False)
        yield AIChunk(delta="", done=True)


async def _events(monkeypatch):
    from app.ai import grounding

    async def fake_facts(session, question):
        return list(FACTS)

    monkeypatch.setattr(grounding, "gather_facts", fake_facts)
    monkeypatch.setattr(grounding, "get_ai_provider", lambda: _UnsafeProvider())
    grounding._request_times.clear()
    return [e async for e in answer_stream(None, "how is my portfolio?")]


async def test_clause_1_unsafe_model_text_never_reaches_the_client(monkeypatch):
    events = await _events(monkeypatch)
    streamed = "".join(e["delta"] for e in events if e["type"] == "delta")
    assert "You should buy" not in streamed, (
        "Clause 1: model output must be BUFFERED and validated before any of it is "
        "displayed. Rejected text reached the client."
    )
    assert "1,234,567.89" not in streamed, "Clause 1: a fabricated figure reached the client."


async def test_clause_6_failure_falls_back_to_the_deterministic_template(monkeypatch):
    events = await _events(monkeypatch)
    streamed = "".join(e["delta"] for e in events if e["type"] == "delta")
    done = next(e for e in events if e["type"] == "done")
    assert "Net worth" in streamed, (
        "Clause 6: on failure the model text is discarded and a deterministic fact-only "
        "answer is shown. The facts are not in the fallback."
    )
    assert done["provider"] == "fallback"
    assert done.get("disclaimer") == DISCLAIMER, "Clause 6: every answer ends with the disclaimer."


async def test_clause_7_facts_are_shown_before_the_answer(monkeypatch):
    events = await _events(monkeypatch)
    kinds = [e["type"] for e in events]
    assert "facts" in kinds, "Clause 7: the fact pack must be emitted."
    assert kinds.index("facts") < kinds.index("delta"), (
        "Clause 7: facts are shown BEFORE the answer (the trust-UX ordering in D-067). "
        f"Event order was {kinds}."
    )


# ─── fail-first evidence, kept ──────────────────────────────────────────────────

WEAKENED_SPECS = [
    ("a deleted clause", "\n".join(
        f"{n}. **{lead}** text" for n, lead in CONTRACT_CLAUSES if n != 5)),
    ("a loosened clause", "\n".join(
        f"{n}. **{'Recommendations may pass if hedged' if n == 4 else lead}** text"
        for n, lead in CONTRACT_CLAUSES)),
    ("a renumbered contract", "\n".join(
        f"{i}. **{lead}** text" for i, (_, lead) in enumerate(CONTRACT_CLAUSES, start=2))),
]


@pytest.mark.parametrize("label,body", WEAKENED_SPECS, ids=[s[0] for s in WEAKENED_SPECS])
def test_the_pin_REJECTS_a_weakened_contract(label, body):
    """Proof the pin bites, kept in the suite rather than performed once and discarded.

    A guard nobody has seen fail is a guard nobody knows works. Each specimen is a way
    the contract could be weakened in the spec; the pin must reject all three.
    """
    fake = "## 5. AI validation contract\n\n" + body + "\n\n---\n"
    assert _parse_contract(fake) != CONTRACT_CLAUSES, (
        f"The pin ACCEPTED a weakened contract ({label}). It would not have noticed this "
        "change to SECURITY-BASELINE.md §5, so it is not protecting Commitment 7."
    )


# ─── clause 5's surface, after the fact pack was widened (owner ruling 2026-07-20) ──────────────
#
# Widening `help_facts` to carry `interpret` (Phase 0.9) enlarged `facts_text`, and clause 5
# validates quoted 25+ char strings AGAINST that text. So the set of quotes the validator accepts
# grew — a real change to the contract's effective surface, made deliberately.
#
# Commitment 7 forbids WEAKENING the contract. Widening the FACTS is not weakening the CHECK: the
# rule is unchanged (a long quote must appear verbatim in the facts) and the facts are simply more
# of what the product actually told the model. But "not a weakening" is a claim, and this file's
# whole premise is that claims about the contract get a test. These two specimens hold the line
# from both sides.


def _legal_help_facts():
    from app.ai.tools import help_facts

    facts = help_facts("why do I have to accept terms")
    assert facts, "no help facts retrieved — the specimens below would prove nothing"
    return facts


def test_a_quote_FROM_the_widened_pack_is_accepted():
    """The point of widening: the AI may now quote the ruled interpretation verbatim.

    Before Phase 0.9 this exact sentence was in the corpus, invisible to the model, and quoting it
    would have been rejected as unsupported — the validator correctly refusing text the product
    had never actually shown it.
    """
    facts = _legal_help_facts()
    # Taken VERBATIM from the corpus, and the first draft of this test proves why that matters:
    # it quoted the same sentence with a comma where the source has a colon, and the validator
    # rejected it — correctly. A paraphrase is exactly what clause 5 exists to catch, and the
    # specimen for the accepting half must therefore be copied, never retyped.
    quoted = "Declining is a real answer: it is recorded, and the app stays locked until you accept."
    joined = " ".join(f.value for f in facts)
    assert quoted.lower() in joined.lower(), (
        "the specimen quote is no longer in the widened pack — re-derive it from the corpus "
        "rather than relaxing the test."
    )

    ok, reason = validate_grounded_answer(
        f'The Legal page puts it plainly: "{quoted}"', facts, "why do I have to accept terms",
    )
    assert ok, (
        f"a verbatim quote from the widened fact pack was rejected ({reason}). Widening the pack "
        "is pointless if the validator still treats its contents as unsupported."
    )


def test_a_quote_OUTSIDE_the_widened_pack_is_STILL_REJECTED():
    """THE RED SPECIMEN the ruling asked for. A bigger haystack is not a lower bar.

    The risk of widening is that "supported" quietly becomes easier to satisfy until it means
    nothing. This is an invented sentence in the same register as the real ones, on the same
    subject, in a fact pack that now contains several paragraphs about acceptance — the shape most
    likely to slip through a validator that had gone slack.
    """
    facts = _legal_help_facts()
    invented = "Acceptance is stored on our servers and reviewed by a compliance team"
    joined = " ".join(f.value for f in facts).lower()
    assert invented.lower() not in joined, "the specimen is no longer invented — pick another"

    ok, reason = validate_grounded_answer(
        f'The page says: "{invented}."', facts, "why do I have to accept terms",
    )
    assert not ok, (
        "an INVENTED quotation passed validation against the widened fact pack. Clause 5 requires "
        "a quoted 25+ char string to appear VERBATIM in the facts; a larger pack must not become "
        "a lower bar. This is the weakening Commitment 7 forbids."
    )
    assert reason and "quoted" in reason.lower(), (
        f"rejected, but for the wrong reason ({reason!r}) — clause 5 should be what catches this, "
        "and a specimen that passes for an unrelated reason is not evidence the clause works."
    )
