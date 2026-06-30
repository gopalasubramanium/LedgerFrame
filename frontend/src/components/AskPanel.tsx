import { useEffect, useRef, useState } from "react";
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
  "How is Tesla doing?",
  "How did the markets do?",
  "How am I doing vs the benchmark?",
  "What's happening with NVDA?",
  "How concentrated is my portfolio?",
];

// Touch-first "Ask" panel. Streams a grounded answer and shows the source facts
// (with timestamps + stale flags) the answer is built from. Works even when the
// model is offline (backend falls back to a deterministic, fact-only answer).
export function AskPanel({ onClose }: { onClose: () => void }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [facts, setFacts] = useState<GroundingFact[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [provider, setProvider] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Tick an elapsed-seconds counter while waiting (so slow local models feel alive).
  useEffect(() => {
    if (!busy) return;
    const start = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [busy]);

  const visibleAnswer = stripThinking(answer);
  const thinking = busy && !visibleAnswer; // waiting for the first real token

  async function ask(q: string) {
    if (!q.trim() || busy) return;
    setBusy(true);
    setAnswer("");
    setFacts([]);
    setProvider(null);
    setStage("Gathering your portfolio data");
    abortRef.current = new AbortController();
    try {
      await streamChat(
        q,
        {
          onFacts: (f) => { setFacts(f); setStage("Analyzing with the AI model"); },
          onDelta: (d) => { setStage(""); setAnswer((a) => a + d); },
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

  function stop() {
    abortRef.current?.abort();
    setBusy(false);
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
            ref={inputRef}
            className="flex-1 touch rounded-card bg-base border border-line px-4 text-ink focus:ring-2 focus:ring-accent outline-none"
            placeholder="Ask about any stock, the markets, or your portfolio…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(question)}
          />
          {busy ? (
            <button className="lf-btn" onClick={stop} title="Stop">■ Stop</button>
          ) : (
            <button className="lf-btn-accent" onClick={() => ask(question)}>Ask</button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {SUGGESTIONS.map((s) => (
            <button key={s} disabled={busy} className="lf-chip bg-elevated text-muted hover:text-ink disabled:opacity-40"
              onClick={() => { setQuestion(s); ask(s); }}>
              {s}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {/* Thinking indicator — shows immediately so the user knows it's working. */}
          {thinking && (
            <div className="bg-base rounded-card p-4 mb-4">
              <div className="flex items-center gap-3">
                <span className="lf-typing" aria-hidden="true"><i></i><i></i><i></i></span>
                <span className="text-muted text-sm">
                  {stage || "Querying AI"}{elapsed >= 1 ? ` · ${elapsed}s` : ""}
                </span>
              </div>
              {elapsed >= 6 && (
                <p className="text-xs text-faint mt-2">Local/reasoning models can take a little longer — hang tight.</p>
              )}
            </div>
          )}

          {visibleAnswer && (
            <div className="bg-base rounded-card p-4 mb-4 whitespace-pre-wrap text-ink leading-relaxed">
              {visibleAnswer}
              {busy && <span className="lf-caret">▋</span>}
            </div>
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

          {provider && !busy && (
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
