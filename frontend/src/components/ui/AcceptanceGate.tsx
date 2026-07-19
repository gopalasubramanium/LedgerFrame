import { useEffect, useId, useState } from "react";
import "./chrome.css";
import "./structure.css";
import "./inputs.css";

// THE ACCEPTANCE GATE, front end (page-legal §11-5, owner 2026-07-20).
//
// The owner ruled: the user must accept the licence terms + the product position, and unaccepted
// installs are LOCKED AT ENTRY. The enforcement is SERVER-SIDE and already shipped (§11-E1) — every
// /api/v1 read answers 451 until this install has accepted. THIS COMPONENT IS NOT THE LOCK. It is
// the only way a person can answer the question the lock is asking, and it is worth being precise
// about that: if this file were deleted the data would still be refused, which is the difference
// between a gate and a picture of one.
//
// IT SITS IN FRONT OF THE PIN, mirroring the server, where the acceptance check runs BEFORE the PIN
// check. Terms first, then unlock. The other order would leave an unaccepted PIN-less install —
// which is every fresh install — wide open.
//
// EVERY STRING A USER READS HERE IS SERVED (§9-3 / §9-8). Nothing in this file authors consent
// copy. The prompt is what the person is RECORDED as having agreed to, so it is held to the
// server-side accuracy bar rather than typed into a component where no guard can reach it.
// ⚑ The wording is PROPOSED until the owner's look.
export interface AcceptanceGateProps {
  open: boolean;
  /** `stale` = a returning user being re-asked because the document changed. Greeted differently. */
  state: "none" | "stale";
  /** Served copy — `null` while it is still loading. */
  copy: { prompt: string; explainer: string; stale_note: string; declined_note: string } | null;
  onAccept: () => void;
  onDecline: () => void;
  /** Set once a decline has been recorded in this session — the install stays locked. */
  declined?: boolean;
  busy?: boolean;
  error?: string | null;
  /** Opens the full Legal document. The gate hides while it is being read; it does not unmount. */
  onReadLegal: () => void;
}

export function AcceptanceGate({
  open,
  state,
  copy,
  onAccept,
  onDecline,
  declined,
  busy,
  error,
  onReadLegal,
}: AcceptanceGateProps) {
  const [checked, setChecked] = useState(false);
  const boxId = useId();

  // Re-arm whenever the gate re-opens. A checkbox left ticked from a previous appearance would let
  // a re-ask after a CHANGED DOCUMENT be accepted with one click, against a text the person has not
  // seen — the exact failure the re-lock exists to prevent.
  useEffect(() => {
    if (open) setChecked(false);
  }, [open, state]);

  if (!open) return null;

  const canAccept = checked && !busy && !!copy;

  return (
    <div className="lf-lock lf-gate" role="dialog" aria-modal="true" aria-label="Accept the terms">
      <div className="lf-card lf-lock__panel lf-gate__panel">
        <div className="lf-lock__brand">LedgerFrame</div>
        <h1 className="lf-lock__title">Before you begin</h1>

        {/* The stale note REPLACES nothing and ADDS context: a returning user is told why they are
            being asked again, rather than being silently treated as new. */}
        {state === "stale" && copy && (
          <p className="lf-gate__stale" role="status">
            {copy.stale_note}
          </p>
        )}

        <p className="lf-lock__hint">{copy ? copy.explainer : "Loading the terms…"}</p>

        {/* READABLE WITHOUT ACCEPTING — a ruling, not a convenience (§11-E1). A gate demanding
            acceptance of a text it would not show is asking for consent that cannot be informed.
            The server exempts /legal for the same reason. */}
        <div className="lf-gate__row">
          <button type="button" className="lf-btn" onClick={onReadLegal}>
            Read the Legal page
          </button>
        </div>

        <label className="lf-gate__check" htmlFor={boxId}>
          <input
            id={boxId}
            type="checkbox"
            checked={checked}
            disabled={busy || !copy}
            onChange={(e) => setChecked(e.target.checked)}
          />
          {/* The served prompt names EXACTLY what is being accepted. It is the sentence the
              acceptance record binds to, so it is rendered verbatim and never summarised. */}
          <span className="lf-gate__prompt">{copy?.prompt ?? ""}</span>
        </label>

        {declined && copy && (
          <p className="lf-gate__declined" role="alert">
            {copy.declined_note}
          </p>
        )}
        {error && (
          <span className="lf-lock__error" role="alert">
            {error}
          </span>
        )}

        <div className="lf-lock__row lf-gate__actions">
          <button
            type="button"
            className="lf-btn lf-btn--primary"
            disabled={!canAccept}
            onClick={onAccept}
          >
            {busy ? "Recording…" : "Accept and continue"}
          </button>
          {/* DECLINE IS A REAL ANSWER, not a cancel. It is recorded, and the install stays locked.
              Offering only "Accept" would make the record meaningless: consent that cannot be
              refused is not consent, and an event log with no declines in it proves nothing. */}
          <button type="button" className="lf-btn" disabled={busy} onClick={onDecline}>
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
