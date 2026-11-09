import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { estadoCocinaDeNegocio } from "@/lib/cocina-server";

/**
 * Estado de la cocina para el cliente público.
 *
 * Lo llama la carta antes de abrir el diálogo de pedido, para que el cliente
 * vea el estado actual y no uno cacheado. Es público (sin sesión) porque
 * quien pide no tiene cuenta. El tope es más alto que el de pedidos: solo
 * es una lectura y no deja fila.
 */
export async function GET(req: NextRequest) {
  const limitado = rateLimit(req, 60, 60_000);
  if (!limitado.ok) {
    return NextResponse.json({ error: "Demasiadas peticiones." }, { status: 429 });
  }

  const negocioId = (req.nextUrl.searchParams.get("negocioId") ?? "").trim().slice(0, 64);
  if (!negocioId) {
    return NextResponse.json({ error: "Falta el negocio." }, { status: 400 });
  }

  const estado = await estadoCocinaDeNegocio(negocioId);
  if (!estado) {
    /* Sin fila: se trata como cocina abierta (sin restricciones). */
    return NextResponse.json({ abierta: true, motivo: null, vuelveA: null, texto: "Cocinando ahora" });
  }

  return NextResponse.json({
    abierta: estado.abierta,
    motivo: estado.motivo,
    vuelveA: estado.vuelveA,
    texto: estado.texto,
  });
}
