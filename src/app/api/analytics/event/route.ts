import { NextRequest, NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth/user";
import {
  ANALYTICS_EVENT_TYPES,
  trackEvent,
  type AnalyticsEventType,
} from "@/lib/analytics/events";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Eventos que **solo** puede emitir el navegador.
 *
 * La lista es una lista blanca por una razón: esta ruta es pública —la llaman
 * visitantes sin sesión, como la de métricas— y sin filtro cualquiera podría
 * inventar un `business_approved` y ensuciar las decisiones del panel. Lo que
 * se puede deducir en el servidor (una búsqueda, un alta, una aprobación) se
 * registra allí y no se acepta por aquí.
 */
const CLIENT_ALLOWED = new Set<AnalyticsEventType>([
  "user_login",
  "business_viewed",
  "business_impression",
  "business_contact_clicked",
  "business_whatsapp_clicked",
  "business_phone_clicked",
  "business_map_clicked",
  "business_website_clicked",
  "business_social_clicked",
  "business_registration_started",
  "place_saved",
]);

const LIMIT = 60;
const WINDOW_MS = 60 * 1000;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, LIMIT, WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds ?? 60) },
      },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const type =
    typeof body.type === "string" ? (body.type as AnalyticsEventType) : null;
  if (
    !type ||
    !ANALYTICS_EVENT_TYPES.includes(type) ||
    !CLIENT_ALLOWED.has(type)
  ) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  /* El usuario se resuelve en el servidor y **no** se acepta del cuerpo: si el
     cliente pudiera decir quién es, las métricas por usuario serían papel
     mojado. Sin sesión el evento va anónimo, que es lo normal. */
  const user = await getAppUser().catch(() => null);
  const text = (value: unknown): string | null =>
    typeof value === "string" && value.trim() ? value.trim() : null;

  trackEvent({
    type,
    userId: user?.id ?? null,
    sessionId: text(body.sessionId),
    businessId: text(body.businessId),
    metadata:
      body.metadata && typeof body.metadata === "object"
        ? (body.metadata as Record<string, unknown>)
        : null,
  });

  /* 204 y sin cuerpo: el cliente no espera nada, es fuego y olvido. */
  return new NextResponse(null, { status: 204 });
}
