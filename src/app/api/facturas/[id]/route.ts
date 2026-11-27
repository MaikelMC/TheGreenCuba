import { NextRequest, NextResponse } from "next/server";
import { ErrorFactura, obtenerFactura } from "@/lib/facturas-server";
import { rateLimit } from "@/lib/rate-limit";

/**
 * GET — el estado actual de la propuesta, para la pantalla del enlace.
 *
 * La página pública lo consulta mientras el cliente la tiene abierta: cuando
 * administración confirma el pago, el navegador se entera sin que nadie tenga
 * que recargar a mano. Devuelve el mismo resumen que ya viaja en el HTML, así
 * que no expone nada nuevo: el id del enlace es la capacidad.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const limitado = rateLimit(req, 600, 60_000);
  if (!limitado.ok) {
    return NextResponse.json(
      { error: "Demasiadas peticiones. Espera un momento." },
      { status: 429 },
    );
  }

  const { id } = await params;

  try {
    const factura = await obtenerFactura(id);
    if (!factura) {
      throw new ErrorFactura("Propuesta no encontrada.", 404);
    }
    return NextResponse.json(
      { factura },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    if (error instanceof ErrorFactura) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("[facturas] no se pudo consultar el estado", error);
    return NextResponse.json(
      { error: "No se pudo consultar la factura." },
      { status: 500 },
    );
  }
}
