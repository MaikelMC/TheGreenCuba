import { NextRequest, NextResponse } from "next/server";
import { canManagePlace } from "@/lib/admin-server";
import { actualizarTasa } from "@/lib/tasa-server";

/**
 * Actualiza la tasa del día del negocio.
 *
 * Solo el dueño (y administración): la tasa es una decisión comercial que no
 * se delega a trabajadores, igual que los planes y los pagos.
 */

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;

  if (!(await canManagePlace(req, id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: {
    tasa?: unknown;
    redondeo?: unknown;
    activa?: unknown;
    tasaEur?: unknown;
    tasaMlc?: unknown;
    transferenciaPct?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  /* `null` borra el valor; cualquier otra cosa que no sea número se ignora. */
  const numONull = (v: unknown) =>
    typeof v === "number" || v === null ? v : undefined;

  const result = await actualizarTasa(
    id,
    {
      tasa: typeof body.tasa === "number" ? body.tasa : undefined,
      redondeo: typeof body.redondeo === "number" ? body.redondeo : undefined,
      activa: typeof body.activa === "boolean" ? body.activa : undefined,
      tasaEur: numONull(body.tasaEur),
      tasaMlc: numONull(body.tasaMlc),
      transferenciaPct: numONull(body.transferenciaPct),
    },
    "panel",
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
