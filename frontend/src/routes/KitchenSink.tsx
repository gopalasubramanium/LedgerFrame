import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import "./KitchenSink.css";
import { DisplayControls } from "../components/DisplayControls";
import { TokenBoard } from "./TokenBoard";
import { HomeMockupFull } from "./HomeMockup";
import {
  AllocationDonut,
  Clock,
  Combobox,
  ConfirmDialog,
  DataTable,
  DateInput,
  DemoBadge,
  Dialog,
  FirstRunChecklist,
  Switch,
  EmptyState,
  FileInput,
  GlossaryTerm,
  InstrumentPicker,
  LockScreen,
  MasterSelect,
  MetaStrip,
  NewsList,
  MoneyInput,
  PageHeader,
  PercentInput,
  PriceChart,
  ProvenanceBadge,
  QuantityInput,
  QuoteCardRow,
  ReviewCard,
  SummaryHead,
  Select,
  Sidebar,
  Skeleton,
  StaleBanner,
  StalenessChip,
  StatusChip,
  TextInput,
  TickerStrip,
  TopBar,
  Treemap,
  TrendStat,
  UpdateBanner,
  useToast,
} from "../components/ui";
import type { Column, QuoteSource, SortState } from "../components/ui";
import {
  ALLOCATION_BY_CLASS,
  ALLOCATION_BY_SECTOR,
  BENCHMARK_SERIES,
  HOLDINGS,
  PRICE_SERIES,
  PROV_EOD,
  PROV_FRESH,
  PROV_MANUAL,
  PROV_STALE,
  PROV_UNAVAILABLE,
  QUOTES,
  TREEMAP_NODES,
  TREEMAP_READOUT_NODES,
  TREEMAP_SCALE_SAMPLES,
} from "../mocks/fixtures";
import type { Holding, Provenance } from "../mocks/types";
import {
  formatMoney,
  formatSignedMoney,
  formatSignedPercent,
} from "../format/number";
import {
  Sun, Moon, Monitor, Rows2, Rows4, Contrast, Circle, Disc, Waves, Minus, Wind,
  RotateCw, Ban, Menu, MoreHorizontal, Pencil, Upload, Download, Plus,
} from "../icons";

// First-run checklist demo options (Phase 0a specimens).
const TZ_OPTIONS = (
  (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.(
    "timeZone",
  ) ?? ["UTC", "Asia/Singapore", "America/New_York", "Europe/London"]
).map((z) => ({ label: z, value: z }));
const PROVIDER_OPTIONS = ["mock", "csv", "alphavantage", "yahoo", "eodhd", "kite"].map((p) => ({
  label: p,
  value: p,
}));
const FIRST_RUN_LINKS = {
  general: "/settings",
  security: "/settings",
  prices: "/settings",
  privacy: "/settings",
};

// QuoteCardRow specimen — the row's own item shape (page-home Phase 1): only the fields it renders.
const QUOTE_CARDS = QUOTES.map((q, i) => ({
  symbol: q.symbol,
  name: q.name,
  price: q.price,
  changePct: q.changePct,
  currency: q.currency,
  isStale: i === 1,
  asOf: q.provenance.asOf,
}));

// Ticker demo: holdings LINK to instrument detail (D-098); the two indices are unlinked.
const TICKER_DEMO = [
  ...QUOTES.map((q, i) => ({
    symbol: q.symbol,
    priceDisplay: q.price == null ? null : String(q.price), // D-105: backend-formatted display string
    changePct: q.changePct,
    stale: i === 1,
    href: `/instrument/${q.symbol}`,
  })),
  { symbol: "US · S&P 500", priceDisplay: "5,000.00", changePct: "0.42" },
  { symbol: "India · Nifty 50", priceDisplay: "24,500.00", changePct: "-0.18" },
];

const NEWS_DEMO = [
  { headline: "Markets steady as investors weigh rate expectations and a long headline that must clamp to two lines with an ellipsis rather than overflow the card width", source: "BBC Business", url: "https://example.com/a", published_at: new Date(Date.now() - 2 * 3600_000).toISOString(), symbols: ["AAPL", "MSFT"] },
  { headline: "Rupee firms against the dollar on strong inflows", source: "Reuters", url: "https://example.com/b", published_at: new Date(Date.now() - 26 * 3600_000).toISOString(), symbols: [] },
  { headline: "Headline with no link renders as inert plain text <b>not bold</b>", source: "Feed", url: null, published_at: new Date(Date.now() - 90 * 60_000).toISOString() },
];

// Every bar icon (lucide, ADR-0003) for the ratification row — all states shown.
const BAR_ICONS = [
  { label: "Theme: Light", Icon: Sun },
  { label: "Theme: Dark", Icon: Moon },
  { label: "Theme: System", Icon: Monitor },
  { label: "Density: comfortable", Icon: Rows2 },
  { label: "Density: compact", Icon: Rows4 },
  { label: "Contrast: system", Icon: Contrast },
  { label: "Contrast: normal", Icon: Circle },
  { label: "Contrast: high", Icon: Disc },
  { label: "Motion: full", Icon: Waves },
  { label: "Motion: reduced", Icon: Minus },
  { label: "Motion: system", Icon: Wind },
  { label: "Rotation: On", Icon: RotateCw },
  { label: "Rotation: Off", Icon: Ban },
  { label: "Menu", Icon: Menu },
  { label: "Overflow", Icon: MoreHorizontal },
];

function Specimen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ks__specimen">
      <span className="ks__label">{label}</span>
      {children}
    </div>
  );
}

function Section({
  title,
  note,
  bleed,
  children,
}: {
  title: string;
  note?: string;
  bleed?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`ks__section${bleed ? " ks__section--bleed" : ""}`}>
      <h2 className="ks__h2">{title}</h2>
      {note && <p className="ks__note">{note}</p>}
      {children}
    </section>
  );
}

