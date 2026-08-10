import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1.25rem",
        sm: "1.5rem",
        lg: "2rem"
      },
      screens: {
        "2xl": "1200px"
      }
    },
    extend: {
      colors: {
        // La Verde — branding verde premium
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
          950: "#052017"
        },
        ink: {
          DEFAULT: "#08130D",
          soft: "#1B2A21"
        },
        sand: {
          DEFAULT: "#F6F3EC",
          warm: "#FBF9F4",
          deep: "#EAE4D6"
        }
      },
      fontFamily: {
        sans: ["var(--font-plus-jakarta)", "system-ui", "sans-serif"],
        display: ["var(--font-space-grotesk)", "var(--font-plus-jakarta)", "sans-serif"]
      },
      borderRadius: {
        "2xl": "1rem",
        "4xl": "2rem"
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(2.2)", opacity: "0" }
        },
        "slow-float": {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-18px)" }
        },
        "marquee": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" }
        }
      },
      animation: {
        "pulse-ring": "pulse-ring 2.2s cubic-bezier(0.16,1,0.3,1) infinite",
        "slow-float": "slow-float 9s ease-in-out infinite",
        marquee: "marquee 38s linear infinite"
      },
      boxShadow: {
        card: "0 1px 2px rgba(8,19,13,0.04), 0 16px 40px -16px rgba(8,19,13,0.18)",
        "card-hover": "0 1px 2px rgba(8,19,13,0.04), 0 30px 70px -24px rgba(8,19,13,0.30)",
        soft: "0 1px 2px rgba(8,19,13,0.05), 0 8px 24px -12px rgba(8,19,13,0.12)"
      }
    }
  },
  plugins: []
};

export default config;