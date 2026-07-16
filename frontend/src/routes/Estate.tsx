import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus } from "../icons";
import {
  Button,
  ConfirmDialog,
  DataTable,
  DateInput,
  Dialog,
  EmptyState,
  GlossaryTerm,
  MasterSelect,
  MetaStrip,
  PageHeader,
  RowMenu,
  Skeleton,
  StatusChip,
  Switch,
  TextInput,
  TrendStat,
  useToast,
} from "../components/ui";
import type { Column, MetaItem, StatusChipTone } from "../components/ui";
import {
  createContact,
  createDocument,
  deleteContact,
  deleteDocument,
  fetchEstate,
  putProfile,
  updateContact,
  updateDocument,
} from "../api/estate";
import type { EstateContact, EstateDocument, EstateResp } from "../api/estate";
import { useLabelFor } from "../refdata/refdata-context";
import { EMDASH } from "../format/number";
import "./Estate.css";

// Estate — canonical home for the will/executor profile (singleton), the contacts register
// (people + roles) and the key-document register (IA §2/§5, D-063 no-FK isolation). Worklist:
// a profile card (will status LEADS — §12es-1) → a readiness COUNTS strip (no money, §9-3) →
// the contacts DataTable → the documents DataTable → the ratified disclaimer once at the foot.
//
// A READINESS REGISTER, NEVER LEGAL ADVICE (D-055/§0). The served disclaimer is rendered
// VERBATIM (§9-10). Every categorical (will_status, document category/status, contact roles)
// renders from the SERVED /refdata label (D-005) — never a client-side mapping. A blank
// optional cell is a BARE em dash (§12in-4), never 0; an empty REGISTER shows an EmptyState
// with a reason + CTA (§12es-2). No `*_display` money strings, no base-currency affix (§9-3).

// will_status tone is FACTUAL, never valuing (the Insurance precedent): executed = positive,
// needs_update = attention, draft/none = neutral (none is ratified neutral — §12es-1).
const WILL_TONE: Record<string, StatusChipTone> = {
  executed: "positive",
  needs_update: "attention",
  draft: "neutral",
  none: "neutral",
};
// Document status: present = positive; missing/outdated = attention (factual, not alarmist).
const DOC_TONE: Record<string, StatusChipTone> = {
  present: "positive",
  missing: "attention",
  outdated: "attention",
};

interface ProfileDraft {
  will_status: string; will_location: string; executor: string;
  last_reviewed: string; next_review_date: string; notes: string;
}
interface ContactDraft {
  id?: number; name: string; roles: string[]; phone: string; email: string; notes: string;
}
interface DocDraft {
  id?: number; title: string; category: string; status: string;
  location: string; review_date: string; related_to: string; notes: string;
}

const CONTACT_NEW: ContactDraft = { name: "", roles: [], phone: "", email: "", notes: "" };
const DOC_NEW: DocDraft = { title: "", category: "other", status: "present", location: "", review_date: "", related_to: "", notes: "" };
const CONTACT_ROLES = ["nominee", "beneficiary", "executor", "emergency", "guardian"];

/** An optional field that may be absent renders as a BARE em dash, never 0 (§12in-4). */
const bare = (v: string | null | undefined) =>
  v == null || v === "" ? <span className="est__missing">{EMDASH}</span> : v;

