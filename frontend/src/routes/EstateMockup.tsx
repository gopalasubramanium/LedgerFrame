// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  DataTable,
  EmptyState,
  MetaStrip,
  PageHeader,
  RowMenu,
  StatusChip,
  Switch,
  TextInput,
  TrendStat,
} from "../components/ui";
import type { Column, MetaItem } from "../components/ui";
import { EMDASH } from "../format/number";
import "./Estate.css";

// STATIC LAYOUT SPECIMEN — page-estate §9 / Phase 0a (the GEOMETRY GATE).
//
// Nothing here is wired: it exists so the owner can RATIFY THE GEOMETRY BY LOOKING, before the page is
// assembled (Phase 1 is BLOCKED until then). The proposed ruling §-geometry: a profile card (will
// status leads · executor · will location · review dates · notes, [S]-gated edit affordance shown) →
// a readiness COUNTS strip (counts only, NO currency affix — there is no money on this page, §9-3) →
// a contacts DataTable (name · roles as served-label chips · phone · email · ⋯ RowMenu) → a documents
// DataTable (title · category label · status chip · location · review date · ⋯ RowMenu) → the RATIFIED
// disclaimer bar once at the foot.
//
// Honesty is staged: a MISSING and two OUTDATED document rows (attention tone, factual not alarmist);
// blank OPTIONAL fields as BARE em dashes (user-data-absent — the §12in-4 carry-over: a reason pill is
// for an empty REGION, not an empty CELL); and a separate ALL-EMPTY frame where each register shows its
// own EmptyState (reason + CTA) and the profile sits at will_status `none`. Roles/category/status render
// from the SERVED {value,label} labels, never client-cased. StatusChip tones are factual (present =
// positive; missing/outdated = attention — the Insurance precedent). Composed ratified ui/ only.
//
// DESIGN NOTE (owner, decide at the gate): will_status LEADS the profile card (its canonical home), so
// the readiness strip stays COUNTS-ONLY per the §9-3 ruling — the strip is not the place for a status.

// --- served vocabulary labels (from /refdata; the UI renders these, never a client mapping) --------- #
const ROLE_LABEL: Record<string, string> = {
  nominee: "Nominee",
  beneficiary: "Beneficiary",
  executor: "Executor",
  emergency: "Emergency",
  guardian: "Guardian",
};
const CATEGORY_LABEL: Record<string, string> = {
  will: "Will",
  insurance: "Insurance",
  property: "Property",
  loan: "Loan",
  identity: "Identity",
  bank: "Bank",
  tax: "Tax",
  medical: "Medical",
  other: "Other",
};

// --- real-shaped register data --------------------------------------------------------------------- #
interface ContactRow {
  id: number;
  name: string;
  roles: string[];
  phone: string | null; // null = not recorded → bare em dash (Guarantee 3 / §12in-4)
  email: string | null;
}

// 7 contacts; contact #1 holds three roles; long hyphenated names exercise truncation.
const CONTACTS: ContactRow[] = [
  { id: 1, name: "Priya Raghunathan-Venkataraman", roles: ["executor", "beneficiary", "emergency"], phone: "+65 9123 4567", email: "priya.rv@example.com" },
  { id: 2, name: "Arjun Mehta", roles: ["nominee", "beneficiary"], phone: "+65 8234 5678", email: "arjun.mehta@example.com" },
  { id: 3, name: "Lakshmi Narasimhan", roles: ["guardian"], phone: "+65 8345 6789", email: null },
  { id: 4, name: "David Okonkwo-Williams", roles: ["emergency"], phone: null, email: "d.okonkwo@example.com" },
  { id: 5, name: "Chen Wei", roles: ["beneficiary"], phone: "+65 8456 7890", email: "chen.wei@example.com" },
  { id: 6, name: "Fatima Al-Rashid", roles: ["nominee", "guardian"], phone: "+65 8567 8901", email: "fatima.ar@example.com" },
  { id: 7, name: "Sanjay Gupta", roles: ["executor"], phone: "+65 8678 9012", email: null },
];

interface DocRow {
  id: number;
  title: string;
  category: string;
  status: "present" | "missing" | "outdated";
  location: string | null;
  review: string | null;
}

