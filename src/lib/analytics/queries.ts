import { sql, type SQL } from "drizzle-orm";
import { rows as fetchRows } from "@/lib/analytics/sql";
import { type DemandScore, scoreDemand } from "@/lib/analytics/demand";
import { isoDay } from "@/lib/analytics/period";

/**
 * Las consultas del dashboard.
 *
 * Regla de reparto: lo que es **volumen aditivo** —búsquedas, vistas, acciones—
 * se lee de `analytics_daily` cuando el periodo es histórico, y lo que necesita
 * **usuarios únicos o detalle** —DAU, retención, consultas frecuentes— de
 * `analytics_events`, siempre con filtro temporal y `LIMIT` (`§44`: el dashboard
 * no recorre el histórico entero en cada carga).
 *
 * Los filtros se aplican en SQL, nunca en el navegador (`§32`).
 */

/** Eventos que cuentan como «el usuario hizo algo». Base de DAU y retención. */
const ACTIVITY_EVENTS = sql`(
  'search_performed', 'business_viewed', 'business_impression',
  'business_contact_clicked', 'business_whatsapp_clicked',
  'business_phone_clicked', 'business_map_clicked',
  'business_website_clicked', 'business_social_clicked', 'place_saved'
)`;

export interface AnalyticsFilters {
  from: string;
  to: string;
  province?: string;
  category?: string;
  businessId?: string;
  source?: string;
  medium?: string;
  campaign?: string;
}

/**
 * Filtros sobre eventos, como fragmento `AND (…)` reutilizable.
 *
 * La categoría se filtra por `metadata->>'category'`, no por `category_id`:
 * ninguna llamada a `trackEvent()` escribe `categoryId`, así que esa columna
 * está siempre a NULL y filtrar por ella vaciaba el panel entero en silencio.
 * Lo que sí se guarda —y lo que el panel ya enseña en «Por categoría»— es el
 * nombre en `metadata->>'category'`. El filtro compara contra lo mismo que se
 * pinta; si algún día se empieza a escribir `categoryId`, esto vuelve a cambiar
 * con él.
 */
function eventFilter(f: AnalyticsFilters): SQL {
  const parts: SQL[] = [];
  if (f.province) parts.push(sql`province = ${f.province}`);
  if (f.category)
    parts.push(sql`COALESCE(metadata->>'category', '') = ${f.category}`);
  if (f.businessId) parts.push(sql`business_id = ${f.businessId}`);
  if (f.source) parts.push(sql`source = ${f.source}`);
  if (f.medium) parts.push(sql`medium = ${f.medium}`);
  if (f.campaign) parts.push(sql`campaign = ${f.campaign}`);
  if (parts.length === 0) return sql``;
  return sql` AND ${sql.join(parts, sql` AND `)}`;
}

/** Rango temporal sobre `created_at`. Se usa en cada consulta de eventos. */
function period(f: AnalyticsFilters): SQL {
  return sql`created_at >= ${f.from}::date AND created_at < (${f.to}::date + interval '1 day')`;
}

/* ── Resumen ─────────────────────────────────────────────────────────── */

export interface Summary {
  users: {
    total: number;
    new: number;
    dau: number;
    wau: number;
    mau: number;
    recurring: number;
  };
  searches: {
    total: number;
    successful: number;
    noResults: number;
    successRate: number;
    perUser: number;
  };
  businesses: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    active: number;
    inactive: number;
  };
  discovery: {
    views: number;
    impressions: number;
    actions: number;
    searchToBusiness: number;
  };
}

