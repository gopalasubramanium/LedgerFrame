import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import "./News.css";
import { EmptyState, GlossaryTerm, NewsList, PageHeader, Skeleton } from "../components/ui";
import { relativeTime } from "../format/time";
import { getBriefing, getGroupedNews } from "../api/news";
import type { BriefingResp, GroupedNewsResp } from "../api/news";

// News (Markets-group home) — IA §5, D-037/D-068/D-051. Canonical home for the market BRIEFING
// (deterministic; AI narration DEFERRED, ND-1 — no AI copy) and GROUPED HEADLINES by area (ND-3). An
// overview + worklist hybrid (ND-4): a briefing card header over a grouped-headlines body. Every value
// is a SERVED display string; under no-egress the readers make zero outbound calls (ND-2) → honest
// empty-with-reason, never a fabricated headline. No page-level refresh (worker-refreshed, ND-8).

export function News() {
  // Per-card progressive loading: undefined = loading, null = reader failed, value = loaded.
  const [briefing, setBriefing] = useState<BriefingResp | null>();
  const [grouped, setGrouped] = useState<GroupedNewsResp | null>();

  const reload = useCallback(() => {
    setBriefing(undefined);
    setGrouped(undefined);
    getBriefing().then((r) => setBriefing(r.ok ? r.data : null));
    getGroupedNews().then((r) => setGrouped(r.ok ? r.data : null));
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="nw">
      <PageHeader title="News" subtitle="The market briefing and grouped headlines" />

      {/* Briefing (D-037/D-068) — deterministic served text; NO AI copy (ND-1), NO refresh (worker-
          refreshed, ND-8). The reader reads stored text (egress-free); `generated_at` shows its age. */}
      <section className="nw__card lf-card" data-card="briefing">
        <h2 className="nw__h2"><GlossaryTerm term="term-briefing">Briefing</GlossaryTerm></h2>
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

      {/* Grouped headlines (D-037, ND-3/ND-12) — the SERVED buckets rendered verbatim (no client
          re-mapping); a shared NewsList per group. Under no-egress → honest reason, never fabricated. */}
      <section className="nw__card lf-card" data-card="headlines">
        <h2 className="nw__h2"><GlossaryTerm term="term-headlines">Headlines</GlossaryTerm></h2>
        <div className="lf-card__body">
          <CardBody data={grouped} lines={6} onRetry={reload}>
            {(g) =>
              g.no_egress ? (
                <EmptyState
                  message="News is off under no-egress"
                  reason="News needs the internet, and no-egress is on — nothing is fetched, sent, or received. Turn no-egress off in Settings to load headlines."
                />
              ) : g.groups.length > 0 ? (
                <div className="nw__groups">
                  {g.groups.map((grp) => (
                    <div className="nw__group lf-card__body" key={grp.name}>
                      <h3 className="nw__h3">{grp.name}</h3>
                      <NewsList items={grp.items} showSymbols emptyReason="No headlines in this group." />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  message="No headlines right now"
                  reason="No provider or feed headlines were retrieved. You can configure news feeds in Settings."
                />
              )
            }
          </CardBody>
        </div>
      </section>
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
        reason="The reader is unreachable — values are withheld, never guessed."
        action={onRetry ? <button type="button" className="lf-btn" onClick={onRetry}>Retry</button> : undefined}
      />
    );
  return <>{children(data)}</>;
}
