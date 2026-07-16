# SPDX-License-Identifier: AGPL-3.0-or-later
"""Estate page-build Phase 0 — the §9 contract/behaviour deltas, fail-first.

Each test is written to be RED on the pre-delta code and GREEN after the delta it guards
(page-estate §9, owner-ruled one-pass 2026-07-16). Grouped by the ruling number it pins.
"""

from __future__ import annotations

import app.models  # noqa: F401 — register models on Base.metadata for the `session` fixture's create_all


# --------------------------------------------------------------------------- #
# 9-1 — GET /estate/meta is DELETED; /refdata is the single D-005 vocab source.
# The removal is discriminated by response SHAPE, not status: an unmatched /api/ path
# is an honest JSON 404 today, but the SPA catch-all returns 200 HTML in production, so
# only a shape assertion is portable (page-estate §3b, the Insurance §9-3 precedent).
# --------------------------------------------------------------------------- #
async def test_estate_meta_endpoint_removed_by_shape(app_client):
    """The retired endpoint no longer serves the meta shape. RED today: it returns the
    four bare-list vocab keys (`doc_categories`, `contact_roles`, ...)."""
    r = await app_client.get("/api/v1/estate/meta")
    ctype = r.headers.get("content-type", "")
    body = r.json() if ctype.startswith("application/json") else None
    # The meta shape (its four vocab keys) is GONE — not merely a different status.
    assert not (isinstance(body, dict) and "doc_categories" in body and "contact_roles" in body), (
        "GET /estate/meta still serves the meta shape — it must be deleted (§9-1)"
    )
    # /refdata is the single source and still serves all four estate vocabs as {value,label}.
    refdata = (await app_client.get("/api/v1/refdata")).json()
    for key in ("will_status", "estate_doc_status", "estate_doc_category", "contact_role"):
        assert refdata[key], f"/refdata must serve {key}"
        assert all({"value", "label"} <= set(o) for o in refdata[key])


# --------------------------------------------------------------------------- #
# 9-5 (+ Amendment E) — `relationship` is retired: the served contact no longer
# carries it (the field is dropped from ContactIn + _contact_dict; the column is
# dropped by migration with a fold-into-notes backfill — see the migration test).
# --------------------------------------------------------------------------- #
async def test_served_contact_has_no_relationship_field(app_client):
    """The estate contact shape no longer serves `relationship` (D-010/D-063: dropped,
    folded into roles/notes). RED today: `_contact_dict` still serves the free-text field."""
    r = await app_client.post("/api/v1/estate/contacts",
                              json={"name": "Spouse", "roles": ["nominee", "executor"]})
    created = r.json()
    assert created["ok"]
    assert "relationship" not in created, "the write response must not carry `relationship`"
    contacts = (await app_client.get("/api/v1/estate")).json()["contacts"]
    assert contacts, "expected the created contact to be served"
    assert all("relationship" not in c for c in contacts), (
        "GET /estate contacts must not carry `relationship` — it is retired (§9-5)"
    )
    # A stray `relationship` in the request body is simply ignored (extra field), never persisted/served.
    r2 = await app_client.post("/api/v1/estate/contacts",
                               json={"name": "Sibling", "relationship": "sister", "roles": ["emergency"]})
    assert r2.json()["ok"]
    assert "relationship" not in r2.json()


# --------------------------------------------------------------------------- #
# 9-2 — the estate register is household-scoped; ?entity_id is REJECTED (honest 400)
# on EVERY endpoint (reads AND writes), never silently ignored. No entity FK exists
# (D-063), so a scope param could only produce a precise-looking, meaningless answer.
# --------------------------------------------------------------------------- #
async def test_entity_id_rejected_with_400_on_every_endpoint(app_client):
    """Every estate endpoint rejects `?entity_id` with an honest, plain-language 400.
    RED today: the unknown param is silently dropped and each request returns 200."""
    calls = [
        ("get", "/api/v1/estate", None),
        ("put", "/api/v1/estate/profile", {}),
        ("post", "/api/v1/estate/contacts", {"name": "X"}),
        ("patch", "/api/v1/estate/contacts/1", {"name": "X"}),
        ("delete", "/api/v1/estate/contacts/1", None),
        ("post", "/api/v1/estate/documents", {"title": "X"}),
        ("patch", "/api/v1/estate/documents/1", {"title": "X"}),
        ("delete", "/api/v1/estate/documents/1", None),
    ]
    for method, path, body in calls:
        kwargs = {"params": {"entity_id": 1}}
        if body is not None:
            kwargs["json"] = body
        r = await getattr(app_client, method)(path, **kwargs)
        assert r.status_code == 400, f"{method.upper()} {path} accepted ?entity_id (got {r.status_code})"
        detail = r.json()["detail"].lower()
        assert "household" in detail, f"{method.upper()} {path} 400 must say household-scoped: {detail!r}"
        # plain language only — no decision IDs / impl notes in served copy (copy hygiene)
        assert "d-063" not in detail and "entity_id" not in detail

    # The unscoped read still works.
    assert (await app_client.get("/api/v1/estate")).status_code == 200


