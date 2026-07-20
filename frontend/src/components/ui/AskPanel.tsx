import "./ask.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircleQuestion } from "lucide-react";

import {
  getGroundingStatus,
  streamAnswer,
  type ChatEvent,
  type GroundingFactDTO,
  type GroundingStatus,
} from "../../api/ai";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";
import { StalenessChip } from "./StalenessChip";
import { TextInput } from "./TextInput";

/**
 * AskPanel — the D-067 Ask surface, COMPOSED from ratified primitives.
 *
 * DESIGN-SYSTEM §5.5 describes this panel's BEHAVIOUR — *"SSE streaming, fact-pack before answer,
 * validated-before-display, ephemeral, privacy-mode label always visible"* — while the Chrome
 * inventory beneath it lists no such component and `components/ui/` had none. Per CLAUDE.md a new
 * primitive needs a DESIGN-SYSTEM amendment, so the owner's §9(i) ruling was composition-first:
 * build from what is already ratified, and bring an amendment only for what composition cannot
 * express. This file is that composition — `Dialog`, `TextInput`, `Button`, `Skeleton`,
 * `EmptyState`, `StalenessChip` — and it needed no new primitive.
 *
 * WHAT THIS COMPONENT DOES NOT DO, because the milestone's whole point is that it must not:
 *   - it computes NO money and derives no figure (all money math is backend Decimal);
 *   - it composes NO disclaimer and NO fallback signal — both are SERVED and rendered verbatim.
 *     A client-built legal-adjacent string would be a second source of truth for a sentence
 *     Commitment 2 promises is FIXED, which is the §0-C defect this milestone exists to undo;
 *   - it PERSISTS NOTHING. State lives in this component and dies with it (D-016 / Commitment 6:
 *     "AI questions and answers are never persisted"). There is no localStorage here, and there
 *     must never be — a "recent questions" convenience would break a Commitment.
 */

type Phase = "idle" | "loading" | "streaming" | "done" | "error";

export interface AskPanelProps {
  /** Trigger label. Defaults to the global "Ask". */
  label?: string;
  /**
   * A question the panel opens with, already typed in. This is the INSTRUMENT EXPLAINER (D-068):
   * *"Instrument explainer rides P-6"* — so it is not a second surface and not a second model
   * path, it is this panel opened with a scoped question. The user can read it, edit it, or ask
   * something else entirely; nothing is sent until they press Ask.
   *
   * That last point is the design, not a detail. An explainer that fired on mount would spend the
   * user's device on a question they did not ask, and under a metered remote provider that is
   * their money. It also keeps ONE code path for every answer, which is what P-6 requires.
   */
  seedQuestion?: string;
}

/**
 * A help fact carries the entry's whole meaning — body AND interpret — because that is what the
 * MODEL needs (the owner's Phase 0.9 widening). The READER needs to see what the answer rests on,
 * which is a different job: at the 0a specimen three help entries rendered in full and pushed the
 * answer, the disclaimer and D-070's signal off the bottom of the screen (§10-B).
 *
 * So the pack is PROJECTED for display — title and first line, expandable — while the model keeps
 * the full text. One served list, two presentations; nothing is hidden, and the reader chooses.
 */
function isHelpFact(fact: GroundingFactDTO): boolean {
  return fact.fact_type === "help" || fact.label.startsWith("Help · ");
}

function firstLine(value: string): string {
  const line = value.split("\n").find((l) => l.trim()) ?? value;
  return line.trim();
}

function FactRow({ fact }: { fact: GroundingFactDTO }) {
  const [expanded, setExpanded] = useState(false);
  const help = isHelpFact(fact);

  if (!help) {
    return (
      <li className="lf-ask__fact">
        <span className="lf-ask__fact-label">{fact.label}</span>
        <span className="lf-ask__fact-value lf-num">{fact.value}</span>
        {fact.is_stale && fact.timestamp ? (
          <StalenessChip isStale asOf={fact.timestamp} />
        ) : null}
      </li>
    );
  }

  const summary = firstLine(fact.value);
  const hasMore = summary.length < fact.value.trim().length;

  return (
    <li className="lf-ask__fact lf-ask__fact--prose">
      <span className="lf-ask__fact-label">{fact.label}</span>
      <span className="lf-ask__fact-prose">
        {expanded ? fact.value : summary}
      </span>
      {hasMore && (
        <Button variant="default" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show less" : "Show more"}
        </Button>
      )}
    </li>
  );
}

