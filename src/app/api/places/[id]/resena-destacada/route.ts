import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { canManagePlace } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { invalidarCatalogo } from "@/lib/db/queries";
import { places, reviews } from "@/lib/db/schema";

type Params = { params: Promise<{ id: string }> };

/**
 * Reseña destacada del negocio.
 *
 * `POST` con `{ reviewId: string | null }`:
 *   - `string`: valida que la reseña pertenece al negocio y la guarda.
 *   - `null` o ausente: quita la destacada.
 *
 * Solo el dueño o administración pueden elegirla.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  if (!(await canManagePlace(req, id, "ficha"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { reviewId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const reviewId =
    body.reviewId === null || body.reviewId === undefined
      ? null
      : typeof body.reviewId === "string"
        ? body.reviewId
        : undefined;

  if (reviewId === undefined) {
    return NextResponse.json(
      { error: "reviewId tiene que ser un string o null." },
      { status: 400 },
    );
  }

  if (reviewId !== null) {
    /* Verifica que la reseña pertenece a este negocio. */
    const [review] = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(eq(reviews.id, reviewId), eq(reviews.placeId, id)))
      .limit(1);

    if (!review) {
      return NextResponse.json(
        { error: "La reseña no pertenece a este negocio." },
        { status: 404 },
      );
    }
  }

  await db
    .update(places)
    .set({ resenaDestacadaId: reviewId })
    .where(eq(places.id, id));

  invalidarCatalogo();

  return NextResponse.json({ resenaDestacadaId: reviewId });
}
