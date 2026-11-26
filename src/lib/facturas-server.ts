import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { cargarCatalogo } from "@/lib/catalogo-server";
import { db } from "@/lib/db";
import {
  facturas,
  packsMedida,
  pagos,
  places,
  suscripciones,
} from "@/lib/db/schema";
import { aplicarDerecho } from "@/lib/pagos-server";
import { nombreDe, precioConDescuento, type Pack } from "@/lib/plans";
import {
  conceptosDePack,
  conceptosDePlan,
  type FacturaResumen,
} from "@/lib/facturas";
import { generateId } from "@/lib/utils";

/** Error con el estado HTTP que le corresponde, para las rutas. */
export class ErrorFactura extends Error {
  status: number;

  constructor(mensaje: string, status = 400) {
    super(mensaje);
    this.name = "ErrorFactura";
    this.status = status;
  }
}

export interface FacturaEmitida {
  factura: FacturaResumen;
  telefono: string | null;
}

function iso(fecha: Date | null): string | null {
  return fecha?.toISOString() ?? null;
}

/** La fila de `facturas` con la forma que consume la interfaz. */
export function aFacturaResumen(
  fila: typeof facturas.$inferSelect,
): FacturaResumen {
  return {
    id: fila.id,
    negocioId: fila.negocioId,
    negocioNombre: fila.negocioNombre,
    tipo: fila.tipo,
    packId: fila.packId,
    planClave: fila.planClave,
    titulo: fila.titulo,
    conceptos: fila.conceptos,
    nota: fila.nota,
    precioUsd: fila.precioUsd,
    precioOriginalUsd: fila.precioOriginalUsd,
    descuentoPct: fila.descuentoPct,
    oferta2x1: fila.oferta2x1,
    tasaCup: fila.tasaCup,
    estado: fila.estado,
    pagoId: fila.pagoId,
    enviadaEn: fila.enviadaEn.toISOString(),
    aceptadaEn: iso(fila.aceptadaEn),
    pagadaEn: iso(fila.pagadaEn),
    canceladaEn: iso(fila.canceladaEn),
    creadoEn: fila.creadoEn.toISOString(),
  };
}

const ESTADOS_ACTIVOS = ["enviada", "aceptada"] as const;

/**
 * Emite la factura de un pack a medida que ya está en `enviado`.
 *
 * Si el pack ya tiene una factura activa se devuelve esa: reenviar el enlace
 * no debe crear dos documentos del mismo pack. Si el pack está cancelado o
 * pagado, no se emite.
 */
export async function crearFacturaPack(
  packId: string,
  adminId: string | null,
): Promise<FacturaEmitida> {
  const [pack] = await db
    .select({
      id: packsMedida.id,
      negocioId: packsMedida.negocioId,
      estado: packsMedida.estado,
      servicios: packsMedida.servicios,
      precioUsd: packsMedida.precioUsd,
      oferta2x1: packsMedida.oferta2x1,
      notaCliente: packsMedida.notaCliente,
      negocioNombre: places.name,
      telefono: places.whatsapp,
    })
    .from(packsMedida)
    .innerJoin(places, eq(places.id, packsMedida.negocioId))
    .where(eq(packsMedida.id, packId))
    .limit(1);

  if (!pack) throw new ErrorFactura("Pack no encontrado.", 404);
  if (pack.estado !== "enviado") {
    throw new ErrorFactura(
      "El pack tiene que estar enviado para generar su factura.",
      409,
    );
  }
  if (pack.precioUsd === null || pack.precioUsd < 0) {
    throw new ErrorFactura("El pack no tiene un precio válido.", 409);
  }

  const [existente] = await db
    .select()
    .from(facturas)
    .where(
      and(
        eq(facturas.packId, packId),
        inArray(facturas.estado, [...ESTADOS_ACTIVOS]),
      ),
    )
    .orderBy(desc(facturas.creadoEn))
    .limit(1);

  if (existente) {
    return { factura: aFacturaResumen(existente), telefono: pack.telefono };
  }

  const cat = await cargarCatalogo();
  const id = generateId();
  const [fila] = await db
    .insert(facturas)
    .values({
      id,
      negocioId: pack.negocioId,
      negocioNombre: pack.negocioNombre,
      tipo: "pack_medida",
      packId,
      titulo: `Pack a medida — ${pack.negocioNombre}`,
      conceptos: conceptosDePack(pack.servicios, cat),
      nota: pack.notaCliente,
      precioUsd: pack.precioUsd,
      oferta2x1: pack.oferta2x1,
      tasaCup: cat.tasaCup,
      estado: "enviada",
      creadoPor: adminId,
    })
    .returning();

  if (!fila) {
    throw new ErrorFactura("No se pudo emitir la factura.", 500);
  }

  return { factura: aFacturaResumen(fila), telefono: pack.telefono };
}

