import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { InstrumentLabel } from "../components/InstrumentLabel";
import { ArrowUpRight } from "lucide-react";
import "./home-grid.css";
import {
  AllocationDonut,
  EmptyState,
  GlossaryTerm,
  NewsList,
  PageHeader,
  QuoteCardRow,
  ReviewCard,
  Skeleton,
  Sparkline,
  StalenessChip,
  SummaryHead,
} from "../components/ui";
import type { QuoteCardItem, QuoteSource, ReviewSection, Verdict } from "../components/ui";
import { getHomeQuoteSource } from "../api/home";
import { getPortfolioSummary, getPerformance } from "../api/portfolio";
import type { PerformanceResp, PortfolioSummary } from "../api/portfolio";
import { getReview } from "../api/net-worth";
import type { ReviewResp } from "../api/net-worth";
import { getBriefing, getGroupedNews } from "../api/news";
import type { BriefingResp, GroupedNewsResp } from "../api/news";
import { getMarketsOverview, getMarketsGlobal, getWatchlists } from "../api/markets";
import type { OverviewInstrument, OverviewResp, ServedQuote } from "../api/markets";
import { getHoldings } from "../api/holdings";
import { useRefdataVocabs } from "../refdata/refdata-context";
import { humanize } from "../mocks/refdata";
import { formatMoney, formatSignedMoney, formatSignedPercent, signOf } from "../format/number";

// Home (Overview group, `/`) — the landing view. It OWNS NOTHING (IA §4, P-1/D-038): every widget is
// a LINKED SUMMARY of the page that owns its figure, read from that page's canonical reader. There is
// no Home aggregate — `/dashboard/home` was RETIRED (§9-4) so each card reads its own reader and
// loads independently (a slow reader skeletons only its own card, never the page).
//
// The page performs NO money math. The only client-side derivations are the ones the canonical pages
// already do: a sign → tone classification, and a display SORT for Gainers/Losers (§9-6, Markets ND-1).
//
// LAYOUT: there is exactly ONE (§12ho1-6 — the Simple layout was removed). It is the grid the owner
// ratified in the browser (§12ho1-5), and its geometry lives in `home-grid.css`, which this page
// shares with the static reference specimen in /kitchen-sink — so what was ratified is what ships,
// and neither can drift from the other. No layout state, no branch, no switch anywhere.
//
// Home renders NO ticker — TickerStrip is global chrome (D-047 AMENDMENT). The widget set is FIXED
// (R-19 parked).

// §9-6: N=3 per movers pair — a summary, never out-detailing its canonical page.
const MOVERS_N = 3;
// §9-9 SUPERSEDED by §12ho2-12 (owner-approved lever 3, 2026-07-14): N=2, not 3.
//
// Spent LAST, and only once it was proven to pay: while the Quotes tile was the taller of the two in
// row 3, cutting a headline bought NOTHING (the row is as tall as its tallest tile). Design levers
// went first — the page-local shell, tile density — and only when News became the binding tile did
// this one buy height. A content cut that buys nothing is pure loss, so it is worth measuring which
// tile actually binds before cutting anything. The Briefing line STAYS.
const HEADLINES_N = 2;
// The ReviewCard is a SUMMARY: it shows the top N verdicts, not the whole report. Listing every item
// would make Home the Review page (P-1: a summary never out-details its canonical page) — and the
// wired page did exactly that, rendering all of them and blowing the hero row's height. The ATTENTION
// COUNT is unaffected: it is the SERVED count, so it still reconciles with /review by construction.
// N=3 matches the ratified mockup and the §9-6/§9-9 precedent. PROPOSED — ratify at the walk.
const REVIEW_N = 3;
const HOLDINGS_GROUP = "My holdings";
// §12ho1-7: the donut LEGEND lists the 5 largest classes; the ring still draws them all.
const LEGEND_MAX = 5;
// §9-8: the sparkline MIRRORS Portfolio's default view (window 1Y → 365d, benchmark SPY, no manual).
// It renders `series` ONLY — no benchmark line, no client indexing. The server still computes a
// benchmark series we do not draw; ACCEPTED and recorded (§9-8), revisit only if it ever costs.
const PERF_DAYS = 365;
const PERF_BENCHMARK = "SPY";
const PERF_INCLUDE_MANUAL = false;

