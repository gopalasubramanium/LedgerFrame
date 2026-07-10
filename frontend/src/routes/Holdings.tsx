import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./Holdings.css";
import {
  ConfirmDialog,
  DataTable,
  DateInput,
  Dialog,
  EmptyState,
  FileInput,
  InstrumentPicker,
  MasterSelect,
  MoneyInput,
  PageHeader,
  QuantityInput,
  Select,
  StalenessChip,
  TextInput,
  TrendStat,
  useToast,
} from "../components/ui";
import type { Column } from "../components/ui";
import { DisplayControls } from "../components/DisplayControls";
import {
  addManualHolding,
  addTransaction,
  deleteTransaction,
  getAccounts,
  getHoldings,
  getSummary,
  getTags,
  getTransactions,
  importCommit,
  importPreview,
  purgeDeleted,
  restoreTransaction,
  setHoldingTags,
} from "../api/holdings";
import type {
  AccountRow,
  HoldingRow,
  SummaryResponse,
  TransactionRow,
} from "../api/holdings";
import { apiDownload } from "../api/client";
import { formatMoney, formatSignedMoney } from "../format/number";

// Holdings — the canonical management surface (IA §5; D-023/D-049/D-050). Owns
// management (add/edit/delete holdings, transactions, manual assets, imports,
// tags, soft-delete+undo+purge, server-side export); the value/positions header
// is a linked P-1 summary of the Portfolio reader — never recomputed here.

function provenanceCell(h: HoldingRow) {
  return (
    <span className="hold__provcell">
      <StalenessChip isStale={h.is_stale} asOf={h.valuation_label ?? ""} />
      {!h.is_stale && <span>{h.valuation_label ?? "—"}</span>}
    </span>
  );
}

