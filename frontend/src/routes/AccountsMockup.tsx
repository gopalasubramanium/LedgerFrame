// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  Button,
  DataTable,
  EmptyState,
  MasterSelect,
  PageHeader,
  RowMenu,
} from "../components/ui";
import type { Column, FooterRow } from "../components/ui";
import { EMDASH } from "../format/number";
import { Plus } from "../icons";
import "./Accounts.css";

// STATIC LAYOUT SPECIMEN — page-accounts §9 / Phase 0a (the GEOMETRY GATE).
//
// Nothing here is wired: it exists so the owner can RATIFY THE GEOMETRY BY LOOKING, before the page is
// assembled (Phase 1 is BLOCKED until then). The proposed §-geometry (worklist template): the Accounts
// DataTable is the page SPINE (institution · kind · currency · cost basis · entity · value · ⋯ RowMenu,
// with a footer Σ totals row) → the Entities card (D-065) → the Institution master card (D-008). Two
// masters land on this page, so the two management cards flank the spine.
//
// Every money figure is written AS THE BACKEND SERVES IT (a display string, D-105) — the frontend
// computes nothing here. Per-account value is the base-currency rollup (§9-10); a non-base account
// carries its native code in the Currency column (§12in-1); the footer Σ is `total_display` with the
// base-currency affix once (§14in-7). Labels are the SERVED /refdata labels rendered VERBATIM (§12es-3):
// "FIFO" via the cost_basis_method override (§9-13), the account-kind titles, the entity-kind titles.
//
// Honesty is staged: ONE entity-less account (nullable is real — a bare em dash, never a fabricated
// entity); the default "Household" entity as an ORDINARY row (no crown, no special styling — D-029 /
// §9-7); a long hyphenated institution name that TRUNCATES; an entity whose DELETE is FK-blocked; the
// institution DELETE FK-blocked 400 with merge offered in plain language; and the MERGE dialog staged
// mid-flow (survivor + duplicate chosen, the re-point consequence stated plainly). Composed ratified
// ui/ only — no new component (§9-3 rules a MasterSelect data-source extension, not a new control).
//
// TILE-INTEGRITY (the Estate precedent): the footer Σ equals the sum of the value rows shown, and the
// Institution master's referenced-by counts match the accounts + policies actually staged.

// --- served vocabulary labels (from /refdata; the UI renders these VERBATIM, never client-cased) ---- #
const KIND_LABEL: Record<string, string> = {
  brokerage: "Brokerage",
  bank: "Bank",
  retirement: "Retirement",
  wallet: "Wallet",
  property: "Property",
  manual: "Manual",
  other: "Other",
};
const COST_BASIS_LABEL: Record<string, string> = {
  fifo: "FIFO", // the §9-13 override — served "FIFO", never the titleizer's "Fifo"
  average: "Average",
};
const ENTITY_KIND_LABEL: Record<string, string> = {
  self: "Self",
  spouse: "Spouse",
  trust: "Trust",
  company: "Company",
  other: "Other",
};

// --- real-shaped accounts (8 across 5 institutions; mixed kinds/currencies/cost-basis; one entity-less) #
interface AccountRow {
  id: number;
  institution: string;
  kind: string;
  currency: string; // account denomination; a non-base code shows here (§12in-1)
  costBasis: string;
  entity: string | null; // null = not assigned → bare em dash (nullable is real, §9-7)
  valueDisplay: string; // base-currency (SGD) rollup, served display string (D-105)
}

const BASE_CCY = "SGD";
const ACCOUNTS: AccountRow[] = [
  { id: 1, institution: "DBS Bank", kind: "bank", currency: "SGD", costBasis: "fifo", entity: "Household", valueDisplay: "84,200.00" },
  { id: 2, institution: "DBS Bank", kind: "brokerage", currency: "SGD", costBasis: "fifo", entity: "Household", valueDisplay: "145,600.00" },
  { id: 3, institution: "DBS Bank", kind: "retirement", currency: "SGD", costBasis: "average", entity: "Household", valueDisplay: "210,000.00" },
  { id: 4, institution: "Interactive Brokers", kind: "brokerage", currency: "USD", costBasis: "fifo", entity: "Rajan Family Trust", valueDisplay: "687,450.00" },
  { id: 5, institution: "Zerodha", kind: "brokerage", currency: "INR", costBasis: "average", entity: "Rajan Family Trust", valueDisplay: "96,320.00" },
  { id: 6, institution: "Interactive Brokers", kind: "retirement", currency: "USD", costBasis: "average", entity: "Meera Iyer", valueDisplay: "361,900.00" },
  { id: 7, institution: "Standard Chartered Priority Banking–Singapore", kind: "brokerage", currency: "SGD", costBasis: "fifo", entity: null, valueDisplay: "45,600.00" },
  { id: 8, institution: "Zerodha", kind: "wallet", currency: "INR", costBasis: "fifo", entity: "Meera Iyer", valueDisplay: "12,480.00" },
];
// Σ of the value rows above — served `total_display` (backend Decimal), pinned here for the footer. The
// gate's tile-integrity check: this MUST equal the sum of the eight rows (84,200 + 145,600 + 210,000 +
// 687,450 + 96,320 + 361,900 + 45,600 + 12,480 = 1,643,550.00).
const TOTAL_DISPLAY = "1,643,550.00";

