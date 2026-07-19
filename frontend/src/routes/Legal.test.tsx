import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";
import { Legal } from "./Legal";

// page-legal Phase 1 (§9 ruled by the owner in chat, 2026-07-19).
//
// These tests are about STRUCTURE and HONESTY, not content — deliberately, and the same way
// Help.test.tsx is. Legal's copy is SERVED, so its accuracy is guarded where it lives:
// `tests/unit/test_legal_content.py` (AC-L3 verbatim, AC-L5 the NEVER list),
// `test_legal_accuracy.py` (AC-L7 the Help truth bar), `test_scoped_caveats.py` (AC-L6). That
// split is §9-3's whole rationale in practice: asserting the wording here instead would put the
// page's truth in a test that only knows what the fixture told it.
//
// So what is asserted here is what only the page can be wrong about: that it renders every served
// section, renders the Commitments VERBATIM and in order, distinguishes loading from failure, and
// never turns a file pointer into a link.

const PAGE = {
  markup: "lf-help-markup-1",
  preamble: "In this document **the Platform** means LedgerFrame.",
  sections: [
    {
      id: "position",
      title: "The Platform's Position",
      clauses: [
        { text: "The Platform **reports; it does not act.**", items: [] },
        {
          text: "Specifically:",
          items: ["It never places trades.", "It never gives advice."],
        },
      ],
    },
    {
      id: "scoped-caveats",
      title: "Limits Stated With Each Figure",
      clauses: [{ text: "Individual figures carry their own limits.", items: [] }],
    },
    {
      id: "licence",
      title: "Licence",
      clauses: [{ text: "Released under the **AGPL-3.0-or-later** Licence.", items: [] }],
    },
    {
      id: "jurisdiction",
      title: "No Jurisdiction Tax Logic",
      clauses: [{ text: "The Platform contains **no tax logic for any country**.", items: [] }],
    },
  ],
  commitments: {
    title: "Product Commitments",
    intro: "The seven Commitments are what the Platform will never do.",
    items: [
      "**No trades.** LedgerFrame never places or executes trades.",
      "**No advice.** Never gives buy/sell/hold, tax, or financial advice.",
      "**No fabrication.** Never fabricates a price, headline, or figure.",
      "**No jurisdiction tax logic — ever.**",
      "**No egress (opt-in).**",
      "**No stored AI conversations.**",
      "**The validation contract never weakens.**",
    ],
  },
  pointers: [
    {
      file: "LICENSE",
      what: "The full text of the licence.",
      url: "https://www.gnu.org/licenses/agpl-3.0.html",
    },
    { file: "docs/audit/LICENSES.md", what: "The licence of every dependency. Generated." },
  ],
  pack_footer: "Reporting only.",
};

function mockFetch(impl: (url: string) => { status?: number; body: unknown }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const { status = 200, body } = impl(String(input));
      return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    }),
  );
}

