import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import "./News.css";
import { EmptyState, GlossaryTerm, NewsList, PageHeader, Segmented, Skeleton, useToast } from "../components/ui";
import { relativeTime } from "../format/time";
import { RotateCw } from "../icons";
import { getBriefing, getGroupedNews, getNoEgress, refreshBriefing } from "../api/news";
import type { BriefingResp, GroupedNewsResp } from "../api/news";

// News (Markets-group home) — IA §5, D-037/D-068/D-051. Canonical home for the market BRIEFING
// (deterministic; AI narration DEFERRED, ND-1 — no AI copy) and GROUPED HEADLINES by area (ND-3). An
// overview + worklist hybrid (ND-4): a briefing card header over a grouped-headlines body rendered as
// SERVED-bucket segmented tabs (§12nw1-2, Markets Global-tab precedent — labels verbatim, no re-mapping).
// Every value is a SERVED display string; under no-egress the readers make zero outbound calls (ND-2)
// and the per-card refresh actions render honestly DISABLED (§12nw1-3, ND-8 reversal).

export function News() {
  const toast = useToast();
  // Per-card progressive loading: undefined = loading, null = reader failed, value = loaded.
  const [briefing, setBriefing] = useState<BriefingResp | null>();
  const [grouped, setGrouped] = useState<GroupedNewsResp | null>();
  const [noEgress, setNoEgress] = useState(false);
  const [activeArea, setActiveArea] = useState<string | null>(null); // active headline bucket (tab)
  const [refreshingBriefing, setRefreshingBriefing] = useState(false);
  const [refreshingHeadlines, setRefreshingHeadlines] = useState(false);

  const reload = useCallback(() => {
    setBriefing(undefined);
    setGrouped(undefined);
    getBriefing().then((r) => setBriefing(r.ok ? r.data : null));
    getGroupedNews().then((r) => setGrouped(r.ok ? r.data : null));
    getNoEgress().then(setNoEgress);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  // Default the active bucket to the first SERVED group once grouped news loads (no client re-mapping).
  useEffect(() => {
    if (grouped && activeArea === null && grouped.groups.length > 0) setActiveArea(grouped.groups[0].name);
  }, [grouped, activeArea]);

  // Refresh is EGRESS (§12nw1-3): under no-egress the ND-2 guard governs — render an honest state, never
  // a no-op spinner. On success re-render from the served response; on failure, an honest toast.
  const onRefreshBriefing = useCallback(async () => {
    if (noEgress) {
      toast.show({ message: "Refresh unavailable — no-egress is on.", tone: "warning" });
      return;
    }
    setRefreshingBriefing(true);
    const r = await refreshBriefing();
    if (r.ok) {
      const b = await getBriefing();
      setBriefing(b.ok ? b.data : null);
      toast.show({ message: "Briefing updated." });
    } else {
      toast.show({ message: `Couldn't refresh the briefing: ${r.error}`, tone: "warning" });
    }
    setRefreshingBriefing(false);
  }, [noEgress, toast]);

  const onRefreshHeadlines = useCallback(async () => {
    if (noEgress) {
      toast.show({ message: "Refresh unavailable — no-egress is on.", tone: "warning" });
      return;
    }
    setRefreshingHeadlines(true);
    const g = await getGroupedNews();
    if (g.ok) {
      setGrouped(g.data);
      toast.show({ message: `Headlines updated${g.data.total ? ` · ${g.data.total} retrieved` : ""}.` });
    } else {
      toast.show({ message: `Couldn't refresh headlines: ${g.error}`, tone: "warning" });
    }
    setRefreshingHeadlines(false);
  }, [noEgress, toast]);

  return (
    <div className="nw">
      <PageHeader title="News" subtitle="The market briefing and grouped headlines" />

      {/* Briefing (D-037/D-068) — deterministic served text; NO AI copy (ND-1). Per-card refresh
          (§12nw1-3, ND-8 reversal): [S]-gated regenerate, disabled under no-egress. */}
      <section className="nw__card lf-card" data-card="briefing">
        <div className="nw__cardhead">
          <h2 className="nw__h2"><GlossaryTerm term="term-briefing">Briefing</GlossaryTerm></h2>
          <RefreshButton label="Refresh briefing" busy={refreshingBriefing} noEgress={noEgress} onClick={onRefreshBriefing} />
        </div>
        <div className="lf-card__body">
          <CardBody data={briefing} lines={3} onRetry={reload}>
            {(b) => (
              <>
                <p className="nw__briefing">{b.text}</p>
                {b.generated_at ? <p className="nw__meta">Updated {relativeTime(b.generated_at)}</p> : null}
              </>
            )}
          </CardBody>
        </div>
      </section>

      {/* Grouped headlines (D-037, ND-3/ND-12) — SERVED buckets as segmented tabs (§12nw1-2), one group
          visible at a time; a shared NewsList for the active bucket. Per-card refresh (a re-GET). */}
      <section className="nw__card lf-card" data-card="headlines">
        <div className="nw__cardhead">
          <h2 className="nw__h2"><GlossaryTerm term="term-headlines">Headlines</GlossaryTerm></h2>
          <RefreshButton label="Refresh headlines" busy={refreshingHeadlines} noEgress={noEgress} onClick={onRefreshHeadlines} />
        </div>
        <div className="lf-card__body">
          <CardBody data={grouped} lines={6} onRetry={reload}>
            {(g) => {
              if (g.no_egress) {
                return (
                  <EmptyState
                    message="News is off under no-egress"
                    reason="News needs the internet, and no-egress is on — nothing is fetched, sent, or received. Turn no-egress off in Settings to load headlines."
                  />
                );
              }
              if (g.groups.length === 0) {
                return (
                  <EmptyState
                    message="No headlines right now"
                    reason="No provider or feed headlines were retrieved. You can configure news feeds in Settings."
                  />
                );
              }
              const active = g.groups.find((grp) => grp.name === activeArea) ?? g.groups[0];
              return (
                <>
                  <div className="nw__tabs">
                    <Segmented
                      aria-label="News area"
                      value={active.name}
                      onChange={setActiveArea}
                      options={g.groups.map((grp) => ({
                        value: grp.name,
                        label: (
                          <>
                            {grp.name}
                            <span className="lf-segbtn__count">{grp.items.length}</span>
                          </>
                        ),
                      }))}
                    />
                  </div>
                  <NewsList items={active.items} showSymbols emptyMessage="No headlines" emptyReason="No headlines in this bucket right now." />
                </>
              );
            }}
          </CardBody>
        </div>
      </section>
    </div>
  );
}

// Per-card refresh (§12nw1-3) — the ratified icon-button; disabled + honest title under no-egress
// (the ND-2 guard governs — never a no-op spinner); aria-busy while in-progress.
function RefreshButton({ label, busy, noEgress, onClick }: { label: string; busy: boolean; noEgress: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="lf-iconbtn lf-iconbtn--framed"
      onClick={onClick}
      disabled={busy || noEgress}
      aria-busy={busy}
      aria-label={label}
      title={noEgress ? "No-egress is on — refresh makes no network calls" : busy ? "Refreshing…" : label}
    >
      <RotateCw aria-hidden="true" />
    </button>
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
