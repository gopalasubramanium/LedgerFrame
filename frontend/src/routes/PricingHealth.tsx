import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "./PricingHealth.css";
import {
  Button,
  DataTable,
  Dialog,
  EmptyState,
  MasterSelect,
  MetaStrip,
  PageHeader,
  ProvenanceBadge,
  RowMenu,
  Skeleton,
  TrendStat,
  useToast,
  StatusChip,
} from "../components/ui";
import type { Column, SortState, StatusChipTone } from "../components/ui";
import type { ConfidenceBand, Entitlement, HealthStatus, ValuationMethod } from "../mocks/types";
import { useLabelFor } from "../refdata/refdata-context";
import { invalidateStaleCount, useStaleCount } from "../state/staleCount";
import { RotateCw } from "../icons";
import { formatMoney, formatPrice } from "../format/number";
import {
  correctSource,
  getIdentifierDuplicates,
  getInstrumentDuplicates,
  getNoEgress,
  getPricingHealth,
  refreshAllMarketData,
  refreshHolding,
} from "../api/pricing-health";
import type {
  DuplicatesResp,
  InstrumentDuplicatesResp,
  PricingHealthResp,
  PricingRow,
} from "../api/pricing-health";

// Pricing Health (diagnostics) — IA §5, D-038/D-072. The canonical home for provenance, confidence,
// and routing diagnostics: the honest "why is this number what it is" view. Read-only diagnostics +
// refresh / correct-source (a per-instrument correction). NO provider-priority config (D-072). Every
// figure is a SERVED display value (P-1) — the page performs no money math.

// Semantic tone for a served status / confidence band (colour is never the sole signal — the served
// label is always shown alongside).
// Migrated onto the ratified StatusChip (page-policy §9-15). The TONES are unchanged — only their
// names are now the shared vocabulary: ok -> positive, bad -> negative, warn -> attention.
function statusTone(status: string): StatusChipTone {
  if (status === "Fresh") return "positive";
  if (status === "Unavailable" || status === "Estimated") return "negative";
  if (status === "Manual") return "neutral";
  return "attention"; // Delayed / End-of-day / Cached
}
function bandTone(band: string): StatusChipTone {
  return band === "high" ? "positive" : band === "low" ? "negative" : "attention";
}

// §14dr-3 — the diagnostics rows are sorted CLIENT-side (bounded set: per-holding, tens of rows).
// DEFAULT order pins the STALE rows (the ones the banner counts) to the top so they're identifiable
// on arrival, no interaction (§14ac-2 — a destination that can't answer "which" only half-answers);
// an explicit user sort (a header click) overrides. `is_stale` is the SAME served flag the banner
// count sums (one derivation), so marked rows == banner count by construction.
function sortHoldings(rows: PricingRow[], sort: SortState | null): PricingRow[] {
  const out = [...rows];
  if (!sort) {
    return out.sort(
      (a, b) => Number(b.is_stale) - Number(a.is_stale) || (b.price_ts ?? "").localeCompare(a.price_ts ?? ""),
    );
  }
  const mul = sort.dir === "asc" ? 1 : -1;
  return out.sort((a, b) => {
    const av = a[sort.key as keyof PricingRow];
    const bv = b[sort.key as keyof PricingRow];
    const an = typeof av === "string" ? Number(av) : av;
    const bn = typeof bv === "string" ? Number(bv) : bv;
    if (typeof an === "number" && typeof bn === "number" && !Number.isNaN(an) && !Number.isNaN(bn)) {
      return (an - bn) * mul;
    }
    return String(av ?? "").localeCompare(String(bv ?? "")) * mul;
  });
}

