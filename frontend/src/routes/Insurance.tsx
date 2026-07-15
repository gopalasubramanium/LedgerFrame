import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "../icons";
import {
  Button,
  ConfirmDialog,
  DataTable,
  DateInput,
  Dialog,
  EmptyState,
  GlossaryTerm,
  MasterSelect,
  MoneyInput,
  PageHeader,
  RowMenu,
  Skeleton,
  StatusChip,
  Switch,
  TextInput,
  TrendStat,
  useToast,
} from "../components/ui";
import type { Column, StatusChipTone } from "../components/ui";
import {
  createPolicy,
  deletePolicy,
  fetchInsurance,
  updatePolicy,
} from "../api/insurance";
import type { DocumentItem, InsuranceResp, Policy, PolicyIn, RenewalState } from "../api/insurance";
import { EMDASH } from "../format/number";
import "./Insurance.css";

// Insurance — the protection register (IA §5, D-039/D-062). Worklist CRUD on the Cash flow pattern,
// on the RATIFIED §9-1 geometry (§12): a totals strip → the policies DataTable spine → flanking
// upcoming-renewals + cover-by-type cards → the served disclaimer at the table foot.
//
// A register, never an adequacy judgment (§9-2). Money is SERVED verbatim (D-105); non-base currencies
// carry the code (§12in-1). Renewal `state` is SERVED (§12in-3) — no client day-threshold. A blank
// optional field renders a bare em dash (§12in-4). cash value is EXCLUDED from Net worth (D-039/D-081).

const PROTECTED_BAR =
  "Your protection register — policies, cover and renewals. A register, never an adequacy judgment.";

const shown = (v: string | null | undefined) => v ?? EMDASH;

const STATUS_TONE: Record<string, StatusChipTone> = {
  // §12in-5 — factual states (the Pricing Health precedent): Active = positive, Lapsed = attention.
  active: "positive",
  lapsed: "attention",
  expired: "neutral",
};
const STATUS_LABEL: Record<string, string> = { active: "Active", lapsed: "Lapsed", expired: "Expired" };

// §12in-3 — the chip renders the SERVED state; the frontend holds no day threshold.
function renewalChip(state: RenewalState | undefined) {
  if (state === "overdue") return <StatusChip label="Overdue" tone="attention" />;
  if (state === "soon") return <StatusChip label="Renews soon" tone="attention" />;
  return null; // upcoming — the date alone
}

interface PolicyDraft {
  id?: number;
  name: string;
  insurer: string;
  policy_type: string;
  policy_number: string;
  insured_person: string;
  cover_amount: string;
  currency: string;
  cash_value: string;
  premium: string;
  premium_frequency: string;
  start_date: string;
  renewal_date: string;
  nominee: string;
  notes: string;
  status: string;
  documents: DocumentItem[];
}

function newDraft(base: string, defaults: string[]): PolicyDraft {
  return {
    name: "", insurer: "", policy_type: "term_life", policy_number: "", insured_person: "",
    cover_amount: "", currency: base, cash_value: "", premium: "", premium_frequency: "annual",
    start_date: "", renewal_date: "", nominee: "", notes: "", status: "active",
    documents: defaults.map((label) => ({ label, have: false })),
  };
}

function draftFrom(p: Policy): PolicyDraft {
  const s = (v: string | number | null) => (v === null || v === undefined ? "" : String(v));
  return {
    id: p.id, name: p.name, insurer: s(p.insurer), policy_type: p.policy_type,
    policy_number: s(p.policy_number), insured_person: s(p.insured_person),
    cover_amount: s(p.cover_amount), currency: p.currency, cash_value: s(p.cash_value),
    premium: s(p.premium), premium_frequency: p.premium_frequency,
    start_date: s(p.start_date), renewal_date: s(p.renewal_date), nominee: s(p.nominee),
    notes: s(p.notes), status: p.status, documents: p.documents ?? [],
  };
}

function toBody(d: PolicyDraft): PolicyIn {
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  return {
    name: d.name.trim(), insurer: d.insurer.trim() || null, policy_type: d.policy_type,
    policy_number: d.policy_number.trim() || null, insured_person: d.insured_person.trim() || null,
    cover_amount: num(d.cover_amount), currency: d.currency, cash_value: num(d.cash_value),
    premium: num(d.premium), premium_frequency: d.premium_frequency,
    start_date: d.start_date || null, renewal_date: d.renewal_date || null,
    nominee: d.nominee.trim() || null, documents: d.documents, notes: d.notes.trim() || null,
    status: d.status,
  };
}

