/**
 * Dónde está el panel del negocio: sección, subsección y hoja abierta.
 *
 * Módulo puro, sin React ni Next, porque lo leen los dos lados: la página de
 * servidor (`/business/page.tsx`) para montar la vista que pide la URL desde el
 * primer pintado, y el armazón de cliente para el historial.
 *
 * La URL es la fuente de verdad: `?seccion=pedidos&sub=ajustes&hoja=estado`.
 * Los ids de sección son los de siempre —los enlazan los correos de pago, el
 * onboarding, las fichas de servicio y el manifest— y no se renombran nunca.
 * `settings` ya no es una pantalla: se acepta y se lleva a «Más».
 */

export type PanelView =
  | "dashboard"
  | "catalogo"
  | "pedidos"
  | "clientes"
  | "mas"
  | "editor"
  | "ofertas"
  | "publicaciones"
  | "telegram"
  | "equipo"
  | "planes";

/** Las secciones plegables del editor de la ficha (`FormSection` con `id`). */
export const SECCIONES_FICHA = [
  "fotos",
  "basico",
  "contacto",
  "ubicacion",
  "horario",
  "tipo",
  "marca",
] as const;
export type SeccionFicha = (typeof SECCIONES_FICHA)[number];

export type SubVista =
  | "ajustes"
  | "reservas"
  | "precios"
  | "avisos"
  | "hoy-hay"
  | "editar"
  | SeccionFicha;

export type HojaId = "estado" | "negocios" | "tasa" | "sello" | "oferta" | "acciones" | "producto";

export interface Destino {
  seccion: PanelView;
  sub: SubVista | null;
}

const VISTAS: readonly PanelView[] = [
  "dashboard",
  "catalogo",
  "pedidos",
  "clientes",
  "mas",
  "editor",
  "ofertas",
  "publicaciones",
  "telegram",
  "equipo",
  "planes",
];

/** Las subsecciones que admite cada sección. Lo demás se descarta. */
const SUBS: Partial<Record<PanelView, readonly SubVista[]>> = {
  pedidos: ["ajustes"],
  mas: ["reservas", "precios", "avisos"],
  /* `hoy-hay` es el modo del catálogo que llega con su rediseño (sesión 4).
     Se acepta ya para que el atajo del manifest no pierda el parámetro. */
  catalogo: ["hoy-hay", "editar"],
  /* Con `sub`, el editor entra con esa sección abierta: es como «Tu ficha está
     al 80 %» lleva al dueño justo a lo que falta. */
  editor: SECCIONES_FICHA,
};

const HOJAS: readonly HojaId[] = ["estado", "negocios", "tasa", "sello", "oferta", "acciones", "producto"];

export const INICIO: Destino = { seccion: "dashboard", sub: null };

/** Lee `seccion` y `sub` tal como llegan de la URL. Nunca falla: cae a Hoy. */
export function leerDestino(
  seccion: string | null | undefined,
  sub: string | null | undefined,
): Destino {
  /* «Ajustes» se repartió: sin más contexto, lo que había ahí está en «Más». */
  if (seccion === "settings") return { seccion: "mas", sub: null };
  const vista = VISTAS.find((v) => v === seccion);
  if (!vista) return INICIO;
  const permitidas = SUBS[vista] ?? [];
  const subVista = permitidas.find((s) => s === sub) ?? null;
  return { seccion: vista, sub: subVista };
}

export function leerHoja(valor: string | null | undefined): HojaId | null {
  return HOJAS.find((h) => h === valor) ?? null;
}

export function mismoDestino(a: Destino, b: Destino): boolean {
  return a.seccion === b.seccion && a.sub === b.sub;
}

/** `pedidos:ajustes` / `dashboard`. La usa la cookie de la última sección. */
export function claveDestino(d: Destino): string {
  return d.sub ? `${d.seccion}:${d.sub}` : d.seccion;
}

