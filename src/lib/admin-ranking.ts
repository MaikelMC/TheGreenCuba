import { and, eq, gte, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  categories,
  eventosDiarios,
  places,
} from "@/lib/db/schema";
import { TIPOS_VISTA } from "@/lib/eventos";
import { diaUtc } from "@/lib/eventos-server";
import { listCategories } from "@/lib/db/queries";

/**
 * Ranking de clics a la ficha y al menú de los negocios.
 *
 * Se lee de `eventos_diarios`, la misma tabla que alimenta el panel del dueño:
 * `vista_perfil` es la ficha y `vista_menu` la carta. No se usa
 * `place_metrics.views` porque ese contador no separa menú de ficha y el
 * propietario vería dos cifras distintas para el mismo negocio.
 *
 * Se cuentan **clics**, no visitantes únicos, igual que «Clics a tu negocio» en
 * el panel. `unicos` queda para el ranking público mensual, que responde otra
 * pregunta.
 */

export const PERIODOS_RANKING = [7, 30, 90] as const;
export type PeriodoRanking = (typeof PERIODOS_RANKING)[number];

export const METRICAS_RANKING = ["total", "ficha", "menu"] as const;
export type MetricaRanking = (typeof METRICAS_RANKING)[number];

export interface RankingFila {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  categoryIcon: string | null;
  province: string | null;
  city: string | null;
  ficha: number;
  menu: number;
  total: number;
  fichaAnterior: number;
  menuAnterior: number;
  totalAnterior: number;
  cambioPct: number | null;
  posicion: number;
  posicionAnterior: number | null;
  cambioPosicion: number | null;
}

export interface RankingResumen {
  ficha: number;
  menu: number;
  total: number;
  totalAnterior: number;
  cambioPct: number | null;
  negocios: number;
  negociosConClics: number;
  suben: number;
  bajan: number;
}

export interface RankingDatos {
  filas: RankingFila[];
  resumen: RankingResumen;
  categorias: { value: string; label: string; icon: string | null }[];
  provincias: string[];
  desde: string;
  hasta: string;
}

export interface OpcionesRanking {
  dias: PeriodoRanking;
  metrica: MetricaRanking;
  provincia?: string;
  categoria?: string;
  q?: string;
}

function porcentajeCambio(actual: number, anterior: number): number | null {
  if (anterior <= 0) return actual > 0 ? null : 0;
  return Math.round(((actual - anterior) / anterior) * 1000) / 10;
}

function valorDe(fila: RankingFila, metrica: MetricaRanking): number {
  if (metrica === "ficha") return fila.ficha;
  if (metrica === "menu") return fila.menu;
  return fila.total;
}

function valorAnteriorDe(fila: RankingFila, metrica: MetricaRanking): number {
  if (metrica === "ficha") return fila.fichaAnterior;
  if (metrica === "menu") return fila.menuAnterior;
  return fila.totalAnterior;
}

/**
 * Carga el ranking y sus comparativas.
 *
 * `dias` se interpreta como una ventana cerrada de hoy hacia atrás: 7 incluye
 * hoy y los seis días anteriores. El periodo anterior tiene exactamente la
 * misma longitud y termina justo antes de esa ventana.
 *
 * La consulta trae solo los negocios con actividad en cualquiera de las dos
 * ventanas; los que no tienen ningún clic no ensucian el ranking con ceros.
 * Después se cruzan con el catálogo activo y se aplican los filtros, para que
 * un evento histórico de una ficha cerrada no aparezca como si siguiera viva.
 */
