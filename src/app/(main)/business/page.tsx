import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/auth/user";
import { getPlaceById, ownerPlaces, placeStats } from "@/lib/db/queries";
import { statsVisitas } from "@/lib/eventos-server";
import { cargarCatalogo } from "@/lib/catalogo-server";
import { DEV_PLACE_ID, devPlace, ownsDevPlace } from "@/lib/dev-place";
import {
  MODULOS,
  PACKS_ORDER,
  limiteDe,
  type ClaveModulo,
  type Pack,
} from "@/lib/plans";
import { publicacionesDeLaSemana } from "@/lib/publicaciones-server";
import { funcionesDeNegocio, modulosDe, planEfectivoDe } from "@/lib/plans-server";
import { menuUrl } from "@/lib/structured-data";
import { CatalogoProvider } from "@/providers/catalogo-provider";
import { BusinessPanel } from "@/components/business/business-panel";
import { BusinessEntry } from "@/components/business/business-entry";
import { PlansSection } from "@/components/business/plans-section";
import type { NegocioPanel } from "@/components/business/business-switcher";

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
export default async function BusinessPage({
  searchParams,
}: {
  searchParams: Promise<{
    negocio?: string;
    seccion?: string;
    plan?: string;
    modulos?: string;
  }>;
}) {
  const user = await getAppUser();
  if (!user) redirect("/login?next=/business");

  const {
    negocio: pedido,
    seccion,
    plan: planPedido,
    modulos: modulosPedidos,
  } = await searchParams;
  const planElegido: Pack | null =
    planPedido && (PACKS_ORDER as readonly string[]).includes(planPedido)
      ? (planPedido as Pack)
      : null;
  /* Los servicios sueltos que vienen de la portada. Igual que el pack: se
     validan contra el catálogo y solo se usan para marcarlos. */
  const modulosElegidos: ClaveModulo[] = (modulosPedidos?.split(",") ?? []).filter(
    (m): m is ClaveModulo => m in MODULOS,
  );

  /* Los negocios que se pueden abrir aquí, en orden: primero los que reclama
     en `business_owners`, y luego el negocio de prueba, que no está en esa
     tabla —ni en `places`— pero cuenta como suyo para la cuenta autorizada (y
     para cualquiera en desarrollo). Ver `dev-place.ts`. */
  const propios = await ownerPlaces(user.id);
  const negocios: NegocioPanel[] = [
    ...propios.map((p) => ({ id: p.id, nombre: p.name, esPrueba: false })),
    /* `ownsDevPlace` y no `canViewDevPlace`: el selector es de **propiedad**, y
       en desarrollo `canViewDevPlace` contesta que sí a cualquiera, que es como
       el negocio de prueba acababa saliéndole en el panel a cuentas ajenas. */
    ...(ownsDevPlace(user.email)
      ? [{ id: DEV_PLACE_ID, nombre: devPlace().name, esPrueba: true }]
      : []),
  ];

  /* Quién manda: el `?negocio=` **solo si es uno de los suyos**. Un id ajeno en
     la URL no puede abrir la ficha de otro, así que se descarta y se cae al
     primero. Sin query, el primero es el negocio propio si lo hay —el orden de
     arriba—, que es el comportamiento de siempre para quien no tiene fixture. */
  const elegido =
    negocios.find((n) => n.id === pedido) ?? negocios[0] ?? null;
  /* La entrada ahora ofrece los dos caminos de creación. El alta de negocio
     sigue viviendo en el perfil hasta que exista el formulario de campañas. */
  if (!elegido) return <BusinessEntry />;

  const placeId = elegido.id;
  const isDev = placeId === DEV_PLACE_ID;
  const [place, stats, plan, funciones, modulos, cat, publicacionesUsadas] =
    await Promise.all([
      getPlaceById(placeId, {
        includeDev: isDev,
        /* La copia personal del fixture, para que el dueño vea sus ediciones. */
        overrideFor: isDev ? user.id : undefined,
      }),
      placeStats(placeId),
      planEfectivoDe(placeId),
      funcionesDeNegocio(placeId),
      /* Los módulos sueltos que tiene contratados, para la tarjeta del plan: sin
         ellos, un negocio en Gratis con Menú Pro se leería como si no pagara nada. */
      modulosDe(placeId),
      /* El catálogo viaja al navegador para que las tarjetas de plan y los
         candados enseñen los precios y los textos de hoy, no los del despliegue. */
      cargarCatalogo(),
      publicacionesDeLaSemana(placeId),
    ]);

  if (!place) redirect("/profile?seccion=negocio");

  /* Las estadísticas se piden **después** de las funciones porque son ellas las
     que deciden hasta dónde se consulta: un negocio Gratis no paga las otras
     consultas y lo que no tiene contratado no llega a salir de la base. Ver
     `statsVisitas`. */
  const visitas = await statsVisitas(place.id, funciones);

  /* El panel se abre cuando un administrador aprueba la solicitud, no al
     enviarla. Antes se abría al momento —el dueño podía rellenar su ficha
     mientras esperaba— y eso dejaba dos puertas para lo mismo: la solicitud
     pendiente en administración y un panel ya en marcha. Ahora hay una sola:
     hasta que la aprueban, esto devuelve al perfil, que es donde se ve en qué
     estado va.

     ponytail: `isActive` es la única señal de aprobación que existe, así que
     cerrar un negocio ya publicado también le cierra el panel a su dueño. El
     día que eso incomode hace falta un estado de aprobación aparte de la
     publicación, no otra consulta aquí.

     La excepción es `?seccion=planes`: quien elige un plan en la portada
     termina aquí antes de que lo aprueben, y el cobro no depende de la
     publicación —`/api/pagos/qvapay` comprueba propiedad, no `isActive`—. Se
     enseña solo la sección de planes, sin el resto del panel. */
  if (!place.isActive) {
    if (seccion !== "planes") redirect("/profile?seccion=negocio");

    return (
      <CatalogoProvider catalogo={cat}>
        <div className="mx-auto w-full max-w-container px-gutter py-gap-lg md:px-gutter-lg">
          <p className="rounded-2xl border border-verde-200 bg-verde-50/60 px-gap-md py-gap-sm text-small text-verde-900">
            <span className="font-semibold">Tu negocio está en revisión.</span>{" "}
            Puedes pagar el plan ahora: la suscripción se aplica en cuanto un
            administrador apruebe la solicitud.
          </p>
          <div className="mt-gap-md">
            <PlansSection
              plan={plan}
              placeId={place.id}
              planElegido={planElegido}
              modulosElegidos={modulosElegidos}
            />
          </div>
        </div>
      </CatalogoProvider>
    );
  }

  /* La URL absoluta de la carta se resuelve aquí y no en el cliente: el QR
     necesita la dirección entera, y `window.location.origin` en el panel de un
     despliegue de prueba generaría un QR que apunta a la prueba. */
  return (
    <CatalogoProvider catalogo={cat}>
      <BusinessPanel
        place={place}
        stats={stats}
        visitas={visitas}
        publicaciones={{
          usadas: publicacionesUsadas,
          tope: limiteDe(funciones, "publicaciones_semana", cat) ?? 0,
        }}
        menuUrl={menuUrl(place.slug)}
        plan={plan}
        /* El `Set` no cruza la frontera servidor/cliente; viaja como lista y los
           componentes que la recorren la vuelven a envolver. */
        funciones={[...funciones]}
        modulos={modulos}
        /* El negocio de prueba es el único con selector de plan propio: los demás
           cambian por la pasarela o por administración. */
        puedeElegirPlan={isDev}
        planElegido={planElegido}
        modulosElegidos={modulosElegidos}
        negocios={negocios}
      />
    </CatalogoProvider>
  );
}
