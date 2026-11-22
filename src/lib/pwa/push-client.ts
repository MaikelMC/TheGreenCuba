/**
 * Las piezas de push que comparten el interruptor del perfil y el aviso de la
 * primera sesión.
 *
 * Lo que queda aquí es lo que el navegador exige para suscribir un dispositivo:
 * permiso, service worker, clave VAPID y el alta en `/api/push/subscribe`. El
 * estado que se enseña en cada sitio —«activo», «denegado», «sin instalar»— se
 * decide en el componente, que es quien conoce su propia interfaz.
 */

/* Lo máximo que se espera a que el service worker esté activo. El primer aviso
   de la app usa el mismo tope; aquí se repite para no importar un componente
   desde una utilidad. */
const ESPERA_SW_MS = 5000;

/** La clave pública viaja en el bundle; sin ella no se puede suscribir nada. */
export function clavePublicaVapid(): string {
  return (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim();
}

export function esIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    /* iPadOS 13+ se presenta como Mac; se distingue por la pantalla táctil. */
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function estaInstalada(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return standalone || iosStandalone === true;
}

export function soportaPush(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** La clave VAPID viaja en base64url; `pushManager` la quiere en bytes. */
function claveAVBytes(base64: string): Uint8Array<ArrayBuffer> {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalizado = (base64 + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(normalizado);
  /* El buffer se crea explícito, no con `new Uint8Array(n)`: `applicationServerKey`
     exige un `ArrayBuffer` y no admite `SharedArrayBuffer` en el tipo. */
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i += 1) {
    bytes[i] = binario.charCodeAt(i);
  }
  return bytes;
}

export type ResultadoAltaPush =
  | { ok: true }
  | {
      ok: false;
      motivo: "sin-soporte" | "sin-clave" | "denegado" | "cancelado" | "sin-sw" | "error";
      mensaje?: string;
    };

let sincronizadoEnEstaCarga = false;

/**
 * Guarda en el servidor una suscripción que este navegador ya tiene.
 *
 * El alta es idempotente (`onConflictDoUpdate` sobre `endpoint`), así que
 * reenviarla no crea filas de más: solo asegura que la copia del servidor
 * existe y apunta al dueño actual.
 */
async function guardarEnServidor(
  datos: PushSubscriptionJSON,
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  if (!datos.endpoint || !datos.keys?.p256dh || !datos.keys?.auth) {
    return {
      ok: false,
      mensaje: "El navegador devolvió una suscripción incompleta.",
    };
  }

  try {
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...datos, userAgent: navigator.userAgent }),
    });

    if (response.ok) return { ok: true };

    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    return {
      ok: false,
      mensaje: data?.error ?? "No se pudieron activar los avisos. Inténtalo otra vez.",
    };
  } catch {
    return {
      ok: false,
      mensaje: "No se pudieron activar los avisos. Inténtalo otra vez.",
    };
  }
}

/**
 * Vuelve a dar de alta en el servidor la suscripción que ya existe en este
 * dispositivo.
 *
 * El navegador guarda la suscripción y el servidor guarda el endpoint, pero son
 * **dos copias**. Si la tabla `push_subscriptions` se pierde —un borrado, una
 * migración de base de datos a otro servidor—, el dispositivo sigue teniendo su
 * suscripción y el perfil la enseña como «activa» mientras el servidor no tiene
 * a quién enviar. Nada volvía a registrar ese endpoint hasta que el usuario
 * desactivaba y reactivaba los avisos a mano.
 *
 * Se llama al abrir la app: repara ese hueco sola y además refresca el endpoint
 * si el servicio push lo renovó mientras la app estaba cerrada.
 */
export async function sincronizarPushDispositivo(): Promise<boolean> {
  if (sincronizadoEnEstaCarga) return true;
  if (!soportaPush() || !clavePublicaVapid()) return false;
  if (Notification.permission !== "granted") return false;

  /* `ready` no llega si el service worker no está registrado; el tope evita que
     la comprobación se quede esperando para siempre. */
  const registro = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ESPERA_SW_MS)),
  ]).catch(() => null);
  if (!registro) return false;

  const suscripcion = await registro.pushManager.getSubscription().catch(() => null);
  if (!suscripcion) return false;

  const guardado = await guardarEnServidor(suscripcion.toJSON());
  sincronizadoEnEstaCarga = guardado.ok;
  return guardado.ok;
}

/**
 * Pide el permiso (si hace falta), suscribe este navegador y guarda el endpoint.
 *
 * **Se llama desde un clic.** Los navegadores ignoran —o dan por denegado— un
 * `requestPermission()` que no nace de un gesto del usuario, y en iOS la regla
 * es aún más estricta. Las dos pantallas que lo usan lo disparan desde un botón.
 *
 * No lanza por red: el fetch puede rechazar y el llamante decide qué enseñar.
 */
export async function altaPushDispositivo(): Promise<ResultadoAltaPush> {
  if (!soportaPush()) return { ok: false, motivo: "sin-soporte" };

  const clave = clavePublicaVapid();
  if (!clave) return { ok: false, motivo: "sin-clave" };

  const permiso = await Notification.requestPermission();
  if (permiso === "denied") return { ok: false, motivo: "denegado" };
  if (permiso !== "granted") return { ok: false, motivo: "cancelado" };

  /* `getRegistration()` devuelve el registro aunque el worker todavía esté
     instalándose, y suscribir ahí revienta. `ready` espera al activo. El tope
     evita dejar el botón colgado si el registro no llega nunca. */
  const registro = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ESPERA_SW_MS)),
  ]);
  if (!registro) return { ok: false, motivo: "sin-sw" };

  const existente = await registro.pushManager.getSubscription();
  const suscripcion =
    existente ??
    (await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: claveAVBytes(clave),
    }));

  const guardado = await guardarEnServidor(suscripcion.toJSON());
  if (!guardado.ok) {
    return { ok: false, motivo: "error", mensaje: guardado.mensaje };
  }

  sincronizadoEnEstaCarga = true;
  return { ok: true };
}
