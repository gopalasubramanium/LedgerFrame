import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "./InstrumentDetail.css";
import {
  Dialog,
  EmptyState,
  MasterSelect,
  MetaStrip,
  PageHeader,
  PriceChart,
  QuantityInput,
  StalenessChip,
  TextInput,
  useToast,
} from "../components/ui";
import type { PricePoint } from "../mocks/types";
import {
  getInstrument,
  getInstrumentHistory,
  getInstrumentNews,
  getInstrumentPosition,
  patchInstrument,
  setOngoingCost,
} from "../api/instruments";
import type { Candle, InstrumentDetail as Detail, NewsItem } from "../api/instruments";
import type { HoldingRow } from "../api/holdings";
import { useLabelFor } from "../refdata/refdata-context";
import { formatMoney, formatPrice, formatSignedMoney } from "../format/number";

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

  // Price history refetches when the period changes (server slices the range).
  useEffect(() => {
    let live = true;
    getInstrumentHistory(sym, periodToDays(period)).then((h) => {
      if (live) setCandles(h.ok ? h.data.candles : []);
    });
    return () => { live = false; };
  }, [sym, period]);

  const series = useMemo<PricePoint[]>(
    () => candles.map((c) => ({ t: c.ts.slice(0, 10), open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume })),
    [candles],
  );
  // Honest short-history: label when the data covers less than the requested period.
  const coverageNote = useMemo(() => {
    if (series.length < 2) return undefined;
    const wanted = periodToDays(period);
    const first = new Date(series[0].t).getTime();
    const last = new Date(series[series.length - 1].t).getTime();
    const haveDays = Math.round((last - first) / 86400000);
    return haveDays < wanted * 0.9 ? `Only ${haveDays} day${haveDays === 1 ? "" : "s"} of history available` : undefined;
  }, [series, period]);

  const meta = detail?.instrument;
  const quote = detail?.quote;
  const historyReason =
    typeof meta?.history_status === "string" ? meta.history_status : "No price history from the source.";
  const assetDetail = meta?.asset_detail ?? {};
  const detailPanel = Object.entries(assetDetail)[0]; // class-conditional: mutual_fund / crypto / derivative
  // D-099: an ongoing cost (expense ratio) applies only to fund-wrapped classes.
  const isFundWrapped = ["mutual_fund", "etf"].includes(meta?.asset_class ?? "");

  return (
    <div className="ins">
      <PageHeader
        title={sym}
        subtitle={
          meta?.name
            ? `${meta.name} — a scoped view; canonical on Markets & Portfolio`
            : "A scoped view; canonical on Markets & Portfolio"
        }
        actions={
          <>
            {/* Expense ratio is fund-only — the action appears only there. */}
            {isFundWrapped && (
              <button type="button" className="lf-btn" onClick={() => setCostOpen(true)}>Ongoing cost</button>
            )}
            {/* Page-action icon button (§11-13): icon-only + tooltip/aria-label. */}
            <button
              type="button"
              className="lf-iconbtn"
              onClick={() => setEditOpen(true)}
              title="Edit"
              aria-label="Edit"
            >
              ✎
            </button>
          </>
        }
      />

      {loading ? (
        <EmptyState message="Loading…" reason="Fetching from the market & portfolio readers." />
      ) : error ? (
        <EmptyState
          message="Couldn't load this instrument"
          reason={`The reader is unreachable (${error}). Values are withheld, never guessed.`}
          action={<button type="button" className="lf-btn" onClick={reload}>Retry</button>}
        />
      ) : (
        <>
          {/* Quote — the canonical Markets reader, scoped. Unpriced → "—" + reason. */}
          <section className="ins__section lf-card ins__quote">
            <div className="ins__cardhead">
              <h2 className="ins__h2">Quote</h2>
              <Link className="ins__link" to="/markets">Markets ↗</Link>
            </div>
            <div className="lf-card__body">
              <div className="ins__price">
                {quote?.price != null ? (
                  <span className="ins__pricenum">{quote.currency} {formatPrice(quote.price)}</span>
                ) : (
                  <span className="ins__pricenum ins__muted">—</span>
                )}
                {quote?.change != null && (
                  <span className={`ins__change ${Number(quote.change) >= 0 ? "ins__up" : "ins__down"}`}>
                    {formatSignedMoney(quote.change)}
                    {quote.change_pct != null ? ` (${Number(quote.change_pct).toFixed(2)}%)` : ""}
                  </span>
                )}
              </div>
              <div className="ins__prov">
                {quote?.price == null && <span className="ins__reason">No live quote from the source — value withheld, never fabricated.</span>}
                {quote?.source && <span className="ins__tag">Source: {quote.source}</span>}
                {quote?.entitlement && <span className="ins__tag">{quote.entitlement}</span>}
                {quote?.is_stale && <StalenessChip isStale asOf={quote.received_at ?? ""} />}
              </div>
            </div>
          </section>

          {/* Identity / taxonomy. */}
          <section className="ins__section lf-card">
            <h2 className="ins__h2">Identity</h2>
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
            <section className="ins__section lf-card">
              <h2 className="ins__h2">{detailPanel[0].replace(/_/g, " ")} detail</h2>
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
          <section className="ins__section lf-card">
            <h2 className="ins__h2">Price history</h2>
            <div className="lf-card__body">
              <PriceChart
                series={series}
                interval="1d"
                controls
                defaultView="simple"
                periods={PERIODS}
                activePeriod={period}
                onPeriodChange={setPeriod}
                coverageNote={series.length < 2 ? historyReason : coverageNote}
              />
            </div>
          </section>

          {/* Position if held — the canonical holdings reader, scoped (ND-1, P-3). */}
          <section className="ins__section lf-card">
            {/* D-100 companion: the canonical-home cross-link lives in the card
                HEADER, top-right (the News pattern), for every summary-with-link card. */}
            <div className="ins__cardhead">
              <h2 className="ins__h2">Your position</h2>
              <Link className="ins__link" to="/holdings">Holdings ↗</Link>
            </div>
            {position ? (
              <dl className="ins__facts lf-card__body">
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
            <section className="ins__section lf-card">
              <h2 className="ins__h2">Ongoing cost (expense ratio)</h2>
              <p className="ins__cost lf-card__body">
                {meta?.annual_cost_bps != null ? `${meta.annual_cost_bps} bps / year` : "— (not set)"}
                <button type="button" className="lf-btn ins__inline" onClick={() => setCostOpen(true)}>Set</button>
              </p>
            </section>
          )}

          {/* AI explainer — DEFERRED to the AI-surfaces milestone (ND-2/ND-5); D-068
              intact. Item-4 layout: sits ABOVE News. */}
          <section className="ins__section lf-card ins__pending">
            <h2 className="ins__h2">Explain this instrument</h2>
            <p className="ins__reason lf-card__body">
              The AI explainer (grounded + validated, D-068/P-6) arrives with the
              AI-surfaces milestone (shared Ask panel). Deferred, not dropped.
            </p>
          </section>

          {/* News — scoped reader (D-037, P-3). Caps at ~5 visible; scrolls internally. */}
          <section className="ins__section lf-card">
            <div className="ins__cardhead">
              <h2 className="ins__h2">News</h2>
              <Link className="ins__link" to="/news">News ↗</Link>
            </div>
            {news.length > 0 ? (
              <ul className="ins__news lf-card__body">
                {news.map((n, i) => (
                  <li key={i} className="ins__newsitem">
                    <a href={n.url ?? "#"} target="_blank" rel="noreferrer" className="ins__newshead">{n.headline}</a>
                    <span className="ins__newsmeta">{n.source} · {n.published_at.slice(0, 10)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState message="No recent news" reason="No provider or feed headlines mention this instrument." />
            )}
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
  const tone = signed == null ? "" : Number(signed) > 0 ? " ins__up" : Number(signed) < 0 ? " ins__down" : "";
  // Item 3a: numeric values right-aligned + tabular; text values left-aligned.
  return (
    <div className="ins__fact">
      <dt className="ins__factlabel">{label}</dt>
      <dd className={`ins__factval${num ? " ins__factval--num" : ""}${tone}`}>{chip && shown !== "—" ? <span className="ins__chip">{shown}</span> : shown}</dd>
    </div>
  );
}

function EditDialog({
  meta, onClose, onDone, onError,
}: {
  meta: { symbol: string; name?: string | null; asset_class?: string | null; source_override?: string | null };
  onClose: () => void; onDone: () => void; onError: (m: string) => void;
}) {
  const [name, setName] = useState(meta.name ?? "");
  const [assetClass, setAssetClass] = useState(meta.asset_class ?? "equity");
  const [source, setSource] = useState(meta.source_override ?? "auto");

  async function save() {
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
      <div className="ins__form ins__form--grid">
        <div className="ins__field ins__field--full">
          <span className="ins__label">Display name</span>
          <TextInput value={name} onChange={setName} aria-label="Display name" placeholder="e.g. Apple Inc." />
        </div>
        <div className="ins__field">
          <span className="ins__label">Asset class</span>
          <MasterSelect master="asset_class" value={assetClass} onChange={setAssetClass} />
        </div>
        <div className="ins__field">
          <span className="ins__label">Source override</span>
          <MasterSelect master="source_override" value={source} onChange={setSource} />
        </div>
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
      <div className="ins__form">
        <div className="ins__field">
          <span className="ins__label">Annual cost (bps)</span>
          <QuantityInput value={bps} onChange={setBps} aria-label="Annual cost (bps)" />
          <span className="ins__sub">Basis points per year (e.g. 20 = 0.20%). Leave blank to clear.</span>
        </div>
      </div>
    </Dialog>
  );
}
