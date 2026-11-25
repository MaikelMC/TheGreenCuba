import { NextRequest, NextResponse } from "next/server";
import { buscarAdmin } from "@/lib/admin-busqueda";
import { isAdminRequest } from "@/lib/admin-server";

/**
 * El buscador global del panel.
 *
 * Solo responde a administradores, por sesión o por `x-admin-key`. No se cachea:
 * la lista de negocios y usuarios cambia y una respuesta vieja haría que un
 * resultado llevara a una ficha que ya no existe.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const consulta = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (consulta.length > 80) {
    return NextResponse.json(
      { error: "La búsqueda es demasiado larga." },
      { status: 400 },
    );
  }

  try {
    const resultados = await buscarAdmin(consulta);
    return NextResponse.json(resultados, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(
      "No se pudo completar la búsqueda del panel:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "No se pudo buscar. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
