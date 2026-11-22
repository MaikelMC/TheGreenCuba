import { createECDH } from "node:crypto";

import { inArray, sql } from "drizzle-orm";
import webpush from "web-push";

import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import {
  MAX_CUERPO_PUSH,
  MAX_TITULO_PUSH,
  recortarTexto,
} from "@/lib/push-texto";

/**
 * Envío de notificaciones push del servidor.
 *
 * `web-push` firma cada petición con VAPID y cifra el cuerpo con las claves del
 * navegador; aquí solo se decide a quién, en qué orden y qué hacer cuando el
 * servicio push dice que esa suscripción ya no existe.
 *
 * Nada de esto puede tumbar la operación que lo dispara. Un aviso push es un
 * extra: si VAPID no está configurado, si el servicio push está caído o si la
 * red corta, la notificación in-app ya está escrita y el usuario la verá al
 * abrir la app. Por eso `enviarPushAUsuarios` no lanza nunca.
 */

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface PushResumen {
  enviados: number;
  eliminados: number;
  fallidos: number;
  /** VAPID no está configurado: no se intentó nada. */
  omitido: boolean;
}

/* Un servicio push que tarda más de esto no va a entregar el aviso a tiempo y
   deja colgada la función. */
const TIMEOUT_ENVIO_MS = 8000;

/* 20 en paralelo: suficiente para que un envío masivo avance y lejos del límite
   de conexiones que abriría un `Promise.all` sobre miles de suscripciones. */
const CONCURRENCIA = 20;

/* Postgres corta en 65 535 parámetros; con 500 ids por consulta hay margen de
   sobra y el envío no necesita traer todas las suscripciones de golpe. */
const USUARIOS_POR_LOTE = 500;

const TTL_SEGUNDOS = 24 * 60 * 60;

/* Fallos temporales seguidos tras los que se da la suscripción por muerta. Un
   dispositivo reinstalado, o un endpoint que el servicio rechaza siempre, deja
   de sumar sin llegar nunca a un 404; sin este tope la fila se queda para
   siempre. `lastSuccessAt` la resetea en cuanto un envío entra. */
const LIMITE_FALLOS = 8;

/* Opciones de cada envío.

   Van en un objeto propio y no en el literal de la llamada a propósito: las
   definiciones de `web-push` instaladas no declaran `timeout`, pero el runtime
   sí lo lee y destruye el socket al vencer (3.6.7, `web-push-lib.js`). Pasando
   una constante no salta el chequeo de propiedades sobrantes de los literales y
   el campo llega igual. Sin ese corte, un servicio push que no responde deja la
   función colgada hasta el límite de la plataforma. */
const OPCIONES_ENVIO = {
  TTL: TTL_SEGUNDOS,
  urgency: "normal",
  timeout: TIMEOUT_ENVIO_MS,
} as const;

let configurado: boolean | null = null;

/**
 * La clave pública que corresponde a una privada VAPID.
 *
 * Las dos forman un par P-256: la pública se puede recalcular desde la privada
 * y con eso el envío deja de depender de `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Esa
 * variable se incrusta en el bundle en tiempo de build, así que un contenedor
 * construido sin el `--build-arg` la tiene vacía aunque el runtime la reciba;
 * con la derivación basta `VAPID_PRIVATE_KEY` en el entorno. Devuelve `null` si
 * la privada no tiene la forma de una clave P-256.
 */
function clavePublicaDe(privada: string): string | null {
  try {
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(Buffer.from(privada, "base64url"));
    return ecdh.getPublicKey().toString("base64url");
  } catch {
    return null;
  }
}

/**
 * Configura VAPID una sola vez por proceso.
 *
 * Solo hacen falta `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT`: la pública se toma de
 * `VAPID_PUBLIC_KEY` si está —útil para fijarla a mano— o se deriva de la
 * privada. Nunca se imprime el valor de ninguna: como mucho, el nombre de la
 * que falta.
 */
function configurarVapid(): boolean {
  if (configurado !== null) return configurado;

  const privada = process.env.VAPID_PRIVATE_KEY?.trim();
  const asunto = process.env.VAPID_SUBJECT?.trim();

  if (!privada || !asunto) {
    const faltan = [
      !privada && "VAPID_PRIVATE_KEY",
      !asunto && "VAPID_SUBJECT",
    ].filter(Boolean);
    console.warn(`[push] Sin configurar: faltan ${faltan.join(", ")}. No se envían avisos push.`);
    configurado = false;
    return false;
  }

  const declarada = (
    process.env.VAPID_PUBLIC_KEY ??
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
    ""
  ).trim();
  const publica = declarada || clavePublicaDe(privada);

  if (!publica) {
    console.warn(
      "[push] VAPID_PRIVATE_KEY no es una clave P-256 válida. No se envían avisos push.",
    );
    configurado = false;
    return false;
  }

  /* Si la clave que se incrustó en el bundle no es la del par que firma, las
     suscripciones guardadas se crearon con otra y el servicio push contestará
     403 en cada envío. Se avisa una vez para que el motivo quede en el log. */
  if (declarada && clavePublicaDe(privada) !== declarada) {
    console.warn(
      "[push] La clave pública configurada no corresponde a VAPID_PRIVATE_KEY. Revisa las dos.",
    );
  }

  try {
    webpush.setVapidDetails(asunto, publica, privada);
    configurado = true;
  } catch {
    /* Claves con forma inválida: se apaga el envío en vez de fallar en cada
       notificación. El mensaje no incluye la clave. */
    console.warn("[push] Las claves VAPID no son válidas. No se envían avisos push.");
    configurado = false;
  }

  return configurado;
}

