import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { DisplayProvider } from "../../theme/DisplayProvider";
import { AppShell } from "../AppShell";

// THE ACCEPTANCE GATE, front end (page-legal §11-5, owner 2026-07-20).
//
// These drive the gate through the SHELL rather than rendering the component in isolation, and the
// reason is the ruling: what was ordered is that *unaccepted installs are locked at entry*. That is
// a claim about a SEQUENCE — consent, then PIN, then first-run — and a component test of the panel
// on its own cannot fail if the sequence is wrong. The thing most worth guarding here is the
// ordering, not the markup.
//
// WHAT THESE TESTS CANNOT PROVE, stated so nobody mistakes their green for more than it is: they
// prove the UI asks. They do NOT prove the data is protected — that is the server's 451, and it is
// proved with no browser involved in `tests/integration/test_legal_acceptance.py`. If every test in
// this file were deleted the data would still be refused. That asymmetry is the whole design.

const COPY = {
  prompt: "I have read the Legal page, and I accept the licence terms and the product position.",
  explainer: "You can read the full document before answering.",
  stale_note: "The Legal page has changed since you last accepted it.",
  declined_note: "You have declined. The app stays locked until the terms are accepted.",
};

interface Opts {
  acceptance?: "none" | "stale" | "accepted";
  pinSet?: boolean;
  onPost?: (action: string) => void;
  postStatus?: "accepted" | "none";
}

function stubFetch(opts: Opts = {}) {
  const json = (obj: unknown) =>
    new Response(JSON.stringify(obj), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  let state = opts.acceptance ?? "none";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/legal/gate-copy")) return json(COPY);
      if (url.includes("/legal/acceptance")) {
        if (init?.method === "POST") {
          const action = JSON.parse(String(init.body)).action as string;
          opts.onPost?.(action);
          // Mirrors the server: an acceptance moves the install to `accepted`; a DECLINE does not.
          state = action === "accepted" ? "accepted" : "none";
        }
        return json({ status: state, content_sha256: "abc", accepted_at: null });
      }
      if (url.includes("/auth/state")) return json({ pin_set: opts.pinSet ?? false });
      if (url.includes("/settings"))
        return json({ stored: { first_run_complete: "1" }, defaults: { timezone: "UTC" } });
      return json({});
    }),
  );
}

