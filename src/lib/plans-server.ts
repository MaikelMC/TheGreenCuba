import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { suscripciones } from "@/lib/db/schema";
import { DEV_PLACE_ID } from "@/lib/dev-place";
import { readDevPlacePlan } from "@/lib/dev-place-server";
import {
  FEATURES_POR_PLAN,
  LIMITES,
  planEfectivo,
  trialHastaDesde,
  type ClaveLimite,
  type Feature,
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
    })
    .from(suscripciones)
    .where(eq(suscripciones.negocioId, negocioId))
    .limit(1);

  return row ?? null;
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
  if (negocioId === DEV_PLACE_ID) {
    return (await readDevPlacePlan()) ?? "gratis";
  }
  return planEfectivo(await suscripcionDe(negocioId));
}

/**
 * ¿Puede este negocio usar esta función?
 *
 * Es la comprobación que se llama en las rutas que escriben. Hoy la usan las
 * publicaciones de Facebook —desde el panel del negocio y desde administración—
 * y las ofertas flash; las que aún no existen —flyers— la llamarán cuando las
 * haya, y este es el guardián que va delante.
 */
export async function puede(
  negocioId: string,
  feature: Feature,
): Promise<boolean> {
  const plan = await planEfectivoDe(negocioId);
  return (FEATURES_POR_PLAN[plan] as readonly Feature[]).includes(feature);
}

/** El tope de una clave para este negocio. `null` = sin tope. */
export async function limite(
  negocioId: string,
  clave: ClaveLimite,
): Promise<number | null> {
  const plan = await planEfectivoDe(negocioId);
  return LIMITES[clave][plan];
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
