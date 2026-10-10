/**
 * Seguidores y avisos: lo que se puede decidir sin tocar la base.
 *
 * Aquí viven las tres reglas que importan y que conviene poder comprobar sin
 * levantar nada:
 *
 * 1. **El alta siempre pasa por Telegram.** El botón de la ficha no guarda
 *    nada: lleva al bot con `?start=seg_<negocioId>`, y la fila nace cuando la
 *    persona pulsa «Iniciar» —que es el consentimiento—. Aquí se arma ese
 *    enlace y se vuelve a leer el payload, porque el mismo `seg_…` lo escriben
 *    dos sitios que no se hablan.
 * 2. **Un aviso es un mensaje cerrado**: titular, texto, enlace a la ficha y la
 *    línea de `/baja`. La baja tiene que ir **dentro del mensaje**: quien lo
 *    recibe no ha visto la app, así que la única forma de irse es contestar
 *    algo, y ese algo es `/baja`.
 * 3. **Tres avisos por semana y negocio.** El tope se cuenta por semana ISO, que
 *    es la misma clave con la que el plan cuenta publicaciones: el lunes no hay
 *    nada que reiniciar.
 *
 * Sin base de datos y sin red a propósito: el envío por lotes y la escritura
 * están en `seguidores-server.ts`.
 */

import { incluye, type Plan } from "./plans";
import { semanaDe } from "./publicaciones";

/** Los canales que existen. Hoy solo uno: Telegram. */
export type CanalSeguidor = "telegram";

/**
 * El prefijo del payload del deep link: `?start=seg_<negocioId>`.
 *
 * Telegram solo admite `[A-Za-z0-9_-]` y hasta 64 caracteres en `start`, así que
 * el id del negocio viaja tal cual —los de La Verde son de ese alfabeto— y el
 * prefijo es lo que distingue «vengo de la ficha de un negocio» de cualquier
 * otro uso futuro del bot.
 */
export const PREFIJO_SEGUIR = "seg_";

/** El enlace que abre la conversación con el bot, ya con el negocio detrás. */
export function deepLinkTelegram(botUsuario: string, negocioId: string): string {
  const bot = botUsuario.trim().replace(/^@/, "");
  if (!bot || !negocioId.trim()) return "";
  return `https://t.me/${bot}?start=${PREFIJO_SEGUIR}${negocioId.trim()}`;
}

/**
 * El enlace al bot de un negocio, o `null` si no hay botón que pintar.
 *
 * Es la conjunción que decide las dos superficies —la ficha y el panel— y por
 * eso vive aquí y no en cada una: **el plan incluye la función** (Pro) y **hay
 * bot configurado**. Se resuelve en el servidor y viaja ya tomado, igual que
 * `reservaHabilitada` y `selloVerificado`, para que el navegador no tenga que
 * conocer ni los planes ni el nombre del bot.
 */
export function enlaceSeguidores(
  botUsuario: string,
  negocioId: string,
  plan: Plan,
): string | null {
  if (!incluye(plan, "seguidores")) return null;
  return deepLinkTelegram(botUsuario, negocioId) || null;
}

/**
 * El negocio que viene detrás de un `/start`, o `null`.
 *
 * `null` cubre los tres casos que no llevan a ningún sitio: un `/start` pelado
 * —el que manda Telegram cuando alguien abre el bot sin enlace—, un payload con
 * otro prefijo y un `seg_` sin nada detrás. Los tres se contestan con el mismo
 * mensaje de ayuda, así que no hace falta distinguirlos.
 */
export function negocioDeStart(payload: string | undefined): string | null {
  const limpio = payload?.trim() ?? "";
  if (!limpio.startsWith(PREFIJO_SEGUIR)) return null;
  const id = limpio.slice(PREFIJO_SEGUIR.length).trim();
  return id || null;
}

/**
 * Los comandos que dan de baja.
 *
 * `/baja` es el que viaja en cada mensaje. `/stop` y `/parar` entran porque son
 * los que la gente escribe cuando quiere irse y no encuentra la palabra exacta
 * —y negarse a dar de baja a quien la está pidiendo con otro sinónimo es la peor
 * forma de cumplir una regla—. Telegram permite dirigir un comando a un bot
 * concreto (`/baja@LaVerdeBot`), así que la mención se ignora.
 */
const BAJAS = ["baja", "stop", "parar"];

