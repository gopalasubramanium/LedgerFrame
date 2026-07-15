import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  DataTable,
  EmptyState,
  GlossaryTerm,
  PageHeader,
  Skeleton,
  StalenessChip,
  StatusChip,
  SummaryHead,
  TrendStat,
} from "../components/ui";
import type { Column } from "../components/ui";
import { fetchScenarios } from "../api/scenarios";
import type { AssetShock, ScenariosResp } from "../api/scenarios";
import { EMDASH, formatPercent } from "../format/number";
import "./Scenarios.css";

// Scenarios — canonical home for the fixed shock set, exposures and the liquidity what-ifs
// (IA §2/§5, D-058). READ-ONLY: deterministic arithmetic on today's values.
//
// PROTECTED (D-058): "a scenario, never a forecast." Money is a SERVED display string (D-105),
// rendered verbatim; the page computes no money. A shock delta is always a LOSS — never a gain.
//
// Below ~0 net worth the % of net worth is noise, so it is suppressed and only the amount shows
// (§9-9). The threshold matches the honest range where a percentage of the base is meaningful.
const NEAR_ZERO = 1000;

export function Scenarios() {
  const [data, setData] = useState<ScenariosResp | null>();

  const reload = useCallback(() => {
    setData(undefined);
    fetchScenarios().then((r) => setData(r.ok ? r.data : null));
  }, []);
  useEffect(() => reload(), [reload]);

  // §9-9 — a percentage of a near-zero base is noise. Suppress it (show only the amount).
  const showPct = Boolean(data && Math.abs(data.net_worth) >= NEAR_ZERO);
  // §12sc1-3 — the impact bar is magnitude-scaled against the LARGEST shock (biggest drop = full
  // bar). A house SVG, --loss tone, no axis: it shows relative severity, never a forecast.
  const maxImpact = Math.max(1, ...(data?.asset_scenarios ?? []).map((s) => Math.abs(s.pct_change)));

  const cols: Column<AssetShock>[] = [
    { key: "name", label: "Scenario", sortable: true, truncate: true },
    { key: "exposure", label: "Exposure", align: "right", sortable: true, render: (r) => r.exposure_display },
    {
      key: "delta",
      label: "Impact",
      align: "right",
      sortable: true,
      // A shock delta is a factual loss (§9-5) — coloured as a loss, never a gain.
      render: (r) => <span className="sc__loss">{r.delta_display}</span>,
    },
    { key: "new_net_worth", label: "New net worth", align: "right", sortable: true, render: (r) => r.new_net_worth_display },
    {
      key: "pct_change",
      label: "% of net worth",
      align: "right",
      sortable: true,
      render: (r) =>
        showPct ? (
          <span className="sc__impactcell">
            {/* House-SVG impact bar (§12sc1-3) — magnitude-scaled, --loss, no axis, no forecast. */}
            <svg className="sc__impactbar" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
              <rect x="0" y="2" width="100" height="4" rx="2" className="sc__impacttrack" />
              <rect x="0" y="2" width={Math.max(2, (Math.abs(r.pct_change) / maxImpact) * 100)} height="4" rx="2" className="sc__impactfill" />
            </svg>
            <span>{formatPercent(r.pct_change)}</span>
          </span>
        ) : (
          EMDASH
        ),
    },
  ];

  const hasPortfolio = Boolean(data && data.net_worth !== 0 && data.asset_scenarios.some((s) => s.exposure > 0));

  return (
    <div className="lf-page sc">
      <PageHeader
        title="Scenarios"
        // Protected copy (D-058) — the forecast bar, in the subtitle (§9-13). May not be removed.
        subtitle="What today's values would look like under a hypothetical shock. A scenario, never a forecast."
      />

      {data === undefined && (
        <section className="lf-card">
          <div className="lf-card__body"><Skeleton lines={5} /></div>
        </section>
      )}

      {data === null && (
        <EmptyState
          message="Scenarios are unavailable."
          reason="They could not be loaded just now."
          action={<button type="button" className="lf-btn" onClick={reload}>Retry</button>}
        />
      )}

      {/* §9-9 — the empty portfolio. Nothing to shock; state a reason and a way forward. */}
      {data && !hasPortfolio && (
        <EmptyState
          message="No holdings to model a shock against."
          reason="Add holdings and we'll show how today's values would move under a hypothetical shock."
          action={<Link className="lf-btn lf-btn--primary" to="/holdings">Add holdings</Link>}
        />
      )}

      {data && hasPortfolio && (
        <>
          {/* §9-2 — the A10 staleness annotation. A what-if is never presented as resting on fresh
              values when its inputs are stale/low-confidence. The flag rides the SAME payload the
              figures come from — no second fetch. */}
          {data.inputs_stale && (
            <div className="sc__stale">
              {data.stale_inputs > 0 && <StalenessChip isStale asOf="" />}
              <span className="sc__stalenote">{data.inputs_note}</span>
              <Link to="/pricing-health">Pricing Health</Link>
            </div>
          )}

          {/* Exposures — the base-currency amounts the shocks are applied to. */}
          <section className="lf-card sc__exposures" data-card="exposures">
            <header className="sc__head">
              <h2 className="lf-card__title">
                <GlossaryTerm term="term-exposure">Exposures</GlossaryTerm>
              </h2>
            </header>
            <div className="lf-card__body sc__expbody">
              {/* §14in-7 — base-currency affix on the exposure money tiles (served base_currency). */}
              <TrendStat label="Equities" value={data.exposures.equities_display} unit={data.base_currency} />
              <TrendStat label="Crypto" value={data.exposures.crypto_display} unit={data.base_currency} />
              <TrendStat label="Property" value={data.exposures.property_display} unit={data.base_currency} />
              <TrendStat label="Foreign FX" value={data.exposures.foreign_fx_display} unit={data.base_currency} />
            </div>
          </section>

          {/* The 7 shocks as ONE DataTable (the ratified §9-1 geometry). */}
          <section className="lf-card sc__section" data-card="shocks">
            <header className="sc__head">
              <h2 className="lf-card__title">
                <GlossaryTerm term="term-shock">Stress scenarios</GlossaryTerm>
              </h2>
              <span className="sc__nw">Net worth today · {data.net_worth_display}<span className="lf-stat__unit">{data.base_currency}</span></span>
            </header>
            <div className="lf-card__body">
              <DataTable<AssetShock> caption="Stress scenarios" columns={cols} rows={data.asset_scenarios} />
              {/* §9-13 — the protected disclaimer ONCE at the table foot (never per row). */}
              <p className="lf-card__footnote">
                {data.disclaimer}
                {!showPct && " Net worth is near zero, so percentages are not shown — only the amount."}
              </p>
            </div>
          </section>

          {/* Liquidity what-ifs — SUMMARISED from the canonical runway reader (D-036), linked. */}
          <section className="lf-card sc__section" data-card="liquidity">
            <header className="sc__head">
              <h2 className="lf-card__title">Liquidity what-ifs</h2>
              <SummaryHead title="" to="/net-worth" destination="Net worth" whole />
            </header>
            <div className="lf-card__body sc__liqbody">
              <div className="sc__whatif">
                <span className="sc__wlabel">If income stopped</span>
                <span className="sc__wvalue">
                  {data.liquidity.income_stop.runway_months == null
                    ? EMDASH
                    : `${data.liquidity.income_stop.runway_months} months`}
                </span>
                <span className="sc__wnote">{data.liquidity.income_stop.note}</span>
              </div>
              <div className="sc__whatif">
                <span className="sc__wlabel">If 12 months of expenses were paid now</span>
                <span className="sc__wvalue">{data.liquidity.obligation_due.amount_display}</span>
                {/* §9-5 — covered → positive; not covered → attention (needs-a-look, not a loss). */}
                <StatusChip
                  label={data.liquidity.obligation_due.covered ? "Covered" : "Not covered"}
                  tone={data.liquidity.obligation_due.covered ? "positive" : "attention"}
                />
                <span className="sc__wnote">
                  {data.liquidity.obligation_due.note} Liquid after: {data.liquidity.obligation_due.new_liquid_display}
                </span>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
