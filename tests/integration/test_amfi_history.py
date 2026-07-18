# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-43 §12 step 5 — AMFI historical-NAV archive fetcher (DownloadNAVHistoryReport_Po.aspx).

AMFI publishes a date-range NAV history report (~90-day max per request, back to 2006). The daily
NAVAll.txt adapter only gives today's NAV, so funds had ZERO history (F-1). This builds the archive
fetcher against the documented params + a recorded fixture; the EXACT params are TO-CONFIRM on the
owner's stack (▲-D). Pins: chunk stitching (a long span → ≤90-day contiguous chunks) + scheme
filtering (only the held scheme's rows are stored).
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal

# A recorded-shape history report: header row + two schemes over two dates, one N.A. (defunct →
# nav None, never fabricated). Column order per AMFI's documented report (TO-CONFIRM on-stack).
_HISTORY = (
    "Scheme Code;Scheme Name;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;"
    "Net Asset Value;Repurchase Price;Sale Price;Date\n"
    "102000;SBI Fund A;INF001;INF002;45.1234;;;01-Jan-2026\n"
    "102000;SBI Fund A;INF001;INF002;45.6789;;;02-Jan-2026\n"
    "145834;HDFC Fund B;INF003;INF004;12.3456;;;01-Jan-2026\n"
    "145834;HDFC Fund B;INF003;INF004;N.A.;;;02-Jan-2026\n"
)


def test_parse_nav_history_reads_header_maps_columns_and_drops_na():
    """§12 step 5: the history report is parsed by HEADER (robust to AMFI's column-order variance,
    the ▲-D uncertainty) into one record per (scheme, date); an N.A. NAV → None, never fabricated."""
    from app.providers.market.amfi import parse_nav_history

    recs = parse_nav_history(_HISTORY)
    assert len(recs) == 4
    r0 = [r for r in recs if r.code == "102000" and r.nav_date == date(2026, 1, 2)][0]
    assert r0.nav == Decimal("45.6789") and r0.name == "SBI Fund A"
    na = [r for r in recs if r.code == "145834" and r.nav_date == date(2026, 1, 2)][0]
    assert na.nav is None  # N.A. → honestly missing


def test_chunk_date_ranges_splits_into_contiguous_90_day_chunks():
    """§12 step 5: a span longer than AMFI's ~90-day per-request max splits into contiguous,
    non-overlapping chunks that cover the whole span exactly (chunk stitching)."""
    from app.providers.market.amfi import chunk_date_ranges

    chunks = chunk_date_ranges(date(2025, 1, 1), date(2025, 7, 20), chunk_days=90)
    assert chunks[0][0] == date(2025, 1, 1)
    assert chunks[-1][1] == date(2025, 7, 20)
    # contiguous: each chunk starts the day after the previous ends; none exceeds 90 days.
    for (a, b), (c, _d) in zip(chunks, chunks[1:], strict=False):
        assert (b - a).days + 1 <= 90
        assert c == b + __import__("datetime").timedelta(days=1)
    assert (chunks[-1][1] - chunks[-1][0]).days + 1 <= 90


async def test_ingest_nav_history_filters_to_the_held_scheme_only(session):
    """§12 step 5: ingesting the report for one instrument stores ONLY that scheme's dated NAVs as
    daily PriceHistory (source='amfi_nav', close=NAV, midnight-UTC); other schemes in the file are
    ignored (scheme filtering); an N.A. row is skipped (never a fabricated candle)."""
    from sqlalchemy import select

    from app.models import AssetClass, Instrument, PriceHistory
    from app.services.amfi import ingest_nav_history

    fund = Instrument(symbol="102000", currency="INR", pricing_currency="INR",
                      asset_class=AssetClass.MUTUAL_FUND)
    session.add(fund)
    await session.flush()

    n = await ingest_nav_history(session, fund.id, "102000", _HISTORY)
    assert n == 2  # only 102000's two dated NAVs (not 145834; not the N.A. row)
    rows = (await session.execute(
        select(PriceHistory).where(PriceHistory.instrument_id == fund.id).order_by(PriceHistory.ts)
    )).scalars().all()
    assert [r.ts for r in rows] == [datetime(2026, 1, 1, tzinfo=UTC), datetime(2026, 1, 2, tzinfo=UTC)]
    assert all(r.source == "amfi_nav" and r.interval == "1d" for r in rows)
    assert rows[1].close == Decimal("45.6789")
