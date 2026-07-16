# SPDX-License-Identifier: AGPL-3.0-or-later
"""Realised-gains & tax-lot reporting (Phase 2b).

A **separate, read-only** FIFO replay that emits lot-level detail — acquisition date,
per-sell realised events, and open lots — WITHOUT touching ``compute_fifo`` (nothing
that computes valuations changes). Strictly an organisation / reporting aid:

  • **Not tax advice.** Short vs long term is a neutral holding-period split against a
    threshold the user sets; the report never asserts a tax treatment.
  • Realised gains are in each instrument's **native currency** (exact). A base-currency
    total is offered only at **current** FX, clearly caveated (past trades happened at
    past FX, which we do not reconstruct).
"""

from __future__ import annotations

from collections import defaultdict, deque
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import Account, Instrument, Transaction, TxnType
from app.services import fx
from app.services.portfolio import entity_account_filter

ZERO = Decimal(0)


def _naive(ts: datetime) -> datetime:
    return ts.astimezone(UTC).replace(tzinfo=None) if ts.tzinfo is not None else ts


def _leg_rate(t, base: str | None) -> Decimal | None:
    """§4.2: a transaction's usable trade-date rate — its stored ``fx_to_base``, but ONLY when
    it was captured against the CURRENT base (a base change invalidates it, R8). Returns None
    when the rate is unavailable, so a leg with no usable rate makes its realised event
    'trade-date FX unavailable' (R7 — excluded, never half-computed)."""
    if base is None:
        return None
    r = getattr(t, "fx_to_base", None)
    if r is None or getattr(t, "fx_base", None) != base:
        return None
    return Decimal(r)


@dataclass
class RealisedEvent:
    sell_ts: datetime
    acquired_ts: datetime
    quantity: Decimal
    proceeds: Decimal
    cost: Decimal
    currency: str
    # §4.2 trade-date FX: each leg's own stored native→base rate (None = unavailable).
    proceeds_fx: Decimal | None = None   # from the SELL transaction
    cost_fx: Decimal | None = None       # from the acquiring BUY transaction (the lot)

    @property
    def gain(self) -> Decimal:
        return self.proceeds - self.cost

    @property
    def gain_base_historical(self) -> Decimal | None:
        """§4.2 trade-date-FX gain in base currency: each leg at its OWN stored rate —
        ``proceeds × fx_sell − cost × fx_buy``. Returns None when EITHER leg lacks a usable
        rate (R7 never-mix: the whole event is excluded, never mixing a trade-date leg with a
        current-FX one). Same-currency lots carry rate 1 on both legs, so this equals the
        native gain — unchanged."""
        if self.proceeds_fx is None or self.cost_fx is None:
            return None
        return self.proceeds * self.proceeds_fx - self.cost * self.cost_fx

    @property
    def holding_days(self) -> int:
        return (_naive(self.sell_ts) - _naive(self.acquired_ts)).days


@dataclass
class OpenLot:
    acquired_ts: datetime
    quantity: Decimal
    unit_cost: Decimal
    currency: str
    acq_fx: Decimal | None = None   # §4.3: acquisition trade-date rate, so a merger can carry it


