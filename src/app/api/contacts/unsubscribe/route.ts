import { NextRequest, NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth/user";
import { setMarketingOptIn } from "@/lib/contacts";

/**
 * Baja de novedades por correo.
 *
 * Simple a propósito: pone `marketing_opt_in` a `false` para quien tiene sesión
 * y devuelve al home. Es la ruta que se enlaza al pie de un correo —por eso
 * `GET` y no `POST`: un enlace no puede mandar un cuerpo— y la que puede llamar
 * el propio usuario desde la app.
 *
 * Lo que **no** hace es dar de baja a quien solo tiene el enlace sin sesión: sin
 * saber quién es, no hay fila que tocar. El correo tiene que llevar a esta ruta
 * con la sesión ya abierta, o el enlace lleva al login y desde ahí se vuelve.
 */
export async function GET(request: NextRequest) {
  const user = await getAppUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/home", request.url));
  }

  await setMarketingOptIn(user.id, user.email, false);

  return NextResponse.redirect(new URL("/home?marketingOff=1", request.url));
}
