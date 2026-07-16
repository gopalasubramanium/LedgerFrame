# SPDX-License-Identifier: AGPL-3.0-or-later
"""Account-scoped holdings reader (page-accounts §9-11 + Amendment G, Phase 0 reader half).

Phase 0 ships ONLY the reader param `GET /portfolio/holdings?account_id=` — one derivation,
scoped on the canonical reader's output exactly like `?symbol` (a filter, never a recompute).
The Holdings-PAGE drill-down (URL filter → clearable chip) is Phase-1 work (Amendment G).
"""

from __future__ import annotations


async def test_holdings_scoped_by_account_id(app_client):
    accts = (await app_client.get("/api/v1/accounts/list")).json()["accounts"]
    bid = next(a["id"] for a in accts if a["name"] == "Demo Brokerage")

    all_h = (await app_client.get("/api/v1/portfolio/holdings")).json()["holdings"]
    scoped = (await app_client.get(f"/api/v1/portfolio/holdings?account_id={bid}")).json()["holdings"]

    # Today the unknown param is ignored → scoped == all → RED. Scoped must be a strict,
    # non-empty subset of the whole portfolio (Demo Brokerage holds some, not all, holdings).
    assert 0 < len(scoped) < len(all_h)


async def test_holdings_account_id_unknown_is_empty(app_client):
    scoped = (await app_client.get("/api/v1/portfolio/holdings?account_id=999999")).json()["holdings"]
    assert scoped == []  # no holdings for a non-existent account (honest empty, not all)
