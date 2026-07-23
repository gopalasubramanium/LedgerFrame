# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-63 Phase 5 — the PROVIDER DOCTOR (§9-4 / AC-13 / AC-14).

An ON-DEMAND diagnostic that live-tests each market provider lane with a PUBLIC known symbol
and reports a redacted, per-lane verdict. Never called automatically; never touches a user
holding's value; never returns a key.

Why it exists: this milestone's own root-cause class is a lane that reaches the provider, gets a
200, and parses NO price — a `Quote` with ``price is None``. A refresh silently reads that as
"nothing to do". The doctor forces the question the correctness gates never ask — "does the live
chain actually resolve?" — and a parse-empty lane MUST read as FAIL, never PASS (AC-14).

Guarantees:
* **≤1 egress call per lane per run** (AC-13): each probed lane calls ``get_quote`` at most once;
  every lane carries a ``calls`` count (0 or 1) and the response a ``total_calls``.
* **Respects no-egress** (Commitment 5): with the posture on, ZERO calls are made and every lane
  reads ``skipped_no_egress`` with an honest note — never a silent pass.
* **Redaction** (AC-13): a lane verdict carries ONLY ``lane``, ``needs_key``, ``key_present``,
  ``known_symbol`` (the public probe ticker), ``verdict``, ``calls`` and a short ``note``. Never a
  key, never a holding's price.

