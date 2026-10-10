import { ofertasVigentes } from "@/lib/ofertas";
import type { UserPlace } from "@/lib/places-store";

/**
 * La cola de publicaciones de Facebook: lo puro.
 *
 * Módulo **sin base de datos y sin IA** a propósito, para poder probarlo y para
 * que la regla que importa viva en un solo sitio: una publicación cuenta para el
 * tope semanal del plan por su **semana ISO**, no por un rango de fechas.
 *
 * El posteo no se automatiza —Facebook no lo permite en grupos sin arriesgar el
 * bloqueo de la cuenta—, así que todo lo de aquí es para **asistir**: redactar,
 * validar y ordenar; postear lo hace una persona. Ver `src/lib/db/schema/publicaciones.ts`.
 */

export type EstadoPublicacion = "borrador" | "lista" | "publicada";

export const ESTADOS_PUBLICACION: readonly EstadoPublicacion[] = [
  "borrador",
  "lista",
  "publicada",
] as const;

/** Cómo se llama cada estado de cara a la administración. */
export const ESTADO_LABEL: Record<EstadoPublicacion, string> = {
  borrador: "Borrador",
  lista: "Lista",
  publicada: "Publicada",
};

/** Tope de largo del texto de un post. Holgado —Facebook admite mucho más—, pero acotado. */
export const MAX_TEXTO = 2200;

/** ¿Es uno de los tres estados? Sirve para comprobar el cuerpo de una ruta. */
export function esEstadoPublicacion(
  value: unknown,
): value is EstadoPublicacion {
  return (
    typeof value === "string" &&
    (ESTADOS_PUBLICACION as readonly string[]).includes(value)
  );
}

/**
 * La clave de la semana ISO 8601 de una fecha: `"2026-W41"`.
 *
 * Es la clave con la que el plan cuenta publicaciones por semana, y por eso se
 * calcula en **UTC** y no en la hora del servidor: dos peticiones a la misma
 * fecha tienen que dar el mismo cubo mida lo que mida el reloj de la máquina, y
 * una prueba tiene que poder fijar la fecha sin depender del huso. ISO cuenta la
 * semana de lunes a domingo y se la asigna al año de su **jueves**, que es lo que
 * hace que la semana del 29 de diciembre de 2025 sea la 1 de 2026 y no la 53 de
 * 2025.
 *
 * El coste de usar UTC es que el corte cae a las 00:00 UTC —las 19:00/20:00 de
 * Cuba—: una publicación de la noche del domingo puede contar ya en la semana
 * siguiente. Es una frontera de pocas horas para un tope comercial, y la
 * alternativa —huso del negocio— pediría una librería que el proyecto no tiene.
 */
