import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { rateLimit } from "@/lib/rate-limit";
import {
  dejarDeSeguir,
  sigueNegocio,
  seguirNegocio,
} from "@/lib/seguimientos-app-server";

/**
 * El «Avísame» de la app: consulta, alta y baja.
 *
 * La ficha es pública, así que `GET` contesta también a quien no tiene sesión
 * —con `autenticado: false`— en vez de un 401 que el diálogo tendría que
 * traducir. Escribir sí exige cuenta: sin `user_id` no hay a quién avisar.
 *
 * No se comprueba aquí el plan del negocio ni el bot de Telegram. El botón ya
 * solo aparece en fichas que ofrecen avisos (`enlaceSeguidores`), y repetir esa
 * decisión en la ruta la haría divergir con el tiempo.
 */

/* Cinco gestos por minuto: abrir el diálogo consulta una vez y pulsar el
   interruptor, otra. Un bucle no debe poder llenar la tabla. */
const LIMITE = 5;
const VENTANA_MS = 60_000;

const MAX_PLACE_ID = 100;

function leerPlaceId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const valor = (body as { placeId?: unknown }).placeId;
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  if (!limpio || limpio.length > MAX_PLACE_ID) return null;
  return limpio;
}

/** El negocio existe y se puede ver. Seguir una ficha oculta no lleva a nada. */
async function negocioVisible(placeId: string): Promise<boolean> {
  const [fila] = await db
    .select({ id: places.id })
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1);
  return Boolean(fila);
}

export async function GET(req: NextRequest) {
  const user = await getAppUser();
  const placeId = req.nextUrl.searchParams.get("placeId")?.trim() ?? "";

  if (!user || !placeId || placeId.length > MAX_PLACE_ID) {
    return NextResponse.json({
      autenticado: Boolean(user),
      siguiendo: false,
    });
  }

  return NextResponse.json({
    autenticado: true,
    siguiendo: await sigueNegocio(user.id, placeId),
  });
}

export async function POST(req: NextRequest) {
  const user = await getAppUser();
  if (!user)
    return NextResponse.json(
      { error: "Inicia sesión para recibir avisos." },
      { status: 401 },
    );

  const limitado = rateLimit(req, LIMITE, VENTANA_MS);
  if (!limitado.ok) {
    return NextResponse.json(
      { error: "Demasiados cambios seguidos. Espera un momento." },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const placeId = leerPlaceId(body);
  if (!placeId)
    return NextResponse.json({ error: "Negocio inválido." }, { status: 400 });
  if (!(await negocioVisible(placeId))) {
    return NextResponse.json(
      { error: "Ese negocio no existe." },
      { status: 404 },
    );
  }

  await seguirNegocio(user.id, placeId);
  return NextResponse.json({ ok: true, siguiendo: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getAppUser();
  if (!user)
    return NextResponse.json(
      { error: "Inicia sesión para gestionar avisos." },
      { status: 401 },
    );

  const body = await req.json().catch(() => null);
  const placeId = leerPlaceId(body);
  if (!placeId)
    return NextResponse.json({ error: "Negocio inválido." }, { status: 400 });

  await dejarDeSeguir(user.id, placeId);
  return NextResponse.json({ ok: true, siguiendo: false });
}
