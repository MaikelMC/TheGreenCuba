import { redirect } from "next/navigation";
import { type ReactNode } from "react";
import { getAppUser } from "@/lib/auth/user";
import { AdminShell } from "@/components/admin/admin-shell";
import { PlacesProvider } from "@/providers/places-provider";

/* El segmento se declara dinámico de entrada, antes de que nadie lo pida.
   Sin esta línea `next build` intenta prerenderizar cada ruta de `/admin`, el
   layout lee las cookies de la sesión y Next lanza su señal de «esto es
   dinámico» —`DYNAMIC_SERVER_USAGE`— para salirse del paso estático. El SDK de
   Neon la captura por el camino y la registra como «cookie validation error»,
   que no es lo que pasó: el error salta *obteniendo* las cookies, no
   validándolas. Queda un bloque de alarma por ruta y por build, todos falsos, y
   un fallo de sesión de verdad se pierde entre ellos. */
export const dynamic = "force-dynamic";

/**
 * Puerta del panel de administración.
 *
 * Esta comprobación **es la única** desde que la autenticación pasó a Neon. El
 * `proxy.ts` ya solo pregunta si hay sesión —cosa que resuelve con una cookie
 * firmada, sin salir a la red— y el rol se pregunta aquí, donde ya se está
 * consultando la base de todos modos. Hacerlo en el proxy costaba una consulta
 * a Neon en cada petición, incluidas las de estáticos, y el enlace a Neon de
 * esta máquina es intermitente.
 *
 * El `motivo=rol` no es decorativo: `/login` lo lee para distinguir «no has
 * entrado» de «has entrado y no te toca». Sin él, alguien con sesión de usuario
 * normal vería el formulario otra vez y escribiría su contraseña para nada.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getAppUser();

  if (user?.role !== "admin") {
    redirect("/login?next=/admin&motivo=rol");
  }

  return (
    <PlacesProvider>
      <AdminShell>{children}</AdminShell>
    </PlacesProvider>
  );
}