export async function getSummary(f: AnalyticsFilters): Promise<Summary> {
  const [events] = await fetchRows<{
    new_users: number;
    recurring: number;
    searches: number;
    successful: number;
    no_results: number;
    views: number;
    impressions: number;
    actions: number;
  }>(sql`
    SELECT
      COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'user_registered')::int AS new_users,
      (
        SELECT COUNT(*)::int FROM (
          SELECT user_id FROM analytics_events
          WHERE user_id IS NOT NULL AND event_type IN ${ACTIVITY_EVENTS}
            AND ${period(f)}${eventFilter(f)}
          GROUP BY user_id HAVING COUNT(DISTINCT date_trunc('day', created_at)) > 1
        ) r
      ) AS recurring,
      COUNT(*) FILTER (WHERE event_type = 'search_performed')::int AS searches,
      COUNT(*) FILTER (WHERE event_type = 'search_results_shown')::int AS successful,
      COUNT(*) FILTER (WHERE event_type = 'search_no_results')::int AS no_results,
      COUNT(*) FILTER (WHERE event_type = 'business_viewed')::int AS views,
      COUNT(*) FILTER (WHERE event_type = 'business_impression')::int AS impressions,
      COUNT(*) FILTER (WHERE event_type IN (
        'business_contact_clicked', 'business_whatsapp_clicked',
        'business_phone_clicked', 'business_map_clicked',
        'business_website_clicked', 'business_social_clicked'
      ))::int AS actions
    FROM analytics_events
    WHERE ${period(f)}${eventFilter(f)}
  `);

  /* DAU/WAU/MAU se miden sobre ventanas que terminan en `to`, no sobre el
     periodo elegido: son «ahora mismo», no «en el rango». Un solo query. */
  const [actives] = await fetchRows<{
    dau: number;
    wau: number;
    mau: number;
  }>(sql`
    SELECT
      COUNT(DISTINCT user_id) FILTER (WHERE created_at >= ${f.to}::date)::int AS dau,
      COUNT(DISTINCT user_id) FILTER (WHERE created_at >= (${f.to}::date - interval '6 day'))::int AS wau,
      COUNT(DISTINCT user_id) FILTER (WHERE created_at >= (${f.to}::date - interval '29 day'))::int AS mau
    FROM analytics_events
    WHERE created_at >= (${f.to}::date - interval '29 day')
      AND created_at < (${f.to}::date + interval '1 day')
      AND user_id IS NOT NULL
      AND event_type IN ${ACTIVITY_EVENTS}${eventFilter(f)}
  `);

  const [users] = await fetchRows<{ total: number }>(sql`
    SELECT COUNT(*)::int AS total FROM users
  `);

  const [businesses] = await fetchRows<{
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    active: number;
    inactive: number;
  }>(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE review_status = 'approved')::int AS approved,
      COUNT(*) FILTER (WHERE review_status = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE review_status = 'rejected')::int AS rejected,
      COUNT(*) FILTER (WHERE is_active AND status = 'active')::int AS active,
      COUNT(*) FILTER (WHERE NOT is_active OR status <> 'active')::int AS inactive
    FROM places
  `);

  const searches = events?.searches ?? 0;
  const successful = events?.successful ?? 0;
  const views = events?.views ?? 0;
  const newUsers = users ? Number(events?.new_users ?? 0) : 0;

  return {
    users: {
      total: Number(users?.total ?? 0),
      new: newUsers,
      dau: Number(actives?.dau ?? 0),
      wau: Number(actives?.wau ?? 0),
      mau: Number(actives?.mau ?? 0),
      recurring: Number(events?.recurring ?? 0),
    },
    searches: {
      total: searches,
      successful,
      noResults: Number(events?.no_results ?? 0),
      successRate:
        searches > 0 ? Number(((successful / searches) * 100).toFixed(1)) : 0,
      perUser: newUsers > 0 ? Number((searches / newUsers).toFixed(1)) : 0,
    },
    businesses: {
      total: Number(businesses?.total ?? 0),
      approved: Number(businesses?.approved ?? 0),
      pending: Number(businesses?.pending ?? 0),
      rejected: Number(businesses?.rejected ?? 0),
      active: Number(businesses?.active ?? 0),
      inactive: Number(businesses?.inactive ?? 0),
    },
    discovery: {
      views,
      impressions: Number(events?.impressions ?? 0),
      actions: Number(events?.actions ?? 0),
      searchToBusiness:
        searches > 0 ? Number(((views / searches) * 100).toFixed(1)) : 0,
    },
  };
}

/* ── Usuarios ────────────────────────────────────────────────────────── */

export interface SeriesPoint {
  day: string;
  a: number;
  b: number;
}

/** Nuevos vs activos por día. Puntos agregados, nunca eventos sueltos (`§16`). */
export async function getUserSeries(
  f: AnalyticsFilters,
): Promise<SeriesPoint[]> {
  const rows = await fetchRows<{
    day: string;
    new_users: number;
    active_users: number;
  }>(sql`
    SELECT
      to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
      COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'user_registered')::int AS new_users,
      COUNT(DISTINCT user_id) FILTER (WHERE event_type IN ${ACTIVITY_EVENTS})::int AS active_users
    FROM analytics_events
    WHERE ${period(f)}${eventFilter(f)}
    GROUP BY 1
    ORDER BY 1
  `);

  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: SeriesPoint[] = [];
  for (
    let cursor = new Date(`${f.from}T00:00:00.000Z`);
    ;
    cursor = new Date(cursor.getTime() + 86_400_000)
  ) {
    const day = isoDay(cursor);
    const row = byDay.get(day);
    out.push({
      day,
      a: Number(row?.new_users ?? 0),
      b: Number(row?.active_users ?? 0),
    });
    if (day >= f.to) break;
  }
  return out;
}

/* ── Retención ───────────────────────────────────────────────────────── */

export interface Retention {
  cohortSize: number;
  d1: number;
  d7: number;
  d14: number;
  d30: number;
}

/**
 * Retención por cohorte de **primera actividad**, no de «primer login».
 *
 * Definición documentada (`§17`): la cohorte de un usuario es el día de su
 * primer evento de actividad dentro del periodo; está retenido a D*n* si vuelve
 * a tener actividad en `cohorte + n` días. Login no cuenta como actividad: la
 * métrica útil es «¿volvió a buscar o a abrir un negocio?».
 */
export async function getRetention(f: AnalyticsFilters): Promise<Retention> {
  const [row] = await fetchRows<{
    cohort_size: number;
    d1: number;
    d7: number;
    d14: number;
    d30: number;
  }>(sql`
    WITH firsts AS (
      SELECT user_id, MIN(date_trunc('day', created_at))::date AS cohort
      FROM analytics_events
      WHERE user_id IS NOT NULL AND event_type IN ${ACTIVITY_EVENTS}
        AND ${period(f)}${eventFilter(f)}
      GROUP BY user_id
    ),
    days AS (
      SELECT DISTINCT user_id, date_trunc('day', created_at)::date AS day
      FROM analytics_events
      WHERE user_id IS NOT NULL AND event_type IN ${ACTIVITY_EVENTS}
        AND ${period(f)}${eventFilter(f)}
    )
    SELECT
      COUNT(*)::int AS cohort_size,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM days d WHERE d.user_id = f.user_id AND d.day = f.cohort + 1
      ))::int AS d1,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM days d WHERE d.user_id = f.user_id AND d.day = f.cohort + 7
      ))::int AS d7,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM days d WHERE d.user_id = f.user_id AND d.day = f.cohort + 14
      ))::int AS d14,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM days d WHERE d.user_id = f.user_id AND d.day = f.cohort + 30
      ))::int AS d30
    FROM firsts f
  `);

  const size = Number(row?.cohort_size ?? 0);
  const pct = (value: unknown) =>
    size > 0 ? Number(((Number(value) / size) * 100).toFixed(1)) : 0;
  return {
    cohortSize: size,
    d1: pct(row?.d1),
    d7: pct(row?.d7),
    d14: pct(row?.d14),
    d30: pct(row?.d30),
  };
}

/* ── Búsquedas ───────────────────────────────────────────────────────── */

export interface SearchRow {
  label: string;
  searches: number;
  successful: number;
  noResults: number;
}

export interface QueryRow {
  query: string;
  searches: number;
  users: number;
  avgResults: number;
  noResultRate: number;
}

export interface Searches {
  perDay: SeriesPoint[];
  perHour: { hour: number; count: number }[];
  perCategory: SearchRow[];
  perProvince: SearchRow[];
  topQueries: QueryRow[];
}

export async function getSearches(f: AnalyticsFilters): Promise<Searches> {
  /* Una sola pasada: agrupa por varias dimensiones con `GROUPING SETS` en vez
     de lanzar cuatro consultas seguidas (`§44`). */
  const grouped = await fetchRows<{
    kind: string;
    label: string;
    searches: number;
    successful: number;
    no_results: number;
  }>(sql`
    SELECT kind, label, SUM(searches)::int AS searches,
           SUM(successful)::int AS successful, SUM(no_results)::int AS no_results
    FROM (
      SELECT 'day' AS kind, to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS label,
        COUNT(*) FILTER (WHERE event_type = 'search_performed') AS searches,
        COUNT(*) FILTER (WHERE event_type = 'search_results_shown') AS successful,
        COUNT(*) FILTER (WHERE event_type = 'search_no_results') AS no_results
      FROM analytics_events WHERE ${period(f)}${eventFilter(f)} GROUP BY 1, 2
      UNION ALL
      SELECT 'hour', EXTRACT(HOUR FROM created_at)::text,
        COUNT(*) FILTER (WHERE event_type = 'search_performed'),
        COUNT(*) FILTER (WHERE event_type = 'search_results_shown'),
        COUNT(*) FILTER (WHERE event_type = 'search_no_results')
      FROM analytics_events WHERE ${period(f)}${eventFilter(f)} GROUP BY 1, 2
      UNION ALL
      SELECT 'category', COALESCE(metadata->>'category', '—'),
        COUNT(*) FILTER (WHERE event_type = 'search_performed'),
        COUNT(*) FILTER (WHERE event_type = 'search_results_shown'),
        COUNT(*) FILTER (WHERE event_type = 'search_no_results')
      FROM analytics_events WHERE ${period(f)}${eventFilter(f)} GROUP BY 1, 2
      UNION ALL
      SELECT 'province', COALESCE(NULLIF(province, ''), '—'),
        COUNT(*) FILTER (WHERE event_type = 'search_performed'),
        COUNT(*) FILTER (WHERE event_type = 'search_results_shown'),
        COUNT(*) FILTER (WHERE event_type = 'search_no_results')
      FROM analytics_events WHERE ${period(f)}${eventFilter(f)} GROUP BY 1, 2
    ) t
    GROUP BY 1, 2
  `);

  const toRow = (r: (typeof grouped)[number]): SearchRow => ({
    label: r.label,
    searches: Number(r.searches),
    successful: Number(r.successful),
    noResults: Number(r.no_results),
  });

  const byDay = new Map(
    grouped.filter((r) => r.kind === "day").map((r) => [r.label, r]),
  );
  const perDay: SeriesPoint[] = [];
  for (
    let cursor = new Date(`${f.from}T00:00:00.000Z`);
    ;
    cursor = new Date(cursor.getTime() + 86_400_000)
  ) {
    const day = isoDay(cursor);
    const row = byDay.get(day);
    perDay.push({
      day,
      a: Number(row?.searches ?? 0),
      b: Number(row?.successful ?? 0),
    });
    if (day >= f.to) break;
  }

  const hourly = new Map(
    grouped
      .filter((r) => r.kind === "hour")
      .map((r) => [Number(r.label), Number(r.searches)]),
  );
  const perHour = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: hourly.get(hour) ?? 0,
  }));

  /* Solo consultas con al menos una búsqueda: la tabla está paginada y
     ordenada, nunca se devuelve todo (`§18`, `§34`). */
  const topQueries = await fetchRows<{
    query: string;
    searches: number;
    users: number;
    avg_results: number;
    no_result_rate: number;
  }>(sql`
    SELECT
      search_query AS query,
      COUNT(*) FILTER (WHERE event_type = 'search_performed')::int AS searches,
      COUNT(DISTINCT user_id)::int AS users,
      COALESCE(AVG(result_count) FILTER (WHERE event_type = 'search_results_shown'), 0)::float AS avg_results,
      (COUNT(*) FILTER (WHERE event_type = 'search_no_results')::float
        / NULLIF(COUNT(*) FILTER (WHERE event_type IN ('search_results_shown', 'search_no_results')), 0) * 100) AS no_result_rate
    FROM analytics_events
    WHERE ${period(f)} AND search_query IS NOT NULL${eventFilter(f)}
    GROUP BY search_query
    ORDER BY searches DESC
    LIMIT 50
  `);

  return {
    perDay,
    perHour,
    perCategory: grouped
      .filter((r) => r.kind === "category")
      .map(toRow)
      .sort((a, b) => b.searches - a.searches),
    perProvince: grouped
      .filter((r) => r.kind === "province")
      .map(toRow)
      .sort((a, b) => b.searches - a.searches),
    topQueries: topQueries.map((r) => ({
      query: r.query,
      searches: Number(r.searches),
      users: Number(r.users),
      avgResults: Number(Number(r.avg_results).toFixed(1)),
      noResultRate: Number(Number(r.no_result_rate ?? 0).toFixed(1)),
    })),
  };
}

/* ── Búsquedas sin resultados ────────────────────────────────────────── */

export interface NoResultRow {
  query: string;
  frequency: number;
  users: number;
  province: string;
  category: string;
}

/** «Demandas sin oferta» (`§19`): lo que se busca y no existe. */
export async function getNoResults(
  f: AnalyticsFilters,
): Promise<NoResultRow[]> {
  const rows = await fetchRows<{
    query: string;
    frequency: number;
    users: number;
    province: string;
    category: string;
  }>(sql`
    SELECT
      search_query AS query,
      COUNT(*)::int AS frequency,
      COUNT(DISTINCT user_id)::int AS users,
      COALESCE(NULLIF(MAX(province), ''), '—') AS province,
      COALESCE(NULLIF(MAX(metadata->>'category'), ''), '—') AS category
    FROM analytics_events
    WHERE event_type = 'search_no_results' AND search_query IS NOT NULL
      AND ${period(f)}${eventFilter(f)}
    GROUP BY search_query
    ORDER BY frequency DESC
    LIMIT 50
  `);
  return rows.map((r) => ({
    query: r.query,
    frequency: Number(r.frequency),
    users: Number(r.users),
    province: r.province,
    category: r.category,
  }));
}

/* ── Demanda vs oferta ───────────────────────────────────────────────── */

export interface DemandRow extends DemandScore {
  label: string;
}

export async function getDemandByCategory(
  f: AnalyticsFilters,
): Promise<DemandRow[]> {
  const [demand, offer] = await Promise.all([
    fetchRows<{ label: string; demand: number }>(sql`
      SELECT COALESCE(NULLIF(metadata->>'category', ''), '—') AS label, COUNT(*)::int AS demand
      FROM analytics_events
      WHERE event_type = 'search_performed' AND ${period(f)}${eventFilter(f)}
      GROUP BY 1
    `),
    fetchRows<{ label: string; offer: number }>(sql`
      SELECT c.name AS label, COUNT(p.id)::int AS offer
      FROM categories c
      LEFT JOIN places p ON p.category_id = c.id
        AND p.review_status = 'approved' AND p.is_active AND p.status = 'active'
      GROUP BY c.name
    `),
  ]);

  const offerByLabel = new Map(offer.map((r) => [r.label, Number(r.offer)]));
  const demandByLabel = new Map(demand.map((r) => [r.label, Number(r.demand)]));

  return [...new Set([...demandByLabel.keys(), ...offerByLabel.keys()])]
    .map((label) => ({
      ...scoreDemand(
        demandByLabel.get(label) ?? 0,
        offerByLabel.get(label) ?? 0,
      ),
      label,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);
}

export async function getDemandByProvince(
  f: AnalyticsFilters,
): Promise<DemandRow[]> {
  const [demand, offer] = await Promise.all([
    fetchRows<{ label: string; demand: number }>(sql`
      SELECT province AS label, COUNT(*)::int AS demand
      FROM analytics_events
      WHERE event_type = 'search_performed' AND province IS NOT NULL
        AND ${period(f)}${eventFilter(f)}
      GROUP BY 1
    `),
    fetchRows<{ label: string; offer: number }>(sql`
      SELECT province AS label, COUNT(*)::int AS offer
      FROM places
      WHERE review_status = 'approved' AND is_active AND status = 'active' AND province <> ''
      GROUP BY 1
    `),
  ]);

  const offerByLabel = new Map(offer.map((r) => [r.label, Number(r.offer)]));
  const demandByLabel = new Map(demand.map((r) => [r.label, Number(r.demand)]));
  return [...new Set([...demandByLabel.keys(), ...offerByLabel.keys()])]
    .map((label) => ({
      ...scoreDemand(
        demandByLabel.get(label) ?? 0,
        offerByLabel.get(label) ?? 0,
      ),
      label,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);
}

/* ── Negocios ────────────────────────────────────────────────────────── */

export interface Businesses {
  evolution: SeriesPoint[];
  byCategory: { label: string; count: number }[];
  byProvince: { label: string; count: number }[];
  byStatus: { label: string; count: number }[];
}

export async function getBusinesses(f: AnalyticsFilters): Promise<Businesses> {
  const [evolution, byCategory, byProvince] = await Promise.all([
    fetchRows<{ day: string; created: number; approved: number }>(sql`
      SELECT
        to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
        COUNT(*) FILTER (WHERE event_type = 'business_registration_completed')::int AS created,
        COUNT(*) FILTER (WHERE event_type = 'business_approved')::int AS approved
      FROM analytics_events
      WHERE ${period(f)}${eventFilter(f)}
      GROUP BY 1 ORDER BY 1
    `),
    fetchRows<{ label: string; count: number }>(sql`
      SELECT c.name AS label, COUNT(p.id)::int AS count
      FROM categories c
      LEFT JOIN places p ON p.category_id = c.id
      GROUP BY c.name
      ORDER BY count DESC
    `),
    fetchRows<{ label: string; count: number }>(sql`
      SELECT province AS label, COUNT(*)::int AS count
      FROM places WHERE province <> ''
      GROUP BY 1 ORDER BY count DESC
    `),
  ]);

  const byDay = new Map(evolution.map((r) => [r.day, r]));
  const series: SeriesPoint[] = [];
  for (
    let cursor = new Date(`${f.from}T00:00:00.000Z`);
    ;
    cursor = new Date(cursor.getTime() + 86_400_000)
  ) {
    const day = isoDay(cursor);
    const row = byDay.get(day);
    series.push({
      day,
      a: Number(row?.created ?? 0),
      b: Number(row?.approved ?? 0),
    });
    if (day >= f.to) break;
  }

  const [statusRow] = await fetchRows<{
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    active: number;
    inactive: number;
  }>(sql`
    SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE review_status = 'approved')::int AS approved,
      COUNT(*) FILTER (WHERE review_status = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE review_status = 'rejected')::int AS rejected,
      COUNT(*) FILTER (WHERE is_active)::int AS active,
      COUNT(*) FILTER (WHERE NOT is_active)::int AS inactive
    FROM places
  `);

  return {
    evolution: series,
    byCategory: byCategory.map((r) => ({
      label: r.label,
      count: Number(r.count),
    })),
    byProvince: byProvince.map((r) => ({
      label: r.label,
      count: Number(r.count),
    })),
    byStatus: [
      { label: "Aprobados", count: Number(statusRow?.approved ?? 0) },
      { label: "Pendientes", count: Number(statusRow?.pending ?? 0) },
      { label: "Rechazados", count: Number(statusRow?.rejected ?? 0) },
      { label: "Activos", count: Number(statusRow?.active ?? 0) },
      { label: "Inactivos", count: Number(statusRow?.inactive ?? 0) },
    ],
  };
}

/* ── Analítica individual de negocio ────────────────────────────────── */

/** Etiqueta legible de cada clic de contacto, para el desglose por canal. */
const ACTION_LABELS: Record<string, string> = {
  business_contact_clicked: "Contacto",
  business_whatsapp_clicked: "WhatsApp",
  business_phone_clicked: "Teléfono",
  business_map_clicked: "Cómo llegar",
  business_website_clicked: "Sitio web",
  business_social_clicked: "Redes sociales",
};

export interface BusinessDetail {
  views: number;
  impressions: number;
  actions: number;
  /** Impresiones: veces que una búsqueda lo eligió. */
  searchesFound: number;
  contacts: { label: string; count: number }[];
  series: SeriesPoint[];
}

/**
 * Lo que un negocio concreto puede ver de sí mismo (`§23`).
 *
 * Consultas acotadas por `business_id` y periodo, y por el índice
 * `(business_id, created_at)`: nunca recorre los eventos históricos del negocio
 * para pintar cuatro cifras.
 */
export async function getBusinessDetail(
  f: AnalyticsFilters,
): Promise<BusinessDetail> {
  if (!f.businessId) {
    return {
      views: 0,
      impressions: 0,
      actions: 0,
      searchesFound: 0,
      contacts: [],
      series: [],
    };
  }

  const [totals, breakdown, perDay] = await Promise.all([
    fetchRows<{
      views: number;
      impressions: number;
      actions: number;
    }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'business_viewed')::int AS views,
        COUNT(*) FILTER (WHERE event_type = 'business_impression')::int AS impressions,
        COUNT(*) FILTER (WHERE event_type IN (
          'business_contact_clicked', 'business_whatsapp_clicked',
          'business_phone_clicked', 'business_map_clicked',
          'business_website_clicked', 'business_social_clicked'
        ))::int AS actions
      FROM analytics_events
      WHERE business_id = ${f.businessId} AND ${period(f)}
    `),
    fetchRows<{ event_type: string; count: number }>(sql`
      SELECT event_type, COUNT(*)::int AS count
      FROM analytics_events
      WHERE business_id = ${f.businessId}
        AND event_type IN (
          'business_contact_clicked', 'business_whatsapp_clicked',
          'business_phone_clicked', 'business_map_clicked',
          'business_website_clicked', 'business_social_clicked'
        )
        AND ${period(f)}
      GROUP BY 1 ORDER BY 2 DESC
    `),
    fetchRows<{ day: string; views: number; impressions: number }>(sql`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
        COUNT(*) FILTER (WHERE event_type = 'business_viewed')::int AS views,
        COUNT(*) FILTER (WHERE event_type = 'business_impression')::int AS impressions
      FROM analytics_events
      WHERE business_id = ${f.businessId}
        AND event_type IN ('business_viewed', 'business_impression')
        AND ${period(f)}
      GROUP BY 1 ORDER BY 1
    `),
  ]);

  const byDay = new Map(perDay.map((r) => [r.day, r]));
  const series: SeriesPoint[] = [];
  for (
    let cursor = new Date(`${f.from}T00:00:00.000Z`);
    ;
    cursor = new Date(cursor.getTime() + 86_400_000)
  ) {
    const day = isoDay(cursor);
    const row = byDay.get(day);
    series.push({
      day,
      a: Number(row?.views ?? 0),
      b: Number(row?.impressions ?? 0),
    });
    if (day >= f.to) break;
  }

  const total = totals[0];
  return {
    views: Number(total?.views ?? 0),
    impressions: Number(total?.impressions ?? 0),
    actions: Number(total?.actions ?? 0),
    searchesFound: Number(total?.impressions ?? 0),
    contacts: breakdown.map((r) => ({
      label: ACTION_LABELS[r.event_type] ?? r.event_type,
      count: Number(r.count),
    })),
    series,
  };
}

