// SPDX-License-Identifier: AGPL-3.0-or-later
import { Link } from "react-router-dom";
import {
  DataTable,
  PageHeader,
  StalenessChip,
  StatusChip,
  SummaryHead,
  TrendStat,
} from "../components/ui";
import type { Column } from "../components/ui";
import { EMDASH } from "../format/number";
import "./Scenarios.css";

// STATIC LAYOUT SPECIMEN — page-scenarios §9-1 (the GEOMETRY GATE).
//
// Nothing here is wired: it exists so the owner can RATIFY THE GEOMETRY BY LOOKING, before the page
// is assembled. The ruling: an exposures TrendStat strip · the 7 shocks as ONE DataTable · the two
// liquidity what-ifs as a card with StatusChip verdicts.
//
// The two HONESTY CASES are STAGED (the ruling): (a) the A10 staleness annotation strip; (b) the
// near-zero net-worth variant, where the % column is suppressed and only the base-currency delta
// shows. Every money figure is written as the BACKEND WOULD SERVE IT (a display string), because
// that is what the page renders (D-105). Deltas are factual losses (§9-5) — never gains.

interface ShockRow {
  id: string;
  name: string;
  group: string;
  exposure: string;
  delta: string;
  new_net_worth: string;
  pct: string | null; // null = suppressed (near-zero net worth, §9-9)
}

const NET_WORTH = "796,246.00";

const SHOCKS: ShockRow[] = [
  { id: "equities_10", name: "Equities fall 10%", group: "markets", exposure: "312,400.00", delta: "−31,240.00", new_net_worth: "765,006.00", pct: "−3.9%" },
  { id: "equities_20", name: "Equities fall 20%", group: "markets", exposure: "312,400.00", delta: "−62,480.00", new_net_worth: "733,766.00", pct: "−7.8%" },
  { id: "equities_30", name: "Equities fall 30%", group: "markets", exposure: "312,400.00", delta: "−93,720.00", new_net_worth: "702,526.00", pct: "−11.8%" },
  { id: "risk_20", name: "Risk assets fall 20% (equities + crypto)", group: "markets", exposure: "358,300.00", delta: "−71,660.00", new_net_worth: "724,586.00", pct: "−9.0%" },
  { id: "crypto_50", name: "Crypto falls 50%", group: "markets", exposure: "45,900.00", delta: "−22,950.00", new_net_worth: "773,296.00", pct: "−2.9%" },
  { id: "property_10", name: "Property falls 10%", group: "markets", exposure: "280,000.00", delta: "−28,000.00", new_net_worth: "768,246.00", pct: "−3.5%" },
  { id: "fx_10", name: "Your foreign currencies weaken 10% vs base", group: "fx", exposure: "184,500.00", delta: "−18,450.00", new_net_worth: "777,796.00", pct: "−2.3%" },
];

// The near-zero variant: same shocks, net worth ≈ 0 → the % is noise, so it is suppressed (§9-9).
const NEAR_ZERO: ShockRow[] = SHOCKS.map((s) => ({ ...s, pct: null }));

const MAX_PCT = Math.max(...SHOCKS.map((s) => (s.pct ? Math.abs(parseFloat(s.pct.replace("−", "-").replace("%", ""))) : 0)));

const impactBar = (pct: string | null) => {
  if (!pct) return EMDASH;
  const mag = Math.abs(parseFloat(pct.replace("−", "-").replace("%", "")));
  return (
    <span className="sc__impactcell">
      <svg className="sc__impactbar" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
        <rect x="0" y="2" width="100" height="4" rx="2" className="sc__impacttrack" />
        <rect x="0" y="2" width={Math.max(2, (mag / MAX_PCT) * 100)} height="4" rx="2" className="sc__impactfill" />
      </svg>
      <span>{pct}</span>
    </span>
  );
};

const COLS: Column<ShockRow>[] = [
  { key: "name", label: "Scenario", sortable: true, truncate: true },
  { key: "exposure", label: "Exposure", align: "right", sortable: true },
  { key: "delta", label: "Impact", align: "right", sortable: true, render: (r) => <span className="sc__loss">{r.delta}</span> },
  { key: "new_net_worth", label: "New net worth", align: "right", sortable: true },
  { key: "pct", label: "% of net worth", align: "right", sortable: true, render: (r) => impactBar(r.pct) },
];

function Exposures() {
  return (
    <section className="lf-card sc__exposures">
      <div className="lf-card__body sc__expbody">
        <TrendStat label="Equities" value="312,400.00" />
        <TrendStat label="Crypto" value="45,900.00" />
        <TrendStat label="Property" value="280,000.00" />
        <TrendStat label="Foreign FX" value="184,500.00" />
      </div>
    </section>
  );
}

function Liquidity() {
  return (
    <section className="lf-card sc__section">
      <header className="sc__head">
        <h2 className="lf-card__title">Liquidity what-ifs</h2>
        <SummaryHead title="" to="/net-worth" destination="Net worth" whole />
      </header>
      <div className="lf-card__body sc__liqbody">
        <div className="sc__whatif">
          <span className="sc__wlabel">If income stopped</span>
          <span className="sc__wvalue">7.2 months</span>
          <span className="sc__wnote">Liquid assets would cover recurring expenses for this long.</span>
        </div>
        <div className="sc__whatif">
          <span className="sc__wlabel">If 12 months of expenses were paid now</span>
          <span className="sc__wvalue">68,800.00</span>
          <StatusChip label="Covered" tone="positive" />
          <span className="sc__wnote">Liquid after: 51,200.00</span>
        </div>
        <div className="sc__whatif">
          <span className="sc__wlabel">If a larger drawdown were paid now</span>
          <span className="sc__wvalue">140,000.00</span>
          <StatusChip label="Not covered" tone="attention" />
          <span className="sc__wnote">Liquid after: −20,000.00</span>
        </div>
      </div>
    </section>
  );
}

export function ScenariosMockup({ nearZero = false }: { nearZero?: boolean }) {
  return (
    <div className="lf-page sc">
      <PageHeader
        title="Scenarios"
        subtitle="What today's values would look like under a hypothetical shock. A scenario, never a forecast."
      />

      {/* A10 (§9-2) — the staleness annotation, STAGED. When inputs are stale/low-confidence the
          page says so, so a what-if is never presented as resting on fresh values when it isn't. */}
      <div className="sc__stale">
        <StalenessChip isStale asOf="" />
        <span className="sc__stalenote">
          2 prices are stale and 1 holding is low-confidence — these figures may not reflect current values.
        </span>
        <Link to="/pricing-health">Pricing Health</Link>
      </div>

      <Exposures />

      <section className="lf-card sc__section">
        <header className="sc__head">
          <h2 className="lf-card__title">Stress scenarios</h2>
          <span className="sc__nw">Net worth today · {nearZero ? "412.00" : NET_WORTH}</span>
        </header>
        <div className="lf-card__body">
          <DataTable<ShockRow>
            caption="Stress scenarios"
            columns={COLS}
            rows={nearZero ? NEAR_ZERO : SHOCKS}
          />
          {/* §9-13 — the protected disclaimer at the TABLE FOOT, once (never per row). */}
          <p className="lf-card__footnote">
            Scenario, not forecast — arithmetic on today's values, not a prediction, probability or
            recommendation. Real outcomes will differ.
            {nearZero && " Net worth is near zero, so percentages are not shown — only the amount."}
          </p>
        </div>
      </section>

      <Liquidity />
    </div>
  );
}