# --------------------------------------------------------------------------- #
# 9-7 (A11, test-only) — doc-attention is computed twice, independently:
# estate_report().readiness.docs_attention (estate.py:154) and the count inside
# estate_signals() (estate.py:175), on the same predicate `status in (missing, outdated)`.
# The ruling was consistent-by-construction + an EQUALITY TEST (no refactor). The test IS
# the mechanism: if the two predicates ever diverge, it goes RED.
# --------------------------------------------------------------------------- #
async def test_doc_attention_count_is_one_derivation(session):
    """readiness.docs_attention == the count estate_signals() reports, on a fixture holding
    `missing` + `outdated` + `present` documents. Pins the two derivations to one answer."""
    import re

    from app.services.estate import create_document, estate_report, estate_signals

    await create_document(session, {"title": "Property deed", "status": "missing"})
    await create_document(session, {"title": "Will copy", "status": "outdated"})
    await create_document(session, {"title": "Passport", "status": "present"})
    await session.commit()

    docs_attention = (await estate_report(session))["readiness"]["docs_attention"]
    assert docs_attention == 2  # missing + outdated; present excluded

    signals = await estate_signals(session)
    sig = next((s for s in signals if "missing or outdated" in s), None)
    assert sig is not None, "estate_signals must emit a missing/outdated attention line"
    n = int(re.match(r"(\d+)", sig).group(1))
    assert n == docs_attention, (
        "the two doc-attention derivations disagree — readiness.docs_attention and "
        "estate_signals() must stay one answer (§9-7)"
    )


# --------------------------------------------------------------------------- #
# 9-8 (D-059) — _REVIEW_SOON_DAYS = 30 is now a named constant in PRODUCT-SPEC §5.
# A same-batch code test pins the SERVED threshold (the page-review §13 lesson: a spec
# edit alone leaves the code free to silently disagree), fail-first.
# --------------------------------------------------------------------------- #
async def test_review_soon_days_threshold_is_30_per_spec(session):
    """The estate review-due signal fires within 30 days (inclusive) and stays silent at 31 —
    pinning the served threshold to the D-059 spec value. RED if the constant/behaviour drifts."""
    from datetime import UTC, datetime, timedelta

    from app.services.estate import _REVIEW_SOON_DAYS, estate_signals, get_or_create_profile

    assert _REVIEW_SOON_DAYS == 30, "the constant must match the PRODUCT-SPEC §5 D-059 value"

    p = await get_or_create_profile(session)
    today = datetime.now(UTC).date()

    p.next_review_date = (today + timedelta(days=_REVIEW_SOON_DAYS)).isoformat()  # exactly at the horizon
    await session.commit()
    assert any("Estate review due in" in s for s in await estate_signals(session)), (
        "a review due in 30 days must surface (30 <= _REVIEW_SOON_DAYS)"
    )

    p.next_review_date = (today + timedelta(days=_REVIEW_SOON_DAYS + 1)).isoformat()  # one day past
    await session.commit()
    assert not any("Estate review due in" in s for s in await estate_signals(session)), (
        "a review due in 31 days must NOT surface (31 > _REVIEW_SOON_DAYS) — pins the threshold at 30"
    )


# --------------------------------------------------------------------------- #
# 9-10 — STANDING legal-advice-language content guard (PERMANENT; the Scenarios
# D-058 forecast-guard / Insurance adequacy-guard precedent). Estate is a readiness
# register, NEVER legal advice. No directive/advice phrasing may appear in ANY served
# estate copy — the ratified disclaimer itself must also pass. Do NOT delete or scope
# this down: it is a standing invariant, not a one-off Phase-0 check.
# --------------------------------------------------------------------------- #
# The banned directive/advice phrasings, ruled verbatim (page-estate §9-10).
_ADVICE_PHRASES = (
    "you should", "we recommend", "draft your will", "you must",
    "make sure you", "it is advisable",
)


async def _served_estate_copy(app_client) -> list[str]:
    """Every app-AUTHORED string the estate surface serves: the ratified disclaimer, the
    household-scoped rejection message, and each `estate_signals()` template (surfaced verbatim
    in the Review attention feed). User data (names, notes) is NOT app copy and is excluded."""
    copy: list[str] = []
    rep = (await app_client.get("/api/v1/estate")).json()
    copy.append(rep["disclaimer"])
    copy.append((await app_client.get("/api/v1/estate", params={"entity_id": 1})).json()["detail"])

    from datetime import UTC, datetime, timedelta

    today = datetime.now(UTC).date()

    async def _estate_review_titles() -> list[str]:
        rev = (await app_client.get("/api/v1/portfolio/review")).json()
        return [i["title"] for i in rev["items"] if i["area"] == "Estate"]

    # State 1 — no will + overdue review + a missing document (three templates).
    await app_client.put("/api/v1/estate/profile", json={
        "will_status": "none", "next_review_date": (today - timedelta(days=10)).isoformat()})
    await app_client.post("/api/v1/estate/documents", json={"title": "Property deed", "status": "missing"})
    copy += await _estate_review_titles()

    # State 2 — will needs update + a review due soon (the remaining two templates).
    await app_client.put("/api/v1/estate/profile", json={
        "will_status": "needs_update", "next_review_date": (today + timedelta(days=10)).isoformat()})
    copy += await _estate_review_titles()
    return copy


async def test_no_advice_language_in_served_estate_copy(app_client):
    copy = await _served_estate_copy(app_client)
    # the ratified disclaimer is in the scanned set and must itself pass the guard
    assert any("Not legal or estate-planning advice" in t for t in copy), "disclaimer missing from scanned copy"
    # every estate_signals template was exercised (guard proves what it exercises)
    joined = " || ".join(copy)
    for template in ("No will recorded", "needing an update", "missing or outdated",
                     "overdue", "Estate review due in"):
        assert template in joined, f"expected the {template!r} signal in the scanned copy"
    for text in copy:
        low = text.lower()
        for phrase in _ADVICE_PHRASES:
            assert phrase not in low, f"advice phrasing {phrase!r} in served estate copy: {text!r}"


