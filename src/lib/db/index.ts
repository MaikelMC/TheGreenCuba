import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

/**
 * La conexión a Postgres: un único `Pool` por proceso, compartido por la app,
 * los crons y los scripts que importan `@/lib/db`.
 *
 * Sirve igual para el Postgres propio del VPS que para Neon con su URL
 * **directa** (no la del pooler HTTP): los dos hablan el protocolo estándar.
 *
 * - SSL solo si la URL lo pide con `sslmode=require` (Neon). El Postgres del
 *   VPS va por la red interna de Docker, sin TLS.
 * - `max: 10`: el techo de conexiones de este proceso.
 * - `allowExitOnIdle`: un script que termina sin cerrar el pool no se queda
 *   colgado esperando a las conexiones ociosas.
 *
 * En desarrollo, el recargado en caliente de Next vuelve a evaluar este módulo
 * y cada evaluación abriría un pool nuevo hasta agotar las conexiones del
 * servidor. Por eso el pool se guarda en `globalThis`.
 */
const url = process.env.DATABASE_URL;

function sslDe(cadena: string | undefined) {
  if (!cadena) return undefined;
  try {
    const modo = new URL(cadena).searchParams.get("sslmode");
    return modo === "require" || modo === "verify-full" || modo === "verify-ca"
      ? { rejectUnauthorized: modo !== "require" }
      : undefined;
  } catch {
    return undefined;
  }
}

/* `pg` lee `sslmode` de la URL y lo trata como `verify-full`, que contra Neon
   falla sin el certificado raíz a mano. Se quita de la cadena y se decide aquí. */
function sinSslmode(cadena: string | undefined): string | undefined {
  if (!cadena) return cadena;
  try {
    const u = new URL(cadena);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("channel_binding");
    return u.toString();
  } catch {
    return cadena;
  }
}

const global = globalThis as unknown as { __lvPool?: Pool };

export const pool =
  global.__lvPool ??
  new Pool({
    connectionString: sinSslmode(url),
    ssl: sslDe(url),
    max: 10,
    allowExitOnIdle: true,
    /* `keepAlive` manda keepalives TCP por cada conexión. En producción el
       Postgres del VPS está en la red de Docker y esto es higiene: detecta antes
       una conexión que el servidor cerró. En desarrollo es lo que mantiene vivo
       cada canal del túnel SSH (`ssh -L`), que si no deja morir las conexiones
       ociosas y la siguiente consulta se encuentra el socket muerto con un
       `ECONNRESET` a los veinte segundos. */
    keepAlive: true,
    /* Se recicla pronto lo ocioso: una conexión parada diez segundos se cierra y
       la próxima abre una nueva, en vez de arrastrar un socket que el túnel o un
       proxy ya pudo tumbar. */
    idleTimeoutMillis: 10_000,
    /* Si no se puede conectar, que falle en diez segundos y no cuelgue la
       petición medio minuto. */
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== "production") global.__lvPool = pool;

/* Un error en una conexión ociosa (el servidor la cerró, un corte de red) se
   emite en el pool; sin oyente tumbaría el proceso entero. */
pool.on("error", (error) => {
  console.error("Postgres: error en una conexión ociosa del pool:", error.message);
});

/**
 * Reintento único ante un corte transitorio de conexión.
 *
 * drizzle —y el adaptador de Better Auth, que va por el mismo `db`— consultan
 * con `pool.query` para todo lo que no sea una transacción (está en
 * `node_modules/drizzle-orm/node-postgres/session.cjs`). En producción la
 * conexión al Postgres del VPS es directa y esto casi nunca salta; en desarrollo,
 * sobre el túnel SSH, un parpadeo deja un socket muerto en el pool y la siguiente
 * consulta cae con `ECONNRESET` o «Connection terminated». Un solo reintento
 * basta: el pool ya descartó la conexión mala y la segunda abre una nueva.
 *
 * No cubre transacciones **a propósito**: esas usan su propio cliente vía
 * `pool.connect()` y reintentar una transacción a medias no es seguro.
 */
const consultarOriginal = pool.query.bind(pool) as (...args: unknown[]) => unknown;

function errorTransitorioDeConexion(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  const msg = String((e as { message?: string } | null)?.message ?? "");
  return (
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    /Connection terminated|terminated unexpectedly|connection timeout/i.test(msg)
  );
}

pool.query = function reintentando(...args: unknown[]) {
  /* Forma con callback: no se reintenta, se delega tal cual. */
  if (typeof args[args.length - 1] === "function") return consultarOriginal(...args);
  return (consultarOriginal(...args) as Promise<unknown>).catch((e: unknown) => {
    if (!errorTransitorioDeConexion(e)) throw e;
    return consultarOriginal(...args) as Promise<unknown>;
  });
} as typeof pool.query;

export const db = drizzle(pool, { schema });

/** El cliente de una transacción: se construyen las consultas con él, no con `db`. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Sustituto de `db.batch` (solo existía con el driver HTTP de Neon): corre las
 * consultas en orden dentro de una transacción, todas o ninguna.
 *
 * `construir` recibe el cliente de la transacción y devuelve las consultas sin
 * esperarlas. Tienen que salir de ese cliente: una construida con `db` iría por
 * otra conexión del pool, fuera de la transacción.
 */
export async function lote(
  construir: (q: Tx) => readonly PromiseLike<unknown>[],
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const consulta of construir(tx)) await consulta;
  });
}

export { schema };
