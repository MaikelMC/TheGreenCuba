/**
 * Normalización, limpieza y agrupación de errores de cliente.
 *
 * La entrada son filas de `diagnosticos` con `tipo = "error"`. Nada de este
 * módulo toca la base: así se puede probar con mensajes reales sin red.
 */

export type SeveridadError = "alta" | "media" | "baja";

export interface FilaError {
  id: string;
  datos: Record<string, unknown>;
  creadoEn: Date | string;
}

export interface GrupoError {
  clave: string;
  titulo: string;
  severidad: SeveridadError;
  causa: string;
  casos: number;
  sesiones: number;
  plataformas: Record<string, number>;
  navegadores: Record<string, number>;
  rutas: string[];
  versionesApp: string[];
  versionesSw: string[];
  primera: string | null;
  ultima: string | null;
  ejemplos: string[];
}

interface ErrorNormalizado {
  clave: string;
  titulo: string;
  severidad: SeveridadError;
  causa: string;
}

const MAX_MENSAJE = 500;

/** Quita de un mensaje URLs con query, correos, teléfonos e identificadores. */
export function limpiarMensaje(mensaje: unknown, max = MAX_MENSAJE): string {
  let texto = typeof mensaje === "string" ? mensaje : String(mensaje ?? "");
  texto = texto
    .replace(/(https?:\/\/[^\s?#]+)\?[^\s]*/gi, "$1")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[correo]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "[id]")
    .replace(/\b[0-9a-f]{16,}\b/gi, "[id]")
    .replace(/(\+?\d[\d\s().-]{6,}\d)/g, "[teléfono]")
    .replace(/\s+/g, " ")
    .trim();
  return texto.slice(0, max);
}

/** Contexto que no es un mensaje: no se le aplica la regla de teléfonos. */
function limpiarContexto(texto: string): string {
  return texto
    .replace(/(https?:\/\/[^\s?#]+)\?[^\s]*/gi, "$1")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[correo]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "[id]")
    .replace(/\b[0-9a-f]{16,}\b/gi, "[id]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

/** Limpia recursivamente lo que se va a guardar en `datos` (máx. 500 por texto). */
export function limpiarDatosDiagnostico(
  valor: unknown,
  profundidad = 0,
  esMensaje = false,
): unknown {
  if (profundidad > 3) return null;
  if (typeof valor === "string") {
    return esMensaje ? limpiarMensaje(valor) : limpiarContexto(valor);
  }
  if (typeof valor === "number" || typeof valor === "boolean" || valor === null) {
    return valor;
  }
  if (Array.isArray(valor)) {
    return valor
      .slice(0, 20)
      .map((item) => limpiarDatosDiagnostico(item, profundidad + 1, esMensaje));
  }
  if (valor && typeof valor === "object") {
    const salida: Record<string, unknown> = {};
    for (const [clave, item] of Object.entries(valor).slice(0, 30)) {
      salida[clave.slice(0, 40)] = limpiarDatosDiagnostico(
        item,
        profundidad + 1,
        clave === "mensaje",
      );
    }
    return salida;
  }
  return null;
}

/** Ruta sin query ni hash. */
export function limpiarRuta(valor: unknown): string {
  const texto = typeof valor === "string" ? valor : "";
  if (!texto) return "/";
  const sinQuery = texto.split("?")[0]?.split("#")[0] ?? "/";
  return sinQuery.startsWith("/") ? sinQuery.slice(0, 160) : "/";
}

function claveDeTexto(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "[url]")
    .replace(/\b[0-9a-f]{8,}\b/g, "[id]")
    .replace(/\d+/g, "#")
    .replace(/[^a-z0-9áéíóúñ]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

/** Convierte un mensaje en un grupo estable y legible. */
export function normalizarError(mensaje: unknown): ErrorNormalizado {
  const original = limpiarMensaje(mensaje);
  const texto = original.toLowerCase();

  if (texto.includes("script error")) {
    return {
      clave: "script-externo",
      titulo: "Script externo sin detalle",
      severidad: "baja",
      causa:
        "Un script de otro dominio no expone el detalle. No se puede atribuir a la app sin la cabecera CORS del origen.",
    };
  }

  if (
    /hydration|hidrataci[oó]n|react error #418|minified react error #418|text content does not match|server rendered html/.test(
      texto,
    )
  ) {
    return {
      clave: "react-418",
      titulo: "Hidratación de React",
      severidad: "alta",
      causa:
        "El HTML del servidor y el primer render del cliente no coinciden. Suele venir de una hora, un número o una fecha calculados en render.",
    };
  }

  if (
    /indexeddb|idbdatabase|invalidstateerror|quotaexceeded|transaction.*idb|base cerrada/.test(
      texto,
    )
  ) {
    return {
      clave: "indexeddb",
      titulo: "IndexedDB",
      severidad: "alta",
      causa:
        "Una operación del almacén offline falló o la conexión estaba cerrada. El guardado debe reintentar o degradar sin promesa rechazada.",
    };
  }

  if (/failed to load chunk|chunkloaderror|loading chunk/.test(texto)) {
    return {
      clave: "chunk-carga",
      titulo: "Chunk de la app no cargó",
      severidad: "media",
      causa:
        "Una pestaña abierta durante un despliegue o una red que cortó el archivo. La app recarga una vez para pedir el chunk de la versión nueva.",
    };
  }

  if (/extension|chrome-extension|moz-extension/.test(texto)) {
    return {
      clave: "extension-navegador",
      titulo: "Extensión del navegador",
      severidad: "baja",
      causa: "El error nace en una extensión instalada, no en el código de La Verde.",
    };
  }

  return {
    clave: `error-${claveDeTexto(original) || "sin-mensaje"}`,
    titulo: original.slice(0, 120) || "Error sin mensaje",
    severidad: "media",
    causa: "Error no clasificado. Revisa los mensajes de ejemplo para localizar el flujo.",
  };
}

function sumar(mapa: Record<string, number>, clave: string): void {
  mapa[clave] = (mapa[clave] ?? 0) + 1;
}

function anadirUnico(lista: string[], valor: string, max = 5): void {
  if (!valor || lista.includes(valor) || lista.length >= max) return;
  lista.push(valor);
}

/** Agrupa errores por clave y conserva hasta tres ejemplos limpios. */
export function agruparErrores(filas: FilaError[]): GrupoError[] {
  const grupos = new Map<string, GrupoError & { sesionesSet: Set<string> }>();

  for (const fila of filas) {
    const datos = fila.datos ?? {};
    const mensaje = limpiarMensaje(datos.mensaje);
    if (!mensaje) continue;

    const normalizado = normalizarError(mensaje);
    const actual = grupos.get(normalizado.clave) ?? {
      clave: normalizado.clave,
      titulo: normalizado.titulo,
      severidad: normalizado.severidad,
      causa: normalizado.causa,
      casos: 0,
      sesiones: 0,
      plataformas: {},
      navegadores: {},
      rutas: [],
      versionesApp: [],
      versionesSw: [],
      primera: null,
      ultima: null,
      ejemplos: [],
      sesionesSet: new Set<string>(),
    };

    actual.casos += 1;
    actual.sesionesSet.add(
      typeof datos.sesion === "string" && datos.sesion
        ? datos.sesion
        : fila.id,
    );
    sumar(actual.plataformas, String(datos.plataforma ?? "otros"));
    if (datos.navegador) sumar(actual.navegadores, String(datos.navegador));
    anadirUnico(actual.rutas, limpiarRuta(datos.ruta));
    if (datos.appVersion) anadirUnico(actual.versionesApp, String(datos.appVersion));
    if (datos.swVersion) anadirUnico(actual.versionesSw, String(datos.swVersion));
    anadirUnico(actual.ejemplos, mensaje.slice(0, MAX_MENSAJE), 3);

    const fecha = new Date(fila.creadoEn).toISOString();
    if (!actual.primera || fecha < actual.primera) actual.primera = fecha;
    if (!actual.ultima || fecha > actual.ultima) actual.ultima = fecha;

    grupos.set(normalizado.clave, actual);
  }

  return [...grupos.values()]
    .map(({ sesionesSet, ...grupo }) => ({
      ...grupo,
      sesiones: sesionesSet.size,
    }))
    .sort((a, b) => {
      const peso = { alta: 0, media: 1, baja: 2 } as const;
      return peso[a.severidad] - peso[b.severidad] || b.casos - a.casos;
    });
}

/** Casos de severidad alta: es lo que dispara el resumen grave. */
export function contarErroresAltos(grupos: GrupoError[]): number {
  return grupos
    .filter((grupo) => grupo.severidad === "alta")
    .reduce((total, grupo) => total + grupo.casos, 0);
}