function renderAt() {
  return render(
    <MemoryRouter initialEntries={["/legal"]}>
      <Routes>
        <Route path="/legal" element={<Legal />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
  mockFetch(() => ({ body: PAGE }));
});

test("AC-L1 — /legal renders real contents, not the unbuilt fallback", async () => {
  renderAt();
  expect(await screen.findByRole("heading", { name: "Legal", level: 1 })).toBeTruthy();
  expect(document.querySelector(".lf-notbuilt")).toBeNull();
  expect(screen.queryByText(/isn't built yet/)).toBeNull();
});

test("renders every SERVED section, in the served order — the page picks nothing", async () => {
  renderAt();
  await screen.findByRole("heading", { name: /The Platform.s Position/ });
  const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
  // The four IA-owned contents, plus the pointers card. A section dropped server-side must
  // disappear here; a section added must appear, without a frontend change.
  expect(headings).toEqual([
    "Preamble",
    "1. The Platform's Position",
    "2. Limits Stated With Each Figure",
    "3. Licence",
    "4. No Jurisdiction Tax Logic",
    "5. Product Commitments",
    "6. Where to Find the Full Record",
  ]);
});

test("AC-L3 — the Commitments render VERBATIM, all seven, in the served order", async () => {
  renderAt();
  await screen.findByRole("heading", { name: /Product Commitments/ });
  const items = Array.from(document.querySelectorAll(".legal__commitment"));
  expect(items).toHaveLength(7);
  // Markup markers are RENDERED (bold), not shown, so the text compare strips them the same way
  // the server-side guard does. What is asserted is that the page neither reorders, renumbers,
  // paraphrases nor truncates what it was given.
  const texts = items.map((li) => li.querySelector(".legal__clausebody")!.textContent);
  expect(texts[0]).toContain("No trades.");
  expect(texts[6]).toContain("The validation contract never weakens");
  PAGE.commitments.items.forEach((g, i) => {
    expect(texts[i]).toBe(g.replace(/\*\*/g, ""));
  });
});

test("the Commitments are an ORDERED list — the numbering is part of what they are", async () => {
  renderAt();
  await screen.findByRole("heading", { name: /Product Commitments/ });
  expect(document.querySelector("ol.legal__commitments")).not.toBeNull();
});

// --- The formal register (§11-4) ------------------------------------------------------------ //

test("§11-4 — clause numbers are DERIVED FROM POSITION, never served", async () => {
  renderAt();
  await screen.findByRole("heading", { name: /The Platform's Position/ });
  const nums = Array.from(document.querySelectorAll(".legal__section .legal__num")).map(
    (n) => n.textContent,
  );
  // Article 1 has two clauses, the second with two sub-clauses; then articles 2, 3, 4 with one
  // clause each; then Article 5's seven Commitments. Asserted as EXACT SEQUENCE because the whole
  // property is that position determines the number.
  expect(nums.slice(0, 6)).toEqual(["1.1", "1.2", "1.2.a", "1.2.b", "2.1", "3.1"]);
  // The invariant, stated precisely: NO CLAUSE OPENS WITH ITS OWN NUMBER. A crude "no digits
  // anywhere" check was tried first and was WRONG — it matched "AGPL-3.0-or-later" and the markup
  // dialect id, which is how a guard ends up asserting something nobody meant. What must never
  // happen is a number TYPED INTO the prose, because the renderer would then double it.
  const everyString = PAGE.sections
    .flatMap((s) => s.clauses.flatMap((c) => [c.text, ...c.items]))
    .concat(PAGE.commitments.items);
  everyString.forEach((s) => expect(s).not.toMatch(/^\s*\d+(\.\d+)*[.)]?\s/));
});

test("§11-4 — Commitment n IS clause 5.n: one numbering scheme, not two that agree", async () => {
  renderAt();
  await screen.findByRole("heading", { name: /Product Commitments/ });
  const nums = Array.from(document.querySelectorAll(".legal__commitment .legal__num")).map(
    (n) => n.textContent,
  );
  expect(nums).toEqual(["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7"]);
});

test("§9-5 — the FILE NAME is what a pointer is, and every row has one", async () => {
  renderAt();
  await screen.findByRole("heading", { name: /Where to Find the Full Record/ });
  expect(screen.getByText("docs/audit/LICENSES.md")).toBeTruthy();
  expect(screen.getByText("LICENSE")).toBeTruthy();
});

test("§11-3 — a convenience link is MARKED, rel-protected, and never replaces the file", async () => {
  renderAt();
  await screen.findByRole("heading", { name: /Where to Find the Full Record/ });
  const link = document.querySelector(".legal__convenience") as HTMLAnchorElement;
  expect(link.getAttribute("href")).toBe("https://www.gnu.org/licenses/agpl-3.0.html");
  // rel is not decoration here: target="_blank" without noopener hands the opened page a handle
  // on this one, and this is the page a reader is most likely to open from a shared link.
  expect(link.getAttribute("rel")).toBe("noreferrer noopener");
  // MARKED as a convenience, in the rendered text — the reader must not read it as the source.
  expect(screen.getByText(/a convenience link — the file above is the canonical text/)).toBeTruthy();
  // The file name is still there, beside it. The link is an addition, never a substitution.
  expect(screen.getByText("LICENSE")).toBeTruthy();
});

test("§11-3 — a pointer with NO url renders no link at all (links are never load-bearing)", async () => {
  renderAt();
  await screen.findByRole("heading", { name: /Where to Find the Full Record/ });
  // Two pointers, exactly one of which has a url. A renderer that invented a link for the other —
  // by guessing a URL from the file name, say — would be inventing a fact.
  expect(document.querySelectorAll(".legal__pointers a")).toHaveLength(1);
});

test("the LOAD-FAILURE state names the failure, offers retry, and does NOT reassure", async () => {
  mockFetch(() => ({ status: 500, body: { detail: "boom" } }));
  renderAt();
  expect(await screen.findByText("Legal is unavailable")).toBeTruthy();
  // The one thing still true with the server unreachable: the licence ships in the source tree.
  expect(screen.getByText(/ships with the source, in the LICENSE file/)).toBeTruthy();
  // A Legal page that cannot load its terms must never imply the terms are fine.
  expect(screen.queryByRole("heading", { name: /Product Commitments/ })).toBeNull();
  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
});

test("Retry re-reads, and a page that failed once can still come good", async () => {
  let attempt = 0;
  mockFetch(() => (attempt++ === 0 ? { status: 500, body: {} } : { body: PAGE }));
  renderAt();
  await userEvent.click(await screen.findByRole("button", { name: "Retry" }));
  expect(await screen.findByRole("heading", { name: /Product Commitments/ })).toBeTruthy();
  expect(screen.queryByText("Legal is unavailable")).toBeNull();
});

test("loading and failure are DIFFERENT states — 'not yet' never renders as 'unavailable'", async () => {
  // A never-resolving read: the page must sit in the loading state, not fall through to the
  // failure copy. Two different facts, and a page about honesty should not conflate them.
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  renderAt();
  expect(await screen.findByRole("heading", { name: "Legal", level: 1 })).toBeTruthy();
  expect(document.querySelector(".lf-skeleton")).not.toBeNull();
  expect(screen.queryByText("Legal is unavailable")).toBeNull();
});
