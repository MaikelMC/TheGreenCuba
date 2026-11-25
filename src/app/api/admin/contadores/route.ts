import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-server";
import { contarPendientesAdmin } from "@/lib/admin-contadores";

/**
 * Los contadores de la navegación. Se piden al volver a la pestaña y después de
 * cada acción, así que la respuesta va sin caché y solo trae números.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  return NextResponse.json(await contarPendientesAdmin());
}
