import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { ACCION, registrarActividad } from "@/lib/admin-actividad";
import { cargarFicha360 } from "@/lib/admin-ficha";
import { isAdminRequest } from "@/lib/admin-server";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { notasNegocio, places } from "@/lib/db/schema";

/**
 * La ficha 360 de un negocio.
 *
 * Solo administración, por sesión o `x-admin-key`. El `GET` trae todo lo que
 * pinta el panel; el `PATCH` guarda la nota interna, que es lo único editable
 * desde aquí. El plan y el destacado se cambian por sus rutas de siempre, para
 * que cada cambio tenga su validación y su entrada de actividad.
 */

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const ficha = await cargarFicha360(id);
  if (!ficha) {
    return NextResponse.json(
      { error: "Negocio no encontrado." },
      { status: 404 },
    );
  }

  return NextResponse.json(ficha, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    nota?: unknown;
  } | null;

  if (!body || typeof body.nota !== "string") {
    return NextResponse.json(
      { error: "La nota no tiene el formato esperado." },
      { status: 400 },
    );
  }

  const nota = body.nota.trim();
  if (nota.length > 4000) {
    return NextResponse.json(
      { error: "La nota no puede pasar de 4000 caracteres." },
      { status: 400 },
    );
  }

  const [negocio] = await db
    .select({ name: places.name })
    .from(places)
    .where(eq(places.id, id))
    .limit(1);
  if (!negocio) {
    return NextResponse.json(
      { error: "Negocio no encontrado." },
      { status: 404 },
    );
  }

  const usuario = await getAppUser();
  const [guardada] = await db
    .insert(notasNegocio)
    .values({
      placeId: id,
      nota,
      actualizadoPor: usuario?.id ?? null,
      actualizadoEn: new Date(),
    })
    .onConflictDoUpdate({
      target: notasNegocio.placeId,
      set: {
        nota,
        actualizadoPor: usuario?.id ?? null,
        actualizadoEn: new Date(),
      },
    })
    .returning({
      nota: notasNegocio.nota,
      actualizadoEn: notasNegocio.actualizadoEn,
    });

  await registrarActividad({
    accion: ACCION.notaNegocio,
    objetoTipo: "negocio",
    objetoId: id,
    resumen: `Guardó una nota interna de «${negocio.name}»`,
    datos: { longitud: nota.length },
  });

  return NextResponse.json({
    nota: guardada?.nota ?? nota,
    actualizadoEn: guardada?.actualizadoEn.toISOString() ?? null,
  });
}
