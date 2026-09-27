import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#0A1930",
          900: "#0E2342",
          800: "#143058",
          700: "#1D4273",
          600: "#285690",
        },
        softblue: {
          50: "#EEF4FB",
          100: "#DCE9F7",
          200: "#B9D3EF",
          300: "#8FB8E4",
          500: "#4A7FBD",
          600: "#37659C",
        },
        teal: {
          50: "#EFF9F7",
          100: "#D7F0EB",
          500: "#2E8B7A",
          600: "#237567",
        },
      },
      fontFamily: {
        sans: [
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
        card: "0 1px 2px rgba(10, 25, 48, 0.06), 0 4px 12px rgba(10, 25, 48, 0.06)",
      },
    },
  },
  plugins: [],
};

module.exports = config;
