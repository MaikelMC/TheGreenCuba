import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * QvaPay, del lado del servidor y solo del servidor.
 *
 * Aquí no hay SDK: son tres llamadas y una firma. La app **nunca** habla con
 * QvaPay desde el navegador; el `app-secret` no puede salir de aquí.
 *
 * La factura se crea con `POST /v2/create_invoice` y las credenciales de la app
 * van en `app-id` / `app-secret`. El webhook se firma con HMAC-SHA256 del
 * **cuerpo crudo** y el mismo secreto, en `x-qvapay-signature: sha256=<hex>`.
 * Comparar el JSON re-serializado rompería la firma por los espacios.
 */

const BASE = "https://api.qvapay.com";

/** Cabecera de firma que manda QvaPay. */
export const CABECERA_FIRMA = "x-qvapay-signature";
export const CABECERA_TIEMPO = "x-qvapay-timestamp";

/** Cinco minutos: de sobra para un reintento y corto para un replay. */
const VENTANA_SEGUNDOS = 5 * 60;

interface Credenciales {
  appId: string;
  appSecret: string;
}

function credenciales(): Credenciales | null {
  const appId = process.env.QVAPAY_APP_ID?.trim();
  const appSecret = process.env.QVAPAY_APP_SECRET?.trim();
  return appId && appSecret ? { appId, appSecret } : null;
}

/** ¿Hay credenciales? Sin ellas la pasarela no puede ni pedir la factura. */
export function qvapayConfigurado(): boolean {
  return credenciales() !== null;
}

function base(): string {
  return process.env.QVAPAY_API_URL?.trim().replace(/\/+$/, "") || BASE;
}

function cabeceras({ appId, appSecret }: Credenciales): HeadersInit {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "app-id": appId,
    "app-secret": appSecret,
  };
}

/** El objeto útil, por si la API envuelve la respuesta en `data` o `transaction`. */
function desenvolver(valor: unknown): Record<string, unknown> | null {
  if (typeof valor !== "object" || valor === null) return null;
  const obj = valor as Record<string, unknown>;
  for (const clave of ["data", "transaction"]) {
    const hijo = obj[clave];
    if (typeof hijo === "object" && hijo !== null) {
      return hijo as Record<string, unknown>;
    }
  }
  return obj;
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/** Un monto en centavos de dólar, o `null` si no es una cifra. */
export function centavos(valor: unknown): number | null {
  const n =
    typeof valor === "number"
      ? valor
      : typeof valor === "string" && valor.trim()
        ? Number(valor)
        : Number.NaN;
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export interface FacturaQvapay {
  transactionUuid: string;
  url: string;
}

/**
 * Pide la factura. `remoteId` es el id de nuestra fila de `pagos` y vuelve en
 * el webhook; `webhook` tiene que ser HTTPS y público.
 */
export async function crearFactura(input: {
  monto: number;
  descripcion: string;
  remoteId: string;
  webhook: string;
}): Promise<FacturaQvapay> {
  const cred = credenciales();
  if (!cred) throw new Error("QvaPay no está configurado.");

  const res = await fetch(`${base()}/v2/create_invoice`, {
    method: "POST",
    headers: cabeceras(cred),
    body: JSON.stringify({
      amount: input.monto,
      description: input.descripcion,
      remote_id: input.remoteId,
      webhook: input.webhook,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const crudo = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const cuerpo = desenvolver(crudo);
    const mensaje = texto(cuerpo?.message) || `QvaPay respondió ${res.status}.`;
    throw new Error(mensaje);
  }

  const factura = desenvolver(crudo);
  const transactionUuid = texto(factura?.transaction_uuid) || texto(factura?.uuid);
  const url = texto(factura?.url);

  if (!transactionUuid || !url) {
    throw new Error("QvaPay no devolvió la factura.");
  }
  return { transactionUuid, url };
}

export interface TransaccionQvapay {
  uuid: string;
  estado: string;
  montoCentavos: number | null;
  remoteId: string | null;
}

/**
 * La transacción tal como la ve QvaPay. Es la comprobación de respaldo del
 * webhook: la firma ya dice que el aviso es suyo, esto dice que el cobro existe.
 */
export async function consultarTransaccion(
  uuid: string,
): Promise<TransaccionQvapay | null> {
  const cred = credenciales();
  if (!cred) throw new Error("QvaPay no está configurado.");

  /* El SDK consulta la v1 y la documentación de mini-apps nombra la v2. Se
     prueban las dos y se sigue solo si la primera no conoce la ruta. */
  const rutas = [
    `/transaction/${encodeURIComponent(uuid)}`,
    `/v2/transactions/${encodeURIComponent(uuid)}`,
  ];

  for (const ruta of rutas) {
    const res = await fetch(`${base()}${ruta}`, {
      headers: cabeceras(cred),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    /* La v2 existe pero responde 405: la ruta buena para consultar es la v1.
       Las dos señales significan «prueba la siguiente», no «error». */
    if (res.status === 404 || res.status === 405) continue;

    const crudo = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) throw new Error(`QvaPay respondió ${res.status}.`);

    const tx = desenvolver(crudo);
    if (!tx) continue;

    return {
      uuid: texto(tx.uuid) || uuid,
      estado: texto(tx.status).toLowerCase(),
      montoCentavos: centavos(tx.amount),
      remoteId: texto(tx.remote_id) || null,
    };
  }

  return null;
}

/**
 * La firma del webhook contra el cuerpo **crudo**.
 *
 * `timingSafeEqual` y no `===`: comparar hex con `===` filtra por el tiempo
 * cuántos caracteres acertó quien prueba. Las longitudes se comparan antes
 * porque `timingSafeEqual` lanza si difieren.
 */
export function firmaValida(
  crudo: string,
  firma: string | null,
  secreto: string,
): boolean {
  if (!firma) return false;
  const [algoritmo = "", hex = ""] = firma.split("=");
  if (algoritmo.toLowerCase() !== "sha256" || !hex) return false;

  const esperado = createHmac("sha256", secreto).update(crudo, "utf8").digest();
  const recibido = Buffer.from(hex, "hex");
  if (recibido.length !== esperado.length) return false;
  return timingSafeEqual(recibido, esperado);
}

/** El sello de tiempo del webhook, en segundos y dentro de la ventana. */
export function tiempoValido(valor: string | null, ahora = Date.now()): boolean {
  if (!valor) return false;
  const segundos = Number(valor);
  if (!Number.isFinite(segundos)) return false;
  return Math.abs(ahora / 1000 - segundos) <= VENTANA_SEGUNDOS;
}
