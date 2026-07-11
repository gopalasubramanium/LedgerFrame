import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ReactNode } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ThemeProvider } from "../theme/ThemeProvider";
import { DisplayProvider } from "../theme/DisplayProvider";
import { ToastProvider } from "./ui";
import { RefdataProvider } from "../refdata/RefdataProvider";
import { AppShell } from "./AppShell";
import { AppRoutes } from "../AppRoutes";

// Route chrome data calls to sensible JSON; overrides tune per test.
interface FetchOpts {
  pinSet?: boolean;
  staleCount?: number;
  version?: { current: string; latest: string; update_available: boolean; url: string };
  ticker?: boolean;
  /** When true, the first-run checklist is NOT yet complete (overlay should show). */
  firstRun?: boolean;
}

function stubFetch(opts: FetchOpts = {}) {
  const json = (obj: unknown) =>
    new Response(JSON.stringify(obj), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/state")) return json({ pin_set: opts.pinSet ?? false });
      if (url.includes("/auth/unlock")) return json({ ok: true });
      if (url.includes("/auth/set-pin")) return json({ ok: true });
      if (url.includes("/system/data-source"))
        return json({ providers: ["mock", "csv", "yahoo"] });
      if (url.includes("/settings"))
        return json({
          // Default: first-run already complete (overlay stays hidden). Tests that want
          // the overlay pass { firstRun: true }.
          stored: opts.firstRun ? {} : { first_run_complete: "1" },
          defaults: {
            timezone: "Asia/Singapore",
            demo_mode: false,
            base_currency: "SGD",
            market_provider: "mock",
          },
        });
      if (url.includes("/portfolio/summary"))
        return json({ has_stale: (opts.staleCount ?? 0) > 0, stale_count: opts.staleCount ?? 0 });
      if (url.includes("/portfolio/holdings"))
        return json(
          opts.ticker
            ? { holdings: [{ symbol: "AAPL", price: 190.5, day_change_pct: 1.2, is_stale: false }] }
            : {},
        );
      if (url.includes("/markets/global"))
        return json(
          opts.ticker
            ? { groups: [{ items: [{ label: "US · S&P 500", quote: { price: 5000, change_pct: 0.5, is_stale: false } }] }] }
            : {},
        );
      if (url.includes("/system/version-check"))
        return json(
          opts.version ?? { current: "2.0.0", latest: "2.0.0", update_available: false, url: "" },
        );
      return json({});
    }),
  );
}

