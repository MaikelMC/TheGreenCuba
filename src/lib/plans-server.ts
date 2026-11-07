import { and, eq, gt, sql } from "drizzle-orm";
import { cargarCatalogo } from "@/lib/catalogo-server";
import { db } from "@/lib/db";
import { packsMedida, suscripciones } from "@/lib/db/schema";
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
import type { PackMedidaResumen } from "@/lib/pack-medida";
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
 * conjunto de funciones** del negocio, no un plan: con módulos sueltos (y
 * ahora con el pack a medida) un negocio puede tener cosas que ningún pack
 * nombra, y preguntar por el nombre del plan perdería esos extras por el camino.
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
 * La suscripción y las funciones del pack a medida vigente, en dos consultas
 * paralelas — sin esperar una para lanzar la otra.
 *
 * El pack vigente es el que tiene `estado = 'pagado'` y `vence_en > ahora`.
 * Solo puede haber uno (la restricción parcial del índice lo garantiza para
 * los estados en tramitación; el webhook no permite crear otro pagado mientras
 * uno ya está activo).
 */
async function suscripcionYPackDe(negocioId: string): Promise<{
  suscripcion: Suscripcion | null;
  packFunciones: string[];
}> {
  const ahora = new Date();

  const [suscRows, packRows] = await Promise.all([
    db
      .select({
        plan: suscripciones.plan,
        estado: suscripciones.estado,
        trialHasta: suscripciones.trialHasta,
        venceEn: suscripciones.venceEn,
        modulos: suscripciones.modulos,
      })
      .from(suscripciones)
      .where(eq(suscripciones.negocioId, negocioId))
      .limit(1),
    db
      .select({ funciones: packsMedida.funciones })
      .from(packsMedida)
      .where(
        and(
          eq(packsMedida.negocioId, negocioId),
          eq(packsMedida.estado, "pagado"),
          gt(packsMedida.venceEn, sql`now()`),
        ),
      )
      .limit(1),
  ]);

  return {
    suscripcion: aSuscripcion(suscRows[0] ?? null),
    packFunciones: packRows[0]?.funciones ?? [],
  };
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
 * Tres fuentes de funciones, sumadas sin excluirse:
 *   1. Plan estándar + módulos sueltos (de `suscripciones`).
 *   2. Pack a medida vigente (de `packs_medida`).
 *
 * El pack a medida es una fuente más: basta con que una sola vía dé la función
 * para que el negocio la tenga. Las funciones del pack son una foto del momento
 * en que se guardó, así que un cambio de catálogo no afecta a un pack ya pagado.
 *
 * Viajan funciones y no la fila entera: el navegador no tiene por qué ver
 * fechas de contratación ni el descuento acordado.
 */
export async function funcionesDeNegocio(
  negocioId: string,
): Promise<Set<Funcion>> {
  const cat = await cargarCatalogo();

  if (negocioId === DEV_PLACE_ID) {
    const c = await readDevPlaceContratado();
    return funcionesDe(c ? aSuscripcion(c) : null, new Date(), cat);
  }

  const { suscripcion, packFunciones } = await suscripcionYPackDe(negocioId);
  const set = funcionesDe(suscripcion, new Date(), cat);

  /* Las funciones del pack se suman sin filtrar por `disponible`: el pack ya
     pagado tiene sus funciones como foto del momento, y cambiar el catálogo
     no debería cortarle el acceso a un negocio que ya pagó. */
  for (const f of packFunciones) {
    set.add(f as Funcion);
  }

  return set;
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
 * El pack a medida que debe mostrar el panel del negocio, o `null` si no hay.
 *
 * Se devuelve el primero en tramitación (`solicitado | borrador | enviado`) o
 * el vigente (`pagado` sin vencer), en ese orden de prioridad. El historial
 * (vencidos, cancelados, rechazados) no viaja al panel del dueño.
 */
export async function packMedidaDe(
  negocioId: string,
): Promise<PackMedidaResumen | null> {
  const ahora = new Date();

  /* Un negocio puede tener a lo sumo un pack en tramitación (índice parcial
     garantiza eso) y uno vigente. Se buscan los dos en un solo viaje. */
  const filas = await db
    .select({
      id: packsMedida.id,
      estado: packsMedida.estado,
      servicios: packsMedida.servicios,
      funciones: packsMedida.funciones,
      precioUsd: packsMedida.precioUsd,
      oferta2x1: packsMedida.oferta2x1,
      notaCliente: packsMedida.notaCliente,
      venceEn: packsMedida.venceEn,
      enviadoEn: packsMedida.enviadoEn,
      pagadoEn: packsMedida.pagadoEn,
    })
    .from(packsMedida)
    .where(
      and(
        eq(packsMedida.negocioId, negocioId),
        sql`${packsMedida.estado} in ('solicitado', 'enviado', 'pagado')`,
      ),
    )
    .limit(2);

  if (filas.length === 0) return null;

  /* Prioridad: si hay un pack en tramitación, ese manda (el dueño tiene que
     decidir o administración tiene que armar). El vigente pagado va detrás. */
  const fila =
    filas.find((f) => f.estado === "enviado") ??
    filas.find((f) => f.estado === "solicitado") ??
    filas.find(
      (f) =>
        f.estado === "pagado" &&
        f.venceEn !== null &&
        f.venceEn.getTime() > ahora.getTime(),
    ) ??
    null;

  if (!fila || fila.precioUsd === null) return null;

  return {
    id: fila.id,
    estado: fila.estado,
    servicios: fila.servicios,
    funciones: fila.funciones,
    precioUsd: fila.precioUsd,
    oferta2x1: fila.oferta2x1,
    notaCliente: fila.notaCliente,
    venceEn: fila.venceEn?.toISOString() ?? null,
    enviadoEn: fila.enviadoEn?.toISOString() ?? null,
    pagadoEn: fila.pagadoEn?.toISOString() ?? null,
  };
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
 * El descuento acordado para este negocio, o `null` si no hay.
 *
 * Lo lee la ruta de cobro para aplicarlo al precio, y la página del panel
 * para mostrarlo en las tarjetas de planes.
 */
export async function descuentoPctDe(negocioId: string): Promise<number | null> {
  if (negocioId === DEV_PLACE_ID) return null;
  const [row] = await db
    .select({ descuentoPct: suscripciones.descuentoPct })
    .from(suscripciones)
    .where(eq(suscripciones.negocioId, negocioId))
    .limit(1);
  return row?.descuentoPct ?? null;
}

/**
 * La suscripción con la que nace un negocio: gratis, con la prueba de Pro
 * arrancando hoy.
 *
 * `onConflictDoNothing` no es por si acaso: los dos caminos de alta —el del
 * perfil y el de administración— pueden encontrarse con una ficha que ya tenía
 * fila, y repetirla reventaría contra el `unique` y tumbaría el alta entera.
 *
 * El trial se crea si `catalogo.trialNegociosNuevos` está activo (true por
 * defecto). Desde `/admin/planes` se puede apagar sin tocar código.
 */
export async function crearSuscripcion(negocioId: string): Promise<void> {
  const cat = await cargarCatalogo();
  const conTrial = cat.trialNegociosNuevos !== false; // true si no está definido

  await db
    .insert(suscripciones)
    .values({
      id: generateId(),
      negocioId,
      plan: "gratis",
      estado: "activa",
      trialHasta: conTrial ? trialHastaDesde(new Date()) : null,
    })
    .onConflictDoNothing({ target: suscripciones.negocioId });
}
