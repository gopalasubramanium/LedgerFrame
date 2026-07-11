import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommitMenu } from "./CommitMenu";

afterEach(cleanup);

const OPTS = [
  { label: "mock", value: "mock" },
  { label: "csv", value: "csv" },
  { label: "yahoo", value: "yahoo" },
];

// Post-close regression guard (§11-4): the empty first-run provider dropdown was a DATA
// bug (lock-gated endpoint returned []), NOT CommitMenu. These tests pin that CommitMenu
// renders exactly the options it is handed — non-zero for a populated field, zero only when
// the field itself is empty — so the two causes can never be confused again.
test("open renders exactly the options the field was given (non-zero for a populated field)", async () => {
  render(<CommitMenu options={OPTS} value="mock" onCommit={() => {}} aria-label="Data provider" />);
  await userEvent.click(screen.getByRole("button", { name: "Data provider" }));
  const options = screen.getAllByRole("option");
  expect(options).toHaveLength(OPTS.length);
  expect(options.map((o) => o.textContent)).toEqual(["mock", "csv", "yahoo"]);
});

test("commits on picking the value already shown (same-value confirm, F3)", async () => {
  const onCommit = vi.fn();
  render(<CommitMenu options={OPTS} value="mock" onCommit={onCommit} aria-label="Data provider" />);
  await userEvent.click(screen.getByRole("button", { name: "Data provider" }));
  await userEvent.click(screen.getByRole("option", { name: "mock" })); // the current value
  expect(onCommit).toHaveBeenCalledWith("mock");
});

test("an empty option list renders zero options (the field, not the control, is empty)", async () => {
  render(<CommitMenu options={[]} value="" onCommit={() => {}} aria-label="Data provider" />);
  await userEvent.click(screen.getByRole("button", { name: "Data provider" }));
  expect(screen.queryAllByRole("option")).toHaveLength(0);
});
