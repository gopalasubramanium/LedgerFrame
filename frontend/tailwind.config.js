/** LedgerFrame design system — themeable via CSS variables (see styles/index.css).
 *  Colours are defined as RGB triplets so Tailwind opacity modifiers (e.g.
 *  bg-accent/15) keep working across light & dark themes. */
const c = (v) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        base: c("--c-base"),
        surface: c("--c-surface"),
        elevated: c("--c-elevated"),
        line: c("--c-line"),
        ink: c("--c-ink"),
        muted: c("--c-muted"),
        faint: c("--c-faint"),
        accent: c("--c-accent"),
        "accent-fg": c("--c-accent-fg"),
        up: c("--c-up"),
        down: c("--c-down"),
        warn: c("--c-warn"),
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: { card: "12px" },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px rgb(var(--c-shadow) / 0.10)",
      },
      fontSize: {
        hero: ["2.6rem", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        figure: ["1.7rem", { lineHeight: "1.1", letterSpacing: "-0.01em" }],
      },
    },
  },
  plugins: [],
};