/**
 * ¿Este texto es una petición de baja?
 *
 * `baja los precios` **no** es una baja, y de ahí la forma de la comprobación:
 * o el mensaje es la palabra sola, o empieza por `/`. Sin esa distinción, la
 * primera palabra de cualquier frase que empezara así daría de baja a quien
 * estaba escribiendo otra cosa.
 */
export function esBaja(texto: string | undefined): boolean {
  const limpio = texto?.trim().toLowerCase() ?? "";
  if (!limpio) return false;

  const conBarra = limpio.startsWith("/");
  const comando = (conBarra ? limpio.slice(1) : limpio)
    .split(/\s+/)[0]
    ?.replace(/@[\w_]+$/, "");

  if (!comando || !BAJAS.includes(comando)) return false;
  return conBarra || limpio === comando;
}

/** El texto que se guarda como titular y su largo máximo. */
export const MAX_TITULO = 120;
/** Largo del cuerpo del aviso. Es un mensaje de Telegram, no un artículo. */
export const MAX_TEXTO = 900;

/** ¿Cabe este aviso? Devuelve el error, o `null` si está bien. */
export function validarAviso(titulo: string, texto: string): string | null {
  if (!titulo.trim()) return "El aviso necesita un titular.";
  if (titulo.trim().length > MAX_TITULO) {
    return `El titular no puede pasar de ${MAX_TITULO} caracteres.`;
  }
  if (!texto.trim()) return "El aviso necesita un texto.";
  if (texto.trim().length > MAX_TEXTO) {
    return `El aviso no puede pasar de ${MAX_TEXTO} caracteres.`;
  }
  return null;
}

/** Cuántos avisos puede mandar un negocio por semana. */
export const AVISOS_POR_SEMANA = 3;

/** La clave del tope: la semana ISO del envío. */
export function semanaDelAviso(fecha: Date = new Date()): string {
  return semanaDe(fecha);
}

/** Cuántos avisos quedan esta semana. Se usa para explicárselo al dueño. */
export function avisosRestantes(usados: number): number {
  return Math.max(0, AVISOS_POR_SEMANA - usados);
}

/**
 * El mensaje que recibe un seguidor.
 *
 * Se escribe en texto plano y **sin `parse_mode`**, así que nada de lo que
 * escriba el dueño puede romper el mensaje ni colar formato: lo que hay aquí es
 * literalmente lo que se lee. La `url` va en su propia línea porque Telegram la
 * convierte en enlace sola, y el cierre con `/baja` es la parte funcional: la
 * única salida que tiene quien recibe el aviso.
 */
export function mensajeAviso({
  negocio,
  titulo,
  texto,
  url,
}: {
  negocio: string;
  titulo: string;
  texto: string;
  url: string;
}): string {
  return [
    `📣 ${titulo.trim()}`,
    "",
    texto.trim(),
    "",
    `${negocio.trim()} en La Verde:`,
    url,
    "",
    "Contesta /baja si no quieres recibir más avisos.",
  ].join("\n");
}

/**
 * El reparto en lotes: `[[a, b], [c]]`.
 *
 * Telegram castiga los envíos en ráfaga —unos 30 mensajes por segundo por bot—
 * y un negocio popular puede tener cientos de seguidores. Ir de uno en uno
 * tardaría una eternidad; mandarlos todos a la vez es lo que hace que Telegram
 * corte por la mitad. El lote es el término medio: unos cuantos en paralelo y
 * una pausa entre lotes, que es lo que hace el servidor.
 *
 * Con `tamano < 1` devuelve un solo lote —mejor eso que un bucle infinito por un
 * cero que se coló—, y una lista vacía devuelve una lista vacía, no un lote
 * vacío: quien recorre esto no tiene que distinguir «nadie» de «un lote con
 * nadie».
 */
export function lotes<T>(elementos: readonly T[], tamano: number): T[][] {
  const paso = Number.isFinite(tamano) && tamano >= 1 ? Math.floor(tamano) : elementos.length;
  if (elementos.length === 0) return [];
  const salida: T[][] = [];
  for (let i = 0; i < elementos.length; i += paso) {
    salida.push(elementos.slice(i, i + paso));
  }
  return salida;
}

/**
 * Cuántos se mandan a la vez y cuánto se espera entre lotes.
 *
 * Veinte mensajes por tanda deja margen de sobra bajo el límite de Telegram
 * —treinta por segundo— y la pausa de un segundo es lo que separa una tanda de
 * la siguiente. Cuarenta seguidores son dos tandas y medio segundo de espera,
 * no un minuto de reloj.
 */
