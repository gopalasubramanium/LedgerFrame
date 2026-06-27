import { useRef, useState } from "react";
import { streamChat } from "../lib/api";
import type { GroundingFact } from "../lib/types";
import { timeAgo } from "../lib/format";

// Hide reasoning-model chain-of-thought (<think>…</think>) from the displayed
// answer, including a still-streaming, not-yet-closed think block.
function stripThinking(t: string): string {
  let s = t.replace(/<think>[\s\S]*?<\/think>/g, "");
  if (s.includes("</think>")) s = s.split("</think>").pop() ?? s;
  const open = s.indexOf("<think>");
  if (open !== -1) s = s.slice(0, open);
  return s.replace(/^\s+/, "");
}

const SUGGESTIONS = [
  "What moved in my portfolio today?",
  "Show my allocation by currency",
  "How did markets do?",
  "What is my total return?",
];

// Touch-first "Ask" panel. Streams a grounded answer and shows the source facts
// (with timestamps + stale flags) the answer is built from. Works even when the
// NPU is offline (backend falls back to a deterministic, fact-only answer).
export function AskPanel({ onClose }: { onClose: () => void }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [facts, setFacts] = useState<GroundingFact[]>([]);
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function ask(q: string) {
    if (!q.trim() || busy) return;
    setBusy(true);
    setAnswer("");
    setFacts([]);
    setProvider(null);
    abortRef.current = new AbortController();
    try {
      await streamChat(
        q,
        {
          onFacts: setFacts,
          onDelta: (d) => setAnswer((a) => a + d),
          onDone: (m) => setProvider(String(m.provider ?? "")),
        },
        abortRef.current.signal,
      );
    } catch {
      setAnswer("Could not reach the assistant. Showing data only.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="lf-card w-full max-w-2xl m-4 max-h-[85vh] flex flex-col"
        role="dialog"
        aria-label="Ask LedgerFrame"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Ask LedgerFrame</h2>
          <button className="lf-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="flex gap-2 mb-3">
          <input
            className="flex-1 touch rounded-card bg-base border border-line px-4 text-ink focus:ring-2 focus:ring-accent outline-none"
            placeholder="Ask about your portfolio or the markets…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(question)}
          />
          <button className="lf-btn-accent" disabled={busy} onClick={() => ask(question)}>
            {busy ? "…" : "Ask"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="lf-chip bg-elevated text-muted hover:text-ink" onClick={() => { setQuestion(s); ask(s); }}>
              {s}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {stripThinking(answer) && (
            <div className="bg-base rounded-card p-4 mb-4 whitespace-pre-wrap text-ink leading-relaxed">{stripThinking(answer)}</div>
          )}
          {facts.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-faint mb-2">Based on these facts</div>
              <ul className="space-y-1">
                {facts.map((f, i) => (
                  <li key={i} className="flex justify-between gap-3 text-sm border-b border-line py-1">
                    <span className="text-muted">{f.label}</span>
                    <span className="tnum text-ink text-right">
                      {f.value}
                      <span className="text-faint ml-2">
                        {f.source}
                        {f.timestamp ? ` · ${timeAgo(f.timestamp)}` : ""}
                        {f.is_stale ? " · ⚠ stale" : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {provider && (
            <p className="text-xs text-faint mt-3">
              {provider === "fallback" ? "Local model unavailable — showing data only." : `Answered by: ${provider}.`}{" "}
              Information only, not financial advice.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
