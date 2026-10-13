import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { isAdminRequest } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { businessOwners, places, users } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";

/**
 * El vínculo entre un negocio y su dueño, para administración.
 *
 * Existe porque hasta ahora `business_owners` solo lo escribía el alta del
 * perfil: un negocio creado a mano desde el panel —o importado— se quedaba sin
 * dueño y sin ninguna forma de dárselo. Sin la fila, el dueño no ve su negocio
 * en el menú, no puede editarlo y no recibe los avisos.
 *
 * **Un dueño.** Vincular reemplaza al anterior en vez de sumar: el panel enseña
 * un negocio por persona y `/api/me` lo busca con `limit(1)`, así que una
 * segunda fila no se leería — dejaría un dueño fantasma con acceso de escritura
 * vía `canManagePlace` sin aparecer por ninguna parte.
 */

/** El negocio y quién lo lleva, tal como los pinta el editor. */
interface Vinculo {
  owner: { id: string; name: string; email: string } | null;
}

function negocioIdDe(req: NextRequest): string {
  return new URL(req.url).searchParams.get("negocioId")?.trim() ?? "";
}

async function existeNegocio(placeId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: places.id })
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1);

  return Boolean(row);
}

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const negocioId = negocioIdDe(req);
  if (!negocioId) {
    return NextResponse.json({ error: "Falta negocioId" }, { status: 400 });
  }

  const [row] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(businessOwners)
    .innerJoin(users, eq(businessOwners.userId, users.id))
    .where(eq(businessOwners.placeId, negocioId))
    /* El `role` de `business_owners` no entra: el panel solo escribe «owner» y
       una fila con otro rol es indistinguible para el dueño. Si algún día hay
       gestores, aquí es donde se enseña la diferencia. */
    .limit(1);

  const vinculo: Vinculo = {
    /* `name` es opcional en la tabla; el correo sin dominio es el mismo nombre
       pobre que usa `toAppUser`, y mejor que un hueco en blanco. */
    owner: row
      ? {
          id: row.id,
          name: row.name?.trim() || row.email.split("@")[0] || row.email,
          email: row.email,
        }
      : null,
  };

  return NextResponse.json(vinculo);
}

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const negocioId = typeof body.negocioId === "string" ? body.negocioId.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!negocioId) {
    return NextResponse.json({ error: "Falta negocioId" }, { status: 400 });
  }
  if (!email) {
    return NextResponse.json({ error: "Escribe el correo del dueño." }, { status: 400 });
  }

  if (!(await existeNegocio(negocioId))) {
    return NextResponse.json({ error: "Ese negocio no existe." }, { status: 404 });
  }

  /* Sin distinguir mayúsculas: la dirección la escribe una persona y el correo
     que guarda `users` es el que devolvió Neon, que no tiene por qué coincidir
     en caja. La columna está indexada, pero `lower()` tira el índice: se acepta
     —esto corre cuando un administrador vincula a mano, no en un bucle—. */
  const [owner] = await db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  if (!owner) {
    /* El caso que de verdad se da: la persona todavía no entró a La Verde, así
       que no tiene fila. Se dice tal cual en vez de un «no encontrado» seco,
       porque el arreglo es suyo —que entre una vez— y no del administrador. */
    return NextResponse.json(
      {
        error:
          "No hay ninguna cuenta con ese correo. La persona tiene que entrar a La Verde al menos una vez antes de poder vincularle un negocio.",
      },
      { status: 404 },
    );
  }

  /* Reemplazar y no sumar (ver la cabecera del archivo). El borrado va antes del
     `insert` para que el `unique (user_id, place_id)` no estorbe cuando la fila
     que se escribe es la del que ya estaba. */
  await db.delete(businessOwners).where(eq(businessOwners.placeId, negocioId));

  await db.insert(businessOwners).values({
    id: generateId(),
    userId: owner.id,
    placeId: negocioId,
    role: "owner",
    /* Aceptada en el acto: aquí no hay invitación que aceptar, es el
       administrador diciendo quién lleva el negocio. */
    acceptedAt: new Date(),
  });

  /* Subir a `user` → `owner`, nunca bajar a nadie. `businessFor` (`/api/me`)
     solo busca el negocio para `owner` y `admin`, así que sin esto el vínculo no
     se ve en el menú y el dueño no llega a su panel. Y no se toca a quien ya es
     `admin`: su rol no es una capacidad de negocio que se pueda sustituir. */
  if (owner.role === "user") {
    await db
      .update(users)
      .set({ role: "owner", updatedAt: new Date() })
      .where(eq(users.id, owner.id));
  }

  return NextResponse.json({
    /* Con la misma forma que el GET, para que quien llame pueda meter la
       respuesta en el estado sin recomponerla. */
    owner: {
      id: owner.id,
      name: owner.name?.trim() || email.split("@")[0] || email,
      email,
    },
  });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const negocioId = negocioIdDe(req);
  if (!negocioId) {
    return NextResponse.json({ error: "Falta negocioId" }, { status: 400 });
  }

  /* Desvincular no toca el rol del usuario: quitó el negocio, no la capacidad
     —`bootstrapRole` y el panel de usuarios siguen mandando ahí—. Y **no borra el
     negocio**: la ficha sigue publicada y sin dueño, que es justo el estado para
     el que existe el botón de eliminar de la lista. */
  await db.delete(businessOwners).where(eq(businessOwners.placeId, negocioId));

  return NextResponse.json({ owner: null });
}
