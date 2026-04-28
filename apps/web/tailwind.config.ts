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
        // ── Midnight Obsidian 2.0 (Premium YC Edition) ────────────────────────
        "surface-tint":              "#c0c1ff",
        "inverse-on-surface":        "#0E0E0E",
        "primary-fixed":             "#e1e0ff",
        "on-tertiary":               "#2d2a5b",
        "on-surface-variant":        "#a1a1aa", // Refined for better hierarchy
        "surface-container-lowest":  "#050505", // Deeper black
        "on-primary-fixed":          "#07006c",
        "on-surface":                "#fafafa", // Cleaner white
        "surface-container-highest": "#18181b",
        "on-error-container":        "#ffdad6",
        "secondary-fixed-dim":       "#b9c8de",
        "error":                     "#f87171",
        "surface-container-low":     "#09090b",
        "surface-dim":               "#09090b",
        "primary":                   "#818cf8", // More vibrant Indigo
        "on-tertiary-fixed":         "#181445",
        "secondary-container":       "#27272a",
        "error-container":           "#93000a",
        "on-secondary":              "#233143",
        "on-background":             "#fafafa",
        "primary-container":         "#4f46e5",
        "on-error":                  "#690005",
        "surface":                   "#09090b",
        "tertiary-container":        "#8e8bc2",
        "primary-fixed-dim":         "#c0c1ff",
        "on-tertiary-fixed-variant": "#444173",
        "tertiary":                  "#c4c1fb",
        "surface-container-high":    "#111111",
        "on-secondary-fixed-variant":"#39485a",
        "on-tertiary-container":     "#262354",
        "outline-variant":           "#27272a",
        "surface-bright":            "#18181b",
        "inverse-primary":           "#494bd6",
        "on-secondary-fixed":        "#0d1c2d",
        "secondary":                 "#d4d4d8",
        "surface-container":         "#0c0c0e",
        "secondary-fixed":           "#d4e4fa",
        "background":                "#000000", // Pure black for high contrast
        "tertiary-fixed":            "#e3dfff",
        "inverse-surface":           "#fafafa",
        "on-primary-fixed-variant":  "#2f2ebe",
        "on-primary":                "#ffffff",
        "outline":                   "#3f3f46",
        "tertiary-fixed-dim":        "#c4c1fb",
        "surface-variant":           "#09090b",
        "on-secondary-container":    "#d4d4d8",
        "on-primary-container":      "#e0e7ff",
        // ── Semantic aliases ────────────────────────────────────────────────
        "surface-mid":               "#09090b",
        "surface-high":              "#111111",
        "surface-highest":           "#18181b",
        "surface-lowest":            "#000000",
        "surface-low":               "#050505",
      },
      borderRadius: {
        DEFAULT: "12px",
        md:      "16px",
        lg:      "20px",
        xl:      "24px",
        "2xl":   "32px",
        full:    "9999px",
      },
      spacing: {
        "stack-sm":      "12px",
        "stack-md":      "24px",
        "stack-lg":      "48px",
        "container-max": "1280px", // Wider for modern screens
        unit:            "4px",
        "margin-page":   "40px",
        gutter:          "24px",
        "reading-width": "720px", // Slightly wider reading column
      },
      fontFamily: {
        headline:      ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        body:          ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        label:         ["var(--font-geist-sans)", "Inter", "sans-serif"],
        "ui-main":     ["var(--font-geist-sans)", "Inter", "sans-serif"],
        "label-caps":  ["var(--font-geist-sans)", "Inter", "sans-serif"],
        "body-reading":["Newsreader", "Georgia", "serif"],
        "h2":          ["var(--font-geist-sans)", "Inter", "sans-serif"],
        "h1":          ["var(--font-geist-sans)", "Inter", "sans-serif"],
        "ui-sm":       ["var(--font-geist-sans)", "Inter", "sans-serif"],
      },
      fontSize: {
        "ui-main":     ["16px", { lineHeight: "24px",  letterSpacing: "-0.01em", fontWeight: "500" }],
        "label-caps":  ["12px", { lineHeight: "16px",  letterSpacing: "0.05em",  fontWeight: "600" }],
        "body-reading":["20px", { lineHeight: "1.7",   letterSpacing: "0.01em",  fontWeight: "400" }],
        "h2":          ["36px", { lineHeight: "1.2",   letterSpacing: "-0.03em", fontWeight: "600" }],
        "h1":          ["64px", { lineHeight: "1.1",   letterSpacing: "-0.04em", fontWeight: "700" }],
        "ui-sm":       ["14px", { lineHeight: "20px",  letterSpacing: "-0.01em", fontWeight: "500" }],
      },
      animation: {
        "highlight-pulse": "highlightPulse 0.3s ease-out",
        "fade-in":         "fadeIn 0.2s ease-out",
        "slide-up":        "slideUp 0.3s ease-out",
      },
      keyframes: {
        highlightPulse: {
          "0%":   { backgroundColor: "rgba(192, 193, 255, 0.3)" },
          "100%": { backgroundColor: "rgba(192, 193, 255, 0.1)" },
        },
        fadeIn:  { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: {
          "0%":   { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)",   opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
