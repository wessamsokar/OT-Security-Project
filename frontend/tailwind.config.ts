import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--color-bg) / <alpha-value>)",
        panel: "rgb(var(--color-panel) / <alpha-value>)",
        text: "rgb(var(--color-text) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        brand: "rgb(var(--color-brand) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)"
      },
      boxShadow: {
        panel: "0 24px 42px rgba(6, 13, 31, 0.35)",
        soft: "0 12px 24px rgba(6, 13, 31, 0.22)"
      },
      borderRadius: {
        xl2: "1.125rem"
      },
      spacing: {
        section: "6rem"
      }
    }
  },
  plugins: []
} satisfies Config;
