import "./DisplayControls.css";
import { useTheme } from "../theme/theme-context";
import { useDisplay } from "../theme/display-context";
import {
  Sun,
  Moon,
  Monitor,
  Rows2,
  Rows4,
  Contrast,
  Circle,
  Disc,
  Waves,
  Minus,
  Wind,
} from "../icons";
import type { LucideIcon } from "../icons";

// App chrome (not a §5 design component): the per-device display axis toggles
// (theme/density/contrast/motion, D-066/D-078). ICON-ONLY buttons with tooltips.
//
// STATEFUL-ICON RULE (DESIGN-SYSTEM §5.5): a stateful toggle renders a STATE-DISTINCT
// icon per state (lucide, ADR-0003) — the icon shows the current state, the tooltip
// names it ("Function: state"); no icon collides with another bar control (Menu is
// reserved for the sidebar toggle).
const THEME_ICON: Record<string, LucideIcon> = { light: Sun, dark: Moon, system: Monitor };
const THEME_LABEL: Record<string, string> = { light: "Light", dark: "Dark", system: "System" };
const DENSITY_ICON: Record<string, LucideIcon> = { comfortable: Rows2, compact: Rows4 };
const CONTRAST_ICON: Record<string, LucideIcon> = { system: Contrast, normal: Circle, high: Disc };
const MOTION_ICON: Record<string, LucideIcon> = { full: Waves, reduced: Minus, system: Wind };

export function DisplayControls() {
  const { choice, resolved, cycle } = useTheme();
  const {
    density,
    toggleDensity,
    contrastPref,
    contrast,
    setContrastPref,
    motionPref,
    motion,
    setMotionPref,
  } = useDisplay();

  const themeTip =
    `Theme: ${THEME_LABEL[choice]}` + (choice === "system" ? ` (${resolved})` : "");
  const contrastTip =
    `Contrast: ${contrastPref}` + (contrastPref === "system" ? ` (${contrast})` : "");
  const motionTip = `Motion: ${motionPref}` + (motionPref === "system" ? ` (${motion})` : "");

  const ThemeIcon = THEME_ICON[choice];
  const DensityIcon = DENSITY_ICON[density];
  const ContrastIcon = CONTRAST_ICON[contrastPref];
  const MotionIcon = MOTION_ICON[motionPref];

  return (
    <div className="lf-controls" role="group" aria-label="Display settings">
      <button
        type="button"
        className="lf-iconbtn"
        onClick={cycle}
        title={themeTip}
        aria-label={themeTip}
      >
        <ThemeIcon aria-hidden="true" />
      </button>
      <button
        type="button"
        className="lf-iconbtn"
        onClick={toggleDensity}
        title={`Density: ${density}`}
        aria-label={`Density: ${density}`}
      >
        <DensityIcon aria-hidden="true" />
      </button>
      <button
        type="button"
        className="lf-iconbtn"
        title={contrastTip}
        aria-label={contrastTip}
        onClick={() =>
          setContrastPref(
            contrastPref === "system" ? "high" : contrastPref === "high" ? "normal" : "system",
          )
        }
      >
        <ContrastIcon aria-hidden="true" />
      </button>
      <button
        type="button"
        className="lf-iconbtn"
        title={motionTip}
        aria-label={motionTip}
        onClick={() =>
          setMotionPref(
            motionPref === "system" ? "reduced" : motionPref === "reduced" ? "full" : "system",
          )
        }
      >
        <MotionIcon aria-hidden="true" />
      </button>
    </div>
  );
}
