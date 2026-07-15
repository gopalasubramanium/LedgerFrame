import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "./Review.css";
import {
  DataTable,
  DateInput,
  Dialog,
  EmptyState,
  GlossaryTerm,
  PageHeader,
  Skeleton,
  TextInput,
  TrendStat,
  useToast,
  SummaryLink,
  StatusChip,
  Button,
} from "../components/ui";
import type { Column, StatusChipTone } from "../components/ui";
import { CircleCheck } from "../icons";
import { formatMoney, formatSignedMoney, signOf } from "../format/number";
import { relativeDays } from "../format/time";
import { getReviewHistory, getReviewPage, markReviewed } from "../api/review";
import type { ReviewAttentionItem, ReviewHistoryResp, ReviewPageResp } from "../api/review";

// Review (Planning-group home) — IA §5, D-038/D-059/D-030. Canonical home for review verdicts + the
// attention list, Mark-reviewed (with history). Worklist template (summary header + attention body).
// Every value is a SERVED display value from the reader — the page performs NO money math and NO
// threshold logic (D-059 thresholds are backend-owned). Reporting only, never advice.

// ND-7: a navigation-only area→canonical-page map. An unrecognised area (incl. "ok") renders WITHOUT a
// link — never a guessed route. Some targets are not built yet (honest NotBuilt fallback). Keys are the
// canonical enum; the served area is display-cased (§12rv1-5), so we normalise before lookup.
const AREA_ROUTE: Record<string, string> = {
  policy: "/policy",
  data: "/pricing-health",
  liquidity: "/cash-flow",
  runway: "/cash-flow",
  goals: "/cash-flow",              // §12rv2-1: Goals are canonical on Cash flow (ND-7), not Scenarios
  "income & expenses": "/cash-flow", // §12cf1-2/§12rv2-1: the "obligations" area, aligned + routed to its canonical home
  insurance: "/insurance",
  estate: "/estate",
  corporate: "/holdings",
};

// ND-4: severity orders items within the list, higher first (review before info). Only display
// ordering of served values — never a hardcoded severity list rendered as copy.
const SEV_ORDER: Record<string, number> = { review: 0, info: 1 };

// §12rv1-4 (ND-4 REVERSAL) — severity is SEMANTIC: map the served value to a ratified tone. "Review"
// → the attention/warning token; "Info" → neutral. Mapped by served value (case-normalised) with a
// NEUTRAL fallback for any unknown severity — no hardcoded severity list, no invented colour.
const SEV_TONE: Record<string, StatusChipTone> = { review: "attention", info: "neutral" };
const sevKey = (s: string) => s.toLowerCase();

