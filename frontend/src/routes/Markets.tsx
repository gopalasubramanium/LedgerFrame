import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "./Markets.css";
import {
  ConfirmDialog,
  DataTable,
  Dialog,
  EmptyState,
  GlossaryTerm,
  InstrumentPicker,
  PageHeader,
  RowMenu,
  Skeleton,
  StalenessChip,
  TextInput,
  useToast,
} from "../components/ui";
import type { Column, InstrumentPick, SortState } from "../components/ui";
import { useLabelFor } from "../refdata/refdata-context";
import { Plus } from "../icons";
import { formatPrice, formatSignedPercent, signOf } from "../format/number";
import {
  addWatchlistItem,
  createWatchlist,
  deleteWatchlist,
  getMarketsGlobal,
  getMarketsOverview,
  getMarketsSearch,
  getWatchlists,
  removeWatchlistItem,
} from "../api/markets";
import type {
  GlobalResp,
  MarketStatus,
  OverviewInstrument,
  OverviewResp,
  SearchHit,
  ServedQuote,
  WatchlistT,
} from "../api/markets";

// Markets (Markets-group home) — IA §5, D-037/D-034/D-051/D-052/D-042. Canonical home for quotes,
// indices, market status, Gainers/Losers, the instrument grid, the Global tab, and watchlist
// management. An overview + worklist HYBRID (ND-3): a market-status/indices/Gainers-Losers header
// over an instrument-grid + watchlists body. Every figure is a SERVED display value (P-1/D-031) —
// the page performs no money math (ranking Gainers/Losers is a display SORT of served `change_pct`).

const N = 5; // Gainers/Losers list length (ND-1).

