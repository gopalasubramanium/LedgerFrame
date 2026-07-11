# SPDX-License-Identifier: AGPL-3.0-or-later
"""Phase 3.5 Unit D — PIN-gated permanent delete ("empty trash").

The security proofs are the point: a permanent delete is impossible on a no-PIN install,
and only ever touches soft-deleted rows.
"""

from __future__ import annotations

from sqlalchemy import func, select

from app.db.base import get_sessionmaker
from app.models import Transaction


async def _txn_counts() -> tuple[int, int]:
    """(total rows, soft-deleted rows) read straight from the DB — sees soft-deleted rows
    that the filtered API hides."""
    async with get_sessionmaker()() as s:
        total = (await s.execute(select(func.count()).select_from(Transaction))).scalar()
        soft = (await s.execute(
            select(func.count()).select_from(Transaction).where(Transaction.deleted_at.isnot(None))
        )).scalar()
    return int(total), int(soft)


async def _soft_delete_one_transaction(app_client) -> int:
    txns = (await app_client.get("/api/v1/portfolio/transactions")).json()["transactions"]
    assert txns, "demo seed must contain transactions"
    tid = txns[0]["id"]
    assert (await app_client.delete(f"/api/v1/portfolio/transactions/{tid}")).status_code == 200
    return tid


# --------------------------------------------------------------------------- #
# (1) NEGATIVE (critical): no PIN → purge is refused AND nothing is deleted.
# --------------------------------------------------------------------------- #
async def test_purge_without_pin_is_refused_and_deletes_nothing(app_client):
    tid = await _soft_delete_one_transaction(app_client)
    total_before, soft_before = await _txn_counts()
    assert soft_before >= 1  # there is a soft-deleted row that a purge *would* remove

    # No PIN is set on a fresh demo install → permanent delete must be forbidden.
    purge = await app_client.post("/api/v1/portfolio/purge-deleted")
    assert purge.status_code == 403, purge.text

    # Nothing was removed — the soft-deleted row is still physically present...
    total_after, soft_after = await _txn_counts()
    assert (total_after, soft_after) == (total_before, soft_before)
    # ...and because it still exists, it can still be restored (it was NOT hard-deleted).
    assert (await app_client.post(f"/api/v1/portfolio/transactions/{tid}/restore")).status_code == 200


# --------------------------------------------------------------------------- #
# (2) POSITIVE: PIN set + authenticated → purge removes soft-deleted rows only;
#     live rows and net worth are untouched.
# --------------------------------------------------------------------------- #
async def test_purge_with_pin_removes_soft_deleted_only(app_client):
    await _soft_delete_one_transaction(app_client)

    # Invariants captured AFTER the soft-delete (already excluded from computation).
    nw_before = (await app_client.get("/api/v1/dashboard/home")).json()["portfolio"]["total_value"]
    live_before = len((await app_client.get("/api/v1/portfolio/transactions")).json()["transactions"])
    total_before, soft_before = await _txn_counts()
    assert soft_before >= 1

    # Set a PIN → the returned cookie authenticates the client for the purge.
    assert (await app_client.post("/api/v1/auth/set-pin", json={"pin": "008642"})).status_code == 200

    purge = await app_client.post("/api/v1/portfolio/purge-deleted")
    assert purge.status_code == 200
    assert purge.json()["transactions_purged"] == soft_before

    # Soft-deleted rows are physically gone; the live-row count dropped by exactly them.
    total_after, soft_after = await _txn_counts()
    assert soft_after == 0
    assert total_after == total_before - soft_before

    # Live ledger + net worth are unchanged by the purge (it only removed excluded rows).
    live_after = len((await app_client.get("/api/v1/portfolio/transactions")).json()["transactions"])
    nw_after = (await app_client.get("/api/v1/dashboard/home")).json()["portfolio"]["total_value"]
    assert live_after == live_before
    assert nw_after == nw_before


# --------------------------------------------------------------------------- #
# (3) A soft-deleted-then-purged row cannot be restored (it is truly gone).
# --------------------------------------------------------------------------- #
async def test_purged_transaction_cannot_be_restored(app_client):
    tid = await _soft_delete_one_transaction(app_client)
    assert (await app_client.post("/api/v1/auth/set-pin", json={"pin": "007531"})).status_code == 200
    assert (await app_client.post("/api/v1/portfolio/purge-deleted")).status_code == 200

    # Row is physically gone → restore 404 (client is authenticated via the set-pin cookie).
    restore = await app_client.post(f"/api/v1/portfolio/transactions/{tid}/restore")
    assert restore.status_code == 404


# --------------------------------------------------------------------------- #
# (4) require_pin is an ADDITIONAL gate: it doesn't change require_auth endpoints.
# --------------------------------------------------------------------------- #
async def test_require_pin_does_not_affect_require_auth_endpoints(app_client):
    # No PIN: a require_auth mutation still works locally (unchanged behaviour).
    assert (await app_client.post("/api/v1/watchlists", json={"name": "A", "symbols": []})).status_code == 200
    # With a PIN set + authenticated, require_auth mutations still work.
    assert (await app_client.post("/api/v1/auth/set-pin", json={"pin": "002468"})).status_code == 200
    assert (await app_client.post("/api/v1/watchlists", json={"name": "B", "symbols": []})).status_code == 200


# --------------------------------------------------------------------------- #
# Bonus security proof: a read-only API token can never purge.
# --------------------------------------------------------------------------- #
async def test_api_token_cannot_purge(app_client):
    # Mint a read-only API token, then present ONLY the token (no session cookie).
    mint = await app_client.post("/api/v1/tokens", json={"name": "readonly"})
    assert mint.status_code == 200
    raw = mint.json()["token"]
    app_client.cookies.clear()
    r = await app_client.post("/api/v1/portfolio/purge-deleted",
                              headers={"Authorization": f"Token {raw}"})
    assert r.status_code == 403
