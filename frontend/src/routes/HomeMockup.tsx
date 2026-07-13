import {
  AllocationDonut,
  NewsList,
  QuoteCardRow,
  PageHeader,
  ReviewCard,
  Sparkline,
  SummaryHead,
  SummaryLink,
} from "../components/ui";
import "./home-grid.css";

// HOME MOCKUP — the ratification gate for the Home REBUILD (page-home §12ho1-4).
//
// STATIC BY CONSTRUCTION: no readers, no fetches, no state. Every figure below is hardcoded
// demo-shaped data whose only job is to show the GEOMETRY and DENSITY at a real breakpoint. It is
// mounted ONLY in /kitchen-sink — never at `/`. Wiring happens after the owner ratifies it, and
// then every figure comes from the canonical reader named in the ownership table (§2/D-038).
//
// Why a mockup at all: the first build shipped a correct widget LIST as a stacked column and failed
// the page's purpose. A widget list is not a layout — so the layout is ratified in a browser, at the
// hard breakpoint, BEFORE any wiring (§12ho1-4 gate).
//
// The demo figures are deliberately plausible, not real: the frame is labelled a mockup and the
// numbers are never served. Nothing here may become a code path that renders live data.

const SPARK_NET = [
  742, 748, 745, 753, 761, 758, 766, 771, 769, 777, 784, 780, 788, 793, 790, 796,
];
const SPARK_PERF = [
  100, 101.2, 100.6, 102.1, 103.4, 102.8, 104.2, 105.1, 104.6, 106.3, 107.1, 106.4, 108.2, 109.1,
  108.6, 109.8,
];

// The donut's palette is the component's own categorical identity palette — a caller never
// picks colours. Values are served decimal strings (D-105); the component derives the shares.
const ALLOCATION = [
  { label: "Equity", value: "496839.20" },
  { label: "Fixed deposit", value: "112266.60" },
  { label: "Bond", value: "78029.20" },
  { label: "Cash", value: "57327.60" },
  { label: "Crypto", value: "51754.08" },
];

// Both movers PAIRS (D-024) — never interchanged. Contribution-weighted pair is Portfolio's;
// the price-move pair is Markets'. N=3 per list (§9-6).
const CONTRIBUTORS = [
  { sym: "VWRA", pct: "+0.18%" },
  { sym: "NVDA", pct: "+0.11%" },
  { sym: "D05", pct: "+0.06%" },
];
const DETRACTORS = [
  { sym: "RELIANCE", pct: "−0.09%" },
  { sym: "BTC", pct: "−0.05%" },
  { sym: "AAPL", pct: "−0.02%" },
];
const GAINERS = [
  { sym: "NVDA", pct: "+2.41%" },
  { sym: "VOO", pct: "+1.07%" },
  { sym: "D05", pct: "+0.79%" },
];
const LOSERS = [
  { sym: "RELIANCE", pct: "−0.85%" },
  { sym: "US · S&P 500", pct: "−0.23%" },
  { sym: "HDFCNIFTY", pct: "−0.11%" },
];

// N=3: a summary never out-details its canonical page, and the tile must not clip mid-list.
const REVIEW_SECTIONS = [
  { label: "Cash runway below 3 months", verdict: "attention" as const, detail: "Liquid ÷ recurring burn" },
  { label: "2 holdings need a price source", verdict: "attention" as const },
  { label: "Allocation drift within bands", verdict: "ok" as const },
];

const HEADLINES = [
  {
    headline: "Nvidia extends rally as data-centre demand holds",
    source: "Reuters",
    published_at: "2026-07-14T01:10:00Z",
    symbols: ["NVDA"],
  },
  {
    headline: "DBS lifts full-year guidance on net interest income",
    source: "Business Times",
    published_at: "2026-07-14T00:40:00Z",
    symbols: ["D05"],
  },
  {
    headline: "Reliance slips after refining margins narrow",
    source: "Mint",
    published_at: "2026-07-13T23:55:00Z",
    symbols: ["RELIANCE"],
  },
];

// Served decimal strings — no thousands separators (the component formats; the caller never does).
// Three fit the tile at 1366 without clipping; the last is STALE on purpose — per-item staleness is
// preserved in every compact summary (Guarantee 3), so the mockup must show that state, not hide it.
const QUOTES = [
  { symbol: "VWRA", name: "Vanguard FTSE All-World", price: "128.4500", changePct: "0.42", currency: "USD", isStale: false, asOf: "2026-07-14T01:12:00Z" },
  { symbol: "NVDA", name: "NVIDIA", price: "1204.3000", changePct: "2.41", currency: "USD", isStale: false, asOf: "2026-07-14T01:12:00Z" },
  { symbol: "BTC", name: "Bitcoin", price: "66084.9000", changePct: "-0.50", currency: "USD", isStale: true, asOf: "2026-07-13T18:02:00Z" },
];

const BRIEFING =
  "Your net worth rose 0.27% today, led by Nvidia and DBS; Reliance was the largest drag. " +
  "Cash runway is under three months and two holdings still have no price source — both are " +
  "waiting for you in Review. Nothing else moved beyond its usual range.";