// 10 documents; mixed categories; one MISSING (#6), two OUTDATED (#4, #9); blank optional cells as em dashes.
const DOCUMENTS: DocRow[] = [
  { id: 1, title: "Last Will and Testament", category: "will", status: "present", location: "Home safe (fireproof box)", review: "2027-01-15" },
  { id: 2, title: "Term Life Policy Schedule", category: "insurance", status: "present", location: "Filing cabinet A", review: "2026-11-01" },
  { id: 3, title: "Property Title Deed (Apartment)", category: "property", status: "present", location: "Bank safe-deposit locker", review: null },
  { id: 4, title: "Home Loan Agreement", category: "loan", status: "outdated", location: "Bank safe-deposit locker", review: "2026-03-01" },
  { id: 5, title: "Passport (primary holder)", category: "identity", status: "present", location: "Home safe", review: "2029-06-01" },
  { id: 6, title: "Passport (spouse)", category: "identity", status: "missing", location: null, review: null },
  { id: 7, title: "Bank Account Details", category: "bank", status: "present", location: "Password manager", review: null },
  { id: 8, title: "Income Tax Returns 2025", category: "tax", status: "present", location: "Cloud drive", review: null },
  { id: 9, title: "Medical Directive / Living Will", category: "medical", status: "outdated", location: "Home safe", review: "2026-01-01" },
  { id: 10, title: "Vehicle Registration", category: "other", status: "present", location: "Glovebox", review: null },
];

function bare(value: string | null) {
  return value ?? <span className="est__missing">{EMDASH}</span>;
}

function statusChip(status: DocRow["status"]) {
  if (status === "present") return <StatusChip label="Present" tone="positive" />;
  if (status === "missing") return <StatusChip label="Missing" tone="attention" />;
  return <StatusChip label="Outdated" tone="attention" />;
}

function rolesCell(roles: string[]) {
  if (roles.length === 0) return <span className="est__missing">{EMDASH}</span>;
  return (
    <span className="est__roles">
      {roles.map((r) => (
        <span key={r} className="lf-chip">{ROLE_LABEL[r] ?? r}</span>
      ))}
    </span>
  );
}

const CONTACT_COLS: Column<ContactRow>[] = [
  { key: "name", label: "Name", sortable: true, truncate: true, render: (r) => <span className="est__name">{r.name}</span> },
  { key: "roles", label: "Roles", render: (r) => rolesCell(r.roles) },
  { key: "phone", label: "Phone", render: (r) => bare(r.phone) },
  { key: "email", label: "Email", truncate: true, render: (r) => bare(r.email) },
  {
    key: "id",
    label: "",
    render: () => (
      <RowMenu
        aria-label="Contact actions"
        items={[
          { label: "Edit", onClick: () => {} },
          { label: "Delete", onClick: () => {}, danger: true },
        ]}
      />
    ),
  },
];

const DOC_COLS: Column<DocRow>[] = [
  { key: "title", label: "Document", sortable: true, truncate: true, render: (r) => <span className="est__name">{r.title}</span> },
  { key: "category", label: "Category", sortable: true, render: (r) => <span className="lf-chip">{CATEGORY_LABEL[r.category] ?? r.category}</span> },
  { key: "status", label: "Status", render: (r) => statusChip(r.status) },
  { key: "location", label: "Location", truncate: true, render: (r) => bare(r.location) },
  { key: "review", label: "Review date", sortable: true, render: (r) => bare(r.review) },
  {
    key: "id",
    label: "",
    render: () => (
      <RowMenu
        aria-label="Document actions"
        items={[
          { label: "Edit", onClick: () => {} },
          { label: "Delete", onClick: () => {}, danger: true },
        ]}
      />
    ),
  },
];

// --- profile card ---------------------------------------------------------------------------------- #
function willStatusChip(status: "none" | "draft" | "executed" | "needs_update") {
  if (status === "executed") return <StatusChip label="Executed" tone="positive" />;
  if (status === "needs_update") return <StatusChip label="Needs update" tone="attention" />;
  if (status === "draft") return <StatusChip label="Draft" tone="neutral" />;
  return <StatusChip label="Not recorded" tone="neutral" />;
}

function ProfileCard({ empty = false }: { empty?: boolean }) {
  const status = empty ? "none" : "executed";
  const items: MetaItem[] = [
    { label: "Executor", value: empty ? <span className="est__missing">{EMDASH}</span> : "Priya Raghunathan-Venkataraman" },
    { label: "Will location", value: empty ? <span className="est__missing">{EMDASH}</span> : "Home safe (fireproof box)" },
    { label: "Last reviewed", value: empty ? <span className="est__missing">{EMDASH}</span> : "2026-01-20" },
    { label: "Next review", value: empty ? <span className="est__missing">{EMDASH}</span> : "2027-01-15" },
  ];
  return (
    <section className="lf-card est__profile" data-card="profile">
      <header className="est__cardhead">
        <h2 className="lf-card__title">Estate profile</h2>
        {/* [S]-gated edit affordance — shown, disabled here (a static specimen has no session). */}
        <button type="button" className="lf-btn est__edit" disabled title="Editing needs an unlocked session">Edit</button>
      </header>
      <div className="lf-card__body est__profilebody">
        <div className="est__willstatus">
          <span className="est__willlabel">Will status</span>
          {willStatusChip(status)}
        </div>
        <MetaStrip items={items} />
        <div className="est__notes">
          <span className="est__willlabel">Notes</span>
          <p className="est__notestext">
            {empty ? <span className="est__missing">{EMDASH}</span>
              : "Solicitor: Wong & Partners. Signed copies held by the executor and in the bank locker."}
          </p>
        </div>
      </div>
    </section>
  );
}

