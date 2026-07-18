# SPDX-License-Identifier: AGPL-3.0-or-later
"""ECB reference-FX adapter (opt-in) — daily euro reference rates.

Source: the European Central Bank's ``eurofxref-daily.xml`` (public, no key). All
rates are EUR-based (EUR → X). Any pair is derived: EUR→X is **direct**, X→EUR is
**inverse**, and X→Y is **triangulated** via EUR. Used only as a *reference* FX
fallback for portfolio translation — never a trading quote — and never overrides a
fresher entitled provider rate.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from xml.etree import ElementTree as ET

from app.core.egress import egress_client

DAILY_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"
HIST_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.csv"


def parse_ecb_daily(xml_text: str) -> tuple[str | None, dict[str, Decimal]]:
    """Parse the ECB daily XML into ``(as_of, {CCY: EUR->CCY rate})`` (incl EUR=1)."""
    rates: dict[str, Decimal] = {"EUR": Decimal("1")}
    as_of: str | None = None
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return None, rates
    for el in root.iter():
        tag = el.tag.rsplit("}", 1)[-1]
        if tag != "Cube":
            continue
        if el.get("time"):
            as_of = el.get("time")
        cur, rate = el.get("currency"), el.get("rate")
        if cur and rate:
            try:
                d = Decimal(rate)
            except (InvalidOperation, ValueError):
                continue
            if d > 0:
                rates[cur.upper()] = d
    return as_of, rates


async def fetch_ecb_daily(timeout: float = 20.0) -> str:

    async with await egress_client("ECB FX refresh", timeout=timeout, headers={"User-Agent": "LedgerFrame/1.0 (+local)"}, follow_redirects=True) as c:
        r = await c.get(DAILY_URL)
        r.raise_for_status()
        return r.text


def parse_ecb_hist_csv(csv_text: str) -> dict[str, dict[str, Decimal]]:
    """Parse ECB ``eurofxref-hist.csv`` into ``{iso_date: {CCY: EUR->CCY rate}}`` (EUR=1 each).

    The file is a header row (``Date,USD,JPY,…`` — ~40 currencies, a trailing empty column is
    common) followed by one row per publication date, newest-first. A cell is blank or ``N/A``
    for a currency before its coverage begins (INR/SGD are empty in the 1999 rows); those cells
    are SKIPPED (honestly-missing — never fabricated), so a pre-coverage date simply has no row
    for that currency and the resolver returns None. Non-numeric/zero rates are skipped too.
    Pure text-in → data-out, so ingestion is testable without egress.
    """
    import csv
    import io

    out: dict[str, dict[str, Decimal]] = {}
    reader = csv.reader(io.StringIO(csv_text))
    try:
        header = next(reader)
    except StopIteration:
        return out
    # header[0] == "Date"; the rest are currency codes (a trailing "" cell is ignored).
    currencies = [h.strip().upper() for h in header[1:]]
    for row in reader:
        if not row or not row[0].strip():
            continue
        day = row[0].strip()
        rates: dict[str, Decimal] = {"EUR": Decimal("1")}
        for ccy, cell in zip(currencies, row[1:], strict=False):
            if not ccy:
                continue
            cell = (cell or "").strip()
            if not cell or cell.upper() == "N/A":
                continue
            try:
                d = Decimal(cell)
            except (InvalidOperation, ValueError):
                continue
            if d > 0:
                rates[ccy] = d
        out[day] = rates
    return out


async def fetch_ecb_hist(timeout: float = 60.0) -> str:
    """One fetch = the whole daily EUR-reference history back to 1999 (~2,800 rows).
    Routed through the egress choke point, so no-egress raises EgressBlocked (Guarantee 5)."""
    async with await egress_client(
        "ECB FX history backfill", timeout=timeout,
        headers={"User-Agent": "LedgerFrame/1.0 (+local)"}, follow_redirects=True,
    ) as c:
        r = await c.get(HIST_URL)
        r.raise_for_status()
        return r.text
