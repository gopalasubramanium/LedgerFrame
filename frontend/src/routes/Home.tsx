import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import "./Home.css";
import {
  AllocationDonut,
  EmptyState,
  GlossaryTerm,
  NewsList,
  PageHeader,
  QuoteCardRow,
  ReviewCard,
  Skeleton,
  SummaryHead,
  StalenessChip,
  TrendStat,
} from "../components/ui";
import type { QuoteCardItem, QuoteSource, ReviewSection, Verdict } from "../components/ui";
import { getHomePrefs } from "../api/home";
import type { HomeLayout } from "../api/home";
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
// Layouts (D-046, §9-1 label "Home layout: Simple / Full"): Simple = headline + ReviewCard + briefing.
// Full = the fixed D-046 set, in D-046's listing order (§9-10). The layout is SERVED (`home_layout`,
// §9-3); there is no on-page switch until Settings ships (§9-2a). Home renders NO ticker — the
// TickerStrip is global chrome (D-047 AMENDMENT). The widget set is FIXED (R-19 parked).

// §9-6: N=3 per movers pair — a summary, never out-detailing its canonical page.
const MOVERS_N = 3;
// §9-9: N=3 headlines from the "My holdings" group.
const HEADLINES_N = 3;
const HOLDINGS_GROUP = "My holdings";
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
  const [layout, setLayout] = useState<HomeLayout | null>();
  const [source, setSource] = useState<QuoteSource>();
  const [summary, setSummary] = useState<PortfolioSummary | null>();
  const [perf, setPerf] = useState<PerformanceResp | null>();
  const [review, setReview] = useState<ReviewResp | null>();
  const [briefing, setBriefing] = useState<BriefingResp | null>();
  const [news, setNews] = useState<GroupedNewsResp | null>();
  const [quotes, setQuotes] = useState<QuoteCardItem[] | null>();
  const [mkt, setMkt] = useState<OverviewResp | null>();
  const vocabs = useRefdataVocabs();

  // The layout + default quote source are SERVED (§9-3/§9-7) — the frontend invents neither.
  const loadPrefs = useCallback(() => {
    setLayout(undefined);
    getHomePrefs().then((p) => {
      setLayout(p ? p.layout : null);
      if (p) setSource((s) => s ?? p.quoteSource);
    });
  }, []);
  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  // Readers fire INDEPENDENTLY (never one Promise.all gate): a slow reader skeletons only its own
  // card. This is exactly what retiring the aggregate bought (§9-4).
  const reload = useCallback(() => {
    getPortfolioSummary().then((r) => setSummary(r.ok ? r.data : null));
    getReview().then((r) => setReview(r.ok ? r.data : null));
    getBriefing().then((r) => setBriefing(r.ok ? r.data : null));
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  // Full-only readers — not fetched at all in Simple (the layout is a composition, not a CSS hide).
  useEffect(() => {
    if (layout !== "full") return;
    getPerformance(PERF_DAYS, PERF_BENCHMARK, PERF_INCLUDE_MANUAL).then((r) => setPerf(r.ok ? r.data : null));
    getGroupedNews().then((r) => setNews(r.ok ? r.data : null));
    getMarketsOverview().then((r) => setMkt(r.ok ? r.data : null));
  }, [layout]);

  // The quote row re-reads when the source changes (§9-7: all four sources have a real reader).
  useEffect(() => {
    if (layout !== "full" || !source) return;
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
                  name: h.name ?? h.label ?? (h.symbol as string),
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
  }, [layout, source]);

  const classLabel = (v: string) =>
    vocabs?.["asset_class"]?.find((o) => o.value === v)?.label ?? humanize(v);

  const reviewSections: ReviewSection[] = (review?.items ?? []).map((i) => ({
    label: i.title,
    verdict: reviewVerdict(i.severity),
    detail: i.area,
  }));

  const headlines =
    news?.groups.find((g) => g.name === HOLDINGS_GROUP)?.items.slice(0, HEADLINES_N) ?? [];

  // Markets' pair — a display SORT of the served `change_pct` (page-markets ND-1), never a
  // computation. Losers are shown only where the change is actually negative (never a "loser" that
  // rose). This is the 2nd occurrence of the sort; a 3rd forces extraction (centralization rule).
  const pctOf = (i: OverviewInstrument) => Number(i.quote.change_pct ?? 0);
  const ranked = [...(mkt?.instruments ?? [])].sort((a, b) => pctOf(b) - pctOf(a));
  const gainers = ranked.filter((i) => pctOf(i) > 0).slice(0, MOVERS_N);
  const losers = [...ranked].reverse().filter((i) => pctOf(i) < 0).slice(0, MOVERS_N);

  // The layout itself is SERVED — hold the page until it is known, so Home never flashes the wrong
  // composition (and rotation never lands on a layout the owner did not configure). If the settings
  // reader is unreachable we say so and offer a retry — we never fall back to an INVENTED layout, and
  // never sit in a skeleton forever (Guarantee 3: an empty always carries its reason).
  if (layout === undefined) return <div className="hm2"><Skeleton lines={10} /></div>;
  if (layout === null)
    return (
      <div className="hm2">
        <PageHeader title="Home" subtitle="Your summary — tap any card for the full picture" />
        <section className="hm2__card lf-card">
          <div className="lf-card__body">
            <EmptyState
              message="Couldn't load your Home layout"
              reason="We couldn't reach your settings — rather than guess a layout, Home shows nothing."
              action={<button type="button" className="lf-btn" onClick={loadPrefs}>Retry</button>}
            />
          </div>
        </section>
      </div>
    );
  const full = layout === "full";

  return (
    <div className="hm2">
      <PageHeader
        title="Home"
        subtitle="Your summary — tap any card for the full picture"
      />

      {/* 1 — Headline: Net worth + Today's change (canonical: Net worth). */}
      <section className="hm2__card lf-card" data-card="headline">
        <SummaryHead
          title={<GlossaryTerm term="term-net-worth">Net worth</GlossaryTerm>}
          to="/net-worth"
          destination="Net worth"
        />
        <div className="lf-card__body">
          <Card data={summary} onRetry={reload}>
            {(s) => (
              <>
                <div className="hm2__kpis">
                  <TrendStat label="Net worth" value={formatMoney(s.total_value)} unit={s.base_currency} />
                  <TrendStat
                    label="Today's change"
                    value={formatSignedMoney(s.day_change)}
                    tone={signOf(s.day_change)}
                    unit={s.base_currency}
                    sparkline={full ? (perf?.series ?? []).map((p) => p.value) : undefined}
                  />
                </div>
                <p className="hm2__note">
                  <GlossaryTerm term="term-todays-change">Today&rsquo;s change</GlossaryTerm> — full detail on Net worth.
                  {s.has_stale ? <> · <StalenessChip isStale asOf="" /> {s.stale_count} stale</> : null}
                </p>
              </>
            )}
          </Card>
        </div>
      </section>

      {full ? (
        <>
          {/* 2 — Performance sparkline (canonical: Portfolio). Series only, no benchmark (§9-8). */}
          <section className="hm2__card lf-card" data-card="performance">
            <SummaryHead title="Performance" to="/portfolio" destination="Portfolio" whole />
            <div className="lf-card__body">
              <Card data={perf} onRetry={reload}>
                {(p) =>
                  p.series.length < 2 ? (
                    <EmptyState message="No performance history yet." reason="There is not enough price history to draw a line — it appears once prices accumulate." />
                  ) : (
                    <TrendStat
                      label="Portfolio"
                      value={formatMoney(p.series[p.series.length - 1].value)}
                      unit={p.base_currency}
                      sparkline={p.series.map((x) => x.value)}
                    />
                  )
                }
              </Card>
            </div>
          </section>

          {/* 3 — ONE allocation donut, by class (§9-5) (canonical: Portfolio). */}
          <section className="hm2__card lf-card" data-card="allocation">
            <SummaryHead title="Allocation by class" to="/portfolio" destination="Portfolio" whole />
            <div className="lf-card__body">
              <Card data={summary} onRetry={reload}>
                {(s) => {
                  const segments = Object.entries(s.allocation_by_class).map(([k, v]) => ({
                    label: classLabel(k),
                    value: v,
                  }));
                  return segments.length === 0 ? (
                    <EmptyState message="No allocation to show yet." reason="No priced holdings — allocation appears once a holding has a value." />
                  ) : (
                    <AllocationDonut segments={segments} legend />
                  );
                }}
              </Card>
            </div>
          </section>

          {/* 4 — BOTH movers pairs (§9-6). The two pairs are NEVER interchanged (D-024). */}
          <section className="hm2__card lf-card" data-card="movers">
            {/* Movers summarises TWO canonical pages, so it carries one ↗ per destination — the
              * header cannot be a single whole-header target without hiding one of them. */}
            <div className="hm2__moverhead2">
              <SummaryHead title="Contributors / Detractors" to="/portfolio" destination="Portfolio" whole />
              <SummaryHead title="Gainers / Losers" to="/markets" destination="Markets" whole />
            </div>
            <div className="lf-card__body">
              <Card data={summary} onRetry={reload}>
                {(s) => (
                  <div className="hm2__movers">
                    {/* Portfolio's pair — CONTRIBUTION-weighted. Never called Gainers/Losers (D-024). */}
                    <MoverList title="Contributors — today" rows={s.top_gainers.slice(0, MOVERS_N)} empty="Nothing contributed today." />
                    <MoverList title="Detractors — today" rows={s.top_losers.slice(0, MOVERS_N)} empty="Nothing declined today." />
                    {/* Markets' pair — PRICE-move. Never called Contributors/Detractors (D-024). */}
                    <MoverList
                      title="Gainers — today"
                      rows={gainers.map((i) => ({ id: i.symbol, symbol: i.symbol, day_change_pct: i.quote.change_pct }))}
                      empty="Nothing rose today."
                    />
                    <MoverList
                      title="Losers — today"
                      rows={losers.map((i) => ({ id: i.symbol, symbol: i.symbol, day_change_pct: i.quote.change_pct }))}
                      empty="Nothing declined today."
                    />
                  </div>
                )}
              </Card>
            </div>
          </section>

        </>
      ) : null}

      {/* 5 — ReviewCard. In BOTH layouts (D-046: Simple = headline + ReviewCard + briefing). It reads
        * the SAME reader Net worth's ReviewCard uses, so the attention count reconciles with /review
        * by construction — Home never recounts. */}
      <section className="hm2__card lf-card" data-card="review">
        <div className="lf-card__body">
          <Card data={review} onRetry={reload}>
            {(r) => (
              <ReviewCard
                sections={reviewSections}
                attention={r.count}
                link={{ href: "#/review", label: "Review" }}
              />
            )}
          </Card>
        </div>
      </section>

      {/* 6 — Briefing summary (+ headlines in Full). Canonical: News. Briefing is PAGE-LOCAL (§9-16). */}
      <section className="hm2__card lf-card" data-card="briefing">
        <SummaryHead
          title={<GlossaryTerm term="term-briefing">Briefing</GlossaryTerm>}
          to="/news"
          destination="News"
        />
        <div className="lf-card__body">
          <Card data={briefing} onRetry={reload}>
            {(b) =>
              b.text ? (
                <p className="hm2__briefing">{b.text}</p>
              ) : (
                <EmptyState message="No briefing yet." reason="The briefing is built from your own served figures — it appears once there is data to summarise." />
              )
            }
          </Card>
          {full ? (
            <Card data={news} onRetry={reload}>
              {(n) =>
                n.no_egress ? (
                  <EmptyState message="No headlines right now." reason="No-egress is on — the app made no outbound call, so nothing was retrieved." />
                ) : headlines.length === 0 ? (
                  <EmptyState message="No headlines right now." reason="None were retrieved for your holdings — headlines are retrieved, never invented." />
                ) : (
                  <NewsList items={headlines} />
                )
              }
            </Card>
          ) : null}
        </div>
      </section>

      {/* 7 — Compact quote cards, one row, source select (D-046/D-052). */}
      {full ? (
        <section className="hm2__card lf-card" data-card="quotes">
          <SummaryHead title="Quotes" to="/markets" destination="Markets" whole />
          <div className="lf-card__body">
            <Card data={quotes} onRetry={reload}>
              {(qs) =>
                qs.length === 0 ? (
                  <EmptyState message="No quotes to show." reason="This source has nothing to quote yet — pick another source, or add a holding or watchlist item." />
                ) : (
                  <QuoteCardRow quotes={qs} source={source as QuoteSource} onSourceChange={setSource} />
                )
              }
            </Card>
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** One movers list. Both pairs render through it, but they are NEVER interchanged (D-024): the
 *  caller supplies the canonical title, and each pair comes from its own canonical reader. */
interface MoverItem {
  id: string | number;
  symbol: string | null;
  label?: string | null;
  day_change_pct: string | number | null;
}

function MoverList({ title, rows, empty }: { title: string; rows: MoverItem[]; empty: string }) {
  return (
    <div className="hm2__moverlist">
      <h3 className="hm2__moverhead">{title}</h3>
      {rows.length === 0 ? (
        <EmptyState message={empty} reason="Movers appear once a priced holding changes in value." />
      ) : (
        <ul className="hm2__moverrows">
          {rows.map((r) => (
            <li className="hm2__moverrow" key={r.id}>
              <span className="hm2__moversym">{r.symbol ?? r.label ?? "—"}</span>
              <span className={`hm2__moverpct lf-chg--${signOf(r.day_change_pct)}`}>
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
  if (data === undefined) return <Skeleton lines={4} />;
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
