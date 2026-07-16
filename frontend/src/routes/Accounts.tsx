// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  ConfirmDialog,
  DataTable,
  Dialog,
  EmptyState,
  GlossaryTerm,
  MasterSelect,
  PageHeader,
  RowMenu,
  Select,
  Skeleton,
  TextInput,
  useToast,
} from "../components/ui";
import type { Column, FooterRow } from "../components/ui";
import { useLabelFor } from "../refdata/refdata-context";
import { EMDASH } from "../format/number";
import { Plus } from "../icons";
import {
  createAccount,
  createEntity,
  createInstitution,
  deleteAccount,
  deleteEntity,
  deleteInstitution,
  fetchAccountList,
  fetchAccounts,
  fetchEntities,
  fetchInstitutions,
  mergeInstitutions,
  renameInstitution,
  updateAccount,
  updateEntity,
} from "../api/accounts";
import type {
  AccountIn,
  AccountReport,
  AccountsReport,
  AccountListRow,
  EntityRow,
  InstitutionRow,
} from "../api/accounts";
import "./Accounts.css";

// Accounts (/accounts) — page-accounts §13 (Phase 1). Worklist: the Accounts DataTable is the page
// SPINE (institution · kind · currency · cost basis · entity · Value(base) · ⋯ RowMenu + a footer Σ)
// → the Entities card (D-065) → the Institution master card (D-008). Two masters land here, so the two
// management cards flank the spine. Geometry RATIFIED WITH CONDITION (owner, 2026-07-16; §12ac):
//   • §12ac-1 CONDITION — the Value column header reads Value ({base_currency}), built from the SERVED
//     base, NEVER hardcoded.
//   • §12ac-2 — the cost-basis label renders for EVERY account (the model always carries a value;
//     fabricating a blank is the dishonest option).
//   • §12ac-3 — RowMenu "View holdings" is the Amendment-G linked-summary drill-down.
//   • §12ac-5 — the subtitle, the three EmptyStates and the three dialog bodies (entity FK-block,
//     institution FK-block + merge, merge consequence) are PROTECTED COPY, rendered verbatim.
// Money is ALWAYS a served display string (D-105); categoricals render the SERVED /refdata label
// verbatim (§12es-3). `institution` is a NAME (resolve-or-create into the master, Amendment F).

// The rollup reader (/accounts) omits entity_id; join /accounts/list for it (and the editable attrs).
interface SpineRow extends AccountReport {
  entity_id: number | null;
  entityName: string | null;
}

interface AccountDraft {
  id?: number;
  name: string;
  institution: string; // NAME ("" = none)
  kind: string;
  currency: string;
  entity_id: number | null;
  cost_basis_method: string;
}

interface EntityView extends EntityRow {
  accounts: number; // real count of accounts referencing this entity (disables delete when > 0)
}

const NONE_ENTITY = ""; // the Select's "not assigned" option → entity_id null (nullable is real, §9-7)

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

// Institution master reference cell — a zero is a bare em dash, never a fabricated "0 accounts".
function refCell(n: number, noun: string) {
  if (n === 0) return <span className="acct__missing">{EMDASH}</span>;
  return plural(n, noun);
}

function bareEntity(name: string | null) {
  return name ?? <span className="acct__missing">{EMDASH}</span>;
}

