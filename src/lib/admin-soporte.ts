import { and, asc, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { getAppUser } from "@/lib/auth/user";
import { listarAdmins } from "@/lib/admin-contadores";
import { cargarCatalogo } from "@/lib/catalogo-server";
import { db } from "@/lib/db";
import {
  businessOwners,
  places,
  supportSavedReplies,
  supportTickets,
  suscripciones,
  users,
} from "@/lib/db/schema";
import { TIPO_NEGOCIO_LABEL } from "@/lib/ficha/tipos";
import { aSuscripcion, nombreDe, planEfectivo } from "@/lib/plans";
import { revisarSolicitud } from "@/lib/revision-solicitud";

/**
 * Datos de Soporte, calculados en el servidor.
 *
 * El ticket es una conversación de una sola respuesta (la app envía la
 * consulta y administración contesta por correo), pero para atenderlo hacen
 * falta tres cosas que no viven en `support_tickets`: quién lo lleva, qué
 * negocio hay detrás y cuánto se tarda en contestar. Todo se resuelve aquí en
 * dos consultas por lote, no una por fila.
 */

export type TonoSoporte = "ok" | "aviso" | "error" | "info" | "neutra";

export interface NegocioSoporte {
  id: string;
  nombre: string;
  ciudad: string;
  provincia: string;
  tipo: string;
  plan: string;
  estado: string;
  tono: TonoSoporte;
  /** Por qué escribe, según el estado real de su ficha. */
  motivo: string;
  /** Lo que impide aprobarla, si está en Solicitudes. */
  faltan: string[];
  puedeAprobar: boolean;
  reviewStatus: string;
  isActive: boolean;
}

export interface ConversacionSoporte {
  id: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  adminReply: string | null;
  repliedAt: string | null;
  pagePath: string | null;
  email: string;
  userSnapshot: { name: string | null; email: string } | null;
  createdAt: string;
  updatedAt: string;
  assignedAdminId: string | null;
  assignedAdminName: string | null;
  negocio: NegocioSoporte | null;
}

export interface AdminSoporte {
  id: string;
  nombre: string;
  email: string;
}

export interface TiempoMedioRespuesta {
  minutos: number;
  respuestas: number;
}

export interface RespuestaGuardada {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface DatosSoporteAdmin {
  tickets: ConversacionSoporte[];
  admins: AdminSoporte[];
  yo: AdminSoporte | null;
  tiempoMedioRespuesta: TiempoMedioRespuesta | null;
  abiertas: number;
  sinAsignar: number;
  mias: number;
}

type FilaNegocio = {
  userId: string;
  placeId: string;
  name: string;
  city: string;
  province: string;
  tipoNegocio: string | null;
  imageUrls: string[] | null;
  horario: unknown;
  hoursJson: Record<string, unknown> | null;
  lat: number;
  lng: number;
  reviewStatus: string;
  isActive: boolean;
  status: string;
  plan: "gratis" | "esencial" | "publicidad_max" | "pro" | null;
  planEstado: "activa" | "cancelada" | null;
  trialHasta: Date | null;
  venceEn: Date | null;
  modulos: { clave: string; desde: string; hasta: string | null }[] | null;
};

function ubicacionEnCuba(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 18 &&
    lat <= 24 &&
    lng >= -85 &&
    lng <= -74
  );
}

function estadoDelNegocio(fila: FilaNegocio): {
  etiqueta: string;
  tono: TonoSoporte;
  motivo: string;
} {
  if (fila.reviewStatus === "pending") {
    return {
      etiqueta: "En Solicitudes",
      tono: "aviso",
      motivo: "Su ficha está pendiente en Solicitudes.",
    };
  }

  if (fila.reviewStatus === "rejected") {
    return {
      etiqueta: "Rechazada",
      tono: "error",
      motivo: "Su ficha fue rechazada; puede corregirla y enviarla de nuevo.",
    };
  }

  if (!fila.isActive) {
    return {
      etiqueta: "Oculta",
      tono: "neutra",
      motivo: "Su ficha no está publicada en este momento.",
    };
  }

  if (fila.status === "closed") {
    return {
      etiqueta: "Cerrada",
      tono: "neutra",
      motivo: "Su negocio figura como cerrado.",
    };
  }

  if (fila.status === "temporary_closed") {
    return {
      etiqueta: "Cerrada temporalmente",
      tono: "aviso",
      motivo: "Su negocio está en cierre temporal.",
    };
  }

  return {
    etiqueta: "Publicada",
    tono: "ok",
    motivo: "Su ficha está publicada.",
  };
}

async function contextosDeUsuarios(
  userIds: string[],
): Promise<Map<string, NegocioSoporte>> {
  const contexto = new Map<string, NegocioSoporte>();
  if (userIds.length === 0) return contexto;

  const [filas, catalogo] = await Promise.all([
    db
      .select({
        userId: businessOwners.userId,
        placeId: places.id,
        name: places.name,
        city: places.city,
        province: places.province,
        tipoNegocio: places.tipoNegocio,
        imageUrls: places.imageUrls,
        horario: places.horario,
        hoursJson: places.hoursJson,
        lat: places.lat,
        lng: places.lng,
        reviewStatus: places.reviewStatus,
        isActive: places.isActive,
        status: places.status,
        plan: suscripciones.plan,
        planEstado: suscripciones.estado,
        trialHasta: suscripciones.trialHasta,
        venceEn: suscripciones.venceEn,
        modulos: suscripciones.modulos,
      })
      .from(businessOwners)
      .innerJoin(places, eq(places.id, businessOwners.placeId))
      .leftJoin(suscripciones, eq(suscripciones.negocioId, places.id))
      .where(inArray(businessOwners.userId, userIds))
      .orderBy(
        sql`case when ${businessOwners.role} = 'owner' then 0 else 1 end`,
        asc(places.name),
      ),
    cargarCatalogo(),
  ]);

  const ahora = new Date();
  for (const fila of filas as FilaNegocio[]) {
    /* Si una persona tiene varios negocios, el ticket habla del primero: el
       rol de dueño manda y, dentro de ese, el nombre ordena. */
    if (contexto.has(fila.userId)) continue;

    const suscripcion = fila.plan
      ? aSuscripcion({
          plan: fila.plan,
          estado: fila.planEstado ?? "activa",
          trialHasta: fila.trialHasta,
          venceEn: fila.venceEn,
          modulos: fila.modulos ?? [],
        })
      : null;
    const plan = planEfectivo(suscripcion, ahora, catalogo);

    const revision = revisarSolicitud({
      fotos: fila.imageUrls?.length ?? 0,
      tieneHorario:
        Boolean(fila.horario) || Object.keys(fila.hoursJson ?? {}).length > 0,
      ubicacionValida: ubicacionEnCuba(fila.lat, fila.lng),
      tipo: fila.tipoNegocio,
      telefonoDuplicado: false,
    });
    const estado = estadoDelNegocio(fila);

    contexto.set(fila.userId, {
      id: fila.placeId,
      nombre: fila.name,
      ciudad: fila.city,
      provincia: fila.province,
      tipo: fila.tipoNegocio
        ? TIPO_NEGOCIO_LABEL[fila.tipoNegocio as keyof typeof TIPO_NEGOCIO_LABEL]
        : "Sin tipo",
      plan: nombreDe(plan, catalogo),
      estado: estado.etiqueta,
      tono: estado.tono,
      motivo: estado.motivo,
      faltan: fila.reviewStatus === "pending" ? revision.faltan : [],
      /* La misma regla que Solicitudes: el tipo es lo único que bloquea la
         aprobación; las fotos y el horario se avisan, no se impiden. */
      puedeAprobar: fila.reviewStatus === "pending" && Boolean(fila.tipoNegocio),
      reviewStatus: fila.reviewStatus,
      isActive: fila.isActive,
    });
  }

  return contexto;
}

async function tiempoMedioDeLaSemana(): Promise<TiempoMedioRespuesta | null> {
  const haceSieteDias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [fila] = await db
    .select({
      minutos: sql<number | null>`avg(extract(epoch from (${supportTickets.repliedAt} - ${supportTickets.createdAt})) / 60)`,
      respuestas: sql<number>`count(*)::int`,
    })
    .from(supportTickets)
    .where(
      and(
        isNotNull(supportTickets.repliedAt),
        gte(supportTickets.repliedAt, haceSieteDias),
      ),
    );

  if (!fila || fila.respuestas === 0 || fila.minutos === null) return null;

  return {
    minutos: Math.max(0, Math.round(Number(fila.minutos))),
    respuestas: fila.respuestas,
  };
}

/** Las conversaciones, sus administradores y los totales que pinta la cabecera. */
export async function cargarSoporteAdmin(): Promise<DatosSoporteAdmin> {
  const [filas, admins, usuario, tiempoMedioRespuesta] = await Promise.all([
    db
      .select({
        id: supportTickets.id,
        userId: supportTickets.userId,
        subject: supportTickets.subject,
        message: supportTickets.message,
        status: supportTickets.status,
        adminReply: supportTickets.adminReply,
        repliedAt: supportTickets.repliedAt,
        pagePath: supportTickets.pagePath,
        email: supportTickets.email,
        userSnapshot: supportTickets.userSnapshot,
        createdAt: supportTickets.createdAt,
        updatedAt: supportTickets.updatedAt,
        assignedAdminId: supportTickets.assignedAdminId,
        assignedAdminName: users.name,
        assignedAdminEmail: users.email,
      })
      .from(supportTickets)
      .leftJoin(users, eq(users.id, supportTickets.assignedAdminId))
      .orderBy(
        sql`case when ${supportTickets.status} in ('open','in_progress') then 0 else 1 end`,
        sql`case when ${supportTickets.status} in ('open','in_progress') then ${supportTickets.createdAt} end asc nulls last`,
        desc(supportTickets.createdAt),
      )
      .limit(200),
    listarAdmins(20),
    getAppUser(),
    tiempoMedioDeLaSemana(),
  ]);

  const userIds = [
    ...new Set(
      filas
        .map((fila) => fila.userId)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];
  const contextos = await contextosDeUsuarios(userIds);

  const tickets: ConversacionSoporte[] = filas.map((fila) => ({
    id: fila.id,
    subject: fila.subject,
    message: fila.message,
    status: fila.status,
    adminReply: fila.adminReply,
    repliedAt: fila.repliedAt?.toISOString() ?? null,
    pagePath: fila.pagePath,
    email: fila.email,
    userSnapshot: fila.userSnapshot ?? null,
    createdAt: fila.createdAt.toISOString(),
    updatedAt: fila.updatedAt.toISOString(),
    assignedAdminId: fila.assignedAdminId,
    assignedAdminName:
      fila.assignedAdminName?.trim() ||
      fila.assignedAdminEmail?.split("@")[0] ||
      null,
    negocio: fila.userId ? (contextos.get(fila.userId) ?? null) : null,
  }));

  const abiertas = tickets.filter(
    (ticket) => ticket.status === "open" || ticket.status === "in_progress",
  );

  return {
    tickets,
    admins: admins.map((admin) => ({
      id: admin.id,
      nombre: admin.name,
      email: admin.email,
    })),
    yo: usuario
      ? {
          id: usuario.id,
          nombre: usuario.name?.trim() || usuario.email,
          email: usuario.email,
        }
      : null,
    tiempoMedioRespuesta,
    abiertas: abiertas.length,
    sinAsignar: abiertas.filter((ticket) => !ticket.assignedAdminId).length,
    mias: usuario
      ? abiertas.filter((ticket) => ticket.assignedAdminId === usuario.id).length
      : 0,
  };
}

export async function listarRespuestasGuardadas(): Promise<RespuestaGuardada[]> {
  const filas = await db
    .select()
    .from(supportSavedReplies)
    .orderBy(desc(supportSavedReplies.updatedAt))
    .limit(50);

  return filas.map((fila) => ({
    id: fila.id,
    title: fila.title,
    body: fila.body,
    createdAt: fila.createdAt.toISOString(),
    updatedAt: fila.updatedAt.toISOString(),
  }));
}
