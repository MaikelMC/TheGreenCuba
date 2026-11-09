import { NextRequest, NextResponse } from "next/server";
import { canManagePlace, respuestaSinAcceso } from "@/lib/admin-server";
import { getAppUser } from "@/lib/auth/user";
import { ajustarSellos } from "@/lib/fidelidad-server";

type Params = { params: Promise<{ id: string; clienteId: string }> };

/**
 * Ajusta sellos a mano (+/-) con nota obligatoria.
 *
 * `ficha`: corregir un saldo o borrar un cliente es de quien configura la
 * tarjeta, no de la dependienta que atiende el mostrador.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id, clienteId } = await params;
  if (!(await canManagePlace(req, id, "ficha"))) {
    return await respuestaSinAcceso();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const cantidad = Number(b.cantidad);
  const nota = typeof b.nota === "string" ? b.nota : "";

  const usuario = await getAppUser();
  const resultado = await ajustarSellos(
    id,
    clienteId,
    cantidad,
    nota,
    usuario?.id ?? null,
  );

  switch (resultado.estado) {
    case "ajustado":
      return NextResponse.json({ ok: true, tarjeta: resultado.tarjeta });
    case "no_encontrado":
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    case "sin_funcion":
      return NextResponse.json(
        { error: "La tarjeta de cliente frecuente no está en tu plan." },
        { status: 403 },
      );
    default:
      return NextResponse.json(
        { error: "Cantidad inválida o falta la nota." },
        { status: 400 },
      );
  }
}
