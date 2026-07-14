import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "./PricingHealth.css";
import {
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
import type { Column, StatusChipTone } from "../components/ui";
import type { ConfidenceBand, Entitlement, HealthStatus, ValuationMethod } from "../mocks/types";
import { useLabelFor } from "../refdata/refdata-context";
import { invalidateStaleCount, useStaleCount } from "../state/staleCount";
import { RotateCw } from "../icons";
import { formatMoney, formatPrice } from "../format/number";
import {
  correctSource,
  getIdentifierDuplicates,
  getNoEgress,
  getPricingHealth,
  refreshAllData,
  refreshHolding,
} from "../api/pricing-health";
import type { DuplicatesResp, PricingHealthResp, PricingRow } from "../api/pricing-health";

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

export function PricingHealth() {
  const labelFor = useLabelFor();
  const toast = useToast();

  const [data, setData] = useState<PricingHealthResp | null>();
  const [dups, setDups] = useState<DuplicatesResp | null>();
  const [noEgress, setNoEgress] = useState(false);
  // The stale count is the ONE shared query the StaleBanner also reads (§12ph1-1) — the footnote
  // renders THIS value, so "matches the Stale banner" is true by construction.
  const { count: staleCount } = useStaleCount();

  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<PricingRow | null>(null); // Details dialog
  const [correcting, setCorrecting] = useState<PricingRow | null>(null); // Correct-source dialog
  const [override, setOverride] = useState("");

  const reload = useCallback(() => {
    setData(undefined);
    setDups(undefined);
    getPricingHealth().then((r) => setData(r.ok ? r.data : null));
    getIdentifierDuplicates().then((r) => setDups(r.ok ? r.data : null));
    getNoEgress().then(setNoEgress);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  // Bulk "Refresh all" (ND-2/ND-3): the SAME /system/refresh-data the app already exposes. Long-
  // running → honest in-progress state; the served updated/failed/skipped summary shown on completion.
  const onRefreshAll = useCallback(async () => {
    if (noEgress) {
      toast.show({ message: "Refresh unavailable — no-egress is on. Stale prices stand.", tone: "warning" });
      return;
    }
    setRefreshing(true);
    const r = await refreshAllData();
    setRefreshing(false);
    if (!r.ok) {
      toast.show({ message: `Refresh failed: ${r.error}`, tone: "warning" });
      return;
    }
    const s = r.data;
    toast.show({
      message: `Refreshed ${s.refreshed} of ${s.total}${s.failed.length ? ` · ${s.failed.length} failed` : ""}${s.skipped ? ` · ${s.skipped} skipped` : ""}`,
      tone: s.failed.length || s.skipped ? "warning" : undefined,
    });
    reload();
    invalidateStaleCount(); // banner + footnote move together after a refresh (§12ph1-1)
  }, [noEgress, toast, reload]);

  const onRefreshHolding = useCallback(
    async (row: PricingRow) => {
      if (noEgress) {
        toast.show({ message: "Refresh unavailable — no-egress is on.", tone: "warning" });
        return;
      }
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
    },
    [noEgress, toast, reload],
  );

  const onCommitSource = useCallback(async () => {
    if (!correcting?.symbol) return;
    const r = await correctSource(correcting.symbol, override);
    if (r.ok) {
      toast.show({ message: `Source corrected for ${correcting.label}.` });
      setCorrecting(null);
      reload();
      invalidateStaleCount();
    } else {
      toast.show({ message: `Couldn't set source: ${r.error}`, tone: "warning" });
    }
  }, [correcting, override, toast, reload]);

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
      render: (r) => <StatusChip label={r.status} tone={statusTone(r.status)} />,
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
    { key: "source", label: "Source", sortable: true, render: (r) => r.source_override ? `${r.source} (corrected)` : r.source },
    {
      key: "id",
      label: "",
      render: (r) => (
        <RowMenu
          aria-label={`Actions for ${r.label}`}
          items={[
            { label: "Details", onClick: () => setDetail(r) },
            { label: "Refresh", onClick: () => onRefreshHolding(r), disabled: !r.symbol },
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
            disabled={refreshing || noEgress} aria-busy={refreshing} aria-label="Refresh all prices"
            title={noEgress ? "No-egress is on — refresh makes no network calls" : refreshing ? "Refreshing…" : "Refresh all prices"}>
            <RotateCw aria-hidden="true" />
          </button>
        }
      />
      {noEgress && (
        <p className="ph__egress" role="status">Refresh unavailable — no-egress is on; prices degrade to honest stale (Guarantee 5).</p>
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
                <DataTable columns={columns} rows={d.holdings} caption="Per-holding pricing diagnostics" stickyHeader />
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
            <h3 className="ph__h3">Routing</h3>
            <MetaStrip
              items={[
                { label: "Lane", value: detail.route_lane },
                { label: "Selected source", value: detail.route_source },
                { label: "Class", value: detail.asset_class ? labelFor("asset_class", detail.asset_class) : "—" },
                { label: "Native price", value: detail.native_price != null ? `${detail.currency ?? ""} ${formatPrice(detail.native_price)}` : "—" },
              ]}
            />
            <div className="ph__chain">
              <span className="ph__chainlabel">Priority chain (read-only):</span>
              {detail.priority_chain.length > 0
                ? detail.priority_chain.map((s, i) => <StatusChip key={s} label={`${i + 1}. ${s}`} />)
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
              <button type="button" className="lf-btn lf-btn--primary" onClick={onCommitSource}>Save correction</button>
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
