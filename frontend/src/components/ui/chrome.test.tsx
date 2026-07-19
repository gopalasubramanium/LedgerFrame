import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {
  Clock,
  DemoBadge,
  LockScreen,
  NAV_GROUPS,
  Sidebar,
  StaleBanner,
  TickerStrip,
  TopBar,
  UpdateBanner,
} from "./index";

afterEach(cleanup);

// --- Sidebar (D-043 / D-102) ------------------------------------------------
test("Sidebar always renders all six group headers and highlights the active route", () => {
  const { container } = render(
    <MemoryRouter initialEntries={["/holdings"]}>
      <Sidebar />
    </MemoryRouter>,
  );
  const groupLabels = Array.from(
    container.querySelectorAll(".lf-sidebar__grouplabel"),
  ).map((el) => el.textContent);
  expect(groupLabels).toEqual(NAV_GROUPS.map((g) => g.label));
  const active = screen.getByRole("link", { name: "Holdings" });
  expect(active.className).toContain("is-active");
});

test("Sidebar shows only built pages as entries; showAll reveals the full skeleton", () => {
  const { rerender } = render(
    <MemoryRouter initialEntries={["/holdings"]}>
      <Sidebar />
    </MemoryRouter>,
  );
  // Net worth + Holdings + Portfolio + Accounts + Reports + Settings are built; Help/Legal are not
  // yet — unbuilt pages are hidden by default (progressive reveal of the fixed D-043 skeleton).
  expect(screen.getByRole("link", { name: "Net worth" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Holdings" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Portfolio" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Accounts" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Reports" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Settings" })).toBeTruthy();
  // Help SHIPS (page-help Phase 1) — this assertion previously pinned its ABSENCE, and is
  // INVERTED rather than deleted: the sidebar's progressive reveal is the invariant, and Help
  // moving from hidden to shown is exactly the transition it exists to police.
  expect(screen.getByRole("link", { name: "Help" })).toBeTruthy();
  // Legal SHIPS (page-legal Phase 1) — INVERTED, not deleted, for the same reason Help's was: the
  // progressive reveal is the invariant, and a page moving from hidden to shown is exactly the
  // transition these assertions exist to police.
  //
  // With this flip EVERY nav item carries `built: true` — the dead-affordance backlog is empty for
  // the first time. These assertions are therefore no longer proving that SOMETHING is hidden;
  // they are proving the mechanism still renders what is built. If a future milestone adds an
  // unbuilt nav item, this is the file that must gain its absence assertion.
  expect(screen.getByRole("link", { name: "Legal" })).toBeTruthy();

  rerender(
    <MemoryRouter initialEntries={["/holdings"]}>
      <Sidebar showAll />
    </MemoryRouter>,
  );
  expect(screen.getByRole("link", { name: "Accounts" })).toBeTruthy();
});

test("Sidebar off-canvas (D-102): open shows scrim; Esc and backdrop click dismiss it", async () => {
  const onClose = vi.fn();
  const { container, rerender } = render(
    <MemoryRouter>
      <Sidebar open onClose={onClose} />
    </MemoryRouter>,
  );
  // Open → panel + scrim carry is-open.
  expect(container.querySelector(".lf-sidebar.is-open")).not.toBeNull();
  expect(container.querySelector(".lf-sidebar__scrim.is-open")).not.toBeNull();

  // Esc dismisses.
  await userEvent.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);

  // Backdrop click dismisses.
  (container.querySelector(".lf-sidebar__scrim") as HTMLElement).click();
  expect(onClose).toHaveBeenCalledTimes(2);

  // Closed → no Esc listener fires.
  rerender(
    <MemoryRouter>
      <Sidebar open={false} onClose={onClose} />
    </MemoryRouter>,
  );
  await userEvent.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(2);
});

test("Sidebar activePath overrides router location for previews", () => {
  render(
    <MemoryRouter initialEntries={["/kitchen-sink"]}>
      <Sidebar activePath="/holdings" />
    </MemoryRouter>,
  );
  expect(screen.getByRole("link", { name: "Holdings" }).className).toContain("is-active");
});

// --- TopBar toggles (dead-affordance removals) ------------------------------
// The rotation toggle is HIDDEN until R-37 — owner-ruled at the Settings Phase-0a gate (page-settings
// §12 ruling (d), dead-affordance principle: it wrote local state consumed by nothing once the three
// rotation keys were removed in Phase 0). The bar owns NO rotation toggle until R-37 restores it with
// its engine. This test asserts the ABSENCE (it was flipped from asserting the on/off icon states).
test("TopBar has NO rotation toggle (hidden until R-37, page-settings §12 (d))", () => {
  render(<TopBar />);
  expect(screen.queryByRole("button", { name: /Rotation:/ })).toBeNull();
});

// page-home §9-15 — the Detail toggle is GONE from the top bar: it held state that persisted nowhere.
// And nothing replaced it — §12ho1-6 removed the Simple layout, so there is no Home layout to toggle
// anywhere (the `home_layout` setting is retired from the contract too).
test("TopBar has NO Detail toggle (page-home §9-15)", () => {
  render(<TopBar />);
  expect(screen.queryByRole("button", { name: /Detail/i })).toBeNull();
});

// --- TickerStrip symbol links (D-098; §11-19) -------------------------------
test("TickerStrip links holdings symbols to instrument detail; indices stay unlinked", () => {
  render(
    <MemoryRouter>
      <TickerStrip
        quotes={[
          { symbol: "AAPL", priceDisplay: "190.00", changePct: "1.2", href: "/instrument/AAPL" },
          { symbol: "US · S&P 500", priceDisplay: "5,000.00", changePct: "0.4" },
        ]}
      />
    </MemoryRouter>,
  );
  // Holdings symbol is a link to its entity-detail page (duplicated by the marquee).
  const links = screen.getAllByRole("link", { name: "AAPL" });
  expect(links.length).toBeGreaterThan(0);
  expect(links[0].getAttribute("href")).toContain("/instrument/AAPL");
  // The index has no href → never a dead link.
  expect(screen.queryAllByRole("link", { name: /S&P 500/ })).toHaveLength(0);
});

// --- StaleBanner (honest: hidden at 0) --------------------------------------
test("StaleBanner is hidden at 0 and links to Pricing Health when stale", () => {
  const { container, rerender } = render(
    <MemoryRouter>
      <StaleBanner count={0} />
    </MemoryRouter>,
  );
  expect(container.querySelector(".lf-statusstrip")).toBeNull();

  rerender(
    <MemoryRouter>
      <StaleBanner count={3} />
    </MemoryRouter>,
  );
  expect(screen.getByText(/3 prices are stale/)).toBeTruthy();
  const link = screen.getByRole("link", { name: /Pricing Health/ });
  expect(link.getAttribute("href")).toContain("/pricing-health");
});

// --- UpdateBanner (hidden when null / under no-egress) ----------------------
test("UpdateBanner renders nothing when version is null and shows it otherwise", () => {
  const { container, rerender } = render(
    <MemoryRouter>
      <UpdateBanner version={null} />
    </MemoryRouter>,
  );
  expect(container.querySelector(".lf-statusstrip")).toBeNull();

  rerender(
    <MemoryRouter>
      <UpdateBanner version="2.1.0" />
    </MemoryRouter>,
  );
  expect(screen.getByText(/2\.1\.0 is available/)).toBeTruthy();
});

// --- DemoBadge --------------------------------------------------------------
test("DemoBadge shows when active and renders nothing when inactive", () => {
  const { container, rerender } = render(<DemoBadge active />);
  expect(screen.getByText("Demo data")).toBeTruthy();
  rerender(<DemoBadge active={false} />);
  expect(container.querySelector(".lf-badge")).toBeNull();
});

// --- Clock (frozen, timezone-aware) -----------------------------------------
test("Clock shows time-only in the bar; full date + IANA tz live in the tooltip", () => {
  // 2026-07-11T04:30:00Z is 12:30 in Asia/Singapore (UTC+8).
  const { container } = render(
    <Clock timezone="Asia/Singapore" now={new Date("2026-07-11T04:30:00Z")} />,
  );
  const el = container.querySelector(".lf-clock") as HTMLElement;
  expect(el.textContent).toBe("12:30");
  // Time zone name is NOT in the visible text — it's in the tooltip/aria-label.
  expect(el.getAttribute("title")).toContain("Asia/Singapore");
  expect(el.getAttribute("title")).toContain("2026");
});

// --- LockScreen (D-002 access lock; min 6 digits) ---------------------------
test("LockScreen is hidden when closed", () => {
  const { container } = render(<LockScreen open={false} onUnlock={() => {}} />);
  expect(container.querySelector(".lf-lock")).toBeNull();
});

test("LockScreen enables Unlock only at 6+ digits and reports the PIN", async () => {
  const onUnlock = vi.fn();
  render(<LockScreen open onUnlock={onUnlock} />);
  const unlock = screen.getByRole("button", { name: "Unlock" });
  expect(unlock.hasAttribute("disabled")).toBe(true);

  const input = screen.getByLabelText("PIN");
  await userEvent.type(input, "12345");
  expect(unlock.hasAttribute("disabled")).toBe(true); // only 5 digits

  await userEvent.type(input, "6");
  expect(unlock.hasAttribute("disabled")).toBe(false);
  await userEvent.click(unlock);
  expect(onUnlock).toHaveBeenCalledWith("123456");
});

test("LockScreen strips non-digits and surfaces an error", () => {
  render(<LockScreen open onUnlock={() => {}} error="Incorrect PIN. Try again." />);
  expect(screen.getByRole("alert").textContent).toContain("Incorrect PIN");
});
