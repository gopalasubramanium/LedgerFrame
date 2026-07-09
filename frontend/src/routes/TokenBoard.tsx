import type { CSSProperties } from "react";
import "./KitchenSink.css";

// Token swatch board for ratification: palette, type scale, and spacing — each
// specimen labeled with its token NAME so the owner ratifies named values.
// Swatches reference tokens via a CSS-var indirection (no raw hex/px here).

const COLOUR_TOKENS = [
  "--bg", "--surface", "--surface-raised", "--border", "--border-strong",
  "--text-primary", "--text-secondary", "--text-tertiary", "--accent",
  "--accent-contrast", "--gain", "--loss", "--attention", "--focus-ring",
];

const TYPE_ROLES: { cls: string; token: string; role: string }[] = [
  { cls: "type-28", token: "--font-size-28", role: "Page H1 / hero figure" },
  { cls: "type-20", token: "--font-size-20", role: "Section heading" },
  { cls: "type-16", token: "--font-size-16", role: "Subhead / emphasized figure" },
  { cls: "type-14", token: "--font-size-14", role: "Body / default cell" },
  { cls: "type-13", token: "--font-size-13", role: "Secondary cell / dense table" },
  { cls: "type-12", token: "--font-size-12", role: "Caption / badge / footnote" },
];

const SPACE_TOKENS = [
  "--space-1", "--space-2", "--space-3", "--space-4", "--space-5", "--space-6",
  "--space-7", "--space-8", "--space-9", "--space-10", "--space-12",
];

function swatchStyle(token: string): CSSProperties {
  return { ["--swatch" as string]: `var(${token})` } as CSSProperties;
}
function barStyle(token: string): CSSProperties {
  return { ["--bar" as string]: `var(${token})` } as CSSProperties;
}

export function TokenBoard() {
  return (
    <>
      <div className="ks__section">
        <h2 className="ks__h2">Colour palette</h2>
        <p className="ks__note">
          Every value PROPOSED (DESIGN-SYSTEM §2.1) — swatches follow the active
          theme. Toggle theme in the bar above to ratify both.
        </p>
        <div className="ks__swatches">
          {COLOUR_TOKENS.map((t) => (
            <div className="ks__swatch" key={t}>
              <div className="ks__swatch-chip" style={swatchStyle(t)} />
              <span className="ks__swatch-name">{t}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ks__section">
        <h2 className="ks__h2">Type scale</h2>
        <p className="ks__note">Sizes 12/13/14/16/20/28 (BRIEF); roles/weights PROPOSED.</p>
        {TYPE_ROLES.map((r) => (
          <div className="ks__type-row" key={r.token}>
            <span className="ks__type-name">
              {r.token} · {r.role}
            </span>
            <span className={r.cls}>1,234,567.89 — The quick brown fox</span>
          </div>
        ))}
      </div>

      <div className="ks__section">
        <h2 className="ks__h2">Spacing scale · 4-pixel grid</h2>
        <p className="ks__note">PROPOSED (DESIGN-SYSTEM §2.3).</p>
        {SPACE_TOKENS.map((t) => (
          <div className="ks__space-row" key={t}>
            <span className="ks__space-name">{t}</span>
            <span className="ks__space-bar" style={barStyle(t)} />
          </div>
        ))}
      </div>
    </>
  );
}
