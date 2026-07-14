import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DataTable,
  EmptyState,
  GlossaryTerm,
  MasterSelect,
  PageHeader,
  PercentInput,
  RowMenu,
  Segmented,
  Skeleton,
  StalenessChip,
  StatusChip,
  useToast,
} from "../components/ui";
import type { Column, StatusChipTone } from "../components/ui";
import {
  fetchDrift,
  fetchPolicy,
  savePolicyMeta,
  saveTargets,
} from "../api/policy";
import type { DriftResp, DriftRow, PolicyResp, PolicyTarget } from "../api/policy";
import { formatPercent } from "../format/number";
import "./Policy.css";

// Policy — canonical home for investment-policy INTENT and DRIFT (IA §2/§5, D-055).
//
// Drift is computed LIVE by the backend and REPORTS A GAP. It never names or implies a trade
// (D-055, protected copy). Every money figure is a SERVED display string (D-105) rendered verbatim.
// Review summarises this page's drift through the SAME backend reader, so the two cannot disagree.

const DIMENSIONS = ["asset_class", "currency", "region"] as const;
type Dimension = (typeof DIMENSIONS)[number];

// Display labels for the dimension switcher. The BUCKET vocabularies are never hardcoded — they come
// from /refdata via MasterSelect (D-005). These three are the axis names, not data.
const DIM_LABEL: Record<Dimension, string> = {
  asset_class: "Asset class",
  currency: "Currency",
  region: "Region",
};
// The master each dimension's bucket is drawn from (D-055: "a select driven by the dimension's
// master"). Same three masters the backend validates against (Gate A9) — picker and validator agree.
const DIM_MASTER: Record<Dimension, string> = {
  asset_class: "asset_class",
  currency: "currency",
  region: "region",
};

// §9-16 — out-of-band treatment. Over AND under are the SAME amber attention: both simply need a
// look. gain/loss colouring would VALUE the gap ("over = bad"), the nearest a colour can come to
// implying a trade (D-055). Served status is rendered as a LABEL, never a raw enum key.
const STATUS_LABEL: Record<string, string> = {
  in_band: "In band",
  over: "Over",
  under: "Under",
};
const STATUS_TONE: Record<string, StatusChipTone> = {
  in_band: "neutral",
  over: "attention",
  under: "attention",
};

interface DraftTarget {
  dimension: string;
  bucket: string;
  target_pct: string;
  min_pct: string;
  max_pct: string;
}

const toDraft = (t: PolicyTarget): DraftTarget => ({
  dimension: t.dimension,
  bucket: t.bucket,
  target_pct: String(t.target_pct),
  min_pct: t.min_pct === null ? "" : String(t.min_pct),
  max_pct: t.max_pct === null ? "" : String(t.max_pct),
});

