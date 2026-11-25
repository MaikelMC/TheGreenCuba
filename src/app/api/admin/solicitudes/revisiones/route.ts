import { NextRequest, NextResponse } from "next/server";
import { cargarRevisionesSolicitudes } from "@/lib/admin-solicitudes";
import { isAdminRequest } from "@/lib/admin-server";

export const dynamic = "force-dynamic";

/** La revisión automática de todas las solicitudes pendientes, solo para admins. */
export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const revisiones = await cargarRevisionesSolicitudes();
  return NextResponse.json(
    { revisiones },
    { headers: { "Cache-Control": "no-store" } },
  );
}