export function Accounts() {
  const toast = useToast();
  const labelFor = useLabelFor();

  const [report, setReport] = useState<AccountsReport | null | undefined>(undefined);
  const [listRows, setListRows] = useState<AccountListRow[]>([]);
  const [entities, setEntities] = useState<EntityRow[] | null | undefined>(undefined);
  const [institutions, setInstitutions] = useState<InstitutionRow[] | null | undefined>(undefined);

  // editors / dialogs
  const [acctDraft, setAcctDraft] = useState<AccountDraft | null>(null);
  const [acctOriginal, setAcctOriginal] = useState<SpineRow | null>(null); // for the §9-5 warning
  const [cbWarn, setCbWarn] = useState(false); // cost-basis restatement confirm interposed before PATCH
  const [acctDelete, setAcctDelete] = useState<SpineRow | null>(null);
  const [entityDraft, setEntityDraft] = useState<{ id?: number; name: string; kind: string } | null>(null);
  const [entityDel, setEntityDel] = useState<EntityView | null>(null);
  const [instDraft, setInstDraft] = useState<{ id?: number; name: string } | null>(null);
  const [instDel, setInstDel] = useState<InstitutionRow | null>(null);
  const [merge, setMerge] = useState<{ survivor: string; duplicate: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [rep, lst, ent, inst] = await Promise.all([
      fetchAccounts(),
      fetchAccountList(),
      fetchEntities(),
      fetchInstitutions(),
    ]);
    setReport(rep.ok ? rep.data : null);
    setListRows(lst.ok ? lst.data.accounts : []);
    setEntities(ent.ok ? ent.data.entities : null);
    setInstitutions(inst.ok ? inst.data.institutions : null);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // --- derived ------------------------------------------------------------------------------------ //
  const baseCurrency = report?.base_currency ?? "";
  const entityById = useMemo(() => new Map((entities ?? []).map((e) => [e.id, e])), [entities]);
  const entityIdByAccount = useMemo(
    () => new Map(listRows.map((a) => [a.id, a.entity_id])),
    [listRows],
  );
  const spine: SpineRow[] = useMemo(
    () =>
      (report?.accounts ?? []).map((a) => {
        const eid = a.id != null ? entityIdByAccount.get(a.id) ?? null : null;
        return { ...a, entity_id: eid, entityName: eid != null ? entityById.get(eid)?.name ?? null : null };
      }),
    [report, entityIdByAccount, entityById],
  );
  const entityViews: EntityView[] = useMemo(() => {
    const counts = new Map<number, number>();
    for (const a of listRows) if (a.entity_id != null) counts.set(a.entity_id, (counts.get(a.entity_id) ?? 0) + 1);
    return (entities ?? []).map((e) => ({ ...e, accounts: counts.get(e.id) ?? 0 }));
  }, [entities, listRows]);
  const institutionOptions = useMemo(
    () => (institutions ?? []).map((i) => ({ value: i.name, label: i.name })),
    [institutions],
  );

  // --- account handlers --------------------------------------------------------------------------- //
  function openAddAccount() {
    setFormError(null);
    setAcctOriginal(null);
    setAcctDraft({
      name: "",
      institution: "",
      kind: "brokerage",
      currency: baseCurrency || "SGD",
      entity_id: null,
      cost_basis_method: "fifo",
    });
  }
  function openEditAccount(r: SpineRow) {
    if (r.id == null) return;
    setFormError(null);
    setAcctOriginal(r);
    setAcctDraft({
      id: r.id,
      name: r.name,
      institution: r.institution ?? "",
      kind: r.kind,
      currency: r.currency,
      entity_id: r.entity_id,
      cost_basis_method: r.cost_basis_method,
    });
  }

  // §9-3 create-inline: picking "＋ Create new…" yields a NAME not yet in the master → POST it to
  // /institutions now (so it appears in the master card + is reusable), then re-select the canonical row.
  async function pickInstitution(name: string) {
    setAcctDraft((d) => (d ? { ...d, institution: name } : d));
    if (name && !(institutions ?? []).some((i) => i.name === name)) {
      const res = await createInstitution(name);
      if (res.ok) {
        setAcctDraft((d) => (d ? { ...d, institution: res.data.name } : d));
        await reload();
      } else {
        toast.show({ message: res.error, tone: "warning" });
      }
    }
  }

  function submitAccount() {
    if (!acctDraft) return;
    setFormError(null);
    // §9-5: changing the cost-basis method on an account WITH history restates it — interpose the
    // confirm BEFORE the PATCH. `last_activity` is the served "latest recorded transaction" proxy.
    const changedMethod =
      acctDraft.id != null && acctOriginal != null && acctDraft.cost_basis_method !== acctOriginal.cost_basis_method;
    const hasHistory = acctOriginal?.last_activity != null;
    if (changedMethod && hasHistory && !cbWarn) {
      setCbWarn(true);
      return;
    }
    void doSaveAccount();
  }

  async function doSaveAccount() {
    if (!acctDraft) return;
    setSaving(true);
    const body: AccountIn = {
      name: acctDraft.name.trim(),
      institution: acctDraft.institution.trim() || null,
      kind: acctDraft.kind,
      currency: acctDraft.currency || null,
      entity_id: acctDraft.entity_id,
      cost_basis_method: acctDraft.cost_basis_method,
    };
    const res = acctDraft.id != null ? await updateAccount(acctDraft.id, body) : await createAccount(body);
    setSaving(false);
    if (!res.ok) {
      setCbWarn(false);
      setFormError(res.error);
      return;
    }
    // The served restatement message confirms the backend rebuilt the holdings (§9-5).
    if (res.data.restatement) toast.show({ message: res.data.restatement, tone: "success" });
    else toast.show({ message: acctDraft.id != null ? "Account updated" : "Account added", tone: "success" });
    setCbWarn(false);
    setAcctDraft(null);
    setAcctOriginal(null);
    await reload();
  }

  async function doDeleteAccount() {
    if (!acctDelete?.id) return;
    const res = await deleteAccount(acctDelete.id);
    if (!res.ok) {
      // FK-block (the account still has transactions) — surface the honest served 400, never a silent no-op.
      toast.show({ message: res.error, tone: "warning" });
      setAcctDelete(null);
      return;
    }
    toast.show({ message: "Account deleted", tone: "success" });
    setAcctDelete(null);
    await reload();
  }

  // --- entity handlers ---------------------------------------------------------------------------- //
  function openAddEntity() {
    setFormError(null);
    setEntityDraft({ name: "", kind: "self" });
  }
  function openEditEntity(r: EntityView) {
    setFormError(null);
    setEntityDraft({ id: r.id, name: r.name, kind: r.kind });
  }
  async function saveEntity() {
    if (!entityDraft) return;
    setSaving(true);
    const body = { name: entityDraft.name.trim(), kind: entityDraft.kind };
    const res = entityDraft.id != null ? await updateEntity(entityDraft.id, body) : await createEntity(body);
    setSaving(false);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    toast.show({ message: entityDraft.id != null ? "Entity updated" : "Entity added", tone: "success" });
    setEntityDraft(null);
    await reload();
  }
  async function doDeleteEntity() {
    if (!entityDel) return;
    const res = await deleteEntity(entityDel.id);
    if (!res.ok) {
      toast.show({ message: res.error, tone: "warning" });
      setEntityDel(null);
      return;
    }
    toast.show({ message: "Entity deleted", tone: "success" });
    setEntityDel(null);
    await reload();
  }

  // --- institution handlers ----------------------------------------------------------------------- //
  function openAddInstitution() {
    setFormError(null);
    setInstDraft({ name: "" });
  }
  async function saveInstitution() {
    if (!instDraft) return;
    setSaving(true);
    const res = instDraft.id != null ? await renameInstitution(instDraft.id, instDraft.name.trim()) : await createInstitution(instDraft.name.trim());
    setSaving(false);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    toast.show({ message: instDraft.id != null ? "Institution renamed" : "Institution added", tone: "success" });
    setInstDraft(null);
    await reload();
  }
  async function doDeleteInstitution() {
    if (!instDel) return;
    const res = await deleteInstitution(instDel.id);
    if (!res.ok) {
      toast.show({ message: res.error, tone: "warning" });
      setInstDel(null);
      return;
    }
    toast.show({ message: "Institution deleted", tone: "success" });
    setInstDel(null);
    await reload();
  }
  async function submitMerge() {
    if (!merge || !merge.survivor || !merge.duplicate || merge.survivor === merge.duplicate) return;
    setSaving(true);
    const res = await mergeInstitutions(Number(merge.survivor), Number(merge.duplicate));
    setSaving(false);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    toast.show({ message: `Merged into ${res.data.survivor_name}`, tone: "success" });
    setMerge(null);
    setFormError(null);
    await reload();
  }

  // --- columns ------------------------------------------------------------------------------------ //
  const accountCols: Column<SpineRow>[] = useMemo(
    () => [
      { key: "institution", label: "Institution", sortable: true, truncate: true, render: (r) => <span className="acct__name">{r.institution ?? <span className="acct__missing">{EMDASH}</span>}</span> },
      { key: "kind", label: "Kind", sortable: true, render: (r) => labelFor("account_kind", r.kind) },
      { key: "currency", label: "Currency", render: (r) => r.currency },
      { key: "cost_basis_method", label: "Cost basis", sortable: true, render: (r) => labelFor("cost_basis_method", r.cost_basis_method) },
      { key: "entityName", label: "Entity", truncate: true, render: (r) => bareEntity(r.entityName) },
      // §12ac-1 CONDITION: the header carries the SERVED base currency, never hardcoded.
      { key: "value", label: `Value (${baseCurrency})`, align: "right", sortable: true, render: (r) => r.value_display },
      {
        key: "id",
        label: "",
        render: (r) =>
          r.id == null ? null : (
            <RowMenu
              aria-label={`Actions for ${r.institution ?? r.name}`}
              items={[
                { label: "Edit", onClick: () => openEditAccount(r) },
                { label: "View holdings", onClick: () => { window.location.hash = `#/holdings?account=${r.id}`; } },
                { label: "Delete", onClick: () => setAcctDelete(r), danger: true },
              ]}
            />
          ),
      },
    ],
    [baseCurrency, labelFor],
  );

  const footer: FooterRow[] = report
    ? [
        {
          key: "total",
          emphasis: true,
          cells: {
            institution: "Total",
            entityName: plural(spine.length, "account"),
            value: (
              <span className="acct__total">
                {report.total_display}
                <span className="acct__affix">{baseCurrency}</span>
              </span>
            ),
          },
        },
      ]
    : [];

  const entityCols: Column<EntityView>[] = useMemo(
    () => [
      { key: "name", label: "Entity", sortable: true, truncate: true, render: (r) => <span className="acct__name">{r.name}</span> },
      { key: "kind", label: "Kind", sortable: true, render: (r) => labelFor("entity_kind", r.kind) },
      { key: "accounts", label: "Accounts", align: "right", sortable: true, render: (r) => String(r.accounts) },
      {
        key: "id",
        label: "",
        render: (r) => (
          <RowMenu
            aria-label={`Actions for ${r.name}`}
            items={[
              { label: "Edit", onClick: () => openEditEntity(r) },
              { label: "Delete", onClick: () => setEntityDel(r), danger: true },
            ]}
          />
        ),
      },
    ],
    [labelFor],
  );

  const institutionCols: Column<InstitutionRow>[] = useMemo(
    () => [
      { key: "name", label: "Institution", sortable: true, truncate: true, render: (r) => <span className="acct__name">{r.name}</span> },
      { key: "account_count", label: "Accounts", align: "right", sortable: true, render: (r) => refCell(r.account_count, "account") },
      { key: "policy_count", label: "Policies", align: "right", sortable: true, render: (r) => refCell(r.policy_count, "policy") },
      {
        key: "id",
        label: "",
        render: (r) => (
          <RowMenu
            aria-label={`Actions for ${r.name}`}
            items={[
              { label: "Rename", onClick: () => setInstDraft({ id: r.id, name: r.name }) },
              { label: "Merge…", onClick: () => { setFormError(null); setMerge({ survivor: "", duplicate: String(r.id) }); } },
              { label: "Delete", onClick: () => setInstDel(r), danger: true },
            ]}
          />
        ),
      },
    ],
    [],
  );

  // --- merge consequence (SERVED counts of the chosen duplicate — §12ac-5 protected copy) --------- //
  const dupInst = merge?.duplicate ? (institutions ?? []).find((i) => String(i.id) === merge.duplicate) : undefined;
  const survInst = merge?.survivor ? (institutions ?? []).find((i) => String(i.id) === merge.survivor) : undefined;

  return (
    <div className="lf-page acct">
      <PageHeader
        title="Accounts"
        subtitle="Manage accounts, entities and the institution master. Per-account value is a linked summary of the holdings reader — never a second figure."
      />

      {/* ACCOUNTS — the page spine */}
      <section className="lf-card acct__section" data-card="accounts">
        <header className="acct__cardhead">
          <h2 className="lf-card__title">Accounts</h2>
          {report && report.accounts.length > 0 && (
            <Button variant="primary" icon={Plus} className="acct__add" onClick={openAddAccount}>Add account</Button>
          )}
        </header>
        <div className="lf-card__body">
          {report === undefined && <Skeleton lines={8} />}
          {report === null && (
            <EmptyState
              message="Couldn't load your accounts"
              reason="The reader is unavailable, so the figures are held back rather than guessed."
              action={<button className="lf-btn" onClick={() => void reload()}>Retry</button>}
            />
          )}
          {report && report.accounts.length === 0 && (
            <EmptyState
              message="No accounts yet"
              reason="Add your first account — a brokerage, bank, wallet or property — and assign it to an entity. Holdings you add or import attach to an account."
              action={<Button variant="primary" icon={Plus} onClick={openAddAccount}>Add account</Button>}
            />
          )}
          {report && report.accounts.length > 0 && (
            <DataTable<SpineRow>
              caption="Accounts — institution, kind, currency, cost basis, entity and value rollup"
              columns={accountCols}
              rows={spine}
              footer={footer}
              stickyHeader
            />
          )}
        </div>
      </section>

      {/* ENTITIES (D-065) */}
      <section className="lf-card acct__section" data-card="entities">
        <header className="acct__cardhead">
          <h2 className="lf-card__title">Entities</h2>
          {entities && entityViews.length > 0 && (
            <Button variant="primary" icon={Plus} className="acct__add" onClick={openAddEntity}>Add entity</Button>
          )}
        </header>
        <div className="lf-card__body">
          {entities === undefined && <Skeleton lines={4} />}
          {entities === null && (
            <EmptyState
              message="Couldn't load your entities"
              reason="The reader is unavailable, so the list is held back rather than guessed."
              action={<button className="lf-btn" onClick={() => void reload()}>Retry</button>}
            />
          )}
          {entities && entityViews.length === 0 && (
            <EmptyState
              message="No entities yet"
              reason="Entities are the people or vehicles that own accounts — a household, a trust, a company. Add one, then assign accounts to it."
              action={<Button variant="primary" icon={Plus} onClick={openAddEntity}>Add entity</Button>}
            />
          )}
          {entities && entityViews.length > 0 && (
            <DataTable<EntityView> caption="Ownership entities" columns={entityCols} rows={entityViews} stickyHeader />
          )}
        </div>
      </section>

      {/* INSTITUTION MASTER (D-008) */}
      <section className="lf-card acct__section" data-card="institutions">
        <header className="acct__cardhead">
          <h2 className="lf-card__title">Institution master</h2>
          {institutions && institutions.length > 0 && (
            <Button variant="primary" icon={Plus} className="acct__add" onClick={openAddInstitution}>Add institution</Button>
          )}
        </header>
        <div className="lf-card__body">
          {institutions === undefined && <Skeleton lines={4} />}
          {institutions === null && (
            <EmptyState
              message="Couldn't load the institution master"
              reason="The reader is unavailable, so the list is held back rather than guessed."
              action={<button className="lf-btn" onClick={() => void reload()}>Retry</button>}
            />
          )}
          {institutions && institutions.length === 0 && (
            <EmptyState
              message="No institutions yet"
              reason="The institution master starts empty. Add an institution here, or create one inline while adding an account — it becomes reusable across accounts and insurance policies."
              action={<Button variant="primary" icon={Plus} onClick={openAddInstitution}>Add institution</Button>}
            />
          )}
          {institutions && institutions.length > 0 && (
            <DataTable<InstitutionRow>
              caption="Institution master — referenced by accounts and insurance policies"
              columns={institutionCols}
              rows={institutions}
              stickyHeader
            />
          )}
        </div>
      </section>

      {/* ---- ACCOUNT EDITOR ---- */}
      {acctDraft && (
        <Dialog
          open
          onClose={() => { setAcctDraft(null); setAcctOriginal(null); }}
          title={acctDraft.id != null ? "Edit account" : "Add account"}
          size="lg"
          footer={
            <>
              <Button onClick={() => { setAcctDraft(null); setAcctOriginal(null); }}>Cancel</Button>
              <Button variant="primary" onClick={submitAccount} disabled={saving || !acctDraft.name.trim()}>Save</Button>
            </>
          }
        >
          {formError && <p className="acct__formerror" role="alert">{formError}</p>}
          <div className="acct__form">
            <label className="acct__field acct__field--full">
              <span className="acct__fieldlabel">Name</span>
              <TextInput value={acctDraft.name} onChange={(v) => setAcctDraft({ ...acctDraft, name: v })} maxLength={120} aria-label="Account name" />
            </label>
            <label className="acct__field">
              <span className="acct__fieldlabel">Institution</span>
              <MasterSelect master="institution" value={acctDraft.institution} onChange={pickInstitution} options={institutionOptions} allowCreate aria-label="Institution" />
            </label>
            <label className="acct__field">
              <span className="acct__fieldlabel"><GlossaryTerm term="term-account-kind">Kind</GlossaryTerm></span>
              <MasterSelect master="account_kind" value={acctDraft.kind} onChange={(v) => setAcctDraft({ ...acctDraft, kind: v })} aria-label="Account kind" />
            </label>
            <label className="acct__field">
              <span className="acct__fieldlabel"><GlossaryTerm term="term-cost-basis-method">Cost-basis method</GlossaryTerm></span>
              <MasterSelect master="cost_basis_method" value={acctDraft.cost_basis_method} onChange={(v) => setAcctDraft({ ...acctDraft, cost_basis_method: v })} aria-label="Cost-basis method" />
            </label>
            <label className="acct__field">
              <span className="acct__fieldlabel">Currency</span>
              <MasterSelect master="currency" value={acctDraft.currency} onChange={(v) => setAcctDraft({ ...acctDraft, currency: v })} aria-label="Currency" />
            </label>
            <label className="acct__field">
              <span className="acct__fieldlabel">Entity</span>
              <Select
                value={acctDraft.entity_id == null ? NONE_ENTITY : String(acctDraft.entity_id)}
                onChange={(v) => setAcctDraft({ ...acctDraft, entity_id: v === NONE_ENTITY ? null : Number(v) })}
                options={[{ value: NONE_ENTITY, label: "— None —" }, ...(entities ?? []).map((e) => ({ value: String(e.id), label: e.name }))]}
                aria-label="Entity"
              />
            </label>
          </div>
        </Dialog>
      )}

      {/* cost-basis restatement warning (§9-5 frontend half) — interposed before the PATCH.
          WORDING PROPOSED; the owner ratifies it at the walk (§13). */}
      <ConfirmDialog
        open={cbWarn}
        title="Change the cost-basis method?"
        message="Changing the cost-basis method restates this account — its realised and unrealised figures will change once the holdings are rebuilt. Continue?"
        confirmLabel="Change and restate"
        onCancel={() => setCbWarn(false)}
        onConfirm={() => void doSaveAccount()}
      />

      {/* account delete — the served 400 (has transactions) is surfaced honestly if it blocks. */}
      <ConfirmDialog
        open={Boolean(acctDelete)}
        title={`Delete ${acctDelete?.institution ?? acctDelete?.name ?? ""}?`}
        message="This removes the account. Holdings and transactions must be reassigned or removed first. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onCancel={() => setAcctDelete(null)}
        onConfirm={() => void doDeleteAccount()}
      />

      {/* ---- ENTITY EDITOR ---- */}
      {entityDraft && (
        <Dialog
          open
          onClose={() => setEntityDraft(null)}
          title={entityDraft.id != null ? "Edit entity" : "Add entity"}
          footer={
            <>
              <Button onClick={() => setEntityDraft(null)}>Cancel</Button>
              <Button variant="primary" onClick={saveEntity} disabled={saving || !entityDraft.name.trim()}>Save</Button>
            </>
          }
        >
          {formError && <p className="acct__formerror" role="alert">{formError}</p>}
          <div className="acct__form">
            <label className="acct__field acct__field--full">
              <span className="acct__fieldlabel">Name</span>
              <TextInput value={entityDraft.name} onChange={(v) => setEntityDraft({ ...entityDraft, name: v })} maxLength={80} aria-label="Entity name" />
            </label>
            <label className="acct__field acct__field--full">
              <span className="acct__fieldlabel">Kind</span>
              <MasterSelect master="entity_kind" value={entityDraft.kind} onChange={(v) => setEntityDraft({ ...entityDraft, kind: v })} aria-label="Entity kind" />
            </label>
          </div>
        </Dialog>
      )}

      {/* entity delete — FK-blocked shows the ratified body (§12ac-5) with Delete disabled; else confirm. */}
      {entityDel && entityDel.accounts > 0 && (
        <Dialog
          open
          onClose={() => setEntityDel(null)}
          title={`Delete “${entityDel.name}”?`}
          footer={
            <>
              <Button onClick={() => setEntityDel(null)}>Cancel</Button>
              <Button disabled>Delete</Button>
            </>
          }
        >
          <p className="acct__dialogmsg">
            This entity can’t be deleted — {plural(entityDel.accounts, "account")} {entityDel.accounts === 1 ? "is" : "are"} still
            assigned to it. Reassign those accounts to another entity first, then delete it.
          </p>
        </Dialog>
      )}
      <ConfirmDialog
        open={Boolean(entityDel && entityDel.accounts === 0)}
        title={`Delete “${entityDel?.name ?? ""}”?`}
        message="This removes the entity. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onCancel={() => setEntityDel(null)}
        onConfirm={() => void doDeleteEntity()}
      />

      {/* ---- INSTITUTION ADD / RENAME ---- */}
      {instDraft && (
        <Dialog
          open
          onClose={() => setInstDraft(null)}
          title={instDraft.id != null ? "Rename institution" : "Add institution"}
          footer={
            <>
              <Button onClick={() => setInstDraft(null)}>Cancel</Button>
              <Button variant="primary" onClick={saveInstitution} disabled={saving || !instDraft.name.trim()}>Save</Button>
            </>
          }
        >
          {formError && <p className="acct__formerror" role="alert">{formError}</p>}
          <label className="acct__field">
            <span className="acct__fieldlabel">Name</span>
            <TextInput value={instDraft.name} onChange={(v) => setInstDraft({ ...instDraft, name: v })} maxLength={120} aria-label="Institution name" />
          </label>
        </Dialog>
      )}

      {/* institution delete — FK-blocked shows the ratified body (§12ac-5) with merge offered; else confirm. */}
      {instDel && instDel.account_count + instDel.policy_count > 0 && (
        <Dialog
          open
          onClose={() => setInstDel(null)}
          title={`Delete “${instDel.name}”?`}
          footer={
            <>
              <Button onClick={() => setInstDel(null)}>Cancel</Button>
              <Button variant="primary" onClick={() => { const id = String(instDel.id); setInstDel(null); setFormError(null); setMerge({ survivor: "", duplicate: id }); }}>Merge instead…</Button>
              <Button disabled>Delete</Button>
            </>
          }
        >
          <p className="acct__dialogmsg">
            “{instDel.name}” can’t be deleted — {plural(instDel.account_count, "account")} and{" "}
            {plural(instDel.policy_count, "policy").replace("policys", "policies")} still use it. Rename it, or merge it into
            another institution to move everything across, instead.
          </p>
        </Dialog>
      )}
      <ConfirmDialog
        open={Boolean(instDel && instDel.account_count + instDel.policy_count === 0)}
        title={`Delete “${instDel?.name ?? ""}”?`}
        message="This removes the institution from the master. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onCancel={() => setInstDel(null)}
        onConfirm={() => void doDeleteInstitution()}
      />

      {/* ---- MERGE (§9-2, user-driven) ---- */}
      {merge && (
        <Dialog
          open
          onClose={() => setMerge(null)}
          title="Merge institutions"
          footer={
            <>
              <Button onClick={() => setMerge(null)}>Cancel</Button>
              <Button variant="primary" onClick={submitMerge} disabled={saving || !merge.survivor || !merge.duplicate || merge.survivor === merge.duplicate}>Merge</Button>
            </>
          }
        >
          {formError && <p className="acct__formerror" role="alert">{formError}</p>}
          <div className="acct__mergegrid">
            <div className="acct__field">
              <span className="acct__fieldlabel">Keep (survivor)</span>
              <MasterSelect master="institution" value={merge.survivor} onChange={(v) => setMerge({ ...merge, survivor: v })} options={(institutions ?? []).map((i) => ({ value: String(i.id), label: i.name }))} aria-label="Survivor institution" />
            </div>
            <div className="acct__field">
              <span className="acct__fieldlabel">Merge and remove (duplicate)</span>
              <MasterSelect master="institution" value={merge.duplicate} onChange={(v) => setMerge({ ...merge, duplicate: v })} options={(institutions ?? []).map((i) => ({ value: String(i.id), label: i.name }))} aria-label="Duplicate institution" />
            </div>
          </div>
          {dupInst && merge.survivor && merge.survivor !== merge.duplicate && (
            <p className="acct__mergeconsequence">
              {plural(dupInst.account_count, "account")} and {plural(dupInst.policy_count, "policy").replace("policys", "policies")} will move to{" "}
              <strong>{survInst?.name ?? "the survivor"}</strong>, and “{dupInst.name}” will be removed. This can’t be undone.
            </p>
          )}
        </Dialog>
      )}
    </div>
  );
}
