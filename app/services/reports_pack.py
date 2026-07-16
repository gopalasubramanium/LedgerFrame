# SPDX-License-Identifier: AGPL-3.0-or-later
"""Reports Pack — the one sanctioned print/export artifact (D-038 / D-061).

A backend-composed, self-contained HTML document at ``GET /reports/pack``. It **owns and
re-derives NOTHING** — it assembles the canonical readers (reports-pack §2), rendering every figure
as a **served display string** (D-105; the artifact is rendered UI, unlike the CSV exports whose data
cells stay machine-numeric — DESIGN-SYSTEM §5.1a / Pack-8). No app JS, no external fetch, inline CSS
only (Pack-9): it must read on paper.

Structure (reports-pack §9, owner 2026-07-17):
  - Artifact header (Pack-5): title · generated date · base currency · current-FX caveat · not-advice.
  - CONSOLIDATED (Pack-1 order): net-worth trend · review · cash flow · scenarios.
  - PER-ENTITY (Pack-6, alphabetical): net worth · drift · realised P/L · risk + attribution,
    each composed server-side with ``entity_id`` (§9-2, the entity axis stays UI-dormant).
  - Empty sections render an honest served reason, never a blank or a fabricated 0 (Pack-3,
    Guarantee 3). Zero entities → consolidated + an omission note; one entity → its section still
    renders (Pack-4).

The palette + @media print page rules are the DESIGN-SYSTEM §5.1a spec rendered inline: light
background / dark text, gain/loss retained AS an enhancement (the +/- sign carries the meaning so it
survives grayscale printing), break-before per top-level section, break-inside:avoid per card, and a
running header that repeats on each printed page.
"""

from __future__ import annotations

import html
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.money import D, format_money_display
from app.models import NetWorthSnapshot
from app.services.accounts import list_entities
from app.services.analytics import attribution, risk_metrics
from app.services.contributions import contributions_report
from app.services.planning import goals_report, obligations_report
from app.services.policy import compute_drift
from app.services.portfolio import value_portfolio
from app.services.review import review_report
from app.services.scenarios import scenario_report
from app.services.tax import realised_gains_report

# days window for the risk + attribution readers (matches the standalone routes' default).
_WINDOW_DAYS = 365
_MINUS = "−"  # U+2212 MINUS SIGN — the app's signed-figure convention.

# The reporting-only caption for the readers that serve NO disclaimer of their own (net-worth trend,
# per-entity net worth, risk). The global not-advice block in the header still covers them (Pack-5).
_REPORTING_CAPTION = "Reporting only, not advice."


def _esc(value: object) -> str:
    return html.escape(str(value)) if value is not None else ""


def _money(value: object) -> str:
    """A served money display string (grouped thousands, 2dp) via the canonical backend formatter.

    Formatting a Decimal the reader already produced is NOT frontend money math and NOT a recompute
    (D-105/P-1): the artifact is backend-rendered UI, and this is the same formatter every JSON route
    serves through. ``None`` stays honestly empty (never a fabricated 0, Guarantee 3)."""
    s = format_money_display(D(value)) if value is not None else None
    return s if s is not None else "&mdash;"


def _signed_money(value: object) -> tuple[str, str]:
    """(display, css-class) for a signed money figure. The SIGN carries the meaning (grayscale-safe);
    the gain/loss colour is an enhancement on top of it (DESIGN-SYSTEM §5.1a)."""
    if value is None:
        return "&mdash;", ""
    d = D(value)
    body = format_money_display(abs(d)) or "0.00"
    if d > 0:
        return f"+{body}", "gain"
    if d < 0:
        return f"{_MINUS}{body}", "loss"
    return body, ""


def _pct(value: object, *, signed: bool = False) -> str:
    if value is None:
        return "&mdash;"
    d = D(value).quantize(D("0.01"))
    if signed:
        if d > 0:
            return f"+{d}%"
        if d < 0:
            return f"{_MINUS}{abs(d)}%"
    return f"{d}%"


def _disclaimer(text: str | None) -> str:
    if not text:
        return ""
    return f'<p class="pack-disclaimer">{_esc(text)}</p>'


def _caption(text: str) -> str:
    return f'<p class="pack-caption">{_esc(text)}</p>'


def _empty_note(reason: str) -> str:
    """An honest empty-section note carrying the reader's served reason (Pack-3, Guarantee 3)."""
    return f'<p class="pack-empty">{_esc(reason)}</p>'