function reviewVerdict(severity: string): Verdict {
  // The reader serves display-cased severity ("Review"/"Info") — normalise before mapping
  // (page-review §12rv1-5). Same mapping Net worth's ReviewCard uses; never a second rule.
  const s = severity.toLowerCase();
  if (s === "review") return "attention";
  if (s === "info") return "info";
  return "ok";
}

/** A served quote → the row's item shape. Staleness is SERVED, per item (Guarantee 3). */
function cardOf(q: ServedQuote, name: string): QuoteCardItem {
  return {
    symbol: q.symbol,
    name,
    price: q.price_display ?? q.price, // D-105: the served display string wins; never re-formatted
    changePct: q.change_pct,
    currency: q.currency,
    isStale: q.is_stale,
    asOf: q.market_time ?? q.received_at,
  };
}

export function Home() {
  const [source, setSource] = useState<QuoteSource>();
  const [summary, setSummary] = useState<PortfolioSummary | null>();
  const [perf, setPerf] = useState<PerformanceResp | null>();
  const [review, setReview] = useState<ReviewResp | null>();
  const [briefing, setBriefing] = useState<BriefingResp | null>();
  const [news, setNews] = useState<GroupedNewsResp | null>();
  const [quotes, setQuotes] = useState<QuoteCardItem[] | null>();
  const [mkt, setMkt] = useState<OverviewResp | null>();
  const vocabs = useRefdataVocabs();

  // Readers fire INDEPENDENTLY (never one Promise.all gate): a slow reader skeletons only its own
  // card. This is exactly what retiring the aggregate bought (§9-4). The served quote SOURCE is read
  // alongside them, not ahead of them — it gates one card, not the page (§12ho1-6: with a single
  // layout there is no composition to wait for).
  const reload = useCallback(() => {
    getPortfolioSummary().then((r) => setSummary(r.ok ? r.data : null));
    getReview().then((r) => setReview(r.ok ? r.data : null));
    getBriefing().then((r) => setBriefing(r.ok ? r.data : null));
    getPerformance(PERF_DAYS, PERF_BENCHMARK, PERF_INCLUDE_MANUAL).then((r) => setPerf(r.ok ? r.data : null));
    getGroupedNews().then((r) => setNews(r.ok ? r.data : null));
    getMarketsOverview().then((r) => setMkt(r.ok ? r.data : null));
    getHomeQuoteSource().then((s) => setSource((cur) => cur ?? s ?? undefined));
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  // The quote row re-reads when the source changes (§9-7: all four sources have a real reader).
  useEffect(() => {
    if (!source) return;
    let live = true;
    setQuotes(undefined);
    const put = (items: QuoteCardItem[] | null) => live && setQuotes(items);
    if (source === "markets") {
      getMarketsOverview().then((r) => put(r.ok ? r.data.instruments.map((i) => cardOf(i.quote, i.name)) : null));
    } else if (source === "global") {
      getMarketsGlobal().then((r) =>
        put(r.ok ? r.data.groups.flatMap((g) => g.items.map((i) => cardOf(i.quote, i.label))) : null),
      );
    } else if (source === "watchlist") {
      getWatchlists().then((r) =>
        put(r.ok ? r.data.watchlists.flatMap((w) => w.items.map((i) => cardOf(i.quote, i.name))) : null),
      );
    } else {
      // Holdings: the holdings reader is not a quote reader — map only the fields it serves.
      getHoldings().then((r) =>
        put(
          r.ok
            ? r.data.holdings
                .filter((h) => h.is_priced && h.symbol)
                .map((h) => ({
                  symbol: h.symbol as string,
                  // §12ho2-10: the holdings reader serves `name == symbol` for listed instruments, so
                  // the card printed "AAPL" twice, once as the symbol and once as its own name. A
                  // name that merely repeats the symbol is not a name — it is noise in a compact card.
                  name: [h.name, h.label].find((n) => n && n !== h.symbol) ?? "",
                  price: h.price_display ?? h.price,
                  changePct: h.day_change_pct,
                  currency: h.currency ?? "",
                  isStale: h.is_stale,
                  asOf: h.price_ts ?? "",
                }))
            : null,
        ),
      );
    }
    return () => {
      live = false;
    };
  }, [source]);

  const classLabel = (v: string) =>
    vocabs?.["asset_class"]?.find((o) => o.value === v)?.label ?? humanize(v);

  // Every reader field is read DEFENSIVELY below (`?? []` / `?? {}`). Not paranoia: a reader that
  // answers with a partial or unexpected payload used to throw here (`Object.entries(undefined)`) and
  // take the whole page down with it. A missing field must degrade to an honest EMPTY with a reason
  // (Guarantee 3) — never to a white screen, and never to an invented figure.
  // A SUMMARY carries the verdict and the title — not the per-item `area` sub-line. That detail is
  // Review's to show (P-1), and on Home it cost a third of the hero row's height for information the
  // ↗ already leads to. The COUNT is untouched: it is served, and still reconciles with /review.
  // §12po2-1 — pass the FULL list and let the component cap it. Home used to slice to REVIEW_N here,
  // which truncated SILENTLY: the user was never told there were more. The component now shows
  // "+N more ↗" to the canonical page (P-1: the full list lives only on Review).
  const reviewSections: ReviewSection[] = (review?.items ?? []).map((i) => ({
    label: i.title,
    verdict: reviewVerdict(i.severity),
  }));

  const headlines =
    (news?.groups ?? []).find((g) => g.name === HOLDINGS_GROUP)?.items?.slice(0, HEADLINES_N) ?? [];

  // Markets' pair — a display SORT of the served `change_pct` (page-markets ND-1), never a
  // computation. Losers are shown only where the change is actually negative (never a "loser" that
  // rose). This is the 2nd occurrence of the sort; a 3rd forces extraction (centralization rule).
  const pctOf = (i: OverviewInstrument) => Number(i.quote?.change_pct ?? 0);
  const ranked = [...(mkt?.instruments ?? [])].sort((a, b) => pctOf(b) - pctOf(a));
  const gainers = ranked.filter((i) => pctOf(i) > 0).slice(0, MOVERS_N);
  const losers = [...ranked].reverse().filter((i) => pctOf(i) < 0).slice(0, MOVERS_N);

  return (
    <div className="lf-page hm3 hm3--full">
      <div className="hm3__pagehead">
        <PageHeader title="Home" subtitle="Your summary — the ↗ on any card opens the full view." />
      </div>

      <div className="hm3__grid">
        {/* R1 · HERO — the net-worth figures are Net worth's; the trend is PORTFOLIO's performance
          * series (D-035/§9-8). The tile therefore summarises TWO canonical pages and names both:
          * two ↗, the Movers precedent (owner-approved, §12ho1-5). The [Help] on the title means the
          * header is NOT a whole-header link — nesting a popover inside a link is a defect. */}
        <section className="lf-card hm3__cell hm3__cell--networth" data-card="networth">
          <SummaryHead
            title={<GlossaryTerm term="term-net-worth">Net worth</GlossaryTerm>}
            to="/net-worth"
            destination="Net worth"
          />
          <Card data={summary} onRetry={reload}>
            {(s) => (
              <>
                <div className="hm3__figure hm3__figure--anchor">
                  {formatMoney(s.total_value)}<span className="lf-stat__unit">{s.base_currency}</span>
                </div>
                {/* Gross assets / Liabilities — figures D-046 did not list, but which the canonical
                  * Net worth page DOES show, so P-1 holds (owner-approved content widening,
                  * §12ho1-5). Served, rendered as served; no client arithmetic. */}
                <dl className="hm3__split">
                  <div className="hm3__splitrow">
                    <dt>Gross assets</dt>
                    <dd>{formatMoney(s.gross_assets)}</dd>
                  </div>
                  <div className="hm3__splitrow">
                    <dt>Liabilities</dt>
                    <dd>{formatMoney(s.liabilities)}</dd>
                  </div>
                </dl>
              </>
            )}
          </Card>
          {/* The sparkline is PORTFOLIO's series (D-035/§9-8), so it names its OWN canonical page —
            * the tile summarises two, which is why it carries two ↗ (owner-approved, §12ho1-5). It is
            * a real SummaryHead, not a page-local caption: one header anatomy everywhere (§12ho2-5). */}
          <SummaryHead title="Performance" to="/portfolio" destination="Portfolio" whole />
          <div className="hm3__spark">
            <Card data={perf} onRetry={reload}>
              {(p) =>
                (p.series ?? []).length < 2 ? (
                  <EmptyState
                    message="No performance history yet."
                    reason="There is not enough price history to draw a line — it appears once prices accumulate."
                  />
                ) : (
                  <Sparkline points={(p.series ?? []).map((x) => x.value)} aria-label="Performance trend" />
                )
              }
            </Card>
          </div>
        </section>

        {/* R1 · THE LEAD — Today's change is the largest figure on the page. It dominates by SIZE,
          * never by motion. Canonical: Net worth. */}
        <section className="lf-card hm3__cell hm3__cell--change" data-card="change">
          <SummaryHead
            title={<GlossaryTerm term="term-todays-change">Today&rsquo;s change</GlossaryTerm>}
            to="/net-worth"
            destination="Net worth"
          />
          <Card data={summary} onRetry={reload}>
            {(s) => (
              <>
                <div className={`hm3__figure hm3__figure--lead hm3__figure--${signOf(s.day_change)}`}>
                  {formatSignedMoney(s.day_change)}<span className="lf-stat__unit">{s.base_currency}</span>
                </div>
                {/* Per-item staleness is PRESERVED in the summary (Guarantee 3) — the count itself is
                  * the chrome StaleBanner's, never re-fetched or re-counted here (§2). */}
                {s.has_stale ? (
                  <p className="hm3__stale">
                    <StalenessChip isStale asOf="" /> {s.stale_count} of these prices are stale
                  </p>
                ) : null}
              </>
            )}
          </Card>
          <div className="hm3__spark hm3__spark--lead">
            <Card data={perf} onRetry={reload}>
              {(p) =>
                (p.series ?? []).length < 2 ? (
                  <span />
                ) : (
                  <Sparkline
                    points={(p.series ?? []).map((x) => x.value)}
                    tone={signOf(summary?.day_change ?? 0)}
                    aria-label="Recent trend"
                  />
                )
              }
            </Card>
          </div>
        </section>

        {/* R1 · the second lead, by PLACEMENT. It reads the SAME reader Net worth's ReviewCard uses,
          * so the attention count reconciles with /review BY CONSTRUCTION — Home never recounts. */}
        <section className="hm3__cell hm3__cell--review" data-card="review">
          <Card data={review} onRetry={reload}>
            {(r) => (
              <ReviewCard
                sections={reviewSections}
                attention={r.count ?? 0}
                maxItems={REVIEW_N}
                link={{ href: "#/review", label: "Review" }}
              />
            )}
          </Card>
        </section>

        {/* R2 · ONE allocation donut, by class (§9-5). The donut sits BESIDE its legend. */}
        <section className="lf-card hm3__cell hm3__cell--alloc" data-card="allocation">
          <SummaryHead title="Allocation by class" to="/portfolio" destination="Portfolio" whole />
          <div className="hm3__donut">
            <Card data={summary} onRetry={reload}>
              {(s) => {
                const segments = Object.entries(s.allocation_by_class ?? {}).map(([k, v]) => ({
                  label: classLabel(k),
                  value: v,
                }));
                return segments.length === 0 ? (
                  <EmptyState
                    message="No allocation to show yet."
                    reason="No priced holdings — allocation appears once a holding has a value."
                  />
                ) : (
                  <AllocationDonut
                    segments={segments}
                    legend
                    // §12ho1-7 (owner: lever B): the legend lists the FIVE largest classes by served
                    // value; the ring still draws every one. The overflow row states a COUNT and links
                    // to the page that owns the full breakdown — it invents no "Other" figure and
                    // recomputes no share (Guarantee 3, D-105).
                    legendMax={LEGEND_MAX}
                    legendMore={(n) => (
                      <Link className="lf-donut__morelink" to="/portfolio" aria-label={`${n} more classes on Portfolio`}>
                        +{n} more
                        <ArrowUpRight aria-hidden="true" focusable="false" />
                      </Link>
                    )}
                    aria-label="Allocation by class"
                  />
                );
              }}
            </Card>
          </div>
        </section>

        {/* R2 · BOTH movers pairs (§9-6), four tight columns. The pairs are NEVER interchanged
          * (D-024), and the tile summarises two canonical pages → two ↗. */}
        <section className="lf-card hm3__cell hm3__cell--movers" data-card="movers">
          <div className="hm3__twohead">
            <SummaryHead title="Contributors / Detractors" to="/portfolio" destination="Portfolio" whole />
            <SummaryHead title="Gainers / Losers" to="/markets" destination="Markets" whole />
          </div>
          <div className="hm3__movers">
            {/* Portfolio's pair — CONTRIBUTION-weighted. Never called Gainers/Losers (D-024). */}
            <Card data={summary} onRetry={reload}>
              {(s) => (
                <>
                  <MoverList title="Contributors" rows={(s.top_gainers ?? []).slice(0, MOVERS_N)} empty="Nothing contributed today." />
                  <MoverList title="Detractors" rows={(s.top_losers ?? []).slice(0, MOVERS_N)} empty="Nothing declined today." />
                </>
              )}
            </Card>
            {/* Markets' pair — PRICE-move. Never called Contributors/Detractors (D-024). */}
            <Card data={mkt} onRetry={reload}>
              {() => (
                <>
                  <MoverList
                    title="Gainers"
                    rows={gainers.map((i) => ({ id: i.symbol, symbol: i.symbol, name: i.name, day_change_pct: i.quote.change_pct }))}
                    empty="Nothing rose today."
                  />
                  <MoverList
                    title="Losers"
                    rows={losers.map((i) => ({ id: i.symbol, symbol: i.symbol, name: i.name, day_change_pct: i.quote.change_pct }))}
                    empty="Nothing declined today."
                  />
                </>
              )}
            </Card>
          </div>
        </section>

        {/* R3 · NEWS (§12ho2-7). The tile was titled "Briefing", but most of what it shows is
          * HEADLINES — the title named one part and mislabelled the rest. It is now the News tile,
          * and the Briefing is a LABELLED line inside it. Both terms are GLOSSARY terms, used
          * verbatim, for the two different things they actually name. Canonical: News. The briefing
          * body stays PAGE-LOCAL (§9-16 — 2nd occurrence; extraction at the 3rd). */}
        <section className="lf-card hm3__cell hm3__cell--brief" data-card="news">
          <SummaryHead title="News" to="/news" destination="News" whole />
          <div className="hm3__newsbody">
            <div className="hm3__briefblock">
              <h3 className="hm3__sublabel">
                <GlossaryTerm term="term-briefing">Briefing</GlossaryTerm>
              </h3>
              <Card data={briefing} onRetry={reload}>
                {(b) =>
                  b.text ? (
                    <p className="hm3__briefing">{b.text}</p>
                  ) : (
                    <EmptyState
                      message="No briefing yet."
                      reason="The briefing is built from your own served figures — it appears once there is data to summarise."
                    />
                  )
                }
              </Card>
            </div>
            <h3 className="hm3__sublabel">Top headlines</h3>
            <Card data={news} onRetry={reload}>
              {(n) =>
                n.no_egress ? (
                  <EmptyState
                    message="No headlines right now."
                    reason="No-egress is on — the app made no outbound call, so nothing was retrieved."
                  />
                ) : headlines.length === 0 ? (
                  <EmptyState
                    message="No headlines right now."
                    reason="None were retrieved for your holdings — headlines are retrieved, never invented."
                  />
                ) : (
                  <NewsList items={headlines} showSymbols clampLines={1} />
                )
              }
            </Card>
          </div>
        </section>

        {/* R3 · compact quote cards + source select (D-046/D-052). The row now carries the STANDARD
          * SummaryHead — title left, the source select as trailing meta, ↗ right (the §5 amendment
          * the owner approved at §12ho1-5, applied in ui/ at §12ho2-5). The tile no longer bolts a
          * naked ↗ onto the corner. */}
        <section className="lf-card hm3__cell hm3__cell--quotes" data-card="quotes">
          <Card data={quotes} onRetry={reload}>
            {(qs) =>
              qs.length === 0 ? (
                <EmptyState
                  message="No quotes to show."
                  reason="This source has nothing to quote yet — pick another source, or add a holding or watchlist item."
                />
              ) : (
                <QuoteCardRow
                  quotes={qs}
                  source={source as QuoteSource}
                  onSourceChange={setSource}
                  summary={{ to: "/markets", destination: "Markets" }}
                />
              )
            }
          </Card>
        </section>
      </div>
    </div>
  );
}

/** One movers list. Both pairs render through it, but they are NEVER interchanged (D-024): the
 *  caller supplies the canonical title, and each pair comes from its own canonical reader. */
interface MoverItem {
  id: string | number;
  symbol: string | null;
  label?: string | null;
  name?: string | null; // §14dr-19: instrument name beside the ticker
  day_change_pct: string | number | null;
}

function MoverList({ title, rows, empty }: { title: string; rows: MoverItem[]; empty: string }) {
  return (
    <div className="hm3__moverlist">
      <h3 className="hm3__moverhead">{title}</h3>
      {rows.length === 0 ? (
        <EmptyState message={empty} reason="Movers appear once a priced holding changes in value." />
      ) : (
        <ul className="hm3__moverrows">
          {rows.map((r) => (
            <li className="hm3__moverrow" key={r.id}>
              <span className="hm3__moversym">
                <InstrumentLabel symbol={r.symbol} name={r.name} fallback={r.label} truncate />
              </span>
              <span className={`hm3__moverpct hm3__moverpct--${signOf(r.day_change_pct)}`}>
                {formatSignedPercent(r.day_change_pct)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Progressive per-card load: undefined → Skeleton, null → an honest error (+ retry), value → content.
 * Each card owns its own state, so a slow reader never blanks the page (§9-4).
 */
function Card<T>({
  data,
  onRetry,
  children,
}: {
  data: T | null | undefined;
  onRetry?: () => void;
  children: (d: T) => ReactNode;
}) {
  if (data === undefined) return <Skeleton lines={3} />;
  if (data === null)
    return (
      <EmptyState
        message="Couldn't load this summary"
        reason="We couldn't reach the source of this figure — it's held back rather than guessed."
        action={onRetry ? <button type="button" className="lf-btn" onClick={onRetry}>Retry</button> : undefined}
      />
    );
  return <>{children(data)}</>;
}
