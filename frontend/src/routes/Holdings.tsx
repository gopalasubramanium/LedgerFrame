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
  RowMenu,
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
  deleteManualHolding,
  deleteTransaction,
  getAccounts,
  getDeletedCount,
  getHoldings,
  getSummary,
  getTags,
  getTransactions,
  importCommit,
  importPreview,
  purgeDeleted,
  restoreManualHolding,
  restoreTransaction,
  setHoldingTags,
  updateTransaction,
} from "../api/holdings";
import type {
  AccountRow,
  HoldingRow,
  ImportRow,
  SummaryResponse,
  TransactionRow,
} from "../api/holdings";
import { apiDownload } from "../api/client";
import { getMaster } from "../mocks/refdata";
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
  const [deletedCount, setDeletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [tagsFor, setTagsFor] = useState<HoldingRow | null>(null);
  const [editTxn, setEditTxn] = useState<TransactionRow | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [h, s, t, a, d] = await Promise.all([
      getHoldings(),
      getSummary(),
      getTransactions(),
      getAccounts(),
      getDeletedCount(),
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
    setDeletedCount(d.ok ? d.data.total : 0);
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

  const softDeleteHolding = useCallback(
    async (row: HoldingRow) => {
      // Only manual holdings (no instrument/symbol) are deletable directly;
      // instrument-backed holdings are derived — remove via their transactions.
      if (row.symbol) {
        toast.show({ message: "Remove this holding by deleting its transactions in the ledger below." });
        return;
      }
      const res = await deleteManualHolding(row.id);
      if (!res.ok) {
        toast.show({ message: `Couldn't delete: ${res.error}` });
        return;
      }
      await reload();
      toast.show({
        message: `Deleted ${row.label ?? "holding"}.`,
        action: {
          label: "Undo",
          onClick: async () => {
            await restoreManualHolding(row.id);
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
      { key: "name", label: "Name", truncate: true, render: (h) => h.name ?? h.label ?? "—" },
      { key: "asset_class", label: "Class", sortable: true },
      { key: "quantity", label: "Position", format: "quantity", sortable: true },
      { key: "price", label: "Price", format: "price" },
      { key: "market_value", label: `Value (${baseCcy})`, format: "money", sortable: true },
      { key: "unrealised_pl", label: "Unrealised P/L", format: "signed-money", sortable: true },
      { key: "day_change", label: "Today's change", format: "signed-money" },
      { key: "valuation_label", label: "Source", truncate: true, render: provenanceCell },
      {
        key: "id",
        label: "",
        render: (h) => (
          <RowMenu
            aria-label={`Actions for ${h.symbol ?? h.label ?? "holding"}`}
            items={[
              {
                label: "Details",
                disabled: !h.symbol,
                onClick: () => { if (h.symbol) window.location.hash = `#/instrument/${h.symbol}`; },
              },
              { label: "Tags", onClick: () => setTagsFor(h) },
              { label: "Delete", danger: true, onClick: () => softDeleteHolding(h) },
            ]}
          />
        ),
      },
    ],
    [baseCcy, softDeleteHolding],
  );

  const txnColumns = useMemo<Column<TransactionRow>[]>(
    () => [
      { key: "ts", label: "Date", sortable: true, render: (t) => t.ts.slice(0, 10) },
      { key: "type", label: "Type", sortable: true },
      { key: "symbol", label: "Symbol", render: (t) => t.symbol ?? "—" },
      { key: "quantity", label: "Qty", format: "quantity" },
      { key: "price", label: "Price", format: "price" },
      { key: "amount", label: "Amount", format: "signed-money" },
      { key: "note", label: "Note", truncate: true, render: (t) => t.note ?? "—" },
      {
        key: "id",
        label: "",
        render: (t) => (
          <RowMenu
            aria-label={`Actions for ${t.type} ${t.symbol ?? ""}`}
            items={[
              { label: "Edit", onClick: () => setEditTxn(t) },
              { label: "Delete", danger: true, onClick: () => softDeleteTxn(t) },
            ]}
          />
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
          {deletedCount > 0 && (
            <button type="button" className="lf-btn" onClick={() => setPurgeOpen(true)}>
              Purge {deletedCount} deleted [PIN]
            </button>
          )}
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

      {editTxn && (
        <TxnEditDialog
          txn={editTxn}
          onClose={() => setEditTxn(null)}
          onError={(m) => toast.show({ message: m })}
          onDone={async () => {
            setEditTxn(null);
            await reload();
            toast.show({ message: "Transaction updated." });
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

// Total-cash transaction types: entered as a single "Amount", not qty × price.
const AMOUNT_TYPES = ["dividend", "interest", "fee"];

// D-089 — type-first entry: asset-type tiles in user vocabulary route to the
// existing single D-049 flow. branch + assetClass come from MASTER-DATA
// AssetClass (no new vocabulary). Listed = provider-quoted; Manual =
// manually-valued (D-073). Insurance is never here (D-062).
interface AssetTile {
  id: string;
  label: string;
  subtitle: string;
  branch: "listed" | "manual";
  assetClass: string; // MASTER-DATA AssetClass value
  /** D-092 signpost: navigate here instead of branching the form (e.g. Insurance
   *  has its own register, D-062). */
  nav?: string;
}
const ASSET_TILES: AssetTile[] = [
  { id: "stock_etf", label: "Stocks & ETFs", subtitle: "Exchange-listed shares & funds (live quotes).", branch: "listed", assetClass: "equity" },
  { id: "mutual_fund", label: "Mutual fund", subtitle: "Priced from official NAV (AMFI).", branch: "listed", assetClass: "mutual_fund" },
  { id: "crypto", label: "Crypto", subtitle: "Coins & tokens (CoinGecko).", branch: "listed", assetClass: "crypto" },
  { id: "cash", label: "Cash & deposits", subtitle: "Bank balances & cash you value.", branch: "manual", assetClass: "cash" },
  { id: "fixed_deposit", label: "Fixed deposit", subtitle: "Term deposit valued at principal.", branch: "manual", assetClass: "fixed_deposit" },
  { id: "bond", label: "Bond", subtitle: "Valued manually (no live quote).", branch: "manual", assetClass: "bond" },
  { id: "property", label: "Property", subtitle: "Real estate at your own estimate.", branch: "manual", assetClass: "property" },
  { id: "retirement", label: "Retirement", subtitle: "Pension / retirement balances.", branch: "manual", assetClass: "retirement" },
  { id: "private", label: "Private asset", subtitle: "Unlisted holdings valued manually.", branch: "manual", assetClass: "private" },
  { id: "liability", label: "Liability", subtitle: "A debt — counts against net worth.", branch: "manual", assetClass: "liability" },
  { id: "other", label: "Other", subtitle: "Doesn't fit — the honest escape valve.", branch: "manual", assetClass: "other" },
  // D-092 signpost — Insurance never branches this form (its own register, D-062).
  { id: "insurance", label: "Insurance", subtitle: "Policies live in their own register — we'll take you there.", branch: "manual", assetClass: "other", nav: "#/insurance" },
];

// --- Add flow: type-first entry (D-089) → single listed/manual flow (D-049) ---
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
  const [tile, setTile] = useState<AssetTile | null>(null); // D-089 entry step
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
      // Instrument-less types (interest on cash, standalone fees) don't require a
      // symbol; the rest do (transactions reference the instrument).
      const symbolRequired = !["interest", "fee"].includes(type);
      if (symbolRequired && !symbol.trim()) return onError("Enter or create an instrument first.");
      // Per-type mapping onto the pinned engine schema (no engine change):
      //  · split ratio → price (qty 0); bonus units → quantity (no price);
      //    merger ratio → price + target (§4.3, D-019).
      //  · dividend/interest/fee are TOTAL-CASH types: the engine reads the
      //    stored `amount` (= qty×price). Map "Amount" → price with quantity 1 so
      //    amount == the entered value (statements_report.py; compute_fifo income;
      //    fees route via the fee-type `amount`, never the `fees` field — no
      //    D-048 double-count).
      let quantity: number;
      let priceOrRatio: number;
      if (type === "split" || type === "merger") {
        quantity = 0;
        priceOrRatio = Number(price);
      } else if (type === "bonus") {
        quantity = Number(qty);
        priceOrRatio = 0;
      } else if (AMOUNT_TYPES.includes(type)) {
        quantity = 1;
        priceOrRatio = Number(price); // `price` state holds the "Amount" here
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
        // D-089: classify a newly-created instrument by the chosen type so it
        // routes correctly (crypto → CoinGecko, mutual_fund → AMFI).
        asset_class: tile?.assetClass ?? null,
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
      title={tile === null ? "What are you adding?" : "Add to holdings"}
      footer={
        tile === null ? (
          <button type="button" className="lf-btn" onClick={onClose}>
            Cancel
          </button>
        ) : (
          <>
            <button type="button" className="lf-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="lf-btn lf-btn--primary" onClick={submit}>
              Save
            </button>
          </>
        )
      }
    >
      {tile === null ? (
        // D-089 type-first entry: pick an asset type; it routes to the single
        // D-049 flow with the branch + fields preselected.
        <div className="hold__typegrid">
          {ASSET_TILES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`hold__tile${t.nav ? " hold__tile--signpost" : ""}`}
              onClick={() => {
                if (t.nav) {
                  // D-092: signpost — leave the Add form, go to the register.
                  onClose();
                  window.location.hash = t.nav;
                  return;
                }
                setTile(t);
                setMode(t.branch);
                if (t.branch === "manual") setAssetClass(t.assetClass);
              }}
            >
              <span className="hold__tile-title">{t.label}{t.nav ? " →" : ""}</span>
              <span className="hold__tile-sub">{t.subtitle}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="hold__form">
          <div className="hold__chosen">
            <button type="button" className="hold__linkbtn" onClick={() => setTile(null)}>
              ← Change type
            </button>
            <span className="hold__sub">
              Adding <strong>{tile.label}</strong>
            </span>
          </div>
        <div className="hold__field">
          <span className="hold__label">Account</span>
          <Select value={accountId} onChange={setAccountId} options={accountOptions} aria-label="Account" />
        </div>

        {mode === "listed" ? (
          <>
            <div className="hold__field">
              <span className="hold__label">
                Instrument (type a symbol, then “create”)
                {["interest", "fee"].includes(type) ? " — optional" : ""}
              </span>
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
            ) : AMOUNT_TYPES.includes(type) ? (
              // Dividend / interest / fee are total-cash: a single Amount, no
              // quantity or per-share price (statements_report; compute_fifo).
              <div className="hold__field">
                <span className="hold__label">
                  {type === "fee" ? "Amount" : "Amount received"}
                </span>
                <MoneyInput
                  value={price}
                  currency={currency}
                  onChange={setPrice}
                  aria-label={type === "fee" ? "Amount" : "Amount received"}
                />
                {type === "fee" && (
                  <span className="hold__sub">
                    Standalone charges (custody / platform / advisory). Trade
                    commissions are recorded on the trade, not here — they never
                    enter cost basis (D-048).
                  </span>
                )}
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
      )}
    </Dialog>
  );
}

// --- Edit an existing transaction (row action → PUT /transactions/{id}) --------
function TxnEditDialog({
  txn,
  onClose,
  onDone,
  onError,
}: {
  txn: TransactionRow;
  onClose: () => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [type, setType] = useState(txn.type);
  const [symbol, setSymbol] = useState(txn.symbol ?? "");
  const [qty, setQty] = useState(String(txn.quantity ?? 0));
  const [price, setPrice] = useState(String(txn.price ?? 0));
  const [date, setDate] = useState(txn.ts.slice(0, 10));
  const [currency, setCurrency] = useState(txn.currency);
  const [note, setNote] = useState(txn.note ?? "");

  async function save() {
    const res = await updateTransaction(txn.id, {
      symbol: symbol.trim() ? symbol.trim().toUpperCase() : null,
      type,
      ts: `${date}T00:00:00`,
      quantity: Number(qty),
      price: Number(price),
      currency,
      note: note.trim() || null,
      related_instrument_id: txn.related_instrument_id ?? null,
    });
    if (!res.ok) return onError(`Couldn't update: ${res.error}`);
    onDone();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit transaction"
      footer={
        <>
          <button type="button" className="lf-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="lf-btn lf-btn--primary" onClick={save}>Save</button>
        </>
      }
    >
      <div className="hold__form">
        <div className="hold__field">
          <span className="hold__label">Type</span>
          <MasterSelect master="txn_type" value={type} onChange={setType} />
        </div>
        <div className="hold__field">
          <span className="hold__label">Symbol</span>
          <TextInput value={symbol} onChange={setSymbol} aria-label="Symbol" placeholder="(optional)" />
        </div>
        <div className="hold__field">
          <span className="hold__label">Quantity</span>
          <QuantityInput value={qty} onChange={setQty} aria-label="Quantity" />
        </div>
        <div className="hold__field">
          <span className="hold__label">Price / amount</span>
          <MoneyInput value={price} currency={currency} onChange={setPrice} aria-label="Price" />
        </div>
        <div className="hold__field">
          <span className="hold__label">Date</span>
          <DateInput value={date} onChange={setDate} aria-label="Transaction date" />
        </div>
        <div className="hold__field">
          <span className="hold__label">Currency</span>
          <MasterSelect master="currency" value={currency} onChange={setCurrency} />
        </div>
        <div className="hold__field">
          <span className="hold__label">Note</span>
          <TextInput value={note} onChange={setNote} aria-label="Note" placeholder="(optional)" />
        </div>
      </div>
    </Dialog>
  );
}

// --- Import: editable review grid (D-093) -------------------------------------
type ReviewRow = ImportRow & { excluded: boolean };
const CSV_COLS = ["date", "symbol", "type", "quantity", "price", "fees", "taxes", "currency", "note", "asset_class", "country"];
const TXN_TYPE_SET = new Set(getMaster("txn_type").options.map((o) => o.value));
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

function rowIssues(r: ReviewRow): { type: boolean; date: boolean; any: boolean } {
  const badType = !TXN_TYPE_SET.has((r.type ?? "").toLowerCase());
  const badDate = !ISO_DATE.test(r.date ?? "");
  return { type: badType, date: badDate, any: badType || badDate };
}
function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function buildCsv(rows: ReviewRow[]): string {
  const lines = rows.map((r) => CSV_COLS.map((c) => csvCell(r[c])).join(","));
  return [CSV_COLS.join(","), ...lines].join("\n") + "\n";
}

function ImportDialog({
  onClose,
  onDone,
  onError,
}: {
  onClose: () => void;
  onDone: (imported: number) => void;
  onError: (msg: string) => void;
}) {
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function doPreview(f: File) {
    setBusy(true);
    const res = await importPreview(f);
    setBusy(false);
    if (!res.ok) return onError(`Preview failed: ${res.error}`);
    // Duplicates are excluded by default (the backend skips them anyway); the
    // user can re-include if wanted.
    setRows((res.data.rows ?? []).map((r) => ({ ...r, excluded: Boolean(r.duplicate) })));
  }

  function patch(i: number, p: Partial<ReviewRow>) {
    setRows((rs) => (rs ? rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)) : rs));
  }

  const included = rows?.filter((r) => !r.excluded) ?? [];
  const unresolved = rows?.filter((r) => !r.excluded && rowIssues(r).any).length ?? 0;
  const canCommit = Boolean(rows) && included.length > 0 && unresolved === 0;

  async function doCommit() {
    if (!rows) return;
    setBusy(true);
    const file = new File([buildCsv(included)], "review.csv", { type: "text/csv" });
    const res = await importCommit(file);
    setBusy(false);
    if (!res.ok) return onError(`Import failed: ${res.error}`);
    onDone(res.data.imported ?? included.length);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Import transactions (CSV)"
      footer={
        <>
          <button type="button" className="lf-btn" onClick={onClose}>Cancel</button>
          {rows && (
            <button type="button" className="lf-btn lf-btn--primary" disabled={!canCommit || busy} onClick={doCommit}>
              Commit {included.length} row{included.length === 1 ? "" : "s"}
            </button>
          )}
        </>
      }
    >
      {!rows ? (
        <div className="hold__form">
          <FileInput accept=".csv" aria-label="Import CSV" label="Choose CSV" onChange={(fs) => doPreview(fs[0])} />
          <span className="hold__sub">
            A dry run — every row is reviewed before anything is written. Fix flagged
            cells inline or exclude the row; imports never silently create bad data (D-012).
          </span>
        </div>
      ) : (
        <div className="imp">
          <div className="imp__summary">
            {included.length} to import · {(rows.length - included.length)} excluded ·{" "}
            {unresolved > 0 ? (
              <span className="imp__bad">{unresolved} row{unresolved === 1 ? "" : "s"} need a fix or exclusion</span>
            ) : (
              <span className="imp__ok">all rows resolved</span>
            )}
          </div>
          <div className="imp__grid" role="table" aria-label="Import review">
            <div className="imp__head" role="row">
              <span>Date</span><span>Symbol</span><span>Type</span><span>Qty</span><span>Price</span><span>Ccy</span><span>Status</span><span />
            </div>
            {rows.map((r, i) => {
              const iss = rowIssues(r);
              return (
                <div
                  className={`imp__row${r.excluded ? " imp__row--excluded" : iss.any ? " imp__row--error" : ""}`}
                  role="row"
                  key={r.row ?? i}
                >
                  <span className={iss.date ? "imp__cell--bad" : ""}>
                    <DateInput value={(r.date ?? "").slice(0, 10)} onChange={(v) => patch(i, { date: v })} aria-label={`Date row ${r.row}`} />
                  </span>
                  <span>
                    <TextInput value={r.symbol ?? ""} onChange={(v) => patch(i, { symbol: v.toUpperCase() })} aria-label={`Symbol row ${r.row}`} placeholder="(none)" />
                  </span>
                  <span className={iss.type ? "imp__cell--bad" : ""}>
                    <MasterSelect master="txn_type" value={TXN_TYPE_SET.has((r.type ?? "").toLowerCase()) ? (r.type as string).toLowerCase() : ""} onChange={(v) => patch(i, { type: v })} />
                  </span>
                  <span>
                    <QuantityInput value={r.quantity ?? "0"} onChange={(v) => patch(i, { quantity: v })} aria-label={`Quantity row ${r.row}`} />
                  </span>
                  <span>
                    <QuantityInput value={r.price ?? "0"} onChange={(v) => patch(i, { price: v })} aria-label={`Price row ${r.row}`} />
                  </span>
                  <span>
                    <MasterSelect master="currency" value={r.currency ?? "USD"} onChange={(v) => patch(i, { currency: v })} />
                  </span>
                  <span className="imp__status">
                    {r.error ? <span className="imp__bad" title={r.error}>error</span>
                      : r.duplicate ? <span className="imp__dup">duplicate</span>
                      : iss.any ? <span className="imp__bad">fix</span>
                      : <span className="imp__ok">ok</span>}
                  </span>
                  <span>
                    <button
                      type="button"
                      className="hold__linkbtn"
                      onClick={() => patch(i, { excluded: !r.excluded })}
                    >
                      {r.excluded ? "Include" : "Exclude"}
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
