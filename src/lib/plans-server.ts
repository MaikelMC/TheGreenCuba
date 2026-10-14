import { eq } from "drizzle-orm";
import { cargarCatalogo } from "@/lib/catalogo-server";
import { db } from "@/lib/db";
import { suscripciones } from "@/lib/db/schema";
import { DEV_PLACE_ID } from "@/lib/dev-place";
import { readDevPlaceContratado } from "@/lib/dev-place-server";
import {
  aSuscripcion,
  funcionesDe,
  limiteDe,
  planEfectivo,
  trialHastaDesde,
  type ClaveLimite,
  type ClaveModulo,
  type Funcion,
  type Plan,
  type Suscripcion,
} from "@/lib/plans";
import { generateId } from "@/lib/utils";

/**
 * Los permisos, del lado del servidor.
 *
 * `plans.ts` decide —el mapa y las reglas—, esto es lo único que sabe leer la
 * base. **Ningún permiso se valida en el cliente**: allí el mapa solo sirve
 * para pintar el candado. Un candado que se dibuja sin comprobarse en el
 * servidor es decoración, y la ruta que escribe sigue abierta para quien sepa
 * llamarla.
 *
 * La resolución de permisos va por `funcionesDeNegocio`, que devuelve **el
 * conjunto de funciones** del negocio, no un plan: con módulos sueltos un
 * negocio puede tener cosas que ningún pack nombra, y preguntar por el nombre
 * del plan perdería esos módulos por el camino.
 */

/** La fila de suscripción del negocio, o `null` si nunca tuvo una. */
export async function suscripcionDe(
  negocioId: string,
): Promise<Suscripcion | null> {
  const [row] = await db
    .select({
      plan: suscripciones.plan,
      estado: suscripciones.estado,
      trialHasta: suscripciones.trialHasta,
      venceEn: suscripciones.venceEn,
      modulos: suscripciones.modulos,
    })
    .from(suscripciones)
    .where(eq(suscripciones.negocioId, negocioId))
    .limit(1);

  return aSuscripcion(row ?? null);
}

/**
 * El plan que manda. Sin fila, o con la prueba vencida, es `gratis`.
 *
 * El negocio de prueba es la excepción: no tiene fila en `suscripciones`, y su
 * plan se elige a voluntad desde el panel para poder probar cada plan (ver
 * `place_overrides.plan`). En cuanto el dueño lo cambia, todo lo que cuelga de
 * aquí —`puede`, `limite`, las funciones del panel— responde al plan nuevo.
 */
export async function planEfectivoDe(negocioId: string): Promise<Plan> {
  const cat = await cargarCatalogo();
  if (negocioId === DEV_PLACE_ID) {
    const c = await readDevPlaceContratado();
    return planEfectivo(c ? aSuscripcion(c) : null, new Date(), cat);
  }
  return planEfectivo(await suscripcionDe(negocioId), new Date(), cat);
}

/**
 * **Todo lo que puede hacer este negocio ahora mismo**, ya resuelto.
 *
 * Es lo que viaja al panel del negocio: allí el candado se pinta sobre esta
 * lista y no sobre un nombre de plan, porque el plan ya no lo dice todo —un
 * negocio en Gratis con Menú Pro contratado tiene funciones que «Gratis» no
 * nombra—. Viajan funciones y no la fila entera: el navegador no tiene por qué
 * ver fechas de contratación ni el descuento acordado.
 */
export async function funcionesDeNegocio(
  negocioId: string,
): Promise<Set<Funcion>> {
  const cat = await cargarCatalogo();
  if (negocioId === DEV_PLACE_ID) {
    const c = await readDevPlaceContratado();
    return funcionesDe(c ? aSuscripcion(c) : null, new Date(), cat);
  }
  return funcionesDe(await suscripcionDe(negocioId), new Date(), cat);
}

/**
 * Las claves de los módulos sueltos **vigentes** de un negocio.
 *
 * Viaja al panel porque el plan no lo dice todo: un negocio en Gratis con Menú
 * Pro contratado tiene cosas que «Gratis» no nombra, y la tarjeta del plan tiene
 * que contarlas. Viajan solo las claves —los nombres y los precios los pone el
 * catálogo, que el navegador ya tiene—, por lo mismo que no viaja la fila de
 * `suscripciones`: el navegador no tiene por qué ver fechas ni descuentos.
 */
export async function modulosDe(negocioId: string): Promise<ClaveModulo[]> {
  const susc =
    negocioId === DEV_PLACE_ID
      ? aSuscripcion(await readDevPlaceContratado())
      : await suscripcionDe(negocioId);
  const ahora = new Date();
  return (susc?.modulos ?? [])
    .filter((m) => !m.hasta || m.hasta.getTime() > ahora.getTime())
    .map((m) => m.clave);
}

/**
 * ¿Puede este negocio usar esta función?
 *
 * Es la comprobación que se llama en las rutas que escriben: las publicaciones
 * de Facebook, las ofertas flash, el «Hoy hay», los avisos a seguidores y el
 * asistente la usan hoy; las que aún no existen la llamarán cuando las haya, y
 * este es el guardián que va delante.
 */
export async function tieneFuncion(
  negocioId: string,
  funcion: Funcion,
): Promise<boolean> {
  return (await funcionesDeNegocio(negocioId)).has(funcion);
}

/** Alias de `tieneFuncion`, para las llamadas que ya existían. */
export const puede = tieneFuncion;

/** El tope de una clave para este negocio. `null` = sin tope. */
export async function limite(
  negocioId: string,
  clave: ClaveLimite,
): Promise<number | null> {
  return limiteDe(await funcionesDeNegocio(negocioId), clave, await cargarCatalogo());
}

/**
 * La suscripción con la que nace un negocio: gratis, con la prueba de Pro
 * arrancando hoy.
 *
 * `onConflictDoNothing` no es por si acaso: los dos caminos de alta —el del
 * perfil y el de administración— pueden encontrarse con una ficha que ya tenía
 * fila, y repetirla reventaría contra el `unique` y tumbaría el alta entera.
 */
export async function crearSuscripcion(negocioId: string): Promise<void> {
  await db
    .insert(suscripciones)
    .values({
      id: generateId(),
      negocioId,
      plan: "gratis",
      estado: "activa",
      trialHasta: trialHastaDesde(new Date()),
    })
    .onConflictDoNothing({ target: suscripciones.negocioId });
}