export function Review() {
  const toast = useToast();
  const [page, setPage] = useState<ReviewPageResp | null>();
  const [history, setHistory] = useState<ReviewHistoryResp | null>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [note, setNote] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [saving, setSaving] = useState(false);

  const reloadHistory = useCallback(() => {
    setHistory(undefined);
    getReviewHistory().then((r) => setHistory(r.ok ? r.data : null));
  }, []);
  const reload = useCallback(() => {
    setPage(undefined);
    getReviewPage().then((r) => setPage(r.ok ? r.data : null));
    reloadHistory();
  }, [reloadHistory]);
  useEffect(() => {
    reload();
  }, [reload]);

  // Sort a copy of the served attention list (review before info); the served order is kept within a
  // severity (stable). The single served "ok" item is treated as the honest empty state.
  const attention = useMemo<ReviewAttentionItem[]>(() => {
    const items = page?.attention ?? [];
    return [...items].sort((a, b) => (SEV_ORDER[sevKey(a.severity)] ?? 2) - (SEV_ORDER[sevKey(b.severity)] ?? 2));
  }, [page]);
  const isEmptySignal = attention.length === 1 && attention[0].area.toLowerCase() === "ok";

  const onSave = useCallback(async () => {
    setSaving(true);
    const r = await markReviewed(note.trim() || undefined, nextDate || undefined);
    setSaving(false);
    if (r.ok) {
      toast.show({ message: "Marked reviewed." });
      setDialogOpen(false);
      setNote("");
      setNextDate("");
      reload();
    } else {
      toast.show({ message: `Couldn't record the review: ${r.error}`, tone: "warning" });
    }
  }, [note, nextDate, toast, reload]);

  const attnColumns: Column<ReviewAttentionItem>[] = [
    {
      key: "severity",
      label: "Severity",
      // §12rv1-4 — served value verbatim (D-005) inside a chip carrying its semantic tone class.
      render: (r) => (
        <StatusChip label={r.severity} tone={SEV_TONE[sevKey(r.severity)] ?? "neutral"} />
      ),
    },
    { key: "title", label: "Item", render: (r) => r.title },
    {
      key: "area",
      label: "Area",
      render: (r) => {
        const route = AREA_ROUTE[r.area.toLowerCase()];
        return route ? <Link to={route}>{r.area}</Link> : <span className="rv__area">{r.area}</span>;
      },
    },
  ];

  return (
    <div className="lf-page rv">
      <PageHeader
        title="Review"
        subtitle="What needs a look — reporting only, not advice or a required action"
        actions={
          <Button variant="primary" icon={CircleCheck} onClick={() => { setNote(""); setNextDate(""); setDialogOpen(true); }}>
            Mark reviewed
          </Button>
        }
      />

      {/* Summary header — served values only (net worth summarises Net worth; no re-thresholding). */}
      <section className="rv__card lf-card" data-card="summary">
        <div className="lf-card__body">
          <CardBody data={page} lines={2} onRetry={reload}>
            {(p) => (
              <>
                <div className="rv__rail" data-card="rail">
                  <div className="rv__railtile">
                    <TrendStat label="Net worth" value={`${p.base_currency} ${formatMoney(p.net_worth)}`} />
                    <SummaryLink to="/net-worth" destination="Net worth" />
                  </div>
                  <TrendStat label="Today's change" value={formatSignedMoney(p.sections.changed.day_change)} tone={signOf(p.sections.changed.day_change)} />
                  <TrendStat label="Data confidence" value={String(p.sections.trust.confidence)} unit="/100" />
                  <TrendStat label="Attention" value={String(p.attention_count)} />
                  <TrendStat
                    label="Last reviewed"
                    value={p.last_review ? relativeDays(p.last_review.days_ago) : "Never"}
                  />
                </div>
                {p.last_review?.next_review_date ? (
                  <p className="rv__note">Next review set for {p.last_review.next_review_date}.</p>
                ) : null}
              </>
            )}
          </CardBody>
        </div>
      </section>

      {/* Attention list (D-038) — the served items, review-first; each area links to its canonical page. */}
      <section className="rv__card lf-card" data-card="attention">
        <h2 className="rv__h2"><GlossaryTerm term="term-review">Review</GlossaryTerm> — what needs a look</h2>
        <div className="lf-card__body">
          <CardBody data={page} lines={6} onRetry={reload}>
            {() =>
              isEmptySignal ? (
                <EmptyState message="Nothing needs a look right now." reason="No signals flagged — reporting only, not a required action." />
              ) : (
                <DataTable columns={attnColumns} rows={attention} caption="Items to review" stickyHeader />
              )
            }
          </CardBody>
        </div>
      </section>

      {/* Review history — recorded snapshots; the reader serves the last 24 (honest legend). */}
      <section className="rv__card lf-card" data-card="history">
        <h2 className="rv__h2">Review history</h2>
        <div className="lf-card__body">
          <CardBody data={history} lines={4} onRetry={reloadHistory}>
            {(h) =>
              h.history.length > 0 ? (
                <>
                  <DataTable
                    columns={[
                      { key: "reviewed_at", label: "Date", render: (r) => r.reviewed_at },
                      { key: "net_worth", label: "Net worth", align: "right", render: (r) => `${r.base_currency} ${formatMoney(r.net_worth)}` },
                      { key: "confidence", label: "Confidence", align: "right", render: (r) => `${r.confidence}/100` },
                      { key: "attention_count", label: "Attention", align: "right", render: (r) => String(r.attention_count) },
                      { key: "note", label: "Note", truncate: true, render: (r) => r.note ?? "—" },
                    ]}
                    rows={h.history}
                    caption="Recorded reviews"
                    stickyHeader
                  />
                  <p className="rv__note">Showing the last 24 recorded reviews.</p>
                </>
              ) : (
                <EmptyState message="No reviews recorded yet" reason="Use “Mark reviewed” to snapshot the current state." />
              )
            }
          </CardBody>
        </div>
      </section>

      {/* Mark-reviewed (ND-8) — Dialog + TextInput (note) + DateInput (next review), [S]-gated. */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Mark reviewed"
        footer={
          <>
            <button type="button" className="lf-btn" onClick={() => setDialogOpen(false)}>Cancel</button>
            <button type="button" className="lf-btn lf-btn--primary" disabled={saving} aria-busy={saving} onClick={onSave}>Save</button>
          </>
        }
      >
        <p className="rv__note">Snapshot the current state as a recorded review. Optional note + a next-review date.</p>
        <label className="rv__field">
          <span className="rv__label">Note</span>
          <TextInput value={note} onChange={setNote} placeholder="e.g. Rebalanced equity; checked runway" maxLength={280} aria-label="Review note" />
        </label>
        <label className="rv__field">
          <span className="rv__label">Next review date</span>
          <DateInput value={nextDate} onChange={setNextDate} aria-label="Next review date" />
        </label>
      </Dialog>
    </div>
  );
}

// Per-card loading wrapper: undefined → Skeleton, null → honest error (+ retry), value → content.
function CardBody<T>({
  data,
  lines = 4,
  onRetry,
  children,
}: {
  data: T | null | undefined;
  lines?: number;
  onRetry?: () => void;
  children: (d: T) => ReactNode;
}) {
  if (data === undefined) return <Skeleton lines={lines} />;
  if (data === null)
    return (
      <EmptyState
        message="Couldn't load this section"
        reason="We couldn't reach the source of these figures — they're held back rather than guessed."
        action={onRetry ? <button type="button" className="lf-btn" onClick={onRetry}>Retry</button> : undefined}
      />
    );
  return <>{children(data)}</>;
}
