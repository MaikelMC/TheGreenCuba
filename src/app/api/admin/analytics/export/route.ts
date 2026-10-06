import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { isAdminRequest } from "@/lib/admin-server";
import { rows as fetchRows } from "@/lib/analytics/sql";
import {
  getBusinesses,
  getDemandByCategory,
  getDemandByProvince,
  getFunnels,
  getGeography,
  getNoResults,
  getQuality,
  getRetention,
  getSearches,
  getSources,
  type AnalyticsFilters,
} from "@/lib/analytics/queries";
import { BOM, cell, csv } from "@/lib/analytics/csv";
import { normalizePeriod } from "@/lib/analytics/period";

/**
 * Exportación CSV (`§35`).
 *
 * Dos caminos según el tamaño:
 *
 * - **Tablas agregadas** (búsquedas, negocios, demanda…): son pocas filas y se
 *   arma el CSV entero en memoria. Cargar cincuenta filas no es un problema.
 * - **Eventos crudos**: se **transmiten por lotes** de 1000 con `OFFSET`,
 *   escribiendo en el `ReadableStream` a medida que llegan. Nunca se tienen
 *   todas las filas a la vez en memoria (`§36`), que era la advertencia.
 *
 * Todas respetan los filtros y el periodo que llegan por query (`§35`): el CSV
 * es exactamente lo que se está viendo en pantalla.
 */

export const dynamic = "force-dynamic";

const MAX_EVENT_ROWS = 100_000;
const CHUNK = 1000;

function filterParam(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 80) : undefined;
}

function readFilters(req: NextRequest): AnalyticsFilters {
  const params = req.nextUrl.searchParams;
  const { from, to } = normalizePeriod(params.get("from"), params.get("to"));
  return {
    from,
    to,
    province: filterParam(params.get("province")),
    category: filterParam(params.get("category")),
    businessId: filterParam(params.get("business")),
    source: filterParam(params.get("source")),
    medium: filterParam(params.get("medium")),
    campaign: filterParam(params.get("campaign")),
  };
}

/* Tipo y no `interface`: `db.execute` exige que el genérico sea un alias de
   objeto —una `interface` no lleva firma de índice y no lo satisface—. */
type EventCsvRow = {
  id: string;
  event_type: string;
  created_at: string;
  user_id: string | null;
  session_id: string | null;
  business_id: string | null;
  search_query: string | null;
  category_id: string | null;
  province: string | null;
  municipality: string | null;
  result_count: number | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
};

/** CSV de eventos crudos, por lotes y en streaming. */
function streamEvents(f: AnalyticsFilters): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const headers = [
    "event_id",
    "event_type",
    "timestamp",
    "user_id",
    "session_id",
    "business_id",
    "search_query",
    "category",
    "province",
    "municipality",
    "result_count",
    "source",
    "medium",
    "campaign",
  ];

  const filterParts = sql`created_at >= ${f.from}::date AND created_at < (${f.to}::date + interval '1 day')`;

  return new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(csv(headers, [])));
      let offset = 0;
      try {
        for (;;) {
          const chunk = await fetchRows<EventCsvRow>(sql`
            SELECT id, event_type, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
              user_id, session_id, business_id, search_query, category_id,
              province, municipality, result_count, source, medium, campaign
            FROM analytics_events
            WHERE ${filterParts}
            ORDER BY created_at DESC
            LIMIT ${CHUNK} OFFSET ${offset}
          `);
          if (chunk.length === 0) break;
          controller.enqueue(
            encoder.encode(
              chunk
                .map((r) =>
                  [
                    r.id,
                    r.event_type,
                    r.created_at,
                    r.user_id,
                    r.session_id,
                    r.business_id,
                    r.search_query,
                    r.category_id,
                    r.province,
                    r.municipality,
                    r.result_count,
                    r.source,
                    r.medium,
                    r.campaign,
                  ]
                    .map(cell)
                    .join(","),
                )
                .join("\r\n") + "\r\n",
            ),
          );
          offset += chunk.length;
          if (offset >= MAX_EVENT_ROWS) break;
        }
      } catch (error) {
        console.error(
          "[analytics/export] la transmisión se cortó:",
          error instanceof Error ? error.message : error,
        );
      } finally {
        controller.close();
      }
    },
  });
}

