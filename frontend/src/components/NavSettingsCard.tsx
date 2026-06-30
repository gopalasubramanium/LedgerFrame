import { useState } from "react";
import { Card } from "./ui";
import { loadNav, resetNav, saveNav, type NavItem } from "../lib/nav";

// Lets the user reorder and rename the sidebar (e.g. Home → Dashboard, or put
// Snapshot before Portfolio). Stored per-device; applied live via a window event.
export function NavSettingsCard({ className = "" }: { className?: string }) {
  const [items, setItems] = useState<NavItem[]>(loadNav);
  const [msg, setMsg] = useState("");

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };
  const rename = (i: number, label: string) =>
    setItems(items.map((it, k) => (k === i ? { ...it, label } : it)));
  const save = () => {
    saveNav(items.map((it) => ({ ...it, label: it.label.trim() || it.path })));
    setMsg("Saved — sidebar updated.");
  };
  const reset = () => { resetNav(); setItems(loadNav()); setMsg("Reset to defaults."); };

  return (
    <Card title="Navigation" className={className}>
      <p className="text-xs text-faint mb-3">
        Reorder and rename the sidebar items (e.g. rename <b>Home</b> → <b>Dashboard</b>, or move
        Snapshot above Portfolio). Saved on this device.
      </p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={it.path} className="flex items-center gap-2">
            <span className="text-faint text-xs w-16 shrink-0 truncate" title={it.path}>{it.path}</span>
            <input className="lf-input flex-1 py-1 text-sm" value={it.label} maxLength={20}
              onChange={(e) => rename(i, e.target.value)} />
            <button className="lf-btn px-2 py-1" disabled={i === 0} onClick={() => move(i, -1)} title="Move up" aria-label="Move up">↑</button>
            <button className="lf-btn px-2 py-1" disabled={i === items.length - 1} onClick={() => move(i, 1)} title="Move down" aria-label="Move down">↓</button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 mt-3">
        <button className="lf-btn-accent" onClick={save}>Save order &amp; names</button>
        <button className="lf-btn" onClick={reset}>Reset</button>
        {msg && <span className="text-xs text-faint">{msg}</span>}
      </div>
    </Card>
  );
}
