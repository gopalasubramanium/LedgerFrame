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

import asyncio
import logging
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.egress import egress_allowed
from app.providers.market.amfi import chunk_date_ranges, fetch_nav_history
from app.providers.market.coingecko import (
    CRYPTO_HISTORY_FREE_TIER_DAYS,
    clamp_to_free_tier,
    fetch_market_chart_range,
)
from app.providers.market.ecb import fetch_ecb_hist
from app.services.fx_history import ingest_hist
from app.services.ingest_guard import IngestIntegrityError

log = logging.getLogger("ledgerframe")

# F-4: hard wall on the FX download (no stage may spin indefinitely) + the FX staleness ceiling.
ECB_FETCH_TIMEOUT_S = 90
FX_MAX_STALENESS_DAYS = 7
# Hard per-instrument fetch wall for the price-acquisition stages (crypto/fund history).
PRICE_FETCH_TIMEOUT_S = 60

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

    # §12-R3: purge wrong-instrument candles (crypto rows cached from AV's equity endpoint) BEFORE
    # valuing, so the backfill never reads garbage. Idempotent — a second build finds nothing.
    from app.services.market import repair_wrong_class_candles
    purge = await repair_wrong_class_candles(session)

    # ECB per-date FX — one fetch of the MAINTAINED zip (F-4). Hard timeout so no stage can spin
    # indefinitely (the F-4 hang); a stale/corrupt or truncated file is REFUSED (integrity gate),
    # not ingested.
    #
    # §18-R6 (F-7c, confirmed live): this stage's failure skips ONLY ITSELF. It used to `return`
    # here, which silently cancelled the per-instrument price acquisition below — so on a store
    # whose FX was ALREADY FRESH (i.e. the download was not even needed), a refused ECB file left
    # the owner's crypto at "No price history yet" through every rebuild. FX ingest and price
    # acquisition are independent inputs; one refusing must never cancel the other.
    fx: dict = {"dates": 0, "rows": 0}
    fx_error: str | None = None
    fx_skipped = False
    # F-8b — CHECK, THEN SKIP (not download-then-check). The freshness test now PRECEDES the fetch:
    # if this device's stored FX already satisfies the same staleness rule, the download is not
    # needed at all, so it is not made. Previously the stage downloaded the whole ECB archive and
    # only then discovered it had nothing to learn — which also meant an upstream problem with a
    # file we did not need could still produce an alarming error. The stage message says which
    # happened, so "skipped" is never confused with "succeeded".
    if await _stored_fx_is_current(session):
        fx_skipped = True
        log.info("acquire_history: stored FX already fresh — skipping the ECB download (F-8b)")
    else:
        try:
            csv_text = await asyncio.wait_for(fetch_ecb_hist(), timeout=ECB_FETCH_TIMEOUT_S)
            fx = await ingest_hist(session, csv_text, max_staleness_days=FX_MAX_STALENESS_DAYS)
            await session.commit()
        except TimeoutError:  # asyncio.TimeoutError is TimeoutError on 3.11+
            fx_error = "Exchange-rate download timed out."
        except IngestIntegrityError as exc:
            await session.rollback()
            fx_error = (f"Exchange-rate data failed the freshness check — {exc.reason}. Not ingested.")

    # Per-instrument price history — each class routed to the provider that can serve it (§12-R3).
    # Runs on EVERY build, so per-instrument coverage is re-evaluated regardless of FX freshness.
    prices = await acquire_prices(session, base)
    await session.commit()

    log.info("acquire_history: ECB FX %s dates (error: %s); purged %s garbage candle(s); "
             "prices %s (base %s)", fx.get("dates"), fx_error, purge.get("purged"), prices, base)

    if fx_error:
        # The download failed, so whether the build can proceed depends on what the store ALREADY
        # holds — the same freshness rule, one implementation (`assert_fresh`), applied to the
        # stored series instead of the parsed one.
        usable, why = await _stored_fx_is_usable(session)
        if not usable:
            # No honest way to value in base. Refuse the SERIES (never fabricate one) — but the
            # prices above were still acquired, so the next build, once ECB recovers, is complete
            # instead of starting from nothing.
            return {"ok": False, "acquired": False, "fx_error": fx_error, "prices": prices,
                    "purged": purge.get("purged", 0),
                    "message": f"{fx_error} {why} Retry Build history."}
        return {"ok": True, "acquired": True, "fx": fx, "fx_error": fx_error,
                "purged": purge.get("purged", 0), "prices": prices,
                "message": f"{fx_error} Built from the exchange-rate history already on this "
                           "device; prices were still refreshed."}

    if fx_skipped:
        # F-8b: the stage message reflects what actually happened — a skip, not a download.
        return {"ok": True, "acquired": True, "fx": fx, "fx_error": None, "fx_skipped": True,
                "purged": purge.get("purged", 0), "prices": prices,
                "message": "Exchange-rate history already current — download skipped; "
                           "prices were refreshed."}

    return {"ok": True, "acquired": True, "fx": fx, "fx_error": None, "fx_skipped": False,
            "purged": purge.get("purged", 0), "prices": prices,
            "message": f"Exchange-rate history downloaded — {fx.get('dates', 0)} publication days."}


