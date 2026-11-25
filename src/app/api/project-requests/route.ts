import { NextRequest, NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { businessOwners, notifications, places, projectRequests, users } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";

function text(value: unknown, max = 2000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function list(value: unknown, maxItems = 20): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, maxItems)
    : [];
}

function validPoint(lat: unknown, lng: unknown): lat is number {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && lat >= 18 && lat <= 24 && lng >= -85 && lng <= -74;
}

interface ExtrasProyecto {
  owner: { id: string; email: string; name: string | null } | null;
  negocios: { id: string; name: string }[];
}

function serialize(
  row: typeof projectRequests.$inferSelect,
  extras: ExtrasProyecto = { owner: null, negocios: [] },
) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...extras,
  };
}

export async function POST(req: NextRequest) {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = text(body?.name, 160);
  const description = text(body?.description);
  const contact = text(body?.contact, 200);
  const phones = list(body?.phones, 10);
  const socialLinks = list(body?.socialLinks, 20);
  const provinces = list(body?.provinces, 16);
  const venueName = text(body?.venueName, 200);
  const startsAt = text(body?.startsAt, 30);
  const endsAt = text(body?.endsAt, 30);
  const offers = text(body?.offers);
  const lat = body?.lat;
  const lng = body?.lng;

  if (!name || !description || !contact || phones.length === 0 || provinces.length === 0 || !venueName || !startsAt || !endsAt) {
    return NextResponse.json({ error: "Completa los datos obligatorios del proyecto." }, { status: 400 });
  }
  if (!validPoint(lat, lng)) {
    return NextResponse.json({ error: "Marca en el mapa el lugar exacto del proyecto." }, { status: 400 });
  }
  const latitude = lat as number;
  const longitude = lng as number;

  const id = generateId();
  let created: typeof projectRequests.$inferSelect | undefined;
  try {
    [created] = await db.insert(projectRequests).values({
      id,
      userId: user.id,
      name,
      description,
      contact,
      phones,
      socialLinks,
      provinces,
      venueName,
      lat: latitude,
      lng: longitude,
      startsAt,
      endsAt,
      offers: offers || null,
    }).returning();

    await db.insert(notifications).values({
      id: generateId(),
      userId: user.id,
      type: "project_submitted",
      title: "Solicitud de proyecto enviada",
      message: `Recibimos tu proyecto «${name}». Te avisaremos cuando un administrador lo revise.`,
    });
  } catch (error) {
    console.error("[api/project-requests] database unavailable", error);
    return NextResponse.json(
      { error: "No se pudo guardar la solicitud porque la base de datos no está disponible. Inténtalo de nuevo en unos minutos." },
      { status: 503 },
    );
  }
  if (!created) {
    return NextResponse.json({ error: "No se pudo crear la solicitud del proyecto." }, { status: 500 });
  }

  return NextResponse.json(serialize(created), { status: 201 });
}

export async function GET(req: NextRequest) {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const status = req.nextUrl.searchParams.get("status");
  const ownProjects = req.nextUrl.searchParams.get("mine") === "true" || user.role !== "admin";
  const query = db.select().from(projectRequests);
  const rows = ownProjects
    ? await query.where(eq(projectRequests.userId, user.id)).orderBy(desc(projectRequests.createdAt))
    : status === "pending" || status === "approved" || status === "rejected"
      ? await query.where(eq(projectRequests.status, status)).orderBy(desc(projectRequests.createdAt))
      : await query.orderBy(desc(projectRequests.createdAt));

  /* La tabla del proyecto no guarda un `place_id`: el negocio se crea aparte.
     Para administración se resuelve por el dueño, que es el dato que sí existe.
     Si ya tiene ficha, se enlaza; si no, la cuenta queda como punto de partida. */
  if (!ownProjects && rows.length > 0) {
    const ownerIds = [...new Set(rows.map((row) => row.userId))];
    const [owners, negocios] = await Promise.all([
      db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(inArray(users.id, ownerIds)),
      db
        .select({
          userId: businessOwners.userId,
          id: places.id,
          name: places.name,
        })
        .from(businessOwners)
        .innerJoin(places, eq(places.id, businessOwners.placeId))
        .where(inArray(businessOwners.userId, ownerIds))
        .orderBy(places.name),
    ]);
    const ownerPorId = new Map(owners.map((owner) => [owner.id, owner]));
    const negociosPorDueno = new Map<string, { id: string; name: string }[]>();
    for (const negocio of negocios) {
      const lista = negociosPorDueno.get(negocio.userId) ?? [];
      lista.push({ id: negocio.id, name: negocio.name });
      negociosPorDueno.set(negocio.userId, lista);
    }

    return NextResponse.json(
      rows.map((row) =>
        serialize(row, {
          owner: ownerPorId.get(row.userId) ?? null,
          negocios: negociosPorDueno.get(row.userId) ?? [],
        }),
      ),
    );
  }

  return NextResponse.json(rows.map((row) => serialize(row)));
}
