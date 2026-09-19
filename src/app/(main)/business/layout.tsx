import { redirect } from "next/navigation";
import { type ReactNode } from "react";
import { getAppUser } from "@/lib/auth/user";

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