// --- readiness strip (COUNTS ONLY — no currency affix, §9-3) ---------------------------------------- #
function ReadinessStrip() {
  return (
    <section className="est__readiness" data-card="readiness">
      <TrendStat label="Documents present" value="7" />
      <TrendStat label="Needs attention" value="3" />
      <TrendStat label="Nominees & beneficiaries" value="5" />
      <TrendStat label="Executors" value="2" />
      <TrendStat label="Emergency contacts" value="2" />
    </section>
  );
}

const DISCLAIMER =
  "Family governance — a record of what exists and where, and reminders to keep it current. " +
  "Not legal or estate-planning advice.";

export function EstateMockup({ variant = "populated" }: { variant?: "populated" | "empty" }) {
  const empty = variant === "empty";
  return (
    <div className="lf-page est">
      <PageHeader
        title="Estate"
        subtitle="A readiness register — will, contacts and key documents. A record and reminders, never legal advice."
      />

      <ProfileCard empty={empty} />

      {empty ? (
        <>
          <section className="lf-card est__section" data-card="contacts">
            <header className="est__cardhead"><h2 className="lf-card__title">Contacts</h2></header>
            <div className="lf-card__body">
              <EmptyState
                message="No contacts yet"
                reason="Add the people who matter to your estate — executors, beneficiaries, guardians and emergency contacts, with their roles."
                action={<button type="button" className="lf-btn lf-btn--primary">Add contact</button>}
              />
            </div>
          </section>

          <section className="lf-card est__section" data-card="documents">
            <header className="est__cardhead"><h2 className="lf-card__title">Documents</h2></header>
            <div className="lf-card__body">
              <EmptyState
                message="No documents yet"
                reason="Record where your key documents live — will, deeds, policies, identity and more — and whether each is present, missing or outdated."
                action={<button type="button" className="lf-btn lf-btn--primary">Add document</button>}
              />
            </div>
          </section>
        </>
      ) : (
        <>
          <ReadinessStrip />

          <section className="lf-card est__section" data-card="contacts">
            <header className="est__cardhead">
              <h2 className="lf-card__title">Contacts</h2>
              <button type="button" className="lf-btn lf-btn--primary est__add">Add contact</button>
            </header>
            <div className="lf-card__body">
              <DataTable<ContactRow> caption="Estate contacts" columns={CONTACT_COLS} rows={CONTACTS} stickyHeader />
            </div>
          </section>

          <section className="lf-card est__section" data-card="documents">
            <header className="est__cardhead">
              <h2 className="lf-card__title">Documents</h2>
              <button type="button" className="lf-btn lf-btn--primary est__add">Add document</button>
            </header>
            <div className="lf-card__body">
              <DataTable<DocRow> caption="Estate documents" columns={DOC_COLS} rows={DOCUMENTS} stickyHeader />
            </div>
          </section>
        </>
      )}

      {/* The RATIFIED disclaimer once at the foot (never per row). Verbatim — do not reword (§9-10). */}
      <p className="est__disclaimer">{DISCLAIMER}</p>
    </div>
  );
}

// The contact ROLES multi-select affordance (§9-6) — composed from ratified Switch rows (one per role)
// inside the Add / Edit contact dialog. NO new component (MultiSelect declined). A contact may hold
// several roles, so this is a set of toggles, not a single-select.
export function EstateRolesSpecimen() {
  const ROLES = ["nominee", "beneficiary", "executor", "emergency", "guardian"] as const;
  const on: Record<string, boolean> = { nominee: false, beneficiary: true, executor: true, emergency: true, guardian: false };
  return (
    <div className="est__editorframe">
      <h3 className="est__editorh">Roles <span className="est__editorhint">(part of the Add / Edit contact dialog)</span></h3>
      <ul className="est__rolelist">
        {ROLES.map((r) => (
          <li key={r} className="est__rolerow">
            <Switch checked={on[r]} onChange={() => {}} label={ROLE_LABEL[r]} />
          </li>
        ))}
      </ul>
      <div className="est__addhint">
        <TextInput value="" onChange={() => {}} placeholder="Contact name…" aria-label="Contact name" />
        <span className="est__editorhint">Name is required; roles, phone, email and notes are optional.</span>
      </div>
    </div>
  );
}
