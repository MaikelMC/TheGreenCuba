import { NextRequest, NextResponse } from "next/server";
import { ACCION, registrarActividad } from "@/lib/admin-actividad";
import { METODO_PAGO } from "@/lib/facturas";
import { avisarPago, ErrorFactura } from "@/lib/facturas-server";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST — el negocio avisa de que ya pagó.
 *
 * Pasa la propuesta a `en_revision` y deja el aviso en el registro de
 * actividad, que es donde administración lo ve. No activa nada: la activación
 * sigue ocurriendo al confirmar el pago.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const limitado = rateLimit(req, 20, 60_000);
  if (!limitado.ok) {
    return NextResponse.json(
      { error: "Demasiadas peticiones. Espera un momento." },
      { status: 429 },
    );
  }

  const { id } = await params;

  try {
    const factura = await avisarPago(id);
    await registrarActividad({
      accion: ACCION.avisarPagoFactura,
      objetoTipo: "factura",
      objetoId: factura.id,
      resumen: `El cliente avisó del pago de «${factura.negocioNombre}»${
        factura.metodoPago
          ? ` por ${METODO_PAGO[factura.metodoPago].etiqueta}`
          : ""
      }`,
      adminId: null,
      adminNombre: "Cliente",
      datos: {
        metodo: factura.metodoPago,
        precioUsd: factura.precioUsd,
        referencia: factura.id,
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
    console.error("[facturas] no se pudo avisar del pago", error);
    return NextResponse.json(
      { error: "No se pudo registrar el aviso de pago." },
      { status: 500 },
    );
  }
}
