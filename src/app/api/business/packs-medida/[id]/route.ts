import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { accesoNegocio } from "@/lib/admin-server";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { packsMedida } from "@/lib/db/schema";

/**
 * PATCH — el dueño cancela un pack que aún no se pagó.
 *
 * Solo se permite sobre packs en estado solicitado, borrador o enviado.
 * Un pack pagado no se cancela desde aquí.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  /* Leer la fila primero para saber a qué negocio pertenece. */
  const [pack] = await db
    .select({ negocioId: packsMedida.negocioId, estado: packsMedida.estado })
    .from(packsMedida)
    .where(eq(packsMedida.id, id))
    .limit(1);

  if (!pack) return NextResponse.json({ error: "Pack no encontrado." }, { status: 404 });

  const acceso = await accesoNegocio(user, pack.negocioId);
  if (!acceso) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!acceso.esDueno) {
    return NextResponse.json(
      { error: "Solo el dueño puede cancelar el pack." },
      { status: 403 },
    );
  }

  const CANCELABLES = new Set(["solicitado", "borrador", "enviado"]);
  if (!CANCELABLES.has(pack.estado)) {
    return NextResponse.json(
      { error: "Este pack no se puede cancelar en su estado actual." },
      { status: 409 },
    );
  }

  await db
    .update(packsMedida)
    .set({ estado: "cancelado", actualizadoEn: new Date() })
    .where(and(eq(packsMedida.id, id), eq(packsMedida.negocioId, pack.negocioId)));

  return NextResponse.json({ ok: true });
}