/* ── Calidad de fichas ───────────────────────────────────────────────── */

export interface Quality {
  average: number;
  total: number;
  complete: number;
  incomplete: number;
  critical: number;
  worst: { id: string; name: string; score: number }[];
}

/**
 * Completitud 0-100 de cada ficha (`§22`).
 *
 * Pesos, y suman 100: nombre 10, descripción 15, ubicación (ciudad+provincia)
 * 10, coordenadas 10, teléfono 10, WhatsApp 5, horarios 10, fotos 10, medios de
 * pago 5, redes o web 5, carta 10. Los que no aplican a todos —carta, redes— no
 * son obligatorios; su peso solo premia que estén.
 */
export async function getQuality(): Promise<Quality> {
  const rows = await fetchRows<{
    id: string;
    name: string;
    score: number;
  }>(sql`
    SELECT id, name,
      (
        CASE WHEN name <> '' THEN 10 ELSE 0 END
        + CASE WHEN description IS NOT NULL AND description <> '' THEN 15 ELSE 0 END
        + CASE WHEN city <> '' AND province <> '' THEN 10 ELSE 0 END
        + CASE WHEN lat IS NOT NULL AND lng IS NOT NULL THEN 10 ELSE 0 END
        + CASE WHEN phone IS NOT NULL AND phone <> '' THEN 10 ELSE 0 END
        + CASE WHEN whatsapp IS NOT NULL AND whatsapp <> '' THEN 5 ELSE 0 END
        + CASE WHEN hours_json IS NOT NULL THEN 10 ELSE 0 END
        + CASE WHEN COALESCE(array_length(image_urls, 1), 0) > 0 THEN 10 ELSE 0 END
        + CASE WHEN COALESCE(array_length(payment_methods, 1), 0) > 0 THEN 5 ELSE 0 END
        + CASE WHEN COALESCE(website, instagram, facebook) IS NOT NULL THEN 5 ELSE 0 END
        + CASE WHEN menu IS NOT NULL THEN 10 ELSE 0 END
      ) AS score
    FROM places
    WHERE review_status = 'approved'
    ORDER BY score ASC
    LIMIT 500
  `);

  if (rows.length === 0) {
    return {
      average: 0,
      total: 0,
      complete: 0,
      incomplete: 0,
      critical: 0,
      worst: [],
    };
  }
  const total = rows.length;
  const sum = rows.reduce((acc, r) => acc + Number(r.score), 0);
  return {
    average: Math.round(sum / total),
    total,
    complete: rows.filter((r) => Number(r.score) >= 80).length,
    incomplete: rows.filter(
      (r) => Number(r.score) >= 50 && Number(r.score) < 80,
    ).length,
    critical: rows.filter((r) => Number(r.score) < 50).length,
    worst: rows
      .slice(0, 10)
      .map((r) => ({ id: r.id, name: r.name, score: Number(r.score) })),
  };
}

