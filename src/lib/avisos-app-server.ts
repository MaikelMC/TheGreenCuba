import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  businessOwners,
  notifications,
  places,
  pushSubscriptions,
  users,
} from "@/lib/db/schema";
import { cargarCatalogo } from "@/lib/catalogo-server";
import { funcionesDe } from "@/lib/plans";
import { suscripcionDe } from "@/lib/plans-server";
import { enviarPushAUsuarios } from "@/lib/push-server";
import { MAX_CUERPO_PUSH, recortarTexto } from "@/lib/push-texto";
import { seguidoresDeNegocio } from "@/lib/seguimientos-app-server";
import {
  placeInUserProvince,
  userProvinceFromLocationCity,
} from "@/lib/user-province";
import { generateId } from "@/lib/utils";

/**
 * Los avisos que mantienen al usuario al día sin que abra la app.
 *
 * Son tres hechos distintos y por eso son tres disparadores:
 *
 *  - **Un negocio que sigues.** Lo pidió explícitamente con «Avísame»: recibe
 *    el aviso en la bandeja y, si tiene push, en el móvil.
 *  - **Una novedad cerca de ti.** No la pidió negocio por negocio, así que solo
 *    llega a quien activó los avisos push y está en la misma provincia. Se
 *    escribe también en la bandeja para que lo que se empujó se pueda releer.
 *  - **Un negocio nuevo en tu provincia.** Misma regla y mismo motivo: es un
 *    aviso de interés general, no una suscripción, y no debe llenar la bandeja
 *    de nadie que no haya pedido recibir avisos.
 *
 * El «cerco» se resuelve **por provincia** y no por kilómetros porque el perfil
 * guarda la provincia elegida en el onboarding, no coordenadas. Es la misma
 * decisión que ya toma `/api/novedades`: sin GPS, la provincia es lo único que
 * se puede afirmar, y suponer una distancia sería inventarla.
 *
 * Nada de esto lanza: un aviso es un extra y no puede tumbar el guardado que lo
 * originó. Las llamadas van con `after()`, igual que los avisos de Telegram.
 */

const TIPO_NOVEDAD = "business_novedad";
const TIPO_NEGOCIO_NUEVO = "new_business_nearby";

/**
 * La frase con la que se resumen varias novedades.
 *
 * «A · B · C» es una lista de máquina y en un aviso se lee mal; en prosa queda
 * «A y B», o «A, B y 3 más» cuando hay una carta entera. Se nombran como mucho
 * dos: el cuerpo del push son dos líneas y lo demás se pierde igual, pero al
 * menos se dice cuánto queda.
 */
function fraseDeNovedades(titulares: string[]): string {
  const [primero, segundo] = titulares;
  if (!primero) return "";
  if (!segundo) return primero;

  const resto = titulares.length - 2;
  return resto === 0
    ? `${primero} y ${segundo}`
    : `${primero}, ${segundo} y ${resto} más`;
}

/** Los dueños de una ficha: no se avisan de su propio negocio. */
async function propietariosDe(negocioId: string): Promise<Set<string>> {
  const filas = await db
    .select({ userId: businessOwners.userId })
    .from(businessOwners)
    .where(eq(businessOwners.placeId, negocioId));
  return new Set(filas.map((fila) => fila.userId));
}

/**
 * Usuarios con push activo cuya provincia coincide con la del negocio.
 *
 * Se parte de las suscripciones y no de la tabla de usuarios porque este aviso
 * solo puede entregarse por push; recorrer todos los usuarios del país para
 * acabar descartándolos en el envío sería trabajo tirado.
 *
 * La comparación es la misma de siempre —normalizada, sin acentos y por
 * contención—, para que «Santiago de Cuba» del perfil encuentre una ficha que el
 * dueño guardó como «Santiago».
 */
