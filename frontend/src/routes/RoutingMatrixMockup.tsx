// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  DataTable,
  EmptyState,
  MasterSelect,
  MetaStrip,
  StatusChip,
} from "../components/ui";
import type { Column } from "../components/ui";
import type { RefOption } from "../mocks/refdata";

// STATIC LAYOUT SPECIMEN — data-feed-routing Phase 0a (the GEOMETRY / COMPONENT GATE).
//
// Nothing here is wired to the backend: it exists so the owner can RATIFY BY LOOKING before
// assembly (Phase 1 is BLOCKED until then). It stages what Phase 0 built, in served strings only.
//
// §9-9 COMPONENT FINDING (the amendment gate): the editable-cell grid COMPOSES CLEANLY from
// ratified components — a `DataTable` whose provider column uses `Column.render` to host a
// `MasterSelect`, with a `StatusChip` for the honest cell state and a `Button` to clear.
// No new affordance is needed, so NO §5 amendment is raised. (Had it not composed, both options'
// pixels would be shown here instead — the route-chain precedent.)
//
// HONESTY, staged (data-feed-routing §9): a mapped HEALTHY cell (§9-1); an unkeyed DEGRADED cell
// with the caveat chip + Settings pointer (§9-7); a TIER-DEGRADED served string (§9-8, the
// Markets-surface case — index is not a holdings lane, shown for completeness); a CAPABILITY
// MISMATCH 400 rendered as the honest edit-time reason (§9-3); and the EMPTY matrix (= today,
// nothing implied — §9-2). Plus the Pricing Health provenance column with all four route_rule
// values (override · matrix · lane · active — §9-10), read-only (D-072).
//
// NO money math anywhere (this surface has none). Every provider/class/country/state is a SERVED
// display string (D-005) — the frontend computes no routing decision (D-105).

// Served provider options (D-005 — mirrors the backend CAPABILITIES list the real editor loads
// from /refdata; capability-filtered per cell at assembly). Providers are shown by name, the
// Settings-only "Provider" word (D-028).
const PROVIDERS: RefOption[] = [
  { value: "mock", label: "mock" },
  { value: "csv", label: "csv" },
  { value: "yahoo", label: "yahoo" },
  { value: "alphavantage", label: "alphavantage" },
  { value: "eodhd", label: "eodhd" },
  { value: "coingecko", label: "coingecko" },
  { value: "amfi_nav", label: "amfi_nav" },
];

type CellState = "active" | "degraded";

interface Cell {
  key: string;
  assetClass: string;   // served label
  market: string;       // served listing-country label ("US" / "IN" / "All markets")
  provider: string;     // served CAPABILITIES name
  state: CellState;
  caveat: string | null;   // served honest string when degraded
}

const CELLS: Cell[] = [
  { key: "equity-us", assetClass: "Equity", market: "US", provider: "yahoo",
    state: "active", caveat: null },
  { key: "equity-in", assetClass: "Equity", market: "IN", provider: "eodhd",
    state: "degraded", caveat: "needs credentials" },
  { key: "crypto-all", assetClass: "Crypto", market: "All markets", provider: "coingecko",
    state: "active", caveat: null },
];

function CellStateChip({ state, caveat }: { state: CellState; caveat: string | null }) {
  if (state === "active") return <StatusChip label="Active" tone="positive" />;
  // Degraded: the caveat is the label (a chip's meaning is never colour alone), with a
  // Settings pointer as part of the visible label (§9-7 — never a silent dead cell).
  return (
    <StatusChip
      tone="attention"
      label={
        <>
          {caveat} — add in <Link to="/settings?tab=data-feeds">Settings</Link>
        </>
      }
    />
  );
}

