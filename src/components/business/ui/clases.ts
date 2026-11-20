/**
 * Las cadenas de clases del panel del negocio, en un solo sitio.
 *
 * Estaban copiadas a mano en cada archivo —el botón primario en 30 líneas, el
 * campo en 7 constantes `INPUT`— y cada copia se iba separando de las demás.
 * Aquí viven una vez. Se combinan con `clsx` y **no** con `cn`: `cn` pasa por
 * `tailwind-merge`, que no conoce la escala propia del proyecto (`text-small`,
 * `text-meta`…) y puede tirar una clase creyendo que choca con otra.
 *
 * Modo oscuro: todas las clases de color de este archivo tienen su override en
 * `globals.css` dentro de `.business-panel` / `.panel-portal`. Una clase de
 * color nueva aquí necesita el suyo.
 */

/* ── Campos ──────────────────────────────────────────────────────────────── */

/** Para el `Input` de `ui/input.tsx`: se suma a sus clases base. */
export const INPUT =
  "rounded-xl border-ink/10 bg-white text-ink placeholder:text-ink-soft/75 focus-visible:border-verde-400 focus-visible:ring-offset-0 focus-visible:ring-verde-400/30";

/** `<input>` nativo de 44 px (equipo, catálogo). */
export const INPUT_NATIVO =
  "h-11 w-full px-gap-sm border border-ink/10 rounded-xl font-lv text-body bg-white text-ink outline-none transition-colors duration-500 ease-outquint focus-visible:border-verde-400";

/** `<input>` nativo con anillo al enfocar (clientes frecuentes). */
export const INPUT_NATIVO_ANILLO =
  "h-11 w-full rounded-xl border border-ink/10 bg-white px-gap-sm font-lv-display text-body text-ink outline-none placeholder:text-ink-soft/70 focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";

/** `<input>` / `<textarea>` nativo de 44 px con 16 px de relleno (programados, publicaciones). */
export const INPUT_NATIVO_HOLGADO =
  "h-11 w-full rounded-xl border border-ink/10 bg-white px-4 text-body text-ink placeholder:text-ink-soft/75 outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";

/** `<input>` nativo compacto, sin alto fijo (editor de producto). */
export const INPUT_COMPACTO =
  "px-gap-sm border rounded-xl font-lv text-small bg-white text-ink outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";

/* ── Botones ─────────────────────────────────────────────────────────────── */

/** Texto `verde-950` sobre `verde-400`: ≈ 6.1:1 en los dos temas. */
export const BOTON_PRIMARIO =
  "inline-flex cursor-pointer items-center justify-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-colors duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60";

export const BOTON_SECUNDARIO =
  "inline-flex cursor-pointer items-center justify-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-lg font-lv-display text-small font-semibold text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60";

export const BOTON_TEXTO =
  "inline-flex min-h-11 cursor-pointer items-center font-lv-display text-meta font-semibold text-ink-soft/75 transition-colors duration-500 ease-outquint hover:text-ink disabled:pointer-events-none disabled:opacity-60";

export const BOTON_ICONO =
  "grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-ink-soft/75 transition-colors duration-500 ease-outquint hover:bg-verde-50 hover:text-verde-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40";

/** Alto de los botones con fondo. */
export const ALTO_BOTON = { md: "h-11", lg: "h-12" } as const;
export type AltoBoton = keyof typeof ALTO_BOTON;

/* ── Tarjetas y chapitas ─────────────────────────────────────────────────── */

export const TARJETA = "rounded-2xl border border-ink/5 bg-white p-gap-md";

export const CHAPITA =
  "inline-flex items-center rounded-full px-[10px] py-[3px] font-lv-display text-meta font-semibold";

export const TONO_CHAPITA = {
  activa: "border border-verde-200 bg-verde-50 text-verde-700",
  neutra: "border border-ink/10 bg-sand text-ink-soft/75",
  ambar: "border border-lv-amber/40 bg-lv-amber/10 text-ink",
  /* El candado se pinta como la neutra: lo que cambia es el texto, que dice
     con qué se abre la función (`bloqueoDe`). */
  candado: "border border-ink/10 bg-sand text-ink-soft/75",
} as const;
export type TonoChapita = keyof typeof TONO_CHAPITA;