export async function cargarRankingAdmin({
  dias,
  metrica,
  provincia = "",
  categoria = "",
  q = "",
}: OpcionesRanking): Promise<RankingDatos> {
  const desdeActual = diaUtc(dias - 1);
  const desdeAnterior = diaUtc(dias * 2 - 1);
  const hasta = diaUtc(0);

  const filasMetricas = await db
    .select({
      negocioId: eventosDiarios.negocioId,
      ficha: sql<number>`coalesce(sum(${eventosDiarios.conteo}) filter (where ${eventosDiarios.tipo} = 'vista_perfil' and ${eventosDiarios.fecha} >= ${desdeActual}), 0)::int`,
      menu: sql<number>`coalesce(sum(${eventosDiarios.conteo}) filter (where ${eventosDiarios.tipo} = 'vista_menu' and ${eventosDiarios.fecha} >= ${desdeActual}), 0)::int`,
      fichaAnterior: sql<number>`coalesce(sum(${eventosDiarios.conteo}) filter (where ${eventosDiarios.tipo} = 'vista_perfil' and ${eventosDiarios.fecha} >= ${desdeAnterior} and ${eventosDiarios.fecha} < ${desdeActual}), 0)::int`,
      menuAnterior: sql<number>`coalesce(sum(${eventosDiarios.conteo}) filter (where ${eventosDiarios.tipo} = 'vista_menu' and ${eventosDiarios.fecha} >= ${desdeAnterior} and ${eventosDiarios.fecha} < ${desdeActual}), 0)::int`,
    })
    .from(eventosDiarios)
    .where(
      and(
        inArray(eventosDiarios.tipo, TIPOS_VISTA),
        gte(eventosDiarios.fecha, desdeAnterior),
        lt(eventosDiarios.fecha, diaUtc(-1)),
      ),
    )
    .groupBy(eventosDiarios.negocioId);

  const ids = filasMetricas.map((fila) => fila.negocioId);
  if (ids.length === 0) {
    const [categorias, provincias] = await Promise.all([
      listCategories(),
      provinciasActivas(),
    ]);
    return {
      filas: [],
      resumen: {
        ficha: 0,
        menu: 0,
        total: 0,
        totalAnterior: 0,
        cambioPct: 0,
        negocios: 0,
        negociosConClics: 0,
        suben: 0,
        bajan: 0,
      },
      categorias: categorias.map(({ value, label, icon }) => ({
        value,
        label,
        icon: icon ?? null,
      })),
      provincias,
      desde: desdeActual,
      hasta,
    };
  }

  const filtros = [eq(places.isActive, true), inArray(places.id, ids)];
  if (provincia) {
    const patron = `%${provincia.toUpperCase()}%`;
    filtros.push(
      sql`(upper(${places.province}) LIKE ${patron} OR upper(${places.city}) LIKE ${patron})`,
    );
  }
  if (categoria) filtros.push(eq(categories.name, categoria));
  if (q.trim()) {
    const patron = `%${q.trim()}%`;
    filtros.push(
      or(
        ilike(places.name, patron),
        ilike(places.city, patron),
        ilike(places.province, patron),
      )!,
    );
  }

  const [filasCatalogo, categorias, provincias] = await Promise.all([
    db
      .select({
        id: places.id,
        name: places.name,
        slug: places.slug,
        province: places.province,
        city: places.city,
        category: categories.name,
        categoryIcon: categories.icon,
      })
      .from(places)
      .leftJoin(categories, eq(categories.id, places.categoryId))
      .where(and(...filtros)),
    listCategories(),
    provinciasActivas(),
  ]);

  const catalogo = new Map(filasCatalogo.map((fila) => [fila.id, fila]));
  const filas: RankingFila[] = [];

  for (const metricaFila of filasMetricas) {
    const negocio = catalogo.get(metricaFila.negocioId);
    if (!negocio) continue;
    const total = metricaFila.ficha + metricaFila.menu;
    const totalAnterior = metricaFila.fichaAnterior + metricaFila.menuAnterior;
    if (total === 0 && totalAnterior === 0) continue;
    const fila: RankingFila = {
      id: negocio.id,
      name: negocio.name,
      slug: negocio.slug,
      category: negocio.category,
      categoryIcon: negocio.categoryIcon ?? null,
      province: negocio.province,
      city: negocio.city,
      ficha: metricaFila.ficha,
      menu: metricaFila.menu,
      total,
      fichaAnterior: metricaFila.fichaAnterior,
      menuAnterior: metricaFila.menuAnterior,
      totalAnterior,
      cambioPct: null,
      posicion: 0,
      posicionAnterior: null,
      cambioPosicion: null,
    };
    fila.cambioPct = porcentajeCambio(
      valorDe(fila, metrica),
      valorAnteriorDe(fila, metrica),
    );
    filas.push(fila);
  }

  /* Se conservan también los negocios que este periodo quedaron a cero pero
     tuvieron clics en el anterior: son justo los que explican una caída. */
  const visibles = filas;
  visibles.sort((a, b) => {
    const diferencia = valorDe(b, metrica) - valorDe(a, metrica);
    return diferencia || a.name.localeCompare(b.name, "es");
  });
  visibles.forEach((fila, indice) => {
    fila.posicion = indice + 1;
  });

  const anteriores = [...visibles]
    .filter((fila) => valorAnteriorDe(fila, metrica) > 0)
    .sort((a, b) => {
      const diferencia =
        valorAnteriorDe(b, metrica) - valorAnteriorDe(a, metrica);
      return diferencia || a.name.localeCompare(b.name, "es");
    });
  const posicionesAnteriores = new Map(
    anteriores.map((fila, indice) => [fila.id, indice + 1]),
  );
  for (const fila of visibles) {
    const anterior = posicionesAnteriores.get(fila.id) ?? null;
    fila.posicionAnterior = anterior;
    fila.cambioPosicion = anterior === null ? null : anterior - fila.posicion;
  }

  const total = visibles.reduce((suma, fila) => suma + fila.total, 0);
  const totalAnterior = visibles.reduce(
    (suma, fila) => suma + fila.totalAnterior,
    0,
  );

  return {
    filas: visibles,
    resumen: {
      ficha: visibles.reduce((suma, fila) => suma + fila.ficha, 0),
      menu: visibles.reduce((suma, fila) => suma + fila.menu, 0),
      total,
      totalAnterior,
      cambioPct: porcentajeCambio(total, totalAnterior),
      negocios: visibles.length,
      negociosConClics: visibles.filter((fila) => fila.total > 0).length,
      suben: visibles.filter(
        (fila) => fila.cambioPct !== null && fila.cambioPct > 0,
      ).length,
      bajan: visibles.filter(
        (fila) => fila.cambioPct !== null && fila.cambioPct < 0,
      ).length,
    },
    categorias: categorias.map(({ value, label, icon }) => ({
      value,
      label,
      icon: icon ?? null,
    })),
    provincias,
    desde: desdeActual,
    hasta,
  };
}

async function provinciasActivas(): Promise<string[]> {
  const filas = await db
    .select({ province: places.province, city: places.city })
    .from(places)
    .where(eq(places.isActive, true));

  return Array.from(
    new Set(
      filas
        .map((fila) => (fila.province || fila.city || "").trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, "es"));
}
