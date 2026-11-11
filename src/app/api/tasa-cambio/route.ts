import { NextResponse } from "next/server";
import { CATALOGO } from "@/lib/plans";
import { TASA_CAMBIO_TTL_S, tasaMercadoActual } from "@/lib/tasa-cambio";

/**
 * La tasa USD → CUP con la que se calculan los precios de planes y servicios.
 *
 * Pública y de solo lectura: es información de mercado, no un dato del
 * negocio. La usan el navegador y cualquier integración que quiera el mismo
 * número que se pinta en la web. Si CambioCUP no responde, devuelve la tasa de
 * respaldo con `fuente: "respaldo"` en vez de un error.
 */
export const revalidate = 600;

export async function GET() {
  const mercado = await tasaMercadoActual();

  const cuerpo = mercado
    ? {
        usdCup: mercado.usdCup,
        fuente: "cambiocup" as const,
        actualizadaEn: mercado.actualizadaEn,
        par: "USD/CUP",
      }
    : {
        usdCup: CATALOGO.tasaCup,
        fuente: "respaldo" as const,
        actualizadaEn: null,
        par: "USD/CUP",
      };

  return NextResponse.json(cuerpo, {
    headers: {
      "Cache-Control": `public, s-maxage=${TASA_CAMBIO_TTL_S}, stale-while-revalidate=${TASA_CAMBIO_TTL_S * 2}`,
    },
  });
}
