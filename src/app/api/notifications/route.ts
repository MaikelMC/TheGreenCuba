import { and, desc, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";

export async function GET() {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const items = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(20);

  return NextResponse.json(items);
}

export async function PATCH(req: NextRequest) {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: { id?: unknown } = {};
  try {
    body = (await req.json()) as { id?: unknown };
  } catch {
    /* Un cuerpo vacío marca todas como leídas. */
  }

  const filter =
    typeof body.id === "string"
      ? and(eq(notifications.id, body.id), eq(notifications.userId, user.id))
      : and(eq(notifications.userId, user.id), isNull(notifications.readAt));

  await db.update(notifications).set({ readAt: new Date() }).where(filter);
  return NextResponse.json({ ok: true });
}