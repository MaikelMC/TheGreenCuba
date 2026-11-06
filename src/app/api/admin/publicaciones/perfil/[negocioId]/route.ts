import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-server";
import { getPlaceById } from "@/lib/db/queries";

/**
 * Perfil mínimo de un negocio para el formulario de creación manual de
 * publicaciones en administración: nombre, descripción y carta.
 *
 * Solo se expone lo que el formulario necesita para mostrar el selector de
 * producto y rellenar el prompt. No viajan datos sensibles (teléfono, dirección
 * exacta, credenciales).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ negocioId: string }> },
) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { negocioId } = await params;
  const place = await getPlaceById(negocioId);
  if (!place) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    id: place.id,
    name: place.name,
    description: place.description,
    menu: place.menu,
  });
}