/**
 * Emite la factura de un plan estándar.
 *
 * El precio sale del catálogo vivo y del descuento del negocio; nunca del
 * navegador. Si ya hay una factura activa de ese mismo plan se reutiliza.
 */
export async function crearFacturaPlan(
  negocioId: string,
  plan: Pack,
  adminId: string | null,
): Promise<FacturaEmitida> {
  const cat = await cargarCatalogo();
  if (!(plan in cat.packs)) {
    throw new ErrorFactura("Ese plan no existe.", 400);
  }

  const [place] = await db
    .select({ nombre: places.name, telefono: places.whatsapp })
    .from(places)
    .where(eq(places.id, negocioId))
    .limit(1);

  if (!place) throw new ErrorFactura("El negocio no existe.", 404);

  const [susc] = await db
    .select({ descuentoPct: suscripciones.descuentoPct })
    .from(suscripciones)
    .where(eq(suscripciones.negocioId, negocioId))
    .limit(1);

  const { final, original, descuentoPct: pct } = precioConDescuento(
    cat.packs[plan].usd,
    susc?.descuentoPct,
  );

  const [existente] = await db
    .select()
    .from(facturas)
    .where(
      and(
        eq(facturas.negocioId, negocioId),
        eq(facturas.tipo, "plan"),
        eq(facturas.planClave, plan),
        inArray(facturas.estado, [...ESTADOS_ACTIVOS]),
      ),
    )
    .orderBy(desc(facturas.creadoEn))
    .limit(1);

  if (existente) {
    return { factura: aFacturaResumen(existente), telefono: place.telefono };
  }

  const id = generateId();
  const [fila] = await db
    .insert(facturas)
    .values({
      id,
      negocioId,
      negocioNombre: place.nombre,
      tipo: "plan",
      planClave: plan,
      titulo: `Plan ${nombreDe(plan, cat)} — ${place.nombre}`,
      conceptos: conceptosDePlan(plan, cat),
      precioUsd: final,
      precioOriginalUsd: pct > 0 ? original : null,
      descuentoPct: pct > 0 ? pct : null,
      tasaCup: cat.tasaCup,
      estado: "enviada",
      creadoPor: adminId,
    })
    .returning();

  if (!fila) {
    throw new ErrorFactura("No se pudo emitir la factura.", 500);
  }

  return { factura: aFacturaResumen(fila), telefono: place.telefono };
}

/** La factura pública por su id. No exige sesión: el id es el enlace. */
export async function obtenerFactura(
  id: string,
): Promise<FacturaResumen | null> {
  const [fila] = await db
    .select()
    .from(facturas)
    .where(eq(facturas.id, id))
    .limit(1);
  return fila ? aFacturaResumen(fila) : null;
}

/** Lista para administración, con búsqueda por id o nombre del negocio. */
export async function listarFacturas(q: string): Promise<FacturaResumen[]> {
  const texto = q.trim();
  const filas = await db
    .select()
    .from(facturas)
    .where(
      texto
        ? or(
            ilike(facturas.id, `%${texto}%`),
            ilike(facturas.negocioNombre, `%${texto}%`),
            ilike(facturas.titulo, `%${texto}%`),
          )
        : undefined,
    )
    .orderBy(desc(facturas.creadoEn))
    .limit(200);

  return filas.map(aFacturaResumen);
}

/**
 * El cliente acepta la factura desde el enlace público.
 *
 * No activa nada: la compra queda registrada y administración confirma el
 * pago. Si ya estaba aceptada o pagada, se devuelve tal cual para que recargar
 * o pulsar dos veces no falle.
 */
export async function aceptarFactura(
  id: string,
): Promise<FacturaResumen> {
  const [actual] = await db
    .select()
    .from(facturas)
    .where(eq(facturas.id, id))
    .limit(1);

  if (!actual) throw new ErrorFactura("Factura no encontrada.", 404);
  if (actual.estado === "cancelada") {
    throw new ErrorFactura("Esta factura fue cancelada.", 409);
  }
  if (actual.estado === "aceptada" || actual.estado === "pagada") {
    return aFacturaResumen(actual);
  }

  const [fila] = await db
    .update(facturas)
    .set({ estado: "aceptada", aceptadaEn: new Date() })
    .where(and(eq(facturas.id, id), eq(facturas.estado, "enviada")))
    .returning();

  if (!fila) {
    const [ultima] = await db
      .select()
      .from(facturas)
      .where(eq(facturas.id, id))
      .limit(1);
    if (ultima) return aFacturaResumen(ultima);
    throw new ErrorFactura("Factura no encontrada.", 404);
  }

  return aFacturaResumen(fila);
}