export const TAMANO_LOTE = 20;
export const PAUSA_LOTE_MS = 1000;

/** Cuántos productos se nombran en un aviso antes de cortar la lista. */
const MAX_NOMBRES = 5;

/** `A`, `A y B`, `A, B y C` — la lista como se escribe en una frase. */
function enumerar(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items.at(-1)}`;
}

/**
 * Los avisos que merece un guardado de la ficha.
 *
 * Es **la lista de lo que se cuenta**, y vive aquí —pura— porque es lo que
 * decide si el dueño molesta a sus seguidores o no: guardar el horario no avisa,
 * añadir un producto sí. Las tres cosas que avisan son las tres que alguien que
 * te sigue quiere saber, y nada más:
 *
 * 1. **Una oferta flash nueva.** Se cuenta por oferta nueva y no por guardado:
 *    reabrir la misma oferta para cambiarle la hora no vuelve a avisar.
 * 2. **Un producto nuevo en la carta.** Uno o varios, en un solo aviso: quien
 *    añade tres platos de golpe no manda tres mensajes.
 * 3. **La reapertura.** Volver de «cerrado» a «abierto» es la noticia que más
 *    se agradece de un negocio al que sigues.
 *
 * Cada aviso se queda corto a propósito: es un mensaje de Telegram, no un
 * boletín. Los nombres de los productos se recortan a cinco porque una lista de
 * veinte no se lee, y lo que engancha es el titular y el enlace.
 */
export function avisosPorCambios({
  negocio,
  ofertasNuevas,
  productosNuevos,
  reabre,
}: {
  negocio: string;
  ofertasNuevas: { titulo: string; descripcion?: string | null }[];
  productosNuevos: string[];
  reabre: boolean;
}): { titulo: string; texto: string }[] {
  const avisos: { titulo: string; texto: string }[] = [];

  if (ofertasNuevas.length === 1) {
    const oferta = ofertasNuevas[0]!;
    avisos.push({
      titulo: oferta.titulo,
      texto: oferta.descripcion?.trim()
        ? oferta.descripcion.trim()
        : `Oferta nueva en ${negocio}. Entra a verla antes de que termine.`,
    });
  } else if (ofertasNuevas.length > 1) {
    avisos.push({
      titulo: `Ofertas nuevas en ${negocio}`,
      texto: `Acaban de salir ${ofertasNuevas.length} ofertas: ${enumerar(
        ofertasNuevas.map((o) => `«${o.titulo}»`),
      )}.`,
    });
  }

  if (productosNuevos.length > 0) {
    const nombres = productosNuevos.slice(0, MAX_NOMBRES);
    const resto = productosNuevos.length - nombres.length;
    avisos.push({
      titulo: `Nuevo en la carta de ${negocio}`,
      texto: `Acabamos de añadir ${enumerar(nombres)}${
        resto > 0 ? ` y ${resto} más` : ""
      }.`,
    });
  }

  if (reabre) {
    avisos.push({
      titulo: `${negocio} ha vuelto a abrir`,
      texto: `Ya estamos abiertos otra vez. Pásate cuando quieras.`,
    });
  }

  return avisos;
}

/**
 * Lo que hace falta para pintar el botón de la ficha.
 *
 * Lo resuelve el servidor —la función del plan y el bot están configurados—, así
 * que el componente no comprueba nada: si esto llega, se pinta. Mismo reparto
 * que `ReservaConfig`.
 */
export interface SeguidorConfig {
  /** El nombre del negocio, para el texto del diálogo. */
  negocio: string;
  /** El deep link al bot, ya montado (`https://t.me/<bot>?start=seg_<id>`). */
  enlace: string;
}

/**
 * Arma la configuración del botón, o `undefined` si no hay botón.
 *
 * El enlace llega ya resuelto porque el nombre del bot es configuración del
 * servidor y el navegador no la tiene. Se exige también el nombre del negocio
 * porque sin él el diálogo no sabría a quién va a seguir.
 */
export function configSeguidores(fuente: {
  name: string;
  enlaceSeguidores?: string | null;
}): SeguidorConfig | undefined {
  const enlace = fuente.enlaceSeguidores?.trim();
  if (!enlace || !fuente.name.trim()) return undefined;
  return { negocio: fuente.name, enlace };
}
