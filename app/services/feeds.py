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

from app.models import Setting
from app.schemas.common import NewsItem

log = logging.getLogger(__name__)

FEEDS_SETTING_KEY = "news_feeds"

# Conservative defaults: broadly-available free finance/markets RSS feeds.
# Users can replace these entirely in Settings.
DEFAULT_FEEDS = [
    "https://www.investing.com/rss/news_25.rss",
    "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
    "https://www.cnbc.com/id/100003114/device/rss/rss.html",
]

MAX_ITEMS_PER_FEED = 10
FETCH_TIMEOUT = 8.0


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
    else:
        session.add(Setting(key=FEEDS_SETTING_KEY, value=value))
    await session.flush()


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


async def fetch_feeds(session: AsyncSession, limit: int = 30) -> list[NewsItem]:
    urls = await get_feed_urls(session)
    if not urls:
        return []
    headers = {"User-Agent": "LedgerFrame/1.0 (+local)"}
    async with httpx.AsyncClient(timeout=FETCH_TIMEOUT, headers=headers) as client:
        results = await asyncio.gather(*(_fetch_one(client, u) for u in urls))
    items = [item for sub in results for item in sub]
    items.sort(key=lambda i: i.published_at, reverse=True)
    return items[:limit]