/**
 * Administración confirma el pago de una factura aceptada.
 *
 * Crea una fila de `pagos` con método `manual` y aplica el derecho con el
 * flujo de siempre. Si algo falla, la factura conserva el `pagoId` y el
 * reintento reutiliza esa misma fila en vez de cobrar dos veces.
 */
export async function confirmarFactura(
  id: string,
): Promise<FacturaResumen> {
  const [factura] = await db
    .select()
    .from(facturas)
    .where(eq(facturas.id, id))
    .limit(1);

  if (!factura) throw new ErrorFactura("Factura no encontrada.", 404);
  if (factura.estado === "pagada") return aFacturaResumen(factura);
  if (factura.estado === "cancelada") {
    throw new ErrorFactura("Esta factura está cancelada.", 409);
  }
  if (factura.estado !== "aceptada") {
    throw new ErrorFactura(
      "El cliente todavía no ha confirmado esta factura.",
      409,
    );
  }

  const clave =
    factura.tipo === "pack_medida" ? factura.packId : factura.planClave;
  if (!clave) {
    throw new ErrorFactura("La factura no tiene un concepto válido.", 409);
  }

  if (factura.tipo === "pack_medida") {
    const [pack] = await db
      .select({ estado: packsMedida.estado })
      .from(packsMedida)
      .where(eq(packsMedida.id, clave))
      .limit(1);
    if (!pack) throw new ErrorFactura("El pack ya no existe.", 409);
    if (pack.estado !== "enviado") {
      throw new ErrorFactura(
        "El pack cambió de estado y no se puede confirmar esta factura.",
        409,
      );
    }
  }

  let pagoId = factura.pagoId;
  let pago = pagoId
    ? (
        await db.select().from(pagos).where(eq(pagos.id, pagoId)).limit(1)
      )[0]
    : undefined;

  if (!pago) {
    pagoId = generateId();
    const ahora = new Date();
    const montoCentavos = Math.round(factura.precioUsd * 100);
    await db.insert(pagos).values({
      id: pagoId,
      negocioId: factura.negocioId,
      metodo: "manual",
      tipo: factura.tipo,
      clave,
      packMedidaId:
        factura.tipo === "pack_medida" ? factura.packId : null,
      montoCentavos,
      montoOriginalCentavos:
        factura.precioOriginalUsd !== null
          ? Math.round(factura.precioOriginalUsd * 100)
          : null,
      descuentoPct: factura.descuentoPct,
      moneda: "USD",
      estado: "pendiente",
      qvapayId: null,
      pagadoEn: null,
      createdAt: ahora,
      updatedAt: ahora,
    });
    await db
      .update(facturas)
      .set({ pagoId })
      .where(eq(facturas.id, id));
    [pago] = await db
      .select()
      .from(pagos)
      .where(eq(pagos.id, pagoId))
      .limit(1);
  }

  if (!pago) throw new ErrorFactura("No se pudo registrar el pago.", 500);

  await aplicarDerecho(pago);

  const [fila] = await db
    .update(facturas)
    .set({ estado: "pagada", pagadaEn: new Date() })
    .where(and(eq(facturas.id, id), eq(facturas.estado, "aceptada")))
    .returning();

  if (!fila) {
    const [ultima] = await db
      .select()
      .from(facturas)
      .where(eq(facturas.id, id))
      .limit(1);
    if (ultima) return aFacturaResumen(ultima);
    throw new ErrorFactura("Factura no encontrada.", 404);
  }

  return aFacturaResumen(fila);
}

/** Cancela una factura que todavía no se pagó. */
export async function cancelarFactura(
  id: string,
): Promise<FacturaResumen> {
  const [fila] = await db
    .update(facturas)
    .set({ estado: "cancelada", canceladaEn: new Date() })
    .where(
      and(eq(facturas.id, id), inArray(facturas.estado, ["enviada", "aceptada"])),
    )
    .returning();

  if (!fila) {
    const [actual] = await db
      .select()
      .from(facturas)
      .where(eq(facturas.id, id))
      .limit(1);
    if (!actual) throw new ErrorFactura("Factura no encontrada.", 404);
    if (actual.estado === "cancelada") return aFacturaResumen(actual);
    throw new ErrorFactura("Una factura pagada no se puede cancelar.", 409);
  }

  return aFacturaResumen(fila);
}

/** Cancela las facturas activas de un pack que se cerró o volvió a borrador. */
export async function cancelarFacturasDePack(packId: string): Promise<void> {
  await db
    .update(facturas)
    .set({ estado: "cancelada", canceladaEn: new Date() })
    .where(
      and(
        eq(facturas.packId, packId),
        inArray(facturas.estado, [...ESTADOS_ACTIVOS]),
      ),
    );
}
