import localFont from "next/font/local";

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
 *
 * **Los archivos están en `src/fonts/`, no en Google.** Eran `next/font/google`
 * y cada arranque en frío —y cada build— dependía de que `fonts.googleapis.com`
 * contestara. En esta red, que se cae a ratos, eso dejaba el build roto con
 * «next/font/google queries have exactly one entry»: sin CSS de fuente, el
 * módulo que genera Turbopack sale mal y la culpa no apunta por ninguna parte
 * a la red. Vendimiadas, `next/font/local` las lee del repo y ya no hay viaje.
 *
 * Son las variables de Google (el `wght` completo de cada familia) recortadas
 * al subconjunto `latin`, que cubre el español entero —tildes, `ñ`, `¿`, `¡`
 * y el euro—. Si algún día entra texto en otro alfabeto, hay que bajar también
 * el subconjunto que falte y añadirlo como una segunda `src` con su
 * `unicode-range`.
 */
export const lvSans = localFont({
  src: "../fonts/plus-jakarta-sans.woff2",
  variable: "--font-lv-sans",
  weight: "200 800",
  display: "swap",
});

export const lvDisplay = localFont({
  src: "../fonts/space-grotesk.woff2",
  variable: "--font-lv-display",
  weight: "300 700",
  display: "swap",
});

/** Las dos clases de variable, para colgar en un `className`. */
export const lvFontVars = `${lvSans.variable} ${lvDisplay.variable}`;
