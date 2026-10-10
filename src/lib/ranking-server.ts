import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  categories,
  eventosDiarios,
  eventosUnicos,
  places,
  rankingMensual,
  suscripciones,
} from "@/lib/db/schema";
import { generateId } from "@/lib/utils";
import {
  DESCUENTO_PCT,
  pareceFraude,
  rangoPeriodo,
  topPorGrupo,
  type CandidatoRanking,
} from "@/lib/ranking";

/**
 * El lado servidor del ranking: calcular el podio de un mes y leerlo.
 *
 * El cálculo lo dispara el job de `api/cron/ranking` una vez al mes; la lectura
 * la hace la página pública `/ranking`. La insignia de la ficha no pasa por
 * aquí: la resuelve un `exists` sobre esta tabla dentro de la consulta del
 * catálogo (ver `SELECT_WITH_CATEGORY` en `queries.ts`), para no pagar un viaje
 * por negocio al pintar la lista.
 *
 * El cálculo es **idempotente**: borra el periodo entero antes de reescribirlo,
 * así que volver a lanzarlo —o corregir un mes a mano con `?periodo=`— deja el
 * mismo resultado y nunca duplica puestos.
 */

/** Qué hizo una pasada del job, para poder contestarlo en el JSON de la ruta. */
export interface ResultadoCalculo {
  periodo: string;
  puestos: number;
  ganadores: number;
  descartados: number;
}

/**
 * Calcula y guarda el ranking de `periodo`, y concede el descuento.
 *
 * Tres lecturas y tres escrituras, en este orden:
 *
 * 1. Las **visitas únicas** por negocio (`sum(unicos)` de `vista_perfil` en el
 *    rango de fechas del periodo).
 * 2. La **repartición por visitante** de cada negocio, que es lo que decide si
 *    el negocio se descarta por inflado. Va contra `eventos_unicos`, que es la
 *    tabla donde cada visitante distinto deja una fila.
 * 3. La **categoría y el municipio** de cada negocio, de `places` con su
 *    categoría. Solo negocios activos: uno cerrado no debería ganar un mes.
 *
 * Lo que no tiene grupo —un negocio sin ciudad, por ejemplo— no entra: sin
 * municipio no hay grupo contra el que competir y la fila no cabría en
 * `/ranking`.
 *
 * El descuento va a la suscripción del ganador **si la tiene**; un negocio sin
 * fila en `suscripciones` es gratis y no hay factura que rebajar (el `update`
 * simplemente no encuentra fila). No se limpia el descuento de quien dejó de
 * ganar: fue un acuerdo suyo y quitarlo sería decidir por él —lo hace la
 * administración a mano—.
 */
