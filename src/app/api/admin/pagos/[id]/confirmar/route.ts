import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { ACCION, registrarActividad } from "@/lib/admin-actividad";
import { isAdminRequest } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { pagos, places } from "@/lib/db/schema";
import { aplicarDerecho } from "@/lib/pagos-server";

/**
 * Confirmar a mano un pago pendiente.
 *
 * Existe para los cobros que no pasan por el webhook: una transferencia que se
 * comprueba por fuera, una cortesía que quedó a medias, un pago de QvaPay que
 * llegó sin aviso. `aplicarDerecho` es la misma función que usa el webhook, así
 * que el plan, el módulo o el pack se activan exactamente igual y un reintento
 * no suma dos meses.
 *
 * Solo administración. La entrada lleva la misma comprobación que el resto de
 * rutas del panel (`isAdminRequest`).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const [pago] = await db.select().from(pagos).where(eq(pagos.id, id)).limit(1);

  if (!pago) {
    return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
  }

  /* Ya estaba: la acción es idempotente y la bandeja puede reintentar sin
     miedo. No se vuelve a aplicar nada. */
  if (pago.estado === "pagado") {
    return NextResponse.json({ ok: true, yaEstaba: true });
  }

  /* Un pago fallido no se confirma desde aquí: QvaPay lo rechazó y forzarlo
     dejaría un derecho activo sin cobro detrás. Para eso está emitir otro. */
  if (pago.estado === "fallido") {
    return NextResponse.json(
      {
        error:
          "Ese pago está marcado como fallido. Emite uno nuevo en vez de confirmarlo.",
      },
      { status: 409 },
    );
  }

  await aplicarDerecho(pago);

  const [negocio] = await db
    .select({ name: places.name })
    .from(places)
    .where(eq(places.id, pago.negocioId))
    .limit(1);

  const usd = (pago.montoCentavos / 100).toLocaleString("es-CU", {
    maximumFractionDigits: 2,
  });

  await registrarActividad({
    accion: ACCION.confirmarPago,
    objetoTipo: "negocio",
    objetoId: pago.negocioId,
    resumen: `Confirmó un pago de ${usd} USD de «${negocio?.name ?? "un negocio"}»`,
    datos: { pagoId: pago.id, tipo: pago.tipo, clave: pago.clave },
  });

  return NextResponse.json({ ok: true });
}
