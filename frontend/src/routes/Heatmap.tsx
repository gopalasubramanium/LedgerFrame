import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import "./Heatmap.css";
import {
  EmptyState,
  GlossaryTerm,
  PageHeader,
  Select,
  Skeleton,
  Treemap,
} from "../components/ui";
import type { SelectOption, TreemapNode } from "../components/ui";
import { useRefdataVocabs } from "../refdata/refdata-context";
import { humanize } from "../mocks/refdata";
import { getHoldings } from "../api/holdings";
import type { HoldingRow, HoldingsResponse } from "../api/holdings";

// Heatmap (Markets-group, Overview template) — a treemap of YOUR holdings (IA §2/§5, D-053). It owns
// NOTHING: tile size = served `market_value`, tile colour = served Today's change (`day_change_pct`).
// The page performs NO money math — it only classifies a served signed change into a semantic tone.
// Priced-only (unpriced + liabilities excluded, gross-assets principle); stale INCLUDED — staleness
// honesty is carried by the global StaleBanner (ND-3). Region is served, D-083 six buckets (ND-8).

const ALL = "all";

// ND-3: colour tone from the SIGN of the served day change — a display classification, not math.
function toneOf(dayChange?: number | null): "gain" | "loss" | "flat" {
  if (dayChange == null || dayChange === 0) return "flat";
  return dayChange > 0 ? "gain" : "loss";
}

function distinct(values: (string | null | undefined)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v))).sort();
}

export function Heatmap() {
  const [data, setData] = useState<HoldingsResponse | null>();
  const [assetClass, setAssetClass] = useState(ALL);
  const [region, setRegion] = useState(ALL);
  const vocabs = useRefdataVocabs();

  const reload = useCallback(() => {
    setData(undefined);
    getHoldings().then((r) => setData(r.ok ? r.data : null));
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  const holdings = useMemo<HoldingRow[]>(() => data?.holdings ?? [], [data]);
  // Priced-only: is_priced AND a positive value → excludes unpriced holdings AND liabilities
  // (market_value < 0), per the gross-assets principle (ND-3/ND-4). Stale rows are KEPT (ND-3).
  const priced = useMemo<HoldingRow[]>(
    () => holdings.filter((h) => h.is_priced && (h.market_value ?? 0) > 0),
    [holdings],
  );

  // Filter options from the priced universe — SERVED values (D-005). Class labels resolve through
  // /refdata (D-005 zero-copy, humanize fallback); region is already served display-cased (ND-8).
  const classLabel = useCallback(
    (v: string) => vocabs?.["asset_class"]?.find((o) => o.value === v)?.label ?? humanize(v),
    [vocabs],
  );
  const classOptions = useMemo<SelectOption[]>(
    () => [{ value: ALL, label: "All classes" }, ...distinct(priced.map((h) => h.asset_class)).map((v) => ({ value: v, label: classLabel(v) }))],
    [priced, classLabel],
  );
  const regionOptions = useMemo<SelectOption[]>(
    () => [{ value: ALL, label: "All regions" }, ...distinct(priced.map((h) => h.region)).map((v) => ({ value: v, label: v }))],
    [priced],
  );

  const shown = useMemo<HoldingRow[]>(
    () =>
      priced.filter(
        (h) => (assetClass === ALL || h.asset_class === assetClass) && (region === ALL || h.region === region),
      ),
    [priced, assetClass, region],
  );

  const baseCcy = data?.base_currency ?? "";
  const nodes = useMemo<TreemapNode[]>(
    () =>
      shown.map((h) => ({
        label: h.symbol || h.name || h.label || "—",
        value: h.market_value as number,
        tone: toneOf(h.day_change),
        magnitudePct: h.day_change_pct != null ? Math.abs(h.day_change_pct) : undefined,
        // ND-7: a tile links to its InstrumentDetail (D-098); only when a symbol exists.
        href: h.symbol ? `#/instrument/${encodeURIComponent(h.symbol)}` : undefined,
        // §12hm1-1: the hover/focus readout. Both figures are SERVED display strings — the page
        // pairs the served amount with the served base currency and formats nothing. A holding with
        // no Today's change (nothing to compare against) shows an em dash + the reason (Guarantee 3).
        readout: {
          value: h.market_value_display != null ? `${baseCcy} ${h.market_value_display}`.trim() : null,
          change: h.day_change_pct_display ?? null,
          note: h.day_change_pct_display == null ? "No prior close to compare." : null,
        },
      })),
    [shown, baseCcy],
  );

  return (
    <div className="lf-page hm">
      <PageHeader
        title="Heatmap"
        subtitle="Your holdings — tile size is position value, colour is Today's change"
        actions={
          data && priced.length > 0 ? (
            <div className="hm__controls">
              <Select aria-label="Filter by asset class" value={assetClass} onChange={setAssetClass} options={classOptions} />
              <Select aria-label="Filter by region" value={region} onChange={setRegion} options={regionOptions} />
            </div>
          ) : undefined
        }
      />

      <section className="hm__card lf-card" data-card="heatmap">
        {/* Legend + honest notes — shown only alongside real data (honest-metadata rule). */}
        {data && priced.length > 0 ? (
          <div className="hm__legend">
            <span className="hm__legenditem"><span className="hm__swatch hm__swatch--gain" aria-hidden /> Up</span>
            <span className="hm__legenditem"><span className="hm__swatch hm__swatch--loss" aria-hidden /> Down</span>
            <span className="hm__legendmeta">
              Size = value · Colour = <GlossaryTerm term="term-todays-change">Today&rsquo;s change</GlossaryTerm>
            </span>
          </div>
        ) : null}
        <div className="lf-card__body">
          <CardBody data={data} onRetry={reload}>
            {(d) => {
              if (priced.length === 0) {
                return (
                  <EmptyState
                    message="No priced holdings to chart."
                    reason={
                      d.holdings.length > 0
                        ? "Every holding is unpriced or a liability — nothing has a positive market value to size a tile."
                        : "No holdings recorded yet."
                    }
                  />
                );
              }
              if (shown.length === 0) {
                return <EmptyState message="No holdings match this filter." reason="Try a different asset class or region." />;
              }
              return (
                <>
                  <Treemap nodes={nodes} squarified aria-label="Holdings heatmap — each tile links to its instrument" />
                  <p className="hm__note">
                    Showing {shown.length} of {holdings.length} holdings — unpriced excluded. Assets only —
                    liabilities are excluded.
                  </p>
                </>
              );
            }}
          </CardBody>
        </div>
      </section>

      <p className="hm__help">
        <GlossaryTerm term="term-heatmap">Heatmap</GlossaryTerm> — a visualisation of your holdings.
        Reporting only — every figure comes straight from your own data.
      </p>
    </div>
  );
}

// Progressive load: undefined → Skeleton, null → honest error (+ retry), value → content.
function CardBody<T>({
  data,
  onRetry,
  children,
}: {
  data: T | null | undefined;
  onRetry?: () => void;
  children: (d: T) => ReactNode;
}) {
  if (data === undefined) return <Skeleton lines={8} />;
  if (data === null)
    return (
      <EmptyState
        message="Couldn't load your holdings"
        reason="We couldn't reach the source of these figures — they're held back rather than guessed."
        action={onRetry ? <button type="button" className="lf-btn" onClick={onRetry}>Retry</button> : undefined}
      />
    );
  return <>{children(data)}</>;
}
