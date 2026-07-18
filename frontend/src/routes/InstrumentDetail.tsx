import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "./InstrumentDetail.css";
import {
  Dialog,
  EmptyState,
  MasterSelect,
  MetaStrip,
  NewsList,
  PageHeader,
  PriceChart,
  QuantityInput,
  StalenessChip,
  TextInput,
  useToast,
  SummaryHead,
} from "../components/ui";
import type { PricePoint } from "../mocks/types";
import {
  getInstrument,
  getInstrumentHistory,
  getInstrumentNews,
  getInstrumentPosition,
  patchInstrument,
  setOngoingCost,
  mapAmfi,
} from "../api/instruments";
import type { Candle, InstrumentDetail as Detail, IntradayAvailability, NewsItem } from "../api/instruments";
import type { HoldingRow } from "../api/holdings";
import { useLabelFor } from "../refdata/refdata-context";
import { Pencil } from "../icons";
import { formatMoney, formatSignedMoney } from "../format/number";

// Instrument Detail (IA §360; entity-detail template) — a scoped view (P-3) of the
// quote / history / news / portfolio readers for ONE instrument. It owns nothing;
// every figure is rendered by its canonical reader and links to its canonical page.
// The AI "explain this instrument" (D-068, P-6) is DEFERRED to the AI-surfaces
// milestone (ND-2/ND-5) — this page ships without it, D-068 intact.
// PriceChart amendment — the period selector (PROPOSED). Days are the server-side
// history window; YTD is computed live. "Max" is capped by the backend (≤ 3650).
// A vocab value → chip (MetaStrip), or "—" when absent.
function chipVal(v: string | null | undefined | false) {
  return v ? <span className="lf-chip">{v}</span> : "—";
}
const PERIODS = ["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "Max"];
// R-42 §9-9 — the 1D/5D disable decision (dr-7) is now SERVED: the range control renders the
// enabled/disabled + reason from the history reader's `intraday` availability map (D-105),
// never a frontend constant. The range→interval mapping is server-side too — the page sends a
// RANGE, never an interval.
// Tick label by served interval: intraday shows time-of-day (§2.1 — never midnight-normalised),
// daily shows the date. The interval literal (1min/5min) is NEVER shown in copy (§8).
function fmtTick(iso: string, interval: string): string {
  if (interval === "1min") return iso.slice(11, 16);                          // HH:MM (one day)
  if (interval === "5min") return `${iso.slice(5, 10)} ${iso.slice(11, 16)}`; // MM-DD HH:MM (5 days)
  return iso.slice(0, 10);                                                    // YYYY-MM-DD (daily)
}
function intervalLabel(interval: string): string {
  return interval === "1min" ? "1-minute" : interval === "5min" ? "5-minute" : interval;
}
function periodToDays(p: string): number {
  if (p === "YTD") {
    const now = new Date();
    return Math.max(1, Math.round((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000));
  }
  const base: Record<string, number> = { "1D": 1, "5D": 5, "1M": 30, "3M": 90, "6M": 180, "1Y": 365, "5Y": 1825, "Max": 3650 };
  return base[p] ?? 180;
}

export function InstrumentDetail() {
  const { symbol = "" } = useParams();
  const sym = symbol.toUpperCase();
  const toast = useToast();
  const labelFor = useLabelFor(); // item 3b — served display labels for enums

  const [detail, setDetail] = useState<Detail | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [histInterval, setHistInterval] = useState("1d");
  const [intraday, setIntraday] = useState<IntradayAvailability | null>(null);
  const [fetching, setFetching] = useState(false);
  const [period, setPeriod] = useState("6M");
  const [news, setNews] = useState<NewsItem[]>([]);
  const [position, setPosition] = useState<HoldingRow | null>(null);
  const [baseCcy, setBaseCcy] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [costOpen, setCostOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [d, n, p] = await Promise.all([
      getInstrument(sym),
      getInstrumentNews(sym),
      getInstrumentPosition(sym),
    ]);
    if (d.ok) setDetail(d.data);
    else setError(d.error);
    setNews(n.ok ? n.data.items : []);
    if (p.ok) {
      setBaseCcy(p.data.base_currency);
      setPosition(p.data.holdings[0] ?? null);
    }
    setLoading(false);
  }, [sym]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Price history refetches when the period changes. The page sends the RANGE (never an
  // interval): the server maps range→interval, applies the server-side gate, and — for an
  // intraday range — fetches it (user-triggered). Daily ranges use the days window.
  useEffect(() => {
    let live = true;
    setFetching(true);
    getInstrumentHistory(sym, periodToDays(period), period).then((h) => {
      if (!live) return;
      if (h.ok) {
        setCandles(h.data.candles);
        setHistInterval(h.data.interval);
        setIntraday(h.data.intraday ?? null);
      } else {
        setCandles([]);
      }
      setFetching(false);
    });
    return () => { live = false; };
  }, [sym, period]);

  const isIntradayView = histInterval === "1min" || histInterval === "5min";
  // Which range labels the server treats as intraday (server-derived — never hardcoded here).
  const periodIsIntraday = !!intraday && period in intraday.ranges;

  const series = useMemo<PricePoint[]>(
    () => candles.map((c) => ({ t: fmtTick(c.ts, histInterval), open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume })),
    [candles, histInterval],
  );
  // Honest short-history: label when the DAILY data covers less than the requested period.
  // Intraday ranges are fixed windows (1D/5D), so the day-based coverage note doesn't apply.
  const coverageNote = useMemo(() => {
    if (isIntradayView || series.length < 2) return undefined;
    const wanted = periodToDays(period);
    const first = new Date(series[0].t).getTime();
    const last = new Date(series[series.length - 1].t).getTime();
    const haveDays = Math.round((last - first) / 86400000);
    return haveDays < wanted * 0.9 ? `Only ${haveDays} day${haveDays === 1 ? "" : "s"} of history available` : undefined;
  }, [series, period, isIntradayView]);

  // §9-9 — the disabled ranges + reasons come from the SERVED availability map (not a constant).
  const disabledPeriods = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [r, s] of Object.entries(intraday?.ranges ?? {})) {
      if (!s.enabled && s.reason) out[r] = s.reason;
    }
    return out;
  }, [intraday]);

  const meta = detail?.instrument;
  const quote = detail?.quote;
  const historyReason =
    typeof meta?.history_status === "string" ? meta.history_status : "No price history from the source.";
  const assetDetail = meta?.asset_detail ?? {};
  const detailPanel = Object.entries(assetDetail)[0]; // class-conditional: mutual_fund / crypto / derivative
  // D-099: an ongoing cost (expense ratio) applies only to fund-wrapped classes.
  const isFundWrapped = ["mutual_fund", "etf"].includes(meta?.asset_class ?? "");

  return (
    <div className="lf-page idp">
      <PageHeader
        title={sym}
        subtitle={
          meta?.name
            ? `${meta.name} — a scoped view; canonical on Markets & Portfolio`
            : "A focused view — full detail on Markets & Portfolio"
        }
        actions={
          <>
            {/* Expense ratio is fund-only — the action appears only there. */}
            {isFundWrapped && (
              <button type="button" className="lf-btn" onClick={() => setCostOpen(true)}>Ongoing cost</button>
            )}
            {/* Page-action icon button (§11-13/§11-16): framed icon-only. */}
            <button
              type="button"
              className="lf-iconbtn lf-iconbtn--framed"
              onClick={() => setEditOpen(true)}
              title="Edit"
              aria-label="Edit"
            >
              <Pencil aria-hidden="true" />
            </button>
          </>
        }
      />

      {loading ? (
        <EmptyState message="Loading…" reason="Fetching the latest market and portfolio data." />
      ) : error ? (
        <EmptyState
          message="Couldn't load this instrument"
          reason={`The reader is unreachable (${error}). Values are withheld, never guessed.`}
          action={<button type="button" className="lf-btn" onClick={reload}>Retry</button>}
        />
      ) : (
        <>
          {/* Quote — the canonical Markets reader, scoped. Unpriced → "—" + reason. */}
          <section className="idp__section lf-card idp__quote">
            <SummaryHead title="Quote" to="/markets" destination="Markets" whole />
            <div className="lf-card__body">
              <div className="idp__price">
                {quote?.price != null ? (
                  <span className="idp__pricenum">{quote.currency} {quote.price_display ?? "—"}</span>
                ) : (
                  <span className="idp__pricenum idp__muted">—</span>
                )}
                {quote?.change != null && (
                  <span className={`idp__change ${Number(quote.change) >= 0 ? "idp__up" : "idp__down"}`}>
                    {formatSignedMoney(quote.change)}
                    {quote.change_pct != null ? ` (${Number(quote.change_pct).toFixed(2)}%)` : ""}
                  </span>
                )}
              </div>
              <div className="idp__prov">
                {quote?.price == null && <span className="idp__reason">No live quote from the source — value withheld, never fabricated.</span>}
                {quote?.source && <span className="idp__tag">Source: {quote.source}</span>}
                {quote?.entitlement && <span className="idp__tag">{quote.entitlement}</span>}
                {quote?.is_stale && <StalenessChip isStale asOf={quote.received_at ?? ""} />}
              </div>
            </div>
          </section>

          {/* Identity / taxonomy. */}
          <section className="idp__section lf-card">
            <h2 className="idp__h2">Identity</h2>
            {/* Compact metadata strip (DESIGN-SYSTEM §5.2): one row on desktop,
                2-col grid on narrow. Vocab values render as chips. */}
            <div className="lf-card__body">
              <MetaStrip
                items={[
                  { label: "Class", value: chipVal(meta?.asset_class && labelFor("asset_class", meta.asset_class)) },
                  { label: "Subclass", value: chipVal(meta?.asset_subclass && labelFor("asset_subclass", meta.asset_subclass)) },
                  { label: "Exchange", value: meta?.exchange || "—" },
                  { label: "Sector", value: meta?.sector || "—" },
                  { label: "Country", value: meta?.listing_country ?? meta?.country ?? "—" },
                  { label: "Currency", value: meta?.currency || "—" },
                  ...(meta?.source_override ? [{ label: "Source", value: chipVal(labelFor("source_override", meta.source_override)) }] : []),
                ]}
              />
            </div>
          </section>

          {/* Class-conditional provider detail (never fabricated — only if linked). */}
          {detailPanel && (
            <section className="idp__section lf-card">
              <h2 className="idp__h2">{detailPanel[0].replace(/_/g, " ")} detail</h2>
              <div className="lf-card__body">
                <MetaStrip
                  items={Object.entries(detailPanel[1]).map(([k, v]) => ({
                    label: k.replace(/_/g, " "),
                    value: v == null ? "—" : String(v),
                  }))}
                />
              </div>
            </section>
          )}

          {/* Price history — house-SVG chart (D-053). Simple default; period selector
              + Simple/Advanced toggle + crosshair (PROPOSED amendment). Honest short
              history: shows only what exists, labelled, never stretched. */}
          <section className="idp__section lf-card">
            <h2 className="idp__h2">Price history</h2>
            <div className="lf-card__body">
              <PriceChart
                series={series}
                interval={intervalLabel(histInterval)}
                controls
                defaultView="simple"
                periods={PERIODS}
                activePeriod={period}
                onPeriodChange={setPeriod}
                disabledPeriods={disabledPeriods}
                coverageNote={
                  periodIsIntraday
                    ? fetching
                      ? "Fetching intraday prices…"
                      : intraday?.fetch_state === "pending"
                        ? "Intraday prices were requested — not available yet. Try again shortly."
                        : series.length < 2
                          ? "No intraday prices for this range."
                          : coverageNote
                    : series.length < 2
                      ? historyReason
                      : coverageNote
                }
              />
            </div>
          </section>

          {/* Position if held — the canonical holdings reader, scoped (ND-1, P-3). */}
          <section className="idp__section lf-card">
            {/* §12ho1-2: the one linked-summary affordance — the corner ↗, top-right. */}
            <SummaryHead title="Your position" to="/holdings" destination="Holdings" whole />
            {position ? (
              <dl className="idp__facts lf-card__body">
                <Fact label="Quantity" num value={position.quantity != null ? String(position.quantity) : "—"} />
                <Fact label={`Value (${baseCcy})`} num value={position.market_value != null ? formatMoney(position.market_value) : "—"} />
                <Fact label="Cost basis" num value={position.cost_basis != null ? formatMoney(position.cost_basis) : "—"} />
                <Fact label="Unrealised P/L" num value={position.unrealised_pl != null ? formatSignedMoney(position.unrealised_pl) : "—"} signed={position.unrealised_pl} />
              </dl>
            ) : (
              <EmptyState message="Not in your portfolio" reason="You hold no position in this instrument." action={<Link className="lf-btn" to="/holdings">Go to Holdings</Link>} />
            )}
          </section>

          {/* Ongoing cost (expense ratio) — D-029, CLASS-SCOPED to fund wrappers
              (D-099). Not rendered for equity/crypto/manual. Shown as bps (no math). */}
          {isFundWrapped && (
            <section className="idp__section lf-card">
              <h2 className="idp__h2">Ongoing cost (expense ratio)</h2>
              <p className="idp__cost lf-card__body">
                {meta?.annual_cost_bps != null ? `${meta.annual_cost_bps} bps / year` : "— (not set)"}
                <button type="button" className="lf-btn idp__inline" onClick={() => setCostOpen(true)}>Set</button>
              </p>
            </section>
          )}

          {/* AI explainer — DEFERRED to the AI-surfaces milestone (ND-2/ND-5); D-068
              intact. Item-4 layout: sits ABOVE News. */}
          <section className="idp__section lf-card idp__pending">
            <h2 className="idp__h2">Explain this instrument</h2>
            <p className="idp__reason lf-card__body">
              The AI explainer (grounded + validated, D-068/P-6) arrives with the
              AI-surfaces milestone (shared Ask panel). Deferred, not dropped.
            </p>
          </section>

          {/* News — scoped reader (D-037, P-3). Caps at ~5 visible; scrolls internally. */}
          <section className="idp__section lf-card">
            <SummaryHead title="News" to="/news" destination="News" whole />
            <div className="lf-card__body">
              {/* Extracted shared NewsList (page-news ND-5). Scoped view → no per-symbol links. */}
              <NewsList items={news} emptyMessage="No recent news" emptyReason="No provider or feed headlines mention this instrument." />
            </div>
          </section>
        </>
      )}

      {editOpen && meta && (
        <EditDialog
          meta={meta}
          onClose={() => setEditOpen(false)}
          onDone={async () => { setEditOpen(false); await reload(); toast.show({ message: "Saved." }); }}
          onError={(m) => toast.show({ tone: "warning", message: m })}
        />
      )}
      {costOpen && meta && (
        <CostDialog
          symbol={sym}
          current={meta.annual_cost_bps ?? null}
          onClose={() => setCostOpen(false)}
          onDone={async () => { setCostOpen(false); await reload(); toast.show({ message: "Ongoing cost updated." }); }}
          onError={(m) => toast.show({ tone: "warning", message: m })}
        />
      )}
    </div>
  );
}