/* ── Geografía ───────────────────────────────────────────────────────── */

export interface Geography {
  searchesByProvince: SearchRow[];
  searchesByMunicipality: SearchRow[];
  businessesByProvince: { label: string; count: number }[];
  activeUsersByProvince: { label: string; count: number }[];
}

/** La Verde es de toda Cuba: nada asume que La Habana es el centro (`§26`). */
export async function getGeography(f: AnalyticsFilters): Promise<Geography> {
  const [searches, municipalities, businesses, users] = await Promise.all([
    fetchRows<{
      label: string;
      searches: number;
      successful: number;
      no_results: number;
    }>(sql`
      SELECT COALESCE(NULLIF(province, ''), '—') AS label,
        COUNT(*) FILTER (WHERE event_type = 'search_performed')::int AS searches,
        COUNT(*) FILTER (WHERE event_type = 'search_results_shown')::int AS successful,
        COUNT(*) FILTER (WHERE event_type = 'search_no_results')::int AS no_results
      FROM analytics_events WHERE ${period(f)}${eventFilter(f)}
      GROUP BY 1 ORDER BY searches DESC
    `),
    fetchRows<{
      label: string;
      searches: number;
      successful: number;
      no_results: number;
    }>(sql`
      SELECT COALESCE(NULLIF(municipality, ''), '—') AS label,
        COUNT(*) FILTER (WHERE event_type = 'search_performed')::int AS searches,
        COUNT(*) FILTER (WHERE event_type = 'search_results_shown')::int AS successful,
        COUNT(*) FILTER (WHERE event_type = 'search_no_results')::int AS no_results
      FROM analytics_events WHERE ${period(f)}${eventFilter(f)}
      GROUP BY 1 ORDER BY searches DESC LIMIT 30
    `),
    fetchRows<{ label: string; count: number }>(sql`
      SELECT province AS label, COUNT(*)::int AS count FROM places
      WHERE province <> '' AND review_status = 'approved'
      GROUP BY 1 ORDER BY count DESC
    `),
    fetchRows<{ label: string; count: number }>(sql`
      SELECT COALESCE(NULLIF(province, ''), '—') AS label, COUNT(DISTINCT user_id)::int AS count
      FROM analytics_events
      WHERE user_id IS NOT NULL AND ${period(f)}${eventFilter(f)}
      GROUP BY 1 ORDER BY count DESC LIMIT 30
    `),
  ]);

  const toRow = (r: (typeof searches)[number]): SearchRow => ({
    label: r.label,
    searches: Number(r.searches),
    successful: Number(r.successful),
    noResults: Number(r.no_results),
  });

  return {
    searchesByProvince: searches.map(toRow),
    searchesByMunicipality: municipalities.map(toRow),
    businessesByProvince: businesses.map((r) => ({
      label: r.label,
      count: Number(r.count),
    })),
    activeUsersByProvince: users.map((r) => ({
      label: r.label,
      count: Number(r.count),
    })),
  };
}

