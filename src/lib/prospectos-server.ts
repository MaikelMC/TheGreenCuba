import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { places, prospectos, users } from "@/lib/db/schema";
import type {
  AdminProspecto,
  ProspectoAdmin,
} from "@/lib/prospectos";

/**
 * La lectura de prospectos para administración.
 *
 * El tablero necesita el nombre del responsable y del negocio, no solo sus
 * identificadores. Se resuelve aquí, en el servidor, para que el cliente no
 * tenga que cruzar tres listas ni pedir usuarios y negocios por su cuenta.
 */

const seleccion = {
  id: prospectos.id,
  nombre: prospectos.nombre,
  provincia: prospectos.provincia,
  origen: prospectos.origen,
  origenDetalle: prospectos.origenDetalle,
  etapa: prospectos.etapa,
  proximoPaso: prospectos.proximoPaso,
  proximoPasoEn: prospectos.proximoPasoEn,
  notas: prospectos.notas,
  adminResponsableId: prospectos.adminResponsableId,
  adminNombre: users.name,
  adminEmail: users.email,
  negocioId: prospectos.negocioId,
  negocioNombre: places.name,
  etapaCambiadaEn: prospectos.etapaCambiadaEn,
  createdAt: prospectos.createdAt,
  updatedAt: prospectos.updatedAt,
};

type Fila = {
  id: string;
  nombre: string;
  provincia: string;
  origen: ProspectoAdmin["origen"];
  origenDetalle: string | null;
  etapa: ProspectoAdmin["etapa"];
  proximoPaso: string;
  proximoPasoEn: Date | null;
  notas: string;
  adminResponsableId: string | null;
  adminNombre: string | null;
  adminEmail: string | null;
  negocioId: string | null;
  negocioNombre: string | null;
  etapaCambiadaEn: Date;
  createdAt: Date;
  updatedAt: Date;
};

function serializar(fila: Fila): ProspectoAdmin {
  return {
    id: fila.id,
    nombre: fila.nombre,
    provincia: fila.provincia,
    origen: fila.origen,
    origenDetalle: fila.origenDetalle,
    etapa: fila.etapa,
    proximoPaso: fila.proximoPaso,
    proximoPasoEn: fila.proximoPasoEn?.toISOString() ?? null,
    notas: fila.notas,
    adminResponsableId: fila.adminResponsableId,
    adminResponsableNombre: fila.adminNombre ?? fila.adminEmail,
    negocioId: fila.negocioId,
    negocioNombre: fila.negocioNombre,
    etapaCambiadaEn: fila.etapaCambiadaEn.toISOString(),
    createdAt: fila.createdAt.toISOString(),
    updatedAt: fila.updatedAt.toISOString(),
  };
}

export async function listarProspectosAdmin(): Promise<ProspectoAdmin[]> {
  const filas = await db
    .select(seleccion)
    .from(prospectos)
    .leftJoin(users, eq(users.id, prospectos.adminResponsableId))
    .leftJoin(places, eq(places.id, prospectos.negocioId))
    .orderBy(desc(prospectos.updatedAt));
  return filas.map(serializar);
}

export async function obtenerProspectoAdmin(
  id: string,
): Promise<ProspectoAdmin | null> {
  const [fila] = await db
    .select(seleccion)
    .from(prospectos)
    .leftJoin(users, eq(users.id, prospectos.adminResponsableId))
    .leftJoin(places, eq(places.id, prospectos.negocioId))
    .where(eq(prospectos.id, id))
    .limit(1);
  return fila ? serializar(fila) : null;
}

export async function listarAdminsProspecto(): Promise<AdminProspecto[]> {
  const filas = await db
    .select({ id: users.id, nombre: users.name, email: users.email })
    .from(users)
    .where(eq(users.role, "admin"))
    .orderBy(asc(users.name));
  return filas.map((fila) => ({
    id: fila.id,
    nombre: fila.nombre?.trim() || fila.email,
    email: fila.email,
  }));
}
