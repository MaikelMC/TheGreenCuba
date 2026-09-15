import { Space_Grotesk, Plus_Jakarta_Sans } from "next/font/google";

/**
 * Tipografías del design system de La Verde (Space Grotesk para titulares,
 * Plus Jakarta Sans para cuerpo y UI).
 *
 * Viven aquí y no en una ruta concreta para que se declaren **una sola vez**:
 * `next/font` emite un `@font-face` por cada llamada, así que declararlas en
 * dos sitios duplicaría el CSS de las fuentes. Las variables se montan en
 * `<body>` (src/app/layout.tsx) y las consumen `font-lv` / `font-lv-display`
 * de tailwind.config.ts.
 *
 * No se repuntan `display` (DM Sans) ni `body` (Source Sans 3): siguen siendo
 * las de la app, y las rutas que ya migraron piden las nuevas por su nombre.
 */
export const lvSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-lv-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const lvDisplay = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-lv-display",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/** Las dos clases de variable, para colgar en un `className`. */
export const lvFontVars = `${lvSans.variable} ${lvDisplay.variable}`;
