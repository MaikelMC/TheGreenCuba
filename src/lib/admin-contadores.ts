import {
  and,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/lib/db";
import {
  diagnosticos,
  pagos,
  places,
  projectRequests,
  publicaciones,
  supportTickets,
  suscripciones,
  users,
} from "@/lib/db/schema";

/**
 * Los contadores de la navegación del panel, en una sola función.
 *
 * Todo se cuenta en la base con `count(*)` y todas las consultas van en
 * paralelo. Nada de traer tablas al cliente para contarlas: la barra lateral se
 * refresca al volver a la pestaña y después de cada acción, así que esto tiene
 * que costar milisegundos.
 *
 * `pendientes` es la suma de la bandeja que llegará en la Fase 2. Mientras esa
 * sección no exista, el número sigue sirviendo como aviso global.
 */
export interface ContadoresAdmin {
  pendientes: number;
  solicitudes: number;
  conversaciones: number;
  publicaciones: number;
  cobros: number;
  pruebas: number;
  fichas: number;
  diagnostico: number;
  admins: number;
}

export const CONTADORES_VACIOS: ContadoresAdmin = {
  pendientes: 0,
  solicitudes: 0,
  conversaciones: 0,
  publicaciones: 0,
  cobros: 0,
  pruebas: 0,
  fichas: 0,
  diagnostico: 0,
  admins: 0,
};

const total = sql<number>`count(*)::int`;

export async function contarPendientesAdmin(): Promise<ContadoresAdmin> {
  const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const ahora = new Date();
  const enSieteDias = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);
  const haceTreintaDias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    negociosPendientes,
    proyectosPendientes,
    conversaciones,
    colaPublicaciones,
    pagosPendientes,
    suscripcionesVencidas,
    pruebasPorVencer,
    fichasConProblemas,
    erroresMapa,
    admins,
  ] = await Promise.all([
    db.select({ total }).from(places).where(eq(places.reviewStatus, "pending")),
    db
      .select({ total })
      .from(projectRequests)
      .where(eq(projectRequests.status, "pending")),
    db
      .select({ total })
      .from(supportTickets)
      .where(inArray(supportTickets.status, ["open", "in_progress"])),
    db
      .select({ total })
      .from(publicaciones)
      .where(ne(publicaciones.estado, "publicada")),
    db.select({ total }).from(pagos).where(eq(pagos.estado, "pendiente")),
    db
      .select({ total })
      .from(suscripciones)
      .where(
        and(
          eq(suscripciones.estado, "activa"),
          ne(suscripciones.plan, "gratis"),
          lt(suscripciones.venceEn, ahora),
        ),
      ),
    db
      .select({ total })
      .from(suscripciones)
      .where(
        and(
          eq(suscripciones.estado, "activa"),
          gte(suscripciones.trialHasta, ahora),
          lte(suscripciones.trialHasta, enSieteDias),
        ),
      ),
    db
      .select({ total })
      .from(places)
      .where(
        and(
          eq(places.reviewStatus, "approved"),
          eq(places.isActive, true),
          eq(places.status, "active"),
          or(
            isNull(places.tipoNegocio),
            sql`coalesce(array_length(${places.imageUrls}, 1), 0) = 0`,
            lt(places.updatedAt, haceTreintaDias),
          ),
        ),
      ),
    db
      .select({ total })
      .from(diagnosticos)
      .where(
        and(
          eq(diagnosticos.tipo, "mapa_error"),
          gte(diagnosticos.creadoEn, desde),
        ),
      ),
    db.select({ total }).from(users).where(eq(users.role, "admin")),
  ]);

  const solicitudes =
    (negociosPendientes[0]?.total ?? 0) + (proyectosPendientes[0]?.total ?? 0);
  const abiertas = conversaciones[0]?.total ?? 0;
  const enCola = colaPublicaciones[0]?.total ?? 0;
  const cobros =
    (pagosPendientes[0]?.total ?? 0) + (suscripcionesVencidas[0]?.total ?? 0);
  const pruebas = pruebasPorVencer[0]?.total ?? 0;
  const fichas = fichasConProblemas[0]?.total ?? 0;
  const diagnostico = erroresMapa[0]?.total ?? 0;

  return {
    pendientes:
      solicitudes +
      abiertas +
      enCola +
      cobros +
      pruebas +
      fichas +
      (diagnostico > 0 ? 1 : 0),
    solicitudes,
    conversaciones: abiertas,
    publicaciones: enCola,
    cobros,
    pruebas,
    fichas,
    diagnostico,
    admins: admins[0]?.total ?? 0,
  };
}

export interface AdminDelPanel {
  id: string;
  name: string;
  email: string;
  imageUrl: string | null;
}

/** Los administradores reales, para el pie de la barra lateral. */
export async function listarAdmins(limite = 4): Promise<AdminDelPanel[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      imageUrl: users.imageUrl,
    })
    .from(users)
    .where(eq(users.role, "admin"))
    .orderBy(users.createdAt)
    .limit(limite);

  return rows.map((row) => ({
    id: row.id,
    name: row.name?.trim() || row.email.split("@")[0] || row.email,
    email: row.email,
    imageUrl: row.imageUrl ?? null,
  }));
}
