import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
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
  dependenciasSinCumplir,
  normalizarConcepto,
  diasValidezDesde,
  estadoEfectivo,
  esMetodoPago,
  precioSeparado,
  sumarDias,
  type FacturaMetodoPago,
  type FacturaResumen,
} from "@/lib/facturas";
import {
  datosPago,
  metodoDisponible,
  metodosDisponibles,
  type DatosPago,
} from "@/lib/pagos-config";
import { crearFactura, qvapayConfigurado } from "@/lib/qvapay";
import { siteConfig } from "@/config/site";
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

/** Los estados en los que la propuesta sigue viva y se puede reutilizar. */
const ESTADOS_ACTIVOS = [
  "pendiente",
  "aceptada",
  "en_revision",
] as const;

function iso(fecha: Date | null): string | null {
  return fecha?.toISOString() ?? null;
}

/** La validez de una propuesta nueva. */
function expiraEnDesdeAhora(): Date {
  return sumarDias(
    new Date(),
    diasValidezDesde(process.env.FACTURA_DIAS_VALIDEZ),
  );
}

/** La fila de `facturas` con la forma que consume la interfaz. */
export function aFacturaResumen(
  fila: typeof facturas.$inferSelect,
): FacturaResumen {
  const expiraEn = iso(fila.expiraEn);
  return {
    id: fila.id,
    negocioId: fila.negocioId,
    negocioNombre: fila.negocioNombre,
    tipo: fila.tipo,
    packId: fila.packId,
    planClave: fila.planClave,
    titulo: fila.titulo,
    conceptos: fila.conceptos.map(normalizarConcepto),
    nota: fila.nota,
    notaAutor: fila.notaAutor,
    precioUsd: fila.precioUsd,
    precioSeparadoUsd: fila.precioSeparadoUsd,
    precioOriginalUsd: fila.precioOriginalUsd,
    descuentoPct: fila.descuentoPct,
    oferta2x1: fila.oferta2x1,
    tasaCup: fila.tasaCup,
    estado: estadoEfectivo(fila.estado, expiraEn),
    expiraEn,
    metodoPago: fila.metodoPago,
    avisoPagoEn: iso(fila.avisoPagoEn),
    numeroFactura: fila.numeroFactura,
    pagoId: fila.pagoId,
    enviadaEn: fila.enviadaEn.toISOString(),
    aceptadaEn: iso(fila.aceptadaEn),
    pagadaEn: iso(fila.pagadaEn),
    canceladaEn: iso(fila.canceladaEn),
    creadoEn: fila.creadoEn.toISOString(),
  };
}

/**
 * Emite la propuesta de un pack a medida que ya está en `enviado`.
 *
 * Si el pack ya tiene una propuesta activa se devuelve esa: reenviar el enlace
 * no debe crear dos documentos del mismo pack. Si el pack está cancelado o
 * pagado, no se emite.
 */
export async function crearFacturaPack(
  packId: string,
  adminId: string | null,
  notaAutor: string | null = null,
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
      "El pack tiene que estar enviado para generar su propuesta.",
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
  /* Una dependencia sin cumplir es una propuesta que no se puede usar: se
     corta aquí, en el servidor, aunque el editor ya lo avise. */
  const faltan = dependenciasSinCumplir(pack.servicios, cat);
  if (faltan.length > 0) {
    throw new ErrorFactura(`No se puede enviar así: ${faltan.join(" ")}`, 409);
  }
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
      notaAutor,
      precioUsd: pack.precioUsd,
      precioSeparadoUsd: precioSeparado(pack.servicios, cat),
      oferta2x1: pack.oferta2x1,
      tasaCup: cat.tasaCup,
      estado: "pendiente",
      expiraEn: expiraEnDesdeAhora(),
      creadoPor: adminId,
    })
    .returning();

  if (!fila) {
    throw new ErrorFactura("No se pudo emitir la propuesta.", 500);
  }

  return { factura: aFacturaResumen(fila), telefono: pack.telefono };
}