def fifo_report(transactions: list[Transaction], base: str | None = None,
                method: str = "fifo") -> tuple[list[RealisedEvent], list[OpenLot]]:
    """Replay one instrument's transactions, emitting realised events and remaining open lots.

    ``method`` selects the cost-basis method (§4.4): ``"fifo"`` (default — unchanged; consumes
    the oldest lots on a sell) or ``"average"`` (pools all open lots into one average unit
    cost). The FIFO branch is untouched. Under average cost: a sell realises ``proceeds −
    sold × avg`` where ``avg = total_cost / total_qty``; the acquisition DATE for the sale is
    the OLDEST open lot's (Decision B — cost pooled, holding period FIFO); and trade-date FX
    does NOT apply (Decision A) so ``cost_fx``/``proceeds_fx`` are None and the event is
    excluded from the §4.2 historical-FX total (never mixing a trade-date leg with an average
    cost leg). Buy/split/bonus/merger operate on the pool total identically for both methods.

    §4.2 (FIFO): each lot carries its acquiring buy's trade-date rate, and each realised event
    records both leg rates. Pure function — no DB, no IO."""
    lots: deque[list] = deque()  # each = [qty, unit_cost, acquired_ts, currency, acq_fx]
    events: list[RealisedEvent] = []
    for t in sorted(transactions, key=lambda x: _naive(x.ts)):
        qty, px = Decimal(t.quantity), Decimal(t.price)
        costs = Decimal(t.fees) + Decimal(getattr(t, "taxes", 0) or 0)
        ccy = t.currency
        if t.type == TxnType.BUY:
            if qty <= ZERO:
                continue
            unit_cost = px + (costs / qty if qty else ZERO)
            lots.append([qty, unit_cost, t.ts, ccy, _leg_rate(t, base)])
        elif t.type == TxnType.SELL:
            unit_proceeds = px - (costs / qty if qty else ZERO)   # sell costs reduce proceeds
            if method == "average":
                # §4.4 average cost: cost from the pooled average; DATE from the oldest open lot.
                total_qty = sum(lot[0] for lot in lots)
                if total_qty > ZERO:
                    avg = sum(lot[0] * lot[1] for lot in lots) / total_qty
                    sold = min(qty, total_qty)             # guard oversell (R9): never over-match
                    events.append(RealisedEvent(
                        sell_ts=t.ts, acquired_ts=lots[0][2], quantity=sold,
                        proceeds=sold * unit_proceeds, cost=sold * avg, currency=ccy,
                        proceeds_fx=None, cost_fx=None))   # §4.4 Decision A: trade-date FX unavailable
                    # Draw `sold` oldest-first (advances the holding-period date), then re-price
                    # the remaining lots to the average so the pool stays consistent for the next sell.
                    remaining = sold
                    while remaining > ZERO and lots:
                        lot = lots[0]
                        take = min(lot[0], remaining)
                        lot[0] -= take
                        remaining -= take
                        if lot[0] <= ZERO:
                            lots.popleft()
                    for lot in lots:
                        lot[1] = avg
                # total_qty == 0 (oversell into an empty pool) → nothing matched, no event.
            else:
                remaining = qty
                sell_fx = _leg_rate(t, base)                        # §4.2 sell-leg trade-date rate
                while remaining > ZERO and lots:
                    lot = lots[0]
                    take = min(lot[0], remaining)
                    events.append(RealisedEvent(
                        sell_ts=t.ts, acquired_ts=lot[2], quantity=take,
                        proceeds=take * unit_proceeds, cost=take * lot[1], currency=ccy,
                        proceeds_fx=sell_fx, cost_fx=lot[4]))      # §4.2 each leg's own rate
                    lot[0] -= take
                    remaining -= take
                    if lot[0] <= ZERO:
                        lots.popleft()
                # remaining > 0 with no lots (oversell) is not matched — never fabricated.
        elif t.type == TxnType.SPLIT:
            ratio = px if px > ZERO else Decimal("1")
            for lot in lots:
                lot[0] *= ratio
                lot[1] /= ratio
        elif t.type == TxnType.BONUS:
            if qty > ZERO:
                lots.append([qty, ZERO, t.ts, ccy, _leg_rate(t, base)])
        elif t.type == TxnType.MERGER:
            # §4.3: instrument A is absorbed into B. A's remaining lots are carried into B by
            # resolve_mergers (as synthetic buys preserving qty×R / cost÷R / date / acq_fx);
            # here we simply TERMINATE A's position with NO realised event (not a sale).
            lots.clear()
    if method == "average":
        # §4.4: open lots under average cost show the pool average (buys after the last sell
        # aren't re-priced above); acq_fx is dropped since trade-date FX doesn't apply.
        tq = sum(lot[0] for lot in lots)
        if tq > ZERO:
            avg = sum(lot[0] * lot[1] for lot in lots) / tq
            for lot in lots:
                lot[1], lot[4] = avg, None
    open_lots = [OpenLot(lot[2], lot[0], lot[1], lot[3], lot[4]) for lot in lots if lot[0] > ZERO]
    return events, open_lots


