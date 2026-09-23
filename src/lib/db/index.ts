import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Reintento del transporte, solo en fallos anteriores al envío.
 *
 * No es una precaución de manual. Desde esta red el TCP a Neon se corta por
 * rachas: la misma consulta entra en 2 s y a la siguiente el endpoint no
 * responde en los 10 s que espera undici, y muere con `fetch failed` /
 * `UND_ERR_CONNECT_TIMEOUT`. El seed son 42 viajes de ida y vuelta y basta uno
 * malo para tumbar el proceso entero en la primera fila.
 *
 * Solo se reintenta si el fallo ocurrió **antes de enviar** la petición:
 * timeout de conexión, conexión rechazada, DNS. Un fallo posterior al envío
 * puede significar que la escritura sí llegó, y repetirla duplicaría filas —
 * esos se propagan tal cual. Un error de SQL tampoco se reintenta: repetirlo da
 * el mismo error, más lento.
 */
const CONNECT_FAILURES = new Set([
  "UND_ERR_CONNECT_TIMEOUT",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
]);

/* Cinco intentos, ~30 s de espera acumulada en el peor caso. Con cuatro se
   agotaba sembrando: la racha de cortes dura más que la cuenta. */
const RETRY_DELAYS_MS = [500, 1500, 4000, 8000, 12000];

function errorCode(error: unknown): string | undefined {
  const code =
    (error as { cause?: { code?: string } })?.cause?.code ??
    (error as { code?: string })?.code;
  return typeof code === "string" ? code : undefined;
}

function isConnectFailure(error: unknown): boolean {
  const code = errorCode(error);
  return code !== undefined && CONNECT_FAILURES.has(code);
}

/**
 * El cuerpo que manda el driver de Neon es `{"query":"…","params":[…]}` —está en
 * `node_modules/@neondatabase/serverless/index.mjs`, no supuesto—, así que el
 * verbo de la consulta se lee de ahí sin tocar el driver.
 */
function isReadQuery(init?: RequestInit): boolean {
  const body = init?.body;
  return typeof body === "string" && /"query"\s*:\s*"\s*(select|with)\b/i.test(body);
}

/**
 * Si la llamada se puede repetir sin miedo.
 *
 * `ECONNRESET` **no** está en `CONNECT_FAILURES` a propósito: es un corte a
 * mitad de la respuesta, cuando la consulta ya se envió, y repetir una que
 * escribe podría aplicarla dos veces. Pero en un `SELECT` —o un `WITH`, que es
 * como drizzle escribe las consultas con CTE— repetir no cambia nada: lo que se
 * perdió fue la respuesta, no el efecto. Y desde esta red los cortes de lectura
 * son buena parte de los fallos: sin esto, la lista de lugares se quedaba sin
 * pines al primer reset que caía en el catálogo.
 */
function isRetryable(error: unknown, init?: RequestInit): boolean {
  if (isConnectFailure(error)) return true;
  return errorCode(error) === "ECONNRESET" && isReadQuery(init);
}

const retryingFetch: typeof fetch = async (input, init) => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined || !isRetryable(error, init) || init?.signal?.aborted) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

neonConfig.fetchFunction = retryingFetch;

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });

export { schema };
