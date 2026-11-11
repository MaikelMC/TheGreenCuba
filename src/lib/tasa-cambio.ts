/**
 * La tasa USD → CUP del mercado, del lado del servidor.
 *
 * La fuente es **CambioCUP**, el servicio de tasa de QvaPay
 * (`https://www.cambiocup.com/api`): el mismo que alimenta el widget que se
 * enseña en la web y que se actualiza cada 10 minutos con operaciones P2P
 * reales. No se pide desde el navegador —no hace falta CORS ni exponer nada— y
 * el resultado se cachea 10 minutos, que es el ritmo con el que publica.
 *
 * El valor de `/admin/planes` deja de ser el precio del mercado y pasa a ser
 * el **respaldo**: si CambioCUP no contesta, el sitio sigue enseñando precios
 * en CUP con la última tasa configurada a mano en vez de romperse.
 *
 * `TASA_CAMBIO_FUENTE=manual` desactiva la consulta y vuelve al
 * comportamiento anterior. `TASA_CAMBIO_URL` permite apuntar a otro endpoint
 * con la misma forma, para pruebas.
 */

import { leerTasaCambio, type TasaMercado } from "@/lib/tasa-cambio-parse";

const URL_POR_DEFECTO = "https://www.cambiocup.com/api";

/** CambioCUP publica cada 10 minutos; no tiene sentido preguntar más. */
export const TASA_CAMBIO_TTL_S = 600;

/** Etiqueta para invalidar a mano desde una ruta de administración. */
export const TASA_CAMBIO_TAG = "tasa-cambio";

/** Un timeout corto: si la fuente no contesta, el respaldo entra enseguida. */
const TIMEOUT_MS = 5_000;

/** Tras un fallo, no se reintenta en un minuto. Evita encadenar timeouts. */
const ESPERA_TRAS_FALLO_MS = 60_000;

let falloHasta = 0;

/** En desarrollo no hay caché de Next; una memoria corta evita pedir la tasa
 *  en cada `cargarCatalogo` de la misma página. */
let memoria: { tasa: TasaMercado; expira: number } | null = null;
const MEMORIA_MS = 60_000;

function endpoint(): string {
  return process.env.TASA_CAMBIO_URL?.trim() || URL_POR_DEFECTO;
}

function fuenteDesactivada(): boolean {
  return process.env.TASA_CAMBIO_FUENTE?.trim().toLowerCase() === "manual";
}

/**
 * Pregunta a CambioCUP. Nunca lanza: un fallo de red, un `500` o una respuesta
 * rara devuelven `null` y quien llama usa el respaldo.
 *
 * La caché la lleva el propio `fetch` de Next (`next.revalidate`), no
 * `unstable_cache`: así una caída **no se guarda** como si fuera una tasa, y
 * no aparece el error de revalidación en segundo plano durante el build.
 */
async function consultar(): Promise<TasaMercado | null> {
  try {
    const res = await fetch(endpoint(), {
      headers: { Accept: "application/json" },
      next: { revalidate: TASA_CAMBIO_TTL_S, tags: [TASA_CAMBIO_TAG] },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) return null;

    return leerTasaCambio((await res.json()) as unknown);
  } catch {
    return null;
  }
}

/**
 * La tasa de mercado vigente, o `null` si no se puede obtener.
 *
 * `null` **no es un error**: quien llama usa la tasa manual del catálogo. En
 * desarrollo se consulta sin caché de Next —igual que el catálogo— y en
 * producción manda la caché de 10 minutos del `fetch`.
 */
export async function tasaMercadoActual(): Promise<TasaMercado | null> {
  if (fuenteDesactivada()) return null;
  if (Date.now() < falloHasta) return null;

  const tasa =
    process.env.NODE_ENV === "production"
      ? await consultar()
      : memoria && Date.now() < memoria.expira
        ? memoria.tasa
        : await consultar();

  if (!tasa) {
    falloHasta = Date.now() + ESPERA_TRAS_FALLO_MS;
    return null;
  }

  if (process.env.NODE_ENV !== "production") {
    memoria = { tasa, expira: Date.now() + MEMORIA_MS };
  }
  falloHasta = 0;
  return tasa;
}