export function Holdings() {
  const toast = useToast();
  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [txns, setTxns] = useState<TransactionRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [baseCcy, setBaseCcy] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [tagsFor, setTagsFor] = useState<HoldingRow | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [h, s, t, a] = await Promise.all([
      getHoldings(),
      getSummary(),
      getTransactions(),
      getAccounts(),
    ]);
    if (h.ok) {
      setHoldings(h.data.holdings);
      setBaseCcy(h.data.base_currency);
    } else {
      setError(h.error);
    }
    if (s.ok) setSummary(s.data);
    if (t.ok) setTxns(t.data.transactions);
    if (a.ok) setAccounts(a.data.accounts);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const softDeleteTxn = useCallback(
    async (row: TransactionRow) => {
      const res = await deleteTransaction(row.id);
      if (!res.ok) {
        toast.show({ message: `Couldn't delete: ${res.error}` });
        return;
      }
      await reload();
      toast.show({
        message: `Deleted ${row.type} ${row.symbol ?? ""}`.trim() + ".",
        action: {
          label: "Undo",
          onClick: async () => {
            await restoreTransaction(row.id);
            await reload();
          },
        },
      });
    },
    [reload, toast],
  );

  const holdingColumns = useMemo<Column<HoldingRow>[]>(
    () => [
      { key: "symbol", label: "Symbol", sortable: true, render: (h) => h.symbol ?? h.label ?? "—" },
      { key: "name", label: "Name", render: (h) => h.name ?? h.label ?? "—" },
      { key: "asset_class", label: "Class", sortable: true },
      { key: "quantity", label: "Position", format: "quantity", sortable: true },
      { key: "price", label: "Price", format: "price" },
      { key: "market_value", label: `Value (${baseCcy})`, format: "money", sortable: true },
      { key: "unrealised_pl", label: "Unrealised P/L", format: "signed-money", sortable: true },
      { key: "day_change", label: "Today's change", format: "signed-money" },
      { key: "valuation_label", label: "Source", render: provenanceCell },
      {
        key: "id",
        label: "",
        render: (h) => (
          <span className="hold__rowactions">
            <button type="button" className="hold__linkbtn" onClick={() => setTagsFor(h)}>
              Tags
            </button>
          </span>
        ),
      },
    ],
    [baseCcy],
  );

  const txnColumns = useMemo<Column<TransactionRow>[]>(
    () => [
      { key: "ts", label: "Date", sortable: true, render: (t) => t.ts.slice(0, 10) },
      { key: "type", label: "Type", sortable: true },
      { key: "symbol", label: "Symbol", render: (t) => t.symbol ?? "—" },
      { key: "quantity", label: "Qty", format: "quantity" },
      { key: "price", label: "Price", format: "price" },
      { key: "amount", label: "Amount", format: "signed-money" },
      {
        key: "id",
        label: "",
        render: (t) => (
          <span className="hold__rowactions">
            <button type="button" className="hold__linkbtn" onClick={() => softDeleteTxn(t)}>
              Delete
            </button>
          </span>
        ),
      },
    ],
    [softDeleteTxn],
  );

  return (
    <div className="hold">
      <div className="hold__bar">
        <Link className="lf-btn" to="/">
          ← Home
        </Link>
        <DisplayControls />
      </div>

      <PageHeaderHoldings
        onAdd={() => setAddOpen(true)}
        onImport={() => setImportOpen(true)}
        onExport={() => apiDownload("/portfolio/holdings.csv")}
      />

      {/* Value/positions header — a linked P-1 summary. The figure is net of
          liabilities, i.e. Net worth (GLOSSARY; D-021 retires "Total value"). */}
      <div className="hold__section">
        <TrendStat
          label={`Net worth · ${holdings.length} position${holdings.length === 1 ? "" : "s"}`}
          value={summary ? `${baseCcy} ${formatMoney(summary.total_value)}` : "—"}
          delta={summary?.day_change}
          deltaDisplay={summary ? formatSignedMoney(summary.day_change) : undefined}
        />
        <span className="hold__sub">
          A linked summary — Net worth is canonical on <Link to="/net-worth">Net worth</Link>;
          analytics on <Link to="/portfolio">Portfolio</Link> (D-023).
        </span>
      </div>

      {/* Holdings table */}
      <div className="hold__section">
        <h2 className="hold__h2">Holdings</h2>
        {loading ? (
          <EmptyState message="Loading holdings…" reason="Fetching from the pricing reader." />
        ) : error ? (
          <EmptyState
            message="Couldn't load holdings"
            reason={`The reader is unreachable (${error}). Values are withheld, never guessed.`}
            action={
              <button type="button" className="lf-btn" onClick={reload}>
                Retry
              </button>
            }
          />
        ) : holdings.length === 0 ? (
          <EmptyState
            message="No holdings yet"
            reason="Add a holding or import a broker CSV to populate this table."
            action={
              <button type="button" className="lf-btn lf-btn--primary" onClick={() => setAddOpen(true)}>
                Add holding
              </button>
            }
          />
        ) : (
          <DataTable columns={holdingColumns} rows={holdings} />
        )}
      </div>

      {/* Transactions ledger */}
      <div className="hold__section">
        <div className="hold__bar">
          <h2 className="hold__h2">Transactions</h2>
          <button type="button" className="lf-btn" onClick={() => setPurgeOpen(true)}>
            Purge deleted [PIN]
          </button>
        </div>
        {txns.length === 0 ? (
          <EmptyState
            message="No transactions"
            reason="Record a buy, sell, dividend, or merger from “Add”, or import a CSV."
          />
        ) : (
          <DataTable columns={txnColumns} rows={txns} />
        )}
      </div>

      {addOpen && (
        <AddDialog
          accounts={accounts}
          baseCcy={baseCcy}
          onClose={() => setAddOpen(false)}
          onDone={async () => {
            setAddOpen(false);
            await reload();
            toast.show({ message: "Added." });
          }}
          onError={(m) => toast.show({ message: m })}
        />
      )}

      {importOpen && (
        <ImportDialog
          onClose={() => setImportOpen(false)}
          onDone={async (n) => {
            setImportOpen(false);
            await reload();
            toast.show({ message: `Imported ${n} transaction${n === 1 ? "" : "s"}.` });
          }}
          onError={(m) => toast.show({ message: m })}
        />
      )}

      {tagsFor && (
        <TagsDialog
          holding={tagsFor}
          onClose={() => setTagsFor(null)}
          onError={(m) => toast.show({ message: m })}
          onDone={() => {
            setTagsFor(null);
            toast.show({ message: "Tags saved." });
          }}
        />
      )}

      <ConfirmDialog
        open={purgeOpen}
        title="Purge deleted rows?"
        message="Permanently removes all soft-deleted holdings and transactions. This cannot be undone."
        confirmLabel="Purge"
        destructive
        requirePin
        onCancel={() => setPurgeOpen(false)}
        onConfirm={async () => {
          setPurgeOpen(false);
          const res = await purgeDeleted();
          toast.show({ message: res.ok ? "Purged." : `Couldn't purge: ${res.error}` });
          if (res.ok) reload();
        }}
      />
    </div>
  );
}

function PageHeaderHoldings({
  onAdd,
  onImport,
  onExport,
}: {
  onAdd: () => void;
  onImport: () => void;
  onExport: () => void;
}) {
  return (
    <PageHeader
      title="Holdings"
      subtitle="Management surface — add/edit holdings, transactions, and manual assets; import; export."
      actions={
        <>
          <button type="button" className="lf-btn" onClick={onImport}>
            Import
          </button>
          <button type="button" className="lf-btn" onClick={onExport}>
            Export (server-side)
          </button>
          <button type="button" className="lf-btn lf-btn--primary" onClick={onAdd}>
            Add
          </button>
        </>
      }
    />
  );
}

