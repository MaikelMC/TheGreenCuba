import { NextRequest, NextResponse } from "next/server";
import { ACCION, registrarActividad } from "@/lib/admin-actividad";
import { isAdminRequest } from "@/lib/admin-server";
import {
  confirmarFactura,
  ErrorFactura,
} from "@/lib/facturas-server";

/**
 * POST — administración confirma el pago de una factura aceptada.
 *
 * Aplica el plan o el pack con el flujo de `pagos`, no con un atajo paralelo.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const factura = await confirmarFactura(id);
    await registrarActividad({
      accion: ACCION.confirmarFactura,
      objetoTipo: "factura",
      objetoId: factura.id,
      resumen: `Confirmó el pago de la factura de «${factura.negocioNombre}»`,
      datos: {
        tipo: factura.tipo,
        precioUsd: factura.precioUsd,
        pagoId: factura.pagoId,
      },
    });
    return NextResponse.json({ factura });
  } catch (error) {
    if (error instanceof ErrorFactura) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("[facturas] no se pudo confirmar", error);
    return NextResponse.json(
      { error: "No se pudo confirmar el pago de la factura." },
      { status: 500 },
    );
  }
}