/** Las tablas agregadas que sí caben en memoria. */
async function aggregateCsv(
  type: string,
  f: AnalyticsFilters,
): Promise<string | null> {
  switch (type) {
    case "searches": {
      const data = await getSearches(f);
      return csv(
        [
          "consulta",
          "busquedas",
          "usuarios",
          "resultados_promedio",
          "tasa_sin_resultados",
        ],
        data.topQueries.map((q) => [
          q.query,
          q.searches,
          q.users,
          q.avgResults,
          q.noResultRate,
        ]),
      );
    }
    case "no-results": {
      const data = await getNoResults(f);
      return csv(
        ["consulta", "frecuencia", "usuarios", "provincia", "categoria"],
        data.map((r) => [
          r.query,
          r.frequency,
          r.users,
          r.province,
          r.category,
        ]),
      );
    }
    case "demand-category": {
      const data = await getDemandByCategory(f);
      return csv(
        ["categoria", "demanda", "oferta", "ratio", "score", "nivel"],
        data.map((r) => [
          r.label,
          r.demand,
          r.offer,
          r.ratio,
          r.score,
          r.level,
        ]),
      );
    }
    case "demand-province": {
      const data = await getDemandByProvince(f);
      return csv(
        ["provincia", "demanda", "oferta", "ratio", "score", "nivel"],
        data.map((r) => [
          r.label,
          r.demand,
          r.offer,
          r.ratio,
          r.score,
          r.level,
        ]),
      );
    }
    case "businesses": {
      const data = await getBusinesses(f);
      return csv(
        ["categoria", "negocios"],
        data.byCategory.map((r) => [r.label, r.count]),
      );
    }
    case "quality": {
      const data = await getQuality();
      return csv(
        ["negocio", "completitud"],
        data.worst.map((r) => [r.name, r.score]),
      );
    }
    case "geography": {
      const geo = await getGeography(f);
      return csv(
        [
          "provincia",
          "busquedas",
          "con_resultados",
          "sin_resultados",
          "negocios",
          "usuarios_activos",
        ],
        geo.searchesByProvince.map((s) => [
          s.label,
          s.searches,
          s.successful,
          s.noResults,
          geo.businessesByProvince.find((b) => b.label === s.label)?.count ?? 0,
          geo.activeUsersByProvince.find((u) => u.label === s.label)?.count ??
            0,
        ]),
      );
    }
    case "retention": {
      const r = await getRetention(f);
      return csv(
        ["cohorte", "d1_pct", "d7_pct", "d14_pct", "d30_pct"],
        [[r.cohortSize, r.d1, r.d7, r.d14, r.d30]],
      );
    }
    case "funnel": {
      const data = await getFunnels(f);
      return csv(
        ["embudo", "etapa", "cantidad", "conversion_pct"],
        [
          ...data.users.map((s) => [
            "usuarios",
            s.label,
            s.count,
            s.conversion,
          ]),
          ...data.businesses.map((s) => [
            "negocios",
            s.label,
            s.count,
            s.conversion,
          ]),
        ],
      );
    }
    case "sources": {
      const data = await getSources(f);
      return csv(
        ["fuente", "medio", "campana", "eventos"],
        data.map((r) => [r.source, r.medium, r.campaign, r.count]),
      );
    }
    default:
      return null;
  }
}

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  const filters = readFilters(req);
  const type = req.nextUrl.searchParams.get("type") ?? "";
  const filename = `laverde_${type}_${filters.from}_${filters.to}.csv`;
  const disposition = `attachment; filename="${filename}"`;

  if (type === "events") {
    return new NextResponse(streamEvents(filters), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": disposition,
        "Cache-Control": "no-store",
      },
    });
  }

  const body = await aggregateCsv(type, filters);
  if (body === null) {
    return NextResponse.json(
      { ok: false, error: "Tipo de exportación desconocido" },
      { status: 400 },
    );
  }

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": disposition,
      "Cache-Control": "no-store",
    },
  });
}
