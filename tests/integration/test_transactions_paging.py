# SPDX-License-Identifier: AGPL-3.0-or-later
"""D-094 — the transactions ledger sorts, filters and windows SERVER-SIDE over the
full dataset. The headline defect it fixes: the old 500-row silent cap. The window
is explicit and `total` always reports the full (filtered) size — never a silent
truncation."""

from __future__ import annotations


async def _seed_zz(app_client) -> None:
    # Three isolated transactions (symbols no demo seed uses) so a "ZZ" filter
    # selects exactly these regardless of what else is seeded.
    for sym, price, day in [("ZZA", 10, "01"), ("ZZB", 30, "03"), ("ZZC", 20, "02")]:
        r = await app_client.post("/api/v1/portfolio/transactions", json={
            "symbol": sym, "type": "buy", "ts": f"2020-01-{day}T09:30:00",
            "quantity": 1, "price": price, "currency": "USD",
        })
        assert r.status_code == 200


async def test_filter_and_total_are_server_side(app_client):
    await _seed_zz(app_client)
    r = (await app_client.get("/api/v1/portfolio/transactions?filter=ZZ&limit=100")).json()
    assert r["total"] == 3 and len(r["transactions"]) == 3
    assert {t["symbol"] for t in r["transactions"]} == {"ZZA", "ZZB", "ZZC"}
    assert r["filter"] == "ZZ"


async def test_window_reports_full_total_never_truncates_silently(app_client):
    await _seed_zz(app_client)
    page1 = (await app_client.get("/api/v1/portfolio/transactions?filter=ZZ&limit=2&offset=0")).json()
    page2 = (await app_client.get("/api/v1/portfolio/transactions?filter=ZZ&limit=2&offset=2")).json()
    # The window is small, but the honest denominator is always the full count.
    assert page1["total"] == 3 and page2["total"] == 3
    assert len(page1["transactions"]) == 2 and len(page2["transactions"]) == 1
    assert page1["limit"] == 2 and page1["offset"] == 0 and page2["offset"] == 2
    # No overlap, full coverage — the whole dataset is reachable by paging.
    ids = {t["id"] for t in page1["transactions"]} | {t["id"] for t in page2["transactions"]}
    assert len(ids) == 3


async def test_sort_executes_on_the_full_dataset(app_client):
    await _seed_zz(app_client)

    async def first_symbol(query: str) -> str:
        r = (await app_client.get(f"/api/v1/portfolio/transactions?filter=ZZ&{query}")).json()
        return r["transactions"][0]["symbol"]

    # Date sort (default column) — most recent first vs oldest first.
    assert await first_symbol("sort=ts&dir=desc") == "ZZB"   # 2020-01-03
    assert await first_symbol("sort=ts&dir=asc") == "ZZA"    # 2020-01-01
    # Symbol sort.
    assert await first_symbol("sort=symbol&dir=asc") == "ZZA"
    assert await first_symbol("sort=symbol&dir=desc") == "ZZC"
    # Amount sort (buys are negative: ZZB -30 < ZZC -20 < ZZA -10).
    assert await first_symbol("sort=amount&dir=asc") == "ZZB"
    assert await first_symbol("sort=amount&dir=desc") == "ZZA"


async def test_unknown_sort_falls_back_to_ts(app_client):
    r = (await app_client.get("/api/v1/portfolio/transactions?sort=bogus")).json()
    assert r["sort"] == "ts"  # never errors on a bad column; degrades to default


async def test_recently_added_surfaces_old_dated_import(app_client):
    """The 'added' (insertion-order) sort surfaces a just-added row even when its
    trade date is historical — the post-import visibility fix. A CSV import of a
    2019 trade must be findable at the top of 'recently added', not buried by date."""
    # A historical-dated transaction, added last.
    assert (await app_client.post("/api/v1/portfolio/transactions", json={
        "symbol": "ZOLD", "type": "buy", "ts": "2019-01-01T09:30:00",
        "quantity": 1, "price": 5, "currency": "USD",
    })).status_code == 200

    added = (await app_client.get("/api/v1/portfolio/transactions?sort=added&dir=desc")).json()
    assert added["sort"] == "added"
    assert added["transactions"][0]["symbol"] == "ZOLD"  # newest-added, despite oldest date

    # By trade date (default), the 2019 row is NOT at the top — that's the bug the
    # 'recently added' sort works around.
    by_date = (await app_client.get("/api/v1/portfolio/transactions?sort=ts&dir=desc")).json()
    assert by_date["transactions"][0]["symbol"] != "ZOLD"

async def test_transactions_scoped_by_account_id(app_client):
    # §14ac-3 (Amendment G, transactions half): ?account_id= scopes the ledger to one account at the
    # SAME chokepoint the count uses, so `total` stays honest under the filter. RED before the delta:
    # the unknown param was ignored → scoped total == the full ledger total.
    accts = (await app_client.get("/api/v1/accounts/list")).json()["accounts"]
    sg = next(a["id"] for a in accts if a["name"] == "Demo SG CDP")  # holds the SGD demo transactions

    full = (await app_client.get("/api/v1/portfolio/transactions?limit=500")).json()
    scoped = (await app_client.get(f"/api/v1/portfolio/transactions?account_id={sg}&limit=500")).json()

    assert 0 < scoped["total"] < full["total"]  # a strict, non-empty subset
    assert scoped["total"] == len(scoped["transactions"])  # honest denominator under the filter
    assert all(t["account_id"] == sg for t in scoped["transactions"])  # every row is that account's


async def test_transactions_account_id_unknown_is_empty(app_client):
    scoped = (await app_client.get("/api/v1/portfolio/transactions?account_id=999999")).json()
    assert scoped["total"] == 0 and scoped["transactions"] == []  # honest empty, not the whole ledger
