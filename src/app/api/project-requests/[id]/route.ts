import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { CATALOG_TAG } from "@/lib/db/queries";
import { notifications, projectRequests } from "@/lib/db/schema";
import type { ProjectOfferPackage } from "@/lib/db/schema/project_requests";
import { revalidateTag } from "next/cache";

function stringList(value: unknown, maxItems = 20): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return null;
  return value.map((item) => (item as string).trim()).filter(Boolean).slice(0, maxItems);
}

function validPoint(lat: unknown, lng: unknown): lat is number {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && lat >= 18 && lat <= 24 && lng >= -85 && lng <= -74;
}

function parseOfferPackages(value: unknown): ProjectOfferPackage[] | null {
  if (!Array.isArray(value) || value.length > 20) return null;
  const ids = new Set<string>();
  const packages: ProjectOfferPackage[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.id !== "string" || !candidate.id.trim() || ids.has(candidate.id)) return null;
    if (typeof candidate.title !== "string" || !candidate.title.trim() || candidate.title.length > 120) return null;
    if (typeof candidate.price !== "string" || candidate.price.length > 100) return null;
    if (!Array.isArray(candidate.includes) || candidate.includes.length > 12 || candidate.includes.some((entry) => typeof entry !== "string" || entry.length > 1000)) return null;
    const capacity = candidate.capacity === undefined ? null : candidate.capacity;
    if (capacity !== null && (typeof capacity !== "number" || !Number.isInteger(capacity) || capacity < 1 || capacity > 100000)) return null;
    if (typeof candidate.conditions !== "string" || candidate.conditions.length > 1200) return null;
    if (typeof candidate.validUntil !== "string" || (candidate.validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(candidate.validUntil))) return null;

    ids.add(candidate.id);
    packages.push({
      id: candidate.id.trim(),
      title: candidate.title.trim(),
      price: candidate.price.trim(),
      includes: candidate.includes.map((entry: string) => entry.trim()).filter(Boolean),
      capacity,
      conditions: candidate.conditions.trim(),
      validUntil: candidate.validUntil,
    });
  }

  return packages;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });

  const [project] = await db.select().from(projectRequests).where(eq(projectRequests.id, id)).limit(1);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const isAdmin = user.role === "admin";
  if (!isAdmin && project.userId !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const statusValue = body.status;
  if (!isAdmin && statusValue !== undefined) {
    return NextResponse.json({ error: "Solo administración puede cambiar el estado." }, { status: 403 });
  }
  if (statusValue !== undefined && statusValue !== "approved" && statusValue !== "rejected" && statusValue !== "pending") {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }
  const status = statusValue as "approved" | "rejected" | "pending" | undefined;
  const updates: Partial<typeof projectRequests.$inferInsert> = { updatedAt: new Date() };

  if (status) {
    updates.status = status;
    updates.adminNote = status === "rejected" && typeof body.adminNote === "string"
      ? body.adminNote.trim().slice(0, 1000) || null
      : null;
  }

  const textFields = [
    ["name", 160],
    ["description", 2000],
    ["contact", 200],
    ["venueName", 200],
    ["startsAt", 30],
    ["endsAt", 30],
  ] as const;
  for (const [key, max] of textFields) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== "string" || !body[key].trim()) {
      return NextResponse.json({ error: `El campo ${key} es obligatorio.` }, { status: 400 });
    }
    const value = (body[key] as string).trim().slice(0, max);
    if (key === "name") updates.name = value;
    else if (key === "description") updates.description = value;
    else if (key === "contact") updates.contact = value;
    else if (key === "venueName") updates.venueName = value;
    else if (key === "startsAt") updates.startsAt = value;
    else updates.endsAt = value;
  }

  for (const [key, column, maxItems] of [
    ["phones", "phones", 10],
    ["socialLinks", "socialLinks", 20],
    ["provinces", "provinces", 16],
  ] as const) {
    if (body[key] === undefined) continue;
    const values = stringList(body[key], maxItems);
    if (!values || ((key === "phones" || key === "provinces") && values.length === 0)) {
      return NextResponse.json({ error: `La lista ${key} no es válida.` }, { status: 400 });
    }
    if (column === "phones") updates.phones = values;
    else if (column === "socialLinks") updates.socialLinks = values;
    else updates.provinces = values;
  }

  if (body.offers !== undefined) {
    if (body.offers !== null && typeof body.offers !== "string") {
      return NextResponse.json({ error: "Las ofertas no son válidas." }, { status: 400 });
    }
    updates.offers = typeof body.offers === "string" ? body.offers.trim().slice(0, 2000) || null : null;
  }

  if (body.offerPackages !== undefined) {
    const offerPackages = parseOfferPackages(body.offerPackages);
    if (!offerPackages) return NextResponse.json({ error: "Revisa los paquetes: hay datos incompletos o inválidos." }, { status: 400 });
    updates.offerPackages = offerPackages;
  }

  if (!isAdmin && Object.keys(updates).some((key) => key !== "updatedAt")) {
    updates.status = "pending";
    updates.adminNote = null;
  }

  if (body.lat !== undefined || body.lng !== undefined) {
    if (!validPoint(body.lat, body.lng)) {
      return NextResponse.json({ error: "Las coordenadas deben señalar un punto en Cuba." }, { status: 400 });
    }
    updates.lat = body.lat;
    updates.lng = body.lng as number;
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: "No hay cambios para guardar." }, { status: 400 });
  }

  const [updated] = await db.update(projectRequests).set(updates).where(eq(projectRequests.id, id)).returning();
  if (!updated) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const rejected = updated.status === "rejected";
  const title = rejected
    ? "Proyecto no aprobado"
    : updated.status === "approved"
      ? "Proyecto aprobado"
      : updated.status === "pending" && project.status !== "pending"
        ? "Proyecto devuelto a revisión"
        : "Proyecto actualizado";
  const message = rejected
    ? updated.adminNote
      ? `Tu proyecto «${updated.name}» no fue aprobado. Motivo: ${updated.adminNote}`
      : `Tu proyecto «${updated.name}» fue revisado y no aprobado. Puedes corregir los datos y enviarlo nuevamente.`
    : updated.status === "approved"
      ? `Tu proyecto «${updated.name}» fue aprobado y ya está publicado.`
      : updated.status === "pending" && project.status !== "pending"
        ? `Tu proyecto «${updated.name}» volvió a revisión por el equipo de La Verde.`
        : `El equipo de La Verde actualizó la información de tu proyecto «${updated.name}».`;

  if (isAdmin) {
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      userId: updated.userId,
      type: rejected ? "project_rejected" : updated.status === "approved" ? "project_approved" : "project_updated",
      title,
      message,
    });
  }
  revalidateTag(CATALOG_TAG, "max");
  return NextResponse.json(updated);
}

/**
 * Elimina un proyecto.
 *
 * Solo administración, y por eso la comprobación es de rol y no de propiedad
 * como en el `PATCH`: el dueño tiene «devolverlo a solicitudes», que lo deja
 * corregible; borrar es irreversible y no se le ofrece. Nada apunta a esta
 * tabla —`notifications.place_id` es de `places`— así que el `delete` no deja
 * filas colgando. Se invalida el catálogo porque el home lo cachea.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Solo administración puede eliminar proyectos." }, { status: 403 });
  }

  const { id } = await params;
  const [row] = await db
    .delete(projectRequests)
    .where(eq(projectRequests.id, id))
    .returning({ id: projectRequests.id });

  if (!row) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  revalidateTag(CATALOG_TAG, "max");
  return NextResponse.json({ id: row.id });
}