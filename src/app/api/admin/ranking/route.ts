import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-server";
import {
  cargarRankingAdmin,
  METRICAS_RANKING,
  PERIODOS_RANKING,
  type MetricaRanking,
  type PeriodoRanking,
} from "@/lib/admin-ranking";

export const dynamic = "force-dynamic";

/**
 * Ranking de clics a ficha y menú para el panel.
 *
 * La ruta es de administración y no se cachea: los contadores cambian con el
 * uso y una cifra vieja en una conversación con un dueño es peor que una
 * pantalla que tarda un segundo.
 */
export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const diasPedidos = Number(url.searchParams.get("dias"));
  const dias = (PERIODOS_RANKING as readonly number[]).includes(diasPedidos)
    ? (diasPedidos as PeriodoRanking)
    : 30;
  const metricaPedida = url.searchParams.get("metrica") ?? "total";
  const metrica = (METRICAS_RANKING as readonly string[]).includes(metricaPedida)
    ? (metricaPedida as MetricaRanking)
    : "total";

  try {
    const datos = await cargarRankingAdmin({
      dias,
      metrica,
      provincia: url.searchParams.get("provincia")?.trim() ?? "",
      categoria: url.searchParams.get("categoria")?.trim() ?? "",
      q: (url.searchParams.get("q") ?? "").trim().slice(0, 80),
    });

    return NextResponse.json(
      { ok: true, dias, metrica, ...datos },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "[api/admin/ranking]",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { ok: false, error: "No se pudo cargar el ranking." },
      { status: 500 },
    );
  }
}
