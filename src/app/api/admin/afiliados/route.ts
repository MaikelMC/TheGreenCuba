import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { ACCION, registrarActividad } from "@/lib/admin-actividad";
import { isAdminRequest } from "@/lib/admin-server";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { afiliadoCobros, afiliadoNotas, afiliadoPremios, users } from "@/lib/db/schema";
import { mesActual } from "@/lib/afiliados";
import { generateId } from "@/lib/utils";

/**
 * Acciones de la administración del programa de afiliados:
 * - `cobro`: marcar un cobro pedido como pagado o rechazado (con nota opcional).
 * - `premio`: dejar constancia de que se entregó el premio del mes.
 * - `nota`: añadir una nota interna sobre un afiliado.
 */
export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const admin = await getAppUser();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const accion = body?.accion;
  const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

  if (accion === "cobro") {
    const id = texto(body?.id, 40);
    const estado = body?.estado === "pagado" || body?.estado === "rechazado" ? body.estado : null;
    if (!id || !estado) return NextResponse.json({ error: "Faltan datos del cobro." }, { status: 400 });
    const hecho = await db
      .update(afiliadoCobros)
      .set({ estado, nota: texto(body?.nota, 300) || null, resueltoPor: admin?.id ?? null, resueltoEn: new Date() })
      .where(and(eq(afiliadoCobros.id, id), eq(afiliadoCobros.estado, "pedido")))
      .returning({ id: afiliadoCobros.id });
    if (!hecho.length) return NextResponse.json({ error: "Ese cobro ya no está pendiente." }, { status: 409 });
    await registrarActividad({
      accion: ACCION.marcarCobroAfiliado,
      objetoTipo: "cobro_afiliado",
      objetoId: id,
      resumen: `Marcó un cobro de afiliado como ${estado === "pagado" ? "pagado" : "rechazado"}`,
      adminId: admin?.id ?? null,
      adminNombre: admin?.name ?? "Administración",
      datos: { estado },
    });
    return NextResponse.json({ ok: true });
  }

  if (accion === "premio") {
    const afiliadoId = texto(body?.afiliadoId, 40);
    const tipo = body?.tipo === "bono" || body?.tipo === "recarga_internacional" ? body.tipo : null;
    if (!afiliadoId || !tipo) return NextResponse.json({ error: "Faltan datos del premio." }, { status: 400 });
    await db
      .insert(afiliadoPremios)
      .values({ id: generateId(), afiliadoId, mes: mesActual(), tipo, entregadoPor: admin?.id ?? null })
      .onConflictDoNothing();
    await registrarActividad({
      accion: ACCION.premioAfiliado,
      objetoTipo: "afiliado",
      objetoId: afiliadoId,
      resumen: `Registró el premio ${tipo} de un afiliado`,
      adminId: admin?.id ?? null,
      adminNombre: admin?.name ?? "Administración",
    });
    return NextResponse.json({ ok: true });
  }

  if (accion === "nota") {
    const afiliadoId = texto(body?.afiliadoId, 40);
    const nota = texto(body?.texto, 1000);
    if (!afiliadoId || !nota) return NextResponse.json({ error: "Escribe la nota." }, { status: 400 });
    await db.insert(afiliadoNotas).values({ id: generateId(), afiliadoId, autorId: admin?.id ?? null, texto: nota });
    await registrarActividad({
      accion: ACCION.notaAfiliado,
      objetoTipo: "afiliado",
      objetoId: afiliadoId,
      resumen: "Añadió una nota interna a un afiliado",
      adminId: admin?.id ?? null,
      adminNombre: admin?.name ?? "Administración",
    });
    return NextResponse.json({ ok: true });
  }

  if (accion === "quitar_afiliacion") {
    const afiliadoId = texto(body?.afiliadoId, 40);
    if (!afiliadoId) return NextResponse.json({ error: "Falta el ID del afiliado." }, { status: 400 });
    /* Solo se borra el código de referido (ya no puede traer nuevos negocios).
       Los negocios que ya trajo conservan su `referred_by`: no se pierde el historial. */
    await db.update(users).set({ referralCode: null }).where(eq(users.id, afiliadoId));
    await registrarActividad({
      accion: ACCION.quitarAfiliacion,
      objetoTipo: "usuario",
      objetoId: afiliadoId,
      resumen: "Retiró la afiliación de una cuenta",
      adminId: admin?.id ?? null,
      adminNombre: admin?.name ?? "Administración",
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
}