async def _stored_fx_is_current(session: AsyncSession) -> bool:
    """F-8b: do we ALREADY hold today's rates, making the download pure redundant work?

    Deliberately stricter than :func:`_stored_fx_is_usable`. That function answers "can the build
    value from what we have" and tolerates ``FX_MAX_STALENESS_DAYS`` (7) — reusing it as the SKIP
    condition would have skipped the download for up to a week and starved the most recent days of
    rates. The two questions are not the same question, so they do not share a threshold: we skip
    only when there is provably nothing to learn (we hold today's date already). Re-downloading on
    a weekend, when ECB has published nothing new, is harmless; missing a publication is not.
    """
    from app.services import fx_history

    latest = (await fx_history.status(session)).get("latest")
    if not latest:
        return False
    latest_date = latest if isinstance(latest, str) else str(latest)
    return latest_date[:10] == datetime.now(UTC).date().isoformat()


async def _stored_fx_is_usable(session: AsyncSession) -> tuple[bool, str]:
    """§18-R6: can the build value from the FX history ALREADY on this device?

    Applies the SAME staleness rule as the ingest gate (``assert_fresh``, one implementation) to
    the stored series' newest date, so "fresh enough to ingest" and "fresh enough to build from"
    can never drift apart. Returns ``(usable, served_reason)`` — the reason is shown verbatim
    (D-105) when it is not.
    """
    from app.services import fx_history
    from app.services.ingest_guard import assert_fresh

    stored = await fx_history.status(session)
    if not stored.get("rows"):
        return False, "This device holds no exchange-rate history to build from."
    try:
        assert_fresh(stored.get("latest"), now=datetime.now(UTC),
                     max_age_days=FX_MAX_STALENESS_DAYS, source="stored exchange-rate history")
    except IngestIntegrityError as exc:
        return False, f"The exchange-rate history on this device is unusable — {exc.reason}."
    return True, ""


async def _held_instruments(session: AsyncSession) -> list:
    """The distinct instruments the book holds (non-manual, not soft-deleted) — the acquisition set."""
    from app.models import Holding, Instrument

    return (await session.execute(
        select(Instrument).join(Holding, Holding.instrument_id == Instrument.id)
        .where(Holding.deleted_at.is_(None), Instrument.id.isnot(None)).distinct()
    )).scalars().all()


async def _identifier(session: AsyncSession, instrument_id: int, id_type: str) -> str | None:
    from app.models import InstrumentIdentifier

    return (await session.execute(
        select(InstrumentIdentifier.value)
        .where(InstrumentIdentifier.instrument_id == instrument_id,
               InstrumentIdentifier.id_type == id_type)
    )).scalars().first()


