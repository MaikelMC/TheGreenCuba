import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-server";
import { enviarRecordatoriosDePago } from "@/lib/recordatorios-pago-server";

/**
 * El recordatorio mensual de pago (`vercel.json`, una vez al día).
 *
 * Es idempotente por construcción: la tabla `recordatorios_pago` guarda qué
 * aviso salió por negocio y fecha, así que lanzarlo dos veces el mismo día —o a
 * mano desde el panel— no duplica correos. Se puede llamar con
 * `Authorization: Bearer $CRON_SECRET` (lo pone Vercel) o con `x-admin-key` /
 * sesión de administrador para probarlo desde fuera.
 *
 * La respuesta lleva el recuento y no los destinatarios: sirve para saber si el
 * trabajo corrió y cuánto envió, sin filtrar correos de dueños al log.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const authorized =
    (secret
      ? req.headers.get("authorization") === `Bearer ${secret}`
      : false) || (await isAdminRequest(req));

  if (!authorized) {
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  try {
    const resumen = await enviarRecordatoriosDePago();
    return NextResponse.json({ ok: true, ...resumen });
  } catch (error) {
    console.error(
      "[cron/recordatorios]",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { ok: false, error: "Falló el envío de recordatorios de pago" },
      { status: 500 },
    );
  }
}