def _card(title: str, inner: str) -> str:
    return f'<div class="pack-card"><h3>{_esc(title)}</h3>{inner}</div>'


def _section(title: str, cards: str, *, kind: str = "consolidated") -> str:
    return f'<section class="pack-section pack-section--{kind}"><h2>{_esc(title)}</h2>{cards}</section>'


# --------------------------------------------------------------------------- consolidated sections


async def _consolidated_net_worth_trend(session: AsyncSession) -> str:
    rows = (
        await session.execute(select(NetWorthSnapshot).order_by(NetWorthSnapshot.ts))
    ).scalars().all()
    if not rows:
        inner = _empty_note("No net-worth snapshots recorded yet — the trend builds as the daily "
                            "snapshot worker accrues history.")
        return _card("Net worth trend", inner + _caption(_REPORTING_CAPTION))
    first, last = rows[0], rows[-1]
    body_rows = "".join(
        f"<tr><td>{_esc(r.ts.date().isoformat())}</td><td>{_money(r.net_worth)}</td>"
        f"<td>{_money(r.assets)}</td><td>{_money(r.liabilities)}</td></tr>"
        for r in rows[-12:]  # a print artifact shows the recent trend, not the full series
    )
    change, cls = _signed_money(D(last.net_worth) - D(first.net_worth))
    table = (
        "<table><thead><tr><th>As of</th><th>Net worth</th><th>Assets</th>"
        "<th>Liabilities</th></tr></thead><tbody>"
        f"{body_rows}</tbody></table>"
        f'<p class="pack-caption">Change over the recorded period: '
        f'<span class="{cls}">{change}</span> ({len(rows)} snapshots).</p>'
    )
    return _card("Net worth trend", table + _caption(_REPORTING_CAPTION))


async def _consolidated_review(session: AsyncSession) -> str:
    report = await review_report(session)
    items = report.get("items", [])
    rows = "".join(
        f'<li><span class="pack-tag">{_esc(i.get("area", ""))}</span> '
        f'<span class="pack-tag">{_esc(i.get("severity", ""))}</span> {_esc(i.get("body", ""))}</li>'
        for i in items
    )
    inner = f'<p class="pack-caption">As of {_esc(report.get("as_of"))}</p><ul class="pack-list">{rows}</ul>'
    return _card("Review", inner + _disclaimer(report.get("disclaimer")))


async def _consolidated_cash_flow(session: AsyncSession) -> str:
    obs = await obligations_report(session)
    goals = await goals_report(session)
    contrib = await contributions_report(session)

    ob_rows = obs.get("obligations", [])
    goal_rows = goals.get("goals", [])
    contrib_rows = contrib.get("contributions", [])

    if not ob_rows and not goal_rows and not contrib_rows:
        inner = _empty_note("No obligations, goals, or contributions recorded — nothing to project.")
        return _card("Cash flow", inner + _disclaimer(obs.get("disclaimer")))

    parts: list[str] = []
    parts.append(
        f'<p class="pack-figure"><span>Known outflows, next 12 months</span>'
        f'<strong>{_esc(obs.get("next_12m_total_display", "&mdash;"))}</strong></p>'
    )
    if ob_rows:
        body = "".join(
            f'<tr><td>{_esc(o.get("name", ""))}</td><td>{_esc(o.get("next_due", ""))}</td>'
            f'<td>{_esc(o.get("amount_display", "&mdash;"))}</td></tr>'
            for o in ob_rows
        )
        parts.append("<table><thead><tr><th>Obligation</th><th>Next due</th><th>Amount</th></tr>"
                     f"</thead><tbody>{body}</tbody></table>")
    if goal_rows:
        body = "".join(
            f'<tr><td>{_esc(g.get("name", ""))}</td><td>{_esc(g.get("target_date", ""))}</td>'
            f'<td>{_esc(g.get("target_amount_display", "&mdash;"))}</td></tr>'
            for g in goal_rows
        )
        parts.append("<table><thead><tr><th>Goal</th><th>Target date</th><th>Target</th></tr>"
                     f"</thead><tbody>{body}</tbody></table>")
    disclaimers = "".join(
        _disclaimer(r.get("disclaimer")) for r in (obs, goals, contrib) if r.get("disclaimer")
    )
    return _card("Cash flow", "".join(parts) + disclaimers)


