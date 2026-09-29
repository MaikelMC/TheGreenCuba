import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { isAdminRequest } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { categories, places } from "@/lib/db/schema";
import { placeMetrics } from "@/lib/db/schema";
import { listCategories } from "@/lib/db/queries";

/**
 * Ranking "Negocios top" del dashboard de administración.
 *
 * Una sola consulta: `places LEFT JOIN place_metrics` (un negocio sin tráfico
 * aún no tiene fila de métricas y debe salir con ceros, no fuera del ranking)
 * más dos subconsultas para las etiquetas del admin y de la provincia.
 *
 * Los filtros de provincia y categoría comparan etiquetas y no slugs: la base
 * guarda el texto tal como lo escribió quien dio de alta el negocio
 * («Santiago de Cuba», «Vista Alegre»), y normalizar acentos es lo que evita
 * perder fichas por una errata del dueño. Es la misma política de
 * `placeInUserProvince`, traída aquí al SQL.
 */
export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const province = url.searchParams.get("province")?.trim() ?? "";
  const category = url.searchParams.get("category")?.trim() ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit")) || 10, 50);

  /* La fórmula del ranking, escrita una vez: la usa el `select` como columna
     `score` y el `orderBy` como orden. Un alias en el `select` no se puede
     reutilizar en el `orderBy` de drizzle — Postgres lo permitiría, drizzle
     no emite el alias en ese nivel —, así que la expresión viaja duplicada
     pero idéntica por construcción. */
  const scoreExpr = sql<number>`(coalesce(${placeMetrics.views}, 0) * 3
    + coalesce(${placeMetrics.mapClicks}, 0) * 2
    + coalesce(${placeMetrics.routeRequests}, 0) * 2
    + coalesce(${placeMetrics.aiMatches}, 0) * 2
    + coalesce(${placeMetrics.saves}, 0) * 4
    + coalesce(${placeMetrics.shares}, 0) * 4)::int`;

  const filters = [eq(places.isActive, true)];
  if (province) {
    filters.push(
      sql`(upper(${places.province}) LIKE ${"%" + province.toUpperCase() + "%"} OR upper(${places.city}) LIKE ${"%" + province.toUpperCase() + "%"})`,
    );
  }
  if (category) {
    filters.push(eq(categories.name, category));
  }

  const rows = await db
    .select({
      id: places.id,
      name: places.name,
      category: categories.name,
      province: places.province,
      city: places.city,
      boosted: places.isBoosted,
      plan: places.plan,
      views: sql<number>`coalesce(${placeMetrics.views}, 0)::int`,
      mapClicks: sql<number>`coalesce(${placeMetrics.mapClicks}, 0)::int`,
      routeRequests: sql<number>`coalesce(${placeMetrics.routeRequests}, 0)::int`,
      aiMatches: sql<number>`coalesce(${placeMetrics.aiMatches}, 0)::int`,
      saves: sql<number>`coalesce(${placeMetrics.saves}, 0)::int`,
      shares: sql<number>`coalesce(${placeMetrics.shares}, 0)::int`,
      /* La puntuación del ranking: vistas y rutas son la intención más fuerte
         («quiero ir»), los matches IA dicen que el algoritmo lo empuja. */
      score: scoreExpr,
    })
    .from(places)
    .leftJoin(placeMetrics, eq(placeMetrics.placeId, places.id))
    .leftJoin(categories, eq(categories.id, places.categoryId))
    .where(and(...filters))
    .orderBy(desc(scoreExpr))
    .limit(limit);

  const allCategories = await listCategories();

  /* Las provincias del filtro se calculan sobre **todo** el catálogo activo
     y no sobre las filas ya filtradas: si salieran del ranking filtrado,
     elegir una provincia haría desaparecer al resto de opciones del select. */
  const provinceRows = await db
    .select({ province: places.province, city: places.city })
    .from(places)
    .where(eq(places.isActive, true));
  const provinces = Array.from(
    new Set(
      provinceRows
        .map((row) => (row.province || row.city || "").trim())
        .filter(Boolean),
    ),
  ).sort();

  return NextResponse.json({ places: rows, categories: allCategories, provinces });
}
