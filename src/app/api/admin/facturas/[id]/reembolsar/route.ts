import { NextRequest, NextResponse } from "next/server";
import { ACCION, registrarActividad } from "@/lib/admin-actividad";
import { isAdminRequest } from "@/lib/admin-server";
import { getAppUser } from "@/lib/auth/user";
import {
  ErrorFactura,
  reembolsarFactura,
} from "@/lib/facturas-server";
import { formatoUsd } from "@/lib/facturas";

/**
 * POST — administración reembolsa una factura pagada.
 *
 * El motivo es obligatorio y el importe lo calcula el servidor con el pago
 * confirmado. La factura queda en `reembolsada` y el registro se ve tanto en
 * la sección de facturas como en el historial de actividad del panel.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { motivo?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const motivo = typeof body.motivo === "string" ? body.motivo : "";
  const { id } = await params;

  try {
    const user = await getAppUser().catch(() => null);
    const factura = await reembolsarFactura(
      id,
      motivo,
      user ? { id: user.id, nombre: user.name } : null,
    );

    await registrarActividad({
      accion: ACCION.reembolsarFactura,
      objetoTipo: "factura",
      objetoId: factura.id,
      resumen: `Reembolsó ${formatoUsd((factura.reembolso?.montoCentavos ?? 0) / 100)} USD de la factura de «${factura.negocioNombre}»`,
      datos: {
        motivo: factura.reembolso?.motivo ?? null,
        montoCentavos: factura.reembolso?.montoCentavos ?? null,
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
    console.error("[facturas] no se pudo reembolsar", error);
    return NextResponse.json(
      { error: "No se pudo registrar el reembolso." },
      { status: 500 },
    );
  }
}
