import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { canManagePlace } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { invalidarCatalogo } from "@/lib/db/queries";
import { reviews } from "@/lib/db/schema";

type Params = { params: Promise<{ id: string }> };

const MAX_RESPUESTA = 500;

/**
 * Respuesta del negocio a una reseña.
 *
 * Solo el dueño o un administrador pueden responder (`ficha`). Una reseña
 * admite una sola respuesta; un segundo `PATCH` la sustituye. `null` o cadena
 * vacía la quita.
 *
 * Body: `{ placeId: string; respuesta: string | null }`
 * `placeId` hace falta porque esta ruta no tiene el id del negocio en el path
 * —la reseña lo tiene, pero hay que comprobarlo contra el token de sesión.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: reviewId } = await params;

  let body: { placeId?: unknown; respuesta?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const placeId = typeof body.placeId === "string" ? body.placeId : null;
  if (!placeId) {
    return NextResponse.json({ error: "Falta placeId" }, { status: 400 });
  }

  if (!(await canManagePlace(req, placeId, "ficha"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const respuesta =
    body.respuesta === null || body.respuesta === ""
      ? null
      : typeof body.respuesta === "string"
        ? body.respuesta.trim().slice(0, MAX_RESPUESTA)
        : undefined;

  if (respuesta === undefined) {
    return NextResponse.json(
      { error: "La respuesta tiene que ser texto o null." },
      { status: 400 },
    );
  }

  const [row] = await db
    .update(reviews)
    .set({
      respuesta,
      respondidaEn: respuesta ? new Date() : null,
    })
    .where(and(eq(reviews.id, reviewId), eq(reviews.placeId, placeId)))
    .returning();

  if (!row) {
    return NextResponse.json({ error: "Reseña no encontrada" }, { status: 404 });
  }

  invalidarCatalogo();

  return NextResponse.json({ id: row.id, respuesta: row.respuesta });
}