async def _consolidated_scenarios(session: AsyncSession) -> str:
    report = await scenario_report(session)
    exposures = report.get("exposures", {})
    figure_rows = "".join(
        f'<tr><td>{_esc(label)}</td><td>{_esc(exposures.get(key + "_display", "&mdash;"))}</td></tr>'
        for key, label in (
            ("equities", "Equities"), ("crypto", "Crypto"),
            ("property", "Property"), ("foreign_fx", "Foreign-currency"),
        )
    )
    scen_rows = "".join(
        f'<tr><td>{_esc(s.get("name", ""))}</td>'
        f'<td>{_esc(s.get("new_net_worth_display", "&mdash;"))}</td></tr>'
        for s in report.get("asset_scenarios", [])
    )
    inner = (
        f'<p class="pack-figure"><span>Net worth</span>'
        f'<strong>{_esc(report.get("net_worth_display", "&mdash;"))}</strong></p>'
        "<table><thead><tr><th>Exposure</th><th>Value</th></tr></thead>"
        f"<tbody>{figure_rows}</tbody></table>"
    )
    if scen_rows:
        inner += ("<table><thead><tr><th>Scenario</th><th>Modelled net worth</th></tr></thead>"
                  f"<tbody>{scen_rows}</tbody></table>")
    return _card("Scenarios", inner + _disclaimer(report.get("disclaimer")))


# ------------------------------------------------------------------------------ per-entity sections


async def _entity_net_worth(session: AsyncSession, base: str, entity_id: int) -> str:
    val = await value_portfolio(session, base, warm=False, entity_id=entity_id)
    if not val.holdings:
        return _card("Net worth", _empty_note("No holdings recorded for this entity.")
                     + _caption(_REPORTING_CAPTION))
    unreal, unreal_cls = _signed_money(val.unrealised_pl)
    day, day_cls = _signed_money(val.day_change)
    stale = ' <span class="pack-stale">Some inputs are stale.</span>' if val.has_stale else ""
    inner = (
        '<table><tbody>'
        f'<tr><td>Total value</td><td>{_money(val.total_value)}</td></tr>'
        f'<tr><td>Cost basis</td><td>{_money(val.cost_basis)}</td></tr>'
        f'<tr><td>Unrealised P/L</td><td class="{unreal_cls}">{unreal}</td></tr>'
        f'<tr><td>Today\'s change</td><td class="{day_cls}">{day}</td></tr>'
        '</tbody></table>'
        f'{stale}'
    )
    return _card("Net worth", inner + _caption(_REPORTING_CAPTION))


async def _entity_drift(session: AsyncSession, entity_id: int) -> str:
    drift = await compute_drift(session, entity_id=entity_id)
    if not drift.get("has_targets"):
        return _card("Policy drift",
                     _empty_note("No policy targets set for this entity — nothing to measure drift "
                                 "against.") + _disclaimer(drift.get("disclaimer")))
    rows = ""
    for dim in drift.get("dimensions", []):
        for t in dim.get("rows", []):
            gap, gap_cls = _signed_money(t.get("gap_base"))
            rows += (
                f'<tr><td>{_esc(t.get("bucket", ""))}</td>'
                f'<td>{_pct(t.get("target_pct"))}</td><td>{_pct(t.get("actual_pct"))}</td>'
                f'<td class="{gap_cls}">{gap}</td></tr>'
            )
    inner = (
        f'<p class="pack-figure"><span>Gross assets</span>'
        f'<strong>{_esc(drift.get("gross_assets_display", "&mdash;"))}</strong></p>'
        "<table><thead><tr><th>Bucket</th><th>Target</th><th>Actual</th><th>Gap</th></tr></thead>"
        f"<tbody>{rows}</tbody></table>"
    )
    return _card("Policy drift", inner + _disclaimer(drift.get("disclaimer")))


