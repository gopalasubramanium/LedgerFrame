// SPDX-License-Identifier: AGPL-3.0-or-later
import { Link } from "react-router-dom";
import {
  DataTable,
  EmptyState,
  PageHeader,
  RowMenu,
  StatusChip,
  Switch,
  TextInput,
  TrendStat,
} from "../components/ui";
import type { Column } from "../components/ui";
import { EMDASH } from "../format/number";
import "./Insurance.css";

// STATIC LAYOUT SPECIMEN — page-insurance §9-1 (the GEOMETRY GATE).
//
// Nothing here is wired: it exists so the owner can RATIFY THE GEOMETRY BY LOOKING, before the page is
// assembled. The ratified ruling (§9-1): a totals TrendStat strip → the policies DataTable as the page
// SPINE (row actions in a ⋯ RowMenu) → upcoming-renewals + cover-by-type as flanking cards.
//
// Every money figure is written AS THE BACKEND SERVES IT (a display string), because that is what the
// page renders (D-105). The protected bar sits in the subtitle (§9-2) + the disclaimer once at the
// table foot. Honesty is staged: a LAPSED policy (visible, excluded from totals + count, §9-10); an
// OVERDUE and a soon renewal (§9-7); a MISSING premium (em dash + reason, never a fabricated 0). The
// empty register and the documents-checklist affordance (composed Switch + TextInput, §9-8) are separate
// frames.

interface PolicyRow {
  id: number;
  name: string;
  insurer: string;
  typeLabel: string;
  cover: string;
  premium: string | null; // null = not recorded → em dash (Guarantee 3)
  renewal: string | null;
  renewalDays: number | null;
  status: "active" | "lapsed" | "expired";
}

// Real-shaped register data (9 policies, mixed types + insurers with long names; SGD base).
const POLICIES: PolicyRow[] = [
  { id: 1, name: "Term Life", insurer: "Prudential Assurance Singapore", typeLabel: "Term life", cover: "500,000.00", premium: "1,200.00", renewal: "2026-08-30", renewalDays: 45, status: "active" },
  { id: 2, name: "Whole Life", insurer: "Great Eastern Life", typeLabel: "Whole life", cover: "200,000.00", premium: "3,600.00", renewal: "2027-02-01", renewalDays: 200, status: "active" },
  { id: 3, name: "IntegratedShield (health)", insurer: "AIA Singapore", typeLabel: "Health", cover: "1,000,000.00", premium: "2,400.00", renewal: "2026-07-28", renewalDays: 12, status: "active" },
  { id: 4, name: "Critical Illness", insurer: "Manulife (Singapore)", typeLabel: "Critical illness", cover: "300,000.00", premium: "1,800.00", renewal: "2026-07-08", renewalDays: -8, status: "active" },
  { id: 5, name: "Personal Accident", insurer: "NTUC Income Insurance Co-operative", typeLabel: "Personal accident", cover: "250,000.00", premium: "480.00", renewal: "2026-10-14", renewalDays: 90, status: "active" },
  { id: 6, name: "Annual Travel", insurer: "Allianz Global Assistance", typeLabel: "Travel", cover: "100,000.00", premium: "320.00", renewal: "2026-12-13", renewalDays: 150, status: "active" },
  { id: 7, name: "Motor (private car)", insurer: "MSIG Insurance", typeLabel: "Motor", cover: "80,000.00", premium: null, renewal: "2026-08-15", renewalDays: 30, status: "active" },
  { id: 8, name: "Home Contents", insurer: "Chubb Insurance Singapore", typeLabel: "Property", cover: "150,000.00", premium: "600.00", renewal: "2027-04-11", renewalDays: 270, status: "active" },
  { id: 9, name: "Endowment (matured)", insurer: "AXA Insurance", typeLabel: "Whole life", cover: "50,000.00", premium: null, renewal: null, renewalDays: null, status: "lapsed" },
];

// Cover-by-type — ACTIVE policies only, backend-served display labels + value_display, sorted desc.
const COVER_BY_TYPE: { label: string; value: string }[] = [
  { label: "Health", value: "1,000,000.00" },
  { label: "Term life", value: "500,000.00" },
  { label: "Critical illness", value: "300,000.00" },
  { label: "Personal accident", value: "250,000.00" },
  { label: "Whole life", value: "200,000.00" },
  { label: "Property", value: "150,000.00" },
  { label: "Travel", value: "100,000.00" },
  { label: "Motor", value: "80,000.00" },
];

// Upcoming renewals — within the 60-day page horizon, overdue included, sorted by days (§9-7).
const RENEWALS = POLICIES.filter((p) => p.status === "active" && p.renewalDays !== null && p.renewalDays <= 60)
  .sort((a, b) => (a.renewalDays ?? 0) - (b.renewalDays ?? 0));

function renewalChip(days: number | null) {
  if (days === null) return null;
  if (days < 0) return <StatusChip label="Overdue" tone="attention" />;
  if (days <= 30) return <StatusChip label="Renews soon" tone="attention" />;
  return null;
}

function statusChip(status: PolicyRow["status"]) {
  if (status === "active") return <StatusChip label="Active" tone="positive" />;
  if (status === "lapsed") return <StatusChip label="Lapsed" tone="attention" />;
  return <StatusChip label="Expired" tone="neutral" />;
}