/* ── Funnels ─────────────────────────────────────────────────────────── */

export interface FunnelStage {
  label: string;
  count: number;
  conversion: number;
}

export interface Funnels {
  users: FunnelStage[];
  businesses: FunnelStage[];
}

/** Convierte una lista de conteos en un embudo con su conversión por paso. */
function toFunnel(stages: { label: string; count: number }[]): FunnelStage[] {
  return stages.map((stage, index) => {
    const previous =
      index === 0 ? stage.count : (stages[index - 1]?.count ?? 0);
    return {
      ...stage,
      conversion:
        previous > 0 ? Number(((stage.count / previous) * 100).toFixed(1)) : 0,
    };
  });
}

/**
 * Embudo de usuario (`§24`) y de negocio (`§25`). Cada etapa es un `COUNT`
 * sobre sus eventos; las etapas sin ningún dato se filtran para no enseñar un
 * embudo vacío.
 */
export async function getFunnels(f: AnalyticsFilters): Promise<Funnels> {
  const [userRow] = await fetchRows<{
    registered: number;
    searched: number;
    results: number;
    viewed: number;
    acted: number;
  }>(sql`
    SELECT
      COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'user_registered')::int AS registered,
      COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'search_performed')::int AS searched,
      COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'search_results_shown')::int AS results,
      COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'business_viewed')::int AS viewed,
      COUNT(DISTINCT user_id) FILTER (WHERE event_type IN (
        'business_contact_clicked', 'business_whatsapp_clicked', 'business_phone_clicked',
        'business_map_clicked', 'business_website_clicked', 'business_social_clicked'
      ))::int AS acted
    FROM analytics_events WHERE ${period(f)}${eventFilter(f)}
  `);

  const [bizRow] = await fetchRows<{
    started: number;
    completed: number;
    approved: number;
    active: number;
    impressed: number;
    viewed: number;
    acted: number;
  }>(sql`
    SELECT
      COUNT(DISTINCT business_id) FILTER (WHERE event_type = 'business_registration_started')::int AS started,
      COUNT(DISTINCT business_id) FILTER (WHERE event_type = 'business_registration_completed')::int AS completed,
      COUNT(DISTINCT business_id) FILTER (WHERE event_type = 'business_approved')::int AS approved,
      (SELECT COUNT(*)::int FROM places WHERE review_status = 'approved' AND is_active AND status = 'active') AS active,
      COUNT(DISTINCT business_id) FILTER (WHERE event_type = 'business_impression')::int AS impressed,
      COUNT(DISTINCT business_id) FILTER (WHERE event_type = 'business_viewed')::int AS viewed,
      COUNT(DISTINCT business_id) FILTER (WHERE event_type IN (
        'business_contact_clicked', 'business_whatsapp_clicked', 'business_phone_clicked',
        'business_map_clicked', 'business_website_clicked', 'business_social_clicked'
      ))::int AS acted
    FROM analytics_events WHERE ${period(f)}${eventFilter(f)}
  `);

  return {
    users: toFunnel([
      { label: "Registro", count: Number(userRow?.registered ?? 0) },
      { label: "Primera búsqueda", count: Number(userRow?.searched ?? 0) },
      { label: "Resultados", count: Number(userRow?.results ?? 0) },
      { label: "Negocio visto", count: Number(userRow?.viewed ?? 0) },
      { label: "Acción", count: Number(userRow?.acted ?? 0) },
    ]).filter((s) => s.count > 0),
    businesses: toFunnel([
      { label: "Registro iniciado", count: Number(bizRow?.started ?? 0) },
      { label: "Registro completado", count: Number(bizRow?.completed ?? 0) },
      { label: "Aprobación", count: Number(bizRow?.approved ?? 0) },
      { label: "Activo", count: Number(bizRow?.active ?? 0) },
      { label: "Primera impresión", count: Number(bizRow?.impressed ?? 0) },
      { label: "Primera vista", count: Number(bizRow?.viewed ?? 0) },
      { label: "Primera acción", count: Number(bizRow?.acted ?? 0) },
    ]).filter((s) => s.count > 0),
  };
}