function MoverList({ title, rows }: { title: string; rows: { sym: string; pct: string }[] }) {
  return (
    <div className="hm3__moverlist">
      <h3 className="hm3__moverhead">{title}</h3>
      <ul className="hm3__moverrows">
        {rows.map((r) => (
          <li className="hm3__moverrow" key={r.sym}>
            <span className="hm3__moversym">{r.sym}</span>
            <span className={`hm3__moverpct hm3__moverpct--${r.pct.startsWith("+") ? "up" : "down"}`}>
              {r.pct}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The RATIFIED grid: 12 columns × 3 rows. Fits 1366×768 with demo data; no half-empty rows.
 *  Home has ONE layout (§12ho1-6) — there is no Simple variant to render. */
export function HomeMockupFull() {
  return (
    <div className="hm3 hm3--full">
      <div className="hm3__pagehead">
        <PageHeader title="Home" subtitle="Your summary — tap any card for the full picture" />
      </div>

      <div className="hm3__grid">
        {/* R1 · HERO — Net worth: the anchor figure, its gross/liabilities split, and its trend,
          * in ONE card. It summarises TWO canonical pages (the figures are Net worth's; the trend
          * is Portfolio's — D-035), so it carries TWO ↗, exactly as Movers does. */}
        <section className="lf-card hm3__cell hm3__cell--networth">
          <SummaryHead title="Net worth" to="#/net-worth" destination="Net worth" whole />
          <div className="hm3__figure hm3__figure--anchor">
            796,216.68 <span className="hm3__unit">SGD</span>
          </div>
          <dl className="hm3__split">
            <div className="hm3__splitrow">
              <dt>Gross assets</dt>
              <dd>1,216,216.68</dd>
            </div>
            <div className="hm3__splitrow">
              <dt>Liabilities</dt>
              <dd>420,000.00</dd>
            </div>
          </dl>
          {/* The sparkline is PORTFOLIO's series (D-035/§9-8), so it names its own canonical page:
            * a caption + its own ↗, rather than a second competing title in the header. */}
          <div className="hm3__sparkcap">
            <span className="hm3__sparklabel">Performance</span>
            <SummaryLink to="#/portfolio" destination="Portfolio" />
          </div>
          <div className="hm3__spark">
            <Sparkline points={SPARK_PERF} tone="up" aria-label="Performance trend" />
          </div>
        </section>

        {/* R1 · THE LEAD — Today's change dominates by SIZE, not motion. */}
        <section className="lf-card hm3__cell hm3__cell--change">
          <SummaryHead title="Today's change" to="#/net-worth" destination="Net worth" whole />
          <div className="hm3__figure hm3__figure--lead hm3__figure--up">
            +2,140.55 <span className="hm3__unit">SGD</span>
          </div>
          <div className="hm3__leadpct hm3__figure--up">+0.27%</div>
          <div className="hm3__spark hm3__spark--lead">
            <Sparkline points={SPARK_NET} tone="up" aria-label="Today's change trend" />
          </div>
        </section>

        {/* R1 · the second lead by PLACEMENT — the strongest corner after the headline. */}
        <section className="hm3__cell hm3__cell--review">
          <ReviewCard attention={3} link={{ href: "#/review", label: "Review" }} sections={REVIEW_SECTIONS} />
        </section>

        {/* R2 · the donut sits BESIDE its legend, not above it. */}
        <section className="lf-card hm3__cell hm3__cell--alloc">
          <SummaryHead title="Allocation by class" to="#/portfolio" destination="Portfolio" whole />
          <div className="hm3__donut">
            <AllocationDonut segments={ALLOCATION} aria-label="Allocation by class" />
          </div>
        </section>

        {/* R2 · both movers PAIRS, four tight columns. Two ↗ — it summarises two canonical pages. */}
        <section className="lf-card hm3__cell hm3__cell--movers">
          <div className="hm3__twohead">
            <SummaryHead title="Contributors / Detractors" to="#/portfolio" destination="Portfolio" whole />
            <SummaryHead title="Gainers / Losers" to="#/markets" destination="Markets" whole />
          </div>
          <div className="hm3__movers">
            <MoverList title="Contributors" rows={CONTRIBUTORS} />
            <MoverList title="Detractors" rows={DETRACTORS} />
            <MoverList title="Gainers" rows={GAINERS} />
            <MoverList title="Losers" rows={LOSERS} />
          </div>
        </section>

        {/* R3 · briefing + headlines. */}
        <section className="lf-card hm3__cell hm3__cell--brief">
          <SummaryHead title="Briefing" to="#/news" destination="News" whole />
          <p className="hm3__briefing">{BRIEFING}</p>
          <NewsList items={HEADLINES} showSymbols />
        </section>

        {/* R3 · quotes — one compact row. QuoteCardRow renders its OWN head ("Quotes" + the source
          * select), so the tile does not add a second title; it adds only the corner ↗. Giving the
          * component a proper SummaryHead is a PROPOSED amendment listed at the gate — not
          * improvised into ui/ here. */}
        <section className="lf-card hm3__cell hm3__cell--quotes">
          <SummaryLink to="#/markets" destination="Markets" />
          <QuoteCardRow quotes={QUOTES} source="holdings" />
        </section>
      </div>
    </div>
  );
}