function Fact({ label, value, chip, signed, num }: { label: string; value?: string | null; chip?: boolean; signed?: number | null; num?: boolean }) {
  const shown = value == null || value === "" ? "—" : value;
  const tone = signed == null ? "" : Number(signed) > 0 ? " idp__up" : Number(signed) < 0 ? " idp__down" : "";
  // Item 3a: numeric values right-aligned + tabular; text values left-aligned.
  return (
    <div className="idp__fact">
      <dt className="idp__factlabel">{label}</dt>
      <dd className={`idp__factval${num ? " idp__factval--num" : ""}${tone}`}>{chip && shown !== "—" ? <span className="idp__chip">{shown}</span> : shown}</dd>
    </div>
  );
}

function EditDialog({
  meta, onClose, onDone, onError,
}: {
  meta: { symbol: string; name?: string | null; asset_class?: string | null; source_override?: string | null; identifiers?: { id_type: string; value: string }[] | null };
  onClose: () => void; onDone: () => void; onError: (m: string) => void;
}) {
  const existingAmfi = (meta.identifiers ?? []).find((i) => i.id_type === "amfi_code")?.value ?? "";
  const [name, setName] = useState(meta.name ?? "");
  const [assetClass, setAssetClass] = useState(meta.asset_class ?? "equity");
  const [source, setSource] = useState(meta.source_override ?? "auto");
  const [amfiCode, setAmfiCode] = useState(existingAmfi);

  // §14dr-6 — amfi_nav is definitionally an official-NAV mutual-fund source and it needs
  // an AMFI scheme mapping in its one home (instrument_identifiers) before the override
  // can validate. Choosing it reveals the code field and pins the class to mutual fund.
  function onSourceChange(v: string) {
    setSource(v);
    if (v === "amfi_nav") setAssetClass("mutual_fund");
  }

  async function save() {
    if (source === "amfi_nav") {
      const code = amfiCode.trim();
      if (!code) return onError("An AMFI scheme code is required to price by amfi_nav.");
      // Compose the canonical writer FIRST so the mapping exists (one home, IA P-1);
      // then the source_override PATCH validates against it.
      if (code !== existingAmfi) {
        const m = await mapAmfi(meta.symbol, code);
        if (!m.ok) return onError(`Couldn't map the AMFI scheme: ${m.error}`);
      }
    }
    const res = await patchInstrument(meta.symbol, {
      name: name.trim() || null,
      asset_class: assetClass,
      // "auto" clears the override on the backend.
      source_override: source,
    });
    if (!res.ok) return onError(`Couldn't save: ${res.error}`);
    onDone();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Edit ${meta.symbol}`}
      size="lg"
      footer={
        <>
          <button type="button" className="lf-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="lf-btn lf-btn--primary" onClick={save}>Save</button>
        </>
      }
    >
      <div className="idp__form idp__form--grid">
        <div className="idp__field idp__field--full">
          <span className="idp__label">Display name</span>
          <TextInput value={name} onChange={setName} aria-label="Display name" placeholder="e.g. Apple Inc." />
        </div>
        <div className="idp__field">
          <span className="idp__label">Asset class</span>
          <MasterSelect master="asset_class" value={assetClass} onChange={setAssetClass} />
        </div>
        <div className="idp__field">
          <span className="idp__label">Source override</span>
          <MasterSelect master="source_override" value={source} onChange={onSourceChange} />
        </div>
        {source === "amfi_nav" && (
          <div className="idp__field idp__field--full">
            <span className="idp__label">AMFI scheme code</span>
            <TextInput value={amfiCode} onChange={setAmfiCode} aria-label="AMFI scheme code" placeholder="e.g. 122639" />
            <span className="idp__sub">amfi_nav prices from the official AMFI NAV — supply the scheme’s AMFI code so the mapping exists.</span>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function CostDialog({
  symbol, current, onClose, onDone, onError,
}: {
  symbol: string; current: number | null;
  onClose: () => void; onDone: () => void; onError: (m: string) => void;
}) {
  const [bps, setBps] = useState(current != null ? String(current) : "");

  async function save() {
    const v = bps.trim() === "" ? null : Number(bps);
    if (v != null && (Number.isNaN(v) || v < 0)) return onError("Ongoing cost (bps) must be zero or more.");
    const res = await setOngoingCost(symbol, v);
    if (!res.ok) return onError(`Couldn't save: ${res.error}`);
    onDone();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Ongoing cost — ${symbol}`}
      footer={
        <>
          <button type="button" className="lf-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="lf-btn lf-btn--primary" onClick={save}>Save</button>
        </>
      }
    >
      <div className="idp__form">
        <div className="idp__field">
          <span className="idp__label">Annual cost (bps)</span>
          <QuantityInput value={bps} onChange={setBps} aria-label="Annual cost (bps)" />
          <span className="idp__sub">Basis points per year (e.g. 20 = 0.20%). Leave blank to clear.</span>
        </div>
      </div>
    </Dialog>
  );
}
