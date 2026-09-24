import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/auth/user";
import { getPlaceById, ownerPlaceId, placeStats } from "@/lib/db/queries";
import { BusinessPanel } from "@/components/business/business-panel";

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
  /* El layout ya ha comprobado el rol, pero el rol dice que llevas **algún**
     negocio, no que exista: una cuenta puede quedarse como `owner` sin fila si
     algo se cortó a mitad del alta. Sin negocio no hay panel, así que se manda
     al formulario en vez de dejar una pantalla vacía. */
  if (!placeId) redirect("/profile?seccion=negocio");

  const [place, stats] = await Promise.all([getPlaceById(placeId), placeStats(placeId)]);

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

  return <BusinessPanel place={place} stats={stats} />;
}
