import { afterEach, beforeEach, expect, test, vi } from "vitest";
import indexHtml from "../../index.html?raw";
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
  /** Legal acceptance state (page-legal §11-5). Defaults to accepted — see the stub below. */
  acceptance?: "none" | "stale" | "accepted";
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
      // The acceptance gate (page-legal §11-5) sits in FRONT of the PIN, so every shell test now
      // passes through it. These stubs put the install in the ACCEPTED state, because the tests in
      // this file are about the lock, the ticker and first-run — not about consent. The gate's own
      // behaviour is driven explicitly in AcceptanceGate.test.tsx and in the e2e walk.
      if (url.includes("/legal/gate-copy"))
        return json({ prompt: "P", explainer: "E", stale_note: "S", declined_note: "D" });
      if (url.includes("/legal/acceptance"))
        return json({ status: opts.acceptance ?? "accepted", content_sha256: "x", accepted_at: null });
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

test("sidebar brand is the BrandMark lockup: aria-hidden svg beside the wordmark, accessible name stays 'LedgerFrame' (P-4)", () => {
  const { container } = renderShell(<div>page</div>);
  const brand = container.querySelector(".lf-sidebar__brand") as HTMLElement;
  expect(brand).not.toBeNull();
  // The mark is present, is an <svg>, and is decorative (aria-hidden) — the wordmark is
  // the accessible name, so the lockup reads as one "LedgerFrame", never "graphic LedgerFrame".
  const mark = brand.querySelector("svg.lf-brandmark");
  expect(mark).not.toBeNull();
  expect(mark?.getAttribute("aria-hidden")).toBe("true");
  // The visible/accessible text is exactly the wordmark (the svg contributes nothing).
  expect(brand.textContent?.trim()).toBe("LedgerFrame");
  // The double rule is drawn in the accent token (both themes), not a hardcoded hex.
  expect(mark?.innerHTML).toContain("var(--accent)");
});

