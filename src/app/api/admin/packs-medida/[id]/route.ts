import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { ACCION, registrarActividad } from "@/lib/admin-actividad";
import { isAdminRequest } from "@/lib/admin-server";
import { cargarCatalogo } from "@/lib/catalogo-server";
import { db } from "@/lib/db";
import { packsMedida, places } from "@/lib/db/schema";
import { funcionesDeServicios, precioSugeridoPack } from "@/lib/pack-medida";
import { cancelarFacturasDePack } from "@/lib/facturas-server";
import { MODULOS, PACKS } from "@/lib/plans";
import type { PackMedidaEstado } from "@/lib/db/schema/packs_medida";
import { generateId } from "@/lib/utils";

const SERVICIOS_VALIDOS = new Set([
  ...Object.keys(MODULOS),
  ...Object.keys(PACKS),
]);

/** Los estados que el administrador puede fijar desde el panel. */
const ESTADOS_ADMIN = new Set<string>(["borrador", "enviado", "cancelado", "rechazado"]);

/**
 * PATCH — el administrador edita un pack existente.
 *
 * Campos actualizables:
 *   servicios, precioUsd, oferta2x1, notaCliente, notaInterna, estado
 *
 * - Cambiar `servicios` recalcula `funciones` y `precioSugeridoUsd`.
 * - Pasar a `enviado` fija `enviadoEn` si aún no está.
 * - No se puede pasar a `pagado` ni `vencido` desde aquí; eso lo hace el webhook.
 * - Un pack en `pagado`, `vencido`, `cancelado` o `rechazado` no se puede editar (409).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const [pack] = await db
    .select({ estado: packsMedida.estado, negocioId: packsMedida.negocioId, enviadoEn: packsMedida.enviadoEn })
    .from(packsMedida)
    .where(eq(packsMedida.id, id))
    .limit(1);

  if (!pack) return NextResponse.json({ error: "Pack no encontrado." }, { status: 404 });

  /* Los finalizados no se editan. Cancelado y rechazado también: reabrir uno
     chocaría con el índice de «uno en tramitación por negocio» si ya hay otro,
     y el camino limpio es crear un pack nuevo. */
  if (["pagado", "vencido", "cancelado", "rechazado"].includes(pack.estado)) {
    return NextResponse.json(
      { error: "Este pack ya está cerrado y no se puede editar. Crea uno nuevo." },
      { status: 409 },
    );
  }

  /* Un pack enviado está **congelado**: el dueño puede tener una factura de
     QvaPay abierta con ese precio, y el webhook activa las funciones que tenga
     la fila al cobrar. Si se editara, pagaría un precio y recibiría otra cosa.
     Solo se admite apuntar la nota interna (no afecta a nada de lo cobrado),
     cancelarlo, o devolverlo a borrador, que en realidad es cancelarlo y
     abrir una copia (ver abajo). */
  if (pack.estado === "enviado") {
    const extra = Object.keys(body).filter((k) => k !== "estado" && k !== "notaInterna");
    if (extra.length > 0 || (body.estado !== undefined && body.estado !== "borrador" && body.estado !== "cancelado")) {
      return NextResponse.json(
        { error: "Un pack enviado no se edita: devuélvelo a borrador primero." },
        { status: 409 },
      );
    }

    if (body.estado === "borrador") {
      const nuevoId = await devolverABorrador(id, body.notaInterna);
      if (!nuevoId) return packCambio();
      /* El enlace que ya se compartió deja de servir: apunta al pack que se
         cerró, no a la copia corregida. */
      await cancelarFacturasDePack(id);
      await registrarActividad({
        accion: ACCION.editarPack,
        objetoTipo: "negocio",
        objetoId: pack.negocioId,
        resumen: "Devolvió un pack a medida a borrador",
        datos: { packId: id, packNuevoId: nuevoId },
      });
      return responder(nuevoId);
    }
  }

  const cambios: Partial<typeof packsMedida.$inferInsert> = {};

  /* Servicios → recalcular funciones y precio sugerido. */
  if (Array.isArray(body.servicios)) {
    const servicios = (body.servicios as unknown[])
      .filter((s): s is string => typeof s === "string" && SERVICIOS_VALIDOS.has(s))
      .slice(0, 50);
    const cat = await cargarCatalogo();
    const funciones = funcionesDeServicios(servicios, cat);
    const { precioUsd: sugerido } = precioSugeridoPack(servicios, cat);
    cambios.servicios = servicios;
    cambios.funciones = funciones;
    cambios.precioSugeridoUsd = sugerido || null;
  }

  if (typeof body.precioUsd === "number" && body.precioUsd >= 0) {
    cambios.precioUsd = Math.round(body.precioUsd * 100) / 100;
  } else if (body.precioUsd === null) {
    cambios.precioUsd = null;
  }

  if (typeof body.oferta2x1 === "boolean") cambios.oferta2x1 = body.oferta2x1;

  if (typeof body.notaCliente === "string")
    cambios.notaCliente = body.notaCliente.trim() || null;

  if (typeof body.notaInterna === "string")
    cambios.notaInterna = body.notaInterna.trim() || null;

  if (typeof body.estado === "string" && ESTADOS_ADMIN.has(body.estado)) {
    cambios.estado = body.estado as PackMedidaEstado;
    if (body.estado === "enviado" && !pack.enviadoEn) {
      cambios.enviadoEn = new Date();
    }
  }

  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ error: "Sin cambios." }, { status: 400 });
  }

  /* `estado = el que se leyó`: si entre la lectura y esta escritura llegó el
     pago (`pagado`), cancelar no puede pisarlo y dejar sin pack a quien pagó. */
  const escritas = await db
    .update(packsMedida)
    .set(cambios)
    .where(
      and(
        eq(packsMedida.id, id),
        eq(packsMedida.negocioId, pack.negocioId),
        eq(packsMedida.estado, pack.estado),
      ),
    )
    .returning({ id: packsMedida.id });

  if (escritas.length === 0) return packCambio();

  if (cambios.estado === "cancelado" || cambios.estado === "rechazado") {
    await cancelarFacturasDePack(id);
  }

  await registrarActividad({
    accion: ACCION.editarPack,
    objetoTipo: "negocio",
    objetoId: pack.negocioId,
    resumen:
      cambios.estado === "enviado"
        ? "Envió un pack a medida a un negocio"
        : "Editó un pack a medida",
    datos: { packId: id, estado: cambios.estado ?? pack.estado },
  });

  return responder(id);
}

