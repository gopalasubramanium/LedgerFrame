import { useEffect, useState } from "react";
import {
  api,
  ASSET_CLASSES,
  TXN_TYPES,
  type ManualInput,
  type ManualRow,
  type TxnInput,
  type TxnRow,
} from "../lib/api";
import { money } from "../lib/format";

const CURRENCIES = ["SGD", "USD", "INR", "EUR", "GBP", "JPY", "AUD", "CNY", "HKD"];

type Tab = "transactions" | "assets";

// Full add/edit/delete manager for transactions and manual assets/liabilities.
// Opens as a modal over the Portfolio page.
export function PortfolioEditor({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [tab, setTab] = useState<Tab>("transactions");
  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-center bg-black/60 p-3" onClick={onClose}>
      <div
        className="lf-card w-full max-w-5xl flex flex-col"
        role="dialog"
        aria-label="Edit portfolio"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-2">
            <TabBtn active={tab === "transactions"} onClick={() => setTab("transactions")}>Transactions</TabBtn>
            <TabBtn active={tab === "assets"} onClick={() => setTab("assets")}>Manual assets & liabilities</TabBtn>
          </div>
          <button className="lf-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          {tab === "transactions" ? <TxnManager onChanged={onChanged} /> : <AssetManager onChanged={onChanged} />}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className={`touch px-4 rounded-card text-sm font-medium ${active ? "bg-accent text-base" : "bg-elevated text-muted hover:text-ink"}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// --------------------------------------------------------------------------- //
// Transactions
// --------------------------------------------------------------------------- //
const EMPTY_TXN: TxnInput = {
  symbol: "", type: "buy", ts: new Date().toISOString().slice(0, 16),
  quantity: 0, price: 0, fees: 0, taxes: 0, currency: "USD", note: "",
};

function TxnManager({ onChanged }: { onChanged: () => void }) {
  const [rows, setRows] = useState<TxnRow[]>([]);
  const [editing, setEditing] = useState<TxnInput | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const reload = () => api.transactions().then((r) => setRows(r.transactions)).catch((e) => setErr(String(e)));
  useEffect(() => { reload(); }, []);

  async function save(input: TxnInput) {
    setBusy(true); setErr("");
    try {
      if (editId) await api.updateTransaction(editId, input);
      else await api.addTransaction(input);
      setEditing(null); setEditId(null);
      reload(); onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed (is the app locked? Set/enter your PIN).");
    } finally { setBusy(false); }
  }

  async function remove(id: number) {
    if (!confirm("Delete this transaction? Holdings will be recalculated.")) return;
    try { await api.deleteTransaction(id); reload(); onChanged(); }
    catch (e) { setErr(String(e)); }
  }

  if (editing) {
    return <TxnForm initial={editing} busy={busy} error={err} onCancel={() => { setEditing(null); setEditId(null); setErr(""); }} onSave={save} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted">{rows.length} transactions</span>
        <div className="flex gap-2">
          <a className="lf-btn" href={api.csvTemplateUrl} download="ledgerframe-template.csv">CSV template</a>
          <ImportButton onDone={() => { reload(); onChanged(); }} onError={setErr} />
          <button className="lf-btn-accent" onClick={() => { setEditing({ ...EMPTY_TXN }); setEditId(null); }}>+ Add</button>
        </div>
      </div>
      {err && <div className="lf-chip bg-down/15 text-down mb-2">{err}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-faint text-xs uppercase">
            <tr className="text-left border-b border-line">
              <th className="py-2">Date</th><th>Type</th><th>Symbol</th>
              <th className="text-right">Qty</th><th className="text-right">Price</th>
              <th className="text-right">Fees</th><th className="text-right pr-3">Taxes</th>
              <th>Ccy</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-b border-line/50">
                <td className="py-2 whitespace-nowrap">{new Date(t.ts).toLocaleDateString()} <span className="text-faint">{new Date(t.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></td>
                <td><span className="lf-chip bg-elevated capitalize">{t.type}</span></td>
                <td>{t.symbol ?? "—"}</td>
                <td className="text-right tnum">{t.quantity}</td>
                <td className="text-right tnum">{t.price}</td>
                <td className="text-right tnum">{t.fees}</td>
                <td className="text-right tnum">{t.taxes}</td>
                <td>{t.currency}</td>
                <td className="text-right whitespace-nowrap">
                  <button className="text-accent hover:underline mr-3" onClick={() => {
                    setEditId(t.id);
                    setEditing({ symbol: t.symbol ?? "", type: t.type, ts: t.ts.slice(0, 16), quantity: t.quantity, price: t.price, fees: t.fees, taxes: t.taxes, currency: t.currency, note: t.note ?? "" });
                  }}>Edit</button>
                  <button className="text-down hover:underline" onClick={() => remove(t.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TxnForm({ initial, busy, error, onCancel, onSave }: { initial: TxnInput; busy: boolean; error?: string; onCancel: () => void; onSave: (t: TxnInput) => void }) {
  const [f, setF] = useState<TxnInput>(initial);
  const set = (k: keyof TxnInput, v: string | number) => setF((p) => ({ ...p, [k]: v }));
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
      <h3 className="text-lg font-semibold">Transaction details</h3>
      {error && <div className="lf-chip bg-down/15 text-down">{error}</div>}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Field label="Date & time">
          <input type="datetime-local" className="lf-input" value={f.ts} onChange={(e) => set("ts", e.target.value)} required />
        </Field>
        <Field label="Type">
          <select className="lf-input capitalize" value={f.type} onChange={(e) => set("type", e.target.value)}>
            {TXN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Symbol (blank for cash)">
          <input className="lf-input" value={f.symbol ?? ""} onChange={(e) => set("symbol", e.target.value.toUpperCase())} placeholder="AAPL" />
        </Field>
        <Field label="Quantity"><NumberInput v={f.quantity} on={(v) => set("quantity", v)} /></Field>
        <Field label="Price (per unit)"><NumberInput v={f.price} on={(v) => set("price", v)} /></Field>
        <Field label="Currency">
          <select className="lf-input" value={f.currency} onChange={(e) => set("currency", e.target.value)}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Fees / commission"><NumberInput v={f.fees} on={(v) => set("fees", v)} /></Field>
        <Field label="Taxes / duty"><NumberInput v={f.taxes} on={(v) => set("taxes", v)} /></Field>
        <Field label="Note">
          <input className="lf-input" value={f.note ?? ""} onChange={(e) => set("note", e.target.value)} maxLength={255} />
        </Field>
      </div>
      <div className="flex gap-2 pt-2">
        <button type="submit" className="lf-btn-accent" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        <button type="button" className="lf-btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function ImportButton({ onDone, onError }: { onDone: () => void; onError: (s: string) => void }) {
  return (
    <label className="lf-btn cursor-pointer">
      Import CSV
      <input type="file" accept=".csv" className="hidden" onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try { const r = await api.importCsv(file); onDone(); if (r.errors?.length) onError(`Imported ${r.imported}, ${r.errors.length} skipped`); }
        catch (err) { onError(err instanceof Error ? err.message : "Import failed"); }
        e.target.value = "";
      }} />
    </label>
  );
}

// --------------------------------------------------------------------------- //
// Manual assets & liabilities
// --------------------------------------------------------------------------- //
const EMPTY_ASSET: ManualInput = { label: "", asset_class: "cash", value: 0, currency: "SGD" };

function AssetManager({ onChanged }: { onChanged: () => void }) {
  const [rows, setRows] = useState<ManualRow[]>([]);
  const [editing, setEditing] = useState<ManualInput | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [err, setErr] = useState("");

  const reload = () => api.manualHoldings().then((r) => setRows(r.holdings)).catch((e) => setErr(String(e)));
  useEffect(() => { reload(); }, []);

  async function save(input: ManualInput) {
    setErr("");
    try {
      if (editId) await api.updateManualHolding(editId, input);
      else await api.addManualHolding(input);
      setEditing(null); setEditId(null); reload(); onChanged();
    } catch (e) { setErr(e instanceof Error ? e.message : "Save failed (locked?)"); }
  }
  async function remove(id: number) {
    if (!confirm("Delete this asset?")) return;
    try { await api.deleteManualHolding(id); reload(); onChanged(); } catch (e) { setErr(String(e)); }
  }

  if (editing) {
    return (
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(editing); }}>
        <h3 className="text-lg font-semibold">Asset / liability details</h3>
        {err && <div className="lf-chip bg-down/15 text-down">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Label"><input className="lf-input" value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} required /></Field>
          <Field label="Type">
            <select className="lf-input capitalize" value={editing.asset_class} onChange={(e) => setEditing({ ...editing, asset_class: e.target.value })}>
              {ASSET_CLASSES.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
            </select>
          </Field>
          <Field label="Value (use a liability type for debts)"><NumberInput v={editing.value} on={(v) => setEditing({ ...editing, value: v })} /></Field>
          <Field label="Currency">
            <select className="lf-input" value={editing.currency} onChange={(e) => setEditing({ ...editing, currency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="submit" className="lf-btn-accent">Save</button>
          <button type="button" className="lf-btn" onClick={() => { setEditing(null); setEditId(null); }}>Cancel</button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted">{rows.length} manual items (cash, property, loans…)</span>
        <button className="lf-btn-accent" onClick={() => { setEditing({ ...EMPTY_ASSET }); setEditId(null); }}>+ Add</button>
      </div>
      {err && <div className="lf-chip bg-down/15 text-down mb-2">{err}</div>}
      <table className="w-full text-sm">
        <thead className="text-faint text-xs uppercase">
          <tr className="text-left border-b border-line"><th className="py-2">Label</th><th>Type</th><th className="text-right">Value</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((h) => (
            <tr key={h.id} className="border-b border-line/50">
              <td className="py-2">{h.label}</td>
              <td className="capitalize">{h.asset_class.replace("_", " ")}</td>
              <td className="text-right tnum">{money(h.value, h.currency)}</td>
              <td className="text-right whitespace-nowrap">
                <button className="text-accent hover:underline mr-3" onClick={() => { setEditId(h.id); setEditing({ label: h.label, asset_class: h.asset_class, value: h.value, currency: h.currency }); }}>Edit</button>
                <button className="text-down hover:underline" onClick={() => remove(h.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --------------------------------------------------------------------------- //
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-faint">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
function NumberInput({ v, on }: { v: number; on: (v: number) => void }) {
  return <input type="number" step="any" className="lf-input tnum" value={v} onChange={(e) => on(parseFloat(e.target.value) || 0)} />;
}
