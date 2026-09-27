import type { Config } from "tailwindcss";

/**
 * Classroom Loop design tokens (source of truth for the UI).
 *
 * Palette per the product design spec:
 *   Deep Navy #0F172A · Primary Blue #2563EB · Soft Blue #EFF6FF
 *   Teal #0F766E · Success #16A34A · Warning #D97706 · Danger #DC2626
 *   Background #F8FAFC · Surface #FFFFFF · Text #0F172A · Secondary text #64748B
 *   Border #E2E8F0
 *
 * Spacing uses Tailwind's default 4px-base scale; radii: controls 8px
 * (rounded-lg), cards 12px (rounded-xl), large containers 16px (rounded-2xl).
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Deep navy — brand surfaces, headings, primary text.
        navy: {
          950: "#0B1220",
          900: "#0F172A", // spec: Deep Navy / Text
          800: "#1E293B",
          700: "#334155",
          600: "#475569", // secondary text (slate-600)
        },
        // Blues — primary actions and informational accents.
        primary: {
          DEFAULT: "#2563EB", // spec: Primary Blue
          dark: "#1D4ED8",
          500: "#3B82F6",
          600: "#2563EB",
        },
        softblue: {
          50: "#EFF6FF", // spec: Soft Blue
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          500: "#3B82F6",
          600: "#2563EB",
        },
        // Teal — completion/positive states ("done", sent feedback, synced).
        teal: {
          50: "#F0FDFA",
          100: "#CCFBF1",
          500: "#14B8A6",
          600: "#0F766E", // spec: Teal
        },
        success: "#16A34A", // spec: Success
        warning: "#D97706", // spec: Warning
        danger: "#DC2626", // spec: Danger
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        // Subtle, border-first elevation (spec: shadows sparingly).
        card: "0 1px 2px rgba(15, 23, 42, 0.05), 0 4px 12px rgba(15, 23, 42, 0.05)",
      },
    },
  },
  plugins: [],
};

module.exports = config;
