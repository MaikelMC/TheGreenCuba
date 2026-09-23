import { NextRequest, NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { places, reviews, users } from "@/lib/db/schema";
import { rateLimit } from "@/lib/rate-limit";
import { generateId } from "@/lib/utils";

/**
 * Reseñas de un lugar: leerlas y publicar la propia.
 *
 * La tabla `reviews` llevaba desde el principio en el esquema —con su `check`
 * de 1 a 5 y su índice único por persona y lugar— sin que nadie la escribiera:
 * el botón "Reseñas" de la ficha decía "Próximamente" y no había a dónde
 * mandarlas. Esto es ese a dónde.
 *
 * Una reseña por persona y lugar, no un hilo. El índice único lo garantiza y el
 * `onConflictDoUpdate` lo aprovecha: volver a opinar corrige la anterior en vez
 * de apilar una segunda.
 */

/** Tope del comentario. El mismo que el contador del diálogo. */
const MAX_CONTENT = 1000;
const MIN_RATING = 1;
const MAX_RATING = 5;

/** Cuántas reseñas se devuelven de una vez. */
const PAGE_SIZE = 50;

/* Escribir es más caro que leer —una fila, una comprobación de lugar y un
   upsert—, así que lleva un cupo más estrecho. */
const READ_LIMIT = 60;
const WRITE_LIMIT = 10;
const WINDOW_MS = 60 * 1000;

function bad(error: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error }, { status });
}

function tooMany(retryAfterSeconds?: number): NextResponse {
  return NextResponse.json(
    { ok: false, error: "Demasiadas opiniones seguidas. Intenta en un momento." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds ?? 60) },
    },
  );
}

/** El `placeId` viene de la URL o del cuerpo; en los dos sitios es una cadena. */
function readPlaceId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, READ_LIMIT, WINDOW_MS);
  if (!limited.ok) return tooMany(limited.retryAfterSeconds);

  const placeId = readPlaceId(req.nextUrl.searchParams.get("placeId"));
  if (!placeId) return bad("Falta el lugar (placeId).");

  /* La media y el total van en su propia consulta y no sobre las filas de
     abajo: la lista va recortada a `PAGE_SIZE`, así que promediarla daría la
     nota de las últimas cincuenta, no la del lugar. */
  const [stats] = await db
    .select({
      count: sql<number>`count(*)::int`,
      average: sql<number>`coalesce(avg(${reviews.rating}), 0)::float`,
    })
    .from(reviews)
    .where(eq(reviews.placeId, placeId));

  const items = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      content: reviews.content,
      createdAt: reviews.createdAt,
      author: users.name,
    })
    .from(reviews)
    .innerJoin(users, eq(reviews.userId, users.id))
    .where(eq(reviews.placeId, placeId))
    .orderBy(desc(reviews.createdAt))
    .limit(PAGE_SIZE);

  return NextResponse.json({
    ok: true,
    reviews: items,
    count: stats?.count ?? 0,
    average: stats?.average ?? 0,
  });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, WRITE_LIMIT, WINDOW_MS);
  if (!limited.ok) return tooMany(limited.retryAfterSeconds);

  /* La ficha de un lugar es pública —no está en `PROTECTED_PREFIXES`—, así que
     aquí se puede llegar sin sesión. Leer sí, escribir no: una reseña necesita
     autor, y `user_id` es `notNull` con clave foránea. */
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Entra en tu cuenta para opinar." },
      { status: 401 },
    );
  }

  let body: { placeId?: unknown; rating?: unknown; content?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return bad("Cuerpo JSON inválido.");
  }

  const placeId = readPlaceId(body.placeId);
  if (!placeId) return bad("Falta el lugar (placeId).");

  /* El `check` de la tabla ya rechaza un rating fuera de rango, pero eso llega
     como error de Postgres a mitad del INSERT. Mejor un 400 que lo explique.
     `Number.isInteger` descarta además el 4.5, que el `check` aceptaría. */
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < MIN_RATING || rating > MAX_RATING) {
    return bad(
      `La puntuación tiene que ser un número entero entre ${MIN_RATING} y ${MAX_RATING}.`,
    );
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (content.length > MAX_CONTENT) {
    return bad(`El comentario no puede pasar de ${MAX_CONTENT} caracteres.`);
  }

  /* La clave foránea lo rechazaría igual, pero con un error de Postgres que no
     distingue «ese lugar no existe» de «algo se rompió». */
  const [place] = await db
    .select({ id: places.id })
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1);
  if (!place) {
    return NextResponse.json({ ok: false, error: "Ese lugar no existe." }, { status: 404 });
  }

  const values = {
    rating,
    /* Vacío es `null`, no "": el comentario es opcional y la columna lo admite
       nulo. Una cadena vacía obligaría a comprobar las dos cosas al pintarla. */
    content: content === "" ? null : content,
    createdAt: new Date(),
  };

  const [row] = await db
    .insert(reviews)
    .values({ id: generateId(), placeId, userId: user.id, ...values })
    .onConflictDoUpdate({
      target: [reviews.placeId, reviews.userId],
      set: values,
    })
    .returning();

  return NextResponse.json({
    ok: true,
    review: {
      id: row!.id,
      rating: row!.rating,
      content: row!.content,
      createdAt: row!.createdAt,
    },
  });
}
