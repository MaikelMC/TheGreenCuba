import {
  CF_MODELS,
  generateResponse,
  type GenerateOptions,
  type Message,
} from "./cloudflare";
import { semanticGeoSearch, type SearchResultRow } from "./embedding";
import { explicitRadiusM } from "./query-radius";

/**
 * El flujo completo de búsqueda en lenguaje natural de La Verde.
 *
 *   consulta → vector → similitud en pgvector → reordenado por distancia →
 *   respuesta redactada
 *
 * Los tres primeros pasos **no viven aquí**: están en `semanticGeoSearch`
 * (`embedding.ts`), que es el mismo camino que usa la ingesta al insertar un
 * lugar. Duplicar el SQL y la fórmula del score en este archivo era tener dos
 * versiones de la misma búsqueda y una sola de ellas arreglada.
 *
 * Lo que sí es de este archivo es el último paso: convertir las filas en algo
 * que se pueda leer.
 *
 * Dos decisiones que no son obvias:
 *
 * 1. **La intención no se extrae con otro LLM.** El vector ya la lleva: «café
 *    tranquilo con wifi» queda cerca de «cafetería con conexión y ambiente
 *    calmado» sin que nadie escriba un clasificador. Meter una llamada de
 *    extracción antes sería pagar dos veces por lo mismo y añadir un punto de
 *    fallo.
 * 2. **La cercanía manda sobre la similitud.** De eso se encarga el score de
 *    `semanticGeoSearch`; aquí no se vuelve a reordenar.
 */

export interface SearchResult {
  query: string;
  places: SearchResultRow[];
  answer: string;
  model: string;
}

const SYSTEM = `Eres el asistente de "La Verde", la app de lugares de Cuba.
Recibes la pregunta del usuario y los lugares que el buscador encontró, con su distancia real.
Escribe una respuesta breve y cálida en español cubano natural (2-3 frases): qué encontraste y por qué encaja.

Reglas:
- No inventes lugares, ni datos, ni distancias que no estén en la lista.
- Si la lista viene vacía, dilo con naturalidad y sugiere cambiar la búsqueda. No rellenes con sitios genéricos.
- Sin Markdown, sin listas numeradas: es una frase para leer en voz alta.`;

function describe(places: SearchResultRow[]): string {
  if (places.length === 0) return "(no se encontró ningún lugar)";
  return places
    .map((p) => {
      const distance =
        p.distance_m === null
          ? "distancia desconocida"
          : p.distance_m < 1000
            ? `a ${Math.round(p.distance_m)} m`
            : `a ${(p.distance_m / 1000).toFixed(1)} km`;
      const barrio = p.neighborhood ? `, ${p.neighborhood}` : "";
      return `- ${p.name} (${p.category}${barrio}, ${distance}): ${p.description ?? "sin descripción"}`;
    })
    .join("\n");
}

/**
 * El flujo completo, de la frase del usuario a la respuesta.
 *
 * La búsqueda y la generación van en serie porque la segunda necesita el
 * resultado de la primera. Lo que sí se ahorra es la llamada de extracción de
 * intención: no existe.
 */
export async function searchPlacesByQuery(
  query: string,
  options: GenerateOptions & {
    /** Sin ubicación no hay prioridad por cercanía, solo parecido semántico. */
    origin?: { lat: number; lng: number } | null;
    candidates?: number;
    limit?: number;
  } = {},
): Promise<SearchResult> {
  const clean = query.trim();
  if (!clean) throw new Error("La consulta está vacía.");

  /* 1. La frase entera al modelo de embeddings. Sin limpiar ni trocear: bge-m3
        está entrenado con frases naturales y quitarle las palabras «de relleno»
        (que en realidad son filtros: «tranquilo», «barato») solo empeora el
        vector. La búsqueda reordena por cercanía y corta al `limit`. */
  const places = await semanticGeoSearch(clean, {
    origin: options.origin ?? null,
    radiusM: explicitRadiusM(clean),
    candidates: options.candidates,
    limit: options.limit,
  });

  /* 2. La respuesta, con los lugares ya elegidos como único contexto. El modelo
        no ve el catálogo entero: ve lo que se va a mencionar, así que no puede
        recomendar un sitio que no salió en la búsqueda. */
  const messages: Message[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Pregunta: "${clean}"\n\nLugares encontrados:\n${describe(places)}`,
    },
  ];

  const answer = await generateResponse(messages, {
    ...options,
    temperature: options.temperature ?? 0.5,
    maxTokens: options.maxTokens ?? 1024,
  });

  return { query: clean, places, answer, model: CF_MODELS.generation };
}

/** Ejemplo de uso real:
 *
 * ```ts
 * const { places, answer } = await searchPlacesByQuery(
 *   "café tranquilo con wifi a menos de 1 km",
 *   { origin: { lat: 20.021, lng: -75.825 } },
 * );
 * // places[0].name, places[0].distance_m, places[0].similarity
 * // answer → "Te encontré tres cafeterías cerca…"
 * ```
 */
