# SPDX-License-Identifier: AGPL-3.0-or-later
"""The posture copy is RATIFIED copy, and it is pinned to its ratifying record.

The posture sentence is the one line on the Ask panel that states **what the device is doing**.
`§9 (f)` ruled the approach — *mode-and-consequence, unapologetic; a refusal renders as the
product's posture WORKING, never as an error* — and left the strings **PROPOSED until the 0a
specimen**. The owner ratified them at the 0a walk on **2026-07-20** (ai-surfaces.md §12-3).

**Why this needs a guard at all, when the strings are already in a route.** A posture sentence is
the product making a claim **about itself**, and it is the exact class of string that can go false
without anything failing: nothing computes it, no test asserts on its meaning, and a change that
reads fine — *"AI runs on this device only"* — can describe a state the device is not in. That
already happened once here: §12-3 records the drafted copy saying no-egress meant **no AI answering
at all**, when what shipped still answers, deterministically, from the user's own data. The
difference is invisible to `check:copy` and to every functional test.

This is the **AC-L3 spec↔code parity pattern** the fallback signal uses
(`test_d070_fallback_signal.py`): edit the record and the guard carries the change into the
product; edit the product alone and the guard goes red.

**Pinned against going blind, three ways** — because a parity guard is unusually easy to satisfy
vacuously:
  1. a **coverage** assertion, so a new posture branch cannot ship unratified copy by simply not
     being listed;
  2. a **length floor**, since any document contains the empty string;
  3. a **distinctness** assertion, since one string reused for every posture would satisfy parity
     while making the panel say the same thing in opposite states — which is the failure the
     posture copy exists to prevent.
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

from app.api.v1.routes.ai import POSTURE_COPY, POSTURE_NO_EGRESS

REPO = Path(__file__).resolve().parents[2]
RECORD = REPO / "docs" / "plans" / "ai-surfaces.md"


def _normalise(text: str) -> str:
    """Collapse whitespace so a line-wrapped record quote compares to a one-line constant."""
    return re.sub(r"\s+", " ", text).strip()


def test_every_served_posture_string_appears_in_its_ratifying_record():
    record = _normalise(RECORD.read_text(encoding="utf-8"))
    for key, served in POSTURE_COPY.items():
        assert _normalise(served) in record, (
            f"The posture string served for {key!r} is not in its ratifying record.\n"
            f"  served: {served!r}\n"
            "ai-surfaces.md §12-3 holds the ratified wording. If the posture copy should change, "
            "change it THERE and let this guard carry it — a sentence that reads fine is still "
            "not the one the owner ratified, and this is the surface built to be honest about "
            "what the device is doing."
        )


def test_the_no_egress_string_is_the_one_the_owner_RULED():
    """The no-egress string is called out separately because it was ruled explicitly.

    §12-3 records it as a DIVERGENCE FOUND AT 0a: the drafted copy described no-egress as AI being
    off; the shipped copy describes answers still being built, from the user's data, without
    narration. Both describe zero outbound calls — only one describes what the user gets. The
    owner ratified the shipped one, and it is R-54 tier-1's seed.
    """
    assert "answers are built" in POSTURE_NO_EGRESS and "no AI narration" in POSTURE_NO_EGRESS, (
        f"The no-egress posture string no longer says that answers are STILL BUILT without "
        f"narration.\n  served: {POSTURE_NO_EGRESS!r}\n"
        "Reverting toward 'AI is off' would re-introduce the drafted wording the owner ruled "
        "against at 0a — it is not what the product does under no-egress (§12-3)."
    )


def test_the_posture_branches_are_all_registered():
    """Coverage: every `privacy = …` assignment in the route uses a registered constant.

    Without this, the guard goes blind the moment someone adds a sixth posture branch with an
    inline literal — parity would still pass, because it only checks what is in the dict.
    """
    path = REPO / "app" / "api" / "v1" / "routes" / "ai.py"
    source = path.read_text(encoding="utf-8")

    # PARSED, NOT GREPPED — and this is the second thing this guard got wrong, so both are
    # recorded at the assertion rather than in a commit message nobody re-reads:
    #
    #   1. a regex anchored on `privacy = …` matches the FIRST ELEMENT of a tuple assignment
    #      (`mode, remote, privacy = "deterministic", False, POSTURE_*`) and reports a violation
    #      that is not one;
    #   2. a regex over raw text reads COMMENTS. This function's comments QUOTE a posture sentence
    #      in order to explain why it must not be served — so a text scan flagged the explanation
    #      of the rule as a breach of it. That is `page-help` §9-bis-9(d)'s recorded failure mode
    #      (a guard that reads comments finds "the control exists" corroborated by a comment
    #      saying it does not), and it is why this walks the AST: comments are not in it.
    tree = ast.parse(source)
    func = next(
        n for n in ast.walk(tree)
        if isinstance(n, ast.AsyncFunctionDef | ast.FunctionDef)
        and n.name == "ai_grounding_status"
    )
    # The docstring is excluded BY NODE IDENTITY, not by comparing text: `ast.get_docstring()`
    # returns the cleaned/dedented string while the node holds the raw one, so a `!=` comparison
    # silently fails to exclude it and the function's own docstring reads as inline copy.
    doc_node = None
    if func.body and isinstance(func.body[0], ast.Expr):
        first = func.body[0].value
        if isinstance(first, ast.Constant) and isinstance(first.value, str):
            doc_node = first

    # Short literals here are machine values — mode/provider keys ("local", "deterministic").
    # A sentence shown to a reader is long, so any long literal in this function is inline copy.
    literals = [
        node.value
        for node in ast.walk(func)
        if isinstance(node, ast.Constant)
        and isinstance(node.value, str)
        and len(node.value) > 40
        and node is not doc_node
    ]
    assert not literals, (
        "This function contains an inline sentence instead of a registered POSTURE_* constant:\n"
        + "\n".join(f"  {s!r}" for s in literals)
        + "\nUnratified copy on the posture surface is exactly what §12-3 pins against; add the "
        "constant to POSTURE_COPY and record the wording in ai-surfaces.md §12-3."
    )
    # "Still served" is checked by REFERENCE, not by searching the source text for the sentence:
    # the constants are written as implicitly-concatenated string literals across two lines, so
    # the joined value never appears contiguously in the file and a substring check fails on a
    # constant that is being served perfectly well.
    referenced = {n.id for n in ast.walk(func) if isinstance(n, ast.Name)}

    # ⊕ 2026-07-20 (§15-3, Finding 6). The route no longer names each constant in its own branch:
    # the five-way posture decision moved into `app.ai.vocabulary.resolve_posture()` — shared with
    # `/system/ai-config`, because two surfaces resolving the same fact separately IS Finding 6 —
    # and the route now serves `POSTURE_COPY[posture]`.
    #
    # This check WENT RED on that refactor, correctly: by its old mechanism all five constants had
    # "stopped being served". THE PROPERTY IT GUARDS IS UNCHANGED — a ratified string nothing
    # serves is a record of copy the user cannot see — so the mechanism is re-expressed to follow
    # the serving path rather than relaxed to accept the failure. A constant is served if the
    # route names it directly, OR if it is a value in POSTURE_COPY and the route serves through
    # POSTURE_COPY. The second arm is conditional on that reference precisely so this cannot go
    # blind: stop serving the dict and every constant is unserved again, exactly as before.
    serves_via_dict = "POSTURE_COPY" in referenced
    in_the_dict = {
        node.id
        for node in ast.walk(next(
            n for n in tree.body
            if isinstance(n, ast.Assign)
            and any(isinstance(t, ast.Name) and t.id == "POSTURE_COPY" for t in n.targets)
        ))
        if isinstance(node, ast.Name)
    } if serves_via_dict else set()

    module_constants = {
        t.id
        for node in tree.body
        if isinstance(node, ast.Assign)
        for t in node.targets
        if isinstance(t, ast.Name) and t.id.startswith("POSTURE_") and t.id != "POSTURE_COPY"
    }
    unused = module_constants - referenced - in_the_dict
    assert not unused, (
        f"Ratified posture constants are defined but no longer served by the route: {sorted(unused)}. "
        "A ratified string nothing serves is a record of copy the user cannot see — either the "
        "branch was removed (retire the row in §12-3) or it silently stopped being used."
    )
    assert len(POSTURE_COPY) >= 5, (
        f"POSTURE_COPY has shrunk to {len(POSTURE_COPY)} entries — a posture the product can "
        "serve has lost its ratified record."
    )


# The local pair is ONE user-facing kind, and its two strings are DELIBERATELY IDENTICAL — R-54
# §9-G(2) / item-6a (owner 2026-07-21): *"both local providers are one user-facing kind; locality is
# the promise."* The distinctness assertion below carves them out BY NAME WITH A REASON, and — the
# 0-2b lesson — the exception must red as UNNEEDED the moment the pair diverges, so a hole with a
# reason cannot outlive the reason.
_LOCAL_PAIR = ("local_openai", "local_npu")


def test_the_strings_are_neither_empty_nor_interchangeable():
    """Against going blind: any record contains the empty string, and one string for every posture
    would pass parity while telling the user the same thing in opposite states.

    ⊕ R-54 item-6a: the local pair is exempt from distinctness (declared, above), because it is one
    user-facing kind. Every OTHER pair must still be distinct; the exempt pair must still be
    NON-empty; and the all-same vacuity catch is retained."""
    for key, served in POSTURE_COPY.items():
        assert len(served) > 40, f"{key}: {served!r} is too short to be a posture statement"

    # The exception reds as UNNEEDED if the pair diverges (0-2b: an unnecessary carve-out is worse
    # than none — it is a hole with a reason attached).
    pair_values = {POSTURE_COPY[k] for k in _LOCAL_PAIR}
    assert len(pair_values) == 1, (
        f"the declared local-pair distinctness exception is UNNEEDED: {_LOCAL_PAIR} have DIVERGED "
        f"({sorted(pair_values)!r}). Remove the exception and treat them as ordinary distinct "
        f"postures — item-6a makes them identical only while they are one user-facing kind."
    )

    # Every posture OUTSIDE the exempt pair is distinct from every other and from the pair's string.
    others = {k: v for k, v in POSTURE_COPY.items() if k not in _LOCAL_PAIR}
    distinct = set(others.values()) | pair_values
    assert len(distinct) == len(others) + 1, (
        "Two postures serve the SAME sentence (outside the declared local pair). The panel would "
        "describe opposite states identically, which is the failure posture copy exists to prevent."
    )

    # Vacuity catch (retained): one string reused for EVERY posture would satisfy parity.
    assert len(set(POSTURE_COPY.values())) > 1, (
        "every posture serves one string — parity would be satisfied vacuously"
    )


def test_no_served_posture_string_carries_the_retired_vendor_word():
    """§14-2 / §9-G — 'Hailo' is retired as a USER-FACING word, and the deprecated-term corpus
    extends to ALL served AI copy, not just the Settings tab summary.

    THE FAIL-FIRST: seen RED on `POSTURE_LOCAL_NPU = "On-device (local Hailo/Ollama) — …"`, which
    `test_the_tab_never_shows_the_retired_vendor_word` (the tab summary) never covered — *retiring a
    term without a parity guard is retiring it in ONE place* (§14-2). The recut removes it.

    §11-I boundary (owner 2026-07-21): the corpus is SERVED strings — POSTURE_COPY and the served
    KIND_LABEL. Provider class names (`HailoOllamaProvider`) and internal module docstrings are NOT
    served text and are deliberately out of scope; the `.env` provider id `hailo` also stays."""
    from app.ai.vocabulary import KIND_LABEL

    served_ai_copy = {f"POSTURE_COPY[{k!r}]": v for k, v in POSTURE_COPY.items()}
    served_ai_copy.update({f"KIND_LABEL[{k!r}]": v for k, v in KIND_LABEL.items()})
    for where, text in served_ai_copy.items():
        assert "hailo" not in text.lower(), (
            f"the retired vendor word 'Hailo' is in served AI copy at {where}: {text!r}. "
            f"GLOSSARY's deprecated table gives 'On-device model (Ollama-compatible)' (§14-2)."
        )
    # Blindness pin: the corpus must be non-empty and actually include the posture strings, or a
    # future refactor that empties it makes this guard pass by checking nothing.
    assert len(served_ai_copy) >= len(POSTURE_COPY) >= 5, (
        "the served-AI-copy corpus shrank below the posture set — this guard has gone blind"
    )
