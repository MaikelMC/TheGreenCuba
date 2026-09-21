import { redirect } from "next/navigation";
import { type ReactNode } from "react";
import { getAppUser } from "@/lib/auth/user";

/* El segmento se declara dinámico de entrada, antes de que nadie lo pida.
   Sin esta línea `next build` intenta prerenderizar cada ruta de `/business`,
   el layout lee las cookies de la sesión y Next lanza su señal de «esto es
   dinámico» —`DYNAMIC_SERVER_USAGE`— para salirse del paso estático. El SDK de
   Neon la captura por el camino y la registra como «cookie validation error»,
   que no es lo que pasó: el error salta *obteniendo* las cookies, no
   validándolas. Queda un bloque de alarma por ruta y por build, todos falsos, y
   un fallo de sesión de verdad se pierde entre ellos. */
export const dynamic = "force-dynamic";

/**
 * Puerta del panel de negocio.
 *
 * Este archivo no existía: hasta ahora `/business` lo cerraba el middleware y
 * nada más. Al pasar el rol a la base de datos, la comprobación baja aquí
 * —donde ya se consulta la base— y el `proxy.ts` se queda solo con «¿hay
 * sesión?», que resuelve con una cookie firmada y sin salir a la red.
 *
 * `/profile`, en cambio, no necesita archivo: su regla es «cualquier sesión»,
 * que es exactamente lo que el proxy ya garantiza.
 *
 * Los dos `redirect` son distintos a propósito. Sin sesión, al formulario. Con
 * sesión pero sin rol, al formulario **con `motivo=rol`**, para que `/login`
 * enseñe el aviso en vez de pedir la contraseña otra vez a quien ya está dentro.
 */
export default async function BusinessLayout({ children }: { children: ReactNode }) {
  const user = await getAppUser();

  if (!user) {
    redirect("/login?next=/business");
  }

  if (user.role !== "owner" && user.role !== "admin") {
    redirect("/login?next=/business&motivo=rol");
  }

  return <>{children}</>;
}