function bare(value: string | null) {
  return value ?? <span className="acct__missing">{EMDASH}</span>;
}

const ACCOUNT_COLS: Column<AccountRow>[] = [
  {
    key: "institution",
    label: "Institution",
    sortable: true,
    truncate: true,
    render: (r) => <span className="acct__name">{r.institution}</span>,
  },
  { key: "kind", label: "Kind", sortable: true, render: (r) => KIND_LABEL[r.kind] ?? r.kind },
  { key: "currency", label: "Currency", render: (r) => r.currency },
  { key: "costBasis", label: "Cost basis", sortable: true, render: (r) => COST_BASIS_LABEL[r.costBasis] ?? r.costBasis },
  { key: "entity", label: "Entity", truncate: true, render: (r) => bare(r.entity) },
  { key: "valueDisplay", label: "Value", align: "right", sortable: true, render: (r) => r.valueDisplay },
  {
    key: "id",
    label: "",
    render: () => (
      <RowMenu
        aria-label="Account actions"
        items={[
          { label: "Edit", onClick: () => {} },
          { label: "View holdings", onClick: () => {} },
          { label: "Delete", onClick: () => {}, danger: true },
        ]}
      />
    ),
  },
];

// Footer Σ totals row — shares the body's column grid + gutter by construction (DataTable FooterRow).
// The base-currency affix rides once here (§14in-7), never per row; the value stays the plain number so a
// tile-integrity check can read it. Reused for the empty frame with a zero total.
function totalsRow(total: string): FooterRow[] {
  return [
    {
      key: "total",
      emphasis: true,
      cells: {
        institution: "Total",
        entity: `${ACCOUNTS.length} accounts`,
        valueDisplay: (
          <span className="acct__total">
            {total}
            <span className="acct__affix">{BASE_CCY}</span>
          </span>
        ),
      },
    },
  ];
}

// --- entities (D-065): name · kind · account count. Household is an ORDINARY row (D-029 / §9-7). ----- #
interface EntityRow {
  id: number;
  name: string;
  kind: string;
  accounts: number; // FK count — a non-zero count blocks delete (§9-6)
}
const ENTITIES: EntityRow[] = [
  { id: 1, name: "Household", kind: "self", accounts: 3 }, // the migration default — no crown, no special styling
  { id: 2, name: "Rajan Family Trust", kind: "trust", accounts: 2 }, // FK-blocked delete → staged below
  { id: 3, name: "Meera Iyer", kind: "spouse", accounts: 2 },
  { id: 4, name: "Kestrel Holdings Pte Ltd", kind: "company", accounts: 0 }, // deletable (no accounts)
];

const ENTITY_COLS: Column<EntityRow>[] = [
  { key: "name", label: "Entity", sortable: true, truncate: true, render: (r) => <span className="acct__name">{r.name}</span> },
  { key: "kind", label: "Kind", sortable: true, render: (r) => ENTITY_KIND_LABEL[r.kind] ?? r.kind },
  { key: "accounts", label: "Accounts", align: "right", sortable: true, render: (r) => String(r.accounts) },
  {
    key: "id",
    label: "",
    render: (r) => (
      <RowMenu
        aria-label="Entity actions"
        items={[
          { label: "Edit", onClick: () => {} },
          // Delete is disabled while accounts reference the entity (§9-6) — honest, not a silent no-op.
          { label: "Delete", onClick: () => {}, danger: true, disabled: r.accounts > 0 },
        ]}
      />
    ),
  },
];

// --- institution master (D-008): name · referenced-by counts (accounts + policies) · Rename/Merge/Delete #
interface InstitutionRow {
  id: number;
  name: string;
  accounts: number;
  policies: number; // FK'd from insurance_policy.institution_id too (D-008)
}
// Counts match the accounts staged above (tile-integrity); "DBS" is the merge survivor, "DBS Bank" the
// duplicate whose delete is FK-blocked and whose 3 accounts + 1 policy re-point on merge.
const INSTITUTIONS: InstitutionRow[] = [
  { id: 1, name: "DBS", accounts: 1, policies: 0 },
  { id: 2, name: "DBS Bank", accounts: 3, policies: 1 },
  { id: 3, name: "Interactive Brokers", accounts: 2, policies: 0 },
  { id: 4, name: "Zerodha", accounts: 2, policies: 0 },
  { id: 5, name: "Standard Chartered Priority Banking–Singapore", accounts: 1, policies: 0 },
];

