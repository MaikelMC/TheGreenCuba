import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { categories, places, savedPlaces } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";

export async function GET() {
  const user = await getAppUser();

  if (!user) {
    return NextResponse.json({ authenticated: false, saved: [] }, { status: 401 });
  }

  const rows = await db
    .select({
      placeId: savedPlaces.placeId,
      name: places.name,
      category: categories.name,
      savedAt: savedPlaces.createdAt,
    })
    .from(savedPlaces)
    .innerJoin(places, eq(savedPlaces.placeId, places.id))
    .leftJoin(categories, eq(places.categoryId, categories.id))
    .where(eq(savedPlaces.userId, user.id))
    .orderBy(desc(savedPlaces.createdAt));

  return NextResponse.json({
    authenticated: true,
    saved: rows.map((row) => ({
      placeId: row.placeId,
      name: row.name,
      category: row.category ?? "Otro",
      savedAt: row.savedAt?.toISOString() ?? null,
    })),
  });
}

/**
 * Guarda uno o varios lugares.
 *
 * Acepta `placeId` y `placeIds` porque el corazón del home guarda de uno en uno
 * y la migración de los favoritos que ya estaban en el navegador sube varios de
 * golpe. Los ids que no existen se descartan: la clave foránea no puede
 * tumbar el guardado de los demás.
 */
export async function POST(request: NextRequest) {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  let payload: { placeId?: unknown; placeIds?: unknown } = {};
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    payload = {};
  }

  const candidatos = [
    ...(Array.isArray(payload.placeIds) ? payload.placeIds : []),
    payload.placeId,
  ].filter(
    (valor): valor is string =>
      typeof valor === "string" && valor.trim().length > 0,
  );
  const ids = [...new Set(candidatos.map((id) => id.trim()))].slice(0, 100);

  if (ids.length === 0) {
    return NextResponse.json({ error: "Falta el lugar." }, { status: 400 });
  }

  const existentes = await db
    .select({ id: places.id })
    .from(places)
    .where(inArray(places.id, ids));
  const validos = existentes.map((fila) => fila.id);

  if (validos.length > 0) {
    await db
      .insert(savedPlaces)
      .values(
        validos.map((placeId) => ({
          id: generateId(),
          userId: user.id,
          placeId,
        })),
      )
      .onConflictDoNothing();
  }

  return NextResponse.json({ ok: true, placeIds: validos });
}

/** Quita un lugar de los guardados. Idempotente. */
export async function DELETE(request: NextRequest) {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  let payload: { placeId?: unknown } = {};
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    payload = {};
  }

  const placeId =
    typeof payload.placeId === "string" ? payload.placeId.trim() : "";
  if (!placeId) {
    return NextResponse.json({ error: "Falta el lugar." }, { status: 400 });
  }

  await db
    .delete(savedPlaces)
    .where(
      and(eq(savedPlaces.userId, user.id), eq(savedPlaces.placeId, placeId)),
    );

  return NextResponse.json({ ok: true });
}
