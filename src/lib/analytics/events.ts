import { after } from "next/server";
import { db } from "@/lib/db";
import { analyticsEvents } from "@/lib/db/schema";
import {
  MAX_QUERY,
  MAX_SHORT,
  clean,
  cleanCount,
  cleanMetadata,
} from "@/lib/analytics/sanitize";
import { generateId } from "@/lib/utils";

/**
 * Sistema interno de eventos.
 *
 * Engancha con el producto en el punto donde el gesto ya ocurrió y **nunca**
 * puede tumbarlo (`§2`, `§7`): el registro va después de la respuesta, con
 * `after()` de Next, y cualquier fallo se traga con un log de una línea.
 *
 * Dos reglas que se ven en la firma:
 *
 * - **Todo es opcional menos `type`.** Un evento sin usuario o sin negocio es
 *   normal —el tráfico anónimo es la mayoría—; obligar a rellenarlos llevaría a
 *   inventar valores.
 * - **Los campos son columnas, no un jsonb.** `metadata` existe para casos
 *   puntuales, no como cajón de sastre: lo que se consulta tiene columna e
 *   índice.
 */

/** Los eventos que el sistema conoce. Cualquier otro string se rechaza. */
export type AnalyticsEventType =
  /* Usuarios */
  | "user_registered"
  | "user_login"
  /* Búsqueda */
  | "search_performed"
  | "search_results_shown"
  | "search_no_results"
  /* Negocios: descubrimiento */
  | "business_viewed"
  | "business_impression"
  | "business_contact_clicked"
  | "business_whatsapp_clicked"
  | "business_phone_clicked"
  | "business_map_clicked"
  | "business_website_clicked"
  | "business_social_clicked"
  /* Registro de negocios */
  | "business_registration_started"
  | "business_registration_completed"
  | "business_approved"
  | "business_rejected"
  /* Otras funciones que ya existen */
  | "place_saved"
  | "review_created";
/* Fuera de catálogo: eventos que vienen del cliente y aún no tienen tipo
     propio se descartan, no se guardan como «otros». */

/** Conjunto para validar en tiempo de ejecución lo que llega por HTTP. */
export const ANALYTICS_EVENT_TYPES: readonly AnalyticsEventType[] = [
  "user_registered",
  "user_login",
  "search_performed",
  "search_results_shown",
  "search_no_results",
  "business_viewed",
  "business_impression",
  "business_contact_clicked",
  "business_whatsapp_clicked",
  "business_phone_clicked",
  "business_map_clicked",
  "business_website_clicked",
  "business_social_clicked",
  "business_registration_started",
  "business_registration_completed",
  "business_approved",
  "business_rejected",
  "place_saved",
  "review_created",
];

export interface TrackedEvent {
  type: AnalyticsEventType;
  userId?: string | null;
  sessionId?: string | null;
  businessId?: string | null;
  searchQuery?: string | null;
  categoryId?: string | null;
  province?: string | null;
  municipality?: string | null;
  resultCount?: number | null;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  referrer?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Idempotencia opcional (`§43`). Misma clave = una sola fila. */
  dedupeKey?: string | null;
}

/**
 * Inserta el evento. Nunca propaga: si la base no contesta, se pierde el evento
 * y se anota una línea. Un fallo de analytics no es un fallo de producto.
 */
async function recordEvent(event: TrackedEvent): Promise<void> {
  try {
    await db
      .insert(analyticsEvents)
      .values({
        id: generateId(),
        eventType: event.type,
        userId: clean(event.userId, 64),
        sessionId: clean(event.sessionId, 64),
        businessId: clean(event.businessId, 64),
        searchQuery: clean(event.searchQuery, MAX_QUERY),
        categoryId: clean(event.categoryId, 64),
        province: clean(event.province, MAX_SHORT),
        municipality: clean(event.municipality, MAX_SHORT),
        resultCount: cleanCount(event.resultCount),
        source: clean(event.source, MAX_SHORT),
        medium: clean(event.medium, MAX_SHORT),
        campaign: clean(event.campaign, MAX_SHORT),
        referrer: clean(event.referrer, MAX_SHORT),
        metadata: cleanMetadata(event.metadata),
        dedupeKey: clean(event.dedupeKey, MAX_SHORT),
      })
      /* `target` en la clave de idempotencia: repetir la misma escritura no
         suma. Con `dedupe_key` a `null` Postgres no ve conflicto —los `null` no
         se comparan—, que es el caso normal. */
      .onConflictDoNothing({ target: analyticsEvents.dedupeKey });
  } catch (error) {
    console.error(
      "[analytics] no se pudo registrar el evento:",
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Registra un evento **después** de responder. No devuelve nada y no se espera:
 * se llama sin `await` en la ruta.
 *
 * Usa `after()` para que el trabajo corra una vez enviada la respuesta —el
 * usuario no paga la escritura— y para que la plataforma no mate la promesa al
 * terminar el handler. Si se llama fuera de una petición (un script), `after()`
 * lanza: en ese caso se registra en el momento, que es lo correcto ahí.
 */
export function trackEvent(event: TrackedEvent): void {
  if (!process.env.DATABASE_URL) return;
  try {
    after(() => recordEvent(event));
  } catch {
    void recordEvent(event);
  }
}

/** La misma escritura, esperable. Para la limpieza y la agregación. */
export { recordEvent };
