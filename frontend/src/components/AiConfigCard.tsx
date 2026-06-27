import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card } from "./ui";

// OpenAI-compatible presets (any service exposing /v1/chat/completions works:
// OpenAI, OpenRouter, Anthropic's compat endpoint, a remote Ollama, etc.).
const PRESETS: { label: string; url: string; model: string }[] = [
  { label: "OpenAI", url: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { label: "OpenRouter", url: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini" },
  { label: "Anthropic", url: "https://api.anthropic.com/v1", model: "claude-3-5-haiku-latest" },
  { label: "Ollama (remote)", url: "http://192.168.0.x:11434/v1", model: "llama3.2" },
];

export function AiConfigCard({ className = "", onSaved }: { className?: string; onSaved?: (m: string) => void }) {
  const cfg = useApi(api.aiConfig, 0);
  const [provider, setProvider] = useState("hailo");
  const [enabled, setEnabled] = useState(true);
  const [hailoUrl, setHailoUrl] = useState("http://127.0.0.1:8000");
  const [model, setModel] = useState("");
  const [openaiUrl, setOpenaiUrl] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [result, setResult] = useState("");

  useEffect(() => {
    if (cfg.data) {
      setProvider(cfg.data.provider);
      setEnabled(cfg.data.enabled);
      setHailoUrl(cfg.data.hailo_base_url || "http://127.0.0.1:8000");
      setModel(cfg.data.model || "");
      setOpenaiUrl(cfg.data.openai_base_url || "");
    }
  }, [cfg.data]);

  async function save() {
    setResult("Saving…");
    try {
      const r = await api.setAiConfig({
        enabled, provider,
        hailo_base_url: hailoUrl, model,
        openai_base_url: openaiUrl,
        openai_api_key: openaiKey || undefined,
      });
      const msg = r.available ? `Connected — ${r.detail}` : `Saved, but not reachable: ${r.detail}`;
      setResult(msg); setOpenaiKey(""); cfg.refetch(); onSaved?.(msg);
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Save failed (locked?)");
    }
  }

  return (
    <Card title="AI assistant" className={className}>
      <label className="flex items-center justify-between py-1 mb-2">
        <span className="text-sm">Enable AI explanations</span>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-5 h-5 accent-accent" />
      </label>

      <label className="block text-sm text-muted mb-1">Provider</label>
      <select className="lf-input mb-3" value={provider} onChange={(e) => setProvider(e.target.value)}>
        <option value="hailo">Hailo / Ollama (local, on-device)</option>
        <option value="openai_compatible">OpenAI-compatible (OpenAI / OpenRouter / Anthropic / remote Ollama)</option>
        <option value="disabled">Disabled (deterministic answers only)</option>
      </select>

      {provider === "hailo" && (
        <>
          <label className="block text-sm text-muted mb-1">Service URL (hailo-ollama / Ollama IP)</label>
          <input className="lf-input mb-3" value={hailoUrl} onChange={(e) => setHailoUrl(e.target.value)} placeholder="http://127.0.0.1:8000" />
          <label className="block text-sm text-muted mb-1">Model (blank = auto-select smallest)</label>
          <input className="lf-input mb-3" value={model} onChange={(e) => setModel(e.target.value)} placeholder="auto" />
        </>
      )}

      {provider === "openai_compatible" && (
        <>
          <div className="flex flex-wrap gap-2 mb-2">
            {PRESETS.map((p) => (
              <button key={p.label} className="lf-chip bg-elevated text-muted hover:text-ink"
                onClick={() => { setOpenaiUrl(p.url); setModel(p.model); }}>{p.label}</button>
            ))}
          </div>
          <label className="block text-sm text-muted mb-1">Base URL (must end in /v1)</label>
          <input className="lf-input mb-3" value={openaiUrl} onChange={(e) => setOpenaiUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
          <label className="block text-sm text-muted mb-1">Model</label>
          <input className="lf-input mb-3" value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o-mini" />
          <label className="block text-sm text-muted mb-1">API key {cfg.data?.has_openai_key && <span className="text-up">(saved)</span>}</label>
          <input className="lf-input mb-3" type="password" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder={cfg.data?.has_openai_key ? "•••••• (leave blank to keep)" : "sk-…"} />
          <p className="text-xs text-warn mb-2">⚠ This sends your prompts (incl. portfolio facts) off-device. Local Hailo/Ollama keeps data on-device.</p>
        </>
      )}

      <button className="lf-btn-accent" onClick={save}>Save & test</button>
      {result && <p className="text-xs text-faint mt-2">{result}</p>}
    </Card>
  );
}
