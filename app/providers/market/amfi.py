# SPDX-License-Identifier: AGPL-3.0-or-later
"""AMFI NAV adapter (opt-in) — official Indian mutual-fund NAVs.

Source: the AMFI daily ``NAVAll.txt`` (public, no key). This module is the *parser*
+ HTTP fetch only; storage/lookup lives in ``app/services/amfi.py``. Design rules
from the product spec:

- Use the official source only; never scrape a fund website.
- Parse scheme code, ISIN(s), name, NAV and date safely; a missing / ``N.A.`` /
  non-positive NAV yields ``nav=None`` (defunct/unpriced) — never a fabricated value.
- Match a holding by **exact AMFI scheme code or verified ISIN** — never by a
  similar name.
- Deterministic, fixture-driven tests; no network in normal test runs.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation

from app.core.egress import egress_client

# AMFI moved this file to the `portal.` host; the old `www.` URL 302-redirects here.
# We point at the canonical host AND follow redirects, so it works either way.
NAV_ALL_URL = "https://portal.amfiindia.com/spages/NAVAll.txt"

# §12 step 5 — the AMFI historical-NAV archive (date-range report). The daily NAVAll.txt gives only
# today's NAV; this report gives a date range (documented ~90-day max per request, back to 2006).
# ▲-D — the EXACT query params are TO-CONFIRM on the owner's stack (the STOP-window AMFI call). The
# built assumption (per AMFI's documented report): frmdt / todt as dd-Mon-yyyy, optional mf (fund
# house) / tp (scheme type). The parser reads the response by HEADER, so column-order variance does
# not break it; only the request params need on-stack confirmation.
NAV_HISTORY_URL = "https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx"
NAV_HISTORY_CHUNK_DAYS = 90

# Section-header lines (no ';') that name a scheme *category* rather than a fund house.
_CATEGORY_PREFIXES = ("Open Ended", "Close Ended", "Closed Ended", "Interval")


@dataclass(frozen=True)
class SchemeNav:
    code: str
    name: str
    nav: Decimal | None          # None = N.A./defunct/unpriced (never fabricated)
    nav_date: date | None
    isin_growth: str | None = None
    isin_reinvest: str | None = None
    fund_house: str | None = None
    category: str | None = None


def _parse_nav(text: str) -> Decimal | None:
    text = (text or "").strip()
    if not text or text.upper() in {"N.A.", "NA", "-", "0", "0.0", "0.00"}:
        return None
    try:
        v = Decimal(text.replace(",", ""))
    except (InvalidOperation, ValueError):
        return None
    return v if v > 0 else None


def _parse_date(text: str) -> date | None:
    text = (text or "").strip()
    for fmt in ("%d-%b-%Y", "%d-%B-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def parse_nav_all(text: str) -> list[SchemeNav]:
    """Parse the AMFI NAVAll.txt payload into scheme records. Robust to the file's
    section headers, blank lines and defunct (N.A.) NAVs."""
    out: list[SchemeNav] = []
    fund_house: str | None = None
    category: str | None = None
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("Scheme Code;"):
            continue
        if ";" not in line:
            if line.startswith(_CATEGORY_PREFIXES):
                category = line
            else:
                fund_house = line
            continue
        parts = line.split(";")
        if len(parts) < 6:
            continue
        code, isin_g, isin_r, name, nav_s, date_s = (p.strip() for p in parts[:6])
        if not code or not code.isdigit():
            continue
        out.append(SchemeNav(
            code=code, name=name,
            nav=_parse_nav(nav_s), nav_date=_parse_date(date_s),
            isin_growth=isin_g or None, isin_reinvest=isin_r or None,
            fund_house=fund_house, category=category,
        ))
    return out


def _match(header: list[str], *needles: str) -> int | None:
    """Index of the first header cell containing any needle (case-insensitive) — column mapping by
    NAME, so AMFI's column-order variance (▲-D) never mis-parses a row."""
    for i, cell in enumerate(header):
        low = cell.strip().lower()
        if any(n in low for n in needles):
            return i
    return None