function renderShell() {
  return render(
    <ThemeProvider>
      <DisplayProvider>
        <MemoryRouter initialEntries={["/"]}>
          <AppShell>
            <div data-testid="page">PAGE BODY</div>
          </AppShell>
        </MemoryRouter>
      </DisplayProvider>
    </ThemeProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("an unaccepted install shows the gate, and the SERVED prompt verbatim", async () => {
  stubFetch({ acceptance: "none" });
  renderShell();
  await screen.findByRole("dialog", { name: "Accept the terms" });
  // Verbatim, not paraphrased: this sentence is what the acceptance record binds to.
  expect(screen.getByText(COPY.prompt)).toBeTruthy();
  expect(screen.getByText(COPY.explainer)).toBeTruthy();
});

test("Accept is DISABLED until the box is ticked — one deliberate gesture, not a stray click", async () => {
  stubFetch({ acceptance: "none" });
  renderShell();
  await screen.findByRole("dialog", { name: "Accept the terms" });
  const accept = screen.getByRole("button", { name: "Accept and continue" });
  expect(accept.hasAttribute("disabled")).toBe(true);
  await userEvent.click(screen.getByRole("checkbox"));
  expect(accept.hasAttribute("disabled")).toBe(false);
});

test("accepting records 'accepted' and dismisses the gate", async () => {
  const posted: string[] = [];
  stubFetch({ acceptance: "none", onPost: (a) => posted.push(a) });
  renderShell();
  await screen.findByRole("dialog", { name: "Accept the terms" });
  await userEvent.click(screen.getByRole("checkbox"));
  await userEvent.click(screen.getByRole("button", { name: "Accept and continue" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Accept the terms" })).toBeNull(),
  );
  expect(posted).toEqual(["accepted"]);
});

test("DECLINE is recorded, and the install STAYS LOCKED", async () => {
  const posted: string[] = [];
  stubFetch({ acceptance: "none", onPost: (a) => posted.push(a) });
  renderShell();
  await screen.findByRole("dialog", { name: "Accept the terms" });
  await userEvent.click(screen.getByRole("button", { name: "Decline" }));

  // Recorded — a decline is a real answer, not a cancel. An event log with no declines in it
  // would prove nothing about the acceptances beside them.
  await waitFor(() => expect(posted).toEqual(["declined"]));
  // And still locked. This is the assertion that matters: a "decline" that let the user in
  // would make the whole gate decorative.
  expect(screen.getByRole("dialog", { name: "Accept the terms" })).toBeTruthy();
  expect(await screen.findByText(COPY.declined_note)).toBeTruthy();
});

test("a STALE acceptance re-asks, and says WHY — the user is not greeted as a stranger", async () => {
  stubFetch({ acceptance: "stale" });
  renderShell();
  await screen.findByRole("dialog", { name: "Accept the terms" });
  // The three-valued status earning its keep: someone re-asked because the document changed is
  // told that, rather than being silently treated as a first-time visitor.
  expect(screen.getByText(COPY.stale_note)).toBeTruthy();
});

test("the gate sits IN FRONT OF the PIN — an unaccepted install is never asked to unlock first", async () => {
  stubFetch({ acceptance: "none", pinSet: true });
  renderShell();
  await screen.findByRole("dialog", { name: "Accept the terms" });
  // Mirrors the server, where the acceptance check runs BEFORE the PIN check. The other order
  // would leave an unaccepted PIN-less install — every fresh install — with nothing in front of it.
  expect(screen.queryByRole("dialog", { name: "Locked" })).toBeNull();
});

test("PIN-LESS install: accepting alone is entry — no PIN is invented to stand in for consent", async () => {
  stubFetch({ acceptance: "none", pinSet: false });
  renderShell();
  await screen.findByRole("dialog", { name: "Accept the terms" });
  await userEvent.click(screen.getByRole("checkbox"));
  await userEvent.click(screen.getByRole("button", { name: "Accept and continue" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Accept the terms" })).toBeNull(),
  );
  // No lock screen appears afterwards. The gate is a CONSENT boundary and never an authentication
  // one (SECURITY-BASELINE §20-P unchanged): an install with no PIN is exactly as protected after
  // this milestone as before it, and the gate must not pretend otherwise by demanding a PIN.
  expect(screen.queryByRole("dialog", { name: "Locked" })).toBeNull();
  expect(screen.getByTestId("page")).toBeTruthy();
});

test("the Legal page is readable WITHOUT accepting, and the way back is visible", async () => {
  stubFetch({ acceptance: "none" });
  renderShell();
  await screen.findByRole("dialog", { name: "Accept the terms" });
  await userEvent.click(screen.getByRole("button", { name: "Read the Legal page" }));

  // The panel steps aside so the document can actually be read. A gate demanding acceptance of a
  // text it would not show is asking for consent that cannot be informed (§11-E1) — the server
  // exempts /legal for the same reason.
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Accept the terms" })).toBeNull(),
  );
  // Nothing was accepted by reading, and the state is not a trap: there is a visible way back.
  expect(screen.getByText(/Nothing has been accepted yet/)).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Return to accept" }));
  expect(await screen.findByRole("dialog", { name: "Accept the terms" })).toBeTruthy();
});

test("a 451 from ANY read re-fires the gate — the server is the authority", async () => {
  stubFetch({ acceptance: "accepted" });
  renderShell();
  // Starts accepted: no panel.
  await waitFor(() => expect(screen.getByTestId("page")).toBeTruthy());
  expect(screen.queryByRole("dialog", { name: "Accept the terms" })).toBeNull();

  // Now consent lapses server-side — a changed document (§11-D4) or a data reset (§11-D3). The
  // client is not asked to PREDICT either; it reacts to the refusal. `client.ts` announces every
  // 451 and the shell re-reads. This is what makes the gate re-fire for causes nobody enumerated.
  stubFetch({ acceptance: "none" });
  window.dispatchEvent(new Event("lf:consent-required"));
  expect(await screen.findByRole("dialog", { name: "Accept the terms" })).toBeTruthy();
});