export function Policy() {
  const toast = useToast();
  const [drift, setDrift] = useState<DriftResp | null>();
  const [policy, setPolicy] = useState<PolicyResp | null>();
  const [dim, setDim] = useState<Dimension>("asset_class");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editor state — the WHOLE target set (bulk replace, §9-2).
  const [draft, setDraft] = useState<DraftTarget[]>([]);
  const [band, setBand] = useState("");
  const [maxPos, setMaxPos] = useState("");

  // Per-card progressive loading: the two readers fire INDEPENDENTLY — a slow drift read skeletons
  // its own card and never blanks the page (page-portfolio §12-8).
  const reload = useCallback(() => {
    setDrift(undefined);
    setPolicy(undefined);
    fetchDrift().then((r) => setDrift(r.ok ? r.data : null));
    fetchPolicy().then((r) => setPolicy(r.ok ? r.data : null));
  }, []);
  useEffect(() => reload(), [reload]);

  const openEditor = () => {
    if (!policy) return;
    setDraft(policy.targets.map(toDraft));
    setBand(String(policy.default_band_pct));
    setMaxPos(policy.max_position_pct === null ? "" : String(policy.max_position_pct));
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    // BULK REPLACE (§9-2): the editor always sends the COMPLETE set. Every row the user still has is
    // included — a row omitted here would be DELETED, which is why the no-drop guarantee is tested.
    const targets = draft
      .filter((d) => d.bucket && d.target_pct !== "")
      .map((d) => ({
        dimension: d.dimension,
        bucket: d.bucket,
        target_pct: Number(d.target_pct),
        min_pct: d.min_pct === "" ? null : Number(d.min_pct),
        max_pct: d.max_pct === "" ? null : Number(d.max_pct),
      }));
    const meta = await savePolicyMeta({
      default_band_pct: Number(band),
      max_position_pct: maxPos === "" ? 0 : Number(maxPos), // 0 clears the limit (served semantics)
    });
    const res = await saveTargets(targets);
    setSaving(false);
    if (!res.ok || !meta.ok) {
      toast.show({ message: !res.ok ? res.error : !meta.ok ? meta.error : "Could not save.", tone: "warning" });
      return;
    }
    setEditing(false);
    toast.show({ message: "Policy saved.", tone: "success" });
    reload();
  };

  const active = useMemo(
    () => drift?.dimensions.find((d) => d.dimension === dim),
    [drift, dim],
  );

  const columns: Column<DriftRow>[] = [
    { key: "bucket", label: "Bucket", sortable: true, render: (r) => bucketLabel(r.bucket) },
    {
      key: "target_pct",
      label: "Target",
      align: "right",
      sortable: true,
      render: (r) => formatPercent(r.target_pct),
    },
    {
      key: "actual_pct",
      label: "Actual",
      align: "right",
      sortable: true,
      render: (r) => formatPercent(r.actual_pct),
    },
    {
      key: "lower_pct",
      label: "Band",
      align: "right",
      render: (r) => `${formatPercent(r.lower_pct)} – ${formatPercent(r.upper_pct)}`,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      // Served value -> a labelled chip. Over and under share the amber tone (§9-16).
      render: (r) => (
        <StatusChip
          label={STATUS_LABEL[r.status] ?? r.status}
          tone={STATUS_TONE[r.status] ?? "neutral"}
        />
      ),
    },
    {
      key: "gap_base",
      // §9-19 — "Gap to target". A GAP, never an instruction. The copy grep bars trade phrasings.
      label: "Gap to target",
      align: "right",
      sortable: true,
      render: (r) => r.gap_base_display, // served display string (D-105) — rendered verbatim
    },
  ];

  return (
    <>
      <PageHeader
        title="Policy"
        // Protected copy (D-055) — may not be removed.
        subtitle="Your investment policy: targets, bands and drift. Reporting, never a trade instruction."
        actions={
          policy ? (
            <button type="button" className="lf-btn lf-btn--primary" onClick={openEditor}>
              {policy.targets.length ? "Edit policy" : "Set targets"}
            </button>
          ) : undefined
        }
      />

      {/* DRIFT — the page's owned figures. */}
      <section className="lf-card pol__card">
        <header className="lf-card__header">
          <h2 className="lf-card__title">
            <GlossaryTerm term="term-out-of-band">Drift</GlossaryTerm>
          </h2>
          {/* A10 — a verdict resting on stale/low-confidence prices can never present as fresh. The
              flag rides the SAME payload the figures come from: no second fetch, nothing to skew. */}
          {drift?.inputs_stale && (
            <span className="pol__inputs">
              {drift.stale_inputs > 0 && <StalenessChip isStale asOf="" />}
              <span className="pol__inputsnote">{drift.inputs_note}</span>
              <Link to="/pricing-health">Pricing Health</Link>
            </span>
          )}
        </header>

        <div className="lf-card__body">
          {drift === undefined && <Skeleton lines={4} />}
          {drift === null && (
            <EmptyState
              message="Drift is unavailable."
              reason="The policy reader could not be reached."
              action={
                <button type="button" className="lf-btn" onClick={reload}>
                  Retry
                </button>
              }
            />
          )}

          {/* §9-13 — the state EVERY new user starts in (nothing is seeded). Honest reason + a way
              forward. PROPOSED copy — ratify at the walk. */}
          {drift && !drift.has_targets && (
            <EmptyState
              message="No policy defined."
              reason="Set target allocations to see how far your holdings sit from your own targets."
              action={
                <button type="button" className="lf-btn lf-btn--primary" onClick={openEditor}>
                  Set targets
                </button>
              }
            />
          )}

          {drift && drift.has_targets && (
            <>
              <Segmented
                aria-label="Policy dimension"
                value={dim}
                onChange={(v) => setDim(v as Dimension)}
                options={DIMENSIONS.map((d) => ({ value: d, label: DIM_LABEL[d] }))}
              />

              {!active && (
                <EmptyState
                  message={`No ${DIM_LABEL[dim].toLowerCase()} targets.`}
                  reason="Your policy does not set targets on this dimension."
                />
              )}

              {active && (
                <>
                  {/* Coverage is a RECONCILING TOTAL of the Target column, so it renders as a
                      <tfoot> row INSIDE the same table — it shares the body's column grid and
                      scroll gutter by construction (DESIGN-SYSTEM §5.2), instead of drifting out
                      of alignment in a sibling block. Under 100% is a legitimate policy, not an
                      error: it means the policy deliberately does not speak for the rest. */}
                  <DataTable<DriftRow>
                    caption={`Drift by ${DIM_LABEL[dim].toLowerCase()}`}
                    columns={columns}
                    rows={active.rows}
                    footer={[
                      {
                        key: "coverage",
                        emphasis: true,
                        cells: {
                          bucket: <GlossaryTerm term="term-coverage">Coverage</GlossaryTerm>,
                          target_pct: formatPercent(active.coverage_pct),
                        },
                      },
                    ]}
                  />

                  <p className="pol__coverage pol__muted">
                    Weights are a share of gross assets ({drift.gross_assets_display}); liabilities
                    are excluded.
                  </p>

                  {active.untargeted.length > 0 && (
                    <div className="pol__untargeted">
                      <h3 className="pol__subtitle">
                        <GlossaryTerm term="term-untargeted">Untargeted</GlossaryTerm>
                      </h3>
                      <p className="pol__muted">Held, but your policy does not mention it.</p>
                      <ul className="pol__untargetedlist">
                        {active.untargeted.map((u) => (
                          <li key={u.bucket}>
                            <span>{bucketLabel(u.bucket)}</span>
                            <span className="pol__num">{formatPercent(u.actual_pct)}</span>
                            <span className="pol__num">{u.actual_value_display}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </section>

      {/* CONCENTRATION — its own card (§9-12). */}
      {drift?.has_targets !== undefined && drift?.max_position_pct !== null && drift && (
        <section className="lf-card pol__card">
          <header className="lf-card__header">
            <h2 className="lf-card__title">
              <GlossaryTerm term="term-concentration">Concentration</GlossaryTerm>
            </h2>
          </header>
          <div className="lf-card__body">
            {drift.concentration.length === 0 ? (
              <EmptyState
                message="No position exceeds your limit."
                reason={`Your policy allows up to ${formatPercent(drift.max_position_pct)} in a single position.`}
              />
            ) : (
              <ul className="pol__conc">
                {drift.concentration.map((c) => (
                  <li key={`${c.label}-${c.symbol ?? ""}`}>
                    {/* D-098 — an entity reference LINKS. A manual asset has no symbol: plain text,
                        never a guessed route (§9-17). */}
                    <span className="pol__concname">
                      {c.symbol ? <Link to={`/instrument/${c.symbol}`}>{c.label}</Link> : c.label}
                    </span>
                    <StatusChip
                      label={`${formatPercent(c.weight_pct)} of assets`}
                      tone="attention"
                    />
                    <span className="pol__muted">limit {formatPercent(c.limit_pct)}</span>
                    <span className="pol__num">{c.value_display}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* Protected disclaimer (D-055) — served, rendered verbatim. */}
      {drift && <p className="pol__disclaimer">{drift.disclaimer}</p>}

      {/* EDITOR — [S]-gated by the served route (ambient PIN session, D-103: no second prompt). */}
      <Dialog
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit policy"
        size="xl"
        footer={
          <>
            <button type="button" className="lf-btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="lf-btn lf-btn--primary"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save policy"}
            </button>
          </>
        }
      >
        <div className="pol__editor">
          <div className="pol__metarow">
            <label className="pol__field">
              <span>Default band</span>
              <PercentInput value={band} onChange={setBand} min={0} max={100} aria-label="Default band" />
              {/* §9-18 — a blank band is NOT "no band": it inherits this one. Say so, or the user
                  misreads their own risk tolerance. PROPOSED copy — ratify at the walk. */}
              <small className="pol__muted">
                Applied either side of a target when that target sets no band of its own.
              </small>
            </label>
            <label className="pol__field">
              <span>Concentration limit</span>
              <PercentInput
                value={maxPos}
                onChange={setMaxPos}
                min={0}
                max={100}
                aria-label="Concentration limit"
              />
              <small className="pol__muted">Leave empty for no limit.</small>
            </label>
          </div>

          <table className="lf-table pol__edittable">
            <thead>
              <tr>
                <th className="lf-table__th">Dimension</th>
                <th className="lf-table__th">Bucket</th>
                <th className="lf-table__th lf-table__th--num">Target</th>
                <th className="lf-table__th lf-table__th--num">Min</th>
                <th className="lf-table__th lf-table__th--num">Max</th>
                <th className="lf-table__th" />
              </tr>
            </thead>
            <tbody>
              {draft.map((d, i) => (
                <tr key={i} className="lf-table__tr">
                  <td className="lf-table__td">
                    <MasterSelect
                      master="policy_dimension"
                      value={d.dimension}
                      // Changing the dimension re-binds the bucket master, so the old bucket (from a
                      // different master) is cleared — it could never be valid here.
                      onChange={(v) => updateRow(setDraft, i, { dimension: v, bucket: "" })}
                      aria-label="Dimension"
                    />
                  </td>
                  <td className="lf-table__td">
                    <MasterSelect
                      master={DIM_MASTER[d.dimension as Dimension] ?? "asset_class"}
                      value={d.bucket}
                      onChange={(v) => updateRow(setDraft, i, { bucket: v })}
                      aria-label="Bucket"
                    />
                  </td>
                  <td className="lf-table__td lf-table__td--num">
                    <PercentInput
                      value={d.target_pct}
                      onChange={(v) => updateRow(setDraft, i, { target_pct: v })}
                      min={0}
                      max={100}
                      aria-label="Target"
                    />
                  </td>
                  <td className="lf-table__td lf-table__td--num">
                    <PercentInput
                      value={d.min_pct}
                      onChange={(v) => updateRow(setDraft, i, { min_pct: v })}
                      min={0}
                      max={100}
                      aria-label="Minimum"
                    />
                    {d.min_pct === "" && effectiveBand(d.target_pct, band, "min") !== "" && (
                      <small className="pol__muted">
                        inherits {effectiveBand(d.target_pct, band, "min")}%
                      </small>
                    )}
                  </td>
                  <td className="lf-table__td lf-table__td--num">
                    <PercentInput
                      value={d.max_pct}
                      onChange={(v) => updateRow(setDraft, i, { max_pct: v })}
                      min={0}
                      max={100}
                      aria-label="Maximum"
                    />
                    {d.max_pct === "" && effectiveBand(d.target_pct, band, "max") !== "" && (
                      <small className="pol__muted">
                        inherits {effectiveBand(d.target_pct, band, "max")}%
                      </small>
                    )}
                  </td>
                  <td className="lf-table__td">
                    <RowMenu
                      aria-label={`Actions for ${d.bucket || "new target"}`}
                      items={[
                        {
                          label: "Remove",
                          danger: true,
                          onClick: () => setDraft((rows) => rows.filter((_, j) => j !== i)),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            type="button"
            className="lf-btn"
            onClick={() =>
              setDraft((rows) => [
                ...rows,
                { dimension: "asset_class", bucket: "", target_pct: "", min_pct: "", max_pct: "" },
              ])
            }
          >
            Add target
          </button>

          <p className="pol__muted pol__editnote">
            Bands left empty inherit the default band above.
          </p>
        </div>
      </Dialog>
    </>
  );
}

function updateRow(
  set: React.Dispatch<React.SetStateAction<DraftTarget[]>>,
  index: number,
  patch: Partial<DraftTarget>,
) {
  set((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
}

/** The band a blank min/max actually gets: target ± the default band, clamped 0–100 (§9-18). */
function effectiveBand(target: string, band: string, edge: "min" | "max"): string {
  const t = Number(target);
  const b = Number(band);
  if (!Number.isFinite(t) || !Number.isFinite(b) || target === "" || band === "") return "";
  const v = edge === "min" ? Math.max(0, t - b) : Math.min(100, t + b);
  return String(v);
}

/** Buckets are SERVED values (asset_class keys, currency codes, region names). Present the key
 *  readably without inventing a vocabulary — the labels themselves come from /refdata elsewhere. */
function bucketLabel(bucket: string): string {
  if (bucket === bucket.toUpperCase()) return bucket; // currency codes, regions like "US"
  return bucket.charAt(0).toUpperCase() + bucket.slice(1).replace(/_/g, " ");
}
