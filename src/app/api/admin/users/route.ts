import { randomUUID } from "node:crypto";
import { and, count, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "better-auth/crypto";
import { ACCION, registrarActividad } from "@/lib/admin-actividad";
import { isAdminRequest } from "@/lib/admin-server";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { businessOwners, notifications, places, users } from "@/lib/db/schema";
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

async function borrarCuentaDeAcceso(authUserId: string | null) {
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
    referralCode: user.referralCode,
  };
}

async function sincronizarPerfiles() {
  const result = await db.execute<{ id: string; email: string; name: string | null }>(sql`
    SELECT id::text, email, name
    FROM neon_auth.user
  `);

  for (const cuenta of result.rows ?? []) {
    await db
      .insert(users)
      .values({
        id: generateId(),
        authUserId: cuenta.id,
        email: cuenta.email,
        name: cuenta.name,
      })
      .onConflictDoNothing({ target: users.authUserId });
  }
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await sincronizarPerfiles();
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const perPage = Math.min(100, Math.max(10, Number(params.get("perPage")) || 25));
  const q = (params.get("q") ?? "").trim();
  const vivo = sql`${users.authUserId} IN (SELECT id::text FROM neon_auth.user)`;
  const filtro = q
    ? and(
        vivo,
        or(
          ilike(users.name, `%${q}%`),
          ilike(users.email, `%${q}%`),
          ilike(users.locationCity, `%${q}%`),
        ),
      )
    : vivo;

  const [rows, totalRows, adminRows] = await Promise.all([
    db
      .select()
      .from(users)
      .where(filtro)
      .orderBy(users.createdAt)
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ total: count() }).from(users).where(filtro),
    db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(and(vivo, eq(users.role, "admin")))
      .orderBy(users.createdAt),
  ]);

  const ids = rows.map((row) => row.id);
  const vinculos = ids.length
    ? await db
        .select({ userId: businessOwners.userId, id: places.id, nombre: places.name })
        .from(businessOwners)
        .innerJoin(places, eq(places.id, businessOwners.placeId))
        .where(inArray(businessOwners.userId, ids))
        .orderBy(places.name)
    : [];
  const negocioPorUsuario = new Map<string, { id: string; nombre: string }>();
  for (const vinculo of vinculos) {
    if (!negocioPorUsuario.has(vinculo.userId)) {
      negocioPorUsuario.set(vinculo.userId, { id: vinculo.id, nombre: vinculo.nombre });
    }
  }

  return NextResponse.json({
    users: rows.map((row) => ({
      ...serializeUser(row),
      negocio: negocioPorUsuario.get(row.id) ?? null,
    })),
    total: totalRows[0]?.total ?? 0,
    page,
    perPage,
    admins: adminRows,
  });
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
    affiliate?: unknown;
  } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const name = optionalText(body?.name);
  const locationCity = optionalText(body?.locationCity);
  /* El interruptor del programa de afiliados. `null` es «no viene», que no es lo
     mismo que `false` —«quítaselo»—: sin esta distinción, cualquier `PATCH` que
     solo cambiara el rol le retiraría el código de paso. */
  const affiliate = typeof body?.affiliate === "boolean" ? body.affiliate : null;
  const hasProfileChanges = body?.name !== undefined || body?.locationCity !== undefined;
  /* `!body` delante y no `body?.` suelto: TypeScript deja de deducir que `body`
     no es nulo en cuanto la condición encadena tres términos, y sin la deducción
     todo lo de abajo —`body.role`, tres veces— pasa a ser un error. Pedirlo aquí
     explícitamente cuesta un término y ahorra repetir la guarda. */
  if (!body || !id || (!isRole(body.role) && !hasProfileChanges && affiliate === null)) {
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

  const quitaAdmin = isRole(body.role) && body.role !== "admin" && target.role === "admin";
  if (quitaAdmin) {
    const [admins] = await db
      .select({ total: count() })
      .from(users)
      .where(eq(users.role, "admin"));
    if ((admins?.total ?? 0) <= 1) {
      return NextResponse.json(
        { error: "No puedes dejar el sistema sin administradores." },
        { status: 409 },
      );
    }
  }

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
      /* Activar genera el código si no lo tenía y **conserva el que ya hubiera**:
         el afiliado puede haber repartido su enlace, y pulsar dos veces no puede
         cambiárselo por debajo. Desactivar lo deja a `null`, que es lo que corta
         la atribución de ese enlace —al resolverlo el alta contra la base, un
         código que ya no está no casa—. Ver `src/lib/referral.ts`. */
      ...(affiliate === true
        ? { referralCode: target.referralCode ?? generateId() }
        : {}),
      ...(affiliate === false ? { referralCode: null } : {}),
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

    await db.insert(notifications).values({
      id: generateId(),
      userId: updated.id,
      type: "role_updated",
      title: "Cambio de rol",
      message:
        body.role === "admin"
          ? "Tu cuenta fue actualizada a administrador. Ya tienes acceso a las herramientas de administración."
          : body.role === "owner"
            ? "Tu cuenta fue actualizada a propietario. Ya puedes gestionar tu negocio desde la app."
            : "Tu cuenta fue actualizada a usuario. Puedes seguir usando la app con acceso normal.",
    });
  }
  if (isRole(body.role)) {
    await registrarActividad({
      accion: ACCION.cambiarRol,
      objetoTipo: "usuario",
      objetoId: updated.id,
      resumen: `Cambió el rol de ${updated.email} de ${target.role} a ${body.role}`,
      datos: { rolAnterior: target.role, rolNuevo: body.role },
    });
  }
  if (affiliate !== null) {
    await registrarActividad({
      accion: affiliate ? ACCION.activarAfiliado : ACCION.quitarAfiliacion,
      objetoTipo: "usuario",
      objetoId: updated.id,
      resumen: affiliate
        ? `Activó el programa de afiliados para ${updated.email}`
        : `Retiró la afiliación de ${updated.email}`,
      datos: { afiliado: affiliate },
    });
  }
  if (hasProfileChanges) {
    await registrarActividad({
      accion: ACCION.editarUsuario,
      objetoTipo: "usuario",
      objetoId: updated.id,
      resumen: `Editó el perfil de ${updated.email}`,
    });
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
    .select({ id: users.id, authUserId: users.authUserId, name: users.name })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (!target.authUserId) {
    return NextResponse.json(
      { error: "La cuenta no está vinculada a la autenticación." },
      { status: 409 },
    );
  }

  /* El hash lo genera Better Auth, no esta ruta: así la contraseña que escribe
     administración se verifica después con el mismo scrypt que la del alta.
     `UPDATE` primero y `INSERT` solo si la cuenta no tenía fila `credential`
     —una cuenta de Google que aún no tiene contraseña—. */
  const hash = await hashPassword(newPassword);
  const updated = await db.execute<{ id: string }>(sql`
    UPDATE neon_auth."account"
    SET password = ${hash}, "updatedAt" = now()
    WHERE "userId" = ${target.authUserId}::uuid AND "providerId" = 'credential'
    RETURNING id
  `);

  if ((updated.rows ?? []).length === 0) {
    await db.execute(sql`
      INSERT INTO neon_auth."account" (
        id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt"
      )
      VALUES (
        ${randomUUID()}, ${target.authUserId}, 'credential',
        ${target.authUserId}::uuid, ${hash}, now(), now()
      )
    `);
  }

  await db.insert(notifications).values({
    id: generateId(),
    userId: target.id,
    type: "password_reset",
    title: "Contraseña actualizada",
    message: `La contraseña de ${target.name ?? "tu cuenta"} fue restablecida correctamente por administración.`,
  });

  await registrarActividad({
    accion: ACCION.restablecerContrasena,
    objetoTipo: "usuario",
    objetoId: target.id,
    resumen: `Restableció la contraseña de ${target.name ?? "una cuenta"}`,
  });

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
    .select({ id: users.id, authUserId: users.authUserId, email: users.email })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  try {
    await borrarCuentaDeAcceso(target.authUserId);
  } catch (error) {
    // Si el perfil de la app sigue vivo pero la cuenta de acceso ya se borró a mano,
    // no bloqueamos la eliminación del perfil local: el usuario ya no existe en auth.
    const message = error instanceof Error ? error.message : "No se pudo eliminar la cuenta de acceso.";
    console.error("Fallo al eliminar la cuenta de acceso durante DELETE de usuario:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const [deleted] = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
  if (!deleted) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  await registrarActividad({
    accion: ACCION.borrarUsuario,
    objetoTipo: "usuario",
    objetoId: deleted.id,
    resumen: `Eliminó la cuenta de ${target.email}`,
  });

  return NextResponse.json({ id: deleted.id });
}