def resolve_mergers(txns: Sequence[Any], base: str | None = None,
                    methods: dict[int, str] | None = None) -> list:
    """§4.3 stock-for-stock merger lot-transfer (cross-instrument).

    A merger (instrument A absorbed into B at ratio R = the price field, target =
    ``related_instrument_id``) carries A's OPEN position into B as synthetic BUYs on B at the
    ORIGINAL acquisition date, with ``quantity × R`` and ``unit_cost ÷ R`` — so total cost is
    preserved (like a split, but A→B) — carrying each lot's acquisition FX rate. A's own MERGER
    transaction terminates A's lots in the engine (no realised event — a reorganisation, not a sale).

    §4.4 Unit C — the extraction is method-aware. ``methods`` maps ``account_id → cost-basis
    method``; A's position is extracted under A's ACCOUNT's method (default FIFO when absent):

      • **FIFO source** (default): each of A's open lots carries across individually — original
        date, ``qty × R`` / ``cost ÷ R``, its own ``acq_fx``. Unchanged, byte-identical to §4.3.
      • **Average source**: A holds a single pooled position, not per-lot bases — so A carries as
        ONE synthetic lot: total remaining qty at the pool average, dated at the OLDEST open lot
        (Decision B), with ``acq_fx = None`` (Decision A — no per-lot rate under average).

    This is the cross-instrument coordination: rather than teach the per-instrument FIFO
    engines to move lots between instruments, we resolve mergers ONCE here into ordinary
    synthetic buys on B (dated at the original acquisition, so B's normal FIFO consumes the
    oldest carried lot first). Both engines then replay the SAME resolved streams, so they
    cannot diverge (R5). A portfolio with no merger passes through unchanged (byte-identical).
    """
    if not any(getattr(t, "type", None) == TxnType.MERGER for t in txns):
        return list(txns)
    base = base or get_settings().base_currency
    methods = methods or {}
    out = list(txns)
    # Process mergers oldest-first so a chain (A→B then B→C) carries A's lots through B into C.
    for m in sorted((t for t in txns if t.type == TxnType.MERGER), key=lambda x: _naive(x.ts)):
        acct = getattr(m, "account_id", None)
        target = getattr(m, "related_instrument_id", None)
        ratio = Decimal(m.price) if m.price else ZERO
        if target is None or ratio <= ZERO:
            continue   # malformed merger (no target / non-positive ratio) — cannot resolve
        a_txns = [t for t in out
                  if getattr(t, "account_id", None) == acct and t.instrument_id == m.instrument_id
                  and t.type != TxnType.MERGER and getattr(t, "deleted_at", None) is None]
        method = _method_of(methods, acct)                 # §4.4: extract A under A's own method
        _events, a_lots = fifo_report(a_txns, base, method)   # A's open position at the merger
        if method == "average" and a_lots:
            # §4.4 Unit C: an average source pools its cost — carry A as ONE pooled lot (total qty
            # at the pool average, which fifo_report already re-priced every open lot to; dated at
            # the OLDEST open lot per Decision B; no per-lot FX per Decision A). This preserves A's
            # total cost across the merger without fabricating per-lot bases the pool never had.
            total_qty = sum((lot.quantity for lot in a_lots), ZERO)
            a_lots = [OpenLot(min(lot.acquired_ts for lot in a_lots), total_qty,
                              a_lots[0].unit_cost, a_lots[0].currency, None)]
        for lot in a_lots:
            out.append(SimpleNamespace(
                account_id=acct, instrument_id=target, related_instrument_id=None,
                type=TxnType.BUY, ts=lot.acquired_ts,               # original date → holding period carries
                quantity=lot.quantity * ratio, price=lot.unit_cost / ratio,  # ×R / ÷R → cost preserved
                fees=ZERO, taxes=ZERO, amount=ZERO, currency=lot.currency,
                fx_to_base=lot.acq_fx, fx_base=(base if lot.acq_fx is not None else None),
                deleted_at=None))
    return out