function numOf(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

// The value's as-of time for the staleness chip: the market timestamp if present, else received.
const asOfOf = (q: ServedQuote): string => q.market_time ?? q.received_at ?? "";

// Market state → a display label + tone (never the raw enum key `pre-market` in a user string).
const STATE_LABEL: Record<string, string> = {
  open: "Open",
  closed: "Closed",
  "pre-market": "Pre-market",
  "post-market": "Post-market",
  unknown: "Unknown",
};
function stateTone(state: string): "ok" | "neutral" | "warn" {
  if (state === "open") return "ok";
  if (state === "pre-market" || state === "post-market") return "warn";
  return "neutral"; // closed / unknown
}

// Global groups that are NOT stock-index groups: their items ARE the asset (GLD/BTC), never an ETF
// proxy standing in for an index — so the D-051 proxy badge never applies to them.
const NON_INDEX_REGIONS = new Set(["Commodities", "Crypto"]);
// D-051 / ND-6 (protected honesty): a Global index shown VIA a liquid ETF proxy — not the real index
// level — is labelled as such, never passed off as the index. It's a proxy when the group is an
// index group and the SERVED symbol is a plain ticker (not a `^INDEX`). The proxy is then named.
function proxyOf(region: string, symbol: string): string | null {
  if (NON_INDEX_REGIONS.has(region)) return null;
  return symbol.startsWith("^") ? null : symbol;
}

// The instrument grid's flat row (ND-2: search + column sort, no region filter). Numeric price /
// change let the column sort order served values without any money math.
interface GridRow {
  symbol: string;
  name: string;
  asset_class: string;
  country: string | null;
  currency: string;
  price: number | null;
  change_pct: number | null;
  held: boolean;
  is_stale: boolean;
  as_of: string;
}

export function Markets() {
  const labelFor = useLabelFor();
  const toast = useToast();

  // Per-card progressive loading: `undefined` = loading (Skeleton), `null` = reader failed (honest
  // error), value = loaded. Each section resolves on its own reader.
  const [overview, setOverview] = useState<OverviewResp | null>();
  const [global, setGlobal] = useState<GlobalResp | null>();
  const [watchlists, setWatchlists] = useState<WatchlistT[] | null>();

  const [region, setRegion] = useState<string | null>(null); // active Global region tab
  const [gridSort, setGridSort] = useState<SortState>({ key: "change_pct", dir: "desc" });
  const [gridFilter, setGridFilter] = useState("");

  const [creating, setCreating] = useState(false); // new-watchlist dialog
  const [newName, setNewName] = useState("");
  const [deleting, setDeleting] = useState<WatchlistT | null>(null); // delete-list confirm

  // Page-level symbol search (ND-5, §12mk1-5) → the served /markets/search provider search. `null`
  // = no query yet; `[]` = queried, no hits. Distinct from the grid's client filter below.
  const [searchQ, setSearchQ] = useState("");
  const [results, setResults] = useState<SearchHit[] | null>(null);
  useEffect(() => {
    const q = searchQ.trim();
    if (!q) {
      setResults(null);
      return;
    }
    let live = true;
    const t = setTimeout(async () => {
      const r = await getMarketsSearch(q);
      if (live) setResults(r.ok ? r.data.results : []);
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [searchQ]);

  const reloadWatchlists = useCallback(() => {
    setWatchlists(undefined);
    getWatchlists().then((r) => setWatchlists(r.ok ? r.data.watchlists : null));
  }, []);

  const reload = useCallback(() => {
    setOverview(undefined);
    setGlobal(undefined);
    getMarketsOverview().then((r) => setOverview(r.ok ? r.data : null));
    getMarketsGlobal().then((r) => setGlobal(r.ok ? r.data : null));
    reloadWatchlists();
  }, [reloadWatchlists]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Default the region tab to the first SERVED group once Global loads (no client region model, ND-2).
  useEffect(() => {
    if (global && region === null && global.groups.length > 0) setRegion(global.groups[0].region);
  }, [global, region]);

  // Gainers / Losers — a DISPLAY SORT of the served overview `change_pct` over the full served grid
  // (ND-1). Gainers = top N gains; Losers = bottom N declines, shown ONLY where change_pct < 0 (never
  // a "loser" that rose). No money math — this orders served values.
  const { gainers, losers } = useMemo(() => {
    const rows = (overview?.instruments ?? [])
      .map((it) => ({ it, pct: numOf(it.quote.change_pct) }))
      .filter((r): r is { it: OverviewInstrument; pct: number } => r.pct !== null);
    return {
      gainers: rows.filter((r) => r.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, N).map((r) => r.it),
      losers: rows.filter((r) => r.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, N).map((r) => r.it),
    };
  }, [overview]);

  // Instrument grid rows (flattened) + client-side filter + sort (bounded served set).
  const gridRows = useMemo<GridRow[]>(() => {
    const rows: GridRow[] = (overview?.instruments ?? []).map((it) => ({
      symbol: it.symbol,
      name: it.name,
      asset_class: it.asset_class,
      country: it.country,
      currency: it.quote.currency,
      price: numOf(it.quote.price),
      change_pct: numOf(it.quote.change_pct),
      held: it.held,
      is_stale: it.quote.is_stale,
      as_of: asOfOf(it.quote),
    }));
    const q = gridFilter.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) =>
          [r.symbol, r.name, r.asset_class, r.country].some((v) => (v ?? "").toLowerCase().includes(q)),
        )
      : rows;
    const dir = gridSort.dir === "asc" ? 1 : -1;
    const key = gridSort.key as keyof GridRow;
    return [...filtered].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [overview, gridFilter, gridSort]);

  const onSortGrid = (key: string) =>
    setGridSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));

  const gridColumns: Column<GridRow>[] = [
    {
      key: "symbol",
      label: "Instrument",
      sortable: true,
      render: (r) => (
        <span className="mk__ident">
          <Link to={`/instrument/${encodeURIComponent(r.symbol)}`} className="mk__identsym">{r.symbol}</Link>
          <span className="mk__identname">{r.name}</span>
          {r.held && <span className="mk__held" title="You hold this">Held</span>}
        </span>
      ),
    },
    { key: "asset_class", label: "Class", sortable: true, render: (r) => labelFor("asset_class", r.asset_class) },
    { key: "country", label: "Country", sortable: true, render: (r) => r.country ?? "—" },
    { key: "price", label: "Price", align: "right", sortable: true, render: (r) => `${r.currency} ${formatPrice(r.price)}` },
    {
      key: "change_pct",
      label: "Change",
      align: "right",
      sortable: true,
      render: (r) => (
        <span className="mk__changecell">
          <span className={`mk__chg lf-chg--${signOf(r.change_pct)}`}>{formatSignedPercent(r.change_pct)}</span>
          <StalenessChip isStale={r.is_stale} asOf={r.as_of} />
        </span>
      ),
    },
  ];

  // Watchlist mutations — Markets owns them (D-052); each is require_auth (session [S], ND-4). No
  // rename (no endpoint — ND-4 DECLINED). No no-egress guard: these are local DB writes, not egress.
  const onAdd = useCallback(
    async (wlId: number, pick: InstrumentPick) => {
      const symbol = pick.kind === "existing" ? pick.instrument.symbol : pick.query;
      const r = await addWatchlistItem(wlId, symbol);
      if (r.ok) {
        toast.show({ message: `Added ${symbol}.` });
        reloadWatchlists();
      } else {
        toast.show({ message: `Couldn't add ${symbol}: ${r.error}`, tone: "warning" });
      }
    },
    [toast, reloadWatchlists],
  );

  const onRemove = useCallback(
    async (wlId: number, symbol: string) => {
      const r = await removeWatchlistItem(wlId, symbol);
      if (r.ok) {
        toast.show({ message: `Removed ${symbol}.` });
        reloadWatchlists();
      } else {
        toast.show({ message: `Couldn't remove ${symbol}: ${r.error}`, tone: "warning" });
      }
    },
    [toast, reloadWatchlists],
  );

  const onCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    const r = await createWatchlist(name);
    if (r.ok) {
      toast.show({ message: `Created “${name}”.` });
      setCreating(false);
      setNewName("");
      reloadWatchlists();
    } else {
      toast.show({ message: `Couldn't create the list: ${r.error}`, tone: "warning" });
    }
  }, [newName, toast, reloadWatchlists]);

  const onDelete = useCallback(async () => {
    if (!deleting) return;
    const r = await deleteWatchlist(deleting.id);
    if (r.ok) {
      toast.show({ message: `Deleted “${deleting.name}”.` });
      setDeleting(null);
      reloadWatchlists();
    } else {
      toast.show({ message: `Couldn't delete the list: ${r.error}`, tone: "warning" });
    }
  }, [deleting, toast, reloadWatchlists]);

  const status: MarketStatus | undefined = overview?.market_status ?? global?.market_status;
  const activeGroup = global?.groups.find((g) => g.region === region) ?? global?.groups[0];

  return (
    <div className="mk">
      <PageHeader
        title="Markets"
        subtitle="Quotes, indices, market status, Gainers / Losers, the instrument grid, the Global tab, and watchlists"
        actions={
          <button
            type="button"
            className="lf-iconbtn lf-iconbtn--framed"
            onClick={() => { setNewName(""); setCreating(true); }}
            title="New watchlist"
            aria-label="New watchlist"
          >
            <Plus aria-hidden="true" />
          </button>
        }
      />

      {status && (
        <p className="mk__statusline" role="status">
          <span className={`mk__pill mk__pill--${stateTone(status.state)}`}>
            <span className="mk__pilldot" aria-hidden="true">●</span>
            {status.market} · {STATE_LABEL[status.state] ?? status.state}
          </span>
        </p>
      )}

      {/* Page-level symbol search (D-037, ND-5) — the served provider search over ANY symbol (finds
          instruments not in the grid); a hit opens its InstrumentDetail page. The grid below has its
          own client-side filter for narrowing already-served rows — the two are distinct. */}
      <section className="mk__card lf-card" data-card="search">
        <h2 className="mk__h2">Find a symbol</h2>
        <div className="lf-card__body">
          <TextInput value={searchQ} onChange={setSearchQ} placeholder="Search any symbol or name…" aria-label="Search markets" />
          {results !== null &&
            (results.length > 0 ? (
              <ul className="mk__searchresults">
                {results.map((r) => (
                  <li key={`${r.symbol}-${r.exchange ?? ""}`} className="mk__searchrow">
                    <Link to={`/instrument/${encodeURIComponent(r.symbol)}`} className="mk__searchsym">{r.symbol}</Link>
                    <span className="mk__searchname">{r.name ?? ""}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState message="No matches" reason="No served hits for that query." />
            ))}
        </div>
      </section>

      {/* ── Overview header: Global indices (region tabs) + Gainers / Losers ───────────────── */}

      {/* Global tab (D-042/D-051): world indices by SERVED region, rendered as segmented-button tabs
          over the Global groups (ND-2 — no client region model). Each proxy-sourced index is badged
          (ND-6). Absorbs the removed /global page's job (no redirect, D-042). */}
      <section className="mk__card lf-card" data-card="global">
        <div className="mk__cardhead">
          <h2 className="mk__h2">Global — world indices</h2>
          {global && activeGroup && (
            <div className="mk__seg" role="group" aria-label="Region">
              {global.groups.map((g) => (
                <button
                  key={g.region}
                  type="button"
                  className={`mk__segbtn${g.region === activeGroup.region ? " mk__segbtn--on" : ""}`}
                  aria-pressed={g.region === activeGroup.region}
                  onClick={() => setRegion(g.region)}
                >
                  {g.region}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="lf-card__body">
          <CardBody data={global} lines={4} onRetry={reload}>
            {(g) => {
              const grp = g.groups.find((x) => x.region === region) ?? g.groups[0];
              return grp ? (
                <>
                  <ul className="mk__idxrows">
                    {grp.items.map((it) => {
                      const pxy = proxyOf(grp.region, it.symbol);
                      const sign = signOf(it.quote.change_pct);
                      return (
                        <li className="mk__idxrow" key={it.symbol + it.label}>
                          <span className="mk__idxlabel">
                            {it.label}
                            {pxy && (
                              <span className="mk__proxy" title={`Shown via the ${pxy} ETF proxy — not the real index level`}>
                                — via {pxy} proxy
                              </span>
                            )}
                          </span>
                          <span className="mk__idxright">
                            <span className="mk__idxprice">{it.quote.currency} {formatPrice(it.quote.price)}</span>
                            <span className={`mk__chg lf-chg--${sign}`}>{formatSignedPercent(it.quote.change_pct)}</span>
                            <StalenessChip isStale={it.quote.is_stale} asOf={asOfOf(it.quote)} />
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mk__note">
                    {g.real_indices
                      ? "Real index levels where your provider serves them; any ETF proxy is labelled per row."
                      : "World indices shown via liquid ETF proxies (labelled per row) — your provider doesn't serve raw index levels. Never passed off as the index."}
                  </p>
                </>
              ) : (
                <EmptyState message="No indices" reason="The Global reader returned no index groups." />
              );
            }}
          </CardBody>
        </div>
      </section>

      {/* Gainers / Losers (D-024/D-034) — price-move lists, NEVER Contributors/Detractors (Portfolio's
          pair). A display sort of the served overview change_pct (ND-1). */}
      <section className="mk__card lf-card" data-card="movers">
        <h2 className="mk__h2">
          <GlossaryTerm term="term-gainers-losers">Gainers / Losers</GlossaryTerm>
          <span className="mk__h2sub"> — today's price moves</span>
        </h2>
        <div className="lf-card__body">
          <CardBody data={overview} onRetry={reload}>
            {() => (
              <div className="mk__movers">
                <MoveList title="Gainers" rows={gainers} emptyReason="Nothing gained today." />
                <MoveList title="Losers" rows={losers} emptyReason="Nothing declined today." />
              </div>
            )}
          </CardBody>
        </div>
      </section>

      {/* ── Worklist body: the instrument grid + watchlists ───────────────────────────────── */}

      {/* Instrument grid (D-037) — served instruments with quotes + a Held badge; search + column
          sort (ND-2), freshness flagged; no region filter, no money math. */}
      <section className="mk__card lf-card" data-card="grid">
        <h2 className="mk__h2">Instruments</h2>
        <div className="lf-card__body">
          <CardBody data={overview} lines={6} onRetry={reload}>
            {(o) =>
              o.instruments.length > 0 ? (
                <DataTable
                  columns={gridColumns}
                  rows={gridRows}
                  sort={gridSort}
                  onSort={onSortGrid}
                  filter={{ value: gridFilter, onChange: setGridFilter, placeholder: "Search instruments…", ariaLabel: "Search instruments" }}
                  caption="Market instruments with quotes"
                  stickyHeader
                />
              ) : (
                <EmptyState message="No instruments" reason="The markets reader returned no instruments." />
              )
            }
          </CardBody>
        </div>
      </section>

      {/* Watchlist management (D-052) — ONLY here. Multi-list panel; add via the class-aware picker;
          remove via RowMenu; create (Dialog + TextInput) / delete (ConfirmDialog); all [S]-gated. */}
      <section className="mk__card lf-card" data-card="watchlists">
        <div className="mk__cardhead">
          <h2 className="mk__h2">Watchlists</h2>
          <button type="button" className="lf-btn" onClick={() => { setNewName(""); setCreating(true); }}>
            New watchlist
          </button>
        </div>
        <div className="lf-card__body">
          <CardBody data={watchlists} lines={4} onRetry={reloadWatchlists}>
            {(lists) =>
              lists.length > 0 ? (
                <div className="mk__wlpanel">
                  {lists.map((wl) => (
                    <WatchlistCard
                      key={wl.id}
                      wl={wl}
                      onAdd={(pick) => onAdd(wl.id, pick)}
                      onRemove={(sym) => onRemove(wl.id, sym)}
                      onDelete={() => setDeleting(wl)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  message="No watchlists yet"
                  reason="Create a list to track symbols — quotes are served, never fabricated."
                  action={<button type="button" className="lf-btn lf-btn--primary" onClick={() => { setNewName(""); setCreating(true); }}>New watchlist</button>}
                />
              )
            }
          </CardBody>
        </div>
      </section>

      {/* Sibling Markets-group signposts (D-051/D-053, ND-11): link out, never embed/duplicate. */}
      <p className="mk__signposts">
        <Link to="/heatmap">Heatmap ↗</Link>
        <span aria-hidden="true"> · </span>
        <Link to="/news">Market news ↗</Link>
      </p>

      {/* New-watchlist dialog — a name is required (POST /watchlists), so a Dialog + TextInput (the
          same primitive ConfirmDialog wraps); the create itself is [S]-gated server-side. */}
      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="New watchlist"
        footer={
          <>
            <button type="button" className="lf-btn" onClick={() => setCreating(false)}>Cancel</button>
            <button type="button" className="lf-btn lf-btn--primary" disabled={!newName.trim()} onClick={onCreate}>Create</button>
          </>
        }
      >
        <p className="mk__note">Name your list. You can add symbols to it once it exists.</p>
        <TextInput value={newName} onChange={setNewName} placeholder="e.g. Tech watch" maxLength={80} onEnter={onCreate} aria-label="Watchlist name" />
      </Dialog>

      {/* Delete-list confirm — destructive; session [S] gate (D-069), no fresh PIN (not a purge, D-103). */}
      <ConfirmDialog
        open={!!deleting}
        title="Delete watchlist"
        message={deleting ? `Delete “${deleting.name}” and its ${deleting.items.length} item${deleting.items.length === 1 ? "" : "s"}? This can't be undone.` : ""}
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={onDelete}
      />
    </div>
  );
}

function MoveList({ title, rows, emptyReason }: { title: string; rows: OverviewInstrument[]; emptyReason: string }) {
  return (
    <div className="mk__movelist">
      <h3 className="mk__h3">{title}</h3>
      {rows.length > 0 ? (
        <ul className="mk__moverows">
          {rows.map((it) => {
            const sign = signOf(it.quote.change_pct);
            return (
              <li key={it.symbol} className="mk__moverow">
                <span className="mk__movesym">
                  <Link to={`/instrument/${encodeURIComponent(it.symbol)}`}>{it.symbol}</Link>
                </span>
                <span className="mk__moveright">
                  <span className="mk__moveprice">{it.quote.currency} {formatPrice(it.quote.price)}</span>
                  <span className={`mk__chg lf-chg--${sign}`}>{formatSignedPercent(it.quote.change_pct)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState message="Nothing here" reason={emptyReason} />
      )}
    </div>
  );
}

interface WlRow {
  symbol: string;
  name: string;
  currency: string;
  price: number | null;
  change_pct: number | null;
  is_stale: boolean;
  as_of: string;
}

function WatchlistCard({
  wl,
  onAdd,
  onRemove,
  onDelete,
}: {
  wl: WatchlistT;
  onAdd: (pick: InstrumentPick) => void;
  onRemove: (symbol: string) => void;
  onDelete: () => void;
}) {
  const rows: WlRow[] = wl.items.map((it) => ({
    symbol: it.symbol,
    name: it.name,
    currency: it.quote.currency,
    price: numOf(it.quote.price),
    change_pct: numOf(it.quote.change_pct),
    is_stale: it.quote.is_stale,
    as_of: asOfOf(it.quote),
  }));

  const columns: Column<WlRow>[] = [
    {
      key: "symbol",
      label: "Symbol",
      render: (r) => (
        <span className="mk__ident">
          <Link to={`/instrument/${encodeURIComponent(r.symbol)}`} className="mk__identsym">{r.symbol}</Link>
          <span className="mk__identname">{r.name}</span>
        </span>
      ),
    },
    { key: "price", label: "Price", align: "right", render: (r) => `${r.currency} ${formatPrice(r.price)}` },
    {
      key: "change_pct",
      label: "Change",
      align: "right",
      render: (r) => (
        <span className="mk__changecell">
          <span className={`mk__chg lf-chg--${signOf(r.change_pct)}`}>{formatSignedPercent(r.change_pct)}</span>
          <StalenessChip isStale={r.is_stale} asOf={r.as_of} />
        </span>
      ),
    },
    {
      key: "is_stale", // distinct column key (unused elsewhere) so React th/td keys don't collide
      label: "",
      render: (r) => (
        <RowMenu
          aria-label={`Actions for ${r.symbol}`}
          items={[
            { label: "Open", onClick: () => { window.location.hash = `#/instrument/${encodeURIComponent(r.symbol)}`; } },
            { label: "Remove", danger: true, onClick: () => onRemove(r.symbol) },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="mk__wlcard lf-card__body">
      <div className="mk__wlhead">
        <h3 className="mk__h3">{wl.name}</h3>
        <RowMenu aria-label={`Actions for ${wl.name}`} items={[{ label: "Delete list", danger: true, onClick: onDelete }]} />
      </div>
      <div className="mk__wladd">
        <InstrumentPicker onSelect={onAdd} allowCreate />
      </div>
      {rows.length > 0 ? (
        <DataTable columns={columns} rows={rows} caption={`${wl.name} items`} stickyHeader={false} />
      ) : (
        <EmptyState message="Empty list" reason="Search a symbol above to add it." />
      )}
    </div>
  );
}

// Per-card loading wrapper: undefined → Skeleton, null → honest error (+ retry), value → content.
function CardBody<T>({
  data,
  lines = 4,
  onRetry,
  children,
}: {
  data: T | null | undefined;
  lines?: number;
  onRetry?: () => void;
  children: (d: T) => ReactNode;
}) {
  if (data === undefined) return <Skeleton lines={lines} />;
  if (data === null)
    return (
      <EmptyState
        message="Couldn't load this section"
        reason="The reader is unreachable — values are withheld, never guessed."
        action={onRetry ? <button type="button" className="lf-btn" onClick={onRetry}>Retry</button> : undefined}
      />
    );
  return <>{children(data)}</>;
}
