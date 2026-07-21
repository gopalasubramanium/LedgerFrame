import { apiGet } from "./client";

// AI readers — AI-surfaces §3a (D-067 / D-068). Everything here is SERVED: the fact pack, the
// privacy-mode label, the disclaimer, and D-070's fallback signal all arrive from the backend and
// are rendered verbatim. The frontend computes nothing, stores nothing, and never composes a
// legal-adjacent string of its own — a client-built disclaimer would be a second source of truth
// for a sentence Commitment 2 promises is FIXED (the §0-C mistake this milestone exists to undo).
//
// Every path rides P-6: the single grounded+validated pipeline. No feature may add a direct model
// call, so there is one streaming reader below and no second lane for the instrument explainer.

export interface GroundingFactDTO {
  label: string;
  value: string;
  source?: string | null;
  timestamp?: string | null;
  is_stale?: boolean;
  fact_type?: string | null;
  explanation?: string | null;
  /** R-54 §9-D — the SERVED semantic link ID (`<kind>:<key>`), or null. The frontend resolver
   *  (`nav/askLinks.ts`) turns it into a destination; the Ask panel renders the pointer affordance.
   *  Declared here DELIBERATELY (the §3b served-shape guard flags a new served field so the frontend
   *  contract is updated on purpose, not by drift): served since Phase 0-5, consumed from delta 4b. */
  link_id?: string | null;
}

export interface FactPack {
  intent: string;
  facts: GroundingFactDTO[];
  count: number;
  disclaimer: string;
}

/** `mode` is what the device is DOING, not what it is configured to prefer. */
export interface GroundingStatus {
  grounded: boolean;
  narration: string;
  model: string | null;
  ai_enabled: boolean;
  mode: "deterministic" | "local" | "remote";
  remote: boolean;
  /** True when the no-egress toggle is on. SERVED, not inferred from `health` — an unavailable
   *  provider and a switched-off one look identical from here and are opposites: one is broken,
   *  one is the product doing exactly what it promised (R-22 AMENDMENT, owner 2026-07-20). */
  no_egress: boolean;
  /** SERVED privacy label — D-067 requires it visible at all times. Rendered verbatim. */
  privacy_label: string;
  /** One of the three kinds of intelligence (§14-2), resolved server-side alongside the posture. */
  kind: string;
  kind_label: string;
  last_error: string | null;
}

export function getFactPack(question: string) {
  return apiGet<FactPack>(`/ai/facts?q=${encodeURIComponent(question)}`);
}

export function getGroundingStatus() {
  return apiGet<GroundingStatus>("/ai/grounding-status");
}

// --- The stream ------------------------------------------------------------------------------
//
// `/ai/chat` is SSE over POST, so it cannot use the shared `request()` helper (which parses JSON
// and returns once). It goes through `fetch` directly — the ONE deliberate exception, kept here in
// the api layer rather than in a component, so 08-TECH-DEBT's v1 lesson does not repeat: in v1
// `streamChat` lived beside the pages that used it and drifted from the central client.
//
// The 451 contract is re-implemented rather than inherited, because inheriting it is exactly what
// is not possible here. A lapsed consent mid-stream must raise the same global event the shared
// client raises, or the Ask panel would be the one surface in the product where the acceptance
// gate silently does not re-fire.

export type ChatEvent =
  | { type: "facts"; facts: GroundingFactDTO[] }
  /**
   * §14-4's SERVED provenance legend — WHO WROTE THE SENTENCE, as distinct from what it was built
   * from. It arrives BEFORE the deltas it describes, because it decides how they are rendered:
   * delivering it on `done` would leave a narrated answer streaming in plain and restyling itself
   * at the last token.
   *
   * `narrated` is what ACTUALLY happened, never what is configured — a configured model whose
   * answer was discarded by the validator produced a built-in answer and says so.
   */
  | { type: "provenance"; kind: string; narrated: boolean; provenance: string }
  | { type: "delta"; delta: string }
  | {
      type: "done";
      grounded: boolean;
      provider: string;
      intent?: string;
      model?: string | null;
      validation?: string;
      /** D-070's SERVED fallback signal. Present ONLY when grounding checks rejected the answer. */
      fallback_signal?: string;
      error?: string | null;
      disclaimer: string;
    };

export interface StreamHandle {
  /** Abort the in-flight answer. The panel closing must not leave a stream running. */
  cancel: () => void;
}

/**
 * Stream one grounded answer. `onEvent` receives SERVED events verbatim.
 *
 * Errors are delivered as an honest terminal state, never thrown at the caller: a network failure
 * mid-answer is a reason to show, not an exception to swallow (Commitment 3 — insufficient inputs
 * produce a reason, never a made-up number).
 */
export function streamAnswer(
  question: string,
  onEvent: (event: ChatEvent) => void,
  onError: (reason: string) => void,
): StreamHandle {
  const controller = new AbortController();

  void (async () => {
    try {
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
        signal: controller.signal,
      });

      if (res.status === 451) {
        window.dispatchEvent(new Event("lf:consent-required"));
        onError("The terms have not been accepted on this install.");
        return;
      }
      if (!res.ok || !res.body) {
        onError(`The AI request was refused (HTTP ${res.status}).`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line; a frame may arrive split across chunks, so
        // only whole frames are parsed and the remainder stays buffered.
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          for (const line of frame.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            try {
              onEvent(JSON.parse(payload) as ChatEvent);
            } catch {
              // A malformed frame is dropped, not guessed at. Reconstructing a partial JSON
              // payload would be the frontend inventing content the server did not send.
            }
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return; // cancelled by the user — not a failure
      onError(err instanceof Error ? err.message : "The connection to the AI was lost.");
    }
  })();

  return { cancel: () => controller.abort() };
}
