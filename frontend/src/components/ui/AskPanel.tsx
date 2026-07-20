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

function FactRow({ fact }: { fact: GroundingFactDTO }) {
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

export function AskPanel({ label = "Ask", seedQuestion }: AskPanelProps = {}) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState(seedQuestion ?? "");
  const [phase, setPhase] = useState<Phase>("idle");
  const [facts, setFacts] = useState<GroundingFactDTO[]>([]);
  const [answer, setAnswer] = useState("");
  const [disclaimer, setDisclaimer] = useState("");
  const [fallbackSignal, setFallbackSignal] = useState<string | null>(null);
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
    setError(null);

    streamRef.current = streamAnswer(
      q,
      (event: ChatEvent) => {
        if (event.type === "facts") {
          // FACTS BEFORE ANSWER — D-067's trust UX, and contract clause 7. The user sees what the
          // answer is built from before they see the answer.
          setFacts(event.facts);
          setPhase("streaming");
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
          {/* ALWAYS VISIBLE (D-067), and SERVED — the posture is the backend's statement about
              what the device is doing, not a label this component infers. */}
          {status ? (
            <p
              className={`lf-ask__posture${status.no_egress ? " lf-ask__posture--closed" : ""}`}
              data-testid="ask-privacy-label"
            >
              {status.privacy_label}
            </p>
          ) : (
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

          {/* D-070's SERVED signal — rendered verbatim, never composed here, and never styled as
              an error. The answer fell back: that is the validator working, not a failure. */}
          {fallbackSignal && (
            <p className="lf-ask__signal" role="status" data-testid="ask-fallback-signal">
              {fallbackSignal}
            </p>
          )}

          {answer && (
            <div className="lf-ask__answer" aria-live="polite" data-testid="ask-answer">
              {answer}
            </div>
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
