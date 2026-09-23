import type { NextRequest } from "next/server";

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();
const MAX_ENTRIES = 5000;

/**
 * IP del cliente, de la fuente que el cliente no puede elegir.
 *
 * `x-real-ip` va primero: la pone el borde y lleva un solo valor. El respaldo es
 * la **última** entrada de `x-forwarded-for` y no la primera, y ahí está el
 * arreglo. Un `split(",")[0]` coge el valor más a la izquierda, que es el que
 * puede venir inyectado en la propia petición: rotándolo, cada intento caía en
 * un cubo nuevo y el límite no limitaba nada. Eso pesaba de verdad en
 * `/api/admin/verify` —diez intentos cada quince minutos contra `ADMIN_KEY`, que
 * es la puerta de admin para scripts y `curl`—.
 *
 * La última entrada es la que añade el salto más cercano. Con un proxy que
 * reemplaza la cabecera en lugar de añadir, la última es la única y también vale.
 *
 * Sin ninguna de las dos se devuelve `"unknown"`: todos comparten un cubo, que
 * es restrictivo de más y nunca de menos.
 */
function clientIp(req: NextRequest): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;

  const last = req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return last || "unknown";
}

/** Limita por IP en memoria (por instancia). Ventana deslizante simple por token bucket. */
export function rateLimit(req: NextRequest, limit: number, windowMs: number): {
  ok: boolean;
  retryAfterSeconds?: number;
} {
  /* La ruta entra en la clave. Sin ella, dos endpoints con la misma ventana
     —`/api/ai`, `/api/ai/search` y `/api/route` usan los tres 60 s— compartían
     cubo: veinte búsquedas de IA gastaban el presupuesto de las rutas y al
     revés, cada uno cortado por el límite del otro. */
  const key = `${clientIp(req)}:${req.nextUrl.pathname}:${windowMs}`;
  const now = Date.now();

  const bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    prune(now);
    return { ok: true };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true };
}

function prune(now: number): void {
  if (store.size <= MAX_ENTRIES) return;
  for (const [k, v] of store) {
    if (store.size <= MAX_ENTRIES / 2) break;
    if (v.resetAt <= now) store.delete(k);
  }
}
