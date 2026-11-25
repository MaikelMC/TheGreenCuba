import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/** Preferencia de la persona sobre los avisos de administración. */
export async function GET() {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const [row] = await db
    .select({ broadcastOptOut: users.broadcastOptOut })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return NextResponse.json({ broadcastOptOut: row?.broadcastOptOut ?? false });
}

export async function PATCH(request: NextRequest) {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    broadcastOptOut?: unknown;
  } | null;
  if (typeof body?.broadcastOptOut !== "boolean") {
    return NextResponse.json({ error: "Preferencia inválida." }, { status: 400 });
  }

  await db
    .update(users)
    .set({ broadcastOptOut: body.broadcastOptOut, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return NextResponse.json({ broadcastOptOut: body.broadcastOptOut });
}