async def _txns_by_instrument(
    session: AsyncSession, entity_id: int | None = None
) -> tuple[dict[tuple[int | None, int], list[Transaction]], dict[int, Instrument], dict[int, str]]:
    q = (
        select(Transaction)
        .where(Transaction.instrument_id.isnot(None))
        .where(Transaction.deleted_at.is_(None))  # §3.5 R3: exclude soft-deleted from realised gains + FIFO lots
    )
    ef = entity_account_filter(Transaction, entity_id)  # §4.1: no-op when entity_id is None
    if ef is not None:
        q = q.where(ef)
    methods = {a.id: (a.cost_basis_method or "fifo")
               for a in (await session.execute(select(Account))).scalars()}
    # §4.3/§4.4: resolve mergers ONCE, extracting each absorbed account under its own cost-basis
    # method so an average source carries its pooled position (not FIFO per-lot) into the target.
    txns = resolve_mergers((await session.execute(q)).scalars().all(), methods=methods)
    # §4.4 R2: group per (account, instrument) — the cost-basis method is per account, and a
    # sell must never consume another account's lots. Each group replays under its own method.
    by_group: dict[tuple[int | None, int], list[Transaction]] = defaultdict(list)
    for t in txns:
        if t.instrument_id is None:  # excluded by the query above; guard narrows int | None -> int
            continue
        by_group[(getattr(t, "account_id", None), t.instrument_id)].append(t)
    instr = {i.id: i for i in (await session.execute(select(Instrument))).scalars()}
    return by_group, instr, methods


def _method_of(methods: dict[int, str], acct: int | None) -> str:
    """§4.4 cost-basis method for an account, defaulting to FIFO (also for a null account)."""
    return methods.get(acct, "fifo") if acct is not None else "fifo"


def _label(instr: Instrument | None, iid: int) -> tuple[str | None, str]:
    if instr is None:
        return None, f"#{iid}"
    return instr.symbol, (instr.name or instr.symbol or f"#{iid}")


