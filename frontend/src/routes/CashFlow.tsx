import { useCallback, useEffect, useMemo, useState } from "react";
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
  Select,
  Skeleton,
  StatusChip,
  SummaryHead,
  Switch,
  TextInput,
  useToast,
} from "../components/ui";
import type { Column, StatusChipTone } from "../components/ui";
import {
  createContribution,
  createGoal,
  createObligation,
  deleteContribution,
  deleteGoal,
  deleteObligation,
  fetchContributions,
  fetchGoals,
  fetchObligations,
  fetchRunway,
  updateContribution,
  updateGoal,
  updateObligation,
} from "../api/cash-flow";
import type {
  Contribution,
  ContributionsResp,
  Goal,
  GoalsResp,
  Obligation,
  ObligationsResp,
  RunwayResp,
} from "../api/cash-flow";
import { useLabelFor } from "../refdata/refdata-context";
import { EMDASH } from "../format/number";
import "./CashFlow.css";

// Cash flow — canonical home for Goals, Obligations and Contributions (IA §2/§5, D-056/D-057).
//
// §0-PROTECTED (D-057): contributions NEVER reduce the runway; `once` obligations are excluded from
// recurring net burn. Both are pinned by backend tests — this page must never imply otherwise.
//
// Money is a SERVED display string (D-105), rendered verbatim: the page computes and formats NO
// money. A `null` figure renders as an em dash with its reason — never a fabricated 0.
//
// The runway is CANONICAL ON NET WORTH (D-036). This page SUMMARISES the served reader and links —
// it never re-derives the burn from the obligation rows it happens to hold (that would be a second
// code path, the A11 defect).

type Section = "obligations" | "contributions" | "goals";

const RUNWAY_TONE: Record<string, StatusChipTone> = {
  // §9-11 — the FIRST sanctioned use of positive/negative: a runway status is a cash FACT and
  // implies no trade. (Policy's bar on these tones stands — there, a colour would value a gap.)
  positive: "positive",
  finite: "attention",
  no_data: "neutral",
};
const RUNWAY_LABEL: Record<string, string> = {
  positive: "Cash-flow positive",
  finite: "Finite",
  no_data: "No data",
};

interface ObDraft { id?: number; name: string; amount: string; due_date: string; currency: string; recurrence: string; kind: string; note: string }
interface ConDraft { id?: number; name: string; amount: string; currency: string; frequency: string; kind: string; target_goal_id: string; start_date: string; active: boolean; note: string }
interface GoalDraft { id?: number; name: string; target_amount: string; target_date: string; currency: string; basis: string; note: string }

const OB_NEW: ObDraft = { name: "", amount: "", due_date: "", currency: "", recurrence: "monthly", kind: "expense", note: "" };
const CON_NEW: ConDraft = { name: "", amount: "", currency: "", frequency: "monthly", kind: "invest", target_goal_id: "", start_date: "", active: true, note: "" };
const GOAL_NEW: GoalDraft = { name: "", target_amount: "", target_date: "", currency: "", basis: "net_worth", note: "" };

/** A served figure that may be absent. Absent is "—", never 0 (Guarantee 3). */
const shown = (v: string | null | undefined) => v ?? EMDASH;

