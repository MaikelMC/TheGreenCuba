import { NextRequest, NextResponse } from "next/server";
import { ACCION, registrarActividad } from "@/lib/admin-actividad";
import { isAdminRequest } from "@/lib/admin-server";
import { cancelarFactura, ErrorFactura } from "@/lib/facturas-server";

/** POST — cancela una factura que aún no se cobró. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const factura = await cancelarFactura(id);
    await registrarActividad({
      accion: ACCION.cancelarFactura,
      objetoTipo: "factura",
      objetoId: factura.id,
      resumen: `Canceló la factura de «${factura.negocioNombre}»`,
    });
    return NextResponse.json({ factura });
  } catch (error) {
    if (error instanceof ErrorFactura) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("[facturas] no se pudo cancelar", error);
    return NextResponse.json(
      { error: "No se pudo cancelar la factura." },
      { status: 500 },
    );
  }
}