async def acquire_prices(session: AsyncSession, base_currency: str | None = None) -> dict:
    """§12 steps 4/5/6: acquire per-instrument price history for the held book, routing each class
    to the provider that can serve it (§12-R3):

      • equity / etf  → the active provider's daily history (Alpha Vantage ``outputsize=full`` for a
        >100-day range = ONE call = the full 20+yr series; the 12h freshness marker prevents a
        refetch within the window). Served via ``get_history_cached`` (the routed, cached path).
      • crypto        → CoinGecko ``market_chart/range`` (never AV — its crypto history is garbage).
      • mutual_fund   → the AMFI history archive in ≤90-day chunks.

    An instrument whose provider mapping cannot be resolved (no coingecko_id / amfi_code) is skipped
    HONESTLY (logged) — never fabricated. A per-instrument failure degrades (logged), never aborts
    the whole build. Returns per-class counts for the served summary."""
    from app.models import Transaction as Txn
    from app.services.amfi import ingest_nav_history
    from app.services.coingecko import ingest_history as ingest_crypto_history
    from app.services.market import get_history_cached

    earliest = (await session.execute(
        select(func.min(Txn.ts)).where(Txn.deleted_at.is_(None), Txn.instrument_id.isnot(None))
    )).scalar()
    if earliest is None:
        return {"equity": 0, "crypto": 0, "mutual_fund": 0, "skipped": 0}
    start = datetime(earliest.year, earliest.month, earliest.day, tzinfo=UTC)
    end = datetime.now(UTC)
    counts = {"equity": 0, "crypto": 0, "mutual_fund": 0, "skipped": 0}

    for instr in await _held_instruments(session):
        ac = instr.asset_class.value if hasattr(instr.asset_class, "value") else str(instr.asset_class or "")
        # F-8: EVERY instrument leaves a recorded outcome. A zero-row acquisition can no longer be
        # silent — whatever happens below, the loop ends by writing ok/rows/reason for this id.
        rows = 0
        source: str | None = None
        reason: str | None = None
        try:
            if ac in ("equity", "etf"):
                # AV outputsize=full is auto-selected for a >100-day range → 1 call/instrument.
                await get_history_cached(session, instr.symbol, "1d", start, end)
                counts["equity"] += 1
                rows, source = await _price_rows(session, instr.id), "active provider"
            elif ac == "crypto":
                source = "coingecko"
                cid = await _identifier(session, instr.id, "coingecko_id")
                if not cid:
                    # §17-R1/R2 (F-6): history acquisition routes by CLASS to CoinGecko — the
                    # quotes-lane source_override (e.g. the owner's dr-27 AV override on BTC/XRP)
                    # never blocks it. Auto-resolve the canonical id at acquisition time, reusing
                    # the ONE linker (top-market-cap disambiguation, §17-R2); an unresolvable symbol
                    # (no match / genuinely ambiguous) is skipped HONESTLY with the served reason.
                    from app.services.market import _link_coingecko_by_symbol
                    link_err = await _link_coingecko_by_symbol(session, instr)
                    if link_err:
                        counts["skipped"] += 1
                        log.info("acquire_prices: %s crypto unmapped — %s", instr.symbol, link_err)
                        await _record_outcome(session, instr.id, ok=False, rows=0, source=source,
                                              reason=link_err)
                        continue
                    cid = await _identifier(session, instr.id, "coingecko_id")
                # F-8a: the request is clamped to CoinGecko's public-API window inside the fetcher;
                # say so when the holding predates it, so a short series is never read as the whole
                # story (the pre-window era stays honestly missing, never fabricated).
                clamped_start, clamped = clamp_to_free_tier(start, end)
                # Pass the CLAMPED start, so the window we request and the window we describe are
                # the same value — they cannot drift into disagreeing. (The fetcher clamps again
                # defensively for any other caller; for this one that is a no-op.)
                chart = await asyncio.wait_for(
                    fetch_market_chart_range(cid, "usd", clamped_start, end),
                    timeout=PRICE_FETCH_TIMEOUT_S)
                rows = await ingest_crypto_history(session, instr.id, chart, verify=True)
                counts["crypto"] += rows
                if clamped:
                    reason = (
                        f"History starts {clamped_start.date().isoformat()} — CoinGecko's public API "
                        f"serves only the past {CRYPTO_HISTORY_FREE_TIER_DAYS} days, so earlier "
                        "holding value is carried, not priced")
            elif ac == "mutual_fund":
                source = "amfi_nav"
                code = await _identifier(session, instr.id, "amfi_code") or (
                    instr.symbol if (instr.symbol or "").isdigit() else None)
                if not code:
                    counts["skipped"] += 1
                    log.info("acquire_prices: %s fund has no amfi_code — skipped (honest)", instr.symbol)
                    await _record_outcome(
                        session, instr.id, ok=False, rows=0, source=source,
                        reason=f"No AMFI scheme mapped for {instr.symbol} — map it, then Build history")
                    continue
                for a, b in chunk_date_ranges(start.date(), end.date()):
                    text = await asyncio.wait_for(fetch_nav_history(a, b), timeout=PRICE_FETCH_TIMEOUT_S)
                    rows += await ingest_nav_history(session, instr.id, str(code), text, verify=True)
                counts["mutual_fund"] += rows
            else:
                counts["skipped"] += 1
                await _record_outcome(
                    session, instr.id, ok=False, rows=0, source=None,
                    reason=f"No price provider supplies {ac or 'this asset'} history")
                continue
        except Exception as exc:  # noqa: BLE001 — one instrument's failure never aborts the build
            counts["skipped"] += 1
            log.warning("acquire_prices: %s (%s) history unavailable — degrading honestly: %s",
                        instr.symbol, ac, exc)
            await _record_outcome(session, instr.id, ok=False, rows=0, source=source,
                                  reason=_served_failure(instr.symbol, source, exc))
            continue

        # A run that fetched nothing is a FAILURE with a reason, never a quiet success (F-8).
        if rows == 0 and ac in ("crypto", "mutual_fund"):
            reason = reason or (
                f"{source or 'The price provider'} returned no history for {instr.symbol} — "
                "nothing was written; retry Build history")
            await _record_outcome(session, instr.id, ok=False, rows=0, source=source, reason=reason)
        else:
            await _record_outcome(session, instr.id, ok=True, rows=rows, source=source, reason=reason)
    return counts


