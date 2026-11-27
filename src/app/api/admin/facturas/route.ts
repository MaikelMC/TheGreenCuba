import { NextRequest, NextResponse } from "next/server";
import { ACCION, registrarActividad } from "@/lib/admin-actividad";
import { isAdminRequest } from "@/lib/admin-server";
import { getAppUser } from "@/lib/auth/user";
import { siteConfig } from "@/config/site";
import {
  crearFacturaPack,
  crearFacturaPlan,
  ErrorFactura,
} from "@/lib/facturas-server";

/**
 * POST — emite una factura para un pack a medida o un plan estándar.
 *
 * Body: `{ packId, negocioId }` o `{ negocioId, plan }`.
 * El precio y los conceptos salen del servidor, nunca del navegador.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const negocioId =
    typeof body.negocioId === "string" ? body.negocioId.trim() : "";
  const packId = typeof body.packId === "string" ? body.packId.trim() : "";
  const plan = typeof body.plan === "string" ? body.plan.trim() : "";

  if (!negocioId) {
    return NextResponse.json({ error: "Falta negocioId" }, { status: 400 });
  }

  const user = await getAppUser().catch(() => null);

  try {
    const emitida = packId
      ? await crearFacturaPack(packId, user?.id ?? null, user?.name ?? null)
      : plan
        ? await crearFacturaPlan(
            negocioId,
            plan as "esencial" | "publicidad_max" | "pro",
            user?.id ?? null,
          )
        : null;

    if (!emitida) {
      return NextResponse.json(
        { error: "Indica un pack o un plan." },
        { status: 400 },
      );
    }

    await registrarActividad({
      accion: ACCION.crearFactura,
      objetoTipo: "factura",
      objetoId: emitida.factura.id,
      resumen: `Emitió la factura de «${emitida.factura.negocioNombre}»`,
      datos: {
        tipo: emitida.factura.tipo,
        precioUsd: emitida.factura.precioUsd,
        packId: packId || null,
        plan: plan || null,
      },
    });

    return NextResponse.json(
      {
        factura: emitida.factura,
        telefono: emitida.telefono,
        url: `${siteConfig.url.replace(/\/+$/, "")}/factura/${emitida.factura.id}`,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ErrorFactura) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("[facturas] no se pudo emitir", error);
    return NextResponse.json(
      { error: "No se pudo emitir la factura." },
      { status: 500 },
    );
  }
}
