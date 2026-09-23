import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { AUTH_USER_HEADER, isProtected, needsAppUser } from "@/lib/session";

/**
 * Puerta de entrada del sitio.
 *
 * Se llamaba `middleware.ts` hasta Next 16, que renombró la convención a
 * `proxy` —el nombre nuevo dice mejor lo que hace: está en el borde de la red,
 * no dentro del render—. El runtime también cambió: el proxy corre sobre Node,
 * no sobre Edge. Aquí da igual, porque ya no hay criptografía propia.
 *
 * Aquí también se resuelve **quién eres** y se reenvía al render en una
 * cabecera: el render no puede llamar a `auth.getSession()` sin arriesgarse a
 * tumbar la página. Está contado entero en `AUTH_USER_HEADER`
 * (`src/lib/session.ts`).
 *
 * **El rol no se mira aquí, y es a propósito:** vive en la tabla `users`, así
 * que comprobarlo costaría una consulta a Neon en cada petición, incluidas las
 * de estáticos. Lo comprueban los layouts de `/admin` y `/business`, que ya
 * están consultando la base de todos modos.
 *
 * El matcher excluye `api` a propósito. Las rutas de API no pueden depender de
 * esto —un `rewrite` o un `fetch` interno no siempre lo atraviesan— así que se
 * protegen solas: las de administración con `isAdminRequest`, y `/api/me`
 * devolviendo `authenticated: false`.
 *
 * Lo público es la landing y la ficha de lugar. La ficha se queda fuera de las
 * reglas porque los enlaces se comparten: pedir cuenta para abrir un enlace
 * rompe el enlace.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const wantsUser = needsAppUser(pathname);

  /* Nadie más que este archivo puede poner la cabecera de identidad. Se corta
     aquí, antes de que la lea nadie: si viene del cliente y la ruta no es de
     las que la reciben, se tira. */
  if (!wantsUser && !request.headers.has(AUTH_USER_HEADER)) {
    return NextResponse.next();
  }

  /* Se reenvían las cabeceras **enteras**. El proxy no añade la suya a las que
     ya hay: las reemplaza en bloque por la lista que viaja en
     `x-middleware-override-headers`, y lo que no esté en esa lista desaparece
     de la petición —la cookie, para empezar—. */
  const headers = new Headers(request.headers);
  headers.delete(AUTH_USER_HEADER);

  if (!wantsUser) return NextResponse.next({ request: { headers } });

  /* La sesión se resuelve aquí y no dentro del render, que no puede escribir
     cookies. Ver `AUTH_USER_HEADER` en `src/lib/session.ts`. */
  const { data: session } = await auth.getSession();
  headers.set(AUTH_USER_HEADER, session?.user ? encodeUser(session.user) : "");

  if (!isProtected(pathname) || session?.user) {
    return NextResponse.next({ request: { headers } });
  }

  /* Se guarda también la consulta: `/place/abc?foto=2` tiene que volver entero.
     No se emite `motivo=rol` desde aquí: quien llega sin sesión no tiene rol
     del que hablar, y el aviso de `/login` es para quien ya está dentro. */
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

/** Id, correo y nombre: el id solo no basta, al crear la fila hacen falta los tres. */
function encodeUser(user: {
  id: string;
  email?: string | null;
  name?: string | null;
}) {
  return encodeURIComponent(
    JSON.stringify({
      id: user.id,
      email: user.email ?? "",
      name: user.name ?? "",
    }),
  );
}

/**
 * El matcher deja fuera lo que no debe pasar por aquí. `_next/static`,
 * `_next/image` y `favicon.ico` son estáticos, y `.*\\..*` cubre el resto de
 * ficheros con extensión —incluido `next.svg` y las imágenes públicas—, que no
 * necesitan comprobar una sesión para servirse.
 */
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