async def _price_rows(session: AsyncSession, instrument_id: int) -> int:
    """Daily candles currently stored for an instrument — used to report a real row count for the
    cached/equity path, which writes through ``get_history_cached`` rather than returning a count."""
    from app.models import PriceHistory

    return int((await session.execute(
        select(func.count()).select_from(PriceHistory)
        .where(PriceHistory.instrument_id == instrument_id, PriceHistory.interval == "1d")
    )).scalar() or 0)


def _served_failure(symbol: str | None, source: str | None, exc: Exception) -> str:
    """Turn a provider exception into a SERVED reason (D-105) that names what actually happened.

    The F-8a case is called out by name because its cause is a provider policy, not a fault: the
    public CoinGecko API refuses a request that reaches past its historical window, and the whole
    request fails (returning nothing rather than less). Anything else is reported honestly as
    unavailable-with-detail rather than dressed up.
    """
    detail = str(exc).strip() or exc.__class__.__name__
    if "10012" in detail or "exceeds the allowed time range" in detail.lower():
        return (f"{source or 'The provider'} refused the requested history window for {symbol} "
                f"(public API limit: {CRYPTO_HISTORY_FREE_TIER_DAYS} days)")
    if isinstance(exc, TimeoutError):
        return f"History fetch for {symbol} timed out — retry Build history"
    return f"History for {symbol} unavailable from {source or 'the provider'} — {detail[:200]}"


async def _record_outcome(session: AsyncSession, instrument_id: int, *, ok: bool, rows: int,
                          source: str | None, reason: str | None) -> None:
    """Upsert this instrument's LAST acquisition outcome (F-8).

    The point is that it is unconditional: the coverage reason and any future diagnostic read
    from here, so "it failed but nothing anywhere says so" stops being reachable."""
    from sqlalchemy.dialects.sqlite import insert as sqlite_insert

    from app.models import InstrumentAcquisition

    values = {"instrument_id": instrument_id, "ts": datetime.now(UTC), "ok": ok, "rows": rows,
              "source": source, "reason": reason}
    stmt = sqlite_insert(InstrumentAcquisition).values(**values)
    stmt = stmt.on_conflict_do_update(
        index_elements=[InstrumentAcquisition.instrument_id],
        set_={k: v for k, v in values.items() if k != "instrument_id"},
    )
    await session.execute(stmt)
    await session.flush()