export function Insurance() {
  const toast = useToast();
  const [data, setData] = useState<InsuranceResp | null>();
  const [draft, setDraft] = useState<PolicyDraft | null>(null);
  const [newDocLabel, setNewDocLabel] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<Policy | null>(null);

  const reload = useCallback(() => {
    setData(undefined);
    fetchInsurance().then((r) => setData(r.ok ? r.data : null));
  }, []);
  useEffect(() => reload(), [reload]);

  // §9-5 — insurer typeahead: distinct insurers from the already-served policies (a convenience).
  const insurers = useMemo(
    () => [...new Set((data?.policies ?? []).map((p) => p.insurer).filter((x): x is string => Boolean(x)))].sort(),
    [data],
  );
  // §12in-3 — the per-policy renewal chip reads the SERVED state (no client threshold).
  const stateById = useMemo(() => {
    const m = new Map<number, RenewalState>();
    (data?.upcoming_renewals ?? []).forEach((r) => m.set(r.id, r.state));
    return m;
  }, [data]);

  const openAdd = () => {
    setFormError(null);
    setNewDocLabel("");
    setDraft(newDraft(data?.base_currency ?? "SGD", data?.document_defaults ?? []));
  };
  const openEdit = (p: Policy) => {
    setFormError(null);
    setNewDocLabel("");
    setDraft(draftFrom(p));
  };
  const closeEditor = () => setDraft(null);

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      setFormError("A policy needs a name.");
      return;
    }
    setSaving(true);
    setFormError(null);
    const body = toBody(draft);
    const res = draft.id ? await updatePolicy(draft.id, body) : await createPolicy(body);
    setSaving(false);
    if (res.ok) {
      toast.show({ message: draft.id ? "Policy updated" : "Policy added", tone: "success" });
      closeEditor();
      reload();
    } else {
      setFormError("Couldn't save this policy. Please try again.");
    }
  };

  const doDelete = async () => {
    if (!confirm) return;
    const res = await deletePolicy(confirm.id);
    setConfirm(null);
    if (res.ok) {
      toast.show({ message: "Policy deleted", tone: "success" });
      reload();
    } else {
      toast.show({ message: "Couldn't delete this policy", tone: "warning" });
    }
  };

  const columns: Column<Policy>[] = [
    {
      key: "name", label: "Policy", sortable: true, truncate: true,
      render: (p) => (
        <span className="ins__policycell">
          <span className="ins__pname">{p.name}</span>
          {p.insurer && <span className="ins__pinsurer">{p.insurer}</span>}
        </span>
      ),
    },
    { key: "policy_type", label: "Type", sortable: true, render: (p) => p.policy_type_label },
    { key: "cover_amount", label: "Cover", align: "right", sortable: true, render: (p) => shown(p.cover_amount_display) },
    {
      key: "premium", label: "Premium / yr", align: "right", sortable: true,
      render: (p) => (p.premium_display ? p.premium_display : <span className="ins__missing">{EMDASH}</span>),
    },
    {
      key: "renewal_date", label: "Renewal", sortable: true,
      render: (p) =>
        p.renewal_date ? (
          <span className="ins__renewalcell">
            <span>{p.renewal_date}</span>
            {renewalChip(stateById.get(p.id))}
          </span>
        ) : (
          <span className="ins__missing">{EMDASH}</span>
        ),
    },
    { key: "status", label: "Status", render: (p) => <StatusChip label={STATUS_LABEL[p.status] ?? p.status} tone={STATUS_TONE[p.status] ?? "neutral"} /> },
    {
      key: "id", label: "",
      render: (p) => (
        <RowMenu
          aria-label={`Actions for ${p.name}`}
          items={[
            { label: "Edit", onClick: () => openEdit(p) },
            { label: "Delete", onClick: () => setConfirm(p), danger: true },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="lf-page ins">
      <PageHeader
        title="Insurance"
        subtitle={PROTECTED_BAR}
        actions={
          <Button variant="primary" icon={Plus} onClick={openAdd}>Add policy</Button>
        }
      />

      {data === undefined && <Skeleton lines={8} />}
      {data === null && (
        <EmptyState
          message="Couldn't load your policies"
          reason="We couldn't reach the register — it's held back rather than guessed."
          action={<button type="button" className="lf-btn" onClick={reload}>Retry</button>}
        />
      )}

      {data && data.policies.length === 0 && (
        <EmptyState
          message="No policies yet"
          reason="Add your first policy to build your protection register — cover, premiums, renewals and documents."
          action={<Button variant="primary" icon={Plus} onClick={openAdd}>Add policy</Button>}
        />
      )}

      {data && data.policies.length > 0 && (
        <>
          <section className="ins__totals" data-card="totals">
            <TrendStat label="Total cover" value={shown(data.total_cover_display)} />
            <TrendStat label="Cash value (excluded)" value={shown(data.total_cash_value_display)} />
            <TrendStat label="Annual premium" value={shown(data.total_annual_premium_display)} />
            <TrendStat label="Active policies" value={String(data.count)} />
          </section>

          <section className="lf-card ins__section" data-card="policies">
            <header className="ins__cardhead">
              <h2 className="lf-card__title">Policies</h2>
            </header>
            <div className="lf-card__body">
              <DataTable<Policy> caption="Insurance policies" columns={columns} rows={data.policies} stickyHeader />
              <Disclaimer text={data.disclaimer} />
            </div>
          </section>

          <div className="ins__flank">
            <section className="lf-card ins__card" data-card="renewals">
              <header className="ins__cardhead"><h2 className="lf-card__title">Upcoming renewals</h2></header>
              <div className="lf-card__body">
                {data.upcoming_renewals.length === 0 ? (
                  <EmptyState message="No renewals due soon" reason="Nothing renews (or is overdue) within the next 60 days." />
                ) : (
                  <ul className="ins__renewals">
                    {data.upcoming_renewals.map((r) => (
                      <li key={r.id} className="ins__renewalrow">
                        <span className="ins__rname">{r.name}</span>
                        <span className="ins__rdate">{r.renewal_date}</span>
                        {renewalChip(r.state) ?? (
                          <span className="ins__rdays">in {r.days} days</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="lf-card ins__card" data-card="cover-by-type">
              <header className="ins__cardhead"><h2 className="lf-card__title">Cover by type</h2></header>
              <div className="lf-card__body">
                <ul className="ins__bytype">
                  {data.cover_by_type.map((c) => (
                    <li key={c.type} className="ins__typerow">
                      <span className="ins__tlabel">{c.label}</span>
                      <span className="ins__tvalue">{c.value_display}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
        </>
      )}

      {/* EDITOR — one policy at a time, [S]-gated by the served route (ambient PIN session, D-103). */}
      <Dialog
        open={Boolean(draft)}
        onClose={closeEditor}
        title={draft?.id ? "Edit policy" : "Add policy"}
        size="lg"
        footer={
          <>
            <Button onClick={closeEditor}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </>
        }
      >
        {draft && (
          <div className="ins__editor">
            {formError && <p className="ins__error" role="alert">{formError}</p>}

            <label className="ins__field ins__field--wide">
              <span>Name</span>
              <TextInput value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} maxLength={120} aria-label="Name" />
            </label>
            <div className="ins__fieldrow">
              <label className="ins__field">
                <span>Insurer</span>
                <TextInput value={draft.insurer} onChange={(v) => setDraft({ ...draft, insurer: v })}
                  maxLength={120} suggestions={insurers} aria-label="Insurer" />
              </label>
              <label className="ins__field">
                <span>Type</span>
                <MasterSelect master="policy_type" value={draft.policy_type}
                  onChange={(v) => setDraft({ ...draft, policy_type: v })} aria-label="Policy type" />
              </label>
              <label className="ins__field">
                <span>Status</span>
                <MasterSelect master="policy_status" value={draft.status}
                  onChange={(v) => setDraft({ ...draft, status: v })} aria-label="Status" />
              </label>
            </div>
            <div className="ins__fieldrow">
              <label className="ins__field">
                <span><GlossaryTerm term="term-cover">Cover amount</GlossaryTerm></span>
                <MoneyInput value={draft.cover_amount} currency={draft.currency || "SGD"}
                  onChange={(v) => setDraft({ ...draft, cover_amount: v })} aria-label="Cover amount" />
              </label>
              <label className="ins__field">
                <span>Currency</span>
                <MasterSelect master="currency" value={draft.currency}
                  onChange={(v) => setDraft({ ...draft, currency: v })} aria-label="Currency" />
              </label>
              <label className="ins__field">
                <span>Cash value</span>
                <MoneyInput value={draft.cash_value} currency={draft.currency || "SGD"}
                  onChange={(v) => setDraft({ ...draft, cash_value: v })} aria-label="Cash value" />
              </label>
            </div>
            <div className="ins__fieldrow">
              <label className="ins__field">
                <span><GlossaryTerm term="term-premium">Premium</GlossaryTerm></span>
                <MoneyInput value={draft.premium} currency={draft.currency || "SGD"}
                  onChange={(v) => setDraft({ ...draft, premium: v })} aria-label="Premium" />
              </label>
              <label className="ins__field">
                <span><GlossaryTerm term="term-premium-frequency">Premium frequency</GlossaryTerm></span>
                <MasterSelect master="premium_frequency" value={draft.premium_frequency}
                  onChange={(v) => setDraft({ ...draft, premium_frequency: v })} aria-label="Premium frequency" />
              </label>
              <label className="ins__field">
                <span><GlossaryTerm term="term-renewal">Renewal date</GlossaryTerm></span>
                <DateInput value={draft.renewal_date} onChange={(v) => setDraft({ ...draft, renewal_date: v })} aria-label="Renewal date" />
              </label>
            </div>
            <div className="ins__fieldrow">
              <label className="ins__field">
                <span><GlossaryTerm term="term-insured-person">Insured person</GlossaryTerm></span>
                <TextInput value={draft.insured_person} onChange={(v) => setDraft({ ...draft, insured_person: v })} maxLength={120} aria-label="Insured person" />
              </label>
              <label className="ins__field">
                <span><GlossaryTerm term="term-nominee">Nominee</GlossaryTerm></span>
                <TextInput value={draft.nominee} onChange={(v) => setDraft({ ...draft, nominee: v })} maxLength={120} aria-label="Nominee" />
              </label>
              <label className="ins__field">
                <span>Policy number</span>
                <TextInput value={draft.policy_number} onChange={(v) => setDraft({ ...draft, policy_number: v })} maxLength={80} aria-label="Policy number" />
              </label>
            </div>
            <label className="ins__field ins__field--wide">
              <span>Start date</span>
              <DateInput value={draft.start_date} onChange={(v) => setDraft({ ...draft, start_date: v })} aria-label="Start date" />
            </label>

            {/* Documents checklist — composed Switch + TextInput (§9-8), seeded from document_defaults. */}
            <div className="ins__field ins__field--wide">
              <span>Documents checklist</span>
              <ul className="ins__checklist">
                {draft.documents.map((d, i) => (
                  <li key={`${d.label}-${i}`} className="ins__checkrow">
                    <Switch checked={d.have}
                      onChange={(v) => setDraft({ ...draft, documents: draft.documents.map((x, j) => (j === i ? { ...x, have: v } : x)) })}
                      label={d.label} />
                    <button type="button" className="lf-btn ins__docremove"
                      onClick={() => setDraft({ ...draft, documents: draft.documents.filter((_, j) => j !== i) })}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <div className="ins__addlabel">
                <TextInput value={newDocLabel} onChange={setNewDocLabel} placeholder="Add a document…" aria-label="Add a document label" />
                <Button
                  onClick={() => {
                    const label = newDocLabel.trim();
                    if (!label) return;
                    setDraft({ ...draft, documents: [...draft.documents, { label, have: false }] });
                    setNewDocLabel("");
                  }}
                >
                  Add
                </Button>
              </div>
            </div>

            <label className="ins__field ins__field--wide">
              <span>Notes</span>
              <TextInput value={draft.notes} onChange={(v) => setDraft({ ...draft, notes: v })} maxLength={2000} aria-label="Notes" />
            </label>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={`Delete ${confirm?.name ?? ""}?`}
        message="This removes the policy record. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={doDelete}
      />
    </div>
  );
}

// The disclaimer is ONE served string (§12in-2); we render it verbatim and only linkify the trailing
// "see Net worth" — no copy lives in the client.
function Disclaimer({ text }: { text: string }) {
  const marker = "see Net worth";
  const i = text.lastIndexOf(marker);
  if (i < 0) return <p className="lf-card__footnote">{text}</p>;
  return (
    <p className="lf-card__footnote">
      {text.slice(0, i)}
      <Link to="/net-worth">{marker}</Link>
      {text.slice(i + marker.length)}
    </p>
  );
}
