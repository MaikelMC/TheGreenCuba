import { NextRequest, NextResponse } from "next/server";
import { tarjetaPublica } from "@/lib/fidelidad-server";
import { aTarjetaVista } from "@/lib/tarjeta-vista";

type Params = { params: Promise<{ token: string }> };

/**
 * La tarjeta por token, para refrescarla sin recargar.
 *
 * Devuelve lo mismo que pinta la página, más un resumen plano (`sellos`,
 * `meta`, `premio`) que usa la píldora de la carta. Nunca por teléfono: solo
 * por el token largo y aleatorio del enlace. Sin `Cache-Control` propio, un
 * proxy podría servir el saldo de otra persona.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  const data = await tarjetaPublica(token.slice(0, 64));
  if (!data) {
    return NextResponse.json(
      { error: "Tarjeta no encontrada" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const vista = aTarjetaVista(data);
  const meta = data.tarjeta.siguiente ?? data.tarjeta.metaFinal;

  return NextResponse.json(
    {
      ...vista,
      sellos: data.tarjeta.sellos,
      meta: meta.sellos,
      premio: data.tarjeta.listas[0]?.premio ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
