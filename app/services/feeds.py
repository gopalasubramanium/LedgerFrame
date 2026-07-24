# SPDX-License-Identifier: AGPL-3.0-or-later
"""Free RSS/Atom news feeds — no API key required.

Fetches a user-configurable list of RSS/Atom feeds and parses them with the
stdlib XML parser (defused against entity attacks). Feeds are merged with any
provider news in the /news endpoint. Everything degrades gracefully: a feed that
is unreachable or malformed is skipped, never fatal.

Feed URLs are stored in the ``news_feeds`` setting (newline-separated). A small
set of widely-available free finance feeds ships as the default; the user can
edit the list in Settings or point it at their own sources.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree as ET

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.egress import egress_client
from app.db.claim import claim_setting
from app.models import Setting
from app.schemas.common import NewsItem

log = logging.getLogger(__name__)

FEEDS_SETTING_KEY = "news_feeds"

# Defaults chosen for reliability: these publishers serve standard RSS without
# blocking non-browser clients (the previous WSJ/Investing.com defaults often
# return 403/HTML to bots, which is why headlines didn't load). Replace freely.
DEFAULT_FEEDS = [
    "https://feeds.bbci.co.uk/news/business/rss.xml",
    "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
]

MAX_ITEMS_PER_FEED = 10
FETCH_TIMEOUT = 6.0


async def no_egress_enabled(session: AsyncSession) -> bool:
    """True when the no-egress toggle (``privacy_mode``) is on — the device must make
    ZERO outbound calls (Product Guarantee 5, D-002/D-069/D-075). News/feeds fetching is
    egress, so under no-egress these readers return empty and **never construct an HTTP
    client** (page-news ND-2, mirroring the C-3 ``system/version-check`` guard)."""
    row = (
        await session.execute(select(Setting).where(Setting.key == "privacy_mode"))
    ).scalars().first()
    return bool(row and str(row.value).strip().lower() in ("1", "true", "yes", "on"))


async def get_feed_urls(session: AsyncSession) -> list[str]:
    row = (
        await session.execute(select(Setting).where(Setting.key == FEEDS_SETTING_KEY))
    ).scalars().first()
    if row is None:
        # Never configured → curated defaults. An explicitly-saved empty list
        # (row exists, value blank) means the user turned feeds off.
        return list(DEFAULT_FEEDS)
    return [u.strip() for u in row.value.splitlines() if u.strip()]


async def set_feed_urls(session: AsyncSession, urls: list[str]) -> None:
    value = "\n".join(u.strip() for u in urls if u.strip())
    row = (
        await session.execute(select(Setting).where(Setting.key == FEEDS_SETTING_KEY))
    ).scalars().first()
    if row:
        row.value = value
        await session.flush()
    else:
        # R-58: absent-INSERT check-then-insert race — absorb a concurrent first-save's loser.
        await claim_setting(session, FEEDS_SETTING_KEY, value)


def _parse_date(text: str | None) -> datetime:
    if not text:
        return datetime.now(UTC)
    try:
        dt = parsedate_to_datetime(text)
        return dt if dt.tzinfo else dt.replace(tzinfo=UTC)
    except (TypeError, ValueError):
        try:
            return datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return datetime.now(UTC)


def _strip_ns(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def _parse_feed(source_url: str, content: bytes) -> list[NewsItem]:
    items: list[NewsItem] = []
    try:
        root = ET.fromstring(content)
    except ET.ParseError:
        return items

    # Feed title for provenance.
    feed_title = source_url
    for el in root.iter():
        if _strip_ns(el.tag) == "title" and el.text:
            feed_title = el.text.strip()
            break

    # RSS <item> and Atom <entry>.
    for node in root.iter():
        if _strip_ns(node.tag) not in ("item", "entry"):
            continue
        title = link = summary = pub = None
        for child in node:
            name = _strip_ns(child.tag)
            if name == "title":
                title = (child.text or "").strip()
            elif name == "link":
                link = child.get("href") or (child.text or "").strip()
            elif name in ("description", "summary"):
                summary = (child.text or "").strip()[:300]
            elif name in ("pubdate", "published", "updated", "date"):
                pub = child.text
        if title:
            items.append(NewsItem(
                headline=title, summary=summary, url=link or None,
                source=feed_title[:120], published_at=_parse_date(pub), symbols=[],
            ))
        if len(items) >= MAX_ITEMS_PER_FEED:
            break
    return items


async def _fetch_one(client: httpx.AsyncClient, url: str) -> list[NewsItem]:
    try:
        r = await client.get(url, follow_redirects=True)
        r.raise_for_status()
        return _parse_feed(url, r.content)
    except Exception as exc:  # noqa: BLE001 — one bad feed must not break the rest
        log.info("feed fetch failed for %s: %s", url, exc)
        return []


async def test_feeds(session: AsyncSession) -> list[dict]:
    """Per-feed diagnostics: did it fetch, how many items, and any error.

    Used by Settings to explain why headlines might be empty (blocked, redirected,
    non-XML, etc.) — the most common cause of "I added feeds but see nothing".
    """
    if await no_egress_enabled(session):
        return []  # ND-2 / Guarantee 5: feed-test is egress — none under no-egress
    urls = await get_feed_urls(session)
    headers = {"User-Agent": "LedgerFrame/1.0 (+local)"}
    results: list[dict] = []
    async with await egress_client("news feed fetch", timeout=FETCH_TIMEOUT, headers=headers) as client:
        for url in urls:
            entry = {"url": url, "ok": False, "count": 0, "error": None, "status": None}
            try:
                r = await client.get(url, follow_redirects=True)
                entry["status"] = r.status_code
                r.raise_for_status()
                items = _parse_feed(url, r.content)
                entry["count"] = len(items)
                entry["ok"] = len(items) > 0
                if not items:
                    entry["error"] = "fetched but no items parsed (not RSS/Atom?)"
            except Exception as exc:  # noqa: BLE001
                entry["error"] = str(exc)[:200]
            results.append(entry)
    return results


async def fetch_feeds(session: AsyncSession, limit: int = 30) -> list[NewsItem]:
    if await no_egress_enabled(session):
        return []  # ND-2 / Guarantee 5: zero outbound under no-egress — never construct the client
    urls = await get_feed_urls(session)
    if not urls:
        return []
    headers = {"User-Agent": "LedgerFrame/1.0 (+local)"}
    async with await egress_client("news feed fetch", timeout=FETCH_TIMEOUT, headers=headers) as client:
        results = await asyncio.gather(*(_fetch_one(client, u) for u in urls))
    items = [item for sub in results for item in sub]
    items.sort(key=lambda i: i.published_at, reverse=True)
    return items[:limit]


# Free, no-key, no-config per-symbol headlines from Yahoo Finance's RSS. This is the
# main news source on the instrument page when the market provider supplies no news
# and the user hasn't configured RSS feeds. Symbols are passed through as-is (works
# for US tickers; foreign suffixes may not always resolve).
_SYMBOL_NEWS_URL = "https://feeds.finance.yahoo.com/rss/2.0/headline?s={sym}&region=US&lang=en-US"


async def fetch_symbol_news(symbol: str, limit: int = 12) -> list[NewsItem]:
    from urllib.parse import quote

    headers = {"User-Agent": "LedgerFrame/1.0 (+local)"}
    url = _SYMBOL_NEWS_URL.format(sym=quote(symbol.strip()))
    async with await egress_client("news feed fetch", timeout=FETCH_TIMEOUT, headers=headers) as client:
        items = await _fetch_one(client, url)
    # Tag the symbol so the UI can show it; keep newest first.
    for it in items:
        if symbol.upper() not in it.symbols:
            it.symbols.append(symbol.upper())
    items.sort(key=lambda i: i.published_at, reverse=True)
    return items[:limit]