/** 409 común: el pack cambió de estado mientras se editaba. */
function packCambio() {
  return NextResponse.json(
    {
      error:
        "El pack cambió mientras lo editabas (quizá el dueño acaba de pagarlo). No se guardó nada: recarga la página.",
    },
    { status: 409 },
  );
}

/**
 * «Devolver a borrador» un pack enviado, sin tocar lo que se envió.
 *
 * El enviado pasa a `cancelado` tal cual —precio y funciones intactos— y se
 * abre una copia en `borrador` para corregirla. Si el dueño ya tenía la
 * factura abierta y la paga, el webhook activa el pack **que se le envió**,
 * no la versión corregida. En una transacción y con el orden importante: el
 * índice parcial admite un solo pack en tramitación por negocio, así que el
 * enviado tiene que dejar de estarlo antes de insertar la copia.
 *
 * Devuelve el id de la copia, o `null` si el pack ya no estaba `enviado`
 * (se pagó o se canceló entre la lectura y la escritura).
 */
async function devolverABorrador(
  id: string,
  notaInterna: unknown,
): Promise<string | null> {
  return db.transaction(async (tx) => {
    const [original] = await tx
      .update(packsMedida)
      .set({ estado: "cancelado" })
      .where(and(eq(packsMedida.id, id), eq(packsMedida.estado, "enviado")))
      .returning();
    if (!original) return null;

    const nuevoId = generateId();
    await tx.insert(packsMedida).values({
      id: nuevoId,
      negocioId: original.negocioId,
      estado: "borrador",
      serviciosSolicitados: original.serviciosSolicitados,
      servicios: original.servicios,
      funciones: original.funciones,
      precioUsd: original.precioUsd,
      precioSugeridoUsd: original.precioSugeridoUsd,
      oferta2x1: original.oferta2x1,
      notaCliente: original.notaCliente,
      notaInterna:
        typeof notaInterna === "string"
          ? notaInterna.trim() || null
          : original.notaInterna,
    });
    return nuevoId;
  });
}

/** El pack tal como lo pinta el editor. */
async function responder(id: string) {
  const [row] = await db
    .select({
      id: packsMedida.id,
      negocioId: packsMedida.negocioId,
      estado: packsMedida.estado,
      serviciosSolicitados: packsMedida.serviciosSolicitados,
      servicios: packsMedida.servicios,
      funciones: packsMedida.funciones,
      precioUsd: packsMedida.precioUsd,
      precioSugeridoUsd: packsMedida.precioSugeridoUsd,
      oferta2x1: packsMedida.oferta2x1,
      notaCliente: packsMedida.notaCliente,
      notaInterna: packsMedida.notaInterna,
      enviadoEn: packsMedida.enviadoEn,
      pagadoEn: packsMedida.pagadoEn,
      venceEn: packsMedida.venceEn,
      creadoEn: packsMedida.creadoEn,
      actualizadoEn: packsMedida.actualizadoEn,
      negocioNombre: places.name,
    })
    .from(packsMedida)
    .innerJoin(places, eq(packsMedida.negocioId, places.id))
    .where(eq(packsMedida.id, id))
    .limit(1);

  return NextResponse.json({
    pack: row
      ? {
          ...row,
          enviadoEn: row.enviadoEn?.toISOString() ?? null,
          pagadoEn: row.pagadoEn?.toISOString() ?? null,
          venceEn: row.venceEn?.toISOString() ?? null,
          creadoEn: row.creadoEn.toISOString(),
          actualizadoEn: row.actualizadoEn.toISOString(),
        }
      : { id },
  });
}
