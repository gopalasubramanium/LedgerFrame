"""Free RSS feed parsing, config, and /news integration (offline-safe)."""

from __future__ import annotations

from app.services.feeds import _parse_feed, get_feed_urls, set_feed_urls

SAMPLE_RSS = b"""<?xml version="1.0"?><rss version="2.0"><channel><title>Demo Wire</title>
<item><title>Markets steady</title><link>http://x/1</link>
<description>desc</description><pubDate>Wed, 25 Jun 2025 10:00:00 GMT</pubDate></item>
</channel></rss>"""


def test_parse_rss_extracts_items():
    items = _parse_feed("http://x", SAMPLE_RSS)
    assert len(items) == 1
    assert items[0].headline == "Markets steady"
    assert items[0].source == "Demo Wire"
    assert items[0].url == "http://x/1"


def test_parse_malformed_returns_empty():
    assert _parse_feed("x", b"<not-xml") == []


async def test_feed_config_roundtrip(session):
    # default when unset
    assert await get_feed_urls(session)  # non-empty defaults
    await set_feed_urls(session, ["https://example.com/a.xml", "https://example.com/b.xml"])
    urls = await get_feed_urls(session)
    assert urls == ["https://example.com/a.xml", "https://example.com/b.xml"]


async def test_news_endpoint_degrades_without_network(app_client):
    # Point feeds at nothing so no network is attempted; provider news still returns.
    await app_client.put("/api/v1/news/feeds", json={"feeds": []})
    r = await app_client.get("/api/v1/news")
    assert r.status_code == 200
    body = r.json()
    assert body["rss_count"] == 0
    assert isinstance(body["items"], list)


async def test_feeds_get_endpoint(app_client):
    r = await app_client.get("/api/v1/news/feeds")
    assert r.status_code == 200
    assert "feeds" in r.json() and "defaults" in r.json()
