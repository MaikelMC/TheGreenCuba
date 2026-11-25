import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { getAppUser } from "@/lib/auth/user";
import { cargarCatalogo } from "@/lib/catalogo-server";
import { listCategories, listPlacesSinCache } from "@/lib/db/queries";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminContadoresProvider } from "@/components/admin/admin-contadores";
import {
  CONTADORES_VACIOS,
  contarPendientesAdmin,
  listarAdmins,
} from "@/lib/admin-contadores";
import { PlacesProvider } from "@/providers/places-provider";
import { CatalogoProvider } from "@/providers/catalogo-provider";

/* El segmento se declara dinámico de entrada, antes de que nadie lo pida.
   Sin esta línea `next build` intenta prerenderizar cada ruta de `/admin`, el
   layout lee las cookies de la sesión y Next lanza su señal de «esto es
   dinámico» —`DYNAMIC_SERVER_USAGE`— para salirse del paso estático. El SDK de
   autenticación la captura por el camino y la registra como «cookie validation error»,
   que no es lo que pasó: el error salta *obteniendo* las cookies, no
   validándolas. Queda un bloque de alarma por ruta y por build, todos falsos, y
   un fallo de sesión de verdad se pierde entre ellos. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administración",
  robots: { index: false, follow: false },
};

/**
 * Puerta del panel de administración.
 *
 * Esta comprobación **es la única** desde que la autenticación pasó a Better Auth. El
 * `proxy.ts` ya solo pregunta si hay sesión —cosa que resuelve con una cookie
 * firmada, sin salir a la red— y el rol se pregunta aquí, donde ya se está
 * consultando la base de todos modos. Hacerlo en el proxy costaba una consulta
 * a la base en cada petición, incluidas las de estáticos, y el enlace a la base desde
 * esta máquina es intermitente.
 *
 * El `motivo=rol` no es decorativo: `/login` lo lee para distinguir «no has
 * entrado» de «has entrado y no te toca». Sin él, alguien con sesión de usuario
 * normal vería el formulario otra vez y escribiría su contraseña para nada.
 *
 * **El catálogo se lee aquí, en el servidor.** Este layout ya es un componente
 * de servidor y ya está consultando la base para el rol, así que leer el catálogo
 * en la misma petición no cuesta un viaje extra; en cambio ahorra los dos que
 * hacía el provider desde el navegador (`/api/places` y `/api/categories`)
 * antes de pintar nada. El panel aparece con los datos puestos en vez de con
 * una pantalla de carga. Las dos consultas van en paralelo y no encadenadas.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getAppUser();

  if (user?.role !== "admin") {
    redirect("/login?next=/admin&motivo=rol");
  }

  /* `.catch(() => null)` y no dejar que suba: si la base no contesta, esto se
     comporta como antes —el provider pide los datos desde el cliente y enseña
     su error— en lugar de tumbar el panel entero. */
  const [places, categories, catalogo, contadores, admins] = await Promise.all([
    /* Sin la caché de datos: es la lista con los negocios sin publicar y las
       cartas enteras, y no se guarda en ningún sitio del servidor. */
    listPlacesSinCache().catch(() => null),
    listCategories().catch(() => null),
    cargarCatalogo().catch(() => null),
    /* Los contadores de la navegación, en la misma tanda: son ocho `count(*)`
       baratos y el armazón se pinta con los números puestos. Sin base, se pinta
       a cero y el provider los refresca al enfocar la pestaña. */
    contarPendientesAdmin().catch(() => CONTADORES_VACIOS),
    listarAdmins().catch(() => []),
  ]);

  return (
    <MotionConfig reducedMotion="user">
      <a href="#content" className="skip-link">
        Saltar al contenido
      </a>
      <PlacesProvider
        initialPlaces={places ?? undefined}
        initialCategories={categories ?? undefined}
        /* El único árbol que ve el catálogo entero: aquí es donde se aprueba lo
         pendiente y se reabre lo cerrado. El resto del sitio pide solo lo
         publicado. `listPlaces()` sin opciones ya devuelve todo, así que los
         datos iniciales y el `refreshPlaces` del provider coinciden. */
        includeUnpublished
      >
        {/* El catálogo de planes, por el mismo motivo que las fichas: el panel ya
          está consultando la base, así que leerlo aquí no cuesta un viaje extra y
          el editor de planes y el de suscripciones arrancan con los valores de
          hoy en vez de con los del despliegue. */}
        <CatalogoProvider catalogo={catalogo ?? undefined}>
          <AdminContadoresProvider inicial={contadores ?? CONTADORES_VACIOS}>
            <AdminShell
              usuarioId={user.id}
              admins={
                admins.length > 0
                  ? admins
                  : [
                      {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        imageUrl: null,
                      },
                    ]
              }
            >
              {children}
            </AdminShell>
          </AdminContadoresProvider>
        </CatalogoProvider>
      </PlacesProvider>
    </MotionConfig>
  );
}