export function PricingHealth() {
  const labelFor = useLabelFor();
  const toast = useToast();

  const [data, setData] = useState<PricingHealthResp | null>();
  const [dups, setDups] = useState<DuplicatesResp | null>();
  const [instrDups, setInstrDups] = useState<InstrumentDuplicatesResp | null>();
  const [noEgress, setNoEgress] = useState(false);
  // The stale count is the ONE shared query the StaleBanner also reads (§12ph1-1) — the footnote
  // renders THIS value, so "matches the Stale banner" is true by construction.
  const { count: staleCount } = useStaleCount();

  const [refreshing, setRefreshing] = useState(false);
  // §14dr-3 — null = the stale-first default order; a header click sets an explicit column sort.
  const [sort, setSort] = useState<SortState | null>(null);
  const onSort = useCallback(
    (key: string) => setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" })),
    [],
  );
  const [detail, setDetail] = useState<PricingRow | null>(null); // Details dialog
  const [correcting, setCorrecting] = useState<PricingRow | null>(null); // Correct-source dialog
  const [override, setOverride] = useState("");
  // §14dr-8 — async-action in-flight guards: the correct-source save and per-row refresh.
  const [savingSource, setSavingSource] = useState(false);
  const [refreshingRow, setRefreshingRow] = useState<number | null>(null);

  const reload = useCallback(() => {
    setData(undefined);
    setDups(undefined);
    setInstrDups(undefined);
    getPricingHealth().then((r) => setData(r.ok ? r.data : null));
    getIdentifierDuplicates().then((r) => setDups(r.ok ? r.data : null));
    getInstrumentDuplicates().then((r) => setInstrDups(r.ok ? r.data : null));
    getNoEgress().then(setNoEgress);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  // §14dr-17 — REFRESH ALL MARKET DATA (ND-2/ND-3). Contract-held: orchestrates the quotes
  // (+world-index proxies), FX and news lanes the app already exposes, and reports a per-lane
  // result summary. Masters are EXCLUDED by ruling (manual in Settings → Data feeds). Long-
  // running → honest in-progress state (dr-8 standard, re-click guarded).
  const onRefreshAll = useCallback(async () => {
    if (noEgress) {
      toast.show({ message: "Refresh unavailable — no-egress is on. Stale prices stand.", tone: "warning" });
      return;
    }
    if (refreshing) return; // re-click guard while the lanes are in flight
    setRefreshing(true);
    const lanes = await refreshAllMarketData();
    setRefreshing(false);
    const failed = lanes.filter((l) => !l.ok);
    toast.show({
      message: lanes.map((l) => `${l.lane}: ${l.detail}`).join(" · "),
      tone: failed.length ? "warning" : undefined,
    });
    reload();
    invalidateStaleCount(); // banner + footnote move together after a refresh (§12ph1-1)
  }, [noEgress, toast, reload, refreshing]);

  const onRefreshHolding = useCallback(
    async (row: PricingRow) => {
      if (noEgress) {
        toast.show({ message: "Refresh unavailable — no-egress is on.", tone: "warning" });
        return;
      }
      if (refreshingRow != null) return; // re-click guard while a per-row refresh is in flight
      setRefreshingRow(row.id);
      try {
        const r = await refreshHolding(row.id);
        if (r.ok && r.data.refreshed === false) {
          toast.show({ message: r.data.reason ?? "Nothing to refresh." });
        } else if (r.ok) {
          toast.show({ message: `Refreshed ${row.label}.` });
          reload();
          invalidateStaleCount();
        } else {
          toast.show({ message: `Refresh failed: ${r.error}`, tone: "warning" });
        }
      } finally {
        setRefreshingRow(null);
      }
    },
    [noEgress, toast, reload, refreshingRow],
  );

  const onCommitSource = useCallback(async () => {
    if (!correcting?.symbol || savingSource) return;
    setSavingSource(true);
    try {
      const r = await correctSource(correcting.symbol, override);
      if (r.ok) {
        toast.show({ message: `Source corrected for ${correcting.label}.` });
        setCorrecting(null);
        reload();
        invalidateStaleCount();
      } else {
        toast.show({ message: `Couldn't set source: ${r.error}`, tone: "warning" });
      }
    } finally {
      setSavingSource(false);
    }
  }, [correcting, override, toast, reload, savingSource]);

  const columns: Column<PricingRow>[] = [
    {
      key: "label",
      label: "Holding",
      sortable: true,
      render: (r) => (r.symbol ? <Link to={`/instrument/${encodeURIComponent(r.symbol)}`}>{r.label}</Link> : r.label),
    },
    { key: "market_value", label: "Value", align: "right", sortable: true, render: (r) => formatMoney(r.market_value) },
    {
      key: "status",
      label: "Status",
      sortable: true,
      // §14dr-3 — the served per-holding `is_stale` flag, rendered: a Stale marker identifies WHICH
      // holdings the banner is counting (the same flag; never a recompute). Attention tone + the
      // "Stale" label (GLOSSARY term) — colour is never the sole signal.
      render: (r) => (
        <span className="ph__status">
          <StatusChip label={r.status} tone={statusTone(r.status)} />
          {r.is_stale && <StatusChip label="Stale" tone="attention" />}
        </span>
      ),
    },
    {
      key: "confidence",
      label: "Confidence",
      align: "right",
      sortable: true,
      render: (r) => (
        <span className="ph__conf">
          <span className="ph__num">{r.confidence}</span>
          <StatusChip label={r.confidence_band} tone={bandTone(r.confidence_band)} />
        </span>
      ),
    },
    {
      // R-63 Phase 4 (§9-1, AC-5): head=X / priced-by=Y provenance. `source` is who PRICED the row
      // (priced-by=Y); `route_source` is the route HEAD (X). When they differ the fallback net
      // fired, and the rendered source must not HIDE that — show "Y (head X)". The (corrected)
      // suffix (an explicit override) is unchanged. PROPOSED copy — ratified at the 0a look.
      key: "source", label: "Source", sortable: true,
      render: (r) => {
        const base = r.source_override ? `${r.source} (corrected)` : r.source;
        const netCaught = r.route_source && r.route_source !== r.source;
        return netCaught ? `${base} (head ${r.route_source})` : base;
      },
    },
    // R-38 §9-10: the served route_rule provenance chip (override | matrix | lane | active), read-only
    // (D-072). Plain served label, neutral tone — provenance is factual, never alarmist. Never recomputed.
    { key: "route_rule", label: "Rule", sortable: true, render: (r) => <StatusChip label={r.route_rule} tone="neutral" /> },
    {
      key: "id",
      label: "",
      render: (r) => (
        <RowMenu
          aria-label={`Actions for ${r.label}`}
          items={[
            { label: "Details", onClick: () => setDetail(r) },
            { label: "Refresh", onClick: () => onRefreshHolding(r), disabled: !r.symbol || refreshingRow != null },
            { label: "Correct source", onClick: () => { setCorrecting(r); setOverride(r.source_override ?? ""); }, disabled: !r.symbol },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="lf-page ph">
      <PageHeader
        title="Pricing Health"
        subtitle="Provenance, confidence & routing — the honest “why is this number what it is”"
        actions={
          <button type="button" className="lf-iconbtn lf-iconbtn--framed" onClick={onRefreshAll}
            disabled={refreshing || noEgress} aria-busy={refreshing} aria-label="Refresh all market data"
            title={noEgress ? "No-egress is on — refresh makes no network calls"
              : refreshing ? "Refreshing…"
              : "Refresh all market data — quotes, world indices, FX and news. Instrument masters are not included."}>
            {/* §14dr-8 — perceptible pending: the icon SPINS while refreshing (the owner clicked
                4× when the only signal was an imperceptible disabled flash). */}
            <RotateCw aria-hidden="true" className={refreshing ? "ph__spin" : undefined} />
          </button>
        }
      />
      {/* "(Guarantee 5)" -> "(Commitment 5)" — the §11-1 rename applied to this page as its own
          dated regularization (page-pricing-health, 2026-07-20). It was the ONE user-facing
          instance of the retired term outside Legal, and it sat on an ACCEPTED page, so it took a
          delta of its own with a plan note and a pre-pass re-run rather than being swept into the
          rename commit. */}
      {noEgress && (
        <p className="ph__egress" role="status">Refresh unavailable — no-egress is on; prices degrade to honest stale (Commitment 5).</p>
      )}
      {/* §14dr-17 — the button's scope is stated honestly so the masters exclusion is visible. */}
      <p className="ph__refreshscope" role="note">
        “Refresh all market data” refreshes quotes, world indices, FX and news. Instrument masters
        (mutual funds, coins) aren’t included — <a href="#/settings?tab=data-feeds">sync them in Settings → Data feeds</a>.
      </p>

      {/* R-38 §9-8: the honest Alpha-Vantage tier string, served (never a fabricated real-index label).
          Shown only when the active provider is a non-premium AV key. Index isn't a holdings lane, so
          this is surfaced as read-only provider context. */}
      {data?.provider_tier_note && (
        <p className="ph__tiernote" role="status">
          <StatusChip tone="attention" label={data.provider_tier_note} />
        </p>
      )}

      {/* Identifier-duplicate banner — we never guess which is correct (shown only when count > 0). */}
      <CardBody data={dups} lines={1} onRetry={reload}>
        {(d) =>
          d.count > 0 ? (
            <div className="ph__dupbanner" role="status">
              <strong>{d.count}</strong> identifier{d.count === 1 ? " is" : "s are"} shared across instruments —
              values are kept separate; we never guess which is correct. Correct the source per holding below.
            </div>
          ) : null
        }
      </CardBody>

      {/* R-63 I-6: duplicate-instrument banner (shown only when count > 0). New duplicates are now
          impossible (one identity resolution); this surfaces any that pre-date the guard so the
          user can resolve them on Holdings. We never guess which row is canonical. PROPOSED copy —
          ratified at the 0a look. */}
      <CardBody data={instrDups} lines={1} onRetry={reload}>
        {(d) =>
          d.count > 0 ? (
            <div className="ph__dupbanner" role="status">
              <strong>{d.count}</strong> duplicate instrument{d.count === 1 ? "" : "s"} —{" "}
              {d.duplicates.map((g) => g.symbol).join(", ")} appear{d.count === 1 ? "s" : ""} more than once.
              Each row prices on its own, which can read as “(corrected)”.{" "}
              <a href="#/holdings">Resolve on Holdings</a> by removing the extra row; new duplicates
              can no longer be created.
            </div>
          ) : null
        }
      </CardBody>

      {/* Portfolio confidence card (ND-6): overall band tile + by-band table + status-count chip strip. */}
      <section className="ph__card lf-card" data-card="confidence">
        <h2 className="ph__h2">Portfolio confidence</h2>
        <div className="lf-card__body">
          <CardBody data={data} lines={3} onRetry={reload}>
            {(d) => (
              <div className="ph__confgrid">
                <TrendStat label="Overall confidence" value={String(d.confidence.overall)} unit="/100"
                  tone={d.confidence.overall_band === "high" ? "up" : d.confidence.overall_band === "low" ? "down" : "flat"} />
                <table className="lf-table ph__bandtable">
                  <thead><tr><th className="lf-table__th">Band</th><th className="lf-table__th lf-table__th--num">Holdings</th><th className="lf-table__th lf-table__th--num">Value</th></tr></thead>
                  <tbody>
                    {(["high", "medium", "low"] as const).map((b) => (
                      <tr key={b} className="lf-table__tr">
                        <td className="lf-table__td"><StatusChip label={b} tone={bandTone(b)} /></td>
                        <td className="lf-table__td lf-table__td--num">{d.confidence.by_band[b]?.count ?? 0}</td>
                        <td className="lf-table__td lf-table__td--num">{(d.confidence.by_band[b]?.value_pct ?? 0).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="ph__statusstrip">
                  {Object.entries(d.summary).map(([status, n]) => (
                    <StatusChip key={status} label={status} tone={statusTone(status)} count={n} />
                  ))}
                </div>
                {/* ND-1 (§12ph1-1): render the SHARED stale count the Stale banner also reads — so
                    the claim is true by construction (never a stale, independently-fetched number). */}
                <p className="ph__stale">
                  <span data-testid="ph-stale-count">{staleCount}</span> of {d.holdings.length} prices stale — the
                  same count the Stale banner shows (one shared reader).
                </p>
              </div>
            )}
          </CardBody>
        </div>
      </section>

      {/* Per-holding diagnostics worklist. */}
      <section className="ph__card lf-card" data-card="diagnostics">
        <h2 className="ph__h2">Per-holding diagnostics</h2>
        <div className="lf-card__body">
          <CardBody data={data} lines={6} onRetry={reload}>
            {(d) =>
              d.holdings.length > 0 ? (
                <DataTable
                  columns={columns}
                  rows={sortHoldings(d.holdings, sort)}
                  sort={sort ?? undefined}
                  onSort={onSort}
                  caption="Per-holding pricing diagnostics"
                  stickyHeader
                />
              ) : (
                <EmptyState message="No holdings" reason="Add holdings to see their pricing diagnostics." />
              )
            }
          </CardBody>
        </div>
      </section>

      {/* Details dialog (ND-5/ND-8): full provenance badge + read-only routing chain + confidence factors. */}
      <Dialog open={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.label} — diagnostics` : ""} size="lg">
        {detail && (
          <div className="ph__detail">
            <ProvenanceBadge
              source={detail.source}
              entitlement={detail.entitlement as Entitlement}
              valuationMethod={detail.valuation_method as ValuationMethod}
              confidence={{ score: detail.confidence, band: detail.confidence_band as ConfidenceBand }}
              asOf={detail.price_ts ?? ""}
              status={detail.status as HealthStatus}
            />
            {detail.failure_reason && <p className="ph__note">{detail.failure_reason}</p>}
            {/* R-63 §9-2: the TYPED failure cause + its SERVED note (rendered verbatim, D-105 —
                copy PROPOSED pending 0a). Names the distinct reason (throttled/empty/…) instead of a
                flat "none"; a throttle's note carries "last at T". The state token is a read-only tag. */}
            {detail.failure_state && (
              <p className="ph__note ph__note--failure">
                <span className="ph__failstate">{detail.failure_state}</span>
                {detail.failure_note ? ` — ${detail.failure_note}` : null}
              </p>
            )}
            <h3 className="ph__h3">Routing</h3>
            {/* Route detail (route · rule · lane · chain) — the read-only provenance MetaStrip (§9-10).
                D1-c: the routing block uses routing vocabulary per D-028 — "Route" here (the route
                decision), distinct from the ProvenanceBadge "Source" above (the value-supplier). */}
            <MetaStrip
              items={[
                { label: "Route", value: detail.route_source },
                { label: "Rule", value: detail.route_rule },
                { label: "Lane", value: detail.route_lane },
                { label: "Class", value: detail.asset_class ? labelFor("asset_class", detail.asset_class) : "—" },
                { label: "Native price", value: detail.native_price != null ? `${detail.currency ?? ""} ${formatPrice(detail.native_price)}` : "—" },
              ]}
            />
            {/* D1-c: the router's OWN served reason (e.g. "awaiting NAV (refresh AMFI)"), surfaced
                here in the Routing block — otherwise masked by the generic failure_reason (D-105). */}
            {detail.route_reason && <p className="ph__note">{detail.route_reason}</p>}
            {/* §18-R4: the chain distinguishes "usable here" from "supported, no key on this
                instance" — the latter renders muted with its SERVED note (D-105), because an
                undifferentiated chain read as phantom providers at two levels of review. Falls
                back to the flat `priority_chain` if the detail is absent (older payload). */}
            <div className="ph__chain">
              <span className="ph__chainlabel">Priority chain (read-only):</span>
              {detail.priority_chain.length > 0
                ? (detail.priority_chain_detail?.length
                    ? detail.priority_chain_detail
                    : detail.priority_chain.map((s) => ({ source: s, keyed: true, note: null }))
                  ).map((e, i) => (
                    <StatusChip
                      key={e.source}
                      muted={!e.keyed}
                      label={`${i + 1}. ${e.source}${e.note ? ` ${e.note}` : ""}`}
                    />
                  ))
                : <span className="ph__note">manual — no provider chain</span>}
            </div>
            {(detail.auth_required || detail.mapping_required) && (
              <div className="ph__flags">
                {detail.auth_required && <StatusChip tone="attention" label={<>Needs an API key — add in <Link to="/settings">Settings</Link></>} />}
                {detail.mapping_required && <StatusChip tone="attention" label="Needs identifier mapping" />}
              </div>
            )}
            {detail.confidence_factors.length > 0 && (
              <>
                <h3 className="ph__h3">Why this confidence</h3>
                <ul className="ph__factors">
                  {detail.confidence_factors.map((f) => <li key={f}>{f}</li>)}
                </ul>
              </>
            )}
          </div>
        )}
      </Dialog>

      {/* Correct-source dialog (ND-4): a per-instrument CORRECTION over served options — never priority editing. */}
      <Dialog open={!!correcting} onClose={() => setCorrecting(null)} title={correcting ? `Correct source — ${correcting.label}` : ""} size="md">
        {correcting && (
          <div className="ph__correct">
            <p className="ph__note">
              Force a specific provider for this instrument (a per-instrument correction). This does not change
              provider priority for anything else (D-072). Choose “auto” to clear.
            </p>
            <MasterSelect master="source_override" value={override} onChange={setOverride} aria-label="Corrected source" />
            <div className="ph__actions">
              <button type="button" className="lf-btn" onClick={() => setCorrecting(null)}>Cancel</button>
              <Button variant="primary" loading={savingSource} onClick={onCommitSource}>Save correction</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

// Per-card loading wrapper: undefined → Skeleton, null → honest error, value → content.
function CardBody<T>({ data, lines = 4, onRetry, children }: {
  data: T | null | undefined; lines?: number; onRetry?: () => void; children: (d: T) => ReactNode;
}) {
  if (data === undefined) return <Skeleton lines={lines} />;
  if (data === null)
    return (
      <EmptyState message="Couldn't load this section" reason="We couldn't reach the source of these figures — they're held back rather than guessed."
        action={onRetry ? <button type="button" className="lf-btn" onClick={onRetry}>Retry</button> : undefined} />
    );
  return <>{children(data)}</>;
}
