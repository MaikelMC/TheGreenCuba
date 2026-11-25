import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { authSession } from "@/lib/auth/schema";
import { cargarCatalogo } from "@/lib/catalogo-server";
import { db } from "@/lib/db";
import {
  analyticsEvents,
  businessOwners,
  categories,
  notasNegocio,
  pagos,
  pedidos,
  places,
  publicaciones,
  supportTickets,
  suscripciones,
  users,
} from "@/lib/db/schema";
import type { PackMedidaResumen } from "@/lib/pack-medida";
import { puntosFicha } from "@/lib/ficha/completitud";
import { TIPO_NEGOCIO_LABEL } from "@/lib/ficha/tipos";
import {
  PLAN_ORDER,
  aSuscripcion,
  cupDe,
  funcionesDe,
  limiteDe,
  nombreDe,
  planEfectivo,
  usdDe,
  type Funcion,
  type Plan,
} from "@/lib/plans";
import { packMedidaVigenteDe } from "@/lib/plans-server";
import { semanaDe } from "@/lib/publicaciones";
import { normalizarTelefono } from "@/lib/telefono";

/**
 * La ficha 360: todo lo que hace falta para atender un negocio sin salir del
 * panel, en una sola llamada.
 *
 * Las consultas van en paralelo y cada una trae lo mínimo. Los números son
 * reales: las visitas salen de `analytics_events`, los pedidos de `pedidos`, el
 * cupo de `publicaciones` y la completitud de la **misma** regla que usa el
 * panel del negocio (`puntosFicha`).
 *
 * La nota interna vive en `notas_negocio`, solo para administración. El estado
 * del pago mezcla la suscripción con el último intento pendiente: una ficha no
 * debe decir «al día» mientras hay un pago esperando confirmación.
 */

export type EstadoPagoFicha =
  "al_dia" | "prueba" | "vencida" | "pendiente" | "gratis" | "cancelada";

export type EstadoPublicacionFicha =
  "publicado" | "pendiente" | "rechazado" | "oculto" | "cerrado" | "temporal";

export interface Ficha360Admin {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  imageUrls: string[];
  description: string | null;
  city: string;
  province: string;
  neighborhood: string | null;
  address: string | null;
  tipo: string | null;
  tipoLabel: string;
  categoria: string | null;
  estadoPublicacion: EstadoPublicacionFicha;
  isActive: boolean;
  reviewStatus: string;
  status: string;
  isBoosted: boolean;
  verificado: boolean;
  plan: {
    efectivo: Plan;
    nombre: string;
    contratado: Plan;
    contratadoNombre: string;
    estado: "activa" | "cancelada";
    trialHasta: string | null;
    venceEn: string | null;
    precioUsd: number;
    precioCup: number;
  };
  pago: {
    estado: EstadoPagoFicha;
    etiqueta: string;
    detalle: string;
    montoCentavos?: number;
  };
  /** El pack a medida pagado y vigente, si lo hay. Se suma al plan estándar. */
  packMedida: PackMedidaResumen | null;
  completitud: { pct: number; faltan: string[] };
  metricas: {
    visitas30: number;
    pedidos30: number;
    publicacionesUsadas: number;
    publicacionesTope: number | null;
  };
  dueno: {
    id: string;
    nombre: string;
    email: string;
    telefono: string | null;
    whatsappHref: string | null;
  } | null;
  ultimaActividad: string | null;
  afiliado: string | null;
  alta: string;
  soporte: { abiertas: number; ultimaId: string | null };
  nota: string;
  planes: { id: Plan; nombre: string }[];
}

const DIA = 24 * 60 * 60 * 1000;
const FECHA = new Intl.DateTimeFormat("es-CU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Havana",
});

function fecha(valor: Date | null | undefined): string | null {
  return valor ? FECHA.format(valor) : null;
}

function diasHasta(desde: Date, hasta: Date): number {
  return Math.max(0, Math.ceil((hasta.getTime() - desde.getTime()) / DIA));
}