/**
 * Emite la propuesta de un plan estándar.
 *
 * El precio sale del catálogo vivo y del descuento del negocio; nunca del
 * navegador. Si ya hay una propuesta activa de ese mismo plan se reutiliza.
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
      estado: "pendiente",
      expiraEn: expiraEnDesdeAhora(),
      creadoPor: adminId,
    })
    .returning();

  if (!fila) {
    throw new ErrorFactura("No se pudo emitir la propuesta.", 500);
  }

  return { factura: aFacturaResumen(fila), telefono: place.telefono };
}

/** La propuesta pública por su id. No exige sesión: el id es el enlace. */
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

/**
 * Lo que la página pública necesita para cobrar: los métodos que se pueden
 * ofrecer a este negocio (el efectivo solo en Santiago) y los datos de cobro.
 *
 * Los datos salen de la configuración del servidor; el navegador solo elige
 * entre lo que se le ofrece.
 */
export interface ContextoPagoFactura {
  datos: DatosPago;
  metodos: FacturaMetodoPago[];
}

export async function contextoPagoFactura(
  factura: FacturaResumen,
): Promise<ContextoPagoFactura> {
  const [fila] = await db
    .select({ provincia: places.province })
    .from(places)
    .where(eq(places.id, factura.negocioId))
    .limit(1);

  const datos = datosPago();
  return { datos, metodos: metodosDisponibles(fila?.provincia, datos) };
}

/**
 * Abre una factura real de QvaPay para una propuesta aceptada.
 *
 * El enlace público no tiene sesión, así que la única llave es el id de la
 * factura. Por eso el precio **nunca** llega del navegador: se lee de la fila y
 * el `remote_id` de QvaPay es el id de un `pagos` que acaba de crear este
 * servidor. El webhook confirma el cobro y activa lo contratado, igual que un
 * plan comprado desde el panel.
 *
 * La propuesta se queda en `aceptada` mientras el negocio está en QvaPay: si
 * cierra la pasarela sin pagar, puede volver y reintentar.
 */
export async function crearPagoQvapayFactura(
  id: string,
): Promise<{ url: string }> {
  if (!qvapayConfigurado()) {
    throw new ErrorFactura("QvaPay no está configurado todavía.", 503);
  }

  const [factura] = await db
    .select()
    .from(facturas)
    .where(eq(facturas.id, id))
    .limit(1);

  if (!factura) throw new ErrorFactura("Propuesta no encontrada.", 404);
  if (factura.estado === "pagada") {
    throw new ErrorFactura("Esta factura ya está pagada.", 409);
  }
  if (factura.estado === "cancelada") {
    throw new ErrorFactura("Esta propuesta fue cancelada.", 409);
  }
  if (factura.estado !== "aceptada") {
    throw new ErrorFactura("Primero acepta la propuesta.", 409);
  }
  if (!(factura.precioUsd > 0)) {
    throw new ErrorFactura("La propuesta no tiene un importe válido.", 409);
  }

  const clave =
    factura.tipo === "pack_medida" ? factura.packId : factura.planClave;
  if (!clave) {
    throw new ErrorFactura("La propuesta no tiene un concepto válido.", 409);
  }

  /* QvaPay cobra al momento y activa al confirmar: no se puede vender un pack
     que administración ya retiró. */
  if (factura.tipo === "pack_medida") {
    const [pack] = await db
      .select({ estado: packsMedida.estado })
      .from(packsMedida)
      .where(eq(packsMedida.id, clave))
      .limit(1);
    if (!pack) throw new ErrorFactura("El pack ya no existe.", 409);
    if (pack.estado !== "enviado") {
      throw new ErrorFactura(
        "El pack cambió de estado y no se puede pagar esta propuesta.",
        409,
      );
    }
  }

  const pagoId = generateId();
  const montoCentavos = Math.round(factura.precioUsd * 100);

  await db.insert(pagos).values({
    id: pagoId,
    negocioId: factura.negocioId,
    metodo: "qvapay",
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
  });

  /* Se enlaza antes de pedir la factura: si el navegador cierra justo después
     de pagar, el webhook ya sabe qué propuesta marcar como pagada. */
  await db
    .update(facturas)
    .set({ pagoId, metodoPago: "qvapay" })
    .where(
      and(eq(facturas.id, id), inArray(facturas.estado, ["aceptada"])),
    );

  try {
    const invoice = await crearFactura({
      monto: factura.precioUsd,
      descripcion: `Factura ${factura.id} — ${factura.negocioNombre}`.slice(
        0,
        300,
      ),
      remoteId: pagoId,
      webhook: `${siteConfig.url.replace(/\/+$/, "")}/api/pagos/qvapay/webhook`,
    });

    await db
      .update(pagos)
      .set({ qvapayId: invoice.transactionUuid })
      .where(eq(pagos.id, pagoId));

    return { url: invoice.url };
  } catch (error) {
    await db
      .update(pagos)
      .set({ estado: "fallido" })
      .where(eq(pagos.id, pagoId));
    await db
      .update(facturas)
      .set({ pagoId: null })
      .where(and(eq(facturas.id, id), eq(facturas.pagoId, pagoId)));
    console.error("[facturas/qvapay] no se pudo crear la factura", error);
    throw new ErrorFactura(
      "QvaPay no pudo generar la factura. Inténtalo de nuevo.",
      502,
    );
  }
}

