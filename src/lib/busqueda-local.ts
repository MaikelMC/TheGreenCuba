/**
 * Búsqueda local sobre el catálogo guardado.
 *
 * Es el respaldo de `/api/ai/search` cuando no hay red (o la conexión es tan
 * lenta que la petición se agota). No pretende imitar al modelo: filtra por las
 * mismas señales que ya viajan al servidor —nombre, categoría, ubicación,
 * descripción y carta— y devuelve el motivo para que la tarjeta pueda explicar
 * por qué salió.
 *
 * La consulta se normaliza sin acentos y por palabras: **todas** tienen que
 * aparecer en alguna parte del lugar. Es más estricto que una coincidencia
 * parcial y evita que «pizza playa» devuelva cualquier pizzería del país.
 */

export interface LugarBuscable {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  shortDescription?: string | null;
  barrio?: string | null;
  city?: string | null;
  province?: string | null;
  menu?:
    | readonly {
        name?: string | null;
        description?: string | null;
      }[]
    | null;
}

export interface CoincidenciaLocal {
  id: string;
  /** Texto corto para la tarjeta: «Coincide con el nombre», «En Vedado»… */
  reason: string;
}

const MAX_RESULTADOS = 8;

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/* Palabras que no discriminan nada: sin esto, «pizza en la playa» exigía que
   aparecieran «en» y «la» y no encontraba la pizzería de la playa. */
const PALABRAS_VACIAS = new Set([
  "de",
  "del",
  "al",
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
  "y",
  "o",
  "en",
  "con",
  "para",
  "por",
  "que",
  "mi",
  "tu",
  "su",
  "se",
  "lo",
  "me",
  "te",
  "es",
  "son",
  "hay",
  "donde",
  "como",
  "mas",
  "sin",
]);

function palabrasDe(texto: string): string[] {
  return normalizar(texto)
    .split(/[^a-z0-9]+/)
    .filter((palabra) => palabra.length >= 2 && !PALABRAS_VACIAS.has(palabra));
}

/**
 * Devuelve las coincidencias ordenadas por relevancia, con un tope de
 * `limite`. Sin palabras útiles (vacío, «de», «la»…) no devuelve nada: mejor
 * que la hoja diga que no encontró nada a que enseñe el catálogo entero como
 * si fuera un resultado.
 */
export function buscarLugaresLocales(
  lugares: readonly LugarBuscable[],
  consulta: string,
  limite: number = MAX_RESULTADOS,
): CoincidenciaLocal[] {
  const palabras = palabrasDe(consulta);
  if (palabras.length === 0 || limite <= 0) return [];

  const encontrados: { coincidencia: CoincidenciaLocal; puntos: number }[] = [];

  for (const lugar of lugares) {
    const nombre = normalizar(lugar.name ?? "");
    const categoria = normalizar(lugar.category ?? "");
    const barrio = normalizar(lugar.barrio ?? "");
    const ciudad = normalizar(lugar.city ?? "");
    const provincia = normalizar(lugar.province ?? "");
    const descripcion = normalizar(
      `${lugar.shortDescription ?? ""} ${lugar.description ?? ""}`,
    );
    const carta = normalizar(
      (lugar.menu ?? [])
        .map((item) => `${item.name ?? ""} ${item.description ?? ""}`)
        .join(" "),
    );

    const texto = `${nombre} ${categoria} ${barrio} ${ciudad} ${provincia} ${descripcion} ${carta}`;
    if (!palabras.every((palabra) => texto.includes(palabra))) continue;

    let puntos = 0;
    let razon = "";

    /* El nombre pesa más que todo lo demás junto: es lo que la persona
       recuerda cuando busca «el Café Central». */
    const aciertosNombre = palabras.filter((palabra) =>
      nombre.includes(palabra),
    ).length;
    if (aciertosNombre === palabras.length) {
      puntos += 100;
      razon = "Coincide con el nombre";
    } else if (aciertosNombre > 0) {
      puntos += 40 * aciertosNombre;
      razon = "Coincide con el nombre";
    }

    if (categoria && palabras.some((palabra) => categoria.includes(palabra))) {
      puntos += 25;
      if (!razon) razon = `Categoría: ${lugar.category}`;
    }

    if (
      [barrio, ciudad, provincia].some(
        (zona) => zona && palabras.some((palabra) => zona.includes(palabra)),
      )
    ) {
      puntos += 20;
      if (!razon) razon = `En ${lugar.barrio || lugar.city || lugar.province}`;
    }

    if (carta && palabras.some((palabra) => carta.includes(palabra))) {
      puntos += 18;
      if (!razon) razon = "Tiene platos que coinciden";
    }

    if (
      descripcion &&
      palabras.some((palabra) => descripcion.includes(palabra))
    ) {
      puntos += 8;
      if (!razon) razon = "Menciona tu búsqueda en la descripción";
    }

    encontrados.push({
      coincidencia: {
        id: lugar.id,
        reason: razon || "Coincide con tu búsqueda",
      },
      puntos,
    });
  }

  encontrados.sort((a, b) => b.puntos - a.puntos);

  return encontrados.slice(0, limite).map((item) => item.coincidencia);
}
