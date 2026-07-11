import type React from "react";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Switch, Combobox, FirstRunChecklist } from "./index";

afterEach(cleanup);

const TZ = [
  { label: "Asia/Tokyo", value: "Asia/Tokyo" },
  { label: "Europe/London", value: "Europe/London" },
];
const LINKS = { general: "/s", security: "/s", prices: "/s", privacy: "/s" };

test("Switch toggles aria-checked and reports the new value", async () => {
  const onChange = vi.fn();
  render(<Switch checked={false} onChange={onChange} aria-label="No egress" />);
  const sw = screen.getByRole("switch", { name: "No egress" });
  expect(sw.getAttribute("aria-checked")).toBe("false");
  await userEvent.click(sw);
  expect(onChange).toHaveBeenCalledWith(true);
});

test("Combobox filters options by query and reports the picked value", async () => {
  const onChange = vi.fn();
  render(<Combobox options={TZ} value={null} onChange={onChange} aria-label="Timezone" />);
  const input = screen.getByRole("combobox", { name: "Timezone" });
  await userEvent.click(input);
  await userEvent.type(input, "Tokyo");
  // Filtered to the match only.
  expect(screen.queryByRole("option", { name: "Europe/London" })).toBeNull();
  await userEvent.click(screen.getByRole("option", { name: "Asia/Tokyo" }));
  expect(onChange).toHaveBeenCalledWith("Asia/Tokyo");
});


// FirstRunChecklist — helper with defaults so new props don't churn every test.
function renderChecklist(overrides: Partial<React.ComponentProps<typeof FirstRunChecklist>> = {}) {
  const props = {
    open: true,
    baseCurrency: "SGD",
    timezone: null,
    pinSet: false,
    provider: "mock",
    noEgress: false,
    timezoneOptions: TZ,
    providerOptions: [{ label: "mock", value: "mock" }],
    links: LINKS,
    onBaseCurrency: () => {},
    onTimezone: () => {},
    onSetPin: () => {},
    onProvider: () => {},
    onNoEgress: () => {},
    onDismiss: () => {},
    onNavigateAway: () => {},
    ...overrides,
  };
  return render(
    <MemoryRouter>
      <FirstRunChecklist {...props} />
    </MemoryRouter>,
  );
}

test("FirstRunChecklist renders the five steps and dismiss marks complete", async () => {
  const onDismiss = vi.fn();
  renderChecklist({ onDismiss });
  for (const label of ["Base currency", "Timezone", "PIN", "Data provider", "No egress"]) {
    expect(screen.getByText(label)).toBeTruthy();
  }
  await userEvent.click(screen.getByRole("button", { name: "Dismiss setup" }));
  expect(onDismiss).toHaveBeenCalled();
});

test("FirstRunChecklist is 0/5 on a fresh instance; steps are 'not set' (pending), defaults pre-filled (§F-3/§F-4)", () => {
  const { container } = renderChecklist({ baseCurrency: "SGD", provider: "mock", timezone: "Asia/Tokyo" });
  expect(screen.getByText("0 of 5 confirmed")).toBeTruthy();
  // No step reads as confirmed even though currency/timezone/provider have default values.
  expect(container.querySelectorAll(".lf-firstrun__badge.is-confirmed")).toHaveLength(0);
  expect(container.querySelectorAll(".lf-firstrun__badge.is-pending").length).toBeGreaterThanOrEqual(5);
});

test("FirstRunChecklist: interacting confirms a step (0/5 → 1/5) and writes (§F-4)", async () => {
  const onNoEgress = vi.fn();
  const { container } = renderChecklist({ onNoEgress });
  await userEvent.click(screen.getByRole("switch", { name: "No egress" }));
  expect(onNoEgress).toHaveBeenCalledWith(true);
  expect(screen.getByText("1 of 5 confirmed")).toBeTruthy();
  expect(container.querySelectorAll(".lf-firstrun__badge.is-confirmed")).toHaveLength(1);
});

test("FirstRunChecklist: a 'more options' link calls onNavigateAway (closes, does NOT complete — §F-2)", async () => {
  const onNavigateAway = vi.fn();
  const onDismiss = vi.fn();
  renderChecklist({ onNavigateAway, onDismiss });
  await userEvent.click(screen.getAllByRole("link", { name: /More options|Add an API key/ })[0]);
  expect(onNavigateAway).toHaveBeenCalled();
  expect(onDismiss, "link-out must NOT complete the checklist").not.toHaveBeenCalled();
});

test("FirstRunChecklist PIN 'Set PIN' is gated to 6+ digits", async () => {
  const onSetPin = vi.fn();
  renderChecklist({ onSetPin });
  const setPin = screen.getByRole("button", { name: "Set PIN" });
  expect(setPin.hasAttribute("disabled")).toBe(true);
  await userEvent.type(screen.getByLabelText("PIN"), "123456");
  expect(setPin.hasAttribute("disabled")).toBe(false);
  await userEvent.click(setPin);
  expect(onSetPin).toHaveBeenCalledWith("123456");
});

test("FirstRunChecklist renders nothing when closed", () => {
  const { container } = renderChecklist({ open: false });
  expect(container.querySelector(".lf-firstrun")).toBeNull();
});
