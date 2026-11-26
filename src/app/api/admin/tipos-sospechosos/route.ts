import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-server";
import { listarTiposSospechosos } from "@/lib/admin-tipos-sospechosos-server";

/**
 * Fichas cuya categoría contradice su nombre o su carta.
 *
 * Solo lectura y solo para administradores. La pantalla que lo pinta vive en
 * `/admin`; este endpoint es la fuente única para que el informe y el panel no
 * puedan discrepar.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sospechosos = await listarTiposSospechosos();
  return NextResponse.json({ total: sospechosos.length, sospechosos });
}
