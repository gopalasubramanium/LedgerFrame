# SPDX-License-Identifier: AGPL-3.0-or-later
"""Review feed (Phase 4b) — a derived 'what needs a look' list.

Computed live from signals already built: policy drift & concentration (Phase 1),
data confidence & staleness (Phase 2a), liquidity (Phase 3a), goals & obligations
(Phase 3b), and the runway (Phase 4a). No new data, no schema. It surfaces *facts that
merit review* — never "you should…", never a projection, never advice.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.services.confidence import score_holding
from app.services.insurance import _INSURANCE_SOON_DAYS as _INSURANCE_SOON_DAYS_INS
from app.services.liquidity import liquidity_ladder
from app.services.planning import _parse_date, goals_report, obligations_report
from app.services.policy import compute_drift
from app.services.portfolio import value_portfolio
from app.services.runway import runway_report

_LIQUID_THIN_PCT = 15.0
_GOAL_SOON_DAYS = 180           # D-084: owner-set — a half-year's notice on an approaching goal
_OBLIGATION_SOON_DAYS = 30
# §12in-3 — the insurance renewal "soon" window lives in ONE store (insurance.py); Review reads it
# (imported at the top), never redefines it. Value unchanged (30): a definition move, not behaviour.
_INSURANCE_SOON_DAYS = _INSURANCE_SOON_DAYS_INS
_RUNWAY_LOW_MONTHS = 3          # D-084: owner-set floor — below 3 months' recurring net burn warrants a look
_CORP_ACTION_RECENT_DAYS = 45   # window for "corporate action recorded — verify" reminders
_INCOMPLETE_DETAILS_MIN = 1     # D-091: manual holdings with no optional detail recorded (≥ this many surfaces)
_OTHER_CLASS_OVERUSE_PCT = 10   # D-087: `other` is the honest escape valve, but over ~10% of gross signals reclassification

# D-091: manual classes that carry meaningful optional detail; a bare value with no
# `meta` at all is what the "incomplete details" signal flags (never a hard wall).
_DETAIL_CLASSES = frozenset({"fixed_deposit", "bond", "property", "retirement", "private"})


def _item(area: str, title: str, severity: str = "review") -> dict:
    return {"area": area, "title": title, "severity": severity}


#: Served DISPLAY labels for attention areas whose internal key is not the user's word (§12cf1-2 /
#: page-review §12rv2-1). The internal `area` key stays a stable machine token (it drives the count
#: reconciliation and the frontend route map); only what the USER READS is overridden here. An
#: incoming salary is not an "obligation" to the person reading it.
_AREA_LABELS = {"obligations": "Income & expenses"}


def _area_label(area: str) -> str:
    return _AREA_LABELS.get(area, _title(area))


def _title(s: str) -> str:
    """Display-case a served enum key ('review' → 'Review', 'data' → 'Data'). §12rv1-5 (D-105
    precedent): the reader serves display-cased labels — the frontend renders them verbatim (D-005,
    never a raw enum key, no CSS text-transform). Contract SHAPE unchanged."""
    return s[:1].upper() + s[1:] if s else s


def _other_class_overuse_item(val) -> dict | None:
    """D-087 — an item when `other`-classed holdings exceed the over-use threshold, else None.
    Pure (a function of the valuation) so its guard can be exercised in isolation (D-059)."""
    gross = sum((h.market_value_base for h in val.holdings if h.market_value_base > 0), Decimal(0))
    if gross <= 0:
        return None
    other_sum = sum(
        (h.market_value_base for h in val.holdings if h.market_value_base > 0
         and (h.asset_class.value if hasattr(h.asset_class, "value") else str(h.asset_class)) == "other"),
        Decimal(0),
    )
    pct = float(other_sum / gross * Decimal(100))
    if pct > _OTHER_CLASS_OVERUSE_PCT:
        return _item(
            "data",
            f"'Other'-classed holdings are {pct:.0f}% of assets (over {_OTHER_CLASS_OVERUSE_PCT}%) — "
            f"reclassify to a specific type",
        )
    return None


async def review_report(session: AsyncSession) -> dict:
    base = get_settings().base_currency
    today = datetime.now(UTC).date()
    items: list[dict] = []

    # Policy drift out-of-band + concentration (only if a policy is set).
    try:
        drift = await compute_drift(session)
        for dim in drift.get("dimensions", []):
            for r in dim.get("rows", []):
                if r["status"] in ("over", "under"):
                    items.append(_item("policy",
                        f"{r['bucket'].replace('_', ' ').title()} is {r['status']} its {dim['dimension'].replace('_', ' ')} band "
                        f"({r['actual_pct']}% vs {r['target_pct']}%)"))
        for c in drift.get("concentration", []):
            items.append(_item("policy", f"{c['label']} is {c['weight_pct']}% of assets (limit {c['limit_pct']}%)"))
    except Exception:  # noqa: BLE001
        pass

    # Data confidence + staleness (light: no router calls).
    try:
        val = await value_portfolio(session, base)
        low = sum(1 for h in val.holdings if h.market_value_base > 0
                  and score_holding(h)["confidence"] < 50)
        stale = sum(1 for h in val.holdings if h.is_stale and h.symbol)
        if low:
            items.append(_item("data", f"{low} holding{'s' if low != 1 else ''} {'are' if low != 1 else 'is'} low-confidence — review sourcing"))
        if stale:
            items.append(_item("data", f"{stale} holding{'s' if stale != 1 else ''} {'have' if stale != 1 else 'has'} stale prices — refresh"))
    except Exception:  # noqa: BLE001
        pass

    # Thin liquidity.
    try:
        ladder = await liquidity_ladder(session)
        if ladder["liquid_pct"] < _LIQUID_THIN_PCT and ladder["gross_assets"] > 0:
            items.append(_item("liquidity", f"Liquid share is {ladder['liquid_pct']}% of assets"))
    except Exception:  # noqa: BLE001
        pass

    # Goals with a target date approaching.
    try:
        for g in (await goals_report(session))["goals"]:
            d = g.get("days_to_target")
            if d is not None and 0 <= d <= _GOAL_SOON_DAYS:
                items.append(_item("goals", f"Goal '{g['name']}' target date is in {d} days"))
    except Exception:  # noqa: BLE001
        pass

    # Obligations due soon.
    try:
        for o in (await obligations_report(session))["obligations"]:
            nd: date | None = _parse_date(o.get("next_due"))
            if nd is not None and today <= nd <= _add_days(today, _OBLIGATION_SOON_DAYS):
                items.append(_item("obligations", f"{o['name']} due in {(nd - today).days} days"))
    except Exception:  # noqa: BLE001
        pass

    # Insurance renewals due soon (or overdue) — a neutral reminder, never advice.
    try:
        from app.services.insurance import renewal_reminders
        for r in await renewal_reminders(session, _INSURANCE_SOON_DAYS):
            when = "is overdue" if r["days"] < 0 else f"due in {r['days']} days"
            items.append(_item("insurance", f"Insurance '{r['name']}' renewal {when} ({r['renewal_date']})"))
    except Exception:  # noqa: BLE001
        pass

    # Estate & document readiness — neutral status statements (never advice).
    try:
        from app.services.estate import estate_signals
        for msg in await estate_signals(session):
            items.append(_item("estate", msg))
    except Exception:  # noqa: BLE001
        pass

    # Low runway.
    try:
        run = await runway_report(session)
        if run["status"] == "finite" and run["runway_months"] is not None and run["runway_months"] < _RUNWAY_LOW_MONTHS:
            items.append(_item("runway", f"Cash runway is under {_RUNWAY_LOW_MONTHS} months ({run['runway_months']})"))
    except Exception:  # noqa: BLE001
        pass

    # Corporate actions recorded recently — a neutral reminder to verify the auto-adjusted
    # quantity & cost. Splits/bonuses adjust lots deterministically, but a mistyped split
    # ratio (in the Price field) can silently mis-state a position, so we prompt a check.
    try:
        from app.models import Instrument, Transaction, TxnType
        cutoff = datetime.now(UTC) - timedelta(days=_CORP_ACTION_RECENT_DAYS)
        rows = (await session.execute(
            select(Transaction).where(
                Transaction.type.in_([TxnType.SPLIT.value, TxnType.BONUS.value]),
                Transaction.deleted_at.is_(None),   # §3.5: ignore soft-deleted
                Transaction.ts >= cutoff,
            ).order_by(Transaction.ts.desc())
        )).scalars().all()
        for t in rows:
            instr = await session.get(Instrument, t.instrument_id) if t.instrument_id else None
            sym = instr.symbol if instr else "an instrument"
            kind = (t.type.value if hasattr(t.type, "value") else str(t.type)).title()
            items.append(_item("corporate", f"{kind} on {sym} recorded — verify quantity & cost"))
    except Exception:  # noqa: BLE001
        pass

    # Manual holdings recorded as a bare value, with no optional detail (D-091).
    # A low-priority nudge to enrich them — never a hard wall, never advice.
    try:
        from app.models import Holding
        rows = (await session.execute(
            select(Holding).where(
                Holding.manual_value.isnot(None),
                Holding.deleted_at.is_(None),
            )
        )).scalars().all()
        incomplete = sum(
            1 for h in rows
            if (h.asset_class.value if hasattr(h.asset_class, "value") else str(h.asset_class))
            in _DETAIL_CLASSES and not (h.meta and h.meta.strip() not in ("", "{}"))
        )
        if incomplete >= _INCOMPLETE_DETAILS_MIN:
            items.append(_item(
                "data",
                f"{incomplete} holding{'s' if incomplete != 1 else ''} "
                f"{'have' if incomplete != 1 else 'has'} incomplete details",
                severity="info",
            ))
    except Exception:  # noqa: BLE001
        pass

    # D-099 migration surface: instruments carrying an expense ratio on a class it
    # doesn't apply to (only fund wrappers do). Surface for review — never silently
    # deleted; the owner clears it (or reclassifies the instrument).
    try:
        from app.api.v1.routes.markets import FUND_WRAPPED_CLASSES
        from app.models import Instrument
        rows = (await session.execute(
            select(Instrument).where(Instrument.annual_cost_bps.isnot(None))
        )).scalars().all()
        misplaced = sum(
            1 for r in rows
            if (r.asset_class.value if hasattr(r.asset_class, "value") else str(r.asset_class))
            not in FUND_WRAPPED_CLASSES
        )
        if misplaced:
            items.append(_item(
                "data",
                f"{misplaced} instrument{'s' if misplaced != 1 else ''} carry an expense ratio on a "
                f"non-fund class — review (expense ratios apply to funds/ETFs only)",
            ))
    except Exception:  # noqa: BLE001
        pass

    # D-087: `other`-class over-use — reporting only, own guard (D-059).
    try:
        oval = await value_portfolio(session, base)
        ov = _other_class_overuse_item(oval)
        if ov:
            items.append(ov)
    except Exception:  # noqa: BLE001
        pass

    if not items:
        items.append(_item("ok", "Nothing needs a look right now.", severity="info"))

    # §12rv1-5 — the count reconciliation (ND-3) is computed on the RAW severity BEFORE display-casing,
    # so it is unaffected; then area + severity are display-cased for the served labels.
    count = sum(1 for i in items if i["severity"] == "review")
    items = [{**i, "area": _area_label(i["area"]), "severity": _title(i["severity"])} for i in items]

    return {
        "as_of": today.isoformat(),
        "count": count,
        "items": items,
        "disclaimer": "Items to review — reporting only, not advice or a required action.",
    }


def _add_days(d: date, n: int) -> date:
    from datetime import timedelta
    return d + timedelta(days=n)


async def _confidence_and_staleness(val) -> tuple[int, int, int]:
    """(overall confidence, low-confidence count, stale count) from a valuation."""
    from app.services.confidence import score_holding, summarise

    scored = [(abs(h.market_value_base), score_holding(h)["confidence"])
              for h in val.holdings if h.market_value_base != 0]
    overall = summarise(scored)["overall"] if scored else 100
    low = sum(1 for h in val.holdings if h.market_value_base > 0 and score_holding(h)["confidence"] < 50)
    stale = sum(1 for h in val.holdings if h.is_stale and h.symbol)
    return overall, low, stale


def _out_of_band(drift: dict) -> int:
    return (sum(1 for d in drift.get("dimensions", []) for r in d.get("rows", []) if r["status"] in ("over", "under"))
            + len(drift.get("concentration", [])))


async def review_centre(session: AsyncSession) -> dict:
    """One-call summary for the Review Centre — each section's verdict, from existing
    services. No feed fetch here (news is loaded separately). Reporting only."""
    from app.services.liquidity import liquidity_ladder
    from app.services.planning import goals_report, obligations_report
    from app.services.policy import compute_drift
    from app.services.portfolio import top_movers
    from app.services.runway import runway_report

    base = get_settings().base_currency
    val = await value_portfolio(session, base)
    conf, low, stale = await _confidence_and_staleness(val)
    drift = await compute_drift(session)
    ladder = await liquidity_ladder(session)
    run = await runway_report(session)
    goals = await goals_report(session)
    obs = await obligations_report(session)
    rev = await review_report(session)
    gainers, _losers = top_movers(val, n=1)
    top = gainers[0] if gainers else None

    from app.models import ReviewLog
    last = (await session.execute(
        select(ReviewLog).order_by(ReviewLog.reviewed_at.desc()).limit(1))).scalars().first()
    today = datetime.now(UTC).date()
    last_review = None
    if last is not None:
        raw = last.reviewed_at
        la = raw.date() if hasattr(raw, "date") else today
        last_review = {"reviewed_at": la.isoformat(), "days_ago": (today - la).days,
                       "next_review_date": last.next_review_date}

    return {
        "base_currency": base,
        # ONE net-worth figure (§14in-8): the SAME `value_portfolio().total_value` Net worth/Holdings
        # render, at full cent precision. It was `round(..., 0)` — which made the Review headline read
        # `796,246.00` beside Net worth's `796,246.41` (and `+17.00` vs `+16.73`): a precise-looking
        # figure that disagreed with the canonical one. No local rounding — the frontend formats the
        # served value with the same formatter Net worth uses, so they match to the cent.
        "net_worth": float(val.total_value),
        "sections": {
            "trust": {"confidence": conf, "low": low, "stale": stale},
            # A10: the policy verdict carries its input quality, so a Review section computed off
            # stale prices can never present as fresh either (the drift reader is the same one the
            # Policy page reads — one derivation, one honesty layer).
            # 9-8: read the SERVED `has_targets` rather than re-deriving it here. One fact, one
            # expression — they agreed only by coincidence of matching rules, and nothing enforced it.
            "policy": {"out_of_band": _out_of_band(drift), "has_targets": drift.get("has_targets", False),
                       "stale_inputs": drift.get("stale_inputs", 0),
                       "inputs_stale": drift.get("inputs_stale", False)},
            "liquidity": {"liquid_pct": ladder["liquid_pct"], "runway_status": run["status"],
                          "runway_months": run["runway_months"]},
            "goals": {"goals": len(goals["goals"]),
                      "next_obligation": (obs["obligations"][0]["next_due"] if obs["obligations"] else None),
                      "next_12m_total": obs["next_12m_total"]},
            # Same as net_worth (§14in-8): full-precision `val.day_change`, not `round(..., 0)`.
            "changed": {"day_change": float(val.day_change),
                        "top_mover": (top.label if top else None)},
        },
        "attention": rev["items"],
        "attention_count": rev["count"],
        "last_review": last_review,
        "disclaimer": "A consolidated review of facts you already have — reporting only, not advice.",
    }


async def record_review(session: AsyncSession, note: str | None, next_review_date: str | None) -> dict:
    """Snapshot the current state as a recorded review (W1 §4.10)."""
    from app.models import ReviewLog
    from app.services.policy import compute_drift

    base = get_settings().base_currency
    val = await value_portfolio(session, base)
    conf, _low, _stale = await _confidence_and_staleness(val)
    drift = await compute_drift(session)
    rev = await review_report(session)
    log = ReviewLog(net_worth=val.total_value, base_currency=base, confidence=conf,
                    drift_flags=_out_of_band(drift), attention_count=rev["count"],
                    note=(note or None), next_review_date=(next_review_date or None))
    session.add(log)
    await session.flush()
    return {"id": log.id}


async def review_history(session: AsyncSession, limit: int = 24) -> dict:
    from app.models import ReviewLog

    rows = (await session.execute(
        select(ReviewLog).order_by(ReviewLog.reviewed_at.desc()).limit(limit))).scalars().all()
    today = datetime.now(UTC).date()

    def _row(r):
        la = r.reviewed_at.date() if hasattr(r.reviewed_at, "date") else today
        return {"id": r.id, "reviewed_at": la.isoformat(), "days_ago": (today - la).days,
                "net_worth": round(float(r.net_worth), 0), "base_currency": r.base_currency,
                "confidence": r.confidence, "drift_flags": r.drift_flags,
                "attention_count": r.attention_count, "note": r.note,
                "next_review_date": r.next_review_date}

    return {"history": [_row(r) for r in rows]}