export function destinoDeClave(clave: string | null | undefined): Destino | null {
  if (!clave) return null;
  const [seccion, sub] = clave.split(":");
  const d = leerDestino(seccion, sub);
  return claveDestino(d) === clave ? d : null;
}

const PRINCIPALES: readonly PanelView[] = [
  "dashboard",
  "pedidos",
  "catalogo",
  "clientes",
  "mas",
];

/**
 * Las pantallas principales no llevan flecha de volver: se llega a ellas desde
 * la barra. El modo «Hoy hay» del catálogo sigue siendo el catálogo.
 */
export function esPrincipal(d: Destino): boolean {
  /* El catálogo es una sola pantalla con dos modos («Hoy hay» y «Editar
     carta»): con cualquiera de los dos sigue siendo principal. */
  if (d.seccion === "catalogo") return true;
  return PRINCIPALES.includes(d.seccion) && d.sub === null;
}

/**
 * Adónde lleva la flecha cuando no hay historial propio al que volver (se
 * entró por un enlace directo). Con historial, la flecha vuelve a la pantalla
 * de origen.
 */
export function padreDe(d: Destino): Destino {
  /* Sin la subsección: así «Hoy hay» y «Editar carta» marcan «Catálogo» en la barra. */
  if (esPrincipal(d)) return { seccion: d.seccion, sub: null };
  if (d.seccion === "pedidos") return { seccion: "pedidos", sub: null };
  return { seccion: "mas", sub: null };
}

/** La pantalla principal a la que pertenece: la que se marca en la barra. */
export function raizDe(d: Destino): PanelView {
  return padreDe(d).seccion;
}

const TITULOS: Record<string, string> = {
  "pedidos:ajustes": "Ajustes de pedidos",
  "mas:reservas": "Reservas",
  "mas:precios": "Precios y tasa",
  "mas:avisos": "Avisos a seguidores",
  editor: "Editar mi ficha",
  ofertas: "Ofertas flash",
  publicaciones: "Publicar en Facebook",
  telegram: "Asistente de Telegram",
  equipo: "Equipo",
  planes: "Tu plan",
};

/** El título de una subpantalla, que va junto a la flecha. */
export function tituloDe(d: Destino): string {
  return TITULOS[claveDestino(d)] ?? TITULOS[d.seccion] ?? "";
}

/* ── La última sección usada, por negocio ──────────────────────────────────
   Va en una cookie y no en `localStorage` para que el servidor la lea al
   entrar desde el acceso: así la página monta esa sección desde el primer
   pintado, en vez de pintar Hoy y saltar a la otra cuando llega el JavaScript.
   Un mapa pequeño `negocio → clave`, con los últimos seis negocios. */

export const COOKIE_ULTIMA = "lv_panel_ultima";
const MAX_NEGOCIOS = 6;

function leerMapa(valor: string | null | undefined): Record<string, string> {
  if (!valor) return {};
  try {
    const crudo = JSON.parse(decodeURIComponent(valor)) as unknown;
    if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) return {};
    const mapa: Record<string, string> = {};
    for (const [k, v] of Object.entries(crudo)) {
      if (typeof v === "string") mapa[k] = v;
    }
    return mapa;
  } catch {
    return {};
  }
}

export function ultimaDe(cookie: string | null | undefined, negocioId: string): Destino | null {
  return destinoDeClave(leerMapa(cookie)[negocioId]);
}

/** El valor nuevo de la cookie, con este negocio el último. */
export function conUltima(
  cookie: string | null | undefined,
  negocioId: string,
  d: Destino,
): string {
  const mapa = leerMapa(cookie);
  delete mapa[negocioId];
  mapa[negocioId] = claveDestino(d);
  const claves = Object.keys(mapa);
  for (const vieja of claves.slice(0, Math.max(0, claves.length - MAX_NEGOCIOS))) {
    delete mapa[vieja];
  }
  return encodeURIComponent(JSON.stringify(mapa));
}
