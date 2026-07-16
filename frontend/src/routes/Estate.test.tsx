import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../theme/ThemeProvider";
import { DisplayProvider } from "../theme/DisplayProvider";
import { ToastProvider } from "../components/ui";
import { RefdataContext } from "../refdata/refdata-context";
import type { Vocabs } from "../refdata/refdata-context";
import { Estate } from "./Estate";
import type { EstateResp } from "../api/estate";

// The SERVED /refdata labels the page renders VERBATIM (§12es-3). will_status:none is the ratified
// "Not recorded" (NOT the humanized "None"); every other value titleizes. The page reads THESE via
// useLabelFor — so wiring the same vocabs here proves the page renders the served label, not a copy.
const VOCABS: Vocabs = {
  will_status: [
    { value: "none", label: "Not recorded" }, { value: "draft", label: "Draft" },
    { value: "executed", label: "Executed" }, { value: "needs_update", label: "Needs update" },
  ],
  estate_doc_status: [
    { value: "present", label: "Present" }, { value: "missing", label: "Missing" },
    { value: "outdated", label: "Outdated" },
  ],
  estate_doc_category: [
    { value: "will", label: "Will" }, { value: "insurance", label: "Insurance" },
    { value: "property", label: "Property" }, { value: "identity", label: "Identity" },
    { value: "loan", label: "Loan" }, { value: "other", label: "Other" },
  ],
  contact_role: [
    { value: "nominee", label: "Nominee" }, { value: "beneficiary", label: "Beneficiary" },
    { value: "executor", label: "Executor" }, { value: "emergency", label: "Emergency" },
    { value: "guardian", label: "Guardian" },
  ],
};

const DISCLAIMER =
  "Family governance — a record of what exists and where, and reminders to keep it current. " +
  "Not legal or estate-planning advice.";

const DATA: EstateResp = {
  profile: {
    will_status: "executed",
    will_location: "Home safe (fireproof box)",
    executor: "Priya Raghunathan-Venkataraman",
    last_reviewed: "2026-01-20",
    next_review_date: "2027-01-15",
    notes: "Solicitor: Wong & Partners.",
  },
  contacts: [
    { id: 1, name: "Priya Raghunathan-Venkataraman", roles: ["executor", "beneficiary", "emergency"], phone: "+65 9123 4567", email: "priya@example.com", notes: null },
    { id: 2, name: "David Okonkwo", roles: ["emergency"], phone: null, email: "d.okonkwo@example.com", notes: null },
  ],
  documents: [
    { id: 1, title: "Last Will and Testament", category: "will", status: "present", location: "Home safe", review_date: "2027-01-15", related_to: null, notes: null },
    { id: 2, title: "Passport (spouse)", category: "identity", status: "missing", location: null, review_date: null, related_to: null, notes: null },
    { id: 3, title: "Home Loan Agreement", category: "loan", status: "outdated", location: "Bank locker", review_date: "2026-03-01", related_to: null, notes: null },
  ],
  readiness: { docs_total: 3, docs_present: 1, docs_attention: 2, will_status: "executed", nominees: 5, executors: 2, emergency: 2 },
  disclaimer: DISCLAIMER,
};

vi.mock("../api/estate", () => ({
  fetchEstate: vi.fn(),
  putProfile: vi.fn(async () => ({ ok: true })),
  createContact: vi.fn(async () => ({ ok: true, id: 99 })),
  updateContact: vi.fn(async () => ({ ok: true, id: 1 })),
  deleteContact: vi.fn(async () => ({ ok: true })),
  createDocument: vi.fn(async () => ({ ok: true, id: 99 })),
  updateDocument: vi.fn(async () => ({ ok: true, id: 1 })),
  deleteDocument: vi.fn(async () => ({ ok: true })),
}));
import { fetchEstate } from "../api/estate";
const mockedFetch = vi.mocked(fetchEstate);

