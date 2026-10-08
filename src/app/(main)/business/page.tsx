import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/auth/user";
import { getPlaceById, ownerPlaceId, placeStats } from "@/lib/db/queries";
import { planEfectivoDe } from "@/lib/plans-server";
import { menuUrl } from "@/lib/structured-data";
import { BusinessPanel } from "@/components/business/business-panel";
import { BusinessEntry } from "@/components/business/business-entry";

/**
 * El panel del negocio, resuelto en el servidor.
 *
 * Esta página era un componente de cliente con todo escrito a fuego: el nombre
 * «St. Pauli Restaurant-Bar», su dirección, su oferta, un dashboard con «342
 * visitas, +18%» y un feed de actividad inventados, y `PhotoGrid` apuntando al
 * id `st-pauli`. El propio archivo lo tenía anotado —«el día que `/business`
 * deje de ser un prototipo, el id sale de `business_owners` para el usuario de
 * la sesión»—. Ese día es hoy, y con el alta desde el perfil deja de ser una
 * nota al pie: sin esto, quien acaba de registrar su negocio entraría a ver las
 * visitas del restaurante de otro.
 *
 * Se resuelve aquí y no en el cliente por lo mismo que la ficha de lugar: el
 * layout ya es un componente de servidor que consulta a Neon para el rol, así
 * que leer el negocio en la misma petición no cuesta un viaje extra y ahorra la
 * pantalla de carga. El panel aparece con los datos puestos.
 *
 * Reutiliza `getPlaceById`, que está cacheada y la comparten la ficha pública y
 * el `sitemap`: no hay una segunda forma de leer un negocio.
 */
export default async function BusinessPage() {
  const user = await getAppUser();
  if (!user) redirect("/login?next=/business");

  const placeId = await ownerPlaceId(user.id);
  /* La entrada ahora ofrece los dos caminos de creación. El alta de negocio
     sigue viviendo en el perfil hasta que exista el formulario de campañas. */
  if (!placeId) return <BusinessEntry />;

  const [place, stats, plan] = await Promise.all([
    getPlaceById(placeId),
    placeStats(placeId),
    planEfectivoDe(placeId),
  ]);

  if (!place) redirect("/profile?seccion=negocio");

  /* El panel se abre cuando un administrador aprueba la solicitud, no al
     enviarla. Antes se abría al momento —el dueño podía rellenar su ficha
     mientras esperaba— y eso dejaba dos puertas para lo mismo: la solicitud
     pendiente en administración y un panel ya en marcha. Ahora hay una sola:
     hasta que la aprueban, esto devuelve al perfil, que es donde se ve en qué
     estado va.

     ponytail: `isActive` es la única señal de aprobación que existe, así que
     cerrar un negocio ya publicado también le cierra el panel a su dueño. El
     día que eso incomode hace falta un estado de aprobación aparte de la
     publicación, no otra consulta aquí. */
  if (!place.isActive) redirect("/profile?seccion=negocio");

  /* La URL absoluta de la carta se resuelve aquí y no en el cliente: el QR
     necesita la dirección entera, y `window.location.origin` en el panel de un
     despliegue de prueba generaría un QR que apunta a la prueba. */
  return (
    <BusinessPanel
      place={place}
      stats={stats}
      menuUrl={menuUrl(place.id)}
      plan={plan}
    />
  );
}
