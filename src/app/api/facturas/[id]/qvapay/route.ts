import { NextRequest, NextResponse } from "next/server";
import {
  crearPagoQvapayFactura,
  ErrorFactura,
} from "@/lib/facturas-server";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST — abre el cobro real de QvaPay para una propuesta aceptada.
 *
 * Es la misma pasarela que usan los planes del panel: QvaPay devuelve la URL
 * de su checkout y su webhook confirma el pago. El id del enlace es la única
 * credencial, así que el precio se lee del servidor y nunca del navegador.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const limitado = rateLimit(req, 10, 60_000);
  if (!limitado.ok) {
    return NextResponse.json(
      { error: "Demasiadas peticiones. Espera un momento." },
      { status: 429 },
    );
  }

  const { id } = await params;

  try {
    const { url } = await crearPagoQvapayFactura(id);
    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof ErrorFactura) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("[facturas/qvapay] no se pudo abrir el pago", error);
    return NextResponse.json(
      { error: "No se pudo abrir el pago con QvaPay." },
      { status: 500 },
    );
  }
}
