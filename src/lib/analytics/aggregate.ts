import { sql } from "drizzle-orm";
import { rows } from "@/lib/analytics/sql";

/**
 * Agregaciones diarias y limpieza de eventos crudos.
 *
 * Dos trabajos, y los dos tienen que poder repetirse sin cambiar el resultado
 * (`§13`, `§42`): la agregación **recalcula** el día entero en vez de sumar, y
 * la limpieza borra por lotes con un tope de filas. Si el proceso se corta a
 * mitad, volver a lanzarlo deja lo mismo.
 */

/**
 * Días de evento crudo. Configurable por entorno, y con un máximo sensato:
 * sin tope, `ANALYTICS_RETENTION_DAYS=99999` convertiría la limpieza en un
 * no-op silencioso —justo lo contrario de la política que pide `§10`—.
 */
export const RETENTION_DAYS = (() => {
  const raw = Number(process.env.ANALYTICS_RETENTION_DAYS);
  if (!Number.isFinite(raw)) return 90;
  return Math.max(7, Math.min(Math.round(raw), 365));
})();

/** Día UTC en «YYYY-MM-DD». La agregación y la retención hablan en UTC. */
export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Recalcula `analytics_daily` para un día concreto.
 *
 * Una sola pasada sobre los eventos de ese día (`created_at` acota por el
 * índice `(event_type, created_at)` no, por el de `created_at`, que es el que
 * sirve para un rango sin tipo). El `ON CONFLICT` sobre las cuatro dimensiones
 * reemplaza contadores en vez de incrementarlos: idempotente de verdad.
 *
 * Las métricas de usuarios por dimensión (`new_users`, `active_users`) son
 * distintos por fila y **no se suman** entre dimensiones —un mismo usuario
 * puede caer en dos provincias—. El dashboard calcula DAU/WAU/MAU y retención
 * directamente de `analytics_events`, que es donde no hay doble conteo.
 */
export async function aggregateDay(day: string): Promise<number> {
  const result = await rows<{ count: number }>(sql`
    WITH daily AS (
      INSERT INTO analytics_daily (
        id, day, province, municipality, category_id,
        searches, successful_searches, no_result_searches,
        business_views, business_impressions, business_actions,
        new_users, active_users, new_businesses
      )
      SELECT
        ${day} || '|' || COALESCE(province, '') || '|' || COALESCE(municipality, '') || '|' || COALESCE(category_id, ''),
        ${day},
        COALESCE(province, ''),
        COALESCE(municipality, ''),
        COALESCE(category_id, ''),
        COUNT(*) FILTER (WHERE event_type = 'search_performed'),
        COUNT(*) FILTER (WHERE event_type = 'search_results_shown'),
        COUNT(*) FILTER (WHERE event_type = 'search_no_results'),
        COUNT(*) FILTER (WHERE event_type = 'business_viewed'),
        COUNT(*) FILTER (WHERE event_type = 'business_impression'),
        COUNT(*) FILTER (WHERE event_type IN (
          'business_contact_clicked', 'business_whatsapp_clicked',
          'business_phone_clicked', 'business_map_clicked',
          'business_website_clicked', 'business_social_clicked'
        )),
        COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'user_registered'),
        COUNT(DISTINCT user_id) FILTER (WHERE event_type IN (
          'search_performed', 'business_viewed', 'business_impression',
          'business_contact_clicked', 'business_whatsapp_clicked',
          'business_phone_clicked', 'business_map_clicked',
          'business_website_clicked', 'business_social_clicked', 'place_saved'
        )),
        COUNT(*) FILTER (WHERE event_type = 'business_registration_completed')
      FROM analytics_events
      WHERE created_at >= ${day}::date
        AND created_at < (${day}::date + interval '1 day')
      GROUP BY COALESCE(province, ''), COALESCE(municipality, ''), COALESCE(category_id, '')
      ON CONFLICT (day, province, municipality, category_id) DO UPDATE SET
        searches = EXCLUDED.searches,
        successful_searches = EXCLUDED.successful_searches,
        no_result_searches = EXCLUDED.no_result_searches,
        business_views = EXCLUDED.business_views,
        business_impressions = EXCLUDED.business_impressions,
        business_actions = EXCLUDED.business_actions,
        new_users = EXCLUDED.new_users,
        active_users = EXCLUDED.active_users,
        new_businesses = EXCLUDED.new_businesses,
        updated_at = now()
      RETURNING 1 AS count
    )
    SELECT COUNT(*)::int AS count FROM daily
  `);

  /* El driver entrega las filas como array plano (`sql.query` de Neon). */
  return Number(result[0]?.count ?? 0);
}

/**
 * Recalcula un rango de días, de más reciente a más antiguo.
 *
 * El tope de 120 días no es arbitrario: `§13` pide no recalcular todo el
 * histórico, y un rango sin límite llegado desde la API sería justo eso.
 */
export async function aggregateRange(
  from: string,
  to: string,
): Promise<number> {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  const days: string[] = [];
  for (
    let cursor = start;
    cursor <= end && days.length < 120;
    cursor = new Date(cursor.getTime() + 86_400_000)
  ) {
    days.push(utcDay(cursor));
  }

  let updated = 0;
  for (const day of days.reverse()) {
    updated += await aggregateDay(day);
  }
  return updated;
}

/**
 * Borra eventos crudos más antiguos que la retención, **por lotes**.
 *
 * `§42` es explícito: nada de un `DELETE` de millones de filas. Cada pasada
 * borra como mucho `batchSize` y se repite hasta que no queda nada o se agota
 * `maxBatches` —el tope es lo que impide que una petición se quede colgada
 * horas; lo que no se borre hoy se borra en la siguiente—.
 *
 * Solo toca `analytics_events`. `analytics_daily` es el histórico que `§10`
 * dice que no se elimina.
 */
export async function cleanupEvents(
  batchSize = 5000,
  maxBatches = 10,
): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
  let deleted = 0;

  for (let batch = 0; batch < maxBatches; batch += 1) {
    const result = await rows<{ id: string }>(sql`
      DELETE FROM analytics_events
      WHERE id IN (
        SELECT id FROM analytics_events
        WHERE created_at < ${cutoff.toISOString()}
        ORDER BY created_at
        LIMIT ${batchSize}
      )
      RETURNING id
    `);
    deleted += result.length;
    if (result.length < batchSize) break;
  }

  return deleted;
}
