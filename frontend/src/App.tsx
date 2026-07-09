import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchHealth } from "./api/health";
import type { HealthResult } from "./api/health";
import { DisplayControls } from "./components/DisplayControls";
import "./App.css";

// A column of varied-width figures. With tabular numerals they align on the
// decimal regardless of digit widths / signs (DESIGN-SYSTEM §1).
const TABULAR_SAMPLE = [
  "1,234.56",
  "-89.00",
  "12,000,000.00",
  "7.50",
  "0.05",
  "-1,111,111.11",
];

function HealthRow({ health }: { health: HealthResult | null }) {
  let dot = "boot__dot";
  let text = "checking…";
  if (health?.state === "ok") {
    dot += " boot__dot--ok";
    text = `ok · v${health.version}`;
  } else if (health?.state === "unreachable") {
    dot += " boot__dot--bad";
    text = `unreachable · ${health.detail}`;
  }
  return (
    <div className="boot__row">
      <span className="boot__label">Backend</span>
      <span className="boot__status">
        <span className={dot} aria-hidden="true" />
        <span className="boot__value">{text}</span>
      </span>
    </div>
  );
}

export default function App() {
  const [health, setHealth] = useState<HealthResult | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchHealth(ctrl.signal).then(setHealth);
    return () => ctrl.abort();
  }, []);

  return (
    <div className="boot">
      <div className="boot__card">
        <div>
          <h1 className="boot__title">LedgerFrame</h1>
          <p className="boot__subtitle">
            Frontend scaffold — design system &amp; component library.
          </p>
        </div>

        <HealthRow health={health} />

        <div>
          <p className="boot__label boot__caption">Display settings (per-device)</p>
          <DisplayControls />
        </div>

        <div>
          <p className="boot__label boot__caption">
            Tabular figures — decimals align regardless of digit width
          </p>
          <ul className="boot__figures">
            {TABULAR_SAMPLE.map((n) => (
              <li
                key={n}
                className={
                  n.startsWith("-") ? "boot__fig boot__fig--loss" : "boot__fig"
                }
              >
                {n}
              </li>
            ))}
          </ul>
        </div>

        <Link className="lf-btn lf-btn--primary" to="/kitchen-sink">
          Open the kitchen sink →
        </Link>
      </div>
    </div>
  );
}
