import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil } from "../icons";
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
import { useLabelFor } from "../refdata/refdata-context";
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
  // D-005 — the UI NEVER hardcodes a value->label mapping. /refdata SERVES the display labels
  // ("ETF", not "Etf"; "Mutual fund", not "Mutual_fund"), and they are rendered verbatim.
  const labelFor = useLabelFor();
  const bucketLabel = (dimension: string, bucket: string) =>
    labelFor(DIM_MASTER[dimension as Dimension] ?? dimension, bucket);
  const [drift, setDrift] = useState<DriftResp | null>();
  const [policy, setPolicy] = useState<PolicyResp | null>();
  const [dim, setDim] = useState<Dimension>("asset_class");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editDim, setEditDim] = useState<Dimension>("asset_class");
  const [formError, setFormError] = useState<string | null>(null);

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

  const hasTargets = Boolean(policy?.targets.length);

  const openEditor = () => {
    if (!policy) return;
    setFormError(null);
    setEditDim("asset_class");
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
      // §12po1-8 — the backend owns the rules; the editor shows exactly what it said, in place,
      // so the user can fix it where they are (a toast would vanish before they could act on it).
      setFormError(!res.ok ? res.error : !meta.ok ? meta.error : "Could not save.");
      return;
    }
    setFormError(null);
    setEditing(false);
    toast.show({ message: "Policy saved.", tone: "success" });
    reload();
  };

  const active = useMemo(
    () => drift?.dimensions.find((d) => d.dimension === dim),
    [drift, dim],
  );

  const columns: Column<DriftRow>[] = [
    { key: "bucket", label: "Bucket", sortable: true, render: (r) => bucketLabel(dim, r.bucket) },
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
    <div className="lf-page pol">
      <PageHeader
        title="Policy"
        // Protected copy (D-055) — may not be removed.
        subtitle="Your investment policy: targets, bands and drift. Reporting, never a trade instruction."
        actions={
          policy ? (
            // §12po1-2 / §12po2-2 — the verb follows the STATE (you cannot "edit" a policy you have
            // not set), and the icon rides WITH the text label, never instead of it.
            <button type="button" className="lf-btn lf-btn--primary pol__btn" onClick={openEditor}>
              <Pencil aria-hidden="true" />
              {hasTargets ? "Edit policy" : "Set policy"}
            </button>
          ) : undefined
        }
      />

      {/* DRIFT — the page's owned figures. */}
      <section className="lf-card pol__card">
        <header className="lf-card__header">
          <h2 className="lf-card__title">Drift</h2>
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
              reason="Your policy could not be loaded just now."
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
                <button type="button" className="lf-btn lf-btn--primary pol__btn" onClick={openEditor}>
                  <Pencil aria-hidden="true" />
                  Set policy
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

                  {/* [Help] targets (§9-14). The popovers live where the words are — NOT inside a
                      heading: GlossaryTerm carries role="button" + aria-label, so nesting one in an
                      <h2> REPLACES the heading's accessible name. Caught by the Phase-3a pre-pass. */}
                  <p className="pol__legend">
                    <GlossaryTerm term="term-target">Target</GlossaryTerm>
                    <GlossaryTerm term="term-band">Band</GlossaryTerm>
                    <GlossaryTerm term="term-out-of-band">Out of band</GlossaryTerm>
                    <GlossaryTerm term="term-gap-to-target">Gap to target</GlossaryTerm>
                    <GlossaryTerm term="term-concentration">Concentration</GlossaryTerm>
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
                            <span>{bucketLabel(dim, u.bucket)}</span>
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
            <h2 className="lf-card__title">Concentration</h2>
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
        title={hasTargets ? "Edit policy" : "Set policy"}
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
          {/* §12po1-8 — the SERVED validation message, surfaced inline where the user is working.
              The rules live in the backend (one place); the editor shows what it said, verbatim. */}
          {formError && (
            <p className="pol__error" role="alert">
              {formError}
            </p>
          )}

          <div className="pol__metarow">
            <label className="pol__field">
              <span>Default band</span>
              <PercentInput value={band} onChange={setBand} min={0} max={100} aria-label="Default band" />
              {/* §9-18 — a blank band is NOT "no band": it inherits this one. Say so, or the user
                  misreads their own risk tolerance. PROPOSED copy — ratify at the walk. */}
              <small className="pol__muted">
                Applied either side of a target that sets no band of its own.
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

          {/* §12po2-3 — ONE header block, sticky inside the dialog's SINGLE scroll container.
              Before: the table had its OWN nested scroller inside a dialog that already scrolls, and
              rows slid half-under a sticky <th> — which reads exactly like a duplicated header
              overlapping the content. (There was never a cloned NODE; the DOM always had one header.
              What the owner saw was content printing through it — the §12ho3-3 lesson again.)
              Now: the dialog body is the one scroll region, the header sticks to it, and every row
              sits on the SAME grid template, so columns line up across rows AND across dimensions. */}
          <div className="pol__edithead">
            <div className="pol__metarow">
              <label className="pol__field">
                <span>Default band</span>
                <PercentInput value={band} onChange={setBand} min={0} max={100} aria-label="Default band" />
                <small className="pol__muted">
                  Applied either side of a target that sets no band of its own.
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

            <Segmented
              aria-label="Edit dimension"
              value={editDim}
              onChange={(v) => setEditDim(v as Dimension)}
              options={DIMENSIONS.map((d) => ({
                value: d,
                label: (
                  <>
                    {DIM_LABEL[d]}
                    {countIn(draft, d) > 0 && <span className="lf-segbtn__count">{countIn(draft, d)}</span>}
                  </>
                ),
              }))}
            />

            <div className="pol__grid pol__gridhead" role="row">
              <span role="columnheader">Bucket</span>
              <span role="columnheader" className="pol__num">Target</span>
              <span role="columnheader" className="pol__num">Band (min–max)</span>
              <span />
            </div>
          </div>

          <div className="pol__rows" role="table" aria-label={`${DIM_LABEL[editDim]} targets`}>
            {rowsFor(draft, editDim).length === 0 && (
              <p className="pol__emptyrow">No {DIM_LABEL[editDim].toLowerCase()} targets yet.</p>
            )}
            {rowsFor(draft, editDim).map(({ row, index }) => (
              <div className="pol__grid pol__row" role="row" key={index}>
                <MasterSelect
                  master={DIM_MASTER[editDim]}
                  value={row.bucket}
                  onChange={(v) => updateRow(setDraft, index, { bucket: v })}
                  aria-label="Bucket"
                />
                <PercentInput
                  value={row.target_pct}
                  onChange={(v) => updateRow(setDraft, index, { target_pct: v })}
                  min={0}
                  max={100}
                  aria-label="Target"
                />
                {/* The band pair and its inherited-band note share ONE cell, and the note sits in a
                    RESERVED lane (always present, hidden when empty) so a row that inherits and a
                    row that does not are exactly the same height — the rhythm cannot break. */}
                <span className="pol__bandcell">
                  <span className="pol__bandpair">
                    <PercentInput
                      value={row.min_pct}
                      onChange={(v) => updateRow(setDraft, index, { min_pct: v })}
                      min={0}
                      max={100}
                      placeholder={effectiveBand(row.target_pct, band, "min") || undefined}
                      aria-label="Minimum"
                    />
                    <span className="pol__bandsep" aria-hidden="true">
                      –
                    </span>
                    <PercentInput
                      value={row.max_pct}
                      onChange={(v) => updateRow(setDraft, index, { max_pct: v })}
                      min={0}
                      max={100}
                      placeholder={effectiveBand(row.target_pct, band, "max") || undefined}
                      aria-label="Maximum"
                    />
                  </span>
                  <small className="pol__inherits" aria-hidden={!inheritedBand(row, band)}>
                    {inheritedBand(row, band) ? `inherits ${inheritedBand(row, band)}` : "\u00a0"}
                  </small>
                </span>
                <RowMenu
                  aria-label={`Actions for ${row.bucket || "new target"}`}
                  items={[
                    {
                      label: "Remove",
                      danger: true,
                      onClick: () => setDraft((rows) => rows.filter((_, j) => j !== index)),
                    },
                  ]}
                />
              </div>
            ))}
          </div>

          <div className="pol__editfoot">
            <button
              type="button"
              className="lf-btn"
              onClick={() =>
                setDraft((rows) => [
                  ...rows,
                  { dimension: editDim, bucket: "", target_pct: "", min_pct: "", max_pct: "" },
                ])
              }
            >
              Add {DIM_LABEL[editDim].toLowerCase()} target
            </button>
            {/* §12po1-9 — bulk-replace semantics are UNCHANGED, and now SAID OUT LOUD. The user is
                editing their whole policy, not one dimension of it. */}
            <p className="pol__muted pol__editnote">
              Saving replaces your whole policy — every dimension, not just this one.
            </p>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

/** The draft rows belonging to one dimension, carrying their index in the FULL draft — the save
 *  always sends every dimension (bulk replace), so an index is what edits must address. */
function rowsFor(draft: DraftTarget[], dim: Dimension): { row: DraftTarget; index: number }[] {
  return draft
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.dimension === dim);
}

const countIn = (draft: DraftTarget[], dim: Dimension) =>
  draft.filter((d) => d.dimension === dim).length;

/** The band a row INHERITS when it sets none of its own: target ± the default band (§9-18). */
function inheritedBand(row: DraftTarget, band: string): string | null {
  if (row.min_pct !== "" || row.max_pct !== "") return null;
  const lo = effectiveBand(row.target_pct, band, "min");
  const hi = effectiveBand(row.target_pct, band, "max");
  return lo && hi ? `${lo}–${hi}%` : null;
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