function renderShell(children: ReactNode, initialEntries: string[] = ["/"]) {
  return render(
    <ThemeProvider>
      <DisplayProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <AppShell>{children}</AppShell>
        </MemoryRouter>
      </DisplayProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => stubFetch());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

test("shell composes chrome ONCE around the page content (D-066)", () => {
  const { container } = renderShell(<div data-testid="page">PAGE BODY</div>);
  // Exactly one sidebar brand + one top bar.
  expect(container.querySelectorAll(".lf-sidebar__brand")).toHaveLength(1);
  expect(container.querySelectorAll(".lf-topbar")).toHaveLength(1);
  // The page content renders in the shell's main region.
  const main = container.querySelector(".lf-shell__content");
  expect(main).not.toBeNull();
  expect(within(main as HTMLElement).getByTestId("page").textContent).toBe("PAGE BODY");
});

test("one page from each of the four templates renders inside the shell", () => {
  // Worklist (Holdings) & entity-detail (Instrument) are real pages; overview and
  // settings pages aren't built yet, so representative bodies stand in — the point
  // is that the shell hosts every layout kind with its chrome intact.
  for (const template of ["overview", "entity-detail", "worklist", "settings"]) {
    const { container, unmount } = renderShell(
      <div data-testid={`tpl-${template}`}>{template} page</div>,
    );
    expect(container.querySelectorAll(".lf-topbar")).toHaveLength(1);
    expect(screen.getByTestId(`tpl-${template}`)).toBeTruthy();
    unmount();
  }
});

test("lock gate shows the LockScreen when a PIN is set, and hides it after unlock", async () => {
  stubFetch({ pinSet: true });
  const user = userEvent.setup();
  renderShell(<div>secret content</div>);

  // Locked after /auth/state resolves.
  const heading = await screen.findByRole("heading", { name: "Locked" });
  expect(heading).toBeTruthy();

  await user.type(screen.getByLabelText("PIN"), "123456");
  await user.click(screen.getByRole("button", { name: "Unlock" }));

  await waitFor(() => expect(screen.queryByRole("heading", { name: "Locked" })).toBeNull());
});

test("global ticker footer: shown when unlocked, HIDDEN entirely under lock (D-002 §11-17d)", async () => {
  stubFetch({ ticker: true, pinSet: false });
  const { unmount } = renderShell(<div>page</div>);
  await waitFor(() => expect(document.querySelector(".lf-ticker")).not.toBeNull());
  unmount();

  // Locked → the ticker is NOT in the DOM at all (leaks nothing).
  stubFetch({ ticker: true, pinSet: true });
  renderShell(<div>page</div>);
  await screen.findByRole("heading", { name: "Locked" });
  expect(document.querySelector(".lf-ticker")).toBeNull();
});

test("UpdateBanner appears only when an update is available (no-egress → hidden)", async () => {
  stubFetch({
    version: { current: "2.0.0", latest: "9.9.9", update_available: true, url: "" },
  });
  renderShell(<div>page</div>);
  expect(await screen.findByText(/9\.9\.9 is available/)).toBeTruthy();
});

test("first-run checklist: shows when incomplete + unlocked; hidden once complete", async () => {
  stubFetch({ firstRun: true, pinSet: false });
  const { unmount } = renderShell(<div>page</div>);
  expect(await screen.findByRole("dialog", { name: "Set up LedgerFrame" })).toBeTruthy();
  unmount();

  // Complete (default) → overlay never appears.
  stubFetch({ firstRun: false, pinSet: false });
  renderShell(<div>page</div>);
  await waitFor(() => expect(document.querySelector(".lf-shell")).not.toBeNull());
  expect(screen.queryByRole("dialog", { name: "Set up LedgerFrame" })).toBeNull();
});

test("first-run checklist stays HIDDEN behind the lock gate, then RESUMES after unlock (F-7)", async () => {
  stubFetch({ firstRun: true, pinSet: true });
  const user = userEvent.setup();
  renderShell(<div>page</div>);
  // Locked → the checklist must not render (unlock precedes onboarding).
  await screen.findByRole("heading", { name: "Locked" });
  expect(screen.queryByRole("dialog", { name: "Set up LedgerFrame" })).toBeNull();

  // Unlock → first-run is still incomplete → the overlay deterministically appears.
  await user.type(screen.getByLabelText("PIN"), "123456");
  await user.click(screen.getByRole("button", { name: "Unlock" }));
  expect(await screen.findByRole("dialog", { name: "Set up LedgerFrame" })).toBeTruthy();
});

test("first-run provider list re-fetches after unlock: empty while locked → populated (post-close regression §11-4)", async () => {
  // The provider list (/system/data-source) is lock-gated: the pre-unlock mount fetch gets
  // 401 → []. Simulate that here (empty until unlocked), and assert the provider dropdown
  // has options AFTER unlock — i.e. AppShell re-reads the state once a session exists.
  const json = (obj: unknown) =>
    new Response(JSON.stringify(obj), { status: 200, headers: { "Content-Type": "application/json" } });
  let unlocked = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/state")) return json({ pin_set: true });
      if (url.includes("/auth/unlock")) {
        unlocked = true;
        return json({ ok: true });
      }
      if (url.includes("/system/data-source"))
        return json({ providers: unlocked ? ["mock", "csv", "yahoo"] : [] }); // locked → empty
      if (url.includes("/settings"))
        return json({ stored: {}, defaults: { base_currency: "SGD", timezone: "Asia/Singapore", market_provider: "" } });
      return json({});
    }),
  );
  const user = userEvent.setup();
  renderShell(<div>page</div>);

  await screen.findByRole("heading", { name: "Locked" });
  await user.type(screen.getByLabelText("PIN"), "123456");
  await user.click(screen.getByRole("button", { name: "Unlock" }));

  const dialog = await screen.findByRole("dialog", { name: "Set up LedgerFrame" });
  // Open the provider commit-menu; its options portal to document.body.
  await user.click(within(dialog).getByRole("button", { name: "Data provider" }));
  await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(0));
});

// Redirects (D-042/D-022/D-056) via the real route tree.
function LocationProbe() {
  return <div data-testid="loc">{useLocation().pathname}</div>;
}

function renderRoutesAt(path: string) {
  return render(
    <ThemeProvider>
      <DisplayProvider>
        <ToastProvider>
          <RefdataProvider>
            <MemoryRouter initialEntries={[path]}>
              <AppRoutes />
              <LocationProbe />
            </MemoryRouter>
          </RefdataProvider>
        </ToastProvider>
      </DisplayProvider>
    </ThemeProvider>,
  );
}

test("/snapshot redirects to /net-worth and /planning to /cash-flow (D-042/D-022/D-056)", async () => {
  renderRoutesAt("/snapshot");
  await waitFor(() => expect(screen.getByTestId("loc").textContent).toBe("/net-worth"));
  cleanup();
  renderRoutesAt("/planning");
  await waitFor(() => expect(screen.getByTestId("loc").textContent).toBe("/cash-flow"));
});

test("a real routed page renders inside the shell with chrome around it", async () => {
  renderRoutesAt("/");
  // Chrome present…
  expect(document.querySelector(".lf-sidebar__brand")).not.toBeNull();
  expect(document.querySelector(".lf-topbar")).not.toBeNull();
  // …with the real page mounted inside the main region.
  expect(await screen.findByText(/Frontend scaffold/)).toBeTruthy();
});

test("an unbuilt route lands on the honest NotBuilt fallback inside the shell", async () => {
  renderRoutesAt("/net-worth");
  expect(document.querySelector(".lf-topbar")).not.toBeNull();
  expect(await screen.findByText(/isn't built yet/)).toBeTruthy();
});
