import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
    "./stores/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0b1326",
          low: "#131b2e",
          mid: "#171f33",
          high: "#222a3d",
          bright: "#31394d",
          highest: "#2d3449",
          lowest: "#060e20",
        },
        primary: {
          DEFAULT: "#c3c0ff",
          container: "#1d00a4",
          dim: "#8d8aff",
        },
        secondary: {
          DEFAULT: "#bec6e0",
          container: "#3f465c",
        },
        outline: {
          DEFAULT: "#908f9d",
          variant: "#454652",
        },
      },
      fontFamily: {
        headline: ["Newsreader", "Georgia", "serif"],
        body: ["Newsreader", "Georgia", "serif"],
        label: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "highlight-pulse": "highlightPulse 0.3s ease-out",
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        highlightPulse: {
          "0%": { backgroundColor: "rgba(195, 192, 255, 0.5)" },
          "100%": { backgroundColor: "rgba(195, 192, 255, 0.2)" },
        },
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