const PROV_PRESETS: { label: string; prov: Provenance }[] = [
  { label: "Fresh", prov: PROV_FRESH },
  { label: "End-of-day", prov: PROV_EOD },
  { label: "Stale / medium confidence", prov: PROV_STALE },
  { label: "Manual / low confidence", prov: PROV_MANUAL },
  { label: "Unavailable", prov: PROV_UNAVAILABLE },
];

function provBadge(p: Provenance) {
  return (
    <ProvenanceBadge
      source={p.source}
      entitlement={p.entitlement}
      valuationMethod={p.valuationMethod}
      confidence={p.confidence}
      asOf={p.asOf}
      status={p.status}
    />
  );
}

export function KitchenSink() {
  // Inputs (controlled demos)
  const [money, setMoney] = useState("1250000.00");
  const [qty, setQty] = useState("0.75000000");
  const [pct, setPct] = useState("12.50");
  const [date, setDate] = useState("2026-07-09");
  const [text, setText] = useState("Household flat");
  const [scope, setScope] = useState("markets");
  const [assetClass, setAssetClass] = useState("equity");
  const [sector, setSector] = useState("Financials");
  const [instrument, setInstrument] = useState<string | undefined>("ins-1");
  const [quoteSource, setQuoteSource] = useState<QuoteSource>("markets");

  // DataTable (sort + filter demo)
  const [sort, setSort] = useState<SortState>({ key: "value", dir: "desc" });
  const [filter, setFilter] = useState("");

  // §5 amendment demos (Dialog / ConfirmDialog / FileInput / Toast)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [purged, setPurged] = useState<string | null>(null);
  const toast = useToast();

  // §5.5 global chrome demos (PROPOSED 2026-07-11 — page-chrome Phase 0a)
  const [rotationOn, setRotationOn] = useState(false);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);

  // First-run checklist demos (PROPOSED 2026-07-11 — page-first-run-checklist Phase 0a)
  const [switchOn, setSwitchOn] = useState(false);
  const [comboTz, setComboTz] = useState<string | null>("Asia/Singapore");
  const [frOpen, setFrOpen] = useState(false);
  const [frCurrency, setFrCurrency] = useState("SGD");
  const [frTz, setFrTz] = useState<string | null>(null);
  const [frPinSet, setFrPinSet] = useState(false);
  const [frProvider, setFrProvider] = useState("mock");
  const [frNoEgress, setFrNoEgress] = useState(false);

  const columns: Column<Holding>[] = useMemo(
    () => [
      { key: "id", label: "Symbol", render: (h) => h.instrument.symbol, sortable: true },
      { key: "account", label: "Account", sortable: true },
      { key: "quantity", label: "Position", format: "quantity", sortable: true },
      { key: "price", label: "Price", format: "price", sortable: true },
      { key: "value", label: "Value", format: "money", sortable: true },
      { key: "unrealisedPl", label: "Unrealised P/L", format: "signed-money", sortable: true },
      { key: "todaysChange", label: "Today's change", format: "signed-money", sortable: true },
    ],
    [],
  );

  const rows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const filtered = f
      ? HOLDINGS.filter(
          (h) =>
            h.instrument.symbol.toLowerCase().includes(f) ||
            h.instrument.name.toLowerCase().includes(f),
        )
      : HOLDINGS;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sort.key as keyof Holding];
      const bv = b[sort.key as keyof Holding];
      const an = Number(av);
      const bn = Number(bv);
      if (Number.isFinite(an) && Number.isFinite(bn)) return (an - bn) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [filter, sort]);

  const onSort = (key: string) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));

  const spark = PRICE_SERIES.map((p) => p.close);

  return (
    <div className="ks">
      <div className="ks__bar">
        <Link className="lf-btn" to="/">
          ← Back
        </Link>
        <DisplayControls />
      </div>

      <PageHeader
        title="Kitchen sink"
        subtitle="Every DESIGN-SYSTEM §5 component in every meaningful state, for ratification. Switch theme / density / contrast / motion above; nothing here is a real page."
      />

      <TokenBoard />

      {/* ---------------------------------------------------------------- */}
      <Section
        title="Inputs (§5.1)"
        note="The only sanctioned way to accept input. No raw <input>/<select>; categoricals resolve through MasterSelect / the master registry."
      >
        <div className="ks__grid">
          <Specimen label="MoneyInput · SGD">
            <MoneyInput value={money} currency="SGD" onChange={setMoney} aria-label="Amount SGD" />
          </Specimen>
          <Specimen label="MoneyInput · INR (large)">
            <MoneyInput value="120000000.00" currency="INR" onChange={() => {}} aria-label="Amount INR" />
          </Specimen>
          <Specimen label="MoneyInput · negative">
            <MoneyInput value="-4820.55" currency="USD" onChange={() => {}} aria-label="Amount negative" />
          </Specimen>
          <Specimen label="MoneyInput · disabled">
            <MoneyInput value="1000.00" currency="USD" onChange={() => {}} disabled aria-label="Amount disabled" />
          </Specimen>
          <Specimen label="QuantityInput · crypto precision">
            <QuantityInput value={qty} onChange={setQty} aria-label="Quantity" />
          </Specimen>
          <Specimen label="PercentInput">
            <PercentInput value={pct} onChange={setPct} aria-label="Percent" />
          </Specimen>
          <Specimen label="DateInput (ISO)">
            <DateInput value={date} onChange={setDate} aria-label="Date" />
          </Specimen>
          <Specimen label="TextInput · free text (label / tag names)">
            <TextInput value={text} onChange={setText} aria-label="Label" placeholder="e.g. Gold bar" />
          </Specimen>
          <Specimen label="MasterSelect · fixed vocab (asset_class)">
            <MasterSelect master="asset_class" value={assetClass} onChange={setAssetClass} />
          </Specimen>
          <Specimen label="MasterSelect · extensible + create (sector)">
            <MasterSelect master="sector" value={sector} onChange={setSector} allowCreate />
          </Specimen>
          <Specimen label="Select · OPEN IT in both themes (native popup follows theme)">
            <Select
              value={scope}
              onChange={setScope}
              aria-label="Scope"
              options={[
                { value: "markets", label: "Markets" },
                { value: "holdings", label: "Holdings" },
                { value: "global", label: "Global" },
                { value: "watchlist", label: "Watchlist" },
              ]}
            />
          </Specimen>
          <Specimen label="InstrumentPicker · typeahead + create">
            <InstrumentPicker
              value={instrument}
              onSelect={(p) =>
                setInstrument(p.kind === "existing" ? p.instrument.id : undefined)
              }
              allowCreate
            />
          </Specimen>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        title="Provenance & status (§5.3)"
        note="One standardized badge renders source · freshness · confidence identically; StalenessChip flags (never hides) the Stale layer."
      >
        <div className="ks__stack">
          {PROV_PRESETS.map((p) => (
            <Specimen label={p.label} key={p.label}>
              {provBadge(p.prov)}
            </Specimen>
          ))}
          <div className="ks__row">
            <Specimen label="StalenessChip · stale">
              <StalenessChip isStale asOf={PROV_STALE.asOf} />
            </Specimen>
            <Specimen label="StalenessChip · fresh (renders nothing)">
              <StalenessChip isStale={false} asOf={PROV_FRESH.asOf} />
            </Specimen>
          </div>

          {/* StatusChip (§5.3 AMENDMENT — PROPOSED, page-policy §9-15; ratify at the walk).
              THE status/severity chip, extracted at the 3rd recurrence of the same page-local
              pattern (ph__chip · rv__chip · the policy band chip) per the centralization rule.
              Both page-local copies are MIGRATED onto it — none remains. */}
          <div className="ks__row">
            <Specimen label="StatusChip · neutral">
              <StatusChip label="In band" />
            </Specimen>
            <Specimen label="StatusChip · attention (amber)">
              <StatusChip label="Over" tone="attention" />
            </Specimen>
            <Specimen label="StatusChip · attention · under (SAME tone as over)">
              <StatusChip label="Under" tone="attention" />
            </Specimen>
            <Specimen label="StatusChip · with count">
              <StatusChip label="Delayed" tone="attention" count={3} />
            </Specimen>
          </div>
          <div className="ks__row">
            <Specimen label="StatusChip · positive (Pricing Health only — NOT Policy)">
              <StatusChip label="Fresh" tone="positive" />
            </Specimen>
            <Specimen label="StatusChip · negative (Pricing Health only — NOT Policy)">
              <StatusChip label="Unavailable" tone="negative" />
            </Specimen>
            <Specimen label="StatusChip · long label (must not overflow its box)">
              <StatusChip label="Not sector-classified (non-equity)" tone="neutral" />
            </Specimen>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        title="Data display · stat tiles (§5.2)"
        note="Delta uses --gain/--loss only, always with a sign glyph (colour never the sole signal)."
      >
        <div className="ks__stat-rail">
          <TrendStat
            label="Net worth"
            value={`SGD ${formatMoney("438118.00")}`}
            deltaDisplay={`${formatSignedMoney("612.40")} (${formatSignedPercent("0.14")})`}
            delta="612.40"
            sparkline={spark}
            provenance={provBadge(PROV_FRESH)}
          />
          <TrendStat
            label="Today's change"
            value={formatSignedMoney("-1830.00")}
            deltaDisplay={formatSignedPercent("-0.42")}
            delta="-1830.00"
            unit="SGD"
            sparkline={spark.map((v) => 300 - v)}
          />
          <TrendStat label="Unrealised P/L" value={formatSignedMoney("71398.13")} delta="71398.13" unit="SGD" />
          <TrendStat label="Cash runway" value="—" deltaDisplay="No data" delta={null} unit="months" />
        </div>
        <div className="ks__stack">
          <Specimen label="MetaStrip · compact metadata (desktop: one row; narrow: 2-col grid). Vocab values as chips.">
            <div className="lf-card">
              <h3 className="ks__cardhead">Identity</h3>
              <div className="lf-card__body">
                <MetaStrip
                  items={[
                    { label: "Class", value: <span className="lf-chip">Equity</span> },
                    { label: "Subclass", value: <span className="lf-chip">ETF</span> },
                    { label: "Exchange", value: "NASDAQ" },
                    { label: "Sector", value: "Information Technology" },
                    { label: "Country", value: "US" },
                    { label: "Currency", value: "USD" },
                  ]}
                />
              </div>
            </div>
          </Specimen>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        title="Data display · DataTable (§5.2)"
        note="One implementation for every table: sortable (aria-sort), filter, server-side export (client never builds the file), sticky header, density-aware, negative gain/loss cells."
      >
        <div className="ks__stack">
          <Specimen label="Holdings · interactive (sort / filter / export)">
            <DataTable
              columns={columns}
              rows={rows}
              sort={sort}
              onSort={onSort}
              filter={{ value: filter, onChange: setFilter, placeholder: "Filter symbol or name…" }}
              onExport={() => window.alert("Server-side export requested (client never generates the file).")}
              caption="Mock holdings — plausible finance data with negative P/L and stale provenance."
            />
          </Specimen>
          <Specimen label="Compact density (per-table override)">
            <DataTable columns={columns} rows={rows} density="compact" />
          </Specimen>
          <Specimen label="Empty state (Product Guarantee 3 — a reason, never blank)">
            <EmptyState
              message="No holdings yet"
              reason="Add a holding on the Holdings page, or import a broker CSV, to populate this table."
              action={<button type="button" className="lf-btn lf-btn--primary">Add holding</button>}
            />
          </Specimen>
          <Specimen label="Loading">
            <div className="ks__stack">
              <div className="ks__skeleton" />
              <div className="ks__skeleton" />
              <div className="ks__skeleton" />
            </div>
          </Specimen>
          <Specimen label="Error">
            <EmptyState
              message="Couldn't load holdings"
              reason="We couldn't reach the price source. Values are left out rather than guessed."
              action={<button type="button" className="lf-btn">Retry</button>}
            />
          </Specimen>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        title="Data display · charts — house SVG only (§5.2 / §4, D-053)"
        note="No charting dependency. Segments use the CATEGORICAL palette (§4 amendment, identity axis); gain/loss red/green stay reserved for meaning only."
      >
        <div className="ks__row">
          <Specimen label="Categorical palette (§4 AMENDMENT, PROPOSED 2026-07-11) — CVD-aware identity set, distinct from gain/loss. Toggle theme + contrast to ratify all three modes.">
            <div className="ks__palette">
              {["blue", "aqua", "yellow", "green", "violet", "red", "magenta", "orange"].map((name, i) => (
                <span key={name} className="ks__paletterow">
                  <span className={`lf-donut__swatch lf-seg--${i}`} aria-hidden="true" /> {i + 1} · {name}
                </span>
              ))}
            </div>
          </Specimen>
          {/* §12ho3-2 — the readout is IN THE HOLE. Hover a segment or TAB the legend: the served class
            * label + share render anchored at the centre. It cannot overlap the legend or a neighbour,
            * nothing follows the cursor, and there is no layout shift. The long label below is the
            * case that matters: it must ellipsise inside the hole, never spill over the ring. */}
          <Specimen label="AllocationDonut · CENTRE READOUT (§12ho3-2) — hover a segment OR tab the legend; capped legend + '+N more ↗'; LONG label must stay inside the hole">
            <AllocationDonut
              segments={[
                { label: "Equities & ETFs", value: "45000" },
                { label: "Real estate investment trusts (Singapore)", value: "80000" },
                { label: "Cash & deposits", value: "30000" },
                { label: "Bonds", value: "20000" },
                { label: "Crypto", value: "12000" },
                { label: "Retirement", value: "25000" },
                { label: "Private", value: "8000" },
              ]}
              legendMax={5}
              legendMore={(n) => (
                <Link className="lf-donut__morelink" to="#/portfolio" aria-label={`${n} more classes on Portfolio`}>
                  +{n} more
                  <ArrowUpRight aria-hidden="true" focusable="false" />
                </Link>
              )}
            />
          </Specimen>
          <Specimen label="AllocationDonut · categorical palette (8 identities in fixed order)">
            <AllocationDonut
              segments={[
                { label: "Equities & ETFs", value: "45000" },
                { label: "Cash & deposits", value: "30000" },
                { label: "Bonds", value: "20000" },
                { label: "Property", value: "80000" },
                { label: "Crypto", value: "12000" },
                { label: "Retirement", value: "25000" },
                { label: "Private", value: "8000" },
                { label: "Commodities", value: "6000" },
              ]}
            />
          </Specimen>
          <Specimen label="AllocationDonut · TRUE RING + segment HOVER/FOCUS (§12-3/§12-7): transparent centre; hover a segment or tab the legend for label · value · pct readout">
            <AllocationDonut
              segments={[
                { label: "Property", value: "980000" },
                { label: "Retirement", value: "65000" },
                { label: "Fixed deposit", value: "50500" },
                { label: "Equities & ETFs", value: "74000" },
                { label: "Bonds", value: "30450" },
                { label: "Cash", value: "25000", note: "Emergency reserve — instantly accessible." },
              ]}
            />
          </Specimen>
          <Specimen label="Skeleton (§12-8 progressive loading): per-card placeholder — bars + a block variant (shimmer collapses under reduced motion)">
            <div className="ks__stack">
              <Skeleton lines={3} />
              <Skeleton block />
            </div>
          </Specimen>
          <Specimen label="AllocationDonut · by class">
            <AllocationDonut segments={ALLOCATION_BY_CLASS} />
          </Specimen>
          <Specimen label="AllocationDonut · by sector (Unclassified sector bucket, D-082)">
            <AllocationDonut segments={ALLOCATION_BY_SECTOR} />
          </Specimen>
          <Specimen label="AllocationDonut · AMENDMENT (PROPOSED, Portfolio ND-4): served D-082 bucket + excluded-liabilities FOOTNOTE (served figure, no client math)">
            <AllocationDonut
              segments={ALLOCATION_BY_SECTOR}
              footnote="Liabilities −S$420,000 excluded — allocation is of gross assets."
            />
          </Specimen>
        </div>
        <div className="ks__stack">
          <Specimen label="PriceChart · line + benchmark (Portfolio performance, D-035)">
            <PriceChart series={PRICE_SERIES} mode="line" benchmark={BENCHMARK_SERIES} interval="1M" />
          </Specimen>
          <Specimen label="PriceChart · COMPARISON MODE (PROPOSED, Portfolio ND-3d/e): portfolio + benchmark on a SHARED value axis (no re-normalisation) + legend + provenance sublabel">
            <PriceChart
              series={PRICE_SERIES}
              mode="line"
              interval="1Y"
              comparison={{
                values: PRICE_SERIES.map((_, i) => PRICE_SERIES[0].close + i * 0.9 + Math.sin(i / 5) * 3),
                label: "Benchmark",
                sublabel: "S&P 500 — SPY proxy · price return, excl. dividends",
              }}
            />
          </Specimen>
          <Specimen label="PriceChart · candles + MA + BB + RSI (Instrument Detail)">
            <PriceChart series={PRICE_SERIES} mode="candles" overlays={["MA", "BB", "RSI"]} interval="1M" />
          </Specimen>
          <Specimen label="PriceChart · AMENDMENT (PROPOSED): Simple/Advanced toggle · period selector · hover crosshair + tooltip · honest short-history">
            <PriceChart
              series={PRICE_SERIES}
              interval="1d"
              controls
              defaultView="simple"
              periods={["1M", "3M", "6M", "1Y", "Max"]}
              activePeriod="6M"
              onPeriodChange={() => {}}
            />
          </Specimen>
          <Specimen label="Treemap · squarified heatmap (fill intensity = day-move magnitude)">
            <Treemap nodes={TREEMAP_NODES} squarified />
          </Specimen>
          <Specimen label="Magnitude scale — soft tint near 0%, full intensity at ≥5% (amended 2026-07-10)">
            <Treemap nodes={TREEMAP_SCALE_SAMPLES} squarified aria-label="Treemap magnitude scale" />
          </Specimen>
          <Specimen label="Treemap click-through (PROPOSED, page-heatmap ND-7) — Tab to focus a tile, Enter/Space opens it; hover/focus shows a ring with NO layout shift">
            <Treemap
              nodes={TREEMAP_NODES.map((n) => ({ ...n, href: `#/instrument/${encodeURIComponent(n.label)}` }))}
              squarified
              aria-label="Interactive holdings heatmap — each tile links to its instrument"
            />
          </Specimen>
          <Specimen label="Treemap readout (PROPOSED, page-heatmap §12hm1-1) — HOVER or Tab-FOCUS any tile (incl. the EDGE tiles) for name · value · Today's change. Served display strings only; the anchored overlay never clips and never shifts layout. The last tile has NO Today's change → em dash + reason.">
            <Treemap
              nodes={TREEMAP_READOUT_NODES}
              squarified
              aria-label="Holdings heatmap with a hover and focus readout"
            />
          </Specimen>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        title="Data display · quotes (§5.2, D-046/D-047)"
        note="QuoteCardRow carries a source select. TickerStrip (D-047 AMENDMENT, PROPOSED) is now the GLOBAL CHROME FOOTER — holdings + world indices, all widths; halts under reduced motion (then static + manually scrollable); staleness flagged per item; hidden entirely under lock."
      >
        <div className="ks__stack">
          <QuoteCardRow quotes={QUOTE_CARDS} source={quoteSource} onSourceChange={setQuoteSource} />
          <Specimen label="TickerStrip · global footer — holdings LINK to instrument detail (D-098); indices unlinked; one stale">
            <TickerStrip quotes={TICKER_DEMO} />
          </Specimen>
          <Specimen label="TickerStrip · scroll-speed options (PROPOSED — ratify final; default = middle)">
            <div className="ks__stack">
              {([["Faster", "14s"], ["Default", "22s"], ["Slower", "36s"]] as const).map(
                ([label, dur]) => (
                  <div key={dur} style={{ "--ticker-scroll-duration": dur } as CSSProperties}>
                    <span className="ks__label">{label} · {dur}</span>
                    <TickerStrip quotes={TICKER_DEMO} />
                  </div>
                ),
              )}
            </div>
          </Specimen>
          <Specimen label="NewsList · extracted (page-news ND-5) — external links (new tab), source · relative time, per-symbol links, plain-text clamped headline">
            <NewsList items={NEWS_DEMO} showSymbols />
          </Specimen>
          <Specimen label="NewsList · empty state (honest reason)">
            <NewsList items={[]} emptyMessage="No recent news" emptyReason="No headlines right now." />
          </Specimen>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* ---------------------------------------------------------------- */}
      <Section
        bleed
        title="Home grid — RATIFIED reference (page-home §12ho1-5)"
        note="RATIFIED 2026-07-13 (§12ho1-5) and WIRED — the live Home at `/` renders this geometry from the canonical readers, importing the SAME stylesheet, so the two cannot drift. Home has ONE layout (§12ho1-6). NOTE the frame is 1366×680 — the CONTENT REGION at a 1366×768 screen, i.e. the viewport MINUS the chrome (top bar + ticker). The original frame was a bare 768 tall and so promised the page the chrome's height on top of its own; with REAL data (more asset classes, longer headlines) the grid does not fit one viewport — see §12ho1-7. Demo data is deliberately small, so this specimen still fits; the live page is the honest measure."
      >
        <div className="ks__stack">
          <Specimen label="The ratified grid · 1366×680 (the real content region) — 12 columns × 3 rows. Today's change leads; Review takes the strongest remaining corner. Attention dominates by SIZE, not motion.">
            <div className="ks__viewportscroll">
              <div className="ks__viewport">
                <HomeMockupFull />
              </div>
            </div>
          </Specimen>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section title="Structure & chrome (§5.4)">
        <div className="ks__stack">
          <Specimen label="Card / panel (D-100, ratified w/ amendment) — LAYERED: outer --surface-raised card + nested --surface body panel (the Holdings net-worth family)">
            <div className="lf-card">
              <h3 className="ks__cardhead">Section headline</h3>
              <div className="lf-card__body">
                Content sits in a nested panel on <code>--surface</code> with its own
                border — depth, not a single flat fill. Both themes + high-contrast.
              </div>
            </div>
          </Specimen>
          {/* The linked-summary affordance (DESIGN-SYSTEM §5 RULE, page-home §12ho1-2). It shipped to four
            * pages with NO gallery specimen — so nobody ever LOOKED at it, and a cascade collision that
            * tore every `whole` header out of its tile went unseen (§12ho1-4). It has a specimen now. */}
          <Specimen label="SummaryHead · plain — the ↗ sits top-right INSIDE the tile; the title may carry a [Help] popover (so the header is NOT one link: nesting interactive content inside a link is a defect)">
            <div className="lf-card">
              <SummaryHead
                title={<GlossaryTerm term="term-net-worth">Net worth</GlossaryTerm>}
                to="#/net-worth"
                destination="Net worth"
              />
              <div className="lf-card__body">The figure this tile summarises.</div>
            </div>
          </Specimen>
          <Specimen label="SummaryHead · whole — a PURE summary tile: the entire header is the click target. Must still render INSIDE its tile (never absolutely positioned to the page)">
            <div className="lf-card">
              <SummaryHead title="Performance" to="#/portfolio" destination="Portfolio" whole />
              <div className="lf-card__body">The whole header is one link; the ↗ glyph is decorative.</div>
            </div>
          </Specimen>
          <Specimen label="Scrollable panel (D-101, ratified w/ amendment) — header OUTSIDE the scroll; only the body scrolls, thumb starts below the header">
            <div className="lf-card">
              <h3 className="ks__cardhead">Panel header (stays fixed)</h3>
              <div className="lf-card__body ks__scrollpanel">
                {Array.from({ length: 20 }, (_, i) => (
                  <span key={i}>Row {i + 1} — the header is outside the scroll region; only these rows scroll, and the themed thumb starts below the header.</span>
                ))}
              </div>
            </div>
          </Specimen>
          <Specimen label="PageHeader · with subtitle + actions">
            <PageHeader
              title="Portfolio"
              subtitle="Investment analytics — manage positions on Holdings."
              actions={<button type="button" className="lf-btn lf-btn--primary">Add holding</button>}
            />
          </Specimen>
          <div className="ks__row">
            <Specimen label="ReviewCard · attention">
              <ReviewCard
                attention={2}
                link={{ href: "#/review", label: "Open Review" }}
                sections={[
                  { label: "Cash runway below 3 months", verdict: "attention", detail: "Liquid ÷ recurring burn" },
                  { label: "Allocation drift within bands", verdict: "ok" },
                  { label: "1 holding needs a source mapping", verdict: "attention" },
                  { label: "No goals due in 180 days", verdict: "info" },
                ]}
              />
            </Specimen>
            <Specimen label="ReviewCard · all clear">
              <ReviewCard
                attention={0}
                link={{ href: "#/review", label: "Open Review" }}
                sections={[
                  { label: "Runway healthy", verdict: "ok" },
                  { label: "No drift beyond bands", verdict: "ok" },
                ]}
              />
            </Specimen>
          </div>
          <Specimen label="GlossaryTerm · popover (hover / focus)">
            <p className="type-14">
              Your <GlossaryTerm term="term-net-worth">Net worth</GlossaryTerm> is{" "}
              <GlossaryTerm term="term-gross-assets">Gross assets</GlossaryTerm> minus liabilities;{" "}
              <GlossaryTerm term="term-cash-runway">Cash runway</GlossaryTerm> tracks how long liquid assets last.
            </p>
          </Specimen>
          {/* §12ho3-3: the stale badge in a NARROW card — the case the wide gallery specimen hid. In
            * Home's grid a quote card is ~9rem, and the symbol row was a nowrap flex with no
            * `min-width: 0`, so the badge was simply pushed out through the card's right border. A
            * specimen only proves what it exercises. */}
          <Specimen label="QuoteCardRow · stale badge in a NARROW card (§12ho3-3) — the badge must stay INSIDE the border; the date may drop to a second line, never outside">
            <div className="ks__narrowquotes">
              <QuoteCardRow
                quotes={[
                  {
                    symbol: "BTC",
                    name: "Bitcoin",
                    price: "66084.9000",
                    changePct: "-0.50",
                    currency: "USD",
                    isStale: true,
                    asOf: "2026-07-08T18:02:00Z",
                  },
                ]}
                source="holdings"
              />
            </div>
          </Specimen>
          <Specimen label="Long / RTL-length labels (overflow behaviour)">
            <div className="ks__stack" dir="rtl">
              <MasterSelect master="asset_class" value="mutual_fund" onChange={() => {}} aria-label="نوع الأصل" />
              <QuoteCardRow
                quotes={[
                  {
                    symbol: "VWRA",
                    name: "صندوق فانغارد للأسهم العالمية طويل الاسم جدا جدا",
                    price: "128.4500",
                    changePct: "0.42",
                    currency: "USD",
                    isStale: true,
                    asOf: PROV_STALE.asOf,
                  },
                ]}
                source="watchlist"
              />
            </div>
          </Specimen>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        title="§5 amendments — ratified 2026-07-10"
        note="Added for the Holdings page-build (page-holdings.md §9): Dialog/Drawer, ConfirmDialog + PIN, FileInput, and the undo Toast. Token-compliant; ratified at the kitchen-sink look (both themes; reduced-motion toast confirmed)."
      >
        <div className="ks__row">
          <Specimen label="Dialog · center (CRUD editor container)">
            <button type="button" className="lf-btn" onClick={() => setDialogOpen(true)}>
              Open dialog
            </button>
          </Specimen>
          <Specimen label="Dialog · drawer variant">
            <button type="button" className="lf-btn" onClick={() => setDrawerOpen(true)}>
              Open drawer
            </button>
          </Specimen>
          <Specimen label="ConfirmDialog · destructive">
            <button type="button" className="lf-btn" onClick={() => setConfirmOpen(true)}>
              Delete something…
            </button>
          </Specimen>
          <Specimen label="ConfirmDialog · PIN-gated (purge-deleted)">
            <button type="button" className="lf-btn" onClick={() => setPinOpen(true)}>
              Purge deleted [PIN]
            </button>
            {purged && <span className="ks__label">{purged}</span>}
          </Specimen>
          <Specimen label="FileInput · CSV import (click or drag)">
            <FileInput
              accept=".csv"
              aria-label="Import CSV"
              label="Choose CSV"
              onChange={(files) => {
                setUploaded(files[0]?.name ?? null);
                toast.show({ message: `Selected ${files[0]?.name ?? "file"}` });
              }}
            />
            {uploaded && <span className="ks__label">Last: {uploaded}</span>}
          </Specimen>
          <Specimen label="Toast · plain">
            <button
              type="button"
              className="lf-btn"
              onClick={() => toast.show({ message: "Holding saved." })}
            >
              Show toast
            </button>
          </Specimen>
          <Specimen label="Toast · undo (10s soft-delete window)">
            <button
              type="button"
              className="lf-btn"
              onClick={() =>
                toast.show({
                  message: "Transaction deleted.",
                  action: { label: "Undo", onClick: () => toast.show({ message: "Restored." }) },
                })
              }
            >
              Delete with undo
            </button>
          </Specimen>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        title="Global chrome (§5.5) — PROPOSED 2026-07-11 (recomposed at re-ratify)"
        note="page-chrome Phase 0a (C-1): the app SHELL. Slim calm TopBar (D-066) with ICON-ONLY display controls (theme/density/contrast/motion) + the rotation toggle (D-044) right-aligned, Clock + DemoBadge; brand shows in the bar only at narrow widths (sidebar carries it at laptop+ — one brand at a time). StaleBanner/UpdateBanner are full-width status strips BELOW the bar, only when active. Sidebar shows all six D-043 group headers, with only BUILT pages as entries. LockScreen = D-002 access lock. STATEFUL-ICON RULE (lucide, ADR-0003): click each icon toggle — a state-distinct icon per state (theme sun/moon/monitor, density, contrast, motion, rotation), tooltip names it. The Detail toggle was REMOVED (page-home §9-15) — the Home layout is a Settings control. Ratify in both themes/densities/contrast + a narrow width; hover for tooltips."
      >
        <div className="ks__stack">
          <Specimen label="App shell — slim TopBar (icon controls, right) + status strips BELOW the bar pushing content">
            <div className="lf-card" style={{ padding: 0, overflow: "hidden" }}>
              <TopBar
                onToggleNav={() =>
                  toast.show({ message: "Nav toggled — off-canvas sidebar at narrow widths (D-102)" })
                }
                controls={<DisplayControls />}
                clock={<Clock timezone="Asia/Singapore" />}
                demoBadge={<DemoBadge />}
                rotationOn={rotationOn}
                onToggleRotation={() => setRotationOn((v) => !v)}
              />
              <StaleBanner count={3} />
              {!updateDismissed && (
                <UpdateBanner version="2.1.0" onDismiss={() => setUpdateDismissed(true)} />
              )}
              <div style={{ padding: "var(--space-5)" }}>
                <span className="ks__label">Page content renders here (strips push it down).</span>
              </div>
            </div>
          </Specimen>

          <div className="ks__row">
            <Specimen label="Sidebar · six D-043 headers, only BUILT pages as entries (Holdings active) — header-only where none built yet">
              <div className="ks__scrollpanel" style={{ height: "26rem", padding: 0, overflow: "hidden" }}>
                <Sidebar activePath="/holdings" />
              </div>
            </Specimen>
            <Specimen label="Sidebar · full-skeleton preview (showAll — where pages will land as they ship)">
              <div className="ks__scrollpanel" style={{ height: "26rem", padding: 0, overflow: "hidden" }}>
                <Sidebar activePath="/holdings" showAll />
              </div>
            </Specimen>
          </div>

          <div className="ks__row">
            <Specimen label="StaleBanner · N stale strip → Pricing Health">
              <StaleBanner count={5} />
            </Specimen>
            <Specimen label="StaleBanner · none (hidden — honest)">
              <StaleBanner count={0} />
              <span className="ks__label">renders nothing at 0</span>
            </Specimen>
            <Specimen label="UpdateBanner · version strip (dismissible)">
              <UpdateBanner version="2.1.0" onDismiss={() => {}} />
            </Specimen>
            <Specimen label="UpdateBanner · none / no-egress (hidden)">
              <UpdateBanner version={null} />
              <span className="ks__label">null under no-egress → nothing</span>
            </Specimen>
            <Specimen label="DemoBadge · active">
              <DemoBadge active />
            </Specimen>
            <Specimen label="DemoBadge · inactive (hidden)">
              <DemoBadge active={false} />
              <span className="ks__label">renders nothing when not demo</span>
            </Specimen>
            <Specimen label="Clock · timezone (D-013)">
              <Clock timezone="Asia/Singapore" />
            </Specimen>
            <Specimen label="LockScreen · PIN gate over BLURRED snapshot (D-002)">
              <button type="button" className="lf-btn" onClick={() => { setLockError(null); setLockOpen(true); }}>
                Show lock screen
              </button>
              <span className="ks__label">Verify: NOTHING behind is legible (strong blur + heavy scrim). PIN 000000 shows the error; any other 6+ digits unlocks.</span>
            </Specimen>
          </div>

          {/* Batch-2 PROPOSED specimens (page-chrome Phase 3 §11-5/11-11/11-13). */}
          <div className="ks__row">
            <Specimen label="PROPOSED · SVG icon set (lucide, ADR-0003) — every bar icon at final size, both themes">
              <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
                {BAR_ICONS.map(({ label, Icon }) => (
                  <button key={label} type="button" className="lf-iconbtn" aria-label={label} title={label}>
                    <Icon aria-hidden="true" />
                  </button>
                ))}
              </div>
              <span className="ks__label">theme (sun/moon/monitor) · density · contrast · motion · rotation · Detail (line/candlestick) · menu · overflow — uniform square hit area; verify both themes</span>
            </Specimen>
            <Specimen label="PROPOSED · page-action icon buttons (§11-16) — all icon-only, framed; Add accent-filled">
              <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                <button type="button" className="lf-iconbtn lf-iconbtn--framed" title="Edit" aria-label="Edit"><Pencil aria-hidden="true" /></button>
                <button type="button" className="lf-iconbtn lf-iconbtn--framed" title="Import" aria-label="Import"><Upload aria-hidden="true" /></button>
                <button type="button" className="lf-iconbtn lf-iconbtn--framed" title="Export CSV" aria-label="Export CSV"><Download aria-hidden="true" /></button>
                <button type="button" className="lf-iconbtn lf-iconbtn--primary" title="Add" aria-label="Add"><Plus aria-hidden="true" /></button>
              </div>
              <span className="ks__label">DESIGN-SYSTEM §5.5 amendment — bordered surface (not ghost); Add keeps accent emphasis; hover for tooltips</span>
            </Specimen>
            <Specimen label="PROPOSED · narrow TopBar overflow (D-102 ext.) — resize below the laptop width">
              <span className="ks__label">Below the laptop breakpoint the display axes collapse into a single ⋯ popover; the App-shell specimen above shows it live when the window is narrowed.</span>
            </Specimen>
            <Specimen label="PROPOSED · Import dialog explainer copy (plain, no spec IDs)">
              <span className="ks__label">
                Nothing is written until you review. Fix or exclude flagged rows first.
                Exported transaction files re-import cleanly.
              </span>
            </Specimen>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        title="First-run checklist (D-045) — PROPOSED 2026-07-11 (Phase 0a)"
        note="page-first-run-checklist Phase 0a: three PROPOSED §5.5 amendments — Switch (no-egress toggle), Combobox (searchable picker for the ~400 timezone options, F-4), and FirstRunChecklist (the dismissible five-step overlay: base currency · timezone · PIN · data provider · no-egress; each skippable, each links to its Settings home; F-9 interplay copy shown). Ratify look in both themes, then Phase 1 wires it into the shell after the lock gate."
      >
        <div className="ks__row">
          <Specimen label="Switch · no-egress toggle (PROPOSED)">
            <Switch checked={switchOn} onChange={setSwitchOn} label="Make no network calls" aria-label="No egress" />
          </Specimen>
          <Specimen label="Combobox · searchable timezone picker (PROPOSED — type to filter ~400 IANA zones)">
            <div style={{ width: "16rem" }}>
              <Combobox options={TZ_OPTIONS} value={comboTz} onChange={setComboTz} placeholder="Search timezones…" aria-label="Timezone" />
            </div>
            <span className="ks__label">selected: {comboTz ?? "—"}</span>
          </Specimen>
          <Specimen label="FirstRunChecklist · dismissible 5-step overlay + three-state steps + Combobox-inside-overlay (PROPOSED §F-1/§F-3/§F-4)">
            <button type="button" className="lf-btn" onClick={() => setFrOpen(true)}>Show first-run checklist</button>
            <span className="ks__label">Fresh = 0/5, defaults are suggestions (pending), interacting confirms; open the Timezone picker to verify its menu layers ABOVE the overlay (§F-1).</span>
          </Specimen>
        </div>
      </Section>

      <FirstRunChecklist
        open={frOpen}
        baseCurrency={frCurrency}
        timezone={frTz}
        pinSet={frPinSet}
        provider={frProvider}
        noEgress={frNoEgress}
        timezoneOptions={TZ_OPTIONS}
        providerOptions={PROVIDER_OPTIONS}
        links={FIRST_RUN_LINKS}
        onBaseCurrency={setFrCurrency}
        onTimezone={setFrTz}
        onSetPin={() => { setFrPinSet(true); toast.show({ message: "PIN set (demo)." }); }}
        onProvider={setFrProvider}
        onNoEgress={setFrNoEgress}
        onDismiss={() => setFrOpen(false)}
        onNavigateAway={() => setFrOpen(false)}
      />

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Add transaction"
        footer={
          <>
            <button type="button" className="lf-btn" onClick={() => setDialogOpen(false)}>
              Cancel
            </button>
            <button type="button" className="lf-btn lf-btn--primary" onClick={() => setDialogOpen(false)}>
              Save
            </button>
          </>
        }
      >
        <div className="ks__stack">
          <Specimen label="Type">
            <MasterSelect master="txn_type" value="buy" onChange={() => {}} />
          </Specimen>
          <Specimen label="Amount">
            <MoneyInput value="1000.00" currency="SGD" onChange={() => {}} aria-label="Amount" />
          </Specimen>
          {/* §6 popover rule — open these INSIDE the dialog: each must OVERLAY within
              the viewport, never expand the dialog or add dialog-level scroll. */}
          <Specimen label="Instrument (open — portaled overlay, class-aware D-097)">
            <InstrumentPicker assetClass="mutual_fund" allowCreate onSelect={() => {}} />
          </Specimen>
          <Specimen label="Date (native picker overlays)">
            <DateInput value={date} onChange={setDate} aria-label="Date in dialog" />
          </Specimen>
          <Specimen label="Select (native overlays)">
            <Select
              value={scope}
              onChange={setScope}
              options={[
                { value: "markets", label: "Markets" },
                { value: "holdings", label: "Holdings" },
              ]}
              aria-label="Scope in dialog"
            />
          </Specimen>
        </div>
      </Dialog>

      <Dialog
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Edit holding"
        variant="drawer"
        footer={
          <button type="button" className="lf-btn lf-btn--primary" onClick={() => setDrawerOpen(false)}>
            Done
          </button>
        }
      >
        <p className="type-14">A drawer variant of the same primitive — slides from the side for edit/detail panels.</p>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete holding?"
        message="This soft-deletes the holding; you can undo within 10 seconds from the toast."
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          toast.show({
            message: "Holding deleted.",
            action: { label: "Undo", onClick: () => toast.show({ message: "Restored." }) },
          });
        }}
      />

      <ConfirmDialog
        open={pinOpen}
        title="Purge deleted rows?"
        message="This permanently removes all soft-deleted holdings and transactions. This cannot be undone."
        confirmLabel="Purge"
        destructive
        requirePin
        onCancel={() => setPinOpen(false)}
        onConfirm={() => {
          setPinOpen(false);
          setPurged("Purged (PIN accepted).");
        }}
      />

      <LockScreen
        open={lockOpen}
        error={lockError}
        onUnlock={(pin) => {
          if (pin === "000000") {
            setLockError("Incorrect PIN. Try again.");
          } else {
            setLockError(null);
            setLockOpen(false);
            toast.show({ message: "Unlocked." });
          }
        }}
      />
    </div>
  );
}