/* ── Fuentes / UTM ───────────────────────────────────────────────────── */

export interface SourceRow {
  source: string;
  medium: string;
  campaign: string;
  count: number;
}

export async function getSources(f: AnalyticsFilters): Promise<SourceRow[]> {
  const rows = await fetchRows<{
    source: string;
    medium: string;
    campaign: string;
    count: number;
  }>(sql`
    SELECT
      COALESCE(NULLIF(source, ''), 'directo') AS source,
      COALESCE(NULLIF(medium, ''), '—') AS medium,
      COALESCE(NULLIF(campaign, ''), '—') AS campaign,
      COUNT(*)::int AS count
    FROM analytics_events
    WHERE ${period(f)}${eventFilter(f)}
    GROUP BY 1, 2, 3
    ORDER BY count DESC
    LIMIT 50
  `);
  return rows.map((r) => ({
    source: r.source,
    medium: r.medium,
    campaign: r.campaign,
    count: Number(r.count),
  }));
}

/* ── Salud del sistema ───────────────────────────────────────────────── */

export interface Health {
  totalEvents: number;
  last24h: number;
  last7d: number;
  last30d: number;
  estimatedBytes: number;
  avgPerDay: number;
  lastAggregateDay: string | null;
  oldestEventDay: string | null;
}

