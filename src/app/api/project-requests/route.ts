import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { notifications, projectRequests } from "@/lib/db/schema";
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

function serialize(row: typeof projectRequests.$inferSelect) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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
  if (user?.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const status = req.nextUrl.searchParams.get("status");
  const rows = status === "pending" || status === "approved" || status === "rejected"
    ? await db.select().from(projectRequests).where(eq(projectRequests.status, status)).orderBy(desc(projectRequests.createdAt))
    : await db.select().from(projectRequests).orderBy(desc(projectRequests.createdAt));
  return NextResponse.json(rows.map(serialize));
}