/**
 * ¿Puede este proceso firmar envíos? Lo consulta el alta de suscripciones para
 * no dar por activo un dispositivo que el servidor no va a poder avisar.
 */
export function vapidConfigurado(): boolean {
  return configurarVapid();
}

function statusDe(error: unknown): number | undefined {
  const status = (error as { statusCode?: unknown })?.statusCode;
  return typeof status === "number" ? status : undefined;
}

/**
 * Manda el mismo aviso a todos los dispositivos de los usuarios indicados.
 *
 * Los usuarios sin suscripción simplemente no aparecen. Si el servicio push
 * responde 404 o 410, la fila se borra: ese endpoint ya no existe y volver a
 * intentarlo en el siguiente envío solo gastaría peticiones. Un 429 o un 5xx
 * es temporal, así que se cuenta en `failureCount` y la suscripción se queda.
 */
export async function enviarPushAUsuarios(
  userIds: string[],
  payload: PushPayload,
): Promise<PushResumen> {
  const resumen: PushResumen = { enviados: 0, eliminados: 0, fallidos: 0, omitido: false };

  if (userIds.length === 0) return resumen;
  if (!configurarVapid()) {
    resumen.omitido = true;
    return resumen;
  }

  const cuerpo = JSON.stringify({
    title: recortarTexto(payload.title, MAX_TITULO_PUSH),
    body: recortarTexto(payload.body, MAX_CUERPO_PUSH),
    url: payload.url ?? "/notifications",
    tag: payload.tag ?? "la-verde",
  });

  let pendientes = 0;

  const enviarUna = async (fila: {
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }): Promise<void> => {
    try {
      await webpush.sendNotification(
        {
          endpoint: fila.endpoint,
          keys: { p256dh: fila.p256dh, auth: fila.auth },
        },
        cuerpo,
        OPCIONES_ENVIO,
      );

      resumen.enviados += 1;
      await db
        .update(pushSubscriptions)
        .set({ lastSuccessAt: new Date(), failureCount: 0 })
        .where(sql`${pushSubscriptions.id} = ${fila.id}`);
    } catch (error) {
      const status = statusDe(error);

      if (status === 404 || status === 410) {
        resumen.eliminados += 1;
        try {
          await db
            .delete(pushSubscriptions)
            .where(sql`${pushSubscriptions.id} = ${fila.id}`);
        } catch {
          // La suscripción caducó igual; se borrará en el próximo envío.
        }
        return;
      }

      resumen.fallidos += 1;

      if (status === 429 || (status !== undefined && status >= 500)) {
        try {
          /* El contador sirve además para podar: una suscripción que falla
             ocho veces seguidas ya no va a entregar nada. Se lee el valor
             nuevo en la misma escritura para no sumar una consulta extra. */
          const [actualizada] = await db
            .update(pushSubscriptions)
            .set({ failureCount: sql`${pushSubscriptions.failureCount} + 1` })
            .where(sql`${pushSubscriptions.id} = ${fila.id}`)
            .returning({ fallos: pushSubscriptions.failureCount });

          if (actualizada && actualizada.fallos >= LIMITE_FALLOS) {
            await db
              .delete(pushSubscriptions)
              .where(sql`${pushSubscriptions.id} = ${fila.id}`);
          }
        } catch {
          // El contador es diagnóstico: no puede tumbar el resto del envío.
        }
      }
    }
  };

  for (let i = 0; i < userIds.length; i += USUARIOS_POR_LOTE) {
    const lote = userIds.slice(i, i + USUARIOS_POR_LOTE);

    let filas: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>;
    try {
      filas = await db
        .select({
          id: pushSubscriptions.id,
          endpoint: pushSubscriptions.endpoint,
          p256dh: pushSubscriptions.p256dh,
          auth: pushSubscriptions.auth,
        })
        .from(pushSubscriptions)
        .where(inArray(pushSubscriptions.userId, lote));
    } catch (error) {
      /* Si la tabla aún no existe (migración pendiente) o la base no responde,
         el aviso in-app sigue valiendo: se registra y se corta el push. */
      console.warn(
        "[push] No se pudieron leer las suscripciones:",
        error instanceof Error ? error.message : "error desconocido",
      );
      break;
    }

    pendientes += filas.length;

    /* Cola con concurrencia fija: se lanzan `CONCURRENCIA` envíos y cada uno
       toma el siguiente al terminar. Un `Promise.all` sobre todas las filas
       abriría tantas conexiones como dispositivos haya. */
    let siguiente = 0;
    const trabajadores = Array.from(
      { length: Math.min(CONCURRENCIA, filas.length) },
      async () => {
        while (siguiente < filas.length) {
          const fila = filas[siguiente];
          siguiente += 1;
          if (fila) await enviarUna(fila);
        }
      },
    );
    await Promise.all(trabajadores);
  }

  if (pendientes > 0) {
    console.info(
      `[push] ${resumen.enviados}/${pendientes} enviados, ${resumen.eliminados} suscripciones caducadas, ${resumen.fallidos} fallidos.`,
    );
  }

  return resumen;
}
