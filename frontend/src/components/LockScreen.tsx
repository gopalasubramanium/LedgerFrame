import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useApp } from "../store/app";

// Full-screen PIN gate. Two modes:
//  - "setup": no PIN exists yet but one is required (e.g. LAN is on) — create one.
//  - "unlock": a PIN exists and the session is locked — enter it to unlock.
export function LockScreen({ mode }: { mode: "unlock" | "setup" }) {
  const { setLocked, refreshStatus } = useApp();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  // In setup mode, once the first PIN has 4+ digits we capture the confirmation.
  const onConfirmStep = mode === "setup" && pin.length >= 4;
  const shown = onConfirmStep ? confirm : pin;

  async function submit() {
    setError("");
    if (mode === "unlock") {
      try { await api.unlock(pin); setLocked(false); }
      catch { setError("Incorrect PIN"); setPin(""); }
      return;
    }
    if (pin.length < 4) { setError("PIN must be at least 4 digits"); return; }
    if (confirm !== pin) { setError("PINs don't match — try again"); setConfirm(""); return; }
    try { await api.setPin(pin); refreshStatus(); setLocked(false); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not set PIN"); }
  }

  function key(k: string) {
    const setter = onConfirmStep ? setConfirm : setPin;
    if (k === "⌫") setter((p) => p.slice(0, -1));
    else if (k === "↵") submit();
    else setter((p) => (p.length < 12 ? p + k : p));
  }

  // Allow a physical keyboard too (digits / Backspace / Enter), not just the keypad.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); key(e.key); }
      else if (e.key === "Backspace") { e.preventDefault(); key("⌫"); }
      else if (e.key === "Enter") { e.preventDefault(); key("↵"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // Rebind on state change so Enter submits with the latest pin/confirm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, confirm, onConfirmStep]);

  const heading =
    mode === "setup"
      ? onConfirmStep ? "Re-enter your PIN to confirm" : "Create a PIN to secure this device"
      : "Enter your PIN to unlock";

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-base">
      <div className="text-accent text-2xl font-semibold mb-1 tracking-tight">LedgerFrame</div>
      <p className="text-muted">{heading}</p>
      <p className="text-xs text-faint mt-1 mb-5 h-4">
        {mode === "setup" ? "LAN access is on, so a PIN is required." : ""}
      </p>
      <div className="tnum text-figure tracking-[0.4em] h-10 mb-4">{"•".repeat(shown.length)}</div>
      {error && <p className="text-down text-sm mb-2">{error}</p>}
      <div className="grid grid-cols-3 gap-3 w-72">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "↵"].map((k) => (
          <button key={k} className="lf-btn h-16 text-xl" onClick={() => key(k)}>{k}</button>
        ))}
      </div>
      <p className="text-xs text-faint mt-4">Type on your keyboard or tap — Enter to submit, Backspace to delete.</p>
    </div>
  );
}
