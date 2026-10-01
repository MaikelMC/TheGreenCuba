import { NextRequest, NextResponse } from "next/server";
import { DEV_COOKIE, devAccessEnabled } from "@/lib/dev-access";
import { safeNext } from "@/lib/session";

/**
 * Pone (o quita) la cookie de la puerta de atrás del desarrollo.
 *
 *   /dev-login              → entra y va a /home
 *   /dev-login?next=/admin  → entra y va donde digas
 *   /dev-login?off=1        → sale (borra la cookie) y vuelve a la portada
 *
 * Una ruta de API y no una página porque hay que **escribir** la cookie, y en
 * el render Next no lo permite —es el E1180 que ya está contado en
 * `src/lib/session.ts`—. Va por GET para poder dejarlo en un marcador del
 * navegador, que es exactamente cómo se usa esto.
 *
 * En producción esto no existe: devuelve 404. Ver `src/lib/dev-access.ts`.
 */
export async function GET(req: NextRequest) {
  if (!devAccessEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = new URL(req.url);
  const off = url.searchParams.get("off") === "1";
  /* `safeNext` también aquí: `/dev-login?next=https://otro-sitio` es la misma
     redirección abierta que la del login, y en una ruta GET con destino
     variable el navegador la sigue sin preguntar. */
  const target = off
    ? "/"
    : (safeNext(url.searchParams.get("next")) ?? "/home");

  const res = NextResponse.redirect(new URL(target, url.origin));

  if (off) res.cookies.delete(DEV_COOKIE);
  else
    res.cookies.set(DEV_COOKIE, "1", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });

  return res;
}
