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
          // Sin esta clave `bg-accent-hover` no generaba ninguna regla, así que
          // el hover de todos los `Button variant="default"` no hacía nada.
          hover: "oklch(54% 0.15 145 / <alpha-value>)",
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
        /* Escala del design system de La Verde. Vive en hex, no en oklch, porque
           son los valores exactos documentados en design-system/la-verde. Ojo:
           son claves NUEVAS, no reemplazan a `accent` ni a `lv.green`, que
           siguen mandando en el resto de la app. */
        verde: {
          50: "#EAF7EF",
          100: "#CEEEDB",
          200: "#9FDDB9",
          300: "#67C792",
          400: "#35AF6D",
          500: "#18954F",
          600: "#0F7A41",
          700: "#0C6136",
          800: "#0A4B2C",
          900: "#083A23",
          950: "#052017",
        },
        /* La tinta es verde muy oscuro, nunca negro puro. Todas las sombras del
           sistema se tiñen con ella. */
        ink: {
          DEFAULT: "#08130D",
          soft: "#1B2A21",
        },
        sand: {
          DEFAULT: "#F6F3EC",
          warm: "#FBF9F4",
          deep: "#EAE4D6",
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
        /* Tipografías del design system de La Verde, cargadas SOLO en la landing
           (src/app/page.tsx declara las variables). No se repuntan `display` ni
           `body`: hacerlo cambiaría DM Sans y Source Sans 3 en toda la app. */
        lv: [
          "var(--font-lv-sans)",
          "system-ui",
          "sans-serif",
        ],
        "lv-display": [
          "var(--font-lv-display)",
          "var(--font-lv-sans)",
          "system-ui",
          "sans-serif",
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
      /* Curvas del design system. Tienen que vivir aquí y no como valor
         arbitrario (`ease-[cubic-bezier(0.22,1,0.36,1)]`): el extractor de
         Tailwind parte los candidatos por comas, así que esa clase compila a
         cero reglas y la transición se queda con la curva por defecto. */
      transitionTimingFunction: {
        outquint: "cubic-bezier(0.22, 1, 0.36, 1)",
        spring: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      borderRadius: {
        // 2rem del design system de La Verde. Tailwind solo llega a 3xl (1.5rem).
        "4xl": "2rem",
        "lv": "10px",
        "lv-lg": "14px",
        "lv-xl": "20px",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        /* Sombras del design system de La Verde: notación rgba y teñidas con
           `ink` (#08130D), nunca con negro puro. */
        soft: "0 1px 2px rgba(8,19,13,0.05), 0 8px 24px -12px rgba(8,19,13,0.12)",
        card: "0 1px 2px rgba(8,19,13,0.04), 0 16px 40px -16px rgba(8,19,13,0.18)",
        "card-hover":
          "0 1px 2px rgba(8,19,13,0.04), 0 30px 70px -24px rgba(8,19,13,0.30)",
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
        container: "1280px",
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
        "slow-float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        // El carril se duplica en el marcado, así que -50% lo deja en bucle
        // perfecto. Es la única animación `linear` permitida por el sistema.
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 400ms ease-out",
        "fade-up": "fade-up 400ms ease-out",
        "slide-up": "slide-up 400ms ease-out",
        "pulse-ring": "pulse-ring 2s ease-in-out infinite",
        "slow-float": "slow-float 9s ease-in-out infinite",
        marquee: "marquee 38s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
