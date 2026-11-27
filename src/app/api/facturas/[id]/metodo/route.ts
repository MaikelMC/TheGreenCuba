import { NextRequest, NextResponse } from "next/server";
import { ACCION, registrarActividad } from "@/lib/admin-actividad";
import { esMetodoPago, METODO_PAGO } from "@/lib/facturas";
import {
  ErrorFactura,
  guardarMetodoPago,
} from "@/lib/facturas-server";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST — el negocio elige cómo pagar.
 *
 * Solo funciona con el id del enlace y mientras la propuesta está aceptada.
 * El método se valida en el servidor contra la configuración y la provincia
 * del negocio; el navegador no decide qué opciones existen.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const limitado = rateLimit(req, 30, 60_000);
  if (!limitado.ok) {
    return NextResponse.json(
      { error: "Demasiadas peticiones. Espera un momento." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  if (!esMetodoPago(body.metodo)) {
    return NextResponse.json(
      { error: "Elige un método de pago válido." },
      { status: 400 },
    );
  }

  const { id } = await params;

  try {
    const factura = await guardarMetodoPago(id, body.metodo);
    await registrarActividad({
      accion: ACCION.guardarMetodoFactura,
      objetoTipo: "factura",
      objetoId: factura.id,
      resumen: `El cliente eligió ${METODO_PAGO[body.metodo].etiqueta} para la propuesta de «${factura.negocioNombre}»`,
      adminId: null,
      adminNombre: "Cliente",
      datos: { metodo: body.metodo },
    });
    return NextResponse.json({ factura });
  } catch (error) {
    if (error instanceof ErrorFactura) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("[facturas] no se pudo guardar el método", error);
    return NextResponse.json(
      { error: "No se pudo guardar el método de pago." },
      { status: 500 },
    );
  }
}
