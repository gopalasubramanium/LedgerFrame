/** LedgerFrame design system — original "deep graphite" financial-terminal theme. */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Deep graphite surfaces.
        base: "#0b0e13",
        surface: "#141923",
        elevated: "#1c2230",
        line: "#2a3242",
        // Typography.
        ink: "#e8ecf2",
        muted: "#8a93a6",
        faint: "#5b647a",
        // Warm neutral accent (original brand hue).
        accent: "#d9a566",
        "accent-dim": "#8a6a3f",
        // Restrained performance indicators.
        up: "#4ea88b",
        down: "#d2685f",
        warn: "#d9a566",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: { card: "14px" },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 24px rgba(0,0,0,0.35)",
      },
      fontSize: {
        hero: ["3.25rem", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        figure: ["2rem", { lineHeight: "1.1", letterSpacing: "-0.01em" }],
      },
    },
  },
  plugins: [],
};