def parse_nav_history(text: str) -> list[SchemeNav]:
    """Parse the AMFI ``DownloadNAVHistoryReport`` payload into one :class:`SchemeNav` per
    (scheme, date) row. Column positions are resolved from the HEADER row (robust to order — the
    ▲-D uncertainty). A missing/N.A. NAV → ``nav=None`` (defunct/unpriced, never fabricated); a row
    with no valid date is skipped."""
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if not lines:
        return []
    header = lines[0].split(";")
    ci_code = _match(header, "scheme code")
    ci_name = _match(header, "scheme name")
    ci_nav = _match(header, "net asset value")
    ci_date = _match(header, "date")
    ci_isin_g = _match(header, "isin div payout", "isin growth")
    ci_isin_r = _match(header, "isin div reinvest")
    if ci_code is None or ci_nav is None or ci_date is None:
        return []  # not a recognisable history report — refuse to guess columns

    def _cell(parts: list[str], idx: int | None) -> str:
        return parts[idx].strip() if idx is not None and idx < len(parts) else ""

    out: list[SchemeNav] = []
    for raw in lines[1:]:
        parts = raw.split(";")
        code = _cell(parts, ci_code)
        if not code.isdigit():
            continue
        nav_date = _parse_date(_cell(parts, ci_date))
        if nav_date is None:
            continue
        out.append(SchemeNav(
            code=code, name=_cell(parts, ci_name),
            nav=_parse_nav(_cell(parts, ci_nav)), nav_date=nav_date,
            isin_growth=_cell(parts, ci_isin_g) or None,
            isin_reinvest=_cell(parts, ci_isin_r) or None,
        ))
    return out


def chunk_date_ranges(start: date, end: date, chunk_days: int = NAV_HISTORY_CHUNK_DAYS
                      ) -> list[tuple[date, date]]:
    """Split ``[start, end]`` into contiguous, non-overlapping inclusive chunks of at most
    ``chunk_days`` (AMFI's per-request span cap). The chunks cover the whole span exactly — each
    begins the day after the previous ends — so a multi-year fund history stitches without gaps."""
    if end < start:
        return []
    out: list[tuple[date, date]] = []
    cur = start
    while cur <= end:
        stop = min(cur + timedelta(days=chunk_days - 1), end)
        out.append((cur, stop))
        cur = stop + timedelta(days=1)
    return out


def _amfi_date(d: date) -> str:
    """AMFI's date format for the report params: dd-Mon-yyyy (e.g. 01-Jan-2026)."""
    return d.strftime("%d-%b-%Y")


async def fetch_nav_history(from_date: date, to_date: date, *, mf: str | None = None,
                            tp: str | None = None, timeout: float = 30.0) -> str:
    """Fetch one AMFI history-report chunk for ``[from_date, to_date]`` (≤~90 days). Routed through
    the egress choke point (no-egress → EgressBlocked). ▲-D — the exact params are confirmed on the
    owner's stack; the built assumption is ``frmdt``/``todt`` (dd-Mon-yyyy) + optional ``mf``/``tp``."""
    params: dict[str, str] = {"frmdt": _amfi_date(from_date), "todt": _amfi_date(to_date)}
    if mf:
        params["mf"] = mf
    if tp:
        params["tp"] = tp
    headers = {"User-Agent": "LedgerFrame/1.0 (+local)", "Accept": "text/plain, */*"}
    async with await egress_client("mutual-fund NAV history backfill", timeout=timeout,
                                   headers=headers, follow_redirects=True) as client:
        r = await client.get(NAV_HISTORY_URL, params=params)
        r.raise_for_status()
        return r.text


async def fetch_nav_all(timeout: float = 20.0) -> str:
    """Download the official NAVAll.txt (opt-in; never called in tests). Whitelisted
    host only — no arbitrary URLs."""

    headers = {"User-Agent": "LedgerFrame/1.0 (+local)", "Accept": "text/plain, */*"}
    async with await egress_client("mutual-fund NAV refresh", timeout=timeout, headers=headers, follow_redirects=True) as client:
        r = await client.get(NAV_ALL_URL)
        r.raise_for_status()
        return r.text
