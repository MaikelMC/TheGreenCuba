import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-server";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import type { Role } from "@/lib/session";

const ROLES: Role[] = ["user", "owner", "admin"];

function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.includes(value as Role);
}

function serializeUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    locationCity: user.locationCity,
    onboardingCompleted: user.onboardingCompleted,
    createdAt: user.createdAt.toISOString(),
    authUserId: user.authUserId,
  };
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rows = await db.select().from(users).orderBy(users.createdAt);
  return NextResponse.json({ users: rows.map(serializeUser) });
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    role?: unknown;
  } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id || !isRole(body?.role)) {
    return NextResponse.json({ error: "Usuario o rol inválido" }, { status: 400 });
  }

  const current = await getAppUser();
  if (current?.id === id && body.role !== "admin") {
    return NextResponse.json(
      { error: "No puedes quitarte el rol de administrador desde aquí." },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(users)
    .set({ role: body.role, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  return NextResponse.json({ user: serializeUser(updated) });
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const current = await getAppUser();

  if (!id) return NextResponse.json({ error: "Usuario inválido" }, { status: 400 });
  if (current?.id === id) {
    return NextResponse.json({ error: "No puedes eliminar tu propio perfil de administrador." }, { status: 400 });
  }

  const [deleted] = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
  if (!deleted) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  return NextResponse.json({ id: deleted.id });
}