⚠ All served copy here is PROPOSED — the owner ratifies it at the 0a look.
"""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.egress import no_egress_enabled
from app.schemas.common import FailureState

log = logging.getLogger(__name__)

# The quote lanes the doctor live-resolves, each with its PUBLIC known probe symbol (PROPOSED —
# owner ratifies at 0a). Scoped to the ``build_provider`` quote lanes only.
_PROBE_SYMBOLS: dict[str, str] = {
    "yahoo": "AAPL",
    "alphavantage": "IBM",
    "eodhd": "AAPL.US",
    "kite": "INFY",
}

# The keyless egress lanes that are NOT ``build_provider``-able yet — LISTED honestly with a
# "proposed" verdict so the response is complete, but never probed this milestone (their live
# probe is proposed for the 0a look). PROPOSED public probe identifiers.
_PROPOSED_LANES: list[tuple[str, str]] = [
    ("coingecko", "bitcoin"),
    ("ecb_fx", "EUR/USD"),
    ("amfi_nav", "120503"),
]

# The redacted note for each typed failure cause on a ``price is None`` probe (§9-2 taxonomy).
_FAIL_NOTES: dict[FailureState, str] = {
    FailureState.EMPTY: "reached, parsed empty (no price)",
    FailureState.PARSE_ERROR: "reached, could not parse the response",
    FailureState.THROTTLED: "reached, rate-limited (throttled) — no price this run",
    FailureState.ERRORED: "could not reach the provider",
    FailureState.UNMAPPED: "reached, but the symbol needs an identifier mapping",
    FailureState.NO_KEY: "no API key for this lane",
    FailureState.UNSUPPORTED: "reached, but this lane cannot price the symbol",
}

_PROPOSED_NOTE = "live probe proposed for the 0a look"
_NO_EGRESS_NOTE = (
    "No-egress is on — the doctor made zero outbound calls, so the live provider chain cannot be "
    "tested. This is the privacy posture working, not a provider failure."
)


def _lane_verdict(
    *, lane: str, needs_key: bool, key_present: bool, known_symbol: str,
    verdict: str, calls: int, note: str,
) -> dict:
    """Build the REDACTED per-lane dict — the ONLY fields a lane may carry (AC-13). No key, no
    holding price ever reaches here: the probe uses a public known symbol and we return a short
    sentence, never the provider response."""
    return {
        "lane": lane, "needs_key": needs_key, "key_present": key_present,
        "known_symbol": known_symbol, "verdict": verdict, "calls": calls, "note": note,
    }


async def run_provider_doctor(session: AsyncSession) -> dict:
    """Live-test each market provider lane once and report a redacted per-lane verdict.

    ON-DEMAND ONLY (never called automatically). Returns an untyped dict (§3b discipline — no
    contract regeneration for a diagnostic dict):

    ``{"no_egress": bool, "total_calls": int, "note": str | None, "lanes": [ ...redacted... ]}``
    """
    # Import inside the function so a test's ``monkeypatch.setattr("app.providers.market.
    # build_provider", ...)`` is picked up (the same pattern the execution net uses).
    from app.providers.market import build_provider
    from app.providers.market.router import capabilities_for

    # Commitment 5 — no-egress: make ZERO calls, and say so honestly (never a silent pass).
    if await no_egress_enabled(session):
        lanes = []
        for lane, sym in _PROBE_SYMBOLS.items():
            needs_key = capabilities_for(lane).needs_key
            lanes.append(_lane_verdict(
                lane=lane, needs_key=needs_key, key_present=False, known_symbol=sym,
                verdict="skipped_no_egress", calls=0, note=_NO_EGRESS_NOTE))
        for lane, sym in _PROPOSED_LANES:
            lanes.append(_lane_verdict(
                lane=lane, needs_key=False, key_present=True, known_symbol=sym,
                verdict="skipped_no_egress", calls=0, note=_NO_EGRESS_NOTE))
        return {"no_egress": True, "total_calls": 0, "note": _NO_EGRESS_NOTE, "lanes": lanes}

    lanes: list[dict] = []
    total_calls = 0

    for lane, symbol in _PROBE_SYMBOLS.items():
        needs_key = capabilities_for(lane).needs_key
        # build_provider returns None for a keyed lane whose credential this instance lacks (the
        # keyed constructors raise without a key, which build_provider swallows to None). That is a
        # reported "no_key", NOT an error — and it means ZERO calls.
        prov = build_provider(lane)
        key_present = (prov is not None) if needs_key else True

        if needs_key and prov is None:
            lanes.append(_lane_verdict(
                lane=lane, needs_key=True, key_present=False, known_symbol=symbol,
                verdict="no_key", calls=0, note="no API key for this lane"))
            continue
        if prov is None:  # a keyless lane that could not be built (dependency missing) — not a key gap
            lanes.append(_lane_verdict(
                lane=lane, needs_key=needs_key, key_present=key_present, known_symbol=symbol,
                verdict="fail", calls=0, note="could not build this lane on this instance"))
            continue

        # The ONE egress call for this lane (AC-13). Any exception is a reach failure, never a raise
        # out of the doctor.
        try:
            q = await prov.get_quote(symbol)
        except Exception as exc:  # noqa: BLE001 — a lane that errors is a FAIL(reach), reported not raised
            total_calls += 1
            log.info("provider-doctor: %s could not reach the provider: %s", lane, exc)
            lanes.append(_lane_verdict(
                lane=lane, needs_key=needs_key, key_present=key_present, known_symbol=symbol,
                verdict="fail", calls=1, note="could not reach the provider"))
            continue
        total_calls += 1

        if q.price is not None:
            lanes.append(_lane_verdict(
                lane=lane, needs_key=needs_key, key_present=key_present, known_symbol=symbol,
                verdict="pass", calls=1, note=f"resolved {symbol}"))
        else:
            # AC-14 — the KEY case: reached, 200, but NO price. This MUST read FAIL, never PASS.
            # Name the typed cause (empty/parse_error/throttled/…), never a flat "none".
            note = _FAIL_NOTES.get(q.failure_state or FailureState.EMPTY,
                                   "reached, parsed empty (no price)")
            lanes.append(_lane_verdict(
                lane=lane, needs_key=needs_key, key_present=key_present, known_symbol=symbol,
                verdict="fail", calls=1, note=note))

    # The keyless-but-not-yet-buildable lanes: listed honestly, never probed this milestone.
    for lane, symbol in _PROPOSED_LANES:
        lanes.append(_lane_verdict(
            lane=lane, needs_key=False, key_present=True, known_symbol=symbol,
            verdict="proposed", calls=0, note=_PROPOSED_NOTE))

    return {"no_egress": False, "total_calls": total_calls, "note": None, "lanes": lanes}
