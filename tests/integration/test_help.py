# SPDX-License-Identifier: AGPL-3.0-or-later
"""Help knowledge base — endpoint, search, and AI grounding in help."""

from __future__ import annotations

from app.services.help import HELP, all_help, search_help

_GLOSSARY_FIELDS = ("what", "why", "improves")


def test_help_ids_are_unique():
    ids = [e["id"] for e in HELP]
    assert len(ids) == len(set(ids))


def test_terms_entries_have_glossary_fields():
    terms = [e for e in HELP if e["category"] == "Terms"]
    assert terms
    for e in terms:
        for k in _GLOSSARY_FIELDS:
            assert e.get(k, "").strip(), f"{e['id']} missing/empty {k}"


def test_metric_glossary_terms_present():
    # The portfolio-metric terms authored for key_stats() coverage (Phase 3.2).
    expected = {
        "term-total-value", "term-unrealised-pl", "term-income", "term-income-yield",
        "term-total-return", "term-period-return", "term-volatility", "term-return-volatility",
        "term-max-drawdown", "term-allocation-weight", "term-concentration",
    }
    by_id = {e["id"]: e for e in HELP}
    assert expected <= set(by_id), expected - set(by_id)
    for tid in expected:
        e = by_id[tid]
        assert e["category"] == "Terms"
        for k in _GLOSSARY_FIELDS:
            assert e.get(k, "").strip(), f"{tid} missing/empty {k}"


def test_attribution_and_risk_glossary_terms_present():
    # §4.5 D1/D2 reference these seven term_ids — all must exist as non-empty Terms.
    expected = {
        "term-attribution", "term-beta", "term-correlation", "term-downside-deviation",
        "term-information-ratio", "term-tracking-error", "term-hhi",
    }
    by_id = {e["id"]: e for e in HELP}
    assert expected <= set(by_id), expected - set(by_id)
    for tid in expected:
        e = by_id[tid]
        assert e["category"] == "Terms"
        for k in _GLOSSARY_FIELDS:
            assert e.get(k, "").strip(), f"{tid} missing/empty {k}"


def test_risk_ratios_carry_no_risk_free_rate_honesty():
    # The two ratios that could be mistaken for risk-adjusted-return measures MUST state they
    # use no risk-free rate (matching term-return-volatility's "deliberately NOT a Sharpe" ethos).
    by_id = {e["id"]: e for e in HELP}
    for tid in ("term-downside-deviation", "term-information-ratio"):
        text = (by_id[tid]["what"] + by_id[tid]["body"]).lower()
        assert "risk-free" in text, f"{tid} must disclose no risk-free rate"
        assert "not" in text and ("sortino" in text or "sharpe" in text), \
            f"{tid} must state it is not a Sharpe/Sortino ratio"
    # And no term prescribes action — advice-free ("you should" / "aim for" / "a good value").
    for e in HELP:
        if e["category"] != "Terms":
            continue
        blob = " ".join(e.get(k, "") for k in _GLOSSARY_FIELDS).lower()
        for banned in ("you should", "aim for", "a good value", "we recommend"):
            assert banned not in blob, f"{e['id']} contains advisory phrasing: {banned!r}"


def test_all_help_surfaces_glossary_for_terms_only():
    by_id = {e["id"]: e for e in all_help()["entries"]}
    # Terms entries surface the three fields...
    for e in HELP:
        projected = by_id[e["id"]]
        if e["category"] == "Terms":
            for k in _GLOSSARY_FIELDS:
                assert projected[k] == e[k]
        else:
            # ...and non-Terms entries omit them (no KeyError on projection).
            for k in _GLOSSARY_FIELDS:
                assert k not in projected


def test_search_ranks_relevant_entries():
    r = search_help("how do I set a target allocation")
    assert r and r[0]["title"] == "Investment policy"
    assert search_help("what is xirr")[0]["title"] == "XIRR & TWR"


async def test_help_endpoint_all_and_query(app_client):
    all_ = (await app_client.get("/api/v1/help")).json()
    assert all_["entries"] and "categories" in all_
    titles = {e["title"] for e in all_["entries"]}
    assert {"Investment policy", "XIRR & TWR", "Pricing health"} <= titles

    q = (await app_client.get("/api/v1/help", params={"q": "how do I refresh a stale price"})).json()
    assert q["entries"] and any("Pricing" in e["title"] for e in q["entries"])


async def test_help_wire_response_keeps_the_conditional_glossary_triad(app_client):
    """§9-12 Phase 0 — the SHAPE guard, asserted on the WIRE, not the projection.

    `test_all_help_surfaces_glossary_for_terms_only` proves `all_help()` projects the triad
    onto Terms entries only. It calls the SERVICE, so it stays green even if the ENDPOINT
    stops serving the triad — which is exactly what a `response_model` does by default: it
    STRIPS undeclared keys, and it EMITS declared-but-unset ones as `null`
    (the `HoldingView.price_display` trap, TEMPLATE §3b).

    Seen RED on a naive `response_model` in two distinct ways before the fix landed:
      - triad omitted from the model      -> Terms entries lose what/why/improves entirely
      - triad declared without exclusion  -> Pages/About entries gain "what": null
    Both are silent losses a service-level test cannot see.
    """
    body = (await app_client.get("/api/v1/help")).json()
    assert body["categories"] == ["Pages", "Terms", "About"]

    by_id = {e["id"]: e for e in body["entries"]}
    assert len(by_id) == len(HELP), "the wire dropped entries"

    for e in HELP:
        served = by_id[e["id"]]
        assert set(served) >= {"id", "category", "title", "body"}
        if e["category"] == "Terms":
            for k in _GLOSSARY_FIELDS:
                assert served.get(k), f"{e['id']} lost {k} on the wire"
        else:
            # Absent, not null — a null triad would render an empty section on the page.
            for k in _GLOSSARY_FIELDS:
                assert k not in served, f"{e['id']} leaked a null {k} onto the wire"


async def test_help_search_wire_response_omits_the_triad(app_client):
    """Search results are the compact projection (`search_help` returns 4 keys only)."""
    body = (await app_client.get("/api/v1/help", params={"q": "what is xirr"})).json()
    assert body["query"] == "what is xirr"
    assert body["entries"]
    for e in body["entries"]:
        assert set(e) == {"id", "category", "title", "body"}


async def test_ai_facts_grounded_in_help(app_client):
    d = (await app_client.get("/api/v1/ai/facts", params={"q": "what is XIRR?"})).json()
    assert any(f["label"].startswith("Help") for f in d["facts"])