export function AskPanel({ label = "Ask", seedQuestion }: AskPanelProps = {}) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState(seedQuestion ?? "");
  const [phase, setPhase] = useState<Phase>("idle");
  const [facts, setFacts] = useState<GroundingFactDTO[]>([]);
  const [answer, setAnswer] = useState("");
  const [disclaimer, setDisclaimer] = useState("");
  const [fallbackSignal, setFallbackSignal] = useState<string | null>(null);
  // §14-4 — the SERVED provenance legend and whether the body is model-generated. Both arrive on
  // one event before the first delta, so the treatment is correct from the first character.
  const [provenance, setProvenance] = useState<string | null>(null);
  const [narrated, setNarrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<GroundingStatus | null>(null);

  const streamRef = useRef<{ cancel: () => void } | null>(null);

  // D-067: the privacy-mode label is ALWAYS VISIBLE. Fetched when the panel opens rather than
  // cached at mount, because the no-egress toggle can move in Settings while the app is running —
  // a posture label that describes a state the device left is worse than none.
  useEffect(() => {
    if (!open) return;
    let live = true;
    void getGroundingStatus().then((r) => {
      if (live && r.ok) setStatus(r.data);
    });
    return () => {
      live = false;
    };
  }, [open]);

  // A closing panel must not leave a stream running. Ephemeral means ephemeral.
  const reset = useCallback(() => {
    streamRef.current?.cancel();
    streamRef.current = null;
    // Back to the seed, not to blank: a closed explainer reopens ready to ask the same scoped
    // question. The ANSWER is still discarded — ephemeral is about the exchange, not the prompt.
    setQuestion(seedQuestion ?? "");
    setPhase("idle");
    setFacts([]);
    setAnswer("");
    setDisclaimer("");
    setFallbackSignal(null);
    setProvenance(null);
    setNarrated(false);
    setError(null);
  }, [seedQuestion]);

  const close = useCallback(() => {
    reset();
    setOpen(false);
  }, [reset]);

  useEffect(() => () => streamRef.current?.cancel(), []);

  const ask = useCallback(() => {
    const q = question.trim();
    if (!q || phase === "loading" || phase === "streaming") return;

    streamRef.current?.cancel();
    setPhase("loading");
    setFacts([]);
    setAnswer("");
    setDisclaimer("");
    setFallbackSignal(null);
    setProvenance(null);
    setNarrated(false);
    setError(null);

    streamRef.current = streamAnswer(
      q,
      (event: ChatEvent) => {
        if (event.type === "facts") {
          // FACTS BEFORE ANSWER — D-067's trust UX, and contract clause 7. The user sees what the
          // answer is built from before they see the answer.
          setFacts(event.facts);
          setPhase("streaming");
        } else if (event.type === "provenance") {
          // §14-4. Arrives before the first delta, so `narrated` is already correct when the body
          // starts rendering — the treatment never has to be applied retroactively.
          setProvenance(event.provenance);
          setNarrated(event.narrated);
        } else if (event.type === "delta") {
          setAnswer((prev) => prev + event.delta);
        } else {
          setDisclaimer(event.disclaimer);
          setFallbackSignal(event.fallback_signal ?? null);
          if (event.error) setError(event.error);
          setPhase("done");
        }
      },
      (reason) => {
        setError(reason);
        setPhase("error");
      },
    );
  }, [question, phase]);

  const busy = phase === "loading" || phase === "streaming";

  /**
   * §12-2 (owner ruling, 2026-07-20) — the DISPLAY half of the disclaimer synthesis.
   *
   * Finding 4 recorded the disclaimer rendering twice: once ending the answer body, once as the
   * served footer element. Its options (a) and (b) each dropped one of the two copies and, with
   * it, one of two readers — (a) left the raw answer text without its own disclaimer for any
   * export/stream/copy consumer; (b) left model-narrated answers depending on the model to emit
   * it. The owner ruled BOTH halves instead of either option:
   *
   *   the answer TEXT always ends with the served constant (enforced in `grounding.py`, guarded
   *   by `test_ask_answer_projection.py`), and the PANEL projects the body without that trailing
   *   line, rendering the footer element ONCE.
   *
   * DE-DUPLICATION AT DISPLAY IS A PROJECTION, NOT A REDACTION — the same distinction Finding 1
   * settled for the fact pack. Nothing is withheld: the line is on screen, once, in the place the
   * client puts it, and it is still in the artifact the reader can copy out.
   *
   * It strips the SERVED constant, never a locally-known string. The panel composes no
   * legal-adjacent text and recognises none it was not given — matching on a hardcoded sentence
   * here would make this file a second source of truth for it, which is the §0-C defect.
   */
  const answerBody = (() => {
    if (!disclaimer) return answer;
    const trimmed = answer.trimEnd();
    return trimmed.endsWith(disclaimer)
      ? trimmed.slice(0, -disclaimer.length).trimEnd()
      : answer;
  })();

  return (
    <>
      <Button
        icon={MessageCircleQuestion}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        {label}
      </Button>

      <Dialog open={open} onClose={close} title={label} size="lg">
        <div className="lf-ask">
          {/* SERVED — the posture is the backend's statement about what the device is doing, not
              a label this component infers.

              §17-1 (owner ruling, 2026-07-20) — IT RENDERS PRE-ANSWER ONLY, and this is a HANDOVER
              rather than a removal. D-067's "privacy-mode label always visible" is a promise to the
              READER that a locality statement is on screen at every moment; it is not a promise
              about this particular paragraph. Two of them at once — the posture line above, the
              provenance legend below — is what the owner found at the 3b walk, and two true
              statements of the same fact read as two claims the reader must reconcile.

              So: BEFORE an answer the posture line carries it, because a user must know where a
              question goes before they send it, and nothing else on screen can tell them.
              ONCE THE LEGEND RENDERS it carries it instead, and carries it BETTER — the posture
              line describes what is CONFIGURED, while the legend reports what ACTUALLY happened
              (§15-4, the lie that guard caught). Where they differ, the legend is the true one.

              Never both, and never neither. `provenance` is the condition rather than `phase`
              because the legend's presence is exactly what makes this line redundant — tying it to
              anything else would let a state exist with two statements or none. Both arms are
              guarded, and the "never neither" arm is counted (`AskPanel.test.tsx` §17-1). */}
          {status && !provenance ? (
            <p
              className={`lf-ask__posture${status.no_egress ? " lf-ask__posture--closed" : ""}`}
              data-testid="ask-privacy-label"
            >
              {status.privacy_label}
            </p>
          ) : provenance ? null : (
            // The posture has not arrived YET. A skeleton, not nothing — an empty gap here would
            // be the pre-ask state briefly making no locality statement at all.
            <Skeleton lines={1} aria-label="Loading privacy mode" />
          )}

          <div className="lf-ask__composer">
            <TextInput
              value={question}
              onChange={setQuestion}
              onEnter={ask}
              maxLength={500}
              placeholder="Ask about your holdings, net worth, or how something works"
              aria-label="Your question"
              disabled={busy}
            />
            <Button onClick={ask} loading={phase === "loading"} disabled={!question.trim()}>
              Ask
            </Button>
          </div>

          {phase === "idle" && facts.length === 0 && (
            <EmptyState
              message="Ask a question about your data"
              reason="Answers are built from your own figures and the in-app help, and every answer shows the facts it used."
            />
          )}

          {phase === "loading" && <Skeleton lines={3} aria-label="Gathering the facts" />}

          {/* D-070's SERVED signal — rendered verbatim, never composed here, and never styled as
              an error. The answer fell back: that is the validator working, not a failure.

              IT LEADS (owner ruling, §10-B). It explains why facts are being shown instead of an
              answer, so it has to arrive before them — a signal underneath the thing it explains
              is a footnote to a conclusion the reader has already drawn. This does NOT disturb
              contract clause 7: the facts still precede the ANSWER, which is what the clause
              requires. The signal is not the answer. */}
          {fallbackSignal && (
            <p className="lf-ask__signal" role="status" data-testid="ask-fallback-signal">
              {fallbackSignal}
            </p>
          )}

          {facts.length > 0 && (
            <section className="lf-ask__facts" aria-label="Facts used">
              <h3 className="lf-ask__facts-title">What this is built from</h3>
              <ul className="lf-ask__fact-list">
                {facts.map((f) => (
                  <FactRow key={`${f.label}-${f.value}`} fact={f} />
                ))}
              </ul>
            </section>
          )}

          {/* The PROJECTED body (§12-2) — the served text minus its trailing disclaimer, which the
              footer below renders once. When the projection leaves nothing, no block renders at
              all: in the fallback state the fact pack IS the answer (§12-1), and an empty bordered
              box beneath it would read as "the AI said nothing", which is not what happened. */}
          {answerBody && (
            <div
              className={`lf-ask__answer${narrated ? " lf-ask__answer--model" : ""}`}
              aria-live="polite"
              data-testid="ask-answer"
              data-narrated={narrated ? "true" : "false"}
            >
              {answerBody}
            </div>
          )}

          {/* §14-4 — the SERVED provenance legend, rendered verbatim and never composed here.
              It sits BENEATH the answer it describes, unlike D-070's signal which LEADS: the
              signal explains why there is no answer, so it must arrive before the absence; the
              legend attributes an answer that is already on screen, and an attribution above the
              thing it attributes is a label on an empty space.

              IT IS NOT CONDITIONAL ON `narrated`. Every answer carries one — "Built-in
              intelligence only" is a claim about authorship as much as the other two, and showing
              a legend only when a model was involved would make its ABSENCE the signal, which is
              the silent-fallback failure D-070 exists to prevent. */}
          {provenance && (
            <p className="lf-ask__provenance" data-testid="ask-provenance">
              {provenance}
            </p>
          )}

          {error && phase === "error" && (
            <EmptyState message="The AI did not answer" reason={error} />
          )}

          {/* SERVED, verbatim, on every answer — Commitment 2. */}
          {disclaimer && <p className="lf-ask__disclaimer">{disclaimer}</p>}
        </div>
      </Dialog>
    </>
  );
}
