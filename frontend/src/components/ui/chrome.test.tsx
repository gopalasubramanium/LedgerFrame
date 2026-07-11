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
  // Holdings is built; Portfolio is not yet — so only Holdings appears by default.
  expect(screen.getByRole("link", { name: "Holdings" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Portfolio" })).toBeNull();

  rerender(
    <MemoryRouter initialEntries={["/holdings"]}>
      <Sidebar showAll />
    </MemoryRouter>,
  );
  expect(screen.getByRole("link", { name: "Portfolio" })).toBeTruthy();
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

// --- TopBar stateful glyphs (state-distinct icon rule) ----------------------
test("TopBar rotation and Detail toggles render a distinct glyph per state", () => {
  const { rerender } = render(
    <TopBar
      rotationOn={false}
      onToggleRotation={() => {}}
      detailLevel="simple"
      onToggleDetail={() => {}}
    />,
  );
  expect(screen.getByRole("button", { name: /Rotation: Off/ }).textContent).toBe("⊘");
  expect(screen.getByRole("button", { name: /Detail level: Simple/ }).textContent).toBe("╱");

  rerender(
    <TopBar
      rotationOn
      onToggleRotation={() => {}}
      detailLevel="full"
      onToggleDetail={() => {}}
    />,
  );
  expect(screen.getByRole("button", { name: /Rotation: On/ }).textContent).toBe("↻");
  expect(screen.getByRole("button", { name: /Detail level: Full/ }).textContent).toBe("╪");
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
test("Clock renders a frozen time in the given timezone", () => {
  // 2026-07-11T04:30:00Z is 12:30 in Asia/Singapore (UTC+8).
  render(<Clock timezone="Asia/Singapore" now={new Date("2026-07-11T04:30:00Z")} />);
  expect(screen.getByText("12:30")).toBeTruthy();
  expect(screen.getByText("Singapore")).toBeTruthy();
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
