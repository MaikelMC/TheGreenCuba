/**
 * Las cadenas de clases del panel de administración, en un solo sitio.
 *
 * Repiten el vocabulario del panel de negocio (`src/components/business/ui`):
 * las mismas tarjetas, el mismo botón primario con texto oscuro sobre verde y
 * los mismos tokens. Se combinan con `clsx` y **no** con `cn`: `tailwind-merge`
 * no conoce la escala propia (`text-small`, `text-meta`…) y puede tirar una
 * clase creyendo que choca con otra.
 *
 * Modo oscuro: todas las clases de color de este archivo viven dentro de
 * `.admin-panel` o `panel-portal`, que `globals.css` ya trata igual que
 * `.business-panel`. Una clase de color nueva aquí necesita su override.
 */

export const TARJETA_ADMIN =
  "rounded-2xl border border-ink/5 bg-white p-gap-md";

export const BOTON_ADMIN_BASE =
  "inline-flex cursor-pointer items-center justify-center gap-gap-xs rounded-full font-lv-display font-semibold transition-colors duration-500 ease-outquint active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40";

export const BOTON_ADMIN_VARIANTE = {
  /* Texto `verde-950` sobre `verde-400`: ≈ 6.1:1 en los dos temas. Nunca texto
     blanco sobre el verde claro. */
  primario:
    "bg-verde-400 text-verde-950 shadow-primary-halo hover:bg-verde-300",
  secundario:
    "border border-ink/10 bg-white text-ink hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600",
  peligro:
    "border border-destructive/30 bg-destructive/10 text-destructive-ink hover:bg-destructive/15",
} as const;

export type VarianteBotonAdmin = keyof typeof BOTON_ADMIN_VARIANTE;

/** `pequeno` recupera 44 px en móvil: es un objetivo táctil, no una etiqueta. */
export const TAMANO_BOTON_ADMIN = {
  md: "h-11 px-gap-lg text-small",
  pequeno: "h-9 max-sm:h-11 px-gap-sm text-meta",
} as const;

export type TamanoBotonAdmin = keyof typeof TAMANO_BOTON_ADMIN;

export const BOTON_ICONO_ADMIN =
  "grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-ink-soft/75 transition-colors duration-500 ease-outquint hover:bg-verde-50 hover:text-verde-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40";

export const CHAPITA_ADMIN =
  "inline-flex items-center gap-[5px] rounded-full border px-[10px] py-[3px] font-lv-display text-meta font-semibold";

export const TONO_CHAPITA_ADMIN = {
  ok: "border-verde-200 bg-verde-50 text-verde-700",
  aviso: "border-lv-amber/40 bg-lv-amber/10 text-ink",
  error: "border-destructive/30 bg-destructive/10 text-destructive-ink",
  info: "border-ink/10 bg-sand text-ink-soft/75",
  neutra: "border-ink/10 bg-sand text-ink-soft/75",
} as const;

export type TonoChapitaAdmin = keyof typeof TONO_CHAPITA_ADMIN;

/** El punto de color de la chapita, para que no dependa solo del texto. */
export const PUNTO_CHAPITA_ADMIN = {
  ok: "bg-verde-500",
  aviso: "bg-lv-amber",
  error: "bg-destructive",
  info: "bg-lv-blue",
  neutra: "bg-ink-soft/40",
} as const;