/**
 * Salud de analítica (`§41`). Todo lo que se pueda medir con datos internos se
 * mide; **el tamaño es una estimación** (~250 bytes por fila, contando índices)
 * y así se rotula en la UI. No se llama a Neon por métricas de consumo.
 */
export async function getHealth(): Promise<Health> {
  const [row] = await fetchRows<{
    total: number;
    last_24h: number;
    last_7d: number;
    last_30d: number;
    oldest: string | null;
    last_day: string | null;
  }>(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS last_24h,
      COUNT(*) FILTER (WHERE created_at >= now() - interval '7 day')::int AS last_7d,
      COUNT(*) FILTER (WHERE created_at >= now() - interval '30 day')::int AS last_30d,
      to_char(MIN(created_at), 'YYYY-MM-DD') AS oldest,
      to_char(MAX(created_at), 'YYYY-MM-DD') AS last_day
    FROM analytics_events
  `);

  const [agg] = await fetchRows<{ day: string | null }>(sql`
    SELECT to_char(MAX(day), 'YYYY-MM-DD') AS day FROM analytics_daily
  `);

  const total = Number(row?.total ?? 0);
  return {
    totalEvents: total,
    last24h: Number(row?.last_24h ?? 0),
    last7d: Number(row?.last_7d ?? 0),
    last30d: Number(row?.last_30d ?? 0),
    estimatedBytes: total * 250,
    avgPerDay: Number((Number(row?.last_30d ?? 0) / 30).toFixed(1)),
    lastAggregateDay: agg?.day ?? null,
    oldestEventDay: row?.oldest ?? null,
  };
}
