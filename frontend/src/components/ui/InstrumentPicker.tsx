import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./inputs.css";
import "./InstrumentPicker.css";
import { searchInstruments } from "../../api/instruments";
import type { InstrumentSearchItem } from "../../api/instruments";

// Class-aware typeahead over existing instruments + provider search, with an
// EXPLICIT "create new instrument" path — no silent auto-create (DESIGN-SYSTEM
// §5.1, D-012). D-097: the picked asset class filters BOTH pools — existing
// instruments by stored asset_class, and provider search routed to that class's
// provider only (AMFI / CoinGecko / market). A symbol that exists under a DIFFERENT
// class is shown as a navigate-to link, never selectable into the wrong flow.
// The result menu is PORTALED and overlays within the viewport (never expands the
// dialog or creates dialog-level scroll — universal popover rule, §6).
export interface PickedInstrument {
  id: string;
  symbol: string;
  name: string;
  currency: string;
  assetClass: string;
}
export type InstrumentPick =
  | { kind: "existing"; instrument: PickedInstrument }
  // §14dr-16 — a create from a master SUGGESTION carries the master's display name so the
  // new instrument isn't identified by its bare code (e.g. AMFI "103504"). A plain typed
  // create (no suggestion) has no name and stays undefined.
  | { kind: "create"; query: string; name?: string };

export interface InstrumentPickerProps {
  value?: string;
  onSelect: (pick: InstrumentPick) => void;
  allowCreate?: boolean;
  /** The Add-flow's picked asset class (D-097) — filters existing + routes search. */
  assetClass?: string;
  disabled?: boolean;
}

const EMPTY = { existing: [], other_class: [], suggestions: [], master: null };

