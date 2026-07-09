import "./DisplayControls.css";
import { useTheme } from "../theme/theme-context";
import { useDisplay } from "../theme/display-context";

// App chrome (not a §5 design component): the per-device display axis toggles
// (theme/density/contrast/motion, D-066/D-078). Reused by the boot screen and
// the kitchen-sink control bar so both themes/densities switch live.
const THEME_LABEL: Record<string, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

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

  return (
    <div className="lf-controls" role="group" aria-label="Display settings">
      <button type="button" className="lf-btn" onClick={cycle} aria-label="Cycle theme">
        Theme: {THEME_LABEL[choice]}
        {choice === "system" ? ` (${resolved})` : ""}
      </button>
      <button type="button" className="lf-btn" onClick={toggleDensity} aria-label="Toggle density">
        Density: {density}
      </button>
      <button
        type="button"
        className="lf-btn"
        aria-label="Cycle contrast"
        onClick={() =>
          setContrastPref(
            contrastPref === "system" ? "high" : contrastPref === "high" ? "normal" : "system",
          )
        }
      >
        Contrast: {contrastPref}
        {contrastPref === "system" ? ` (${contrast})` : ""}
      </button>
      <button
        type="button"
        className="lf-btn"
        aria-label="Cycle motion"
        onClick={() =>
          setMotionPref(
            motionPref === "system" ? "reduced" : motionPref === "reduced" ? "full" : "system",
          )
        }
      >
        Motion: {motionPref}
        {motionPref === "system" ? ` (${motion})` : ""}
      </button>
    </div>
  );
}