async def _entity_realised(session: AsyncSession, entity_id: int) -> str:
    report = await realised_gains_report(session, entity_id=entity_id)
    groups = report.get("currency_groups", [])
    if not groups:
        return _card("Realised P/L",
                     _empty_note(f"No realised events recorded for {report.get('year')}.")
                     + _disclaimer(report.get("disclaimer")))
    rows = "".join(
        f'<tr><td>{_esc(g.get("currency", ""))}</td>'
        f'<td>{_signed_money(g.get("realised_total"))[0]}</td>'
        f'<td>{_money(g.get("short_term"))}</td><td>{_money(g.get("long_term"))}</td></tr>'
        for g in groups
    )
    current_fx, cur_cls = _signed_money(report.get("base_realised_total_current_fx"))
    excluded = report.get("realised_fx_events_excluded", 0)
    excluded_note = (
        _caption(f"{excluded} event(s) excluded from the trade-date-FX total for want of a stored "
                 "rate.") if excluded else ""
    )
    inner = (
        "<table><thead><tr><th>Currency</th><th>Realised</th><th>Short term</th>"
        "<th>Long term</th></tr></thead>"
        f"<tbody>{rows}</tbody></table>"
        f'<p class="pack-figure"><span>Base total (current FX, as of today)</span>'
        f'<strong class="{cur_cls}">{current_fx}</strong></p>'
        f"{excluded_note}"
    )
    return _card("Realised P/L", inner + _disclaimer(report.get("disclaimer")))


async def _entity_risk_attribution(session: AsyncSession, base: str, entity_id: int) -> str:
    risk = await risk_metrics(session, base, _WINDOW_DAYS, entity_id=entity_id)
    attr = await attribution(session, base, _WINDOW_DAYS, entity_id=entity_id)

    if not risk.get("available"):
        risk_inner = _empty_note("Risk metrics unavailable — not enough valued holdings or price "
                                 "history in the window to compute them.") + _caption(_REPORTING_CAPTION)
    else:
        risk_inner = (
            '<table><tbody>'
            f'<tr><td>Beta (vs {_esc(risk.get("benchmark_symbol"))})</td><td>{_esc(risk.get("beta"))}</td></tr>'
            f'<tr><td>Correlation</td><td>{_esc(risk.get("correlation"))}</td></tr>'
            f'<tr><td>Downside deviation</td><td>{_esc(risk.get("downside_deviation"))}</td></tr>'
            f'<tr><td>Concentration (HHI)</td><td>{_esc(risk.get("hhi"))}</td></tr>'
            '</tbody></table>' + _caption(_REPORTING_CAPTION)
        )

    if not attr.get("available"):
        attr_inner = _empty_note(attr.get("reason", "Attribution unavailable.")) \
            + _disclaimer(attr.get("disclaimer"))
    else:
        by_class = "".join(
            f'<tr><td>{_esc(c.get("key", ""))}</td><td>{_pct(c.get("contribution_pct"), signed=True)}</td></tr>'
            for c in attr.get("by_asset_class", [])
        )
        attr_inner = (
            f'<p class="pack-figure"><span>Headline return</span>'
            f'<strong>{_pct(attr.get("headline_return_pct"), signed=True)}</strong></p>'
            "<table><thead><tr><th>Asset class</th><th>Contribution</th></tr></thead>"
            f"<tbody>{by_class}</tbody></table>"
            f'<p class="pack-caption">Residual (income, realised, closed positions): '
            f'{_pct(attr.get("residual_pct"), signed=True)}</p>'
            + _disclaimer(attr.get("disclaimer"))
        )

    return (
        f'<div class="pack-card"><h3>Risk</h3>{risk_inner}</div>'
        f'<div class="pack-card"><h3>Attribution</h3>{attr_inner}</div>'
    )


# --------------------------------------------------------------------------------------- the artifact


def _document(base: str, generated: str, body: str) -> str:
    """Wrap the composed body in the self-contained document with the inline print stylesheet
    (DESIGN-SYSTEM §5.1a). Light bg / dark text; gain/loss are enhancements on a signed figure;
    break-before per top-level section; break-inside:avoid per card; running header on print."""
    style = _STYLE
    running = (
        f'<div class="pack-running-header">Reports Pack &middot; {_esc(generated)} '
        f'&middot; Base currency {_esc(base)}</div>'
    )
    header = (
        '<header class="pack-header">'
        '<h1>Reports Pack</h1>'
        f'<p class="pack-meta">Generated {_esc(generated)} &middot; Base currency {_esc(base)}</p>'
        '<p class="pack-disclaimer">Figures use today\'s FX rates where a conversion is needed '
        '(approximate — not for filing). This is a consolidated report of facts you already have — '
        'reporting only, not tax or financial advice, and never a recommendation.</p>'
        '</header>'
    )
    return (
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
        f"<title>Reports Pack</title><style>{style}</style></head>"
        f'<body><div class="pack">{running}{header}{body}</div></body></html>'
    )


