import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { canManagePlace, isAdminRequest } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { businessOwners, notifications, places } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";
import { toPlaceValues, toUserPlace } from "@/lib/db/mappers";
import { CATALOG_TAG, getPlaceById, resolveCategoryId } from "@/lib/db/queries";
import type { UserPlace } from "@/lib/places-store";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const place = await getPlaceById(id);
  if (!place) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }
  return NextResponse.json(place);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;

  /* El `id` se resuelve **antes** de la comprobación, y no después como estaba:
     `canManagePlace` necesita saber de qué negocio se habla para decidir. El
     dueño guarda su ficha desde el panel y es `owner`, no `admin`, así que la
     comprobación de antes le devolvía un 401 en cada guardado. */
  if (!(await canManagePlace(req, id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: Partial<UserPlace>;
  try {
    body = (await req.json()) as Partial<UserPlace>;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  /* Publicar es cosa de administración, y por eso se tira el campo si quien
     llama no lo es. `canManagePlace` deja pasar al dueño —tiene que poder
     corregir su ficha—, y el dueño que espera aprobación tiene la misma sesión
     que tendrá después: con esto fuera, un `PATCH {"isActive": true}` desde la
     consola se publicaba solo y la revisión no valía nada. El panel del dueño
     no manda ese campo, así que aquí no se pierde nada.

     `plan` va en el mismo saco y por la misma razón: lo elige el dueño **al
     darse de alta**, por `/api/business`, que es la que valida la lista de
     planes; desde aquí no. Hoy solo pinta una etiqueta en el panel, pero el día
     que un plan abra funciones de pago este es el `PATCH` que se regalaría el
     ascenso.

     La comprobación va solo cuando alguno de los dos campos viene, que es el
     caso raro: la aprobación desde `/admin` y los scripts con `x-admin-key`. */
  if (
    (body.isActive !== undefined || body.plan !== undefined || body.reviewStatus !== undefined) &&
    !(await isAdminRequest(req))
  ) {
    delete body.isActive;
    delete body.plan;
    delete body.reviewStatus;
  }

  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  if (name === "") {
    return NextResponse.json({ error: "El nombre no puede quedar vacío" }, { status: 400 });
  }
  if (body.lat !== undefined && !Number.isFinite(body.lat)) {
    return NextResponse.json({ error: "Latitud inválida" }, { status: 400 });
  }
  if (body.lng !== undefined && !Number.isFinite(body.lng)) {
    return NextResponse.json({ error: "Longitud inválida" }, { status: 400 });
  }

  /* Solo se resuelve la categoría si el cuerpo la trae. Si no viene, `values`
     no toca `category_id` y la que tenía se queda. */
  let categoryId: string | null = null;
  if (body.category !== undefined) {
    categoryId = await resolveCategoryId(body.category);
    if (!categoryId) {
      return NextResponse.json(
        { error: `La categoría «${body.category}» no existe.` },
        { status: 400 },
      );
    }
  }

  const values = toPlaceValues(name === undefined ? body : { ...body, name }, categoryId);
  if (Object.keys(values).length === 0) {
    return NextResponse.json({ error: "No hay nada que actualizar" }, { status: 400 });
  }

  const [row] = await db.update(places).set(values).where(eq(places.id, id)).returning();
  if (!row) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  if (body.reviewStatus === "approved" && body.isActive === true) {
    const [owner] = await db
      .select({ userId: businessOwners.userId })
      .from(businessOwners)
      .where(eq(businessOwners.placeId, id))
      .limit(1);

    if (owner) {
      const [previous] = await db
        .update(notifications)
        .set({
          type: "business_approved",
          title: "Solicitud de negocio aprobada",
          message: `Tu negocio «${row.name}» fue aprobado y ya está publicado en La Verde.`,
          readAt: null,
        })
        .where(eq(notifications.placeId, id))
        .returning({ id: notifications.id });

      if (!previous) {
        await db.insert(notifications).values({
          id: generateId(),
          userId: owner.userId,
          type: "business_approved",
          title: "Solicitud de negocio aprobada",
          message: `Tu negocio «${row.name}» fue aprobado y ya está publicado en La Verde.`,
          placeId: id,
        });
      }
    }
  }

  /* Antes de releer, y no después: `getPlaceById` está cacheado, así que sin
     invalidar primero devolvería la ficha vieja y el panel guardaría un cambio
     que no se ve. El orden importa. */
  revalidateTag(CATALOG_TAG, "max");

  /* La categoría puede haber cambiado: se relee para devolver la etiqueta nueva
     en vez de la que mandó el cliente, que podría ser otra. */
  const updated = await getPlaceById(id);
  return NextResponse.json(updated ?? toUserPlace({ ...row, categoryName: null }));
}

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  let rejectionMessage = "";
  try {
    const body = (await req.json()) as { message?: unknown };
    if (typeof body.message === "string") rejectionMessage = body.message.trim().slice(0, 1000);
  } catch {
    /* DELETE sin cuerpo sigue siendo válido para las eliminaciones del panel. */
  }

  const [owner] = await db
    .select({ userId: businessOwners.userId })
    .from(businessOwners)
    .where(eq(businessOwners.placeId, id))
    .limit(1);

  const [place] = await db
    .select({ name: places.name, isActive: places.isActive })
    .from(places)
    .where(eq(places.id, id))
    .limit(1);

  if (owner && place && !place.isActive) {
    await db.insert(notifications).values({
      id: generateId(),
      userId: owner.userId,
      type: "business_rejected",
      title: "Solicitud de negocio rechazada",
      message:
        rejectionMessage ||
        `La solicitud de «${place.name}» fue revisada y no aprobada. Puedes corregir los datos y enviarla nuevamente.`,
      placeId: id,
    });

    await db
      .update(places)
      .set({ reviewStatus: "rejected", isActive: false, updatedAt: new Date() })
      .where(eq(places.id, id));

    revalidateTag(CATALOG_TAG, "max");
    return NextResponse.json({ id, rejected: true });
  }

  const [row] = await db.delete(places).where(eq(places.id, id)).returning({ id: places.id });

  if (!row) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  revalidateTag(CATALOG_TAG, "max");

  return NextResponse.json({ id: row.id });
}