async def realised_gains_report(session: AsyncSession, year: int | None = None,
                                long_term_days: int = 365, entity_id: int | None = None) -> dict:
    """Realised gains for a calendar year, grouped by native currency, with a neutral
    short/long-term split and a caveated base-currency total at current FX. ``entity_id``
    optionally scopes to one ownership entity (§4.1); default is the whole portfolio."""
    long_term_days = max(0, min(int(long_term_days if long_term_days is not None else 365), 3660))
    base = get_settings().base_currency
    by_group, instr_map, methods = await _txns_by_instrument(session, entity_id)

    all_events: list[tuple[Instrument | None, int, RealisedEvent]] = []
    for (acct, iid), group in by_group.items():
        events, _lots = fifo_report(group, base, _method_of(methods, acct))  # §4.4 per-account method
        for e in events:
            all_events.append((instr_map.get(iid), iid, e))

    years = sorted({_naive(e.sell_ts).year for _, _, e in all_events}, reverse=True)
    yr = int(year) if year else (years[0] if years else datetime.now(UTC).year)

    # §4.2 (additive): the NEW historical-FX realised total values each leg at its own stored
    # trade-date rate; events where either leg lacks a usable rate are EXCLUDED (R7 never-mix),
    # not half-computed. The current-FX total below is retained, unchanged, as the comparison.
    base_realised_historical_fx = ZERO
    historical_fx_events_excluded = 0

    groups: dict[str, dict] = defaultdict(lambda: {"events": [], "realised": ZERO, "short": ZERO, "long": ZERO, "income": ZERO})
    for instr, iid, e in all_events:
        if _naive(e.sell_ts).year != yr:
            continue
        sym, name = _label(instr, iid)
        lt = e.holding_days >= long_term_days
        g = groups[e.currency]
        g["events"].append({
            "symbol": sym, "name": name,
            "sell_date": _naive(e.sell_ts).date().isoformat(),
            "acquired_date": _naive(e.acquired_ts).date().isoformat(),
            "quantity": float(round(e.quantity, 4)),
            "proceeds": float(round(e.proceeds, 2)), "cost": float(round(e.cost, 2)),
            "gain": float(round(e.gain, 2)), "holding_days": e.holding_days,
            "long_term": lt,
        })
        g["realised"] += e.gain
        g["long" if lt else "short"] += e.gain
        gh = e.gain_base_historical
        if gh is None:
            historical_fx_events_excluded += 1
        else:
            base_realised_historical_fx += gh

    # Income (dividends + interest) for the year, by currency.
    for group in by_group.values():
        for t in group:
            if t.type in (TxnType.DIVIDEND, TxnType.INTEREST) and _naive(t.ts).year == yr:
                amt = Decimal(t.amount) if t.amount else Decimal(t.quantity) * Decimal(t.price)
                groups[t.currency]["income"] += abs(amt)

    currency_groups = []
    base_realised_current_fx = ZERO
    for ccy, g in sorted(groups.items()):
        base_realised_current_fx += await fx.convert(g["realised"], ccy, base)
        currency_groups.append({
            "currency": ccy,
            "realised_total": float(round(g["realised"], 2)),
            "short_term": float(round(g["short"], 2)),
            "long_term": float(round(g["long"], 2)),
            "income": float(round(g["income"], 2)),
            "events": sorted(g["events"], key=lambda r: r["sell_date"], reverse=True),
        })

    return {
        "year": yr, "years": years or [yr], "long_term_days": long_term_days,
        "base_currency": base,
        "currency_groups": currency_groups,
        "base_realised_total_current_fx": float(round(base_realised_current_fx, 2)),
        # §4.2 (additive): each realised leg valued at its own trade-date rate, over only the
        # events with a stored rate on both legs. `..._excluded` counts events left out for
        # want of a rate (e.g. trades predating capture) — honestly "trade-date FX unavailable".
        "base_realised_total_historical_fx": float(round(base_realised_historical_fx, 2)),
        "realised_fx_events_excluded": historical_fx_events_excluded,
        "disclaimer": (
            "Organisation & reporting only — NOT tax advice. Gains are in each instrument's "
            "native currency; the current-FX base total uses TODAY's FX (approximate — not for "
            "filing). The trade-date-FX base total instead values each leg at the FX rate stored "
            "when the trade was recorded, and omits any trade lacking a stored rate. Short/long "
            "term is a neutral holding-period split at your chosen threshold, not a tax ruling. "
            "Verify against your broker records and your jurisdiction's rules."
        ),
    }


