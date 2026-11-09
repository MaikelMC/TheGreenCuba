import { NextRequest, NextResponse } from "next/server";
import { canManagePlace, respuestaSinAcceso } from "@/lib/admin-server";
import { getAppUser } from "@/lib/auth/user";
import {
  deshacerSelloManual,
  sellarClienteExistente,
} from "@/lib/fidelidad-server";

type Params = { params: Promise<{ id: string; clienteId: string }> };

/**
 * Da un sello al cliente por su id.
 *
 * Lo llama el botón «+Sello» de la fila del panel; requiere `pedidos`,
 * igual que dar sellos por teléfono o código. Devuelve `movimientoId` para
 * que el frontend pueda deshacer dentro de los 6 segundos siguientes.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id, clienteId } = await params;
  if (!(await canManagePlace(req, id, "pedidos"))) {
    return await respuestaSinAcceso();
  }

  const usuario = await getAppUser();
  const resultado = await sellarClienteExistente(id, clienteId, usuario?.id ?? null);

  switch (resultado.estado) {
    case "sumado":
      return NextResponse.json({ ok: true, movimientoId: resultado.movimientoId });
    case "no_encontrado":
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    case "inactiva":
      return NextResponse.json({ error: "La tarjeta no está activa." }, { status: 409 });
    default:
      return NextResponse.json(
        { error: "La tarjeta de cliente frecuente no está en tu plan." },
        { status: 403 },
      );
  }
}

/**
 * Deshace el último sello manual dado al cliente.
 *
 * El body lleva `{ movimientoId }` para garantizar que se revierte exactamente
 * el sello que se dio, no cualquier sello reciente. Si el movimiento ya fue
 * anulado o no es un sello manual, devuelve 409.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id, clienteId: _ } = await params;
  if (!(await canManagePlace(req, id, "pedidos"))) {
    return await respuestaSinAcceso();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const movimientoId = typeof b.movimientoId === "string" ? b.movimientoId : "";
  if (!movimientoId) {
    return NextResponse.json({ error: "Falta movimientoId." }, { status: 400 });
  }

  const usuario = await getAppUser();
  const { deshecho } = await deshacerSelloManual(id, movimientoId, usuario?.id ?? null);
  if (!deshecho) {
    return NextResponse.json(
      { error: "El sello ya fue deshecho o no existe." },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
