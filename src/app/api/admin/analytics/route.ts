import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-server";
import { aggregateRange } from "@/lib/analytics/aggregate";
import {
  getBusinessDetail,
  getBusinesses,
  getDemandByCategory,
  getDemandByProvince,
  getFunnels,
  getGeography,
  getHealth,
  getNoResults,
  getQuality,
  getRetention,
  getSearches,
  getSources,
  getSummary,
  getUserSeries,
  type AnalyticsFilters,
} from "@/lib/analytics/queries";
import { normalizePeriod } from "@/lib/analytics/period";

/**
 * Datos del dashboard de analítica.
 *
 * Una sola ruta con `section` en vez de trece endpoints: cada sección es una
 * lectura distinta, sí, pero comparten autenticación, filtros y validación, y
 * trece ficheros con lo mismo repetido son trece sitios donde equivocarse. El
 * `switch` decide qué consultas corren (`§14`, `§47`).
 *
 * **Protegida con `isAdminRequest`**, que ya acepta sesión con rol `admin` o la
 * cabecera `x-admin-key`. El navegador nunca decide permisos (`§39`).
 *
 * Los filtros se resuelven aquí, en SQL (`§32`): el cliente manda el rango y las
 * dimensiones, nunca recibe datos para filtrar en memoria.
 */

export const dynamic = "force-dynamic";

/** Lee un filtro de la query, recortado. Vacío = no aplica. */
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

/** Módulos externos: la UI enseña «no conectado», nunca datos inventados. */
function integrationStatus() {
  return {
    ga4: {
      connected: Boolean(process.env.GA4_PROPERTY_ID),
      label: "Google Analytics",
    },
    searchConsole: {
      connected: Boolean(process.env.GSC_SITE_URL),
      label: "Google Search Console",
    },
    meta: { connected: Boolean(process.env.META_ACCESS_TOKEN), label: "Meta" },
  };
}

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  const filters = readFilters(req);
  const section = req.nextUrl.searchParams.get("section") ?? "summary";

  try {
    /* Recalcular a mano desde la UI: idempotente y acotado a 120 días
       (`§13`). Es la alternativa al cron cuando se quiere el dato al día. */
    if (req.nextUrl.searchParams.get("aggregate") === "1") {
      await aggregateRange(filters.from, filters.to);
    }

    let data: unknown;
    switch (section) {
      case "users":
        data = {
          summary: await getSummary(filters),
          series: await getUserSeries(filters),
        };
        break;
      case "retention":
        data = await getRetention(filters);
        break;
      case "searches":
        data = await getSearches(filters);
        break;
      case "no-results":
        data = await getNoResults(filters);
        break;
      case "demand":
        data = {
          byCategory: await getDemandByCategory(filters),
          byProvince: await getDemandByProvince(filters),
        };
        break;
      case "business":
        data = await getBusinessDetail(filters);
        break;
      case "businesses":
        data = {
          summary: (await getSummary(filters)).businesses,
          ...(await getBusinesses(filters)),
        };
        break;
      case "quality":
        data = await getQuality();
        break;
      case "geography":
        data = await getGeography(filters);
        break;
      case "funnel":
        data = await getFunnels(filters);
        break;
      case "sources":
        data = await getSources(filters);
        break;
      case "health":
        data = await getHealth();
        break;
      case "integrations":
        data = integrationStatus();
        break;
      /* Exportaciones no lee nada: solo arma enlaces al CSV. Sin este caso
         caía en el `default` y gastaba una consulta de resumen por visita. */
      case "exports":
        data = null;
        break;
      case "summary":
      default:
        data = await getSummary(filters);
        break;
    }

    /* Cache solo cuando aporta (`§33`): un periodo que ya terminó no cambia,
       así que se puede servir unos minutos desde la caché privada del
       navegador. El periodo en curso —que incluye hoy— va sin caché para que
       las cifras del día estén frescas. Nada de Redis: es cabecera HTTP. */
    const today = new Date().toISOString().slice(0, 10);
    const historical = filters.to < today;

    return NextResponse.json(
      {
        ok: true,
        section,
        period: { from: filters.from, to: filters.to },
        data,
      },
      {
        headers: historical
          ? {
              "Cache-Control":
                "private, max-age=300, stale-while-revalidate=600",
            }
          : { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error(
      "[api/admin/analytics]",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { ok: false, error: "No se pudieron cargar las analíticas." },
      { status: 500 },
    );
  }
}
