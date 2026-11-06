import { NextRequest, NextResponse } from "next/server";
import { canManagePlace } from "@/lib/admin-server";
import { guardarEntrega } from "@/lib/entrega-server";

type Params = { params: Promise<{ id: string }> };

/** Guarda la configuración de entrega (zonas, recogida, nota…). */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;

  /* Mismo permiso que editar la ficha: el dueño y los trabajadores con
     acceso a «Editar la ficha». */
  if (!(await canManagePlace(req, id, "ficha"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const result = await guardarEntrega(id, body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: result.code === "plan" ? 403 : 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
