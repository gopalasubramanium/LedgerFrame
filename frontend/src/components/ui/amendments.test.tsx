import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog, Dialog, FileInput, ToastProvider, useToast } from "./index";

afterEach(cleanup);

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>trigger</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Editor">
        <button>inside</button>
      </Dialog>
    </>
  );
}

test("Dialog opens modally, closes on Esc, and restores focus to the trigger", async () => {
  const user = userEvent.setup();
  render(<DialogHarness />);
  const trigger = screen.getByRole("button", { name: "trigger" });
  await user.click(trigger);
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveAttribute("aria-modal", "true");
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement).toBe(trigger);
});

test("ConfirmDialog requires a 6-digit PIN before confirming", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  render(
    <ConfirmDialog
      open
      title="Purge?"
      message="Cannot be undone."
      confirmLabel="Purge"
      requirePin
      onCancel={() => {}}
      onConfirm={onConfirm}
    />,
  );
  const confirm = screen.getByRole("button", { name: "Purge" });
  expect(confirm).toBeDisabled();
  await user.type(screen.getByLabelText("PIN"), "12345");
  expect(confirm).toBeDisabled();
  await user.type(screen.getByLabelText("PIN"), "6");
  expect(confirm).toBeEnabled();
  await user.click(confirm);
  expect(onConfirm).toHaveBeenCalledWith("123456");
});

test("ConfirmDialog PIN entry rejects non-numeric characters", async () => {
  const user = userEvent.setup();
  render(
    <ConfirmDialog
      open
      title="Purge?"
      message="x"
      requirePin
      onCancel={() => {}}
      onConfirm={() => {}}
    />,
  );
  const pin = screen.getByLabelText("PIN") as HTMLInputElement;
  await user.type(pin, "1a2b3c");
  expect(pin.value).toBe("123");
});

test("FileInput reports the chosen file (native input wrapped, not raw)", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<FileInput aria-label="Import CSV" onChange={onChange} accept=".csv" />);
  const input = screen.getByLabelText("Import CSV") as HTMLInputElement;
  const file = new File(["a,b,c"], "holdings.csv", { type: "text/csv" });
  await user.upload(input, file);
  expect(onChange).toHaveBeenCalled();
  expect(screen.getByText("holdings.csv")).toBeInTheDocument();
});

function ToastTrigger() {
  const t = useToast();
  return (
    <button
      onClick={() =>
        t.show({
          message: "Deleted.",
          action: { label: "Undo", onClick: () => {} },
          durationMs: 1000,
        })
      }
    >
      del
    </button>
  );
}

test("Toast shows an undo action and auto-dismisses after its duration", async () => {
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <ToastTrigger />
    </ToastProvider>,
  );
  await user.click(screen.getByRole("button", { name: "del" }));
  expect(screen.getByText("Deleted.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  // Auto-dismiss after durationMs (1000).
  await waitFor(
    () => expect(screen.queryByText("Deleted.")).toBeNull(),
    { timeout: 2000 },
  );
});

test("Toast Undo action fires and dismisses the toast", async () => {
  const onUndo = vi.fn();
  function Trigger() {
    const t = useToast();
    return (
      <button
        onClick={() => t.show({ message: "Removed.", action: { label: "Undo", onClick: onUndo }, durationMs: 60000 })}
      >
        go
      </button>
    );
  }
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>,
  );
  await user.click(screen.getByRole("button", { name: "go" }));
  await user.click(screen.getByRole("button", { name: "Undo" }));
  expect(onUndo).toHaveBeenCalledOnce();
  expect(screen.queryByText("Removed.")).toBeNull();
});
