import { inArray, sql } from "drizzle-orm";
import webpush from "web-push";

import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";

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

let configurado: boolean | null = null;

/**
 * Configura VAPID una sola vez por proceso.
 *
 * Devuelve `false` si falta alguna variable. Nunca se imprime su valor: como
 * mucho, el nombre de la que falta.
 */
function configurarVapid(): boolean {
  if (configurado !== null) return configurado;

  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privada = process.env.VAPID_PRIVATE_KEY?.trim();
  const asunto = process.env.VAPID_SUBJECT?.trim();

  if (!publica || !privada || !asunto) {
    const faltan = [
      !publica && "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
      !privada && "VAPID_PRIVATE_KEY",
      !asunto && "VAPID_SUBJECT",
    ].filter(Boolean);
    console.warn(`[push] Sin configurar: faltan ${faltan.join(", ")}. No se envían avisos push.`);
    configurado = false;
    return false;
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

function statusDe(error: unknown): number | undefined {
  const status = (error as { statusCode?: unknown })?.statusCode;
  return typeof status === "number" ? status : undefined;
}

function recortar(texto: string, max: number): string {
  return texto.length <= max ? texto : `${texto.slice(0, max - 1).trimEnd()}…`;
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
    title: recortar(payload.title, 120),
    body: recortar(payload.body, 240),
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
        { TTL: TTL_SEGUNDOS, urgency: "normal" },
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
        await db
          .delete(pushSubscriptions)
          .where(sql`${pushSubscriptions.id} = ${fila.id}`);
        return;
      }

      resumen.fallidos += 1;

      if (status === 429 || (status !== undefined && status >= 500)) {
        await db
          .update(pushSubscriptions)
          .set({ failureCount: sql`${pushSubscriptions.failureCount} + 1` })
          .where(sql`${pushSubscriptions.id} = ${fila.id}`);
      }
    }
  };

  for (let i = 0; i < userIds.length; i += USUARIOS_POR_LOTE) {
    const lote = userIds.slice(i, i + USUARIOS_POR_LOTE);
    const filas = await db
      .select({
        id: pushSubscriptions.id,
        endpoint: pushSubscriptions.endpoint,
        p256dh: pushSubscriptions.p256dh,
        auth: pushSubscriptions.auth,
      })
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, lote));

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
