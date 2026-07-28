import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "oklch(90% 0.004 250)",
        input: "oklch(90% 0.004 250)",
        ring: "oklch(62% 0.16 145)",
        background: "oklch(98% 0.005 85)",
        foreground: "oklch(18% 0.01 250)",
        surface: {
          DEFAULT: "oklch(100% 0 0)",
          foreground: "oklch(18% 0.01 250)",
        },
        primary: {
          DEFAULT: "oklch(62% 0.16 145)",
          foreground: "oklch(100% 0 0)",
        },
        secondary: {
          DEFAULT: "oklch(96% 0.008 85)",
          foreground: "oklch(18% 0.01 250)",
        },
        destructive: {
          DEFAULT: "oklch(60% 0.20 25)",
          foreground: "oklch(100% 0 0)",
        },
        muted: {
          DEFAULT: "oklch(96% 0.008 85)",
          foreground: "oklch(52% 0.01 250)",
        },
        accent: {
          DEFAULT: "oklch(62% 0.16 145 / <alpha-value>)",
          foreground: "oklch(100% 0 0 / <alpha-value>)",
        },
        card: {
          DEFAULT: "oklch(100% 0 0)",
          foreground: "oklch(18% 0.01 250)",
        },
        popover: {
          DEFAULT: "oklch(100% 0 0)",
          foreground: "oklch(18% 0.01 250)",
        },
        lv: {
          green: {
            50: "oklch(97% 0.02 145)",
            100: "oklch(94% 0.04 145)",
            200: "oklch(88% 0.07 145)",
            300: "oklch(80% 0.10 145)",
            400: "oklch(72% 0.14 145)",
            500: "oklch(62% 0.16 145)",
            600: "oklch(54% 0.15 145)",
            700: "oklch(45% 0.13 145)",
            800: "oklch(35% 0.10 145)",
            900: "oklch(25% 0.07 145)",
          },
          sand: {
            50: "oklch(98% 0.005 85)",
            100: "oklch(96% 0.008 85)",
            200: "oklch(92% 0.010 85)",
            300: "oklch(85% 0.012 85)",
          },
          amber: "oklch(75% 0.15 75)",
          red: "oklch(60% 0.20 25)",
          blue: "oklch(62% 0.14 250)",
          teal: "oklch(70% 0.12 175)",
        },
      },
      fontFamily: {
        display: [
          "DM Sans",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
        body: [
          "Source Sans 3",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "SF Mono",
          "ui-monospace",
          "Menlo",
          "monospace",
        ],
      },
      fontSize: {
        hero: ["clamp(40px, 7vw, 72px)", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
        h1: ["clamp(32px, 5vw, 52px)", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        h2: ["clamp(26px, 3.5vw, 40px)", { lineHeight: "1.15", letterSpacing: "-0.015em" }],
        h3: ["22px", { lineHeight: "1.3", letterSpacing: "-0.005em" }],
        lead: ["18px", { lineHeight: "1.6" }],
        body: ["16px", { lineHeight: "1.55" }],
        small: ["14px", { lineHeight: "1.5" }],
        meta: ["12px", { lineHeight: "1.4", letterSpacing: "0.02em" }],
        xs: ["11px", { lineHeight: "1.3", letterSpacing: "0.04em" }],
      },
      borderRadius: {
        "lv": "10px",
        "lv-lg": "14px",
        "lv-xl": "20px",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "lv-xs": "0 1px 2px oklch(18% 0.01 250 / 0.04)",
        "lv-sm": "0 2px 8px oklch(18% 0.01 250 / 0.06)",
        "lv-md": "0 4px 16px oklch(18% 0.01 250 / 0.08)",
        "lv-lg": "0 8px 32px oklch(18% 0.01 250 / 0.10)",
        "lv-xl": "0 16px 48px oklch(18% 0.01 250 / 0.12)",
      },
      spacing: {
        "gap-2xs": "4px",
        "gap-xs": "8px",
        "gap-sm": "12px",
        "gap-md": "16px",
        "gap-lg": "24px",
        "gap-xl": "32px",
        "gap-2xl": "48px",
        "gap-3xl": "64px",
        "gap-4xl": "96px",
        gutter: "20px",
        "gutter-lg": "32px",
      },
      padding: {
        "safe-bottom": "env(safe-area-inset-bottom, 0px)",
      },
      zIndex: {
        "200": "200",
        "250": "250",
        "300": "300",
      },
      height: {
        header: "60px",
      },
      maxWidth: {
        container: "1120px",
        "container-sm": "640px",
        "container-lg": "1440px",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.08)", opacity: "0.8" },
        },
      },
      animation: {
        "fade-in": "fade-in 400ms ease-out",
        "fade-up": "fade-up 400ms ease-out",
        "slide-up": "slide-up 400ms ease-out",
        "pulse-ring": "pulse-ring 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
