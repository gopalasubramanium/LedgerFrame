import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "./KitchenSink.css";
import { DisplayControls } from "../components/DisplayControls";
import { TokenBoard } from "./TokenBoard";
import {
  AllocationDonut,
  DataTable,
  DateInput,
  EmptyState,
  GlossaryTerm,
  InstrumentPicker,
  MasterSelect,
  MoneyInput,
  PageHeader,
  PercentInput,
  PriceChart,
  ProvenanceBadge,
  QuantityInput,
  QuoteCardRow,
  ReviewCard,
  StalenessChip,
  TickerStrip,
  Treemap,
  TrendStat,
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
} from "../mocks/fixtures";
import type { Holding, Provenance } from "../mocks/types";
import {
  formatMoney,
  formatSignedMoney,
  formatSignedPercent,
} from "../format/number";

function Specimen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ks__specimen">
      <span className="ks__label">{label}</span>
      {children}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="ks__section">
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
  const [assetClass, setAssetClass] = useState("equity");
  const [sector, setSector] = useState("Financials");
  const [instrument, setInstrument] = useState<string | undefined>("ins-1");
  const [quoteSource, setQuoteSource] = useState<QuoteSource>("markets");

  // DataTable (sort + filter demo)
  const [sort, setSort] = useState<SortState>({ key: "value", dir: "desc" });
  const [filter, setFilter] = useState("");

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
          <Specimen label="MasterSelect · fixed vocab (asset_class)">
            <MasterSelect master="asset_class" value={assetClass} onChange={setAssetClass} />
          </Specimen>
          <Specimen label="MasterSelect · extensible + create (sector)">
            <MasterSelect master="sector" value={sector} onChange={setSector} allowCreate />
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
              reason="The pricing reader is unreachable. Values are not shown rather than guessed."
              action={<button type="button" className="lf-btn">Retry</button>}
            />
          </Specimen>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        title="Data display · charts — house SVG only (§5.2 / §4, D-053)"
        note="No charting dependency. Segments use the slate ramp + accent; gain/loss red/green only where a value is a gain/loss."
      >
        <div className="ks__row">
          <Specimen label="AllocationDonut · by class">
            <AllocationDonut segments={ALLOCATION_BY_CLASS} />
          </Specimen>
          <Specimen label="AllocationDonut · by sector (non-equity bucket, D-082)">
            <AllocationDonut segments={ALLOCATION_BY_SECTOR} />
          </Specimen>
        </div>
        <div className="ks__stack">
          <Specimen label="PriceChart · line + benchmark (Portfolio performance, D-035)">
            <PriceChart series={PRICE_SERIES} mode="line" benchmark={BENCHMARK_SERIES} interval="1M" />
          </Specimen>
          <Specimen label="PriceChart · candles + MA + BB + RSI (Instrument Detail)">
            <PriceChart series={PRICE_SERIES} mode="candles" overlays={["MA", "BB", "RSI"]} interval="1M" />
          </Specimen>
          <Specimen label="Treemap · squarified heatmap">
            <Treemap nodes={TREEMAP_NODES} squarified />
          </Specimen>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        title="Data display · quotes (§5.2, D-046/D-047)"
        note="QuoteCardRow carries a source select; TickerStrip is Home Full only and halts under reduced motion."
      >
        <div className="ks__stack">
          <QuoteCardRow quotes={QUOTES} source={quoteSource} onSourceChange={setQuoteSource} />
          <Specimen label="TickerStrip (Home Full only)">
            <TickerStrip quotes={QUOTES} source={quoteSource} />
          </Specimen>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section title="Structure & chrome (§5.4)">
        <div className="ks__stack">
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
                    provenance: PROV_STALE,
                  },
                ]}
                source="watchlist"
              />
            </div>
          </Specimen>
        </div>
      </Section>
    </div>
  );
}
