import { NextRequest, NextResponse } from "next/server";
import { ACCION, registrarActividad } from "@/lib/admin-actividad";
import { aceptarFactura, ErrorFactura } from "@/lib/facturas-server";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST — el cliente acepta la factura desde el enlace público.
 *
 * No activa el servicio: deja la compra registrada y administración confirma
 * el pago. El id del enlace es la capacidad; se limita el ritmo para que no se
 * use como oráculo de facturas.
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
    const factura = await aceptarFactura(id);
    await registrarActividad({
      accion: ACCION.aceptarFactura,
      objetoTipo: "factura",
      objetoId: factura.id,
      resumen: `El cliente aceptó la factura de «${factura.negocioNombre}»`,
      adminId: null,
      adminNombre: "Cliente",
    });
    return NextResponse.json({ factura });
  } catch (error) {
    if (error instanceof ErrorFactura) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("[facturas] no se pudo aceptar", error);
    return NextResponse.json(
      { error: "No se pudo confirmar la factura." },
      { status: 500 },
    );
  }
}