export function Estate() {
  const toast = useToast();
  const labelFor = useLabelFor();

  const [data, setData] = useState<EstateResp | null>();

  const [profileDraft, setProfileDraft] = useState<ProfileDraft | null>(null);
  const [contactDraft, setContactDraft] = useState<ContactDraft | null>(null);
  const [docDraft, setDocDraft] = useState<DocDraft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "contact" | "document"; id: number; name: string } | null>(null);

  // ONE reader drives the whole page (GET /estate returns profile + both registers + counts).
  const reload = useCallback(() => {
    setData(undefined);
    fetchEstate().then((r) => setData(r.ok ? r.data : null));
  }, []);
  useEffect(() => reload(), [reload]);

  const closeEditors = () => {
    setProfileDraft(null); setContactDraft(null); setDocDraft(null); setFormError(null);
  };

  const save = async () => {
    setSaving(true);
    let res;
    if (profileDraft) {
      res = await putProfile({
        will_status: profileDraft.will_status,
        will_location: profileDraft.will_location || null,
        executor: profileDraft.executor || null,
        last_reviewed: profileDraft.last_reviewed || null,
        next_review_date: profileDraft.next_review_date || null,
        notes: profileDraft.notes || null,
      });
    } else if (contactDraft) {
      if (!contactDraft.name.trim()) { setSaving(false); setFormError("A name is required."); return; }
      const body = {
        name: contactDraft.name.trim(), roles: contactDraft.roles,
        phone: contactDraft.phone || null, email: contactDraft.email || null, notes: contactDraft.notes || null,
      };
      res = contactDraft.id ? await updateContact(contactDraft.id, body) : await createContact(body);
    } else if (docDraft) {
      if (!docDraft.title.trim()) { setSaving(false); setFormError("A title is required."); return; }
      const body = {
        title: docDraft.title.trim(), category: docDraft.category, status: docDraft.status,
        location: docDraft.location || null, review_date: docDraft.review_date || null,
        related_to: docDraft.related_to || null, notes: docDraft.notes || null,
      };
      res = docDraft.id ? await updateDocument(docDraft.id, body) : await createDocument(body);
    }
    setSaving(false);
    if (!res) return;
    if (!res.ok) { setFormError(res.error); return; }  // the backend owns the rules; show its message in place
    closeEditors();
    toast.show({ message: "Saved.", tone: "success" });
    reload();
  };

  const doDelete = async () => {
    if (!confirm) return;
    const res = confirm.kind === "contact" ? await deleteContact(confirm.id) : await deleteDocument(confirm.id);
    setConfirm(null);
    if (!res.ok) { toast.show({ message: res.error, tone: "warning" }); return; }
    toast.show({ message: "Deleted.", tone: "success" });
    reload();
  };

  const toggleRole = (role: string) =>
    setContactDraft((d) => d && ({
      ...d, roles: d.roles.includes(role) ? d.roles.filter((r) => r !== role) : [...d.roles, role],
    }));

  // --- columns ------------------------------------------------------------------------------- //
  const rolesCell = (roles: string[]) =>
    roles.length === 0 ? <span className="est__missing">{EMDASH}</span> : (
      <span className="est__roles">
        {roles.map((r) => <span key={r} className="lf-chip">{labelFor("contact_role", r)}</span>)}
      </span>
    );

  const contactCols: Column<EstateContact>[] = [
    { key: "name", label: "Name", sortable: true, truncate: true, render: (r) => <span className="est__name">{r.name}</span> },
    { key: "roles", label: "Roles", render: (r) => rolesCell(r.roles) },
    { key: "phone", label: "Phone", render: (r) => bare(r.phone) },
    { key: "email", label: "Email", truncate: true, render: (r) => bare(r.email) },
    {
      key: "id", label: "", align: "right",
      render: (r) => (
        <RowMenu
          aria-label={`Actions for ${r.name}`}
          items={[
            { label: "Edit", onClick: () => { setFormError(null); setContactDraft({ id: r.id, name: r.name, roles: r.roles, phone: r.phone ?? "", email: r.email ?? "", notes: r.notes ?? "" }); } },
            { label: "Delete", danger: true, onClick: () => setConfirm({ kind: "contact", id: r.id, name: r.name }) },
          ]}
        />
      ),
    },
  ];

  const docCols: Column<EstateDocument>[] = [
    { key: "title", label: "Document", sortable: true, truncate: true, render: (r) => <span className="est__name">{r.title}</span> },
    { key: "category", label: "Category", sortable: true, render: (r) => <span className="lf-chip">{labelFor("estate_doc_category", r.category)}</span> },
    { key: "status", label: "Status", sortable: true, render: (r) => <StatusChip label={labelFor("estate_doc_status", r.status)} tone={DOC_TONE[r.status] ?? "neutral"} /> },
    { key: "location", label: "Location", truncate: true, render: (r) => bare(r.location) },
    { key: "review_date", label: "Review date", sortable: true, render: (r) => bare(r.review_date) },
    {
      key: "id", label: "", align: "right",
      render: (r) => (
        <RowMenu
          aria-label={`Actions for ${r.title}`}
          items={[
            { label: "Edit", onClick: () => { setFormError(null); setDocDraft({ id: r.id, title: r.title, category: r.category, status: r.status, location: r.location ?? "", review_date: r.review_date ?? "", related_to: r.related_to ?? "", notes: r.notes ?? "" }); } },
            { label: "Delete", danger: true, onClick: () => setConfirm({ kind: "document", id: r.id, name: r.title }) },
          ]}
        />
      ),
    },
  ];

  const openProfileEdit = () => {
    setFormError(null);
    const p = data?.profile;
    setProfileDraft({
      will_status: p?.will_status ?? "none", will_location: p?.will_location ?? "",
      executor: p?.executor ?? "", last_reviewed: p?.last_reviewed ?? "",
      next_review_date: p?.next_review_date ?? "", notes: p?.notes ?? "",
    });
  };

  const editorOpen = Boolean(profileDraft || contactDraft || docDraft);
  const editorTitle = profileDraft ? "Edit estate profile"
    : contactDraft ? (contactDraft.id ? "Edit contact" : "Add contact")
      : docDraft ? (docDraft.id ? "Edit document" : "Add document") : "";

  const profileItems = (): MetaItem[] => [
    { label: "Executor", value: bare(data?.profile.executor) },
    { label: "Will location", value: bare(data?.profile.will_location) },
    { label: "Last reviewed", value: bare(data?.profile.last_reviewed) },
    { label: "Next review", value: bare(data?.profile.next_review_date) },
  ];

  return (
    <div className="lf-page est">
      <PageHeader
        title="Estate"
        subtitle="A readiness register — will, contacts and key documents. A record and reminders, never legal advice."
      />

      {/* PROFILE — will status LEADS (its canonical home, §12es-1); [S]-gated Edit (ambient PIN, D-103). */}
      <section className="lf-card est__profile" data-card="profile">
        <header className="est__cardhead">
          <h2 className="lf-card__title">Estate profile</h2>
          {data && <Button className="est__edit" variant="primary" icon={Pencil} onClick={openProfileEdit}>Edit</Button>}
        </header>
        <div className="lf-card__body">
          {data === undefined && <Skeleton lines={4} />}
          {data === null && (
            <EmptyState message="The estate register is unavailable." reason="It could not be loaded just now."
              action={<Button onClick={reload}>Retry</Button>} />
          )}
          {data && (
            <div className="est__profilebody">
              <div className="est__willstatus">
                <span className="est__willlabel">
                  <GlossaryTerm term="term-will-status">Will status</GlossaryTerm>
                </span>
                <StatusChip label={labelFor("will_status", data.profile.will_status)}
                  tone={WILL_TONE[data.profile.will_status] ?? "neutral"} />
              </div>
              <MetaStrip items={profileItems()} />
              <div className="est__notes">
                <span className="est__willlabel">Notes</span>
                <p className="est__notestext">{bare(data.profile.notes)}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* READINESS — COUNTS ONLY, no currency affix (§9-3). No will_status tile (§12es-1). */}
      {data && (
        <section className="est__readiness" data-card="readiness">
          <TrendStat label="Documents present" value={String(data.readiness.docs_present)} />
          <TrendStat label="Needs attention" value={String(data.readiness.docs_attention)} />
          <TrendStat label="Nominees & beneficiaries" value={String(data.readiness.nominees)} />
          <TrendStat label="Executors" value={String(data.readiness.executors)} />
          <TrendStat label="Emergency contacts" value={String(data.readiness.emergency)} />
        </section>
      )}

      {/* CONTACTS */}
      <section className="lf-card est__section" data-card="contacts">
        <header className="est__cardhead">
          <h2 className="lf-card__title">Contacts</h2>
          {data && data.contacts.length > 0 && (
            <Button className="est__add" variant="primary" icon={Plus}
              onClick={() => { setFormError(null); setContactDraft({ ...CONTACT_NEW }); }}>
              Add contact
            </Button>
          )}
        </header>
        <div className="lf-card__body">
          {data === undefined && <Skeleton lines={4} />}
          {data === null && <EmptyState message="Contacts are unavailable." reason="They could not be loaded just now."
            action={<Button onClick={reload}>Retry</Button>} />}
          {data && data.contacts.length === 0 && (
            <EmptyState
              message="No contacts yet"
              reason="Add the people who matter to your estate — executors, beneficiaries, guardians and emergency contacts, with their roles."
              action={<Button variant="primary" icon={Plus} onClick={() => { setFormError(null); setContactDraft({ ...CONTACT_NEW }); }}>Add contact</Button>}
            />
          )}
          {data && data.contacts.length > 0 && (
            <DataTable<EstateContact> caption="Estate contacts" columns={contactCols} rows={data.contacts} stickyHeader />
          )}
        </div>
      </section>

      {/* DOCUMENTS */}
      <section className="lf-card est__section" data-card="documents">
        <header className="est__cardhead">
          <h2 className="lf-card__title">Documents</h2>
          {data && data.documents.length > 0 && (
            <Button className="est__add" variant="primary" icon={Plus}
              onClick={() => { setFormError(null); setDocDraft({ ...DOC_NEW }); }}>
              Add document
            </Button>
          )}
        </header>
        <div className="lf-card__body">
          {data === undefined && <Skeleton lines={4} />}
          {data === null && <EmptyState message="Documents are unavailable." reason="They could not be loaded just now."
            action={<Button onClick={reload}>Retry</Button>} />}
          {data && data.documents.length === 0 && (
            <EmptyState
              message="No documents yet"
              reason="Record where your key documents live — will, deeds, policies, identity and more — and whether each is present, missing or outdated."
              action={<Button variant="primary" icon={Plus} onClick={() => { setFormError(null); setDocDraft({ ...DOC_NEW }); }}>Add document</Button>}
            />
          )}
          {data && data.documents.length > 0 && (
            <DataTable<EstateDocument> caption="Estate documents" columns={docCols} rows={data.documents} stickyHeader />
          )}
        </div>
      </section>

      {/* The RATIFIED disclaimer once at the foot (never per row). Served verbatim (§9-10). */}
      {data && <p className="est__disclaimer">{data.disclaimer}</p>}

      {/* EDITOR — ONE record at a time. [S]-gated by the served route (ambient PIN session, D-103). */}
      <Dialog
        open={editorOpen}
        onClose={closeEditors}
        title={editorTitle}
        size="lg"
        footer={
          <>
            <Button onClick={closeEditors}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </>
        }
      >
        <div className="est__editor">
          {formError && <p className="est__error" role="alert">{formError}</p>}

          {profileDraft && (
            <>
              <label className="est__field">
                <span>Will status</span>
                <MasterSelect master="will_status" value={profileDraft.will_status}
                  onChange={(v) => setProfileDraft({ ...profileDraft, will_status: v })} aria-label="Will status" />
              </label>
              <label className="est__field">
                <span>Executor</span>
                <TextInput value={profileDraft.executor} onChange={(v) => setProfileDraft({ ...profileDraft, executor: v })}
                  maxLength={120} aria-label="Executor" />
              </label>
              <label className="est__field">
                <span>Will location</span>
                <TextInput value={profileDraft.will_location} onChange={(v) => setProfileDraft({ ...profileDraft, will_location: v })}
                  maxLength={160} aria-label="Will location" />
              </label>
              <label className="est__field">
                <span>Last reviewed</span>
                <DateInput value={profileDraft.last_reviewed} onChange={(v) => setProfileDraft({ ...profileDraft, last_reviewed: v })} aria-label="Last reviewed" />
              </label>
              <label className="est__field">
                <span>Next review</span>
                <DateInput value={profileDraft.next_review_date} onChange={(v) => setProfileDraft({ ...profileDraft, next_review_date: v })} aria-label="Next review" />
              </label>
              <label className="est__field est__field--wide">
                <span>Notes</span>
                <TextInput value={profileDraft.notes} onChange={(v) => setProfileDraft({ ...profileDraft, notes: v })}
                  maxLength={2000} aria-label="Notes" />
              </label>
            </>
          )}

          {contactDraft && (
            <>
              <label className="est__field est__field--wide">
                <span>Name</span>
                <TextInput value={contactDraft.name} onChange={(v) => setContactDraft({ ...contactDraft, name: v })}
                  maxLength={120} aria-label="Name" />
              </label>
              {/* Roles — a contact may hold several, so a set of Switch toggles, not a single-select (§9-6). */}
              <fieldset className="est__field est__field--wide est__roleset">
                <legend>Roles</legend>
                <ul className="est__rolelist">
                  {CONTACT_ROLES.map((r) => (
                    <li key={r} className="est__rolerow">
                      <Switch checked={contactDraft.roles.includes(r)} onChange={() => toggleRole(r)}
                        label={labelFor("contact_role", r)} />
                    </li>
                  ))}
                </ul>
              </fieldset>
              <label className="est__field">
                <span>Phone</span>
                <TextInput value={contactDraft.phone} onChange={(v) => setContactDraft({ ...contactDraft, phone: v })}
                  maxLength={40} aria-label="Phone" />
              </label>
              <label className="est__field">
                <span>Email</span>
                <TextInput value={contactDraft.email} onChange={(v) => setContactDraft({ ...contactDraft, email: v })}
                  maxLength={120} aria-label="Email" />
              </label>
              <label className="est__field est__field--wide">
                <span>Notes</span>
                <TextInput value={contactDraft.notes} onChange={(v) => setContactDraft({ ...contactDraft, notes: v })}
                  maxLength={2000} aria-label="Notes" />
              </label>
            </>
          )}

          {docDraft && (
            <>
              <label className="est__field est__field--wide">
                <span>Title</span>
                <TextInput value={docDraft.title} onChange={(v) => setDocDraft({ ...docDraft, title: v })}
                  maxLength={120} aria-label="Title" />
              </label>
              <label className="est__field">
                <span>Category</span>
                <MasterSelect master="estate_doc_category" value={docDraft.category}
                  onChange={(v) => setDocDraft({ ...docDraft, category: v })} aria-label="Category" />
              </label>
              <label className="est__field">
                <span>Status</span>
                <MasterSelect master="estate_doc_status" value={docDraft.status}
                  onChange={(v) => setDocDraft({ ...docDraft, status: v })} aria-label="Status" />
              </label>
              <label className="est__field">
                <span>Location</span>
                <TextInput value={docDraft.location} onChange={(v) => setDocDraft({ ...docDraft, location: v })}
                  maxLength={160} aria-label="Location" />
              </label>
              <label className="est__field">
                <span>Review date</span>
                <DateInput value={docDraft.review_date} onChange={(v) => setDocDraft({ ...docDraft, review_date: v })} aria-label="Review date" />
              </label>
              <label className="est__field">
                <span>Related to</span>
                <TextInput value={docDraft.related_to} onChange={(v) => setDocDraft({ ...docDraft, related_to: v })}
                  maxLength={120} aria-label="Related to" />
              </label>
              <label className="est__field est__field--wide">
                <span>Notes</span>
                <TextInput value={docDraft.notes} onChange={(v) => setDocDraft({ ...docDraft, notes: v })}
                  maxLength={2000} aria-label="Notes" />
              </label>
            </>
          )}
        </div>
      </Dialog>

      {/* DELETE — confirmed, but NOT PIN-prompted again (ambient session, D-103). Profile is a
          singleton (no delete); only contacts and documents can be removed. */}
      <ConfirmDialog
        open={Boolean(confirm)}
        title={`Delete ${confirm?.name ?? ""}?`}
        message="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={doDelete}
      />
    </div>
  );
}