export function CashFlow() {
  const toast = useToast();
  const labelFor = useLabelFor();

  const [runway, setRunway] = useState<RunwayResp | null>();
  const [obs, setObs] = useState<ObligationsResp | null>();
  const [cons, setCons] = useState<ContributionsResp | null>();
  const [goals, setGoals] = useState<GoalsResp | null>();

  const [obDraft, setObDraft] = useState<ObDraft | null>(null);
  const [conDraft, setConDraft] = useState<ConDraft | null>(null);
  const [goalDraft, setGoalDraft] = useState<GoalDraft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ section: Section; id: number; name: string } | null>(null);

  // Four INDEPENDENT readers — a slow one skeletons its own card and never blanks the page.
  const reload = useCallback(() => {
    setRunway(undefined); setObs(undefined); setCons(undefined); setGoals(undefined);
    fetchRunway().then((r) => setRunway(r.ok ? r.data : null));
    fetchObligations().then((r) => setObs(r.ok ? r.data : null));
    fetchContributions().then((r) => setCons(r.ok ? r.data : null));
    fetchGoals().then((r) => setGoals(r.ok ? r.data : null));
  }, []);
  useEffect(() => reload(), [reload]);

  const goalName = useMemo(() => {
    const m = new Map<number, string>();
    (goals?.goals ?? []).forEach((g) => m.set(g.id, g.name));
    return m;
  }, [goals]);

  /** How many contributions point at a goal — the LIVE count the delete warning must state (§9-7c). */
  const orphansOf = (goalId: number) =>
    (cons?.contributions ?? []).filter((c) => c.target_goal_id === goalId).length;

  const save = async () => {
    setSaving(true);
    let res;
    if (obDraft) {
      const body = {
        name: obDraft.name, amount: Number(obDraft.amount), due_date: obDraft.due_date,
        currency: obDraft.currency || null, recurrence: obDraft.recurrence, kind: obDraft.kind,
        note: obDraft.note || null,
      };
      res = obDraft.id ? await updateObligation(obDraft.id, body) : await createObligation(body);
    } else if (conDraft) {
      const body = {
        name: conDraft.name, amount: Number(conDraft.amount), currency: conDraft.currency || null,
        frequency: conDraft.frequency, kind: conDraft.kind,
        target_goal_id: conDraft.target_goal_id ? Number(conDraft.target_goal_id) : null,
        start_date: conDraft.start_date || null, active: conDraft.active, note: conDraft.note || null,
      };
      res = conDraft.id ? await updateContribution(conDraft.id, body) : await createContribution(body);
    } else if (goalDraft) {
      const body = {
        name: goalDraft.name, target_amount: Number(goalDraft.target_amount),
        target_date: goalDraft.target_date || null, currency: goalDraft.currency || null,
        basis: goalDraft.basis, note: goalDraft.note || null,
      };
      res = goalDraft.id ? await updateGoal(goalDraft.id, body) : await createGoal(body);
    }
    setSaving(false);
    if (!res) return;
    if (!res.ok) {
      // The backend owns the rules; the editor shows exactly what it said, IN PLACE — a toast would
      // vanish before the user could act on it.
      setFormError(res.error);
      return;
    }
    closeEditors();
    toast.show({ message: "Saved.", tone: "success" });
    reload();
  };

  const closeEditors = () => {
    setObDraft(null); setConDraft(null); setGoalDraft(null); setFormError(null);
  };

  const doDelete = async () => {
    if (!confirm) return;
    const { section, id } = confirm;
    const res = section === "obligations" ? await deleteObligation(id)
      : section === "contributions" ? await deleteContribution(id)
        : await deleteGoal(id);
    setConfirm(null);
    if (!res.ok) {
      toast.show({ message: res.error, tone: "warning" });
      return;
    }
    toast.show({ message: "Deleted.", tone: "success" });
    reload();
  };

  // --- columns ------------------------------------------------------------------------------- //

  const obCols: Column<Obligation>[] = [
    { key: "name", label: "Name", sortable: true, truncate: true },
    { key: "kind", label: "Kind", sortable: true, render: (r) => <StatusChip label={labelFor("obligation_kind", r.kind)} /> },
    { key: "recurrence", label: "Recurrence", sortable: true, render: (r) => labelFor("obligation_recurrence", r.recurrence) },
    { key: "amount_base", label: "Amount", align: "right", sortable: true, render: (r) => r.amount_base_display },
    {
      key: "monthly_equivalent",
      label: "Monthly equivalent",
      align: "right",
      sortable: true,
      // A `once` obligation has NO monthly rate — "—", never 0 (D-057: excluded from the burn is
      // not the same as free).
      render: (r) => shown(r.monthly_equivalent_display),
    },
    { key: "next_due", label: "Next due", align: "right", sortable: true },
    {
      key: "id", label: "", align: "right",
      render: (r) => (
        <RowMenu
          aria-label={`Actions for ${r.name}`}
          items={[
            { label: "Edit", onClick: () => { setFormError(null); setObDraft({ id: r.id, name: r.name, amount: String(r.amount), due_date: r.due_date, currency: r.currency, recurrence: r.recurrence, kind: r.kind, note: r.note ?? "" }); } },
            { label: "Delete", danger: true, onClick: () => setConfirm({ section: "obligations", id: r.id, name: r.name }) },
          ]}
        />
      ),
    },
  ];

  const conCols: Column<Contribution>[] = [
    { key: "name", label: "Contribution", sortable: true, truncate: true },
    { key: "kind", label: "Kind", sortable: true, render: (r) => <StatusChip label={labelFor("contribution_kind", r.kind)} /> },
    { key: "frequency", label: "Frequency", sortable: true, render: (r) => labelFor("contribution_frequency", r.frequency) },
    { key: "amount", label: "Amount", align: "right", sortable: true, render: (r) => r.amount_display },
    { key: "monthly_equivalent", label: "Monthly equivalent", align: "right", sortable: true, render: (r) => shown(r.monthly_equivalent_display) },
    {
      key: "target_goal_id", label: "Towards", sortable: true,
      // A SOFT link (no FK): the goal may have been deleted. An orphan renders "—", never a
      // fabricated name and never a guessed route (§9-7c).
      render: (r) => (r.target_goal_id != null ? shown(goalName.get(r.target_goal_id)) : EMDASH),
    },
    { key: "active", label: "Active", render: (r) => (r.active ? "Yes" : "No") },
    {
      key: "id", label: "", align: "right",
      render: (r) => (
        <RowMenu
          aria-label={`Actions for ${r.name}`}
          items={[
            { label: "Edit", onClick: () => { setFormError(null); setConDraft({ id: r.id, name: r.name, amount: String(r.amount), currency: r.currency, frequency: r.frequency, kind: r.kind, target_goal_id: r.target_goal_id ? String(r.target_goal_id) : "", start_date: r.start_date ?? "", active: r.active, note: r.note ?? "" }); } },
            { label: "Delete", danger: true, onClick: () => setConfirm({ section: "contributions", id: r.id, name: r.name }) },
          ]}
        />
      ),
    },
  ];

  const goalCols: Column<Goal>[] = [
    { key: "name", label: "Goal", sortable: true, truncate: true },
    { key: "basis", label: "Basis", sortable: true, render: (r) => labelFor("goal_basis", r.basis) },
    { key: "target_base", label: "Target", align: "right", sortable: true, render: (r) => r.target_base_display },
    {
      key: "progress_pct", label: "Progress", align: "right", sortable: true,
      // A goal with basis "none" has NO progress — "—", never 0% (a goal without a basis is not a
      // goal at zero).
      render: (r) => (r.progress_pct == null ? EMDASH : `${r.progress_pct}%`),
    },
    { key: "remaining_base", label: "Remaining", align: "right", sortable: true, render: (r) => shown(r.remaining_base_display) },
    {
      key: "days_to_target", label: "Target date", align: "right", sortable: true,
      // §9-11 — the served number as a FACT. No "soon" flag: Review owns that threshold.
      render: (r) => (r.days_to_target == null ? EMDASH : `in ${r.days_to_target} days`),
    },
    {
      key: "id", label: "", align: "right",
      render: (r) => (
        <RowMenu
          aria-label={`Actions for ${r.name}`}
          items={[
            { label: "Edit", onClick: () => { setFormError(null); setGoalDraft({ id: r.id, name: r.name, target_amount: String(r.target_amount), target_date: r.target_date ?? "", currency: r.currency, basis: r.basis, note: r.note ?? "" }); } },
            { label: "Delete", danger: true, onClick: () => setConfirm({ section: "goals", id: r.id, name: r.name }) },
          ]}
        />
      ),
    },
  ];

  const editorOpen = Boolean(obDraft || conDraft || goalDraft);
  const editorTitle = obDraft ? (obDraft.id ? "Edit income or expense" : "Add income or expense")
    : conDraft ? (conDraft.id ? "Edit contribution" : "Add contribution")
      : goalDraft ? (goalDraft.id ? "Edit goal" : "Add goal") : "";

  const orphanCount = confirm?.section === "goals" ? orphansOf(confirm.id) : 0;

  return (
    <div className="lf-page cf">
      <PageHeader
        title="Cash flow"
        subtitle="What you owe, what you're putting away, and what you're aiming at. Reporting only — not advice."
      />

      {/* RUNWAY — SUMMARISED from Net worth's canonical reader (D-036/§9-3). Never re-derived. */}
      <section className="lf-card cf__runway" data-card="runway">
        <SummaryHead title="Cash runway" to="/net-worth" destination="Net worth" whole />
        <div className="lf-card__body cf__runwaybody">
          {runway === undefined && <Skeleton lines={2} />}
          {runway === null && (
            <EmptyState message="The runway is unavailable." reason="It could not be loaded just now."
              action={<Button onClick={reload}>Retry</Button>} />
          )}
          {runway && (
            <>
              <div className="cf__figure">
                <span className="cf__figlabel">Runway</span>
                <span className="cf__figvalue">
                  {runway.runway_months == null ? EMDASH : `${runway.runway_months} months`}
                </span>
                <StatusChip label={RUNWAY_LABEL[runway.status] ?? runway.status}
                  tone={RUNWAY_TONE[runway.status] ?? "neutral"} />
              </div>
              {/* §14in-7 — base-currency affix on the runway MONEY figures (served base_currency); the
                  Runway figure above is months, not money, so it carries none. */}
              <div className="cf__figure">
                <span className="cf__figlabel">
                  <GlossaryTerm term="term-net-monthly-burn">Net monthly burn</GlossaryTerm>
                </span>
                <span className="cf__figvalue">{runway.net_monthly_burn_display}<span className="lf-stat__unit">{runway.base_currency}</span></span>
              </div>
              <div className="cf__figure">
                <span className="cf__figlabel">Monthly expenses</span>
                <span className="cf__figvalue">{runway.monthly_expense_display}<span className="lf-stat__unit">{runway.base_currency}</span></span>
              </div>
              <div className="cf__figure">
                <span className="cf__figlabel">Monthly income</span>
                <span className="cf__figvalue">{runway.monthly_income_display}<span className="lf-stat__unit">{runway.base_currency}</span></span>
              </div>
              {/* The served note + disclaimer, verbatim. Protected: contributions do not reduce it. */}
              <p className="lf-card__footnote">{runway.note} {runway.disclaimer}</p>
            </>
          )}
        </div>
      </section>

      {/* OBLIGATIONS */}
      <section className="lf-card cf__section" data-card="obligations">
        <header className="cf__head">
          <h2 className="lf-card__title">Income &amp; expenses</h2>
          {obs && obs.obligations.length > 0 && (
            <span className="cf__total">
              <GlossaryTerm term="term-next-12-months">Next 12 months</GlossaryTerm>
              {" · "}{obs.next_12m_total_display}
            </span>
          )}
          <Button variant="primary" icon={Plus}
            onClick={() => { setFormError(null); setObDraft({ ...OB_NEW }); }}>
            Add income or expense
          </Button>
        </header>
        <div className="lf-card__body">
          {obs === undefined && <Skeleton lines={4} />}
          {obs === null && <EmptyState message="Income and expenses are unavailable." reason="They could not be loaded just now."
            action={<Button onClick={reload}>Retry</Button>} />}
          {obs && obs.obligations.length === 0 && (
            <EmptyState
              message="No income or expenses recorded."
              reason="Add your recurring income and expenses to see a cash runway. One-off bills can go here too."
              action={<Button variant="primary" icon={Plus} onClick={() => { setFormError(null); setObDraft({ ...OB_NEW }); }}>Add income or expense</Button>}
            />
          )}
          {obs && obs.obligations.length > 0 && (
            <DataTable<Obligation> caption="Income and expenses" columns={obCols} rows={obs.obligations} />
          )}
        </div>
      </section>

      {/* CONTRIBUTIONS */}
      <section className="lf-card cf__section" data-card="contributions">
        <header className="cf__head">
          <h2 className="lf-card__title">Contributions</h2>
          {cons && cons.contributions.length > 0 && (
            <span className="cf__total">
              <GlossaryTerm term="term-planned-cash-out">Planned cash out</GlossaryTerm>
              {" · "}{cons.monthly_cash_out_with_expenses_display} / month
            </span>
          )}
          <Button variant="primary" icon={Plus}
            onClick={() => { setFormError(null); setConDraft({ ...CON_NEW }); }}>
            Add contribution
          </Button>
        </header>
        <div className="lf-card__body">
          {cons === undefined && <Skeleton lines={4} />}
          {cons === null && <EmptyState message="Contributions are unavailable." reason="They could not be loaded just now."
            action={<Button onClick={reload}>Retry</Button>} />}
          {cons && cons.contributions.length === 0 && (
            <EmptyState
              message="No contributions recorded."
              reason="Record what you plan to invest, withdraw or prepay. Contributions never reduce your cash runway."
              action={<Button variant="primary" icon={Plus} onClick={() => { setFormError(null); setConDraft({ ...CON_NEW }); }}>Add contribution</Button>}
            />
          )}
          {cons && cons.contributions.length > 0 && (
            <>
              <DataTable<Contribution> caption="Contributions" columns={conCols} rows={cons.contributions} />
              <p className="lf-card__footnote">{cons.disclaimer}</p>
            </>
          )}
        </div>
      </section>

      {/* GOALS */}
      <section className="lf-card cf__section" data-card="goals">
        <header className="cf__head">
          <h2 className="lf-card__title">Goals</h2>
          <Button variant="primary" icon={Plus}
            onClick={() => { setFormError(null); setGoalDraft({ ...GOAL_NEW }); }}>
            Add goal
          </Button>
        </header>
        <div className="lf-card__body">
          {goals === undefined && <Skeleton lines={4} />}
          {goals === null && <EmptyState message="Goals are unavailable." reason="They could not be loaded just now."
            action={<Button onClick={reload}>Retry</Button>} />}
          {goals && goals.goals.length === 0 && (
            <EmptyState
              message="No goals recorded."
              reason="Set a target amount and we'll show how far your net worth or liquid assets have come against it."
              action={<Button variant="primary" icon={Plus} onClick={() => { setFormError(null); setGoalDraft({ ...GOAL_NEW }); }}>Add goal</Button>}
            />
          )}
          {goals && goals.goals.length > 0 && (
            <>
              <DataTable<Goal> caption="Goals" columns={goalCols} rows={goals.goals} />
              <p className="lf-card__footnote">{goals.disclaimer}</p>
            </>
          )}
        </div>
      </section>

      {/* EDITOR — ONE record at a time (§9-2, per-row CRUD). [S]-gated by the served route
          (ambient PIN session, D-103: no second prompt). */}
      <Dialog
        open={editorOpen}
        onClose={closeEditors}
        title={editorTitle}
        size="lg"
        footer={
          <>
            <Button onClick={closeEditors}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <div className="cf__editor">
          {formError && <p className="cf__error" role="alert">{formError}</p>}

          {obDraft && (
            <>
              <label className="cf__field cf__field--wide">
                <span>Name</span>
                <TextInput value={obDraft.name} onChange={(v) => setObDraft({ ...obDraft, name: v })}
                  maxLength={80} aria-label="Name" />
              </label>
              <div className="cf__fieldrow">
                <label className="cf__field">
                  <span>Amount</span>
                  <MoneyInput value={obDraft.amount} currency={obDraft.currency || "SGD"}
                    onChange={(v) => setObDraft({ ...obDraft, amount: v })} aria-label="Amount" />
                </label>
                <label className="cf__field">
                  <span>Currency</span>
                  <MasterSelect master="currency" value={obDraft.currency}
                    onChange={(v) => setObDraft({ ...obDraft, currency: v })} aria-label="Currency" />
                </label>
              </div>
              <div className="cf__fieldrow">
                <label className="cf__field">
                  <span>Kind</span>
                  <MasterSelect master="obligation_kind" value={obDraft.kind}
                    onChange={(v) => setObDraft({ ...obDraft, kind: v })} aria-label="Kind" />
                </label>
                <label className="cf__field">
                  <span>Recurrence</span>
                  <MasterSelect master="obligation_recurrence" value={obDraft.recurrence}
                    onChange={(v) => setObDraft({ ...obDraft, recurrence: v })} aria-label="Recurrence" />
                  {obDraft.recurrence === "once" && (
                    <small className="cf__muted">
                      A one-off is not a recurring burn — it won't change your cash runway.
                    </small>
                  )}
                </label>
                <label className="cf__field">
                  <span>Due date</span>
                  <DateInput value={obDraft.due_date} onChange={(v) => setObDraft({ ...obDraft, due_date: v })} aria-label="Due date" />
                </label>
              </div>
              <label className="cf__field cf__field--wide">
                <span>Note</span>
                <TextInput value={obDraft.note} onChange={(v) => setObDraft({ ...obDraft, note: v })}
                  maxLength={1000} aria-label="Note" />
              </label>
            </>
          )}

          {conDraft && (
            <>
              <label className="cf__field cf__field--wide">
                <span>Name</span>
                <TextInput value={conDraft.name} onChange={(v) => setConDraft({ ...conDraft, name: v })}
                  maxLength={120} aria-label="Name" />
              </label>
              <div className="cf__fieldrow">
                <label className="cf__field">
                  <span>Amount</span>
                  <MoneyInput value={conDraft.amount} currency={conDraft.currency || "SGD"}
                    onChange={(v) => setConDraft({ ...conDraft, amount: v })} aria-label="Amount" />
                </label>
                <label className="cf__field">
                  <span>Currency</span>
                  <MasterSelect master="currency" value={conDraft.currency}
                    onChange={(v) => setConDraft({ ...conDraft, currency: v })} aria-label="Currency" />
                </label>
              </div>
              <div className="cf__fieldrow">
                <label className="cf__field">
                  <span>Kind</span>
                  <MasterSelect master="contribution_kind" value={conDraft.kind}
                    onChange={(v) => setConDraft({ ...conDraft, kind: v })} aria-label="Kind" />
                </label>
                <label className="cf__field">
                  <span>Frequency</span>
                  <MasterSelect master="contribution_frequency" value={conDraft.frequency}
                    onChange={(v) => setConDraft({ ...conDraft, frequency: v })} aria-label="Frequency" />
                </label>
                <label className="cf__field">
                  {/* A user-record picker over the user's OWN goals — a Select, not a MasterSelect. */}
                  <span>Towards a goal</span>
                  <Select
                    value={conDraft.target_goal_id}
                    onChange={(v) => setConDraft({ ...conDraft, target_goal_id: v })}
                    options={[{ value: "", label: "No goal" },
                      ...(goals?.goals ?? []).map((g) => ({ value: String(g.id), label: g.name }))]}
                    aria-label="Towards a goal"
                  />
                </label>
              </div>
              <div className="cf__fieldrow">
                <label className="cf__field">
                  <span>Start date</span>
                  <DateInput value={conDraft.start_date} onChange={(v) => setConDraft({ ...conDraft, start_date: v })} aria-label="Start date" />
                </label>
                <label className="cf__field cf__field--switch">
                  <span>Active</span>
                  <Switch checked={conDraft.active} onChange={(v) => setConDraft({ ...conDraft, active: v })}
                    aria-label="Active" />
                </label>
              </div>
              <p className="cf__muted">
                Contributions build wealth, so they never reduce your cash runway.
              </p>
            </>
          )}

          {goalDraft && (
            <>
              <label className="cf__field cf__field--wide">
                <span>Name</span>
                <TextInput value={goalDraft.name} onChange={(v) => setGoalDraft({ ...goalDraft, name: v })}
                  maxLength={80} aria-label="Name" />
              </label>
              <div className="cf__fieldrow">
                <label className="cf__field">
                  <span>Target amount</span>
                  <MoneyInput value={goalDraft.target_amount} currency={goalDraft.currency || "SGD"}
                    onChange={(v) => setGoalDraft({ ...goalDraft, target_amount: v })} aria-label="Target amount" />
                </label>
                <label className="cf__field">
                  <span>Currency</span>
                  <MasterSelect master="currency" value={goalDraft.currency}
                    onChange={(v) => setGoalDraft({ ...goalDraft, currency: v })} aria-label="Currency" />
                </label>
              </div>
              <div className="cf__fieldrow">
                <label className="cf__field">
                  <span>Measured against</span>
                  <MasterSelect master="goal_basis" value={goalDraft.basis}
                    onChange={(v) => setGoalDraft({ ...goalDraft, basis: v })} aria-label="Measured against" />
                  {goalDraft.basis === "none" && (
                    <small className="cf__muted">
                      With no basis, this goal tracks no progress — it will show a dash, not 0%.
                    </small>
                  )}
                </label>
                <label className="cf__field">
                  <span>Target date</span>
                  <DateInput value={goalDraft.target_date} onChange={(v) => setGoalDraft({ ...goalDraft, target_date: v })} aria-label="Target date" />
                </label>
              </div>
              <label className="cf__field cf__field--wide">
                <span>Note</span>
                <TextInput value={goalDraft.note} onChange={(v) => setGoalDraft({ ...goalDraft, note: v })}
                  maxLength={1000} aria-label="Note" />
              </label>
            </>
          )}
        </div>
      </Dialog>

      {/* DELETE — the platform's first explicit destructive action. Confirmed, but NOT PIN-prompted
          again (ambient session, D-103). A goal warns with the LIVE orphan count (§9-7c). */}
      <ConfirmDialog
        open={Boolean(confirm)}
        title={`Delete ${confirm?.name ?? ""}?`}
        message={
          confirm?.section === "goals" && orphanCount > 0
            ? `${orphanCount} contribution${orphanCount === 1 ? " points" : "s point"} at this goal — ${orphanCount === 1 ? "it keeps its record" : "they keep their records"} but lose${orphanCount === 1 ? "s" : ""} the link. This cannot be undone.`
            : "This cannot be undone."
        }
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={doDelete}
      />
    </div>
  );
}
