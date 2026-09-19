import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { businessOwners, places } from "@/lib/db/schema";

/**
 * Nombre del negocio que lleva esta persona.
 *
 * El panel de negocio lo pinta en su cabecera y lo sacaba del campo `business`
 * de la cuenta de demostración, que era una cadena escrita a mano en
 * `src/lib/accounts.ts`. Su origen de verdad es `business_owners`: la fila que
 * dice quién lleva qué sitio.
 *
 * Solo se consulta para los dueños. Un usuario normal —o un administrador— no
 * tiene negocio, y esta ruta la llama el menú de usuario en **cada** página, así
 * que una consulta de más aquí se paga en todas.
 */
async function businessName(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ name: places.name })
    .from(businessOwners)
    .innerJoin(places, eq(businessOwners.placeId, places.id))
    .where(eq(businessOwners.userId, userId))
    .limit(1);

  return row?.name ?? null;
}

/**
 * Quién ha iniciado sesión, para el menú de usuario.
 *
 * Sustituye a `/api/auth/session`, que leía la cookie firmada. El sitio bajo
 * `/api/auth/` es ahora de Neon —el catch-all `[...path]` monta su manejador
 * entero— y colgarle una ruta propia de la app sería una trampa para quien lo
 * lea después: parece de Neon y no lo es. De ahí el nombre nuevo.
 *
 * Lo que devuelve es el usuario **de la app**, no el de Neon: el rol vive en la
 * tabla `users`, y el cliente de Neon no lo conoce. Es justo lo que el menú
 * necesita para decidir qué enlaces enseñar.
 *
 * Nunca devuelve el token ni la contraseña. Solo lo que la interfaz necesita.
 */
export async function GET() {
  const user = await getAppUser();

  if (!user) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      email: user.email,
      name: user.name,
      role: user.role,
      business: user.role === "owner" ? await businessName(user.id) : null,
    },
  });
}
