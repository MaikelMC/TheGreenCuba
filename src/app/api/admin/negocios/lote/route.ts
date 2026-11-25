import { inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { ACCION, registrarActividad } from "@/lib/admin-actividad";
import { isAdminRequest } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";
import {
  esTipoNegocio,
  TIPO_NEGOCIO_LABEL,
  type TipoNegocio,
} from "@/lib/ficha/tipos";

/**
 * Acciones en lote sobre los negocios seleccionados en la lista.
 *
 * Cada acción es un solo `UPDATE` y deja **una** entrada en Actividad con el
 * número de negocios, no una por fila. Asignar tipo y destacar son cambios
 * acotados a la lista blanca de administración; el aviso no se manda desde
 * aquí: la lista lleva los ids a Notificaciones, donde se revisa el texto y se
 * confirma el envío con su propia ruta.
 */

const ACCIONES = ["tipo", "destacar", "quitar_destacado"] as const;
type AccionLote = (typeof ACCIONES)[number];

function esAccion(valor: unknown): valor is AccionLote {
  return typeof valor === "string" && ACCIONES.includes(valor as AccionLote);
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    accion?: unknown;
    ids?: unknown;
    tipo?: unknown;
  } | null;

  const accion = body?.accion;
  if (!esAccion(accion)) {
    return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
  }

  const ids = Array.isArray(body?.ids)
    ? [
        ...new Set(
          body.ids
            .filter((valor): valor is string => typeof valor === "string")
            .map((valor) => valor.trim())
            .filter(Boolean),
        ),
      ].slice(0, 100)
    : [];

  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Elige al menos un negocio." },
      { status: 400 },
    );
  }

  let tipo: TipoNegocio | null = null;
  if (accion === "tipo") {
    if (!esTipoNegocio(body?.tipo)) {
      return NextResponse.json(
        { error: "El tipo de negocio no es válido." },
        { status: 400 },
      );
    }
    tipo = body.tipo;
  }

  let actualizados: { id: string; name: string }[];
  if (accion === "tipo" && tipo) {
    actualizados = await db
      .update(places)
      .set({
        tipoNegocio: tipo,
        tipoConfirmado: true,
        updatedAt: new Date(),
      })
      .where(inArray(places.id, ids))
      .returning({ id: places.id, name: places.name });
  } else {
    actualizados = await db
      .update(places)
      .set({
        isBoosted: accion === "destacar",
        updatedAt: new Date(),
      })
      .where(inArray(places.id, ids))
      .returning({ id: places.id, name: places.name });
  }

  if (actualizados.length === 0) {
    return NextResponse.json(
      { error: "No se encontró ninguno de los negocios seleccionados." },
      { status: 404 },
    );
  }

  const cuantos = actualizados.length;
  const resumen =
    accion === "tipo" && tipo
      ? `Asignó el tipo «${TIPO_NEGOCIO_LABEL[tipo]}» a ${cuantos} ${cuantos === 1 ? "negocio" : "negocios"}`
      : accion === "destacar"
        ? `Destacó ${cuantos} ${cuantos === 1 ? "negocio" : "negocios"}`
        : `Quitó el destacado a ${cuantos} ${cuantos === 1 ? "negocio" : "negocios"}`;

  await registrarActividad({
    accion:
      accion === "tipo"
        ? ACCION.editarNegocio
        : accion === "destacar"
          ? ACCION.destacarNegocio
          : ACCION.quitarDestacado,
    objetoTipo: "negocio",
    resumen,
    datos: {
      ids: actualizados.map((negocio) => negocio.id),
      ...(tipo ? { tipo } : {}),
    },
  });

  return NextResponse.json({ actualizados: cuantos });
}
