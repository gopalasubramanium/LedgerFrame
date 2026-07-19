# SPDX-License-Identifier: AGPL-3.0-or-later
"""Clearing demo data, seed-once behaviour, and live-data refresh endpoint."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


async def test_reset_without_pin_is_refused(app_client):
    # D-103 (page-settings System tab): reset-data is require_pin — a destructive, irreversible
    # wipe must be impossible on a no-PIN install. No PIN set → 403, and nothing is deleted.
    before = (await app_client.get("/api/v1/portfolio/holdings")).json()["holdings"]
    assert len(before) > 0
    r = await app_client.post("/api/v1/system/reset-data")
    assert r.status_code == 403, r.text
    # Data is untouched.
    after = (await app_client.get("/api/v1/portfolio/holdings")).json()["holdings"]
    assert len(after) == len(before)


async def test_reset_clears_holdings_and_blocks_reseed(app_client):
    # Demo data is present initially.
    before = (await app_client.get("/api/v1/portfolio/holdings")).json()["holdings"]
    assert len(before) > 0
    # D-103: set a PIN → the returned cookie authenticates the client for the PIN-gated reset.
    assert (await app_client.post("/api/v1/auth/set-pin", json={"pin": "009753"})).status_code == 200
    # Clear it — §14dr-20/D-103: the fresh PIN is threaded through (an unlocked session alone
    # does NOT satisfy the wipe).
    r = await app_client.post("/api/v1/system/reset-data", json={"pin": "009753"})
    assert r.status_code == 200
    # THE GATE RE-FIRES HERE, and this line is the evidence rather than a workaround (page-legal
    # §11-D3). The reset erased this install's Legal acceptance along with the data, so the very
    # next read is 451 — the install is genuinely back in first-run posture, which is the whole
    # claim. Re-accept, as a returning user would, then assert the wipe. Asserting the 451 first
    # is deliberate: without it this line would look like fixture noise to the next reader, and
    # someone would eventually "simplify" it away.
    assert (await app_client.get("/api/v1/portfolio/holdings")).status_code == 451
    assert (await app_client.post("/api/v1/legal/acceptance",
                                  json={"action": "accepted"})).status_code == 200
    after = (await app_client.get("/api/v1/portfolio/holdings")).json()["holdings"]
    assert after == []
    # Transactions gone too.
    txns = (await app_client.get("/api/v1/portfolio/transactions")).json()["transactions"]
    assert txns == []


async def test_reset_demands_a_fresh_pin_not_the_ambient_session(app_client):
    # §14dr-20 / D-103: reset-data, like purge, always demands a freshly-entered PIN — an
    # unlocked/ambient session never satisfies it (RED before the fix: the PIN was discarded).
    before = (await app_client.get("/api/v1/portfolio/holdings")).json()["holdings"]
    assert len(before) > 0
    assert (await app_client.post("/api/v1/auth/set-pin", json={"pin": "024680"})).status_code == 200
    # Unlocked session but the WRONG fresh PIN → refused, and nothing is wiped.
    wrong = await app_client.post("/api/v1/system/reset-data", json={"pin": "111111"})
    assert wrong.status_code == 401
    after = (await app_client.get("/api/v1/portfolio/holdings")).json()["holdings"]
    assert len(after) == len(before)
    # The correct fresh PIN → the reset proceeds.
    ok = await app_client.post("/api/v1/system/reset-data", json={"pin": "024680"})
    assert ok.status_code == 200


# --------------------------------------------------------------------------- #
# §14dr-26 — "Erase all data" must purge EVERY user-data table.
# The owner's erase-and-rebuild walk found Insurance and Estate rows surviving a
# reset. Root cause: reset_data deleted a hardcoded 12-table list that predated the
# insurance/estate/planning milestones. These pins seed EVERY user-data table and
# assert zero rows after reset, iterating live metadata so a future table can't
# silently survive a purge.
# --------------------------------------------------------------------------- #

# Tables reset-data deliberately PRESERVES (D-103 docstring: "Keeps your settings,
# PIN, and provider config"). Everything else in Base.metadata is user data and MUST
# be purged. Kept: settings/PIN/access bookkeeping + security log + re-syncable
# provider reference caches + the provider routing preference (provider config).
# (alembic_version is preserved automatically — it is alembic-managed, not a mapped
# model, so it never appears in the Base.metadata iteration the purge walks.)
# legal_acceptance_events is NOT in this list, and its absence is a DECISION, not an omission
# (page-legal §11-D3, architect under delegation, 2026-07-20). It was briefly kept — install-level
# consent, same family as the PIN — and the owner's ruling INVERTED that: the gate binds the person
# using the install, so a reset returns first-run posture and a surviving acceptance would be the
# PREVIOUS user's. It is therefore purged with the data, deliberately, and the erasure is STATED in
# the reset control's copy (pinned by `test_the_reset_confirmation_copy_STATES_the_erasure` below)
# so it is never a silent re-lock. Behaviour pinned by
# `test_a_data_reset_ERASES_acceptance_and_the_gate_RE_FIRES`. ⚑ REVERSIBLE at the re-look.
# It is named here rather than left unmentioned because §14dr-26's whole point is that a table's
# fate is triaged, and "absent from the keep list" and "nobody thought about it" look identical.
_RESET_KEEP_EXPECTED = {
    "settings", "users", "api_token", "revoked_token",   # settings / PIN / access
    "audit_events", "backup_records",                     # security + backup bookkeeping
    "amfi_schemes", "coingecko_coins", "ecb_fx_rates",    # provider reference caches
    "kite_instruments", "routing_matrix",                 # (re-syncable) + provider config
}


# --------------------------------------------------------------------------- #
# The copy condition attached to the erasure ruling (page-legal §11-D3).
# --------------------------------------------------------------------------- #

# The reset confirmation is authored frontend copy, so this reads the source. That is unusual for a
# backend module and it is deliberate: the CONDITION lives with the behaviour it constrains. A
# guard for "the copy says what the server does" placed in the frontend suite would sit nowhere
# near the purge list it is about, and the next person to edit that list would never see it.
_RESET_CONFIRM_SOURCE = REPO / "frontend/src/routes/Settings.tsx"

# Deliberately a DISJUNCTION over meaning-bearing phrasings, not one exact string. Pinning the
# sentence verbatim would make every copy edit a test failure and train the next person to update
# the assertion without reading it — which is how a copy guard becomes a rubber stamp. What must
# hold is that the confirmation TELLS THE USER the legal acceptance goes; the wording is the
# author's.
_ERASURE_IS_STATED = (
    "accepted the Legal",
    "acceptance of the Legal",
    "accept the Legal terms again",
    "ask you to accept",
)


def test_the_reset_confirmation_copy_STATES_the_erasure():
    """A reset that withdraws consent must SAY SO before it happens.

    This is the condition the predecessor test attached to the ruling in as many words: *"if that
    is the intended behaviour it must be stated in the reset control's copy — silently re-locking
    the app is not it."* The owner ruled for erasure (§11-D3), so the condition is now binding.

    Why it needs a guard rather than good intentions: the erasure and the copy live in different
    languages, different suites, and different halves of the repo. Nothing except this test makes
    deleting the sentence fail. The failure mode without it is the specific one the ruling was
    trying to avoid — a user presses "Reset data", is told their settings and PIN are kept, and is
    then locked out by a gate the dialog never mentioned.
    """
    src = _RESET_CONFIRM_SOURCE.read_text(encoding="utf-8")
    assert any(p in src for p in _ERASURE_IS_STATED), (
        "The reset-data confirmation copy no longer tells the user that resetting also erases "
        "their acceptance of the Legal terms and re-locks the app.\n\n"
        "That erasure is SPECIFIED behaviour (page-legal §11-D3) — see "
        "test_a_data_reset_ERASES_acceptance_and_the_gate_RE_FIRES. The copy is the only reason it "
        "is not a silent re-lock, and it is the half a reader is most likely to drop by accident.\n"
        f"Expected the confirmation in {_RESET_CONFIRM_SOURCE.relative_to(REPO)} to contain one "
        f"of: {_ERASURE_IS_STATED}"
    )


async def _seed_every_user_table(session):
    """Add at least one row to every user-data table the demo seed does not already
    cover (goals/obligations/contributions/investment policy/review log), so the
    after-reset assertion is meaningful for all of them."""
    from app.models import (
        Contribution,
        Goal,
        InvestmentPolicy,
        Obligation,
        PolicyTarget,
        ReviewLog,
    )

    ips = InvestmentPolicy(name="IPS")
    session.add(ips)
    await session.flush()
    session.add_all([
        Goal(name="Retire", target_amount=1000),
        Obligation(name="Tax", amount=100, due_date="2027-01-01"),
        Contribution(name="Monthly SIP", amount=50),
        PolicyTarget(policy_id=ips.id, dimension="asset_class", bucket="equity", target_pct=60),
        ReviewLog(net_worth=1000, base_currency="SGD"),
    ])
    await session.commit()


async def _table_counts(user_only: bool = False):
    from sqlalchemy import func
    from sqlalchemy import select as sa_select

    from app.db.base import Base, get_sessionmaker

    counts: dict[str, int] = {}
    async with get_sessionmaker()() as s:
        for name, tbl in Base.metadata.tables.items():
            if user_only and name in _RESET_KEEP_EXPECTED:
                continue
            counts[name] = (await s.execute(sa_select(func.count()).select_from(tbl))).scalar() or 0
    return counts


async def test_reset_purges_every_user_data_table(app_client):
    # §14dr-26 RED-before / GREEN-after: the demo seed populates accounts, insurance,
    # estate, holdings, tags, entities, snapshots…; we add the remaining planning tables.
    from app.db.base import get_sessionmaker

    async with get_sessionmaker()() as s:
        await _seed_every_user_table(s)

    before = await _table_counts(user_only=True)
    # Sanity: the seed actually populated the tables the owner saw survive, so the
    # after-assertion is not vacuously green.
    for name in ("accounts", "insurance_policy", "estate_profile", "estate_contact",
                 "estate_document", "goals", "obligations", "contribution",
                 "investment_policy", "policy_targets", "review_log", "holding_tag",
                 "entities", "holdings", "transactions"):
        assert before.get(name, 0) > 0, f"seed did not populate {name}; pin is vacuous"

    # D-103: set a PIN, then reset with the FRESH PIN.
    assert (await app_client.post("/api/v1/auth/set-pin", json={"pin": "013579"})).status_code == 200
    r = await app_client.post("/api/v1/system/reset-data", json={"pin": "013579"})
    assert r.status_code == 200, r.text

    after = await _table_counts(user_only=True)
    survivors = {name: n for name, n in after.items() if n > 0}
    assert survivors == {}, f"user-data rows survived the erase: {survivors}"


async def test_reset_keeps_settings_pin_and_provider_reference(app_client):
    # The KEEP set is preserved: the PIN still authenticates, the seed flag is set (no
    # re-seed), and provider reference caches are not wiped. Seed a coingecko coin +
    # routing cell to prove they survive.
    from app.db.base import get_sessionmaker
    from app.models import CoingeckoCoin, RoutingMatrix

    async with get_sessionmaker()() as s:
        # Distinct keys so we never collide with demo-seeded coins / routing cells.
        s.add(CoingeckoCoin(id="dr26-probe-coin", symbol="zzz", name="Probe"))
        s.add(RoutingMatrix(asset_class="commodity", listing_country="ZZ", provider="mock"))
        await s.commit()

    assert (await app_client.post("/api/v1/auth/set-pin", json={"pin": "246800"})).status_code == 200
    assert (await app_client.post("/api/v1/system/reset-data", json={"pin": "246800"})).status_code == 200

    kept = await _table_counts()
    assert kept["coingecko_coins"] >= 1, "provider reference cache was wiped"
    assert kept["routing_matrix"] >= 1, "provider routing config was wiped"
    # Seed flag persists so demo is not re-seeded (settings table kept).
    from sqlalchemy import select as sa_select

    from app.models import Setting
    from app.seed.demo import SEED_FLAG_KEY
    async with get_sessionmaker()() as s:
        flag = (await s.execute(sa_select(Setting).where(Setting.key == SEED_FLAG_KEY))).scalars().first()
        assert flag is not None and flag.value == "1"


async def test_reset_keep_list_matches_metadata_guard(app_client):
    # Guard: the app's KEEP allow-list must reference only real tables, and every
    # metadata table must be classified (KEEP or purged). A new table is purged by
    # default (safe direction); a new table that should be KEPT must be added to the
    # app constant AND here — otherwise this guard breaks the build (§14dr-26).
    from app.api.v1.routes.system import RESET_KEEP_TABLES
    from app.db.base import Base

    # No stale names in the app KEEP set — every kept name is a real mapped table.
    assert set(Base.metadata.tables) >= RESET_KEEP_TABLES, \
        RESET_KEEP_TABLES - set(Base.metadata.tables)
    # App and test agree on exactly what is preserved.
    assert RESET_KEEP_TABLES == _RESET_KEEP_EXPECTED, (RESET_KEEP_TABLES, _RESET_KEEP_EXPECTED)


async def test_seed_runs_once(session):
    from app.seed.demo import seed_demo_data

    assert await seed_demo_data(session) is True       # first time seeds
    assert await seed_demo_data(session) is False       # flag set → no re-seed


async def test_refresh_data_endpoint(app_client):
    r = await app_client.post("/api/v1/system/refresh-data")
    assert r.status_code == 200
    body = r.json()
    assert "refreshed" in body and "total" in body


async def test_data_source_switch_applies_in_process(app_client, tmp_path, monkeypatch):
    import app.core.envfile as envfile

    monkeypatch.setattr(envfile, "ENV_PATH", tmp_path / ".env")
    r = await app_client.put("/api/v1/system/data-source", json={"provider": "csv"})
    assert r.status_code == 200
    assert r.json()["applied"] is True