async function usuariosConPushEnProvincia(
  provincia: string,
): Promise<string[]> {
  const objetivo = provincia?.trim();
  if (!objetivo) return [];

  const filas = await db
    .selectDistinct({
      userId: pushSubscriptions.userId,
      locationCity: users.locationCity,
    })
    .from(pushSubscriptions)
    .innerJoin(users, eq(users.id, pushSubscriptions.userId));

  const ids = new Set<string>();
  for (const fila of filas) {
    const provinciaUsuario = userProvinceFromLocationCity(fila.locationCity);
    if (!provinciaUsuario) continue;
    const lugar = { province: provinciaUsuario, city: provinciaUsuario };
    if (placeInUserProvince(lugar, objetivo)) ids.add(fila.userId);
  }
  return [...ids];
}

/** ¿El negocio tiene algo de pago vigente? Es el mismo filtro del feed del home. */
async function negocioConPlanDePago(negocioId: string): Promise<boolean> {
  try {
    const [suscripcion, cat] = await Promise.all([
      suscripcionDe(negocioId),
      cargarCatalogo(),
    ]);
    return funcionesDe(suscripcion, new Date(), cat).size > cat.gratis.length;
  } catch {
    /* Si los planes no se pueden leer, se prefiere no mandar el aviso general:
       una novedad de más pesa más que una de menos. */
    return false;
  }
}

/** Escribe una fila de bandeja por cada destinatario. Devuelve los ids creados. */
async function crearAvisos(
  userIds: string[],
  aviso: { type: string; title: string; message: string; placeId: string },
): Promise<void> {
  if (userIds.length === 0) return;

  /* Por tandas: un aviso de provincia puede tener cientos de destinatarios y
     Postgres corta en 65 535 parámetros. Cada fila gasta nueve. */
  const TAMANO_LOTE = 500;
  for (let i = 0; i < userIds.length; i += TAMANO_LOTE) {
    const lote = userIds.slice(i, i + TAMANO_LOTE);
    await db.insert(notifications).values(
      lote.map((userId) => ({
        id: generateId(),
        userId,
        ...aviso,
      })),
    );
  }
}

/**
 * Avisa de lo que cambió en un negocio.
 *
 * Dos públicos, y **el orden importa**: primero los seguidores, para que quien
 * marcó «Avísame» reciba la frase que pidió («Novedades de X»), y después los
 * vecinos que no lo siguen, que reciben la genérica («Novedades cerca de ti»).
 * Un seguidor que vive en la provincia está en los dos conjuntos y se descarta
 * del segundo: dos avisos por el mismo hecho se leen como dos hechos.
 *
 * `titulares` son los títulos de las novedades recién guardadas; si son varios
 * —una carta entera en un guardado— se resumen en una línea en vez de mandar un
 * push por producto.
 */
