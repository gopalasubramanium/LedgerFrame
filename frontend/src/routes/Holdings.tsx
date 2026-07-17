import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "./Holdings.css";
import { InstrumentLabel } from "../components/InstrumentLabel";
import { Upload, Download, Plus } from "../icons";
import {
  ConfirmDialog,
  DataTable,
  DateInput,
  Dialog,
  EmptyState,
  FileInput,
  GlossaryTerm,
  InstrumentPicker,
  MasterSelect,
  MoneyInput,
  PageHeader,
  PercentInput,
  QuantityInput,
  RowMenu,
  Select,
  StalenessChip,
  TextInput,
  TrendStat,
  useToast,
} from "../components/ui";
import type { Column, SortState } from "../components/ui";
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
import { useLabelFor, useTxnApplicability } from "../refdata/refdata-context";
import { getMaster } from "../mocks/refdata";
import { formatMoney, formatSignedMoney } from "../format/number";

// Holdings — the canonical management surface (IA §5; D-023/D-049/D-050). Owns
// management (add/edit/delete holdings, transactions, manual assets, imports,
// tags, soft-delete+undo+purge, server-side export); the value/positions header
// is a linked P-1 summary of the Portfolio reader — never recomputed here.

// Compact provenance (item 3): stale → the amber chip; fresh → a small source
// label with the full valuation label on hover. Collapses the old wide text column.
function provenanceCell(h: HoldingRow) {
  // Stale → the compact amber chip with the REAL as-of timestamp (not the label —
  // passing the label produced "Stale · as of Stale cache"). Fresh → a small
  // source label with the full label on hover.
  if (h.is_stale) return <StalenessChip isStale asOf={h.price_ts ?? ""} />;
  const label = h.valuation_label ?? "—";
  return (
    <span className="hold__src" title={label}>
      {label}
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

  // D-094 — Holdings sort/filter run CLIENT-SIDE. Acceptable because the dataset is
  // bounded (family portfolios are tens of positions; page-holdings §9-25).
  const [holdSort, setHoldSort] = useState<SortState | undefined>(undefined);
  const [holdFilter, setHoldFilter] = useState("");

  // Amendment G (page-accounts §9-11): ?account=<id> scopes the holdings table to one account via the
  // scoped reader, shown as a clearable chip. The Accounts page's "View holdings" navigates here.
  const [searchParams, setSearchParams] = useSearchParams();
  const accountParam = searchParams.get("account");
  const accountFilter = accountParam != null && accountParam !== "" ? Number(accountParam) : null;
  const clearAccountFilter = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("account");
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const labelFor = useLabelFor(); // item 3b — served display labels for enums

  const onHoldSort = useCallback((key: string) => {
    setHoldSort((s) =>
      s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }, []);

  const visibleHoldings = useMemo(() => {
    let rows = holdings;
    const q = holdFilter.trim().toLowerCase();
    if (q) {
      rows = rows.filter((h) =>
        [h.symbol, h.name, h.label, h.asset_class].some((v) =>
          (v ?? "").toString().toLowerCase().includes(q),
        ),
      );
    }
    if (holdSort) {
      const { key, dir } = holdSort;
      const sign = dir === "asc" ? 1 : -1;
      rows = [...rows].sort(
        (a, b) => cmpCell(a[key as keyof HoldingRow], b[key as keyof HoldingRow]) * sign,
      );
    }
    return rows;
  }, [holdings, holdFilter, holdSort]);

  // D-094 — the Transactions ledger is UNBOUNDED: sort/filter/paging run
  // SERVER-SIDE over the full dataset (the old 500-row silent cap is gone). Every
  // change refetches; `txnTotal` is the honest denominator for "Showing X–Y of Z".
  const [txnSort, setTxnSort] = useState<SortState>({ key: "ts", dir: "desc" });
  const [txnFilter, setTxnFilter] = useState(""); // input value (immediate)
  const [txnQuery, setTxnQuery] = useState(""); // debounced value sent to the server
  const [txnOffset, setTxnOffset] = useState(0);
  const [txnTotal, setTxnTotal] = useState(0);
  // Bump to force a ledger refetch even when sort/filter/offset are unchanged
  // (e.g. two imports in a row that both jump to "recently added").
  const [txnReloadTick, setTxnReloadTick] = useState(0);

  // Debounce the filter box → one request per pause, and reset to the first page.
  useEffect(() => {
    const id = setTimeout(() => {
      setTxnQuery(txnFilter.trim());
      setTxnOffset(0);
    }, 300);
    return () => clearTimeout(id);
  }, [txnFilter]);

  const onTxnSort = useCallback((key: string) => {
    setTxnOffset(0); // sorting the full dataset — start from the top
    setTxnSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }, []);

  const reloadTxns = useCallback(async () => {
    const t = await getTransactions({
      limit: TXN_PAGE,
      offset: txnOffset,
      sort: txnSort.key,
      dir: txnSort.dir,
      filter: txnQuery || undefined,
      accountId: accountFilter, // §14ac-3: the ONE chip scopes BOTH tables; clearing unscopes both
    });
    if (t.ok) {
      setTxns(t.data.transactions);
      setTxnTotal(t.data.total ?? t.data.transactions.length);
    }
  }, [txnOffset, txnSort, txnQuery, accountFilter]);

  const reloadCore = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [h, s, a, d] = await Promise.all([
      getHoldings(accountFilter),
      getSummary(),
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
    if (a.ok) setAccounts(a.data.accounts);
    setDeletedCount(d.ok ? d.data.total : 0);
    setLoading(false);
  }, [accountFilter]);

  // Full refresh after a mutation — both the core reads and the current txn window.
  const reload = useCallback(async () => {
    await Promise.all([reloadCore(), reloadTxns()]);
  }, [reloadCore, reloadTxns]);

  useEffect(() => {
    reloadCore();
  }, [reloadCore]);
  // §14ac-3: changing the account scope resets the ledger to page 1 (a stale offset could land on an
  // empty page under the smaller scoped total).
  useEffect(() => {
    setTxnOffset(0);
  }, [accountFilter]);
  // Refetch the ledger whenever the window (sort/filter/page) changes — server-side.
  // `txnReloadTick` forces a refetch even when the window is unchanged.
  useEffect(() => {
    reloadTxns();
  }, [reloadTxns, txnReloadTick]);

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
      // Item 3: symbol + name merged into one identity cell (symbol bold, name as
      // the secondary line) — they're near-duplicates for most rows. Frees a column.
      {
        key: "symbol", label: "Holding", sortable: true, truncate: true,
        render: (h) => (
          <span className="hold__ident">
            {/* D-098: the symbol is a direct link to its instrument-detail page;
                the row-menu Details stays as the discoverable path. */}
            {h.symbol ? (
              <Link className="hold__ident-sym hold__ident-link" to={`/instrument/${h.symbol}`}>
                {h.symbol}
              </Link>
            ) : (
              <span className="hold__ident-sym">{h.label ?? "—"}</span>
            )}
            {h.name && h.name !== h.symbol && (
              <span className="hold__ident-name">{h.name}</span>
            )}
          </span>
        ),
      },
      // Class as a compact chip, with the SERVED display label (item 3b — no raw enum).
      {
        key: "asset_class", label: "Class", sortable: true,
        render: (h) => <span className="hold__chip">{labelFor("asset_class", h.asset_class)}</span>,
      },
      { key: "quantity", label: "Position", format: "quantity", sortable: true },
      // Price dropped from the table to fit a 1366px laptop (item 2): it is "—" for
      // every manual holding, and Value is the decision figure. Price lives in the
      // row's Details (instrument page).
      { key: "market_value", label: `Value (${baseCcy})`, format: "money", sortable: true },
      { key: "unrealised_pl", label: "Unrealised P/L", format: "signed-money", sortable: true },
      { key: "day_change", label: "Today's change", format: "signed-money" },
      // Provenance collapsed to the StalenessChip + tooltip pattern (compact).
      { key: "valuation_label", label: "Source", render: provenanceCell },
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
    [baseCcy, softDeleteHolding, labelFor],
  );

  const txnColumns = useMemo<Column<TransactionRow>[]>(
    () => [
      { key: "ts", label: "Date", sortable: true, render: (t) => t.ts.slice(0, 10) },
      // Served display label for the type (item 3b — no raw enum).
      { key: "type", label: "Type", sortable: true, render: (t) => labelFor("txn_type", t.type) },
      { key: "symbol", label: "Symbol", sortable: true, render: (t) => <InstrumentLabel symbol={t.symbol} name={t.name} truncate /> },
      { key: "quantity", label: "Qty", format: "quantity", sortable: true },
      { key: "price", label: "Price", format: "price", sortable: true },
      { key: "amount", label: "Amount", format: "signed-money", sortable: true },
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
    [softDeleteTxn, labelFor],
  );

  return (
    <div className="lf-page hold">

      <PageHeaderHoldings
        onAdd={() => setAddOpen(true)}
        onImport={() => setImportOpen(true)}
        onExport={() => apiDownload("/portfolio/holdings.csv")}
      />

      {/* Value/positions header — a linked P-1 summary. The figure is net of
          liabilities, i.e. Net worth (GLOSSARY; D-021 retires "Total value").
          D-100: the summary reads as a distinct card (the tables below carry their
          own DataTable border). */}
      <div className="hold__section lf-card">
        <TrendStat
          label={`Net worth · ${holdings.length} position${holdings.length === 1 ? "" : "s"}`}
          // §14in-7 — base-currency code as the muted affix, not embedded in the value string.
          value={summary ? formatMoney(summary.total_value) : "—"}
          unit={summary ? baseCcy : undefined}
          delta={summary?.day_change}
          deltaDisplay={summary ? formatSignedMoney(summary.day_change) : undefined}
        />
        <span className="hold__sub">
          A linked summary — Net worth is canonical on <Link to="/net-worth">Net worth</Link>;
          analytics on <Link to="/portfolio">Portfolio</Link>.
        </span>
      </div>

      {/* Holdings table */}
      <div className="hold__section">
        <div className="hold__bar">
          <h2 className="hold__h2">Holdings</h2>
          {accountFilter != null && (
            <button
              type="button"
              className="hold__chip"
              onClick={clearAccountFilter}
              aria-label={`Clear account filter: ${accounts.find((a) => a.id === accountFilter)?.name ?? `account #${accountFilter}`}`}
            >
              Account: {accounts.find((a) => a.id === accountFilter)?.name ?? `#${accountFilter}`}
              <span className="hold__chipx" aria-hidden="true">×</span>
            </button>
          )}
        </div>
        {loading ? (
          <EmptyState message="Loading holdings…" reason="Fetching the latest prices." />
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
          <DataTable
            columns={holdingColumns}
            rows={visibleHoldings}
            sort={holdSort}
            onSort={onHoldSort}
            filter={{ value: holdFilter, onChange: setHoldFilter, placeholder: "Filter holdings…", ariaLabel: "Filter holdings" }}
          />
        )}
      </div>

      {/* Transactions ledger */}
      <div className="hold__section">
        <div className="hold__bar">
          <h2 className="hold__h2">Transactions</h2>
          {deletedCount > 0 && (
            // §14dr-20 — self-explaining copy (the old "Purge N deleted" was cryptic). The word
            // "Purge" carries a [Help] popover to its GLOSSARY definition (a sibling of the button,
            // never nested inside it — no button-in-button). The ConfirmDialog states exactly what
            // is destroyed and demands a fresh PIN (D-103).
            <span className="hold__purge">
              <button type="button" className="lf-btn" onClick={() => setPurgeOpen(true)}
                title="Permanently delete the trashed holdings and transactions — cannot be undone">
                Permanently delete {deletedCount} trashed…
              </button>
              <GlossaryTerm term="term-purge">
                <span className="hold__purge-help" aria-label="What does purge mean?">Purge?</span>
              </GlossaryTerm>
            </span>
          )}
        </div>
        {txnTotal === 0 && !txnQuery ? (
          <EmptyState
            message="No transactions"
            reason="Record a buy, sell, dividend, or merger from “Add”, or import a CSV."
          />
        ) : (
          <>
            <DataTable
              columns={txnColumns}
              rows={txns}
              sort={txnSort}
              onSort={onTxnSort}
              filter={{
                value: txnFilter,
                onChange: setTxnFilter,
                placeholder: "Filter transactions…",
                ariaLabel: "Filter transactions",
              }}
              // D-050 / round-trip: full-dataset server-side export whose columns
              // are exactly the import schema — this file re-imports losslessly.
              onExport={() => apiDownload("/portfolio/transactions.csv")}
            />
            {/* D-094: the window is explicit — the full total is always stated, so
                the ledger never silently truncates (the old 500-row cap). */}
            <div className="hold__pager">
              <span className="hold__sub" aria-live="polite">
                {txnTotal === 0
                  ? "No transactions match your filter."
                  : `Showing ${txnOffset + 1}–${Math.min(txnOffset + txns.length, txnTotal)} of ${txnTotal}`}
              </span>
              <span className="hold__pagerbtns">
                <button
                  type="button"
                  className="lf-btn"
                  disabled={txnOffset === 0}
                  onClick={() => setTxnOffset(Math.max(0, txnOffset - TXN_PAGE))}
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  className="lf-btn"
                  disabled={txnOffset + TXN_PAGE >= txnTotal}
                  onClick={() => setTxnOffset(txnOffset + TXN_PAGE)}
                >
                  Next →
                </button>
              </span>
            </div>
          </>
        )}
      </div>

      {addOpen && (
        <AddDialog
          accounts={accounts}
          baseCcy={baseCcy}
          onClose={() => setAddOpen(false)}
          onDone={async ({ recordedTransaction }) => {
            setAddOpen(false);
            if (recordedTransaction) {
              // §14dr-21: reveal the just-recorded transaction — a back-dated buy (common
              // for mutual funds) would otherwise sink below the most-recent-first window,
              // reading as "no transaction was recorded" even though it was. Same reveal as
              // a CSV import: sort by "recently added", jump to page 1.
              setTxnSort({ key: "added", dir: "desc" });
              setTxnOffset(0);
              setTxnReloadTick((t) => t + 1);
              await reloadCore();
              toast.show({ message: "Added — showing the recorded transaction." });
            } else {
              await reload();
              toast.show({ message: "Added." });
            }
          }}
          onError={(m) => toast.show({ message: m })}
        />
      )}

      {importOpen && (
        <ImportDialog
          onClose={() => setImportOpen(false)}
          onDone={async ({ imported, skipped }) => {
            setImportOpen(false);
            if (imported > 0) {
              // Imported rows are often historical-dated and would sink below the
              // most-recent-first window. Surface them: sort by "recently added",
              // jump to page 1, then refresh the core reads.
              setTxnSort({ key: "added", dir: "desc" });
              setTxnOffset(0);
              setTxnReloadTick((t) => t + 1);
              await reloadCore();
              const dupNote = skipped > 0 ? ` (${skipped} duplicate${skipped === 1 ? "" : "s"} skipped)` : "";
              toast.show({
                tone: "success",
                message: `Imported ${imported} transaction${imported === 1 ? "" : "s"}${dupNote} — showing most recently added.`,
              });
            } else {
              // Zero committed is never a success — say so honestly, with the why.
              const why = skipped > 0
                ? `all ${skipped} row${skipped === 1 ? " was" : "s were"} already in your ledger (duplicates)`
                : "no new valid rows to commit";
              toast.show({ tone: "warning", message: `No rows were committed — ${why}.` });
            }
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
          accounts={accounts}
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
        title="Permanently delete trashed rows?"
        message={`This permanently deletes all ${deletedCount} trashed (soft-deleted) holdings and transactions — emptying the trash. They cannot be recovered. Enter your PIN to confirm.`}
        confirmLabel="Delete permanently"
        destructive
        requirePin
        onCancel={() => setPurgeOpen(false)}
        onConfirm={async (pin) => {
          // §14dr-20 / D-103: thread the freshly-entered PIN — the server rejects an
          // ambient session (401) and only proceeds with the correct fresh PIN.
          const res = await purgeDeleted(pin ?? "");
          if (res.ok) {
            setPurgeOpen(false);
            toast.show({ message: "Trash emptied — the rows are permanently deleted." });
            reload();
          } else {
            toast.show({ message: `Couldn't delete: ${res.error}`, tone: "warning" });
          }
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
          {/* Page-action icon buttons (§11-13/§11-16): all icon-only, framed surface;
              Add uses the accent-filled variant to keep primary emphasis. */}
          <button
            type="button"
            className="lf-iconbtn lf-iconbtn--framed"
            onClick={onImport}
            title="Import"
            aria-label="Import"
          >
            <Upload aria-hidden="true" />
          </button>
          <button
            type="button"
            className="lf-iconbtn lf-iconbtn--framed"
            onClick={onExport}
            title="Export CSV"
            aria-label="Export CSV"
          >
            <Download aria-hidden="true" />
          </button>
          <button
            type="button"
            className="lf-iconbtn lf-iconbtn--primary"
            onClick={onAdd}
            title="Add"
            aria-label="Add"
          >
            <Plus aria-hidden="true" />
          </button>
        </>
      }
    />
  );
}

// Total-cash transaction types: entered as a single "Amount", not qty × price.
const AMOUNT_TYPES = ["dividend", "interest", "fee"];

// D-094 — server-side transactions window size (rows per page).
const TXN_PAGE = 100;

// D-094 — client-side cell comparator for the bounded Holdings table. Numbers
// (incl. decimal strings) compare numerically; everything else locale-string.
function cmpCell(a: unknown, b: unknown): number {
  const as = a == null ? "" : String(a);
  const bs = b == null ? "" : String(b);
  const an = Number(as);
  const bn = Number(bs);
  if (as !== "" && bs !== "" && !Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
  return as.localeCompare(bs);
}

// D-091 — per-class OPTIONAL-PROMPTED creation fields (MASTER-DATA §11). Keys match
// the backend `_META_KEYS` whitelist; only whitelisted keys are persisted. This is
// form LAYOUT (field key + kind + label), not a categorical vocabulary — the
// categorical values (currency, class) still come from /refdata.
type MetaFieldKind = "text" | "money" | "percent" | "date";
interface MetaField { key: string; label: string; kind: MetaFieldKind }
const MANUAL_META_FIELDS: Record<string, MetaField[]> = {
  fixed_deposit: [
    { key: "rate", label: "Interest rate (%)", kind: "percent" },
    { key: "maturity_date", label: "Maturity date", kind: "date" },
    { key: "start_date", label: "Start date", kind: "date" },
    { key: "issuer", label: "Issuer", kind: "text" },
  ],
  bond: [
    { key: "issuer", label: "Issuer", kind: "text" },
    { key: "coupon", label: "Coupon (%)", kind: "percent" },
    { key: "maturity_date", label: "Maturity date", kind: "date" },
    { key: "face_value", label: "Face value", kind: "money" },
  ],
  property: [
    { key: "address", label: "Address", kind: "text" },
    { key: "cost", label: "Acquisition cost", kind: "money" },     // D-091 gap closed
    { key: "valuation_date", label: "Valuation date", kind: "date" },
  ],
  retirement: [
    { key: "scheme_name", label: "Scheme name", kind: "text" },
    { key: "statement_date", label: "Statement date", kind: "date" },
  ],
  private: [
    { key: "company", label: "Company", kind: "text" },
    { key: "ownership", label: "Ownership (%)", kind: "text" },
    { key: "round", label: "Funding round", kind: "text" },        // D-091 gap closed
    { key: "valuation_date", label: "Valuation date", kind: "date" },
  ],
  cash: [{ key: "issuer", label: "Bank / issuer", kind: "text" }],
};

// D-090 — the cash-flow txn types the Manual-branch "Record transaction" sub-mode
// offers (e.g. FD interest recorded separately). buy/sell are excluded from manual
// mode — a manual holding IS the position, so its cash events are these only. The
// actual per-class subset is intersected with /refdata applicability at render.
const MANUAL_CASHFLOW = ["interest", "deposit", "withdrawal", "fee", "transfer"];

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
  // D-092 signpost — Insurance never branches this form (its own register, D-062).
  { id: "insurance", label: "Insurance", subtitle: "Policies live in their own register — we'll take you there.", branch: "manual", assetClass: "other", nav: "#/insurance" },
  // "Other" is the escape valve — it reads sensibly LAST, after Insurance.
  { id: "other", label: "Other", subtitle: "Doesn't fit — the honest escape valve.", branch: "manual", assetClass: "other" },
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
  onDone: (r: { recordedTransaction: boolean }) => void;
  onError: (msg: string) => void;
}) {
  const [tile, setTile] = useState<AssetTile | null>(null); // D-089 entry step
  const [mode, setMode] = useState<"listed" | "manual">("listed");
  // D-090 — manual branch can either add a holding or record a cash-flow txn.
  const [manualAction, setManualAction] = useState<"holding" | "txn">("holding");
  const applicability = useTxnApplicability(); // D-090 matrix from /refdata
  const [accountId, setAccountId] = useState("");
  const accountOptions = [
    { value: "", label: "— account —" },
    ...accounts.map((a) => ({ value: String(a.id), label: a.name })),
  ];

  // listed
  const [symbol, setSymbol] = useState("");
  // §14dr-16 — the display name carried from the picker (master suggestion or an existing
  // instrument), so a newly-created instrument isn't identified by its bare code.
  const [pickedName, setPickedName] = useState("");
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
  const [meta, setMeta] = useState<Record<string, string>>({}); // D-091 optional detail

  // Active asset class drives the D-090 type filter (listed = tile's class;
  // manual = the chosen manual class).
  const activeClass = tile?.assetClass ?? assetClass;
  // D-090 listed dropdown subset; undefined while applicability is still loading
  // (MasterSelect then shows the full master — no filtering, graceful).
  const listedTypes = applicability?.[activeClass];
  // D-090 manual cash-flow subset (buy/sell excluded).
  const manualTxnTypes = useMemo(
    () => (applicability?.[activeClass] ?? []).filter((t) => MANUAL_CASHFLOW.includes(t)),
    [applicability, activeClass],
  );
  const metaFields = MANUAL_META_FIELDS[activeClass] ?? [];

  // Keep `type` inside the offered set for the active branch (D-090). Excludes
  // `type` from deps so choosing an in-set value doesn't re-fire.
  useEffect(() => {
    if (!tile) return;
    const allowed = mode === "listed" ? listedTypes : manualAction === "txn" ? manualTxnTypes : undefined;
    if (allowed && allowed.length && !allowed.includes(type)) setType(allowed[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tile, mode, manualAction, listedTypes, manualTxnTypes]);

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
        // §14dr-16: persist the master's display name so a fund/coin added from its
        // master isn't identified by the bare code. Null when nothing was carried.
        name: pickedName.trim() || null,
        related_instrument_id: type === "merger" ? absorbedInto : null,
      });
      if (!res.ok) return onError(`Couldn't add transaction: ${res.error}`);
    } else if (manualAction === "txn") {
      // D-090 Manual-branch transaction path: a cash-flow event (interest,
      // deposit, withdrawal, fee, transfer) recorded separately against the
      // account — instrument-less, single Amount. Engine unchanged: it stores
      // amount = qty(1) × price(amount); _txn_cash_impact signs it per type.
      const res = await addTransaction({
        account_id: accountId ? Number(accountId) : null,
        symbol: null,
        type,
        ts: `${date}T00:00:00`,
        quantity: 1,
        price: Number(price), // `price` state holds the Amount here
        currency,
      });
      if (!res.ok) return onError(`Couldn't record transaction: ${res.error}`);
    } else {
      if (!label.trim()) return onError("A manual asset needs a label.");
      // D-091: only non-empty whitelisted detail is sent; the backend drops the rest.
      const cleanMeta = Object.fromEntries(
        Object.entries(meta).filter(([, v]) => v != null && v !== ""),
      );
      const res = await addManualHolding({
        account_id: accountId ? Number(accountId) : null,
        label: label.trim(),
        asset_class: assetClass,
        value: Number(value),
        currency,
        ...(Object.keys(cleanMeta).length ? { meta: cleanMeta } : {}),
      });
      if (!res.ok) return onError(`Couldn't add manual asset: ${res.error}`);
    }
    // §14dr-21: a listed add (any class — MF, crypto, equity) and a manual cash-flow
    // txn BOTH record a transaction; a manual-holding add does not. Tell the parent so
    // it can reveal the just-added row in the ledger (a back-dated buy would otherwise
    // sink below the most-recent-first window — the finding-#8 reveal, applied to Adds).
    onDone({ recordedTransaction: mode === "listed" || manualAction === "txn" });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={tile === null ? "What are you adding?" : "Add to holdings"}
      size={tile === null ? "md" : "lg"}
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
                setManualAction("holding"); // D-090: default to adding the holding
                setMeta({}); // D-091: fresh optional-detail per type
                if (t.branch === "manual") setAssetClass(t.assetClass);
              }}
            >
              <span className="hold__tile-title">{t.label}{t.nav ? " →" : ""}</span>
              <span className="hold__tile-sub">{t.subtitle}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="hold__form hold__form--grid">
          <div className="hold__chosen">
            <button
              type="button"
              className="hold__linkbtn"
              onClick={() => { setTile(null); setManualAction("holding"); setMeta({}); }}
            >
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
                assetClass={activeClass}
                onSelect={(p) => {
                  if (p.kind === "create") {
                    setSymbol(p.query);
                    setPickedName(p.name ?? ""); // §14dr-16 — carry the master's name
                  } else {
                    setSymbol(p.instrument.symbol);
                    setPickedName(p.instrument.name ?? "");
                  }
                }}
              />
            </div>
            <div className="hold__field hold__field--full">
              <span className="hold__label">Type</span>
              {/* D-090: only the types this asset class offers (from /refdata). */}
              <MasterSelect master="txn_type" value={type} onChange={setType} include={listedTypes} />
            </div>
            {type === "merger" ? (
              <>
                <div className="hold__field hold__field--full">
                  <span className="hold__label">Absorbed into (target instrument)</span>
                  <InstrumentPicker
                    allowCreate={false}
                    assetClass={activeClass}
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
              <div className="hold__field hold__field--full">
                <span className="hold__label">Split ratio (e.g. 2 for a 2:1 split)</span>
                <QuantityInput value={price} onChange={setPrice} aria-label="Split ratio" />
              </div>
            ) : type === "bonus" ? (
              // §4.3: bonus adds shares at ZERO cost — units only, no price field.
              <div className="hold__field hold__field--full">
                <span className="hold__label">Bonus units (extra shares, zero cost)</span>
                <QuantityInput value={qty} onChange={setQty} aria-label="Bonus units" />
              </div>
            ) : AMOUNT_TYPES.includes(type) ? (
              // Dividend / interest / fee are total-cash: a single Amount, no
              // quantity or per-share price (statements_report; compute_fifo).
              <div className="hold__field hold__field--full">
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
            {/* D-090: for cash-flow classes, choose whether to add the holding or
                record a separate cash-flow transaction (e.g. FD interest). */}
            {manualTxnTypes.length > 0 && (
              <div className="hold__field hold__field--full">
                <span className="hold__label">Record</span>
                <Select
                  value={manualAction}
                  onChange={(v) => setManualAction(v as "holding" | "txn")}
                  options={[
                    { value: "holding", label: "A holding (a value you track)" },
                    { value: "txn", label: "A transaction (interest, deposit, fee…)" },
                  ]}
                  aria-label="Record"
                />
              </div>
            )}
            {manualAction === "txn" ? (
              <>
                <div className="hold__field hold__field--full">
                  <span className="hold__label">Type</span>
                  {/* D-090: only the cash-flow types this class offers (from /refdata). */}
                  <MasterSelect master="txn_type" value={type} onChange={setType} include={manualTxnTypes} />
                </div>
                <div className="hold__field hold__field--full">
                  <span className="hold__label">Amount</span>
                  <MoneyInput value={price} currency={currency} onChange={setPrice} aria-label="Amount" />
                  <span className="hold__sub">
                    Recorded separately against the account — the holding’s value is
                    unchanged (e.g. FD interest, D-090). No engine change.
                  </span>
                </div>
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
                <div className="hold__field hold__field--full">
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
                {/* D-091 per-class OPTIONAL-PROMPTED detail — never required. */}
                {metaFields.map((f) => (
                  <div className="hold__field" key={f.key}>
                    <span className="hold__label">{f.label}</span>
                    <MetaFieldInput
                      field={f}
                      value={meta[f.key] ?? ""}
                      currency={currency}
                      onChange={(v) => setMeta((m) => ({ ...m, [f.key]: v }))}
                    />
                  </div>
                ))}
                {metaFields.length > 0 && (
                  <span className="hold__sub">
                    Optional — fill what you have. Missing details never block
                    saving; they surface as a low-priority review note (D-091).
                  </span>
                )}
              </>
            )}
          </>
        )}
        </div>
      )}
    </Dialog>
  );
}

// Renders the right ratified input for a D-091 optional-detail field by kind.
function MetaFieldInput({
  field,
  value,
  currency,
  onChange,
}: {
  field: MetaField;
  value: string;
  currency: string;
  onChange: (v: string) => void;
}) {
  switch (field.kind) {
    case "money":
      return <MoneyInput value={value} currency={currency} onChange={onChange} aria-label={field.label} />;
    case "percent":
      return <PercentInput value={value} onChange={onChange} aria-label={field.label} />;
    case "date":
      return <DateInput value={value} onChange={onChange} aria-label={field.label} />;
    default:
      return <TextInput value={value} onChange={onChange} aria-label={field.label} />;
  }
}

// --- Edit an existing transaction (row action → PUT /transactions/{id}) --------
function TxnEditDialog({
  txn,
  accounts,
  onClose,
  onDone,
  onError,
}: {
  txn: TransactionRow;
  accounts: AccountRow[];
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
  // §14dr-11 — Account is editable in the edit flow (parity with add); re-scoping moves the
  // transaction between account-scoped views and recomputes BOTH accounts' derived holdings
  // (backend rebuild). Prefill from the served account_id; "" = no account (the add-flow bucket).
  const [accountId, setAccountId] = useState(txn.account_id != null ? String(txn.account_id) : "");
  const accountOptions = [
    { value: "", label: "— account —" },
    ...accounts.map((a) => ({ value: String(a.id), label: a.name })),
  ];

  async function save() {
    const res = await updateTransaction(txn.id, {
      symbol: symbol.trim() ? symbol.trim().toUpperCase() : null,
      type,
      ts: `${date}T00:00:00`,
      quantity: Number(qty),
      price: Number(price),
      currency,
      note: note.trim() || null,
      account_id: accountId ? Number(accountId) : null,
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
          <span className="hold__label">Account</span>
          <Select value={accountId} onChange={setAccountId} options={accountOptions} aria-label="Account" />
        </div>
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
  onDone: (r: { imported: number; skipped: number }) => void;
  onError: (msg: string) => void;
}) {
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function doPreview(f: File) {
    setBusy(true);
    setFormatError(null);
    const res = await importPreview(f);
    setBusy(false);
    if (!res.ok) return onError(`Preview failed: ${res.error}`);
    // Wrong-format file (e.g. a holdings snapshot) → one honest banner, no grid.
    if (res.data.format_error) {
      setFormatError(res.data.format_error);
      return;
    }
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
    onDone({
      imported: res.data.imported ?? 0,
      skipped: res.data.skipped_duplicates ?? 0,
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Import transactions (CSV)"
      size="xl"
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
          <div className="imp__actions">
            <FileInput accept=".csv" aria-label="Import CSV" label="Choose CSV" onChange={(fs) => doPreview(fs[0])} />
            {/* D-096: a sample CSV generated from the D-090 matrix (one example row
                per asset-class × permitted type), server-side. */}
            <button type="button" className="lf-btn" onClick={() => apiDownload("/portfolio/import/template")}>
              Download template
            </button>
          </div>
          {formatError ? (
            <EmptyState message="That file isn’t a transactions ledger" reason={formatError} />
          ) : (
            <span className="hold__sub">
              Nothing is written until you review. Fix or exclude flagged rows first.
              Exported transaction files re-import cleanly.
            </span>
          )}
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