export async function calcularRanking(
  periodo: string,
  descuentoPct: number = DESCUENTO_PCT,
): Promise<ResultadoCalculo> {
  const { desde, hasta } = rangoPeriodo(periodo);

  const visitas = await db
    .select({
      negocioId: eventosDiarios.negocioId,
      unicos: sql<number>`coalesce(sum(${eventosDiarios.unicos}), 0)::int`,
    })
    .from(eventosDiarios)
    .where(
      and(
        eq(eventosDiarios.tipo, "vista_perfil"),
        gte(eventosDiarios.fecha, desde),
        lte(eventosDiarios.fecha, hasta),
      ),
    )
    .groupBy(eventosDiarios.negocioId);

  const porVisitante = await db
    .select({
      negocioId: eventosUnicos.negocioId,
      visitas: sql<number>`count(*)::int`,
    })
    .from(eventosUnicos)
    .where(
      and(
        eq(eventosUnicos.tipo, "vista_perfil"),
        gte(eventosUnicos.fecha, desde),
        lte(eventosUnicos.fecha, hasta),
      ),
    )
    .groupBy(eventosUnicos.negocioId, eventosUnicos.visitante);

  /* La repartición agrupada por negocio: un array de conteos por visitante. */
  const conteos = new Map<string, number[]>();
  for (const fila of porVisitante) {
    const lista = conteos.get(fila.negocioId);
    if (lista) lista.push(fila.visitas);
    else conteos.set(fila.negocioId, [fila.visitas]);
  }

  const fichas = await db
    .select({
      id: places.id,
      categoria: categories.slug,
      municipio: places.city,
    })
    .from(places)
    .innerJoin(categories, eq(categories.id, places.categoryId))
    .where(eq(places.isActive, true));

  const meta = new Map(fichas.map((f) => [f.id, f]));

  const candidatos: CandidatoRanking[] = [];
  let descartados = 0;
  for (const fila of visitas) {
    const ficha = meta.get(fila.negocioId);
    if (!ficha?.municipio) continue;
    if (pareceFraude(conteos.get(fila.negocioId) ?? [])) {
      descartados += 1;
      continue;
    }
    candidatos.push({
      negocioId: fila.negocioId,
      categoria: ficha.categoria,
      municipio: ficha.municipio,
      visitas: fila.unicos,
    });
  }

  const puestos = topPorGrupo(candidatos);

  // Idempotente: fuera el periodo entero y dentro de nuevo.
  await db.delete(rankingMensual).where(eq(rankingMensual.periodo, periodo));
  if (puestos.length > 0) {
    await db.insert(rankingMensual).values(
      puestos.map((p) => ({
        id: generateId(),
        periodo,
        negocioId: p.negocioId,
        categoria: p.categoria,
        municipio: p.municipio,
        posicion: p.posicion,
        visitas: p.visitas,
      })),
    );
  }

  const ganadores = [...new Set(puestos.map((p) => p.negocioId))];
  if (ganadores.length > 0) {
    await db
      .update(suscripciones)
      .set({ descuentoPct })
      .where(inArray(suscripciones.negocioId, ganadores));
  }

  return {
    periodo,
    puestos: puestos.length,
    ganadores: ganadores.length,
    descartados,
  };
}

/** El periodo más reciente guardado, o `null` si el job no ha corrido nunca. */
export async function ultimoPeriodo(): Promise<string | null> {
  const [fila] = await db
    .select({ periodo: sql<string | null>`max(${rankingMensual.periodo})` })
    .from(rankingMensual);
  return fila?.periodo ?? null;
}

/** Un puesto ya listo para pintar: la fila del ranking con la ficha del negocio. */
export interface PuestoPublico {
  posicion: number;
  visitas: number;
  negocioId: string;
  nombre: string;
  slug: string;
  logoUrl: string | null;
  icon: string | null;
  /** Slug de la categoría. */
  categoria: string;
  categoriaNombre: string;
  municipio: string;
}

/**
 * El ranking de un periodo, con los datos del negocio para poder enlazarlo.
 *
 * El `slug` de la categoría cae al propio `categoria` si la categoría se borró
 * después de calcular el mes: el ranking es histórico y tiene que seguir
 * enseñándose aunque la categoría ya no exista en el catálogo.
 */
export async function leerRanking(periodo: string): Promise<PuestoPublico[]> {
  const filas = await db
    .select({
      posicion: rankingMensual.posicion,
      visitas: rankingMensual.visitas,
      negocioId: rankingMensual.negocioId,
      categoria: rankingMensual.categoria,
      municipio: rankingMensual.municipio,
      nombre: places.name,
      slug: places.slug,
      logoUrl: places.logoUrl,
      icon: places.icon,
      categoriaNombre: categories.name,
    })
    .from(rankingMensual)
    .innerJoin(places, eq(places.id, rankingMensual.negocioId))
    .leftJoin(categories, eq(categories.slug, rankingMensual.categoria))
    .where(eq(rankingMensual.periodo, periodo))
    .orderBy(
      asc(rankingMensual.categoria),
      asc(rankingMensual.municipio),
      asc(rankingMensual.posicion),
    );

  return filas.map((f) => ({
    posicion: f.posicion,
    visitas: f.visitas,
    negocioId: f.negocioId,
    nombre: f.nombre,
    slug: f.slug,
    logoUrl: f.logoUrl,
    icon: f.icon,
    categoria: f.categoria,
    categoriaNombre: f.categoriaNombre ?? f.categoria,
    municipio: f.municipio,
  }));
}
