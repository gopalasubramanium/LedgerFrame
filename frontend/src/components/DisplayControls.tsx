import "./DisplayControls.css";
import { useTheme } from "../theme/theme-context";
import { useDisplay } from "../theme/display-context";

// App chrome (not a §5 design component): the per-device display axis toggles
// (theme/density/contrast/motion, D-066/D-078). Recomposed 2026-07-11 (page-chrome
// Phase 0a re-ratify) as ICON-ONLY buttons with tooltips for the slim top bar — the
// glyph is decorative, the accessible name is the aria-label, the current value is
// the tooltip. Reused by the boot screen and the kitchen-sink control bar.
const THEME_ICON: Record<string, string> = { light: "☀", dark: "☾", system: "◐" };
const THEME_LABEL: Record<string, string> = { light: "Light", dark: "Dark", system: "System" };

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

  return (
    <div className="lf-controls" role="group" aria-label="Display settings">
      <button
        type="button"
        className="lf-iconbtn"
        onClick={cycle}
        title={`${themeTip} — click to change`}
        aria-label={`${themeTip}. Click to change theme.`}
      >
        {THEME_ICON[choice]}
      </button>
      <button
        type="button"
        className="lf-iconbtn"
        onClick={toggleDensity}
        title={`Density: ${density} — click to change`}
        aria-label={`Density: ${density}. Click to change density.`}
      >
        ☰
      </button>
      <button
        type="button"
        className="lf-iconbtn"
        title={`${contrastTip} — click to change`}
        aria-label={`${contrastTip}. Click to change contrast.`}
        onClick={() =>
          setContrastPref(
            contrastPref === "system" ? "high" : contrastPref === "high" ? "normal" : "system",
          )
        }
      >
        ◧
      </button>
      <button
        type="button"
        className="lf-iconbtn"
        title={`${motionTip} — click to change`}
        aria-label={`${motionTip}. Click to change motion.`}
        onClick={() =>
          setMotionPref(
            motionPref === "system" ? "reduced" : motionPref === "reduced" ? "full" : "system",
          )
        }
      >
        ≈
      </button>
    </div>
  );
}