async def render_reports_pack(session: AsyncSession) -> str:
    """Compose the whole artifact from the canonical readers and return one HTML document string."""
    settings = get_settings()
    base = settings.base_currency
    generated = date.today().isoformat()

    consolidated = (
        _section("Net worth trend", await _consolidated_net_worth_trend(session))
        + _section("Review", await _consolidated_review(session))
        + _section("Cash flow", await _consolidated_cash_flow(session))
        + _section("Scenarios", await _consolidated_scenarios(session))
    )

    entities = await list_entities(session)  # ordered by Entity.name (alphabetical) — Pack-6.
    if not entities:
        # Pack-4 degenerate case: consolidated + an honest omission note, never an empty per-entity shell.
        per_entity = _section(
            "Per-entity",
            _card("Per-entity sections",
                  _empty_note("No ownership entities are defined — per-entity sections are omitted. "
                              "The consolidated view above covers the whole household.")),
            kind="entity",
        )
    else:
        blocks: list[str] = []
        for ent in entities:
            eid = ent["id"]
            cards = (
                await _entity_net_worth(session, base, eid)
                + await _entity_drift(session, eid)
                + await _entity_realised(session, eid)
                + await _entity_risk_attribution(session, base, eid)
            )
            blocks.append(_section(f"Per-entity — {ent['name']}", cards, kind="entity"))
        per_entity = "".join(blocks)

    body = (
        '<div class="pack-group-label">Consolidated</div>'
        + consolidated
        + '<div class="pack-group-label">Per-entity</div>'
        + per_entity
    )
    return _document(base, generated, body)


_STYLE = """
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; background: #f8fafc; color: #0f172a;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px; line-height: 1.5; }
.pack { max-width: 900px; margin: 0 auto; padding: 24px; }
.pack-header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 8px; }
.pack-header h1 { font-size: 28px; margin: 0 0 4px; }
.pack-meta { color: #475569; margin: 0 0 8px; font-size: 13px; }
.pack-group-label { text-transform: uppercase; letter-spacing: 0.08em; font-size: 12px;
  font-weight: 700; color: #475569; margin: 24px 0 4px; }
.pack-section { margin: 8px 0 16px; }
.pack-section h2 { font-size: 20px; margin: 12px 0 8px; padding-bottom: 4px;
  border-bottom: 1px solid #cbd5e1; }
.pack-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;
  padding: 16px; margin: 12px 0; }
.pack-card h3 { font-size: 15px; margin: 0 0 8px; }
table { border-collapse: collapse; width: 100%; margin: 8px 0; }
th, td { text-align: right; padding: 4px 8px; border-bottom: 1px solid #eef2f6; }
th:first-child, td:first-child { text-align: left; }
th { color: #475569; font-weight: 600; font-size: 12px; }
.pack-figure { display: flex; justify-content: space-between; align-items: baseline;
  padding: 4px 0; margin: 4px 0; }
.pack-figure strong { font-variant-numeric: tabular-nums; font-size: 16px; }
.pack-list { list-style: none; padding: 0; margin: 8px 0; }
.pack-list li { padding: 4px 0; border-bottom: 1px solid #eef2f6; }
.pack-tag { display: inline-block; background: #f1f5f9; border-radius: 4px; padding: 0 6px;
  font-size: 11px; color: #475569; margin-right: 4px; }
.gain { color: #047857; }
.loss { color: #b91c1c; }
.pack-caption { color: #64748b; font-size: 12px; margin: 4px 0; }
.pack-disclaimer { color: #475569; font-size: 12px; font-style: italic; margin: 8px 0 0;
  border-top: 1px dotted #cbd5e1; padding-top: 6px; }
.pack-empty { color: #64748b; font-style: italic; margin: 8px 0; }
.pack-stale { color: #b45309; font-size: 12px; }
.pack-running-header { display: none; }
@media print {
  body { background: #ffffff; }
  .pack { max-width: none; padding: 0 12mm; }
  .pack-running-header { display: block; position: fixed; top: 0; left: 0; right: 0;
    font-size: 10px; color: #475569; border-bottom: 1px solid #cbd5e1;
    padding: 4px 0; background: #ffffff; }
  .pack-section { break-before: page; }
  .pack-group-label { break-before: auto; }
  .pack-header { break-after: avoid; }
  .pack-section h2, .pack-card h3 { break-after: avoid; }
  .pack-card { break-inside: avoid; }
}
"""
