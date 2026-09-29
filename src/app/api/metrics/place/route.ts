import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { placeMetrics } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";

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

  try {
    await db
      .insert(placeMetrics)
      .values({ id: generateId(), placeId })
      .onConflictDoUpdate({
        target: placeMetrics.placeId,
        set: { [column.name]: sql`${column} + 1` },
      });
  } catch (error) {
    /* Métrica perdida, no página rota: el visitante no debe enterarse. Un
       `placeId` que ya no existe (negocio borrado) cae aquí y se ignora. */
    console.error("[metrics] No se pudo registrar el evento:", error instanceof Error ? error.message : error);
  }

  return NextResponse.json({ ok: true });
}