export function InstrumentPicker({
  value,
  onSelect,
  allowCreate = true,
  assetClass,
  disabled,
}: InstrumentPickerProps) {
  const [query, setQuery] = useState(value ?? "");
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<{
    existing: InstrumentSearchItem[];
    other_class: InstrumentSearchItem[];
    suggestions: { symbol: string; name: string }[];
    master: { provider: "amfi" | "coingecko"; synced: boolean } | null;
  }>(EMPTY);
  // §14dr-12 — track whether a fetch is in flight so the honest empty state shows only AFTER a
  // search returns nothing (not during the debounce), never a premature "no match" flash.
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLSpanElement>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  // Debounced, class-aware fetch. A failed fetch degrades to create-only.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setRes(EMPTY);
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await searchInstruments(q, assetClass);
      if (live) {
        setRes(r.ok ? { ...r.data, master: r.data.master ?? null } : EMPTY);
        setLoading(false);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, assetClass]);

  // Position the portaled menu under the input; keep it pinned on scroll/resize.
  const place = useCallback(() => {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.bottom, left: r.left, width: r.width });
  }, []);
  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const q = query.trim();
  const anyResults =
    res.existing.length > 0 || res.other_class.length > 0 || res.suggestions.length > 0;
  // §14dr-12 — after a class-scoped search returns nothing, say so — scoped by the picked class —
  // rather than showing a bare create option (which reads as "nothing happened", the XRP report).
  const classLabel = assetClass ? assetClass.replace(/_/g, " ") : "";
  const emptyState = !!q && !loading && !anyResults;
  // §14dr-13 — the class's master was never synced (empty AMFI/CoinGecko cache), so the
  // pool is empty for a reason the user can act on. Say so and point at the sync card,
  // rather than "no match — create" (which would push a manual instrument the picker
  // could have found once the master is synced).
  const neverSynced = emptyState && !!res.master && !res.master.synced;
  const hasAny = anyResults || (allowCreate && !!q) || emptyState;

  return (
    <div className="lf-picker">
      <span
        ref={boxRef}
        className={`lf-field lf-field--block${disabled ? " lf-field--disabled" : ""}`}
      >
        <input
          className="lf-field__input"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-label="Instrument"
          placeholder="Search symbol or name…"
          value={query}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
        />
      </span>

      {open && hasAny && rect &&
        createPortal(
          <ul
            className="lf-picker__menu"
            role="listbox"
            style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width }}
          >
            {res.existing.map((i) => (
              <li
                key={`e-${i.id ?? i.symbol}`}
                role="option"
                aria-selected={false}
                className="lf-picker__option"
                onMouseDown={() => {
                  onSelect({
                    kind: "existing",
                    instrument: {
                      id: String(i.id ?? ""),
                      symbol: i.symbol,
                      name: i.name,
                      currency: i.currency ?? "",
                      assetClass: i.asset_class ?? "",
                    },
                  });
                  setQuery(i.symbol);
                  setOpen(false);
                }}
              >
                <span className="lf-picker__sym">
                  {i.symbol}
                  {i.currency ? ` · ${i.currency}` : ""}
                </span>
                <span className="lf-picker__name">{i.name}</span>
              </li>
            ))}

            {res.suggestions.length > 0 && (
              <li className="lf-picker__group" aria-hidden="true">
                Suggested{assetClass ? ` (${assetClass.replace(/_/g, " ")})` : ""}
              </li>
            )}
            {res.suggestions.map((s) => (
              <li
                key={`s-${s.symbol}`}
                role="option"
                aria-selected={false}
                className="lf-picker__option"
                onMouseDown={() => {
                  // §14dr-16 — carry the master's name so the created instrument shows it,
                  // not just the code (the create path persists it via the txn payload).
                  onSelect({ kind: "create", query: s.symbol, name: s.name });
                  setQuery(s.symbol);
                  setOpen(false);
                }}
              >
                <span className="lf-picker__sym">{s.symbol}</span>
                <span className="lf-picker__name">{s.name}</span>
              </li>
            ))}

            {res.other_class.length > 0 && (
              <li className="lf-picker__group" aria-hidden="true">
                Found in other classes — open, don’t add here
              </li>
            )}
            {res.other_class.map((i) => (
              <li
                key={`o-${i.id ?? i.symbol}`}
                className="lf-picker__option lf-picker__crossclass"
                onMouseDown={() => {
                  window.location.hash = `#/instrument/${i.symbol}`;
                  setOpen(false);
                }}
              >
                <span className="lf-picker__sym">
                  Found in {(i.asset_class ?? "").replace(/_/g, " ")}: {i.symbol} →
                </span>
                <span className="lf-picker__name">{i.name}</span>
              </li>
            ))}

            {/* §14dr-12 — honest class-scoped empty state. When a search returns nothing, say so
                (scoped by class); if create is allowed the message IS the create path (the owner's
                copy: "No crypto instruments match — create 'XRP'"), else it's an honest info line. */}
            {emptyState ? (
              neverSynced ? (
                // §14dr-13 — never-synced empty, journey-guarded to the Masters card (§14ac-2).
                <li className="lf-picker__empty lf-picker__neversynced" aria-live="polite">
                  No {classLabel || "instrument"} master synced yet — sync it in{" "}
                  <a
                    className="lf-picker__synclink"
                    href="#/settings?tab=data-feeds"
                    onMouseDown={() => setOpen(false)}
                  >
                    Settings → Data feeds
                  </a>
                </li>
              ) : allowCreate ? (
                <li
                  role="option"
                  aria-selected={false}
                  className="lf-picker__option lf-picker__create"
                  onMouseDown={() => {
                    onSelect({ kind: "create", query: q });
                    setOpen(false);
                  }}
                >
                  No {classLabel ? `${classLabel} ` : ""}instruments match — create “{q}”
                </li>
              ) : (
                <li className="lf-picker__empty" aria-live="polite">
                  No {classLabel ? `${classLabel} ` : ""}instruments match
                </li>
              )
            ) : (
              allowCreate && q && (
                <li
                  role="option"
                  aria-selected={false}
                  className="lf-picker__option lf-picker__create"
                  onMouseDown={() => {
                    onSelect({ kind: "create", query: q });
                    setOpen(false);
                  }}
                >
                  ＋ Create new instrument “{q}”
                </li>
              )
            )}
          </ul>,
          document.body,
        )}
    </div>
  );
}