const COLS: Column<PolicyRow>[] = [
  {
    key: "name",
    label: "Policy",
    sortable: true,
    truncate: true,
    render: (r) => (
      <span className="ins__policycell">
        <span className="ins__pname">{r.name}</span>
        <span className="ins__pinsurer">{r.insurer}</span>
      </span>
    ),
  },
  { key: "typeLabel", label: "Type", sortable: true },
  { key: "cover", label: "Cover", align: "right", sortable: true },
  { key: "premium", label: "Premium / yr", align: "right", sortable: true, render: (r) => r.premium ?? <span className="ins__missing" title="No premium recorded">{EMDASH}</span> },
  {
    key: "renewal",
    label: "Renewal",
    sortable: true,
    render: (r) =>
      r.renewal ? (
        <span className="ins__renewalcell">
          <span>{r.renewal}</span>
          {renewalChip(r.renewalDays)}
        </span>
      ) : (
        <span className="ins__missing">{EMDASH}</span>
      ),
  },
  { key: "status", label: "Status", render: (r) => statusChip(r.status) },
  {
    key: "id",
    label: "",
    render: () => (
      <RowMenu
        aria-label="Policy actions"
        items={[
          { label: "Details", onClick: () => {} },
          { label: "Edit", onClick: () => {} },
          { label: "Delete", onClick: () => {}, danger: true },
        ]}
      />
    ),
  },
];

function Totals() {
  return (
    <section className="ins__totals" data-card="totals">
      <TrendStat label="Total cover" value="2,580,000.00" />
      <TrendStat label="Cash value (excluded)" value="42,000.00" />
      <TrendStat label="Annual premium" value="10,400.00" />
      <TrendStat label="Active policies" value="8" />
    </section>
  );
}

function Flanking() {
  return (
    <div className="ins__flank">
      <section className="lf-card ins__card" data-card="renewals">
        <header className="ins__cardhead"><h2 className="lf-card__title">Upcoming renewals</h2></header>
        <div className="lf-card__body">
          <ul className="ins__renewals">
            {RENEWALS.map((r) => (
              <li key={r.id} className="ins__renewalrow">
                <span className="ins__rname">{r.name}</span>
                <span className="ins__rdate">{r.renewal}</span>
                {renewalChip(r.renewalDays) ?? <span className="ins__rdays">in {r.renewalDays} days</span>}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="lf-card ins__card" data-card="cover-by-type">
        <header className="ins__cardhead"><h2 className="lf-card__title">Cover by type</h2></header>
        <div className="lf-card__body">
          <ul className="ins__bytype">
            {COVER_BY_TYPE.map((c) => (
              <li key={c.label} className="ins__typerow">
                <span className="ins__tlabel">{c.label}</span>
                <span className="ins__tvalue">{c.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

export function InsuranceMockup({ variant = "populated" }: { variant?: "populated" | "empty" }) {
  return (
    <div className="lf-page ins">
      <PageHeader title="Insurance" subtitle="Your protection register — policies, cover and renewals. A register, never an adequacy judgment." />

      {variant === "empty" ? (
        <EmptyState
          message="No policies yet"
          reason="Add your first policy to build your protection register — cover, premiums, renewals and documents."
          action={<button type="button" className="lf-btn lf-btn--primary">Add policy</button>}
        />
      ) : (
        <>
          <Totals />

          <section className="lf-card ins__section" data-card="policies">
            <header className="ins__cardhead">
              <h2 className="lf-card__title">Policies</h2>
              <button type="button" className="lf-btn lf-btn--primary ins__add">Add policy</button>
            </header>
            <div className="lf-card__body">
              <DataTable<PolicyRow> caption="Insurance policies" columns={COLS} rows={POLICIES} stickyHeader />
              {/* §9-2 — the protected disclaimer once at the table foot (never per row). */}
              <p className="lf-card__footnote">
                Records and reminders only — not an assessment of whether your cover is adequate, and not advice.
                Base-currency totals use current FX. Lapsed and expired policies are shown but excluded from the
                totals and the active count. Insurance cash value is excluded from Net worth — <Link to="/net-worth">see Net worth</Link>.
              </p>
            </div>
          </section>

          <Flanking />
        </>
      )}
    </div>
  );
}

// The documents-checklist affordance (§9-8, Amendment D) — composed from ratified Switch + TextInput
// rows inside the editor (no new component). Seeded with the four default labels; user-editable.
export function InsuranceDocumentsChecklistSpecimen() {
  const DEFAULTS = ["Policy schedule", "Premium receipts", "Nominee form", "Terms & conditions"];
  const have = [true, false, true, false];
  return (
    <div className="ins__editorframe">
      <h3 className="ins__editorh">Documents checklist <span className="ins__editorhint">(part of the Add / Edit policy dialog)</span></h3>
      <ul className="ins__checklist">
        {DEFAULTS.map((label, i) => (
          <li key={label} className="ins__checkrow">
            <Switch checked={have[i]} onChange={() => {}} label={label} />
          </li>
        ))}
      </ul>
      <div className="ins__addlabel">
        <TextInput value="" onChange={() => {}} placeholder="Add another document…" aria-label="Add a document label" />
        <button type="button" className="lf-btn">Add</button>
      </div>
    </div>
  );
}
