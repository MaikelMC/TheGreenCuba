import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { calcularRanking } from "@/lib/ranking-server";
import { esPeriodo, periodoAnterior } from "@/lib/ranking";
import { CATALOG_TAG } from "@/lib/db/queries";
import { isAdminRequest } from "@/lib/admin-server";

/**
 * El job mensual del «Top del mes»: cierra un mes, calcula el podio y concede
 * el descuento.
 *
 * **Idempotente.** `calcularRanking` borra el periodo entero antes de
 * reescribirlo, así que volver a lanzarlo deja el mismo resultado. Eso es lo
 * que permite reintentar cuando el cron falla y lo que hace segura la
 * corrección a mano con `?periodo=YYYY-MM`.
 *
 * Por defecto cierra el mes **anterior**, que a primeros de mes ya tiene todos
 * sus días escritos. El parámetro existe para dos casos: reejecutar un mes
 * viejo tras arreglar un dato, y probar el job sin esperar a que cambie el mes.
 *
 * Dos formas de autorizarlo, como el cron de analítica:
 *
 * - **Cron externo**, con `Authorization: Bearer $CRON_SECRET`.
 * - **`x-admin-key` o sesión admin**, para lanzarlo a mano desde la UI o `curl`.
 *
 * Sin `CRON_SECRET` y sin ser admin responde 401: el cálculo escribe en la base
 * y concede descuentos, así que no puede quedar abierto a cualquiera.
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

  const pedido = req.nextUrl.searchParams.get("periodo");
  if (pedido !== null && !esPeriodo(pedido)) {
    return NextResponse.json(
      { ok: false, error: "El periodo tiene que ser «YYYY-MM»" },
      { status: 400 },
    );
  }
  const periodo = pedido ?? periodoAnterior();

  try {
    const resultado = await calcularRanking(periodo);

    /* El catálogo está cacheado cinco minutos y la insignia «Top del mes» sale
       de esta tabla: sin invalidar, el podio recién calculado tardaría en verse.
       Misma etiqueta que escriben los que tocan `places`, que es donde el
       `exists` de la insignia vive. */
    revalidateTag(CATALOG_TAG, "max");

    return NextResponse.json({ ok: true, ...resultado });
  } catch (error) {
    console.error(
      "[cron/ranking]",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { ok: false, error: "Falló el cálculo del ranking" },
      { status: 500 },
    );
  }
}
