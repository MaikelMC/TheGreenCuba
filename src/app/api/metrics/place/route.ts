import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { trackEvent, type AnalyticsEventType } from "@/lib/analytics/events";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { placeMetrics, places } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";
import { cookies } from "next/headers";

/**
 * Registro de métricas de negocio desde el cliente.
 *
 * Es público a propósito: lo llaman visitantes sin sesión al abrir una ficha o
 * tocar un pin, y pedirles autenticación dejaría fuera a casi todo el tráfico.
 * El riesgo —que alguien infle los contadores a mano— existe y se acepta:
 * son rankings de panel, no pagos. La validación se limita a que el `kind`
 * exista y el cuerpo sea razonable.
 *
 * La fila se crea al primer evento con `onConflictDoUpdate`: `place_id` es
 * único y el contador se incrementa en SQL (`views + 1`), no en JavaScript,
 * para que dos peticiones simultáneas no se pisen.
 */

/** `kind` del cliente → columna de `place_metrics`. */
const KINDS: Record<string, PgColumn> = {
  view: placeMetrics.views,
  map_click: placeMetrics.mapClicks,
  route: placeMetrics.routeRequests,
  ai_match: placeMetrics.aiMatches,
  save: placeMetrics.saves,
  share: placeMetrics.shares,
};

/**
 * El mismo gesto, traducido al vocabulario de eventos internos.
 *
 * `share` no tiene equivalente a propósito: compartir no es una acción sobre el
 * negocio que el panel necesite medir. `route` y `map_click` son los dos «cómo
 * llegar» y caen en el mismo tipo — separarlos pedía dos eventos que el
 * dashboard nunca distinguiría.
 */
const EVENT_BY_KIND: Record<string, AnalyticsEventType> = {
  view: "business_viewed",
  map_click: "business_map_clicked",
  route: "business_map_clicked",
  ai_match: "business_impression",
  save: "place_saved",
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    placeId?: unknown;
    kind?: unknown;
  } | null;

  const placeId = typeof body?.placeId === "string" ? body.placeId.trim() : "";
  if (!placeId || placeId.length > 64) {
    return NextResponse.json({ error: "placeId inválido" }, { status: 400 });
  }
  const column = typeof body?.kind === "string" ? KINDS[body.kind] : undefined;
  if (!column) {
    return NextResponse.json({ error: "kind inválido" }, { status: 400 });
  }

  // Get province and categoryId for the place
  const placeData = await db
    .select({ province: places.province, categoryId: places.categoryId })
    .from(places)
    .where(sql`${places.id} = ${placeId}`)
    .limit(1);

  const province = placeData[0]?.province ?? "";
  const categoryId = placeData[0]?.categoryId ?? "";

  try {
    await db
      .insert(placeMetrics)
      .values({
        id: generateId(),
        placeId,
        province,
        categoryId,
      })
      .onConflictDoUpdate({
        target: placeMetrics.placeId,
        set: {
          [column.name]: sql`${column} + 1`,
          province: province, // Ensure province is updated (though it shouldn't change)
          categoryId: categoryId, // Ensure categoryId is updated (though it shouldn't change)
        },
      });
  } catch (error) {
    /* Métrica perdida, no página rota: el visitante no debe enterarse. Un
       `placeId` que ya no existe (negocio borrado) cae aquí y se ignora. */
    console.error(
      "[metrics] No se pudo registrar el evento:",
      error instanceof Error ? error.message : error,
    );
  }

  /* El mismo gesto alimenta el evento interno, sin una petición extra: esta
     ruta ya la llama el cliente. El usuario se resuelve aquí, no se acepta del
     cuerpo. */
  const internalType =
    typeof body?.kind === "string" ? EVENT_BY_KIND[body.kind] : undefined;
  if (internalType) {
    const user = await getAppUser().catch(() => null);

    // Read UTM parameters from cookie
    const cookieStore = await cookies();
    const utmCookie = cookieStore.get("lv_utm");
    let utmParams = { utm_source: null, utm_medium: null, utm_campaign: null };
    if (utmCookie) {
      try {
        // The cookie value is expected to be a JSON string with UTM parameters
        const parsed = JSON.parse(utmCookie.value);
        utmParams = {
          utm_source: parsed.utm_source ?? null,
          utm_medium: parsed.utm_medium ?? null,
          utm_campaign: parsed.utm_campaign ?? null,
        };
      } catch (e) {
        console.warn("[metrics] Failed to parse UTM cookie:", e);
        utmParams = { utm_source: null, utm_medium: null, utm_campaign: null };
      }
    }

    trackEvent({
      type: internalType,
      userId: user?.id ?? null,
      businessId: placeId,
      source: utmParams.utm_source,
      medium: utmParams.utm_medium,
      campaign: utmParams.utm_campaign,
    });
  }

  return NextResponse.json({ ok: true });
}