export function semanaDe(fecha: Date): string {
  /* Copia en UTC a medianoche: sin esto, `setUTCDate` mutaría la fecha que
     entra y quien llame se la encontraría cambiada. */
  const d = new Date(
    Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()),
  );
  /* getUTCDay da domingo = 0; ISO quiere domingo = 7. */
  const diaIso = d.getUTCDay() || 7;
  /* El jueves de esta semana: moverse a él es lo que fija el año correcto. */
  d.setUTCDate(d.getUTCDate() + 4 - diaIso);
  const finDeAnio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(
    ((d.getTime() - finDeAnio.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(semana).padStart(2, "0")}`;
}

/**
 * Comprueba y normaliza lo que llega del navegador para una publicación.
 *
 * Devuelve el texto y la imagen listos para guardar, o **el error en texto**.
 * Los estados se comprueban aparte porque el alta y la edición los tratan
 * distinto: al crear no se puede nacer `publicada`, y al editar sí se puede
 * llegar a ella —con enlace—. Aquí solo va lo que comparten las dos.
 *
 * La imagen es **opcional**: una publicación solo de flyer vale, y una solo de
 * texto también. Si viene, tiene que ser `http(s)`: es una URL que el navegador
 * va a pedir y descargar, así que un `javascript:` o una ruta inventada no.
 */
export function validarContenidoPublicacion(
  entrada: unknown,
): { texto: string; imagenUrl: string | null } | string {
  if (!entrada || typeof entrada !== "object") {
    return "La publicación no tiene el formato esperado.";
  }
  const p = entrada as Partial<{ texto: unknown; imagenUrl: unknown }>;

  const texto = typeof p.texto === "string" ? p.texto.trim() : "";
  if (!texto) return "La publicación necesita un texto.";
  if (texto.length > MAX_TEXTO) {
    return `El texto es demasiado largo (máximo ${MAX_TEXTO} caracteres).`;
  }

  const imagenUrl = typeof p.imagenUrl === "string" ? p.imagenUrl.trim() : "";
  if (imagenUrl && !/^https?:\/\//i.test(imagenUrl)) {
    return "La imagen tiene que ser una URL que empiece por http:// o https://.";
  }

  return { texto, imagenUrl: imagenUrl || null };
}

/**
 * El enlace del post al marcarla publicada. Vacío = no se puede marcar.
 *
 * Obligatorio y `http(s)` por la misma razón que la imagen: es el registro de
 * que el post existe, y un enlace que no lleva a ningún sitio no registra nada.
 */
export function validarEnlacePublicado(
  entrada: unknown,
): string | null | false {
  if (entrada === null || entrada === undefined) return false;
  const enlace = typeof entrada === "string" ? entrada.trim() : "";
  if (!enlace) return false;
  if (!/^https?:\/\//i.test(enlace)) return false;
  return enlace.slice(0, 2000);
}

/** Lo mínimo que hay que saber de una publicación para planear su edición. */
export interface PublicacionActual {
  texto: string;
  imagenUrl: string | null;
  estado: EstadoPublicacion;
  enlace: string | null;
}

/**
 * Los campos que una edición cambia. Ausente = «no lo toques», que es distinto
 * de un valor nulo.
 *
 * `publicadaEn` es un booleano y no una fecha porque lo que hay que decidir —y
 * lo que se prueba— es **si hay que sellarla o borrarla**; la fecha la pone la
 * ruta, que es quien tiene un «ahora» de verdad.
 */
export interface EdicionPublicacion {
  texto?: string;
  imagenUrl?: string | null;
  estado?: EstadoPublicacion;
  enlace?: string | null;
  /** `true` = sellar la fecha; `false` = borrarla; ausente = no tocarla. */
  publicadaEn?: boolean;
}

/**
 * Traduce una edición de la cola a los campos que hay que escribir, o **el error
 * en texto**.
 *
 * Aquí vive lo único con reglas de la edición, y por eso está fuera de la ruta:
 * **marcar publicada exige el enlace** —el posteo es manual, así que el estado
 * es una afirmación de que alguien lo hizo y sin la URL no se puede comprobar—,
 * y **volver atrás lo borra todo**, porque un enlace de un post publicado no
 * pinta nada en un borrador. El contenido se valida **fusionado** con lo que ya
 * había: editar solo la imagen no puede tropezar con el texto que no se tocó, y
 * borrar el texto no puede colar una publicación vacía.
 */
export function planearEdicionPublicacion(
  actual: PublicacionActual,
  cambios: Record<string, unknown>,
): EdicionPublicacion | string {
  const edicion: EdicionPublicacion = {};

  if (cambios.texto !== undefined || cambios.imagenUrl !== undefined) {
    const contenido = validarContenidoPublicacion({
      texto: cambios.texto !== undefined ? cambios.texto : actual.texto,
      imagenUrl:
        cambios.imagenUrl !== undefined ? cambios.imagenUrl : actual.imagenUrl,
    });
    if (typeof contenido === "string") return contenido;
    edicion.texto = contenido.texto;
    edicion.imagenUrl = contenido.imagenUrl;
  }

  if (cambios.estado !== undefined) {
    if (!esEstadoPublicacion(cambios.estado)) {
      return "El estado no es uno de los válidos.";
    }

    if (cambios.estado === "publicada") {
      const enlace = validarEnlacePublicado(
        cambios.enlace !== undefined ? cambios.enlace : actual.enlace,
      );
      if (!enlace) {
        return "Para marcarla como publicada hace falta el enlace del post (http:// o https://).";
      }
      edicion.estado = "publicada";
      edicion.enlace = enlace;
      edicion.publicadaEn = true;
    } else {
      edicion.estado = cambios.estado;
      edicion.enlace = null;
      edicion.publicadaEn = false;
    }
  } else if (cambios.enlace !== undefined && actual.estado === "publicada") {
    /* Corregir el enlace de una que ya está publicada, sin mover el estado. */
    const enlace = validarEnlacePublicado(cambios.enlace);
    if (!enlace) return "El enlace del post no es válido.";
    edicion.enlace = enlace;
  }

  return edicion;
}

/* ── Generación con IA ───────────────────────────────────────────────────────
   Un perfil destilado de la ficha, no la ficha entera: el modelo solo necesita
   con qué escribir, y cada campo de más es un token que se paga. */

/** Una oferta vigente, ya resumida para el modelo. */
export interface OfertaParaPost {
  titulo: string;
  /** «120», «20% menos». Ya legible; el modelo no tiene que interpretar nada. */
  rebaja?: string;
}

/** Un producto de la carta, ya resumido para el modelo. */
export interface ProductoParaPost {
  nombre: string;
  /** «3–5 USD», tal como lo escribió el dueño. */
  precio?: string;
}

/** Lo justo de un negocio para escribir su post. */
export interface PerfilPublicacion {
  nombre: string;
  categoria: string;
  ciudad?: string;
  provincia?: string;
  descripcion?: string;
  productos: ProductoParaPost[];
  ofertas: OfertaParaPost[];
  /** Enlace a la ficha pública, el que va en la llamada a la acción. */
  enlacePerfil: string;
  instagram?: string;
  facebook?: string;
}

/** Tope de productos que viajan al modelo. La carta puede tener ochenta. */
const MAX_PRODUCTOS_PROMPT = 8;

/**
 * Destila una ficha en lo que hace falta para escribir el post.
 *
 * Solo entran las **ofertas vigentes** —una caducada no es una razón para ir hoy
 * a un sitio— y como mucho ocho productos: la carta entera son tokens sin
 * provecho, y con ocho se entiende de qué va el negocio. El `ahora` va de
 * parámetro para poder fijarlo en las pruebas.
 */
export function perfilDesdePlace(
  place: UserPlace,
  urlBase: string,
  ahora: number = Date.now(),
): PerfilPublicacion {
  const ofertas = ofertasVigentes(place.ofertas, ahora)
    .slice(0, 3)
    .map((oferta) => ({
      titulo: oferta.titulo,
      rebaja: oferta.precioOferta
        ? `precio ${oferta.precioOferta}`
        : oferta.descuentoPct != null
          ? `${oferta.descuentoPct}% menos`
          : undefined,
    }));

  const productos = place.menu.slice(0, MAX_PRODUCTOS_PROMPT).map((item) => ({
    nombre: item.name,
    precio: item.price?.trim() || undefined,
  }));

  return {
    nombre: place.name,
    categoria: place.category,
    ciudad: place.city?.trim() || undefined,
    provincia: place.province?.trim() || undefined,
    descripcion: place.description?.trim() || undefined,
    productos,
    ofertas,
    enlacePerfil: `${urlBase.replace(/\/+$/, "")}/place/${place.id}`,
    instagram: place.instagram?.trim() || undefined,
    facebook: place.facebook?.trim() || undefined,
  };
}

const SYSTEM_PUBLICACION = `Eres redactor de redes sociales de negocios cubanos para La Verde.
Escribes publicaciones cortas para compartir en grupos de Facebook.
Reglas:
- Devuelve SOLO JSON válido, sin Markdown: {"variantes": ["...", "..."]}.
- Exactamente DOS variantes, distintas entre sí.
- Cada variante: 2 o 3 frases cortas, español cubano natural y cercano.
- Emojis con moderación: entre uno y tres por variante, no más.
- Cada variante termina con una llamada a la acción clara y con el enlace al perfil exacto que se te da.
- Usa solo los datos del perfil: no inventes platos, precios, ofertas ni direcciones.
- Si hay ofertas vigentes, alguna variante tiene que mencionarlas.
- Nada de promesas médicas, legales ni comparaciones con otros negocios.`;

/**
 * El par system/user que se le manda al modelo. Es puro para poder probar que el
 * enlace y los datos del negocio viajan en él.
 */
export function construirPromptPublicacion(perfil: PerfilPublicacion): {
  system: string;
  user: string;
} {
  return {
    system: SYSTEM_PUBLICACION,
    user: `Perfil del negocio (JSON):\n${JSON.stringify(perfil)}`,
  };
}

/**
 * Deja lo que devolvió el modelo en una lista limpia de hasta dos variantes.
 *
 * El modelo no es de fiar: puede devolver tres, devolver una vacía, meterle
 * código alrededor o responder una sola cadena en vez de una lista. Aquí se
 * criba todo eso. Es puro y por eso la prueba puede pasarle basura directamente.
 */
export function normalizarVariantes(value: unknown): string[] {
  const lista = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? [value]
      : [];

  const out: string[] = [];
  for (const item of lista) {
    if (typeof item !== "string") continue;
    const texto = item.trim().slice(0, MAX_TEXTO);
    if (!texto) continue;
    out.push(texto);
    if (out.length === 2) break;
  }
  return out;
}
