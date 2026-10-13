import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { DEV_PLACE_ID } from "@/lib/dev-place";
import { suscripcionDe } from "@/lib/plans-server";
import {
  enTrial,
  planEfectivo,
  PLAN_LABEL,
  type Suscripcion,
} from "@/lib/plans";
import { formatDate, generateId } from "@/lib/utils";

/**
 * Los avisos que la app se escribe sola.
 *
 * Tres, y los tres nacen de un hecho, no de un botón: la bienvenida al crear la
 * cuenta, el «tu negocio ya se ve» cuando la ficha queda publicada y el
 * recordatorio de que la prueba de Pro está por terminar.
 *
 * Los dos últimos son **idempotentes**, y por eso viven aquí y no dentro de la
 * ruta que los dispara. A un dueño se le puede quedar el negocio visible por
 * tres caminos distintos —el alta del perfil, la aprobación de administración o
 * un vínculo escrito a mano en `business_owners`— y el aviso tiene que salir por
 * cualquiera de ellos, una sola vez. La bienvenida no lleva guarda: se llama
 * desde el único punto por el que pasa un usuario nuevo, y solo la primera vez.
 */

/**
 * Los tipos de aviso que hablan del estado de una ficha y se reemplazan entre
 * sí. Los usa la ruta de aprobación para no pisar, al reescribir el aviso de una
 * ficha, los demás que cuelgan de ella —el de la prueba por terminar—.
 */
export const AVISOS_DE_FICHA = [
  "business_submitted",
  "business_approved",
  "business_rejected",
] as const;

/**
 * El saludo de la primera vez.
 *
 * Se llama desde `getAppUser`, en la rama que crea la fila: el único sitio por
 * el que pasa todo el mundo una vez y solo una. Quien lea esto dos veces tendría
 * dos bienvenidas, así que no se llama desde ningún otro sitio.
 */
export async function notificarBienvenida(userId: string): Promise<void> {
  await db.insert(notifications).values({
    id: generateId(),
    userId,
    type: "welcome",
    title: "Bienvenido a La Verde",
    message:
      "La Verde es el mapa de los negocios de tu barrio: busca con tus propias palabras, guarda tus lugares y sigue a los que te interesan. Si tienes un negocio, publícalo desde tu perfil y aparecerás en el mapa.",
  });
}

/** Cuántos días antes del fin de la prueba se avisa al dueño. */
export const DIAS_AVISO_PRUEBA = 7;

/**
 * La frase que dice a un dueño que su negocio ya se ve, y con qué plan.
 *
 * Compartida con la ruta de aprobación para que el aviso diga lo mismo salga
 * por donde salga: dos textos distintos para el mismo hecho se leen como dos
 * hechos distintos.
 */
export function mensajeNegocioVisible(
  nombre: string,
  suscripcion: Suscripcion | null,
): string {
  const base = `«${nombre}» ya está publicado en La Verde y así pueden encontrarlo.`;

  /* Durante la prueba el plan efectivo es Pro, así que se dice eso y hasta
     cuándo: es el dato con el que el dueño decide si paga, y enterrarlo sería
     hacerle perder el momento en que más vale. */
  if (enTrial(suscripcion) && suscripcion?.trialHasta) {
    return `${base} Tienes el plan Pro activo, en prueba gratis hasta el ${formatDate(suscripcion.trialHasta)}.`;
  }

  const plan = planEfectivo(suscripcion);
  return plan === "gratis"
    ? `${base} Tienes el plan Gratis activo; puedes subir de plan desde el panel del negocio.`
    : `${base} Tienes el plan ${PLAN_LABEL[plan]} activo.`;
}

/**
 * ¿Ya recibió **esta persona** este aviso sobre **esta ficha**?
 *
 * Las dos condiciones y no solo la ficha: un negocio puede cambiar de dueño, y
 * con el filtro por ficha a secas el segundo dueño heredaba el «ya se te avisó»
 * del primero y no le llegaba nunca el suyo.
 */
async function existeAviso(
  userId: string,
  placeId: string,
  type: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.placeId, placeId),
        eq(notifications.type, type),
      ),
    )
    .limit(1);

  return Boolean(row);
}

/**
 * Deja al día los avisos de un negocio que ya está visible.
 *
 * Se llama desde `/api/me`, que es la ruta por la que pasa todo el mundo en cada
 * página: así el aviso alcanza también al negocio que quedó vinculado a una
 * cuenta sin pasar por la aprobación del panel.
 *
 * Best-effort por parte de quien llama: un aviso que no sale no puede tumbar el
 * menú de nadie.
 */
export async function asegurarAvisosDeNegocio({
  userId,
  placeId,
  nombre,
}: {
  userId: string;
  placeId: string;
  nombre: string;
}): Promise<void> {
  /* El negocio de prueba no tiene fila en `business_owners` —es un fixture— y
     avisar de él llenaría de ruido real una bandeja que no es de nadie. */
  if (placeId === DEV_PLACE_ID) return;

  const suscripcion = await suscripcionDe(placeId);

  if (!(await existeAviso(userId, placeId, "business_approved"))) {
    await db.insert(notifications).values({
      id: generateId(),
      userId,
      type: "business_approved",
      title: "Tu negocio ya está visible",
      message: mensajeNegocioVisible(nombre, suscripcion),
      placeId,
    });
  }

  if (!enTrial(suscripcion) || !suscripcion?.trialHasta) return;

  const fin = suscripcion.trialHasta;
  const dias = Math.ceil((fin.getTime() - Date.now()) / 86_400_000);
  /* Solo dentro de la ventana del aviso: un negocio que acaba de empezar tiene
     la prueba entera por delante y avisarle el primer día es ruido. */
  if (dias > DIAS_AVISO_PRUEBA) return;
  if (await existeAviso(userId, placeId, "trial_ending")) return;

  await db.insert(notifications).values({
    id: generateId(),
    userId,
    type: "trial_ending",
    title: "Tu prueba de Pro termina pronto",
    message:
      `La prueba de Pro de «${nombre}» termina el ${formatDate(fin)} ` +
      `(${dias === 1 ? "queda 1 día" : `quedan ${dias} días`}). ` +
      "Cuando acabe, el negocio pasa al plan Gratis y se desactivan las funciones de Pro.",
    placeId,
  });
}
