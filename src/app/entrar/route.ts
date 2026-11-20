import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { businessOwners, places } from "@/lib/db/schema";
import { getAppUser } from "@/lib/auth/user";
import { ownsDevPlace } from "@/lib/dev-place";

/**
 * Adónde se va justo después de entrar, cuando el acceso no trae `next`.
 *
 * Quien lleva un negocio publicado —dueño o trabajador— va directo a su panel
 * y a la última sección que usó (`?ultima=1`; la página lee la cookie). El resto
 * va al Home, como siempre, con el aviso de sesión.
 *
 * Es una ruta del servidor y no una decisión del formulario de acceso porque el
 * formulario no sabe si la cuenta es de un trabajador: su rol puede ser `user`.
 * Lo sabe `business_owners`, y preguntarlo aquí cuesta una consulta en el
 * redireccionamiento, sin ningún viaje más desde el navegador.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const user = await getAppUser();

  if (user) {
    const [negocio] = await db
      .select({ id: places.id })
      .from(businessOwners)
      .innerJoin(places, eq(places.id, businessOwners.placeId))
      /* Las dos condiciones en un solo `where`: encadenar dos los reemplaza. */
      .where(and(eq(businessOwners.userId, user.id), eq(places.isActive, true)))
      .limit(1);

    if (negocio || ownsDevPlace(user.email)) {
      return NextResponse.redirect(new URL("/business?ultima=1", origin));
    }
  }

  const home = new URL("/home", origin);
  home.searchParams.set("showSessionNotice", "1");
  return NextResponse.redirect(home);
}