/** The editor grid — the canonical home is Settings → Data feeds (§14st-1). */
function MatrixEditor() {
  // Unwired: local state only, so the MasterSelect is clickable in the specimen. Nothing persists.
  const [draft, setDraft] = useState<Record<string, string>>(
    Object.fromEntries(CELLS.map((c) => [c.key, c.provider])),
  );

  const columns: Column<Cell>[] = [
    { key: "assetClass", label: "Asset class" },
    { key: "market", label: "Market" },
    {
      key: "provider",
      label: "Provider",
      render: (row) => (
        <MasterSelect
          master="source_override"
          options={PROVIDERS}
          value={draft[row.key] ?? row.provider}
          onChange={(v) => setDraft((d) => ({ ...d, [row.key]: v }))}
          aria-label={`Provider for ${row.assetClass} · ${row.market}`}
        />
      ),
    },
    {
      key: "state",
      label: "State",
      render: (row) => <CellStateChip state={row.state} caveat={row.caveat} />,
    },
    {
      key: "key",
      label: "",
      align: "right",
      render: (row) => (
        <Button
          onClick={() => window.alert(`Clear ${row.assetClass} · ${row.market} (unwired specimen)`)}
        >
          Clear
        </Button>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={CELLS}
      caption="Routing matrix — one provider per asset-class × market. A cell only takes effect when its provider can actually price the instrument; otherwise routing falls through to the default lane."
    />
  );
}

/** The Pricing Health provenance column (read-only, D-072) — all four route_rule values. */
interface ProvRow {
  key: string;
  holding: string;
  source: string;     // what actually priced it (served)
  rule: string;       // route_rule: override | matrix | lane | active
}

const PROV_ROWS: ProvRow[] = [
  { key: "1", holding: "AAPL · Apple Inc.", source: "yahoo", rule: "matrix" },
  { key: "2", holding: "VOO · Vanguard S&P 500", source: "eodhd", rule: "override" },
  { key: "3", holding: "INFY · Infosys", source: "mock", rule: "active" },
  { key: "4", holding: "HDFC Flexi Cap (NAV)", source: "amfi_nav", rule: "lane" },
];

function ruleChip(rule: string) {
  // route_rule values are served PLAIN labels (no glossary entries, §9-T). Tone is neutral —
  // provenance is factual, never alarmist.
  return <StatusChip label={rule} tone="neutral" />;
}

function ProvenanceColumn() {
  const columns: Column<ProvRow>[] = [
    { key: "holding", label: "Holding", truncate: true },
    { key: "source", label: "Source" },
    { key: "rule", label: "Rule", render: (r) => ruleChip(r.rule) },
  ];
  return (
    <DataTable
      columns={columns}
      rows={PROV_ROWS}
      caption="Pricing Health provenance — which provider priced each holding, via which rule (read-only, D-072)."
    />
  );
}

export function RoutingMatrixMockup() {
  return (
    <div className="ks__stack">
      {/* The editor grid — DataTable + MasterSelect + StatusChip, composed (§9-9, no amendment). */}
      <MatrixEditor />

      {/* §9-3 — capability mismatch is an HONEST edit-time 400, rendered as the reason (never a
          silent no-op). Staged as the inline error the PUT returns. */}
      <div className="ks__row" role="alert">
        <StatusChip tone="negative" label="Can’t save" />{" "}
        <span>kite doesn’t cover US — pick a provider that can price US equity.</span>
      </div>

      {/* §9-8 — the tier-degraded served string. Index is NOT a holdings lane, so this is the
          Markets-surface case, shown for completeness. The string is served, never a fabricated
          real-index label. */}
      <div className="ks__row">
        <StatusChip tone="attention" label="index via ETF proxy — key not premium" />{" "}
        <span>Alpha Vantage on a non-premium key — real index levels fall back to ETF proxies.</span>
      </div>

      {/* §9-2 — the EMPTY matrix changes nothing. */}
      <EmptyState
        message="No routing rules yet"
        reason="An empty matrix changes nothing — every holding routes by its default lane and your active provider, exactly as today. Add a rule to prefer a specific provider for an asset-class in a market."
      />

      {/* §9-10 — the provenance column on Pricing Health, all four route_rule values, read-only. */}
      <ProvenanceColumn />

      {/* One holding's route detail as a MetaStrip (the existing route-chain affordance). */}
      <MetaStrip
        items={[
          { label: "Source", value: "yahoo" },
          { label: "Rule", value: "matrix" },
          { label: "Lane", value: "us_equity" },
          { label: "Chain", value: "eodhd → alphavantage → yahoo → csv → manual" },
        ]}
      />
    </div>
  );
}