// --- Add flow: one dialog, branch listed vs manual (D-049) --------------------
function AddDialog({
  accounts,
  baseCcy,
  onClose,
  onDone,
  onError,
}: {
  accounts: AccountRow[];
  baseCcy: string;
  onClose: () => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [mode, setMode] = useState<"listed" | "manual">("listed");
  const [accountId, setAccountId] = useState("");
  const accountOptions = [
    { value: "", label: "— account —" },
    ...accounts.map((a) => ({ value: String(a.id), label: a.name })),
  ];

  // listed
  const [symbol, setSymbol] = useState("");
  const [type, setType] = useState("buy");
  const [qty, setQty] = useState("0");
  const [price, setPrice] = useState("0");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState(baseCcy || "USD");
  const [absorbedInto, setAbsorbedInto] = useState<number | null>(null);

  // manual
  const [label, setLabel] = useState("");
  const [assetClass, setAssetClass] = useState("cash");
  const [value, setValue] = useState("0");

  async function submit() {
    if (mode === "listed") {
      if (!symbol.trim()) return onError("Enter or create an instrument first.");
      // Corporate-action field mapping onto the pinned engine schema (§4.3,
      // D-019 way; no engine change): split ratio → price (qty 0); bonus units
      // → quantity at zero cost (no price); merger ratio → price + target.
      let quantity: number;
      let priceOrRatio: number;
      if (type === "split" || type === "merger") {
        quantity = 0;
        priceOrRatio = Number(price);
      } else if (type === "bonus") {
        quantity = Number(qty);
        priceOrRatio = 0;
      } else {
        quantity = Number(qty);
        priceOrRatio = Number(price);
      }
      const res = await addTransaction({
        account_id: accountId ? Number(accountId) : null,
        symbol: symbol.trim().toUpperCase(),
        type,
        ts: `${date}T00:00:00`,
        quantity,
        price: priceOrRatio,
        currency,
        related_instrument_id: type === "merger" ? absorbedInto : null,
      });
      if (!res.ok) return onError(`Couldn't add transaction: ${res.error}`);
    } else {
      if (!label.trim()) return onError("A manual asset needs a label.");
      const res = await addManualHolding({
        account_id: accountId ? Number(accountId) : null,
        label: label.trim(),
        asset_class: assetClass,
        value: Number(value),
        currency,
      });
      if (!res.ok) return onError(`Couldn't add manual asset: ${res.error}`);
    }
    onDone();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add to holdings"
      footer={
        <>
          <button type="button" className="lf-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="lf-btn lf-btn--primary" onClick={submit}>
            Save
          </button>
        </>
      }
    >
      <div className="hold__tabs">
        <button
          type="button"
          className={`hold__tab${mode === "listed" ? " hold__tab--active" : ""}`}
          onClick={() => setMode("listed")}
        >
          Listed instrument
        </button>
        <button
          type="button"
          className={`hold__tab${mode === "manual" ? " hold__tab--active" : ""}`}
          onClick={() => setMode("manual")}
        >
          Manual asset
        </button>
      </div>

      <div className="hold__form">
        <div className="hold__field">
          <span className="hold__label">Account</span>
          <Select value={accountId} onChange={setAccountId} options={accountOptions} aria-label="Account" />
        </div>

        {mode === "listed" ? (
          <>
            <div className="hold__field">
              <span className="hold__label">Instrument (type a symbol, then “create”)</span>
              <InstrumentPicker
                allowCreate
                onSelect={(p) =>
                  setSymbol(p.kind === "create" ? p.query : p.instrument.symbol)
                }
              />
            </div>
            <div className="hold__field">
              <span className="hold__label">Type</span>
              <MasterSelect master="txn_type" value={type} onChange={setType} />
            </div>
            {type === "merger" ? (
              <>
                <div className="hold__field">
                  <span className="hold__label">Absorbed into (target instrument)</span>
                  <InstrumentPicker
                    allowCreate={false}
                    onSelect={(p) =>
                      setAbsorbedInto(p.kind === "existing" ? Number(p.instrument.id.replace(/\D/g, "")) || null : null)
                    }
                  />
                </div>
                <div className="hold__field">
                  <span className="hold__label">Ratio (new shares per old, e.g. 1)</span>
                  <QuantityInput value={price} onChange={setPrice} aria-label="Merger ratio" />
                </div>
              </>
            ) : type === "split" ? (
              // §4.3: split scales lots by the ratio (in the price field); no
              // quantity or price of its own.
              <div className="hold__field">
                <span className="hold__label">Split ratio (e.g. 2 for a 2:1 split)</span>
                <QuantityInput value={price} onChange={setPrice} aria-label="Split ratio" />
              </div>
            ) : type === "bonus" ? (
              // §4.3: bonus adds shares at ZERO cost — units only, no price field.
              <div className="hold__field">
                <span className="hold__label">Bonus units (extra shares, zero cost)</span>
                <QuantityInput value={qty} onChange={setQty} aria-label="Bonus units" />
              </div>
            ) : (
              <>
                <div className="hold__field">
                  <span className="hold__label">Quantity</span>
                  <QuantityInput value={qty} onChange={setQty} aria-label="Quantity" />
                </div>
                <div className="hold__field">
                  <span className="hold__label">Price</span>
                  <MoneyInput value={price} currency={currency} onChange={setPrice} aria-label="Price" />
                </div>
              </>
            )}
            <div className="hold__field">
              <span className="hold__label">Date</span>
              <DateInput value={date} onChange={setDate} aria-label="Transaction date" />
            </div>
            <div className="hold__field">
              <span className="hold__label">Currency</span>
              <MasterSelect master="currency" value={currency} onChange={setCurrency} />
            </div>
          </>
        ) : (
          <>
            <div className="hold__field">
              <span className="hold__label">Label</span>
              <TextInput
                value={label}
                onChange={setLabel}
                aria-label="Label"
                placeholder="e.g. Flat, Gold bar, FD"
              />
            </div>
            <div className="hold__field">
              <span className="hold__label">Asset class</span>
              <MasterSelect master="asset_class" value={assetClass} onChange={setAssetClass} />
            </div>
            <div className="hold__field">
              <span className="hold__label">Value</span>
              <MoneyInput value={value} currency={currency} onChange={setValue} aria-label="Value" />
            </div>
            <div className="hold__field">
              <span className="hold__label">Currency</span>
              <MasterSelect master="currency" value={currency} onChange={setCurrency} />
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

// --- Import: preview → review → commit (D-012 review queue) -------------------
function ImportDialog({
  onClose,
  onDone,
  onError,
}: {
  onClose: () => void;
  onDone: (imported: number) => void;
  onError: (msg: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function doPreview(f: File) {
    setFile(f);
    const res = await importPreview(f);
    if (!res.ok) {
      onError(`Preview failed: ${res.error}`);
      setPreview(null);
      return;
    }
    setPreview(JSON.stringify(res.data, null, 2));
  }

  async function doCommit() {
    if (!file) return;
    const res = await importCommit(file);
    if (!res.ok) return onError(`Import failed: ${res.error}`);
    onDone(res.data.imported ?? 0);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Import transactions (CSV)"
      footer={
        <>
          <button type="button" className="lf-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="lf-btn lf-btn--primary" disabled={!file} onClick={doCommit}>
            Commit import
          </button>
        </>
      }
    >
      <div className="hold__form">
        <FileInput accept=".csv" aria-label="Import CSV" label="Choose CSV" onChange={(fs) => doPreview(fs[0])} />
        <span className="hold__sub">
          Preview is a dry run — unresolved symbols are flagged for review before commit; imports never silently
          create instruments (D-012).
        </span>
        {preview && <pre className="hold__preview">{preview}</pre>}
      </div>
    </Dialog>
  );
}

// --- Tags: add / remove per holding (D-011, cap 16) ---------------------------
function TagsDialog({
  holding,
  onClose,
  onDone,
  onError,
}: {
  holding: HoldingRow;
  onClose: () => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [tags, setTags] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    getTags().then((r) => {
      // The tags endpoint returns the tag master; per-holding tags are seeded
      // empty here (the holdings reader doesn't echo them). Start empty.
      if (r.ok) setTags([]);
    });
  }, []);

  function add() {
    const t = draft.trim().toLowerCase();
    if (!t) return;
    if (tags.length >= 16) return onError("A holding can carry at most 16 tags.");
    if (tags.includes(t)) return;
    setTags([...tags, t]);
    setDraft("");
  }

  async function save() {
    const res = await setHoldingTags(holding.id, tags);
    if (!res.ok) return onError(`Couldn't save tags: ${res.error}`);
    onDone();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Tags · ${holding.symbol ?? holding.label ?? ""}`}
      footer={
        <>
          <button type="button" className="lf-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="lf-btn lf-btn--primary" onClick={save}>
            Save tags
          </button>
        </>
      }
    >
      <div className="hold__tagrow">
        {tags.length === 0 && <span className="hold__sub">No tags yet.</span>}
        {tags.map((t) => (
          <span className="hold__tag" key={t}>
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))}>
              ✕
            </button>
          </span>
        ))}
      </div>
      <div className="hold__form">
        <span className="hold__label">Add a tag (case-insensitive)</span>
        <TextInput
          value={draft}
          onChange={setDraft}
          onEnter={add}
          aria-label="New tag"
          placeholder="e.g. core, watch, tax-loss"
        />
      </div>
    </Dialog>
  );
}
