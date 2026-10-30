/**
 * El catálogo de gestos que el panel de un negocio sabe contar.
 *
 * Es puro a propósito y lo leen los dos lados: el navegador para saber qué
 * puede mandar y el route handler para rechazar lo que no esté aquí. Si la
 * lista viviera en dos sitios, un tipo nuevo se colaría por el cliente y el
 * servidor lo tiraría sin decir nada.
 */

export const TIPOS_EVENTO = [
  /** Se abrió la ficha del negocio. */
  "vista_perfil",
  /** Se abrió su carta (`/m/{slug}`). */
  "vista_menu",
  /** Se tocó el teléfono. */
  "click_llamar",
  /** Se tocó WhatsApp. */
  "click_whatsapp",
  /** Se pidió una ruta: «Cómo llegar». */
  "click_como_llegar",
  /** Se tocó el botón de reserva (función de Pro). */
  "click_reserva",
  /** Alguien abrió el bot para seguir al negocio (función de Pro). */
  "click_seguidor",
  /** Un producto de la carta entró en pantalla. `dimension` = su nombre. */
  "producto_visto",
] as const;

export type TipoEvento = (typeof TIPOS_EVENTO)[number];

/** Valida en tiempo de ejecución lo que llega por HTTP. */
export function esTipoEvento(valor: unknown): valor is TipoEvento {
  return (
    typeof valor === "string" &&
    (TIPOS_EVENTO as readonly string[]).includes(valor)
  );
}

/**
 * Lo que cuenta como «una visita» al negocio: abrir su ficha o abrir su carta.
 *
 * La carta (`/m/{slug}`) es la misma ficha mirada desde el QR, así que quien
 * reparte el enlace espera ver moverse esa cifra. Vive aquí, con el catálogo,
 * porque la leen dos sitios que tienen que decir lo mismo: el panel del negocio
 * (`statsVisitas`) y el ranking mensual (`calcularRanking`).
 */
export const TIPOS_VISTA = ["vista_perfil", "vista_menu"];

/* ── Lo que llega del navegador ───────────────────────────────────────────────
   La validación vive aquí, en el módulo puro, y no en el route handler: es la
   frontera donde entra tráfico sin sesión, así que es lo que más conviene poder
   probar sin levantar una base. */

/** El lote máximo que acepta el route handler. */
export const MAX_EVENTOS = 25;
/** Largo máximo de los textos del cliente: el id del negocio y el nombre del producto. */
export const LARGO_MAX = 64;

/** Un evento ya validado, listo para resolverse contra la cookie y la fecha. */
export interface EventoCliente {
  negocioId: string;
  tipo: TipoEvento;
  /** `""` cuando el tipo no lleva sub-dato. */
  dimension: string;
}

/**
 * Un evento del cuerpo del beacon, o `null` si no se puede contar.
 *
 * Se descarta en vez de corregir: un `negocioId` vacío o un tipo fuera del
 * catálogo no son un evento con datos raros, son una petición que no viene de la
 * app. La dimensión sí se recorta —es texto libre del dueño— en vez de tirar el
 * evento entero por un nombre largo.
 */
export function parsearEvento(valor: unknown): EventoCliente | null {
  if (!valor || typeof valor !== "object") return null;
  const evento = valor as Record<string, unknown>;

  const negocioId =
    typeof evento.negocioId === "string" ? evento.negocioId.trim() : "";
  if (!negocioId || negocioId.length > LARGO_MAX) return null;
  if (!esTipoEvento(evento.tipo)) return null;

  const dimension =
    typeof evento.dimension === "string"
      ? evento.dimension.trim().slice(0, LARGO_MAX)
      : "";

  return { negocioId, tipo: evento.tipo, dimension };
}

/* ── Lo que lee el panel ──────────────────────────────────────────────────────
   El tipo vive aquí, con el catálogo, y no en el módulo que consulta la base:
   así el componente de cliente lo importa sin arrastrar el driver de Neon. La
   parte opcional es tal porque el servidor solo la rellena si el plan la
   incluye —el candado se decide antes de salir de la base, no en el navegador—. */

export interface VisitasPanel {
  /**
   * Visitas a la ficha o a la carta. Lo ve hasta Gratis.
   *
   * `total` es el acumulado histórico y `mes`, el mes en curso. `ficha7` y
   * `catalogo7` son los clics de la última semana separados por dónde entró la
   * gente, que es la cifra que se mueve a diario.
   */
  resumen: {
    mes: number;
    total: number;
    ficha7: number;
    catalogo7: number;
  };
  /** Visitas y llamadas a 7 y 30 días. Módulo Visibilidad, o un pack. */
  basicas?: {
    visitas7: number;
    llamadas7: number;
    visitas30: number;
    llamadas30: number;
  };
}
