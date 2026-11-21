import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { canManagePlace } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { pedidos } from "@/lib/db/schema";
import { DEV_PLACE_ID } from "@/lib/dev-place";

/**
 * Cuántos pedidos esperan y cuál es el último que entró.
 *
 * Lo pregunta el armazón del panel cada minuto, esté donde esté el dueño, para
 * el contador del dock y del título y para sonar cuando entra uno. Por eso es
 * **ligero**: dos números y un id, unos pocos bytes. La lista entera
 * (`GET /api/pedidos`) se sigue pidiendo solo dentro de Pedidos: bajarla cada
 * minuto en cualquier pantalla se pagaría en datos móviles.
 *
 * El mismo permiso que la lista: `pedidos`.
 */
export async function GET(req: NextRequest) {
  const placeId = (req.nextUrl.searchParams.get("placeId") ?? "").trim().slice(0, 64);
  if (!placeId) {
    return NextResponse.json({ error: "Falta el negocio." }, { status: 400 });
  }
  if (!(await canManagePlace(req, placeId, "pedidos"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (placeId === DEV_PLACE_ID) {
    return NextResponse.json({ pendientes: 0, ultimoId: null });
  }

  const [[conteo], [ultimo]] = await Promise.all([
    db
      .select({ pendientes: sql<number>`count(*)::int` })
      .from(pedidos)
      /* Las dos condiciones en un solo `where`: encadenar dos los reemplaza. */
      .where(and(eq(pedidos.placeId, placeId), eq(pedidos.estado, "nuevo"))),
    db
      .select({ id: pedidos.id })
      .from(pedidos)
      .where(eq(pedidos.placeId, placeId))
      .orderBy(desc(pedidos.createdAt))
      .limit(1),
  ]);

  return NextResponse.json(
    { pendientes: conteo?.pendientes ?? 0, ultimoId: ultimo?.id ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
