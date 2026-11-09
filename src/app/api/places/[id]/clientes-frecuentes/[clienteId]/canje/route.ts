import { NextRequest, NextResponse } from "next/server";
import { canManagePlace, respuestaSinAcceso } from "@/lib/admin-server";
import { getAppUser } from "@/lib/auth/user";
import { canjearMeta } from "@/lib/fidelidad-server";

type Params = { params: Promise<{ id: string; clienteId: string }> };

/**
 * Canjea una meta de la tarjeta.
 *
 * `pedidos`, como marcar entregado: es lo que hace la dependienta cuando el
 * cliente viene a buscar el premio. El servidor decide si la meta está
 * alcanzada y si ya se canjeó en este ciclo.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id, clienteId } = await params;
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
  const metaIndice = Number(b.metaIndice);
  if (!Number.isInteger(metaIndice) || metaIndice < 0 || metaIndice > 3) {
    return NextResponse.json({ error: "Meta inválida." }, { status: 400 });
  }

  const usuario = await getAppUser();
  const resultado = await canjearMeta(id, clienteId, metaIndice, usuario?.id ?? null);

  switch (resultado.estado) {
    case "canjeado":
      return NextResponse.json({ ok: true, ...resultado });
    case "no_encontrado":
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    case "sin_funcion":
      return NextResponse.json(
        { error: "La tarjeta de cliente frecuente no está en tu plan." },
        { status: 403 },
      );
    default:
      return NextResponse.json(
        { error: "Ese premio no está disponible en este ciclo." },
        { status: 409 },
      );
  }
}
