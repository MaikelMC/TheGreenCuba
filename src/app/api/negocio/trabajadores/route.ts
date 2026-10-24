import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { esDuenoDePlace } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { businessOwners, users } from "@/lib/db/schema";
import { normalizarPermisos, type PermisoNegocio } from "@/lib/permisos-negocio";
import { generateId } from "@/lib/utils";

/**
 * Los trabajadores de un negocio: quién entra al panel y qué puede tocar.
 *
 * Todo pasa por `esDuenoDePlace`: un trabajador no gestiona a otros
 * trabajadores, aunque tenga todos los permisos. El dueño (o un
 * administrador) es el único que reparte accesos.
 *
 * Un trabajador tiene que tener cuenta ya —se busca por correo—, porque
 * `business_owners.user_id` es una clave foránea. Invitar a quien todavía no
 * se ha registrado exigiría una tabla de invitaciones aparte; mientras tanto,
 * el mensaje de error dice qué hacer.
 */

interface Trabajador {
  userId: string;
  nombre: string;
  email: string;
  permisos: PermisoNegocio[];
}

function negocioIdDe(req: NextRequest): string {
  return new URL(req.url).searchParams.get("negocioId")?.trim() ?? "";
}

async function autorizar(req: NextRequest, negocioId: string): Promise<boolean> {
  if (!negocioId) return false;
  return esDuenoDePlace(req, negocioId);
}

async function usuarioPorCorreo(email: string) {
  const [row] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
    .limit(1);
  return row ?? null;
}

function fila(row: {
  id: string;
  name: string | null;
  email: string;
  permissions: string[];
}): Trabajador {
  return {
    userId: row.id,
    /* Mismo criterio que `toAppUser`: el correo sin dominio es mejor que un
       hueco en blanco. */
    nombre: row.name?.trim() || row.email.split("@")[0] || row.email,
    email: row.email,
    permisos: normalizarPermisos(row.permissions),
  };
}

export async function GET(req: NextRequest) {
  const negocioId = negocioIdDe(req);
  if (!(await autorizar(req, negocioId))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const filas = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      permissions: businessOwners.permissions,
    })
    .from(businessOwners)
    .innerJoin(users, eq(businessOwners.userId, users.id))
    .where(
      and(
        eq(businessOwners.placeId, negocioId),
        ne(businessOwners.role, "owner"),
      ),
    )
    .orderBy(users.name);

  return NextResponse.json({
    trabajadores: filas.map((f) =>
      fila({ ...f, permissions: f.permissions ?? [] }),
    ),
  });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const negocioId =
    typeof body.negocioId === "string" ? body.negocioId.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const permisos = normalizarPermisos(body.permisos);

  if (!(await autorizar(req, negocioId))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!email) {
    return NextResponse.json(
      { error: "Escribe el correo del trabajador." },
      { status: 400 },
    );
  }

  const usuario = await usuarioPorCorreo(email);
  if (!usuario) {
    return NextResponse.json(
      {
        error:
          "No hay ninguna cuenta con ese correo. La persona tiene que entrar a La Verde al menos una vez antes de poder añadirla.",
      },
      { status: 404 },
    );
  }

  const [existente] = await db
    .select({ role: businessOwners.role })
    .from(businessOwners)
    .where(
      and(
        eq(businessOwners.userId, usuario.id),
        eq(businessOwners.placeId, negocioId),
      ),
    )
    .limit(1);

  if (existente) {
    return NextResponse.json(
      {
        error:
          existente.role === "owner"
            ? "Esa cuenta ya es la dueña del negocio."
            : "Esa cuenta ya está en el equipo.",
      },
      { status: 409 },
    );
  }

  await db.insert(businessOwners).values({
    id: generateId(),
    userId: usuario.id,
    placeId: negocioId,
    role: "editor",
    permissions: permisos,
    /* Sin invitación que aceptar: el dueño lo añade y queda dentro. */
    acceptedAt: new Date(),
  });

  /* Subir a `user` → `owner`, nunca bajar a nadie. `/api/me` solo busca negocio
     para `owner` y `admin`, así que sin esto el trabajador no vería «Mi
     negocio» en el menú aunque el panel sí se abriera por la URL. Los permisos
     siguen mandando en `business_owners`. */
  if (usuario.role === "user") {
    await db
      .update(users)
      .set({ role: "owner", updatedAt: new Date() })
      .where(eq(users.id, usuario.id));
  }

  return NextResponse.json(
    {
      trabajador: fila({
        id: usuario.id,
        name: usuario.name,
        email: usuario.email,
        permissions: permisos,
      }),
    },
    { status: 201 },
  );
}

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const negocioId =
    typeof body.negocioId === "string" ? body.negocioId.trim() : "";
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const permisos = normalizarPermisos(body.permisos);

  if (!(await autorizar(req, negocioId))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!userId) {
    return NextResponse.json(
      { error: "Falta el trabajador." },
      { status: 400 },
    );
  }

  const [existente] = await db
    .select({ role: businessOwners.role })
    .from(businessOwners)
    .where(
      and(
        eq(businessOwners.userId, userId),
        eq(businessOwners.placeId, negocioId),
      ),
    )
    .limit(1);

  if (!existente) {
    return NextResponse.json(
      { error: "Esa cuenta no está en el equipo." },
      { status: 404 },
    );
  }
  if (existente.role === "owner") {
    return NextResponse.json(
      { error: "El dueño no se recorta: sus permisos son todos." },
      { status: 400 },
    );
  }

  await db
    .update(businessOwners)
    .set({ permissions: permisos })
    .where(
      and(
        eq(businessOwners.userId, userId),
        eq(businessOwners.placeId, negocioId),
      ),
    );

  return NextResponse.json({ userId, permisos });
}

export async function DELETE(req: NextRequest) {
  const negocioId = negocioIdDe(req);
  const userId = new URL(req.url).searchParams.get("userId")?.trim() ?? "";

  if (!(await autorizar(req, negocioId))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!userId) {
    return NextResponse.json(
      { error: "Falta el trabajador." },
      { status: 400 },
    );
  }

  const [existente] = await db
    .select({ role: businessOwners.role })
    .from(businessOwners)
    .where(
      and(
        eq(businessOwners.userId, userId),
        eq(businessOwners.placeId, negocioId),
      ),
    )
    .limit(1);

  if (!existente) {
    return NextResponse.json(
      { error: "Esa cuenta no está en el equipo." },
      { status: 404 },
    );
  }
  if (existente.role === "owner") {
    return NextResponse.json(
      { error: "No puedes quitarte el negocio desde aquí." },
      { status: 400 },
    );
  }

  /* No se toca el rol global: quitó el negocio, no la capacidad. Si además es
     dueño de otro, seguirá viéndolo en el menú. */
  await db
    .delete(businessOwners)
    .where(
      and(
        eq(businessOwners.userId, userId),
        eq(businessOwners.placeId, negocioId),
      ),
    );

  return NextResponse.json({ userId });
}
