# SPDX-License-Identifier: AGPL-3.0-or-later
"""Reports Pack (`GET /reports/pack`) — the print/export artifact (D-038/D-061, reports-pack §3b).

Content pins for Phase 0 (reports-pack §11). The artifact is asserted directly (the §14 lesson:
assert the RENDERED artifact, not a DOM theory). Fail-first: with the route removed the path 404s
(demonstrated at build time by disabling the registration); the empty/zero cases were seen to
render the served reason before the honest-note branches were wired.
"""

from __future__ import annotations

from app.models import Entity
from app.services.reports_pack import render_reports_pack

# ------------------------------------------------------------------------ the route + seeded content


async def test_reports_pack_route_serves_html_with_the_header_block(app_client):
    """The route exists, serves HTML, and carries the Pack-5 header block (title · generated ·
    base currency · not-advice)."""
    resp = await app_client.get("/reports/pack")
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"].startswith("text/html")
    html = resp.text
    assert "<h1>Reports Pack</h1>" in html
    assert "Generated" in html
    assert "Base currency" in html
    assert "reporting only, not tax or financial advice" in html  # Pack-5 not-advice line


async def test_reports_pack_renders_all_four_consolidated_sections(app_client):
    """Pack-1 order: consolidated = net-worth trend · review · cash flow · scenarios."""
    html = (await app_client.get("/reports/pack")).text
    assert '<div class="pack-group-label">Consolidated</div>' in html
    for heading in ("Net worth trend", "Review", "Cash flow", "Scenarios"):
        assert f"<h2>{heading}</h2>" in html, f"missing consolidated section: {heading}"


async def test_reports_pack_renders_a_per_entity_section_per_seeded_entity(app_client):
    """Pack-6: one per-entity section per entity, alphabetical, composed with entity_id (§9-2)."""
    entities = (await app_client.get("/api/v1/entities")).json()["entities"]
    assert entities, "the demo seed should define at least one entity"
    html = (await app_client.get("/reports/pack")).text
    assert '<div class="pack-group-label">Per-entity</div>' in html
    for ent in entities:
        assert f"Per-entity &mdash; {ent['name']}" in html or f"Per-entity — {ent['name']}" in html, (
            f"missing per-entity section for {ent['name']!r}"
        )
    assert html.count('pack-section--entity') == len(entities)


async def test_reports_pack_preserves_a_served_disclaimer_verbatim(app_client):
    """Pack-5/D-061: a reader's served disclaimer renders verbatim inside the artifact."""
    html = (await app_client.get("/reports/pack")).text
    # The review reader's served disclaimer (review.py:259).
    assert "reporting only, not advice or a required action." in html


# ------------------------------------------------------------------- Pack-3 empty / Pack-4 degenerate


async def test_empty_entity_renders_served_reasons_not_blanks_or_zeros(session):
    """Pack-3 / Guarantee 3: an entity with no accounts renders each reader's honest served reason,
    never a blank or a fabricated 0 — and the section stays present (structural stability)."""
    session.add(Entity(name="Empty Estate", kind="trust"))
    await session.commit()

    html = await render_reports_pack(session)
    assert "Per-entity &mdash; Empty Estate" in html or "Per-entity — Empty Estate" in html
    # Each entity-aware reader's honest empty reason (Pack-3), not a 0:
    assert "No holdings recorded for this entity." in html          # value_portfolio empty
    assert "No policy targets set for this entity" in html          # drift has_targets=False
    assert "No realised events recorded for" in html                # realised currency_groups=[]
    assert "Risk metrics unavailable" in html                       # risk available=False
    assert "insufficient cost basis" in html                        # attribution served reason


async def test_zero_entities_renders_consolidated_plus_the_omission_note(session):
    """Pack-4 degenerate case: zero entities → consolidated view + an honest omission note, and NO
    per-entity entity section (no empty shell)."""
    html = await render_reports_pack(session)
    assert '<div class="pack-group-label">Consolidated</div>' in html
    assert "No ownership entities are defined" in html
    # The omission-note card is the only thing under Per-entity — no real entity section.
    assert "Per-entity &mdash;" not in html and "Per-entity —" not in html


async def test_single_entity_still_renders_its_per_entity_section(session):
    """Pack-4 recording note: with ONE entity, its per-entity section still renders (the partial
    overlap with consolidated is accepted, not collapsed)."""
    session.add(Entity(name="Solo Household", kind="self"))
    await session.commit()

    html = await render_reports_pack(session)
    assert "Per-entity &mdash; Solo Household" in html or "Per-entity — Solo Household" in html
    assert html.count("pack-section--entity") == 1
