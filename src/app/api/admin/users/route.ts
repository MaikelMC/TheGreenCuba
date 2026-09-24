import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-server";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import type { Role } from "@/lib/session";
import { generateId } from "@/lib/utils";

const ROLES: Role[] = ["user", "owner", "admin"];

function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.includes(value as Role);
}

function optionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === "string" ? value.trim() || null : undefined;
}

async function removeNeonAuthUser(authUserId: string | null) {
  if (!authUserId) return;

  await db.execute(sql`
    DELETE FROM neon_auth.user
    WHERE id = ${authUserId}::uuid
  `);
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

async function syncNeonProfiles() {
  const result = await db.execute<{ id: string; email: string; name: string | null }>(sql`
    SELECT id::text, email, name
    FROM neon_auth.user
  `);

  for (const neonUser of result.rows ?? []) {
    await db
      .insert(users)
      .values({
        id: generateId(),
        authUserId: neonUser.id,
        email: neonUser.email,
        name: neonUser.name,
      })
      .onConflictDoNothing({ target: users.authUserId });
  }
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await syncNeonProfiles();
  const rows = await db
    .select()
    .from(users)
    .where(sql`${users.authUserId} IN (SELECT id::text FROM neon_auth.user)`)
    .orderBy(users.createdAt);
  return NextResponse.json({ users: rows.map(serializeUser) });
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    role?: unknown;
    name?: unknown;
    locationCity?: unknown;
  } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const name = optionalText(body?.name);
  const locationCity = optionalText(body?.locationCity);
  const hasProfileChanges = body?.name !== undefined || body?.locationCity !== undefined;
  if (!id || (!isRole(body?.role) && !hasProfileChanges)) {
    return NextResponse.json({ error: "Usuario o perfil inválido" }, { status: 400 });
  }

  const current = await getAppUser();
  if (current?.id === id && body.role !== undefined && body.role !== "admin") {
    return NextResponse.json(
      { error: "No puedes quitarte el rol de administrador desde aquí." },
      { status: 400 },
    );
  }

  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  if (hasProfileChanges && target.authUserId && name !== undefined) {
    await db.execute(sql`
      UPDATE neon_auth.user
      SET name = ${name}, "updatedAt" = now()
      WHERE id = ${target.authUserId}::uuid
    `);
  }

  const [updated] = await db
    .update(users)
    .set({
      ...(isRole(body.role) ? { role: body.role } : {}),
      ...(name !== undefined ? { name } : {}),
      ...(locationCity !== undefined ? { locationCity } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (isRole(body.role)) {
    await db.execute(sql`
      UPDATE neon_auth.user
      SET role = ${body.role === "admin" ? "admin" : "user"}, "updatedAt" = now()
      WHERE id = ${updated.authUserId}::uuid
    `);
  }
  return NextResponse.json({ user: serializeUser(updated) });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    newPassword?: unknown;
  } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  if (!id || newPassword.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }

  const [target] = await db
    .select({ authUserId: users.authUserId })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (!target.authUserId) return NextResponse.json({ error: "La cuenta no está vinculada a Neon Auth." }, { status: 409 });

  const current = await getAppUser();
  if (current) {
    const [currentAuth] = await db
      .select({ authUserId: users.authUserId })
      .from(users)
      .where(eq(users.id, current.id))
      .limit(1);
    if (currentAuth?.authUserId) {
      await db.execute(sql`
        UPDATE neon_auth.user
        SET role = 'admin', "updatedAt" = now()
        WHERE id = ${currentAuth.authUserId}::uuid
      `);
    }
  }

  const response = await fetch(new URL("/api/auth/admin/set-user-password", request.url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(request.headers.get("cookie") ? { Cookie: request.headers.get("cookie")! } : {}),
    },
    body: JSON.stringify({
      userId: target.authUserId,
      newPassword,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.error("No se pudo cambiar la contraseña:", details);
    return NextResponse.json({ error: details || "No se pudo cambiar la contraseña." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
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

  const [target] = await db
    .select({ id: users.id, authUserId: users.authUserId })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  try {
    await removeNeonAuthUser(target.authUserId);
  } catch (error) {
    // Si el perfil de la app sigue vivo pero la cuenta de Neon ya se borró a mano,
    // no bloqueamos la eliminación del perfil local: el usuario ya no existe en auth.
    const message = error instanceof Error ? error.message : "No se pudo eliminar la cuenta de acceso de Neon Auth.";
    console.error("Fallo al eliminar Neon Auth durante DELETE de usuario:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const [deleted] = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
  if (!deleted) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  return NextResponse.json({ id: deleted.id });
}
