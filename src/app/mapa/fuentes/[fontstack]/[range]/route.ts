/**
 * Sirve archivos PBF de fuentes del mapa.
 *
 * MapLibre hace peticiones con pilas combinadas (ej.
 * `Noto%20Sans%20Regular%2CNoto%20Sans%20Bold`). Los archivos estáticos de
 * `public/mapa/fuentes/` cubren fuentes individuales, que Next.js sirve
 * directamente sin pasar por aquí. Este handler solo entra cuando no existe
 * un archivo estático —es decir, cuando el fontstack lleva coma— y devuelve
 * el primer archivo disponible de la lista.
 *
 * Para texto latino (Cuba), Noto Sans Regular cubre el 100 % de los glifos
 * necesarios, así que "primera fuente disponible" es equivalente a la unión.
 */

import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fontstack: string; range: string }> },
) {
  const { fontstack, range } = await params;

  /* El fontstack llega ya decodificado por Next (p.ej. "Noto Sans Regular,Noto Sans Bold").
     Probamos cada fuente por orden hasta encontrar una que exista. */
  const fonts = fontstack.split(",").map((f) => f.trim());

  for (const font of fonts) {
    try {
      const filePath = path.join(process.cwd(), "public", "mapa", "fuentes", font, range);
      const data = await readFile(filePath);
      return new NextResponse(data, {
        headers: {
          "Content-Type": "application/x-protobuf",
          "Cache-Control": "public, max-age=604800, immutable",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch {
      /* Fuente no encontrada localmente: intentamos la siguiente. */
    }
  }

  return new NextResponse(null, { status: 404 });
}
