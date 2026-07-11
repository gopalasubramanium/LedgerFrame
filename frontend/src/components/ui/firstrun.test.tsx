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

test("FirstRunChecklist renders the five steps and dismiss marks complete", async () => {
  const onDismiss = vi.fn();
  render(
    <MemoryRouter>
      <FirstRunChecklist
        open
        baseCurrency="SGD"
        timezone={null}
        pinSet={false}
        provider="mock"
        noEgress={false}
        timezoneOptions={TZ}
        providerOptions={[{ label: "mock", value: "mock" }]}
        links={LINKS}
        onBaseCurrency={() => {}}
        onTimezone={() => {}}
        onSetPin={() => {}}
        onProvider={() => {}}
        onNoEgress={() => {}}
        onDismiss={onDismiss}
      />
    </MemoryRouter>,
  );
  for (const label of ["Base currency", "Timezone", "PIN", "Data provider", "No egress"]) {
    expect(screen.getByText(label)).toBeTruthy();
  }
  await userEvent.click(screen.getByRole("button", { name: "Dismiss setup" }));
  expect(onDismiss).toHaveBeenCalled();
});

test("FirstRunChecklist PIN 'Set PIN' is gated to 6+ digits", async () => {
  const onSetPin = vi.fn();
  render(
    <MemoryRouter>
      <FirstRunChecklist
        open
        baseCurrency="SGD"
        timezone={null}
        pinSet={false}
        provider="mock"
        noEgress={false}
        timezoneOptions={TZ}
        providerOptions={[{ label: "mock", value: "mock" }]}
        links={LINKS}
        onBaseCurrency={() => {}}
        onTimezone={() => {}}
        onSetPin={onSetPin}
        onProvider={() => {}}
        onNoEgress={() => {}}
        onDismiss={() => {}}
      />
    </MemoryRouter>,
  );
  const setPin = screen.getByRole("button", { name: "Set PIN" });
  expect(setPin.hasAttribute("disabled")).toBe(true);
  await userEvent.type(screen.getByLabelText("PIN"), "123456");
  expect(setPin.hasAttribute("disabled")).toBe(false);
  await userEvent.click(setPin);
  expect(onSetPin).toHaveBeenCalledWith("123456");
});

test("FirstRunChecklist renders nothing when closed", () => {
  const { container } = render(
    <MemoryRouter>
      <FirstRunChecklist
        open={false}
        baseCurrency="SGD"
        timezone={null}
        pinSet={false}
        provider="mock"
        noEgress={false}
        timezoneOptions={TZ}
        providerOptions={[{ label: "mock", value: "mock" }]}
        links={LINKS}
        onBaseCurrency={() => {}}
        onTimezone={() => {}}
        onSetPin={() => {}}
        onProvider={() => {}}
        onNoEgress={() => {}}
        onDismiss={() => {}}
      />
    </MemoryRouter>,
  );
  expect(container.querySelector(".lf-firstrun")).toBeNull();
});
