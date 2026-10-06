import { NextRequest, NextResponse } from "next/server";
import {
  aggregateRange,
  cleanupEvents,
  RETENTION_DAYS,
} from "@/lib/analytics/aggregate";
import { isAdminRequest } from "@/lib/admin-server";

/**
 * Trabajo periódico de analítica (`§13`, `§42`): recalcula los agregados de los
 * últimos días y limpia eventos fuera de retención.
 *
 * **Idempotente y acotado.** La agregación recalcula días concretos, así que
 * volver a ejecutarlo deja el mismo resultado; el rango es de tres días —hoy y
 * los dos anteriores— para cerrar el día en curso y corregir un evento que
 * llegue tarde, sin tocar todo el histórico. La limpieza va por lotes dentro de
 * `cleanupEvents`.
 *
 * Dos formas de autorizarlo:
 *
 * - **Vercel Cron**, con `Authorization: Bearer $CRON_SECRET` (Vercel lo pone
 *   solo si la variable está configurada).
 * - **`x-admin-key` o sesión admin**, para lanzarlo a mano desde la UI o `curl`.
 *
 * Sin `CRON_SECRET` configurado y sin ser admin, responde 401: un agregador
 * abierto es una escritura gratuita para cualquiera.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const authorized =
    (secret
      ? req.headers.get("authorization") === `Bearer ${secret}`
      : false) || (await isAdminRequest(req));

  if (!authorized) {
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  const today = new Date();
  const from = new Date(today.getTime() - 2 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const to = today.toISOString().slice(0, 10);

  try {
    const rowsAggregated = await aggregateRange(from, to);
    const deleted = await cleanupEvents();

    return NextResponse.json({
      ok: true,
      period: { from, to },
      rowsAggregated,
      deleted,
      retentionDays: RETENTION_DAYS,
    });
  } catch (error) {
    console.error(
      "[cron/analytics]",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { ok: false, error: "Falló el trabajo de analítica" },
      { status: 500 },
    );
  }
}
