import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { canManagePlace, respuestaSinAcceso } from "@/lib/admin-server";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { pedidos } from "@/lib/db/schema";
import { tieneFuncion } from "@/lib/plans-server";
import {
  alCompletarPedido,
  configFidelidadDe,
  sellarAMano,
} from "@/lib/fidelidad-server";

type Params = { params: Promise<{ id: string }> };

/**
 * Dar un sello a mano.
 *
 * Dos caminos, como en el mostrador: el teléfono (el cliente está delante) o
 * el código del pedido (el pedido se guardó, pero se marcó entregado sin la
 * tarjeta a mano). Con código se pasa por `alCompletarPedido`, el mismo punto
 * que la transición de estado, así que no puede sumar dos veces.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  if (!(await canManagePlace(req, id, "pedidos"))) {
    return await respuestaSinAcceso();
  }
  if (!(await tieneFuncion(id, "cliente_frecuente"))) {
    return NextResponse.json(
      { error: "La tarjeta de cliente frecuente no está en tu plan." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const codigo =
    typeof b.codigo === "string"
      ? b.codigo.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)
      : "";
  const telefono = typeof b.telefono === "string" ? b.telefono.trim() : "";
  const nota = typeof b.nota === "string" ? b.nota.trim().slice(0, 300) : null;

  if (!codigo && !telefono) {
    return NextResponse.json(
      { error: "Dime un teléfono o el código del pedido." },
      { status: 400 },
    );
  }

  const usuario = await getAppUser();

  if (codigo) {
    const [pedido] = await db
      .select({ id: pedidos.id })
      .from(pedidos)
      .where(and(eq(pedidos.placeId, id), eq(pedidos.codigo, codigo)))
      .limit(1);

    if (!pedido) {
      return NextResponse.json(
        { error: "No hay ningún pedido con ese código." },
        { status: 404 },
      );
    }

    const resultado = await alCompletarPedido(id, pedido.id, usuario?.id ?? null);
    return NextResponse.json({ resultado }, { status: 200 });
  }

  const config = await configFidelidadDe(id);
  if (!config?.activo) {
    return NextResponse.json(
      { error: "La tarjeta no está activa." },
      { status: 409 },
    );
  }

  const resultado = await sellarAMano(id, telefono, usuario?.id ?? null, nota);
  if (resultado.estado === "telefono_invalido") {
    return NextResponse.json(
      { error: "Ese teléfono no es un número cubano de 8 dígitos." },
      { status: 400 },
    );
  }
  return NextResponse.json({ resultado });
}
