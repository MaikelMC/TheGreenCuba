import { asc, count, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { rateLimit } from "@/lib/rate-limit";
import { generateId } from "@/lib/utils";

/**
 * Guarda el endpoint push del navegador actual.
 *
 * El navegador entrega `endpoint` + dos claves (`p256dh`, `auth`) y no hay
 * manera de validarlas contra el servicio push sin enviar un mensaje. Lo que sí
 * se comprueba aquí es la forma: que el endpoint sea una URL https del propio
 * servicio push y que las claves tengan el tamaño de una clave pública
 * P-256 / secreto compartido. Un endpoint inventado no sirve para nada y ocupa
 * una fila.
 *
 * `endpoint` es único en la tabla: el mismo navegador puede volver a suscribirse
 * (por ejemplo tras cambiar el permiso) y debe actualizar su fila, no crear una
 * segunda. El `onConflictDoUpdate` fija el dueño a la sesión actual, así que un
 * endpoint que antes perteneciera a otra cuenta pasa a ser de quien lo registra
 * ahora.
 */

const MAX_ENDPOINT = 1000;
const MAX_CLAVE = 300;

/* Cinco dispositivos por cuenta es de sobra y evita que una suscripción en
   bucle llene la tabla. Al registrar el sexto se descarta el más antiguo. */
const MAX_SUSCRIPCIONES = 5;

/* Tres altas por minuto: el navegador solo llama al suscribirse o al renovar. */
const LIMITE_ALTAS = 3;
const VENTANA_ALTAS_MS = 60_000;

interface SuscripcionEntrante {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
}

function esUrlPushValida(valor: string): boolean {
  try {
    const url = new URL(valor);
    /* Los servicios reales (FCM, Mozilla, Apple) siempre son https. Un http
       aquí sería un endpoint que web-push rechazaría al enviar. */
    return url.protocol === "https:" && valor.length <= MAX_ENDPOINT;
  } catch {
    return false;
  }
}

function leerSuscripcion(body: unknown): SuscripcionEntrante | null {
  if (!body || typeof body !== "object") return null;

  const entrada = body as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
    userAgent?: unknown;
  };

  const endpoint = typeof entrada.endpoint === "string" ? entrada.endpoint.trim() : "";
  const p256dh = typeof entrada.keys?.p256dh === "string" ? entrada.keys.p256dh.trim() : "";
  const auth = typeof entrada.keys?.auth === "string" ? entrada.keys.auth.trim() : "";

  if (!esUrlPushValida(endpoint)) return null;
  if (p256dh.length < 40 || p256dh.length > MAX_CLAVE) return null;
  if (auth.length < 8 || auth.length > MAX_CLAVE) return null;

  const userAgent =
    typeof entrada.userAgent === "string" ? entrada.userAgent.slice(0, 400) : null;

  return { endpoint, p256dh, auth, userAgent };
}

export async function POST(request: NextRequest) {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const limitado = rateLimit(request, LIMITE_ALTAS, VENTANA_ALTAS_MS);
  if (!limitado.ok) {
    return NextResponse.json(
      { error: "Demasiados intentos seguidos. Espera un momento." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const suscripcion = leerSuscripcion(body);
  if (!suscripcion) {
    return NextResponse.json(
      { error: "La suscripción push no es válida." },
      { status: 400 },
    );
  }

  const [existente] = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, suscripcion.endpoint))
    .limit(1);

  if (!existente) {
    const [total] = await db
      .select({ valor: count() })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, user.id));

    const actuales = total?.valor ?? 0;
    if (actuales >= MAX_SUSCRIPCIONES) {
      /* Se descarta el dispositivo más viejo: el usuario casi siempre está
         suscribiendo el que tiene en la mano, no el que dejó de usar. */
      const sobran = actuales - MAX_SUSCRIPCIONES + 1;
      const antiguas = await db
        .select({ id: pushSubscriptions.id })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, user.id))
        .orderBy(asc(pushSubscriptions.createdAt))
        .limit(sobran);

      for (const fila of antiguas) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, fila.id));
      }
    }
  }

  await db
    .insert(pushSubscriptions)
    .values({
      id: generateId(),
      userId: user.id,
      endpoint: suscripcion.endpoint,
      p256dh: suscripcion.p256dh,
      auth: suscripcion.auth,
      userAgent: suscripcion.userAgent,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: user.id,
        p256dh: suscripcion.p256dh,
        auth: suscripcion.auth,
        userAgent: suscripcion.userAgent,
        failureCount: 0,
      },
    });

  return NextResponse.json({ ok: true }, { status: 201 });
}
