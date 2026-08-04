import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Canónicos v2 — docs/design-system-v2.md § 2.
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        overlay: "var(--overlay)",
        border: "var(--border)",
        "border-str": "var(--border-str)",
        fg: "var(--fg)",
        "fg-muted": "var(--fg-muted)",
        "fg-subtle": "var(--fg-subtle)",
        accent: "var(--accent)",
        "accent-bg": "var(--accent-bg)",
        crit: "var(--crit)",
        high: "var(--high)",
        med: "var(--med)",
        low: "var(--low)",
        ok: "var(--ok)",

        // Aliases v1 — mantidos até os ecrãs serem migrados (passos 2–8).
        void: "var(--void)",
        hull: "var(--hull)",
        "hull-lift": "var(--hull-lift)",
        rule: "var(--rule)",
        "rule-lit": "var(--rule-lit)",
        bone: "var(--bone)",
        graphite: "var(--graphite)",
        slate: "var(--slate)",
        signal: "var(--signal)",
        "signal-dim": "var(--signal-dim)",
        "sev-crit": "var(--sev-crit)",
        "sev-high": "var(--sev-high)",
        "sev-med": "var(--sev-med)",
        "sev-low": "var(--sev-low)",
        "sev-ok": "var(--sev-ok)",
      },
      fontFamily: {
        display: ["var(--font-martian-mono)"],
        data: ["var(--font-ibm-plex-mono)"],
        prosa: ["var(--font-ibm-plex-sans)"],
      },
      fontSize: {
        "display-xl": ["40px", { lineHeight: "44px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "display-l": ["22px", { lineHeight: "28px", letterSpacing: "-0.01em", fontWeight: "500" }],
        label: ["11px", { lineHeight: "16px", letterSpacing: "0.12em", fontWeight: "500" }],
        data: ["13px", { lineHeight: "20px", fontWeight: "400" }],
        body: ["14px", { lineHeight: "22px", fontWeight: "400" }],
        "body-sm": ["12px", { lineHeight: "18px", fontWeight: "400" }],
      },
      spacing: {
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        5: "20px",
        6: "24px",
        8: "32px",
        10: "40px",
        12: "48px",
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        panel: "var(--radius-panel)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
      },
      boxShadow: {
        focus: "var(--focus)",
      },
      transitionDuration: {
        DEFAULT: "120ms",
      },
      transitionTimingFunction: {
        DEFAULT: "ease-out",
      },
      maxWidth: {
        app: "1440px",
      },
    },
  },
  plugins: [],
};

export default config;