test("index.html carries the brand-mark favicon links (SVG primary + PNG fallbacks) (P-4)", () => {
  expect(indexHtml).toContain('rel="icon" type="image/svg+xml" href="/favicon.svg"');
  expect(indexHtml).toContain('href="/favicon-32.png"');
  expect(indexHtml).toContain('rel="apple-touch-icon"');
  // Title unchanged.
  expect(indexHtml).toContain("<title>LedgerFrame</title>");
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
      // Acceptance gate stubs (§11-5) — accepted, so this test exercises what it is named for.
      if (url.includes("/legal/gate-copy"))
        return json({ prompt: "P", explainer: "E", stale_note: "S", declined_note: "D" });
      if (url.includes("/legal/acceptance"))
        return json({ status: "accepted", content_sha256: "x", accepted_at: null });
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

// --------------------------------------------------------------------------- //
// Amendment C — first-run → Settings TAB journeys (page-settings §14ac-2). Each first-run step
// deep-links to the tab holding its control; the guard asserts ARRIVAL AT THE CONTROL, not the href.
// --------------------------------------------------------------------------- //
function stubFirstRunSettings() {
  const json = (obj: unknown) =>
    new Response(JSON.stringify(obj), { status: 200, headers: { "Content-Type": "application/json" } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      // Acceptance gate stubs (§11-5) — accepted, so this test exercises what it is named for.
      if (url.includes("/legal/gate-copy"))
        return json({ prompt: "P", explainer: "E", stale_note: "S", declined_note: "D" });
      if (url.includes("/legal/acceptance"))
        return json({ status: "accepted", content_sha256: "x", accepted_at: null });
      if (url.includes("/auth/state")) return json({ pin_set: false });
      if (url.includes("/system/data-source"))
        return json({ provider: "mock", has_api_key: false, base_currency: "SGD", providers: ["mock", "csv", "yahoo"], admin_available: true });
      if (url.includes("/system/config")) return json({ timezone: "Asia/Singapore", autolock_minutes: "15", stale_after_seconds: "900" });
      if (url.includes("/system/ai-config")) return json({ enabled: false, provider: "disabled", model: "", has_openai_key: false });
      if (url.includes("/system/admin/available")) return json({ available: true });
      if (url.includes("/system/status")) return json({ allow_lan: false });
      if (url.includes("/tokens")) return json({ tokens: [] });
      if (url.includes("/news/feeds")) return json({ feeds: [], defaults: [] });
      if (url.includes("/settings"))
        return json({
          stored: {},
          defaults: { base_currency: "SGD", timezone: "Asia/Singapore", market_provider: "mock", supported_currencies: ["SGD", "USD"], long_term_days: 365 },
        });
      if (url.includes("/portfolio/summary")) return json({ has_stale: false, stale_count: 0 });
      return json({});
    }),
  );
}

test("Amendment C journey: a first-run step deep-links to the Settings tab holding its control", async () => {
  stubFirstRunSettings();
  const user = userEvent.setup();
  renderRoutesAt("/");
  // The overlay appears (first-run incomplete + no PIN → no lock gate).
  await screen.findByRole("dialog", { name: "Set up LedgerFrame" });
  // The Data provider step's link ("Add an API key →") deep-links to the Data feeds tab (§14st-1).
  await user.click(screen.getByRole("link", { name: /Add an API key/ }));
  // Arrival at the CONTROL, not the href: we are on /settings AND the provider control is present
  // (destination-only guards lie — assert the control, which now lives on the Data feeds tab).
  await waitFor(() => expect(screen.getByTestId("loc").textContent).toBe("/settings"));
  expect(await screen.findByLabelText("Market data provider")).toBeTruthy(); // §12st-2, Data feeds tab
});

test("Amendment C: every first-run step links to the correct Settings tab", async () => {
  stubFirstRunSettings();
  renderRoutesAt("/");
  await screen.findByRole("dialog", { name: "Set up LedgerFrame" });
  // Base currency + Timezone → General; PIN → System; provider → Data feeds (§14st-1); no-egress → Privacy.
  const general = screen.getAllByRole("link", { name: /More options/ });
  expect(general.every((a) => a.getAttribute("href")?.includes("tab="))).toBe(true);
  // The provider step ("Add an API key →") moved to the Data feeds tab with the provider/key controls.
  expect(screen.getByRole("link", { name: /Add an API key/ }).getAttribute("href")).toContain("tab=data-feeds");
  // At least one step deep-links to each of general / data-feeds / system (PIN) / privacy.
  const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href") ?? "");
  expect(hrefs.some((h) => h.includes("tab=general"))).toBe(true);
  expect(hrefs.some((h) => h.includes("tab=data-feeds"))).toBe(true);
  expect(hrefs.some((h) => h.includes("tab=system"))).toBe(true);
  expect(hrefs.some((h) => h.includes("tab=privacy"))).toBe(true);
});

test("the routed page renders inside the shell with chrome around it — `/` is HOME (§12ho1-6)", async () => {
  renderRoutesAt("/");
  // Chrome present…
  expect(document.querySelector(".lf-sidebar__brand")).not.toBeNull();
  expect(document.querySelector(".lf-topbar")).not.toBeNull();
  // …with Home mounted inside it: the REBUILT page on the ratified grid (§12ho1-5), wired to the
  // canonical readers. No fragment of the rejected assembly (`.hm2`) survives, and the page renders
  // WITHOUT waiting on a layout: there is only one (§12ho1-6), so it never gates on /settings.
  await waitFor(() => expect(document.querySelector(".hm3")).not.toBeNull());
  expect(document.querySelector(".hm2")).toBeNull();
  expect(document.querySelector(".lf-notbuilt")).toBeNull();
});

test("an unbuilt route lands on the honest NotBuilt fallback inside the shell", async () => {
  // REPOINTED A SECOND TIME, and this time there is no successor in the nav to point at.
  //
  // The history is the point: this test used /help until page-help Phase 1 built it, then /legal
  // because that was "the remaining one". page-legal Phase 1 builds Legal, and with it EVERY nav
  // item now carries `built: true` — the dead-affordance backlog is empty.
  //
  // So the example moves off the nav model entirely, to a path that was never in it. That is the
  // honest specimen from here on: the fallback exists for a URL the user typed, pasted, or
  // followed from a stale bookmark — not for a page the product advertises and has not built. If
  // a future milestone adds an unbuilt nav item, THAT is the regression, and `chrome.test.tsx`'s
  // progressive-reveal assertions are where it would show.
  renderRoutesAt("/not-a-real-page");
  expect(document.querySelector(".lf-topbar")).not.toBeNull();
  expect(await screen.findByText(/isn't built yet/)).toBeTruthy();
});