function diasDesde(desde: Date, hasta: Date): number {
  return Math.max(0, Math.ceil((hasta.getTime() - desde.getTime()) / DIA));
}

export async function cargarFicha360(
  negocioId: string,
): Promise<Ficha360Admin | null> {
  const ahora = new Date();
  const desde30 = new Date(ahora.getTime() - 30 * DIA);
  const semana = semanaDe(ahora);

  const [
    filas,
    filasSuscripcion,
    duenos,
    filasNota,
    filasPagoPendiente,
    visitas,
    pedidos30,
    publicacionesSemana,
    cat,
    packMedida,
  ] = await Promise.all([
    db
      .select({
        id: places.id,
        name: places.name,
        slug: places.slug,
        logoUrl: places.logoUrl,
        imageUrls: places.imageUrls,
        description: places.description,
        city: places.city,
        province: places.province,
        neighborhood: places.neighborhood,
        address: places.address,
        tipoNegocio: places.tipoNegocio,
        isActive: places.isActive,
        reviewStatus: places.reviewStatus,
        status: places.status,
        isBoosted: places.isBoosted,
        verificado: places.verificado,
        latitude: places.lat,
        longitude: places.lng,
        phone: places.phone,
        whatsapp: places.whatsapp,
        schedule: places.schedule,
        horario: places.horario,
        createdAt: places.createdAt,
        updatedAt: places.updatedAt,
        categoria: categories.name,
      })
      .from(places)
      .leftJoin(categories, eq(categories.id, places.categoryId))
      .where(eq(places.id, negocioId))
      .limit(1),
    db
      .select()
      .from(suscripciones)
      .where(eq(suscripciones.negocioId, negocioId))
      .limit(1),
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        authUserId: users.authUserId,
        referralCode: users.referralCode,
        role: businessOwners.role,
      })
      .from(businessOwners)
      .innerJoin(users, eq(users.id, businessOwners.userId))
      .where(eq(businessOwners.placeId, negocioId))
      .orderBy(
        sql`case when ${businessOwners.role} = 'owner' then 0 else 1 end`,
        users.name,
      ),
    db
      .select({ nota: notasNegocio.nota })
      .from(notasNegocio)
      .where(eq(notasNegocio.placeId, negocioId))
      .limit(1),
    db
      .select({
        id: pagos.id,
        tipo: pagos.tipo,
        clave: pagos.clave,
        montoCentavos: pagos.montoCentavos,
        createdAt: pagos.createdAt,
      })
      .from(pagos)
      .where(and(eq(pagos.negocioId, negocioId), eq(pagos.estado, "pendiente")))
      .orderBy(desc(pagos.createdAt))
      .limit(1),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.eventType, "business_viewed"),
          eq(analyticsEvents.businessId, negocioId),
          gte(analyticsEvents.createdAt, desde30),
        ),
      ),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(pedidos)
      .where(
        and(eq(pedidos.placeId, negocioId), gte(pedidos.createdAt, desde30)),
      ),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(publicaciones)
      .where(
        and(
          eq(publicaciones.negocioId, negocioId),
          eq(publicaciones.semana, semana),
        ),
      ),
    cargarCatalogo(),
    packMedidaVigenteDe(negocioId),
  ]);

  const place = filas[0];
  if (!place) return null;

  const suscripcion = aSuscripcion(filasSuscripcion[0] ?? null);
  const plan = planEfectivo(suscripcion, ahora, cat);
  const precioUsd = usdDe(plan, cat);
  const precioCup = cupDe(precioUsd, cat);
  const duenoRow = duenos[0] ?? null;

  /* Las funciones del pack se suman a las del plan: son dos fuentes de acceso,
     no un reemplazo. Sin esto, la ficha enseñaba topes menores que los reales. */
  const funciones = funcionesDe(suscripcion, ahora, cat);
  for (const funcion of packMedida?.funciones ?? []) {
    funciones.add(funcion as Funcion);
  }

  const puntos = puntosFicha({
    logoUrl: place.logoUrl,
    fotos: (place.imageUrls ?? []).length,
    description: place.description,
    tieneHorario: Boolean(place.horario || place.schedule?.trim()),
    lat: place.latitude,
    lng: place.longitude,
    whatsapp: place.whatsapp,
    phone: place.phone,
  });
  const faltan = puntos
    .filter((punto) => !punto.ok)
    .map((punto) => punto.falta);
  const pct = Math.round(
    (puntos.filter((punto) => punto.ok).length / puntos.length) * 100,
  );

  let ultimaActividad: Date = place.updatedAt;
  if (duenoRow?.authUserId) {
    const [sesion] = await db
      .select({
        ultima: sql<string | Date | null>`max(${authSession.updatedAt})`,
      })
      .from(authSession)
      .where(eq(authSession.userId, duenoRow.authUserId));
    if (sesion?.ultima) {
      const ultimaSesion = new Date(sesion.ultima);
      if (ultimaSesion > ultimaActividad) ultimaActividad = ultimaSesion;
    }
  }

  const idsDuenos = duenos.map((dueno) => dueno.id);
  let abiertas = 0;
  let ultimaConversacion: string | null = null;
  if (idsDuenos.length > 0) {
    const [cuenta, ultima] = await Promise.all([
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(supportTickets)
        .where(
          and(
            inArray(supportTickets.userId, idsDuenos),
            inArray(supportTickets.status, ["open", "in_progress"]),
          ),
        ),
      db
        .select({ id: supportTickets.id })
        .from(supportTickets)
        .where(
          and(
            inArray(supportTickets.userId, idsDuenos),
            inArray(supportTickets.status, ["open", "in_progress"]),
          ),
        )
        .orderBy(desc(supportTickets.createdAt))
        .limit(1),
    ]);
    abiertas = cuenta[0]?.total ?? 0;
    ultimaConversacion = ultima[0]?.id ?? null;
  }

  const pagoPendiente = filasPagoPendiente[0] ?? null;
  const trialHasta = suscripcion?.trialHasta ?? null;
  const venceEn = suscripcion?.venceEn ?? null;
  const trialViva =
    suscripcion?.estado === "activa" &&
    trialHasta !== null &&
    trialHasta > ahora;
  const vencida =
    suscripcion?.estado === "activa" && venceEn !== null && venceEn < ahora;
  const packVence = packMedida?.venceEn ? new Date(packMedida.venceEn) : null;

  const planDelPago = pagoPendiente
    ? PLAN_ORDER.find((clave) => clave === pagoPendiente.clave)
    : undefined;
  const conceptosPago = {
    plan: planDelPago ? `Plan ${nombreDe(planDelPago, cat)}` : "Plan",
    modulo: "Módulo suelto",
    pack_medida: "Pack a medida",
  } as const;

  let pago: Ficha360Admin["pago"];
  if (pagoPendiente) {
    pago = {
      estado: "pendiente",
      etiqueta: "Por confirmar",
      detalle: `${(pagoPendiente.montoCentavos / 100).toLocaleString("es-CU", {
        maximumFractionDigits: 2,
      })} USD · ${conceptosPago[pagoPendiente.tipo]}`,
      montoCentavos: pagoPendiente.montoCentavos,
    };
  } else if (trialViva && trialHasta) {
    const dias = diasHasta(ahora, trialHasta);
    pago = {
      estado: "prueba",
      etiqueta: "En prueba",
      detalle: `${dias === 1 ? "Queda 1 día" : `Quedan ${dias} días`} de prueba · termina el ${fecha(trialHasta)}`,
    };
  } else if (
    packMedida &&
    packVence &&
    (plan === "gratis" || suscripcion?.estado === "cancelada" || vencida)
  ) {
    const precioPack =
      packMedida.precioUsd === null
        ? ""
        : `${packMedida.precioUsd.toLocaleString("es-CU", { maximumFractionDigits: 2 })} USD/mes · `;
    pago = {
      estado: "al_dia",
      etiqueta: "Pack activo",
      detalle: `${precioPack}Activo hasta el ${fecha(packVence)}${
        suscripcion?.estado === "cancelada"
          ? " · Suscripción estándar cancelada"
          : ""
      }.`,
    };
  } else if (suscripcion?.estado === "cancelada") {
    pago = {
      estado: "cancelada",
      etiqueta: "Cancelado",
      detalle: "La suscripción está cancelada desde administración.",
    };
  } else if (vencida && venceEn) {
    const dias = diasDesde(venceEn, ahora);
    pago = {
      estado: "vencida",
      etiqueta: "Vencido",
      detalle: `Venció el ${fecha(venceEn)} · ${dias === 1 ? "hace 1 día" : `hace ${dias} días`}`,
    };
  } else if (plan === "gratis") {
    pago = {
      estado: "gratis",
      etiqueta: "Gratis",
      detalle: "Sin plan de pago. La ficha sigue publicada con lo de Gratis.",
    };
  } else {
    pago = {
      estado: "al_dia",
      etiqueta: "Al día",
      detalle: venceEn
        ? `Renueva el ${fecha(venceEn)}`
        : "Sin fecha de vencimiento.",
    };
  }

  const telefonoDueno = normalizarTelefono(
    duenoRow?.phone ?? place.whatsapp ?? place.phone ?? "",
  );
  const whatsappHref = telefonoDueno
    ? `https://wa.me/${telefonoDueno.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Hola ${duenoRow?.name?.trim() || place.name}, te escribimos de La Verde.`,
      )}`
    : null;

  const estadoPublicacion: EstadoPublicacionFicha =
    place.reviewStatus === "pending"
      ? "pendiente"
      : place.reviewStatus === "rejected"
        ? "rechazado"
        : !place.isActive
          ? "oculto"
          : place.status === "closed"
            ? "cerrado"
            : place.status === "temporary_closed"
              ? "temporal"
              : "publicado";

  return {
    id: place.id,
    name: place.name,
    slug: place.slug,
    logoUrl: place.logoUrl,
    imageUrls: place.imageUrls ?? [],
    description: place.description,
    city: place.city,
    province: place.province,
    neighborhood: place.neighborhood,
    address: place.address,
    tipo: place.tipoNegocio,
    tipoLabel: place.tipoNegocio
      ? TIPO_NEGOCIO_LABEL[place.tipoNegocio]
      : "Sin tipo",
    categoria: place.categoria,
    estadoPublicacion,
    isActive: place.isActive,
    reviewStatus: place.reviewStatus,
    status: place.status,
    isBoosted: place.isBoosted,
    verificado: place.verificado,
    plan: {
      efectivo: plan,
      nombre: nombreDe(plan, cat),
      contratado: suscripcion?.plan ?? "gratis",
      contratadoNombre: nombreDe(suscripcion?.plan ?? "gratis", cat),
      estado: suscripcion?.estado ?? "activa",
      trialHasta: fecha(trialHasta),
      venceEn: fecha(venceEn),
      precioUsd,
      precioCup,
    },
    packMedida,
    pago,
    completitud: { pct, faltan },
    metricas: {
      visitas30: visitas[0]?.total ?? 0,
      pedidos30: pedidos30[0]?.total ?? 0,
      publicacionesUsadas: publicacionesSemana[0]?.total ?? 0,
      publicacionesTope: limiteDe(funciones, "publicaciones_semana", cat),
    },
    dueno: duenoRow
      ? {
          id: duenoRow.id,
          nombre: duenoRow.name?.trim() || duenoRow.email,
          email: duenoRow.email,
          telefono: duenoRow.phone,
          whatsappHref,
        }
      : null,
    ultimaActividad: fecha(ultimaActividad),
    afiliado: duenoRow?.referralCode ?? null,
    alta: fecha(place.createdAt) ?? "",
    soporte: { abiertas, ultimaId: ultimaConversacion },
    nota: filasNota[0]?.nota ?? "",
    planes: PLAN_ORDER.map((clave) => ({
      id: clave,
      nombre: nombreDe(clave, cat),
    })),
  };
}
