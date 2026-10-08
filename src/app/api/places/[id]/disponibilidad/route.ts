import { NextRequest, NextResponse } from "next/server";
import { canManagePlace } from "@/lib/admin-server";
import { setDisponibilidad } from "@/lib/disponibilidad-server";

/**
 * El interruptor de «Hoy hay»: marca un producto como disponible o agotado.
 *
 * Es una ruta y no parte del `PATCH` del negocio porque la disponibilidad se
 * cambia **en el momento** —el dueño llega y se le acabó el plato—, no al final
 * de un formulario largo. Además así pasa por `setDisponibilidad`, que es el
 * mismo camino que usará el asistente de Telegram: una sola validación de plan
 * y una sola invalidación de caché.
 */

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  if (!(await canManagePlace(req, id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { productoId?: unknown; estado?: unknown; hasta?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const productoId = typeof body.productoId === "string" ? body.productoId : "";
  const estado = body.estado;
  if (!productoId || (estado !== "disponible" && estado !== "agotado")) {
    return NextResponse.json(
      { error: "Faltan `productoId` o un `estado` válido." },
      { status: 400 },
    );
  }

  /* `hasta` es una fecha de vuelta opcional (epoch ms). Se ignora cualquier cosa
     que no sea un número finito: un `NaN` guardado en el jsonb haría que
     `estaAgotado` nunca devolviera `true` y el producto quedara agotado para
     siempre. */
  const hasta =
    typeof body.hasta === "number" && Number.isFinite(body.hasta)
      ? body.hasta
      : null;

  const result = await setDisponibilidad(id, productoId, estado, hasta);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: result.code === "plan" ? 403 : 404 },
    );
  }

  return NextResponse.json({
    agotado: result.agotado,
    agotadoHasta: result.agotadoHasta,
  });
}
