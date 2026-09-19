import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { isProtected } from "@/lib/session";

/**
 * Puerta de entrada del sitio.
 *
 * Se llamaba `middleware.ts` hasta Next 16, que renombró la convención a
 * `proxy` —el nombre nuevo dice mejor lo que hace: está en el borde de la red,
 * no dentro del render—. El runtime también cambió: el proxy corre sobre Node,
 * no sobre Edge. Aquí da igual, porque ya no hay criptografía propia.
 *
 * **Solo pregunta si hay sesión.** El rol no se mira aquí y es a propósito: vive
 * en la tabla `users`, así que comprobarlo costaría una consulta a Neon en cada
 * petición, incluidas las de estáticos. Lo comprueban los layouts de `/admin` y
 * `/business`, que ya están consultando la base de todos modos.
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
  if (!isProtected(pathname)) return NextResponse.next();

  const { data: session } = await auth.getSession();
  if (session?.user) return NextResponse.next();

  /* Se guarda también la consulta: `/place/abc?foto=2` tiene que volver entero.
     No se emite `motivo=rol` desde aquí: quien llega sin sesión no tiene rol
     del que hablar, y el aviso de `/login` es para quien ya está dentro. */
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
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