/**
 * Marca como pagada la propuesta enlazada a un pago confirmado por QvaPay.
 *
 * El webhook ya aplicó el derecho con el flujo de siempre; lo único que falta
 * es cerrar el documento, que sin esto seguiría en «falta el pago» aunque el
 * servicio estuviera activo. El `where` por estado evita resucitar una
 * propuesta cancelada.
 */
export async function marcarFacturaPagadaPorPago(
  pagoId: string,
): Promise<void> {
  await db
    .update(facturas)
    .set({
      estado: "pagada",
      pagadaEn: new Date(),
      metodoPago: "qvapay",
      numeroFactura: sql`coalesce(${facturas.numeroFactura}, nextval('facturas_numero_seq'))`,
    })
    .where(
      and(
        eq(facturas.pagoId, pagoId),
        inArray(facturas.estado, ["aceptada", "en_revision"]),
      ),
    );
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
 * El cliente acepta la propuesta desde el enlace público.
 *
 * No activa nada: la compra queda registrada y administración confirma el
 * pago. Si ya estaba aceptada o pagada, se devuelve tal cual para que recargar
 * o pulsar dos veces no falle. Una propuesta vencida no se puede aceptar.
 */
export async function aceptarFactura(id: string): Promise<FacturaResumen> {
  const [actual] = await db
    .select()
    .from(facturas)
    .where(eq(facturas.id, id))
    .limit(1);

  if (!actual) throw new ErrorFactura("Propuesta no encontrada.", 404);

  const expiraEn = iso(actual.expiraEn);
  if (estadoEfectivo(actual.estado, expiraEn) === "caducada") {
    await db
      .update(facturas)
      .set({ estado: "caducada" })
      .where(and(eq(facturas.id, id), eq(facturas.estado, "pendiente")));
    throw new ErrorFactura(
      "Esta propuesta caducó. Pide una nueva y te la preparamos al momento.",
      409,
    );
  }

  if (actual.estado === "cancelada") {
    throw new ErrorFactura("Esta propuesta fue cancelada.", 409);
  }
  if (
    actual.estado === "aceptada" ||
    actual.estado === "en_revision" ||
    actual.estado === "pagada"
  ) {
    return aFacturaResumen(actual);
  }

  const [fila] = await db
    .update(facturas)
    .set({ estado: "aceptada", aceptadaEn: new Date() })
    .where(and(eq(facturas.id, id), eq(facturas.estado, "pendiente")))
    .returning();

  if (!fila) {
    const [ultima] = await db
      .select()
      .from(facturas)
      .where(eq(facturas.id, id))
      .limit(1);
    if (ultima) return aFacturaResumen(ultima);
    throw new ErrorFactura("Propuesta no encontrada.", 404);
  }

  return aFacturaResumen(fila);
}

/**
 * Guarda el método con el que el negocio va a pagar.
 *
 * Solo se puede cambiar mientras la propuesta está aceptada y sin aviso de
 * pago. El método se valida contra la configuración del servidor: no se puede
 * elegir efectivo desde otra provincia ni un método que no esté configurado.
 */
export async function guardarMetodoPago(
  id: string,
  metodo: FacturaMetodoPago,
): Promise<FacturaResumen> {
  if (!esMetodoPago(metodo)) {
    throw new ErrorFactura("Ese método de pago no existe.", 400);
  }

  const [actual] = await db
    .select({ factura: facturas, provincia: places.province })
    .from(facturas)
    .innerJoin(places, eq(places.id, facturas.negocioId))
    .where(eq(facturas.id, id))
    .limit(1);

  if (!actual) throw new ErrorFactura("Propuesta no encontrada.", 404);
  if (actual.factura.estado === "pendiente") {
    throw new ErrorFactura("Primero acepta la propuesta.", 409);
  }
  if (
    actual.factura.estado === "en_revision" ||
    actual.factura.estado === "pagada"
  ) {
    throw new ErrorFactura(
      "El método ya no se puede cambiar: el pago está en revisión.",
      409,
    );
  }
  if (actual.factura.estado === "cancelada") {
    throw new ErrorFactura("Esta propuesta fue cancelada.", 409);
  }
  if (
    actual.factura.estado === "caducada" ||
    estadoEfectivo(actual.factura.estado, iso(actual.factura.expiraEn)) ===
      "caducada"
  ) {
    throw new ErrorFactura("Esta propuesta caducó.", 409);
  }
  if (!metodoDisponible(metodo, actual.provincia)) {
    throw new ErrorFactura("Ese método no está disponible para este negocio.", 409);
  }

  const [fila] = await db
    .update(facturas)
    .set({
      metodoPago: metodo,
      /* Cambiar a transferencia abandona el intento de QvaPay: la factura
         manual no debe reutilizar el pago de la pasarela al confirmarse. */
      ...(metodo === "qvapay" ? {} : { pagoId: null }),
    })
    .where(and(eq(facturas.id, id), eq(facturas.estado, "aceptada")))
    .returning();

  if (!fila) {
    throw new ErrorFactura("No se pudo guardar el método de pago.", 409);
  }
  return aFacturaResumen(fila);
}

/**
 * El negocio avisa de que ya pagó. La propuesta pasa a revisión y
 * administración recibe el aviso en el registro de actividad.
 */
export async function avisarPago(id: string): Promise<FacturaResumen> {
  const [actual] = await db
    .select()
    .from(facturas)
    .where(eq(facturas.id, id))
    .limit(1);

  if (!actual) throw new ErrorFactura("Propuesta no encontrada.", 404);
  if (actual.estado === "en_revision" || actual.estado === "pagada") {
    return aFacturaResumen(actual);
  }
  if (actual.estado === "cancelada") {
    throw new ErrorFactura("Esta propuesta fue cancelada.", 409);
  }
  if (actual.estado !== "aceptada") {
    throw new ErrorFactura("Primero acepta la propuesta.", 409);
  }
  if (!actual.metodoPago) {
    throw new ErrorFactura("Elige cómo vas a pagar antes de avisar.", 409);
  }

  /* El CUP sigue la tasa del día en que se paga: se congela aquí, que es
     cuando el negocio transfiere, y no al confirmar, que puede ser otro día. */
  const { tasaCup } = await cargarCatalogo();

  const [fila] = await db
    .update(facturas)
    .set({ estado: "en_revision", avisoPagoEn: new Date(), tasaCup })
    .where(and(eq(facturas.id, id), eq(facturas.estado, "aceptada")))
    .returning();

  if (!fila) {
    const [ultima] = await db
      .select()
      .from(facturas)
      .where(eq(facturas.id, id))
      .limit(1);
    if (ultima) return aFacturaResumen(ultima);
    throw new ErrorFactura("Propuesta no encontrada.", 404);
  }

  return aFacturaResumen(fila);
}

/**
 * Administración confirma el pago de una propuesta aceptada o en revisión.
 *
 * Crea una fila de `pagos` con método `manual` y aplica el derecho con el
 * flujo de siempre. Si algo falla, la propuesta conserva el `pagoId` y el
 * reintento reutiliza esa misma fila en vez de cobrar dos veces. El número de
 * factura se consume del secuencial una sola vez, en este paso.
 */
export async function confirmarFactura(id: string): Promise<FacturaResumen> {
  const [factura] = await db
    .select()
    .from(facturas)
    .where(eq(facturas.id, id))
    .limit(1);

  if (!factura) throw new ErrorFactura("Propuesta no encontrada.", 404);
  if (factura.estado === "pagada") return aFacturaResumen(factura);
  if (factura.estado === "cancelada") {
    throw new ErrorFactura("Esta propuesta está cancelada.", 409);
  }
  if (factura.estado === "caducada") {
    throw new ErrorFactura("Esta propuesta caducó.", 409);
  }
  if (
    factura.estado !== "aceptada" &&
    factura.estado !== "en_revision"
  ) {
    throw new ErrorFactura(
      "El cliente todavía no ha aceptado esta propuesta.",
      409,
    );
  }

  const clave =
    factura.tipo === "pack_medida" ? factura.packId : factura.planClave;
  if (!clave) {
    throw new ErrorFactura("La propuesta no tiene un concepto válido.", 409);
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
        "El pack cambió de estado y no se puede confirmar esta propuesta.",
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
      packMedidaId: factura.tipo === "pack_medida" ? factura.packId : null,
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
    await db.update(facturas).set({ pagoId }).where(eq(facturas.id, id));
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
    .set({
      estado: "pagada",
      pagadaEn: new Date(),
      numeroFactura:
        factura.numeroFactura ??
        sql`nextval('facturas_numero_seq')`,
    })
    .where(
      and(
        eq(facturas.id, id),
        inArray(facturas.estado, ["aceptada", "en_revision"]),
      ),
    )
    .returning();

  if (!fila) {
    const [ultima] = await db
      .select()
      .from(facturas)
      .where(eq(facturas.id, id))
      .limit(1);
    if (ultima) return aFacturaResumen(ultima);
    throw new ErrorFactura("Propuesta no encontrada.", 404);
  }

  return aFacturaResumen(fila);
}

/** Cancela una propuesta que todavía no se pagó. */
export async function cancelarFactura(id: string): Promise<FacturaResumen> {
  const [fila] = await db
    .update(facturas)
    .set({ estado: "cancelada", canceladaEn: new Date() })
    .where(
      and(
        eq(facturas.id, id),
        inArray(facturas.estado, [...ESTADOS_ACTIVOS]),
      ),
    )
    .returning();

  if (!fila) {
    const [actual] = await db
      .select()
      .from(facturas)
      .where(eq(facturas.id, id))
      .limit(1);
    if (!actual) throw new ErrorFactura("Propuesta no encontrada.", 404);
    if (actual.estado === "cancelada" || actual.estado === "caducada") {
      return aFacturaResumen(actual);
    }
    throw new ErrorFactura("Una propuesta pagada no se puede cancelar.", 409);
  }

  return aFacturaResumen(fila);
}

/** Cancela las propuestas activas de un pack que se cerró o volvió a borrador. */
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
