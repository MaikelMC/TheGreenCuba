import { NextRequest, NextResponse } from "next/server";
import { esDuenoDePlace } from "@/lib/admin-server";
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

  if (!(await esDuenoDePlace(req, id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { tasa?: unknown; redondeo?: unknown; activa?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const result = await actualizarTasa(
    id,
    {
      tasa: typeof body.tasa === "number" ? body.tasa : undefined,
      redondeo: typeof body.redondeo === "number" ? body.redondeo : undefined,
      activa: typeof body.activa === "boolean" ? body.activa : undefined,
    },
    "panel",
  );

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: result.code === "plan" ? 403 : 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