export async function avisarNovedadesDeNegocio({
  negocioId,
  nombre,
  provincia,
  titulares,
  visible,
}: {
  negocioId: string;
  nombre: string;
  provincia: string | null;
  titulares: string[];
  /** Solo se avisa de fichas publicadas: lo que no se puede abrir no es novedad. */
  visible: boolean;
}): Promise<void> {
  if (!visible || titulares.length === 0) return;

  try {
    /* Sin repetidos: dos «Tostados del día» en la misma frase se leen como un
       fallo de la app. */
    const limpios = [
      ...new Set(titulares.map((titulo) => titulo.trim()).filter(Boolean)),
    ];
    if (limpios.length === 0) return;

    const frase = fraseDeNovedades(limpios);
    const resumen = recortarTexto(frase, MAX_CUERPO_PUSH);
    const propietarios = await propietariosDe(negocioId);

    const seguidores = (await seguidoresDeNegocio(negocioId)).filter(
      (id) => !propietarios.has(id),
    );
    const seguidoresSet = new Set(seguidores);

    await crearAvisos(seguidores, {
      type: TIPO_NOVEDAD,
      title: `Novedades de ${nombre}`,
      message: resumen,
      placeId: negocioId,
    });

    if (seguidores.length > 0) {
      await enviarPushAUsuarios(seguidores, {
        title: `Novedades de ${nombre}`,
        body: resumen,
        url: `/place/${negocioId}`,
        tag: `novedad-${negocioId}`,
      });
    }

    if (!provincia?.trim()) return;
    if (!(await negocioConPlanDePago(negocioId))) return;

    const cercanos = (await usuariosConPushEnProvincia(provincia)).filter(
      (id) => !propietarios.has(id) && !seguidoresSet.has(id),
    );
    if (cercanos.length === 0) return;

    /* Aquí el título no nombra al negocio —es genérico—, así que lo nombra el
       cuerpo. En el aviso del seguidor pasa al revés, y por eso ninguno de los
       dos repite el nombre dos veces. */
    const mensaje = recortarTexto(`${nombre}: ${frase}`, MAX_CUERPO_PUSH);

    await crearAvisos(cercanos, {
      type: TIPO_NOVEDAD,
      title: "Novedades cerca de ti",
      message: mensaje,
      placeId: negocioId,
    });

    await enviarPushAUsuarios(cercanos, {
      title: "Novedades cerca de ti",
      body: mensaje,
      url: `/place/${negocioId}`,
      tag: `novedad-${negocioId}`,
    });
  } catch (error) {
    console.error(
      "[avisos-app] no se pudieron avisar las novedades:",
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * «Hay un negocio nuevo en tu provincia».
 *
 * Se llama cuando la ficha **queda publicada**, no cuando se envía la solicitud:
 * avisar de un negocio que todavía no se puede abrir es mandar a la gente a una
 * puerta cerrada, y una ficha rechazada habría gastado el aviso igual.
 *
 * Es idempotente por la fila de bandeja: si ya hay un aviso de este tipo para
 * esta ficha, la aprobación se repite y no se vuelve a empujar. Cuando no hay
 * nadie suscrito no se escribe nada, y el siguiente intento tampoco tiene a
 * quién avisar, así que el hueco no genera duplicados.
 */
export async function avisarNegocioNuevo(negocioId: string): Promise<void> {
  try {
    const [lugar] = await db
      .select({
        name: places.name,
        city: places.city,
        province: places.province,
        isActive: places.isActive,
      })
      .from(places)
      .where(eq(places.id, negocioId))
      .limit(1);

    if (!lugar || !lugar.isActive) return;

    const yaAvisado = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.placeId, negocioId),
          eq(notifications.type, TIPO_NEGOCIO_NUEVO),
        ),
      )
      .limit(1);

    if (yaAvisado.length > 0) return;

    const provincia = lugar.province?.trim() || lugar.city?.trim() || "";
    if (!provincia) return;

    const propietarios = await propietariosDe(negocioId);
    const destinatarios = (await usuariosConPushEnProvincia(provincia)).filter(
      (id) => !propietarios.has(id),
    );
    if (destinatarios.length === 0) return;

    /* «Nuevo negocio en X» y no «Nuevo en X»: en la bandeja se lee suelto y el
       segundo parece que hay algo nuevo, no un negocio. El «Míralo en el mapa»
       sobraba: pulsar el aviso ya lleva a la ficha. */
    const titulo = `Nuevo negocio en ${provincia}`;
    const mensaje = recortarTexto(
      `«${lugar.name}» ya está en La Verde.`,
      MAX_CUERPO_PUSH,
    );

    await crearAvisos(destinatarios, {
      type: TIPO_NEGOCIO_NUEVO,
      title: titulo,
      message: mensaje,
      placeId: negocioId,
    });

    await enviarPushAUsuarios(destinatarios, {
      title: titulo,
      body: mensaje,
      url: `/place/${negocioId}`,
      tag: `nuevo-negocio-${negocioId}`,
    });
  } catch (error) {
    console.error(
      "[avisos-app] no se pudo avisar del negocio nuevo:",
      error instanceof Error ? error.message : error,
    );
  }
}