function renderPage() {
  return render(
    <MemoryRouter>
      <RefdataContext.Provider value={{ vocabs: VOCABS, txnApplicability: null }}>
        <ThemeProvider><DisplayProvider><ToastProvider>
          <Estate />
        </ToastProvider></DisplayProvider></ThemeProvider>
      </RefdataContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => { mockedFetch.mockResolvedValue({ ok: true as const, data: DATA }); });
afterEach(() => cleanup());

test("the profile card leads with the will-status chip (served label + factual tone)", async () => {
  const { container } = renderPage();
  await screen.findByText("Executed");
  const profile = container.querySelector('[data-card="profile"]') as HTMLElement;
  // will status leads the card body (§12es-1): the first status chip is the will status.
  const chip = profile.querySelector(".lf-chip, .lf-statuschip") as HTMLElement;
  expect(chip.textContent).toBe("Executed");
  expect(within(profile).getByText("Will status")).toBeTruthy();
  // executor renders in the profile MetaStrip
  expect(within(profile).getByText("Priya Raghunathan-Venkataraman")).toBeTruthy();
});

// §14es-1 (walk finding, theme uniformity) — the profile-card Edit button must carry its action's
// lucide icon (Pencil) beside the text, exactly like the sibling "Add contact"/"Add document"
// buttons and Policy's "Set/Edit policy" (the ratified Button icon+label treatment, DESIGN-SYSTEM
// §5.4). The icon is DECORATIVE (aria-hidden) so the accessible name stays exactly "Edit".
test("§14es-1 — the profile Edit button carries a lucide icon AND its accessible name is 'Edit'", async () => {
  const { container } = renderPage();
  await screen.findByText("Executed");
  const profile = container.querySelector('[data-card="profile"]') as HTMLElement;
  const edit = within(profile).getByRole("button", { name: "Edit" });
  // the accessible name is exactly "Edit" (the icon must be aria-hidden, not part of the name)
  expect(edit.textContent).toBe("Edit");
  // …and it carries an icon glyph (lucide renders an <svg>), matching the platform button anatomy
  expect(edit.querySelector("svg")).toBeTruthy();
});

// P-2 (platform polish batch, 2026-07-16) — the profile Edit is a HEADER action, so it must use the
// primary (accent) variant every other header action uses, incl. its own siblings Add contact / Add
// document. It shipped as the default (grey) variant — a uniformity defect. RED before variant="primary".
test("P-2 — the profile Edit button carries the primary (accent) variant, like its Add siblings", async () => {
  const { container } = renderPage();
  await screen.findByText("Executed");
  const profile = container.querySelector('[data-card="profile"]') as HTMLElement;
  const edit = within(profile).getByRole("button", { name: "Edit" });
  expect(edit.classList.contains("lf-btn--primary")).toBe(true);
});

test("§12es-3 — will_status `none` renders the SERVED label 'Not recorded', never 'None'", async () => {
  mockedFetch.mockResolvedValueOnce({ ok: true as const, data: { ...DATA, profile: { ...DATA.profile, will_status: "none" } } });
  const { container } = renderPage();
  await screen.findByText("Not recorded");
  const text = container.textContent ?? "";
  expect(text).toContain("Not recorded");
  // the humanized fallback "None" must NOT appear as the will-status chip label
  const profile = container.querySelector('[data-card="profile"]') as HTMLElement;
  const chip = profile.querySelector(".lf-chip, .lf-statuschip") as HTMLElement;
  expect(chip.textContent).toBe("Not recorded");
});

test("the readiness strip is FIVE count tiles, counts only (§9-3 / §12es-1 — no will_status tile)", async () => {
  const { container } = renderPage();
  await screen.findByText("Executed");
  const strip = container.querySelector('[data-card="readiness"]') as HTMLElement;
  const tiles = strip.querySelectorAll(".lf-stat");
  expect(tiles.length).toBe(5);
  for (const label of ["Documents present", "Needs attention", "Nominees & beneficiaries", "Executors", "Emergency contacts"]) {
    expect(within(strip).getByText(label)).toBeTruthy();
  }
  // the counts come from the served readiness (present=1, attention=2, nominees=5, executors=2, emergency=2)
  expect(within(strip).getByText("Documents present").closest(".lf-stat")?.textContent).toContain("1");
  expect(within(strip).getByText("Needs attention").closest(".lf-stat")?.textContent).toContain("2");
  // there is NO will_status tile in the strip
  expect(within(strip).queryByText("Will status")).toBeNull();
});

test("contact roles render as SERVED-label chips (no client mapping)", async () => {
  const { container } = renderPage();
  await screen.findByText("Executed");
  const contacts = container.querySelector('[data-card="contacts"]') as HTMLElement;
  const row = [...contacts.querySelectorAll("tbody tr")].find((r) => r.textContent?.includes("Priya"))!;
  for (const role of ["Executor", "Beneficiary", "Emergency"]) {
    expect(within(row as HTMLElement).getByText(role)).toBeTruthy();
  }
});

test("missing/outdated documents show ATTENTION status chips with their served labels", async () => {
  const { container } = renderPage();
  await screen.findByText("Executed");
  const docs = container.querySelector('[data-card="documents"]') as HTMLElement;
  const missing = [...docs.querySelectorAll("tbody tr")].find((r) => r.textContent?.includes("Passport"))!;
  const outdated = [...docs.querySelectorAll("tbody tr")].find((r) => r.textContent?.includes("Home Loan"))!;
  expect(within(missing as HTMLElement).getByText("Missing")).toBeTruthy();
  expect(within(outdated as HTMLElement).getByText("Outdated")).toBeTruthy();
  // a present document reads "Present"
  const present = [...docs.querySelectorAll("tbody tr")].find((r) => r.textContent?.includes("Last Will"))!;
  expect(within(present as HTMLElement).getByText("Present")).toBeTruthy();
});

test("a blank optional cell renders a BARE em dash, never 0 (§12in-4)", async () => {
  const { container } = renderPage();
  await screen.findByText("Executed");
  const contacts = container.querySelector('[data-card="contacts"]') as HTMLElement;
  const david = [...contacts.querySelectorAll("tbody tr")].find((r) => r.textContent?.includes("David"))!;
  // David has no phone: the Phone cell (column index 2) is a bare em dash (U+2014)
  const phoneCell = david.querySelectorAll("td")[2];
  expect(phoneCell.textContent).toBe("—");
});

test("the served disclaimer renders once, VERBATIM (§9-10)", async () => {
  const { container } = renderPage();
  await screen.findByText("Executed");
  const matches = [...container.querySelectorAll(".est__disclaimer")].filter((n) => n.textContent === DISCLAIMER);
  expect(matches.length).toBe(1);
});

test("empty registers each show a reason + CTA (§12es-2)", async () => {
  mockedFetch.mockResolvedValueOnce({ ok: true as const, data: { ...DATA, contacts: [], documents: [] } });
  renderPage();
  expect(await screen.findByText("No contacts yet")).toBeTruthy();
  expect(screen.getByText("No documents yet")).toBeTruthy();
  expect(screen.getByText(/executors, beneficiaries, guardians and emergency contacts/)).toBeTruthy();
  expect(screen.getByText(/will, deeds, policies, identity/)).toBeTruthy();
  expect(screen.getAllByRole("button", { name: /add contact/i }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("button", { name: /add document/i }).length).toBeGreaterThan(0);
});

// §9-3 CHOSEN-N/A GUARD — there is NO money on this page: the readiness tiles are COUNTS. No
// money-formatted string (a grouped decimal like 1,200.00) and no base-currency affix may render.
// This is the guard that keeps the chosen absence chosen.
test("§9-3 — no money-formatted string and no base-currency affix renders anywhere on /estate", async () => {
  const { container } = renderPage();
  await screen.findByText("Executed");
  const text = container.textContent ?? "";
  // no grouped-decimal money pattern (e.g. "1,200.00", "500,000.00")
  expect(text).not.toMatch(/\d{1,3}(,\d{3})+\.\d{2}/);
  // no base-currency affix element (the .lf-stat__unit money affix used on money tiles elsewhere)
  expect(container.querySelector(".lf-stat__unit")).toBeNull();
  // and no bare currency code leaking into copy
  expect(text).not.toMatch(/\bSGD\b/);
});

// PAGE-LEVEL advice-language guard (the Insurance §9-2 / Scenarios D-058 precedent). Estate is a
// readiness register, NEVER legal advice. The ONLY legitimate "advice" is the protected NEGATION
// (the subtitle bar + the served disclaimer): strip BOTH, then no directive/advice phrasing may
// appear anywhere on the rendered page. (The standing SERVED-copy guard lives in the backend suite,
// test_estate_phase0::test_no_advice_language_in_served_estate_copy — this is its rendered counterpart.)
test("STANDING (page): no directive/advice phrasing outside the protected copy", async () => {
  const { container } = renderPage();
  await screen.findByText("Executed");
  const subtitle = "a record and reminders, never legal advice.";
  const text = (container.textContent ?? "").toLowerCase()
    .replace(DISCLAIMER.toLowerCase(), "")
    .replace(subtitle, "");
  for (const banned of ["you should", "we recommend", "draft your will", "you must",
    "make sure you", "it is advisable"]) {
    expect(text, `no advice phrasing "${banned}" outside the protected copy`).not.toContain(banned);
  }
  // ...and the protected subtitle + disclaimer ARE present.
  expect(screen.getByText(/a record and reminders, never legal advice/i)).toBeTruthy();
  expect(screen.getByText(/Not legal or estate-planning advice/i)).toBeTruthy();
});
