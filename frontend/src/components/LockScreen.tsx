import { useState } from "react";
import { api } from "../lib/api";
import { useApp } from "../store/app";

// Full-screen PIN unlock. Shown when a PIN is set and the session is locked.
export function LockScreen() {
  const { setLocked } = useApp();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    try {
      await api.unlock(pin);
      setLocked(false);
    } catch {
      setError("Incorrect PIN");
      setPin("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-base">
      <div className="text-accent text-2xl font-semibold mb-1 tracking-tight">LedgerFrame</div>
      <p className="text-muted mb-6">Enter your PIN to unlock</p>
      <div className="tnum text-figure tracking-[0.4em] h-10 mb-4">{"•".repeat(pin.length)}</div>
      {error && <p className="text-down text-sm mb-2">{error}</p>}
      <div className="grid grid-cols-3 gap-3 w-72">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "↵"].map((k) => (
          <button
            key={k}
            className="lf-btn h-16 text-xl"
            onClick={() => {
              if (k === "⌫") setPin((p) => p.slice(0, -1));
              else if (k === "↵") submit();
              else if (pin.length < 12) setPin((p) => p + k);
            }}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}