async def tax_lots_report(session: AsyncSession, long_term_days: int = 365,
                          entity_id: int | None = None) -> dict:
    """Open (unsold) lots per holding — acquisition date, quantity, cost, holding period.
    ``entity_id`` optionally scopes to one ownership entity (§4.1)."""
    long_term_days = max(0, min(int(long_term_days if long_term_days is not None else 365), 3660))
    by_group, instr_map, methods = await _txns_by_instrument(session, entity_id)
    now = datetime.now(UTC)
    lots = []
    for (acct, iid), group in by_group.items():
        _events, open_lots = fifo_report(group, method=_method_of(methods, acct))  # §4.4 per-account method
        sym, name = _label(instr_map.get(iid), iid)
        for lot in open_lots:
            days = (_naive(now) - _naive(lot.acquired_ts)).days
            lots.append({
                "symbol": sym, "name": name,
                "acquired_date": _naive(lot.acquired_ts).date().isoformat(),
                "quantity": float(round(lot.quantity, 4)),
                "unit_cost": float(round(lot.unit_cost, 4)),
                "cost": float(round(lot.quantity * lot.unit_cost, 2)),
                "currency": lot.currency,
                "holding_days": days, "long_term": days >= long_term_days,
            })
    lots.sort(key=lambda x: (x["symbol"] or "", x["acquired_date"]))
    return {"long_term_days": long_term_days, "lots": lots,
            "disclaimer": "Open lots by FIFO. Organisation only — not tax advice."}


def realised_gains_csv(report: dict) -> str:
    """Flatten a realised-gains report into CSV text (safe: no formula-injection prefixes).

    §9-5 (page-reports, honesty): the file LEADS with the served disclaimer and the base-currency
    totals block — BOTH the current-FX total and the trade-date-FX (historical) total, plus the
    count of realised events excluded from the historical total for want of a stored rate (R7 /
    D-020/D-076). An export that shed these would strip the very caveats the on-screen report
    carries — a Guarantee-3 violation — so they travel INTO the file, then the per-event table."""
    import csv
    import io

    from app.services.csv_import import sanitize_cell

    buf = io.StringIO()
    w = csv.writer(buf)
    base = report["base_currency"]
    w.writerow([f"LedgerFrame Realised P/L report — {report['year']} (base {base})"])
    w.writerow([sanitize_cell(report["disclaimer"])])
    w.writerow([])
    w.writerow([f"Base realised total ({base}, current FX)", report["base_realised_total_current_fx"]])
    w.writerow([f"Base realised total ({base}, trade-date FX)", report["base_realised_total_historical_fx"]])
    w.writerow(["Realised events excluded (trade-date FX unavailable)", report["realised_fx_events_excluded"]])
    w.writerow([])
    w.writerow(["currency", "symbol", "name", "sell_date", "acquired_date", "quantity",
                "proceeds", "cost", "gain", "holding_days", "long_term"])
    for g in report["currency_groups"]:
        for e in g["events"]:
            w.writerow([g["currency"], sanitize_cell(e["symbol"] or ""), sanitize_cell(e["name"]),
                        e["sell_date"], e["acquired_date"], e["quantity"], e["proceeds"],
                        e["cost"], e["gain"], e["holding_days"], "yes" if e["long_term"] else "no"])
    return buf.getvalue()


def tax_lots_csv(report: dict) -> str:
    """Flatten an open-tax-lots report into CSV text (safe: no formula-injection prefixes).

    §9-4 (page-reports — new export) + §9-5: BORN WITH ITS DISCLAIMER. The file leads with the
    served disclaimer, then the per-lot table (the lot keys), so the tax-lots export carries the
    same "organisation only — not tax advice" caveat the on-screen tax-lots section shows. Mirrors
    ``realised_gains_csv`` so both report exports share one honest shape."""
    import csv
    import io

    from app.services.csv_import import sanitize_cell

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([f"LedgerFrame open tax lots (long-term threshold {report['long_term_days']} days)"])
    w.writerow([sanitize_cell(report["disclaimer"])])
    w.writerow([])
    w.writerow(["symbol", "name", "acquired_date", "quantity", "unit_cost", "cost", "currency",
                "holding_days", "long_term"])
    for lot in report["lots"]:
        w.writerow([sanitize_cell(lot["symbol"] or ""), sanitize_cell(lot["name"]),
                    lot["acquired_date"], lot["quantity"], lot["unit_cost"], lot["cost"],
                    lot["currency"], lot["holding_days"], "yes" if lot["long_term"] else "no"])
    return buf.getvalue()
