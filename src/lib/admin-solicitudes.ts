import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { businessOwners, places } from "@/lib/db/schema";
import {
  revisarSolicitud,
  type RevisionSolicitud,
} from "@/lib/revision-solicitud";
import { normalizarTelefono } from "@/lib/telefono";

/**
 * La revisión de las solicitudes pendientes, en el servidor.
 *
 * La regla vive en `revisarSolicitud`; aquí solo se cruzan los datos que esa
 * función no puede ver sola: teléfonos normalizados de todo el catálogo y
 * negocios del mismo dueño. El panel de Solicitudes recibe el resultado ya
 * calculado y no repite ninguna comprobación en el navegador.
 */

export type RevisionSolicitudAdmin = {
  id: string;
  revision: RevisionSolicitud;
  /** Nombres de otros negocios que usan el mismo teléfono. */
  telefonoDuplicadoCon: string[];
  /** Nombres de otros negocios del mismo dueño. Informativo. */
  mismoDuenoCon: string[];
};

type FilaPendiente = {
  id: string;
  imageUrls: string[] | null;
  horario: unknown;
  hoursJson: Record<string, unknown> | null;
  lat: number;
  lng: number;
  tipoNegocio: string | null;
  phone: string | null;
};

type FilaTelefono = {
  id: string;
  name: string;
  phone: string | null;
};

type FilaDueno = {
  placeId: string;
  userId: string;
};

type FilaPropiedad = {
  placeId: string;
  userId: string;
  name: string;
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

export async function cargarRevisionesSolicitudes(): Promise<
  RevisionSolicitudAdmin[]
> {
  const pendientes = await db
    .select({
      id: places.id,
      imageUrls: places.imageUrls,
      horario: places.horario,
      hoursJson: places.hoursJson,
      lat: places.lat,
      lng: places.lng,
      tipoNegocio: places.tipoNegocio,
      phone: places.phone,
    })
    .from(places)
    .where(eq(places.reviewStatus, "pending"))
    .orderBy(asc(places.createdAt));

  if (pendientes.length === 0) return [];

  const ids = pendientes.map((fila) => fila.id);

  const [telefonos, duenos] = await Promise.all([
    db
      .select({ id: places.id, name: places.name, phone: places.phone })
      .from(places)
      .where(isNotNull(places.phone)),
    db
      .select({
        placeId: businessOwners.placeId,
        userId: businessOwners.userId,
      })
      .from(businessOwners)
      .where(
        and(
          inArray(businessOwners.placeId, ids),
          eq(businessOwners.role, "owner"),
        ),
      ),
  ]);

  const userIds = [...new Set(duenos.map((fila) => fila.userId))];
  const propiedades: FilaPropiedad[] = userIds.length
    ? await db
        .select({
          placeId: businessOwners.placeId,
          userId: businessOwners.userId,
          name: places.name,
        })
        .from(businessOwners)
        .innerJoin(places, eq(places.id, businessOwners.placeId))
        .where(
          and(
            inArray(businessOwners.userId, userIds),
            eq(businessOwners.role, "owner"),
          ),
        )
        .orderBy(asc(places.name))
    : [];

  const porTelefono = new Map<string, { id: string; name: string }[]>();
  for (const fila of telefonos as FilaTelefono[]) {
    if (!fila.phone) continue;
    const normalizado = normalizarTelefono(fila.phone);
    if (!normalizado) continue;
    const lista = porTelefono.get(normalizado) ?? [];
    lista.push({ id: fila.id, name: fila.name });
    porTelefono.set(normalizado, lista);
  }

  return pendientes.map((fila: FilaPendiente) => {
    const normalizado = fila.phone ? normalizarTelefono(fila.phone) : null;
    const telefonoDuplicadoCon = normalizado
      ? (porTelefono.get(normalizado) ?? [])
          .filter((otro) => otro.id !== fila.id)
          .map((otro) => otro.name)
      : [];

    const duenosDelLugar = new Set(
      duenos
        .filter((dueno) => dueno.placeId === fila.id)
        .map((dueno) => dueno.userId),
    );
    const mismoDuenoCon = [
      ...new Set(
        propiedades
          .filter(
            (propiedad) =>
              duenosDelLugar.has(propiedad.userId) &&
              propiedad.placeId !== fila.id,
          )
          .map((propiedad) => propiedad.name),
      ),
    ];

    return {
      id: fila.id,
      revision: revisarSolicitud({
        fotos: fila.imageUrls?.length ?? 0,
        tieneHorario:
          Boolean(fila.horario) || Object.keys(fila.hoursJson ?? {}).length > 0,
        ubicacionValida: ubicacionEnCuba(fila.lat, fila.lng),
        tipo: fila.tipoNegocio,
        telefonoDuplicado: telefonoDuplicadoCon.length > 0,
        mismoDueno: mismoDuenoCon.length > 0,
      }),
      telefonoDuplicadoCon: [...new Set(telefonoDuplicadoCon)],
      mismoDuenoCon,
    };
  });
}
