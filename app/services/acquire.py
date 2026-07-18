# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-43 §12 — the Build-history ACQUISITION preflight.

Before the backfill reconstructs the net-worth series (``app.services.backfill.run_backfill``),
the inputs it values from must actually exist on-stack. F-1/F-2/F-3 all traced to the same root:
step-6 acquisition never ran, so ``ecb_fx_history`` was empty and ``price_history`` was
sparse/wrong-instrument — and the orchestrator valued a garbage series anyway. This module is the
preflight that acquires those inputs first.

Step 2 acquires the ECB ``eurofxref-hist`` per-date FX (one keyless fetch = the whole daily
reference history back to 1999), ingested idempotently. Later steps grow this preflight with the
per-instrument price acquisition (crypto via CoinGecko, funds via the AMFI archive, equities via AV
``outputsize=full``) behind the class-aware capability gate.

Honesty (Product Guarantee 5): under no-egress this makes **ZERO** outbound calls and returns a
served refusal — building history requires the exchange-rate download; a garbage-from-nothing
series is never fabricated in its place.
"""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.egress import egress_allowed
from app.providers.market.ecb import fetch_ecb_hist
from app.services.fx_history import ingest_hist

log = logging.getLogger("ledgerframe")

# The served refusal shown when no-egress blocks the exchange-rate download (D-105).
NO_EGRESS_MESSAGE = (
    "Building history requires an exchange-rate download — no-egress is on. "
    "The device makes zero outbound calls in this mode (Product Guarantee 5)."
)


async def acquire_history(session: AsyncSession, base_currency: str | None = None) -> dict:
    """Fetch + ingest the historical inputs the backfill values from, BEFORE reconstructing the
    series. Returns a served summary ``{ok, acquired, message, fx?}``.

    ``ok`` is False + ``acquired`` False under no-egress (the honest refusal) — the caller must not
    proceed to value a coverage-poor series. Idempotent: re-running re-ingests in place (the ECB
    upsert), so a warm store is refreshed, not duplicated."""
    settings = get_settings()
    base = (base_currency or settings.base_currency)

    if not await egress_allowed():
        # Guarantee 5 (takes precedence over everything below): never construct a client, never make
        # the call — refuse honestly. Building history requires the exchange-rate download.
        return {"ok": False, "acquired": False, "message": NO_EGRESS_MESSAGE}

    if settings.is_demo:
        # Offline demo posture (mock provider): the demo seed generates ecb_fx_history
        # deterministically (app/seed/demo_history.py) — a real ECB fetch is neither needed nor
        # wanted. Report OK so the build proceeds from the seeded history; acquired=False (no fetch).
        return {"ok": True, "acquired": False,
                "message": "Demo history is generated offline — no download needed."}

    # ECB per-date FX — one fetch = the whole EUR-reference daily history back to 1999.
    csv_text = await fetch_ecb_hist()
    fx = await ingest_hist(session, csv_text)
    await session.commit()
    log.info("acquire_history: ECB FX ingested — %s dates, %s rows (base %s)",
             fx.get("dates"), fx.get("rows"), base)
    return {"ok": True, "acquired": True, "fx": fx,
            "message": f"Exchange-rate history downloaded — {fx.get('dates', 0)} publication days."}