function refCell(n: number, noun: string) {
  if (n === 0) return <span className="acct__missing">{EMDASH}</span>;
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

const INSTITUTION_COLS: Column<InstitutionRow>[] = [
  { key: "name", label: "Institution", sortable: true, truncate: true, render: (r) => <span className="acct__name">{r.name}</span> },
  { key: "accounts", label: "Accounts", align: "right", sortable: true, render: (r) => refCell(r.accounts, "account") },
  { key: "policies", label: "Policies", align: "right", sortable: true, render: (r) => refCell(r.policies, "policy") },
  {
    key: "id",
    label: "",
    render: (r) => {
      const referenced = r.accounts + r.policies > 0;
      return (
        <RowMenu
          aria-label="Institution actions"
          items={[
            { label: "Rename", onClick: () => {} },
            { label: "Merge…", onClick: () => {} },
            // Delete disabled while referenced (§9-1/§9-2) — the 400 offers merge instead (frame below).
            { label: "Delete", onClick: () => {}, danger: true, disabled: referenced },
          ]}
        />
      );
    },
  },
];

// --- the page spine ------------------------------------------------------------------------------- #
export function AccountsMockup() {
  return (
    <div className="lf-page acct">
      <PageHeader
        title="Accounts"
        subtitle="Manage accounts, entities and the institution master. Per-account value is a linked summary of your holdings — never a second figure."
      />

      <section className="lf-card acct__section" data-card="accounts">
        <header className="acct__cardhead">
          <h2 className="lf-card__title">Accounts</h2>
          <Button variant="primary" icon={Plus} className="acct__add">Add account</Button>
        </header>
        <div className="lf-card__body">
          <DataTable<AccountRow>
            caption="Accounts — institution, kind, currency, cost basis, entity and value rollup"
            columns={ACCOUNT_COLS}
            rows={ACCOUNTS}
            footer={totalsRow(TOTAL_DISPLAY)}
            stickyHeader
          />
        </div>
      </section>

      <section className="lf-card acct__section" data-card="entities">
        <header className="acct__cardhead">
          <h2 className="lf-card__title">Entities</h2>
          <Button variant="primary" icon={Plus} className="acct__add">Add entity</Button>
        </header>
        <div className="lf-card__body">
          <DataTable<EntityRow> caption="Ownership entities" columns={ENTITY_COLS} rows={ENTITIES} stickyHeader />
        </div>
      </section>

      <section className="lf-card acct__section" data-card="institutions">
        <header className="acct__cardhead">
          <h2 className="lf-card__title">Institution master</h2>
          <Button variant="primary" icon={Plus} className="acct__add">Add institution</Button>
        </header>
        <div className="lf-card__body">
          <DataTable<InstitutionRow>
            caption="Institution master — referenced by accounts and insurance policies"
            columns={INSTITUTION_COLS}
            rows={INSTITUTIONS}
            stickyHeader
          />
        </div>
      </section>
    </div>
  );
}

// --- ALL-EMPTY frame: no accounts, no institutions, only the migration's Household entity ---------- #
// The page is usable from zero — each empty register shows a reason + CTA (Product Guarantee 3); the
// Household entity exists from the migration, shown as an ordinary row.
const HOUSEHOLD_ONLY: EntityRow[] = [{ id: 1, name: "Household", kind: "self", accounts: 0 }];

export function AccountsEmptyMockup() {
  return (
    <div className="lf-page acct">
      <PageHeader
        title="Accounts"
        subtitle="Manage accounts, entities and the institution master. Per-account value is a linked summary of your holdings — never a second figure."
      />

      <section className="lf-card acct__section" data-card="accounts">
        <header className="acct__cardhead"><h2 className="lf-card__title">Accounts</h2></header>
        <div className="lf-card__body">
          <EmptyState
            message="No accounts yet"
            reason="Add your first account — a brokerage, bank, wallet or property — and assign it to an entity. Holdings you add or import attach to an account."
            action={<Button variant="primary" icon={Plus}>Add account</Button>}
          />
        </div>
      </section>

      <section className="lf-card acct__section" data-card="entities">
        <header className="acct__cardhead">
          <h2 className="lf-card__title">Entities</h2>
          <Button variant="primary" icon={Plus} className="acct__add">Add entity</Button>
        </header>
        <div className="lf-card__body">
          <DataTable<EntityRow> caption="Ownership entities" columns={ENTITY_COLS} rows={HOUSEHOLD_ONLY} stickyHeader />
        </div>
      </section>

      <section className="lf-card acct__section" data-card="institutions">
        <header className="acct__cardhead"><h2 className="lf-card__title">Institution master</h2></header>
        <div className="lf-card__body">
          <EmptyState
            message="No institutions yet"
            reason="The institution master starts empty. Add an institution here, or create one inline while adding an account — it becomes reusable across accounts and insurance policies."
            action={<Button variant="primary" icon={Plus}>Add institution</Button>}
          />
        </div>
      </section>
    </div>
  );
}

// --- §9-3 RATIFICATION FRAME: the add-inline institution control (MasterSelect → DB-backed master) -- #
// §9-3 ruled: EXTEND MasterSelect's data source to a DB-backed extensible master (institution) — NO new
// component, a DESIGN-SYSTEM §5.1 clarification. Here it is MOCK-BACKED (the kitchen sink is static; the
// live POST-to-master proves in Phases 2/3a) — the frame exists so the owner ratifies the affordance's
// LOOK + BEHAVIOUR contract: the served institution list, and the "＋ Create new…" add-inline row.
export function AccountsInstitutionSelectSpecimen() {
  return (
    <div className="acct__editorframe">
      <h3 className="acct__editorh">
        Institution <span className="acct__editorhint">(on the Add / Edit account form — §9-3, mock-backed here)</span>
      </h3>
      <div className="acct__field">
        <span className="acct__fieldlabel">Pick from the master, or add a new one inline</span>
        <MasterSelect master="institution" value="DBS Bank" onChange={() => {}} allowCreate aria-label="Institution" />
      </div>
      <p className="acct__editorhint">
        Open it: the list is the served Institution master; the last row (＋ Create new…) POSTs a new
        institution to the master, so it is reusable across accounts and policies.
      </p>
    </div>
  );
}

// --- HONESTY FRAME: entity delete FK-blocked (§9-6). Composed dialog body, staged static. ---------- #
// A ConfirmDialog whose confirm is DISABLED because accounts still reference the entity — the honest
// served 400, never a silent no-op. Staged as a static frame (the modal portals; the gate ratifies the
// COPY + affordance by looking, the Estate roles-editor precedent).
export function AccountsEntityDeleteBlockedSpecimen() {
  return (
    <div className="acct__dialogframe" role="group" aria-label="Delete entity — blocked">
      <h3 className="acct__dialogtitle">Delete “Rajan Family Trust”?</h3>
      <p className="acct__dialogmsg">
        This entity can’t be deleted — 2 accounts are still assigned to it. Reassign those accounts to
        another entity first, then delete it.
      </p>
      <div className="acct__dialogfoot">
        <Button>Cancel</Button>
        <Button disabled>Delete</Button>
      </div>
    </div>
  );
}

// --- HONESTY FRAME: institution delete FK-blocked → merge offered (§9-1/§9-2). Staged static. ------ #
export function AccountsInstitutionDeleteBlockedSpecimen() {
  return (
    <div className="acct__dialogframe" role="group" aria-label="Delete institution — blocked, merge offered">
      <h3 className="acct__dialogtitle">Delete “DBS Bank”?</h3>
      <p className="acct__dialogmsg">
        “DBS Bank” can’t be deleted — 3 accounts and 1 policy still use it. Rename it, or merge it into
        another institution to move everything across, instead.
      </p>
      <div className="acct__dialogfoot">
        <Button>Cancel</Button>
        <Button variant="primary">Merge instead…</Button>
        <Button disabled>Delete</Button>
      </div>
    </div>
  );
}

// --- HONESTY FRAME: the MERGE dialog staged mid-flow (§9-2). survivor + duplicate chosen. ---------- #
// User-driven merge (no fuzzy auto-detect): the admin names the survivor + the duplicate explicitly, and
// the re-point consequence is stated in plain language BEFORE confirming (the numbers match the master
// table — tile-integrity). Composed from the same MasterSelect the §9-3 frame ratifies.
export function AccountsMergeSpecimen() {
  return (
    <div className="acct__dialogframe" role="group" aria-label="Merge institutions">
      <h3 className="acct__dialogtitle">Merge institutions</h3>
      <div className="acct__mergegrid">
        <div className="acct__field">
          <span className="acct__fieldlabel">Keep (survivor)</span>
          <MasterSelect master="institution" value="DBS" onChange={() => {}} aria-label="Survivor institution" />
        </div>
        <div className="acct__field">
          <span className="acct__fieldlabel">Merge and remove (duplicate)</span>
          <MasterSelect master="institution" value="DBS Bank" onChange={() => {}} aria-label="Duplicate institution" />
        </div>
      </div>
      <p className="acct__mergeconsequence">
        3 accounts and 1 policy will move to <strong>DBS</strong>, and “DBS Bank” will be removed. This
        can’t be undone.
      </p>
      <div className="acct__dialogfoot">
        <Button>Cancel</Button>
        <Button variant="primary">Merge</Button>
      </div>
    </div>
  );
}
