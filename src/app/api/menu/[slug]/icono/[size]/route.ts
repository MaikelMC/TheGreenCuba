import { NextRequest, NextResponse } from "next/server";

import { getPlaceBrandBySlug } from "@/lib/db/queries";
import { iconoDelNegocio } from "@/lib/icono-pwa";
import { esTamanoIcono } from "@/lib/tarjeta-icono";

/**
 * El icono de pantalla de inicio de la carta online, en PNG y desde este dominio.
 *
 * Es el logo del negocio con la insignia de menú, y sale de `iconoDelNegocio`
 * (ver `icono-pwa.ts`): la misma ruta que resuelve el icono de la tarjeta de
 * sellos, pero con la marca que distingue las dos instalaciones.
 *
 * `?maskable=1` usa el modo de Android: margen para el recorte circular y la
 * insignia dentro de la zona segura.
 *
 * Sin logo del negocio, o si el bucket no responde, se sirve el icono de La
 * Verde con la misma insignia: un icono roto deja la carta instalada sin nada
 * que tocar.
 */

type Params = { params: Promise<{ slug: string; size: string }> };

/* Un día en el navegador. El logo del bucket es inmutable (la clave lleva un id
   aleatorio), así que el PNG se puede cachear: si el negocio cambia el logo, el
   icono instalado no tiene por qué refrescarse al instante. */
const CACHE =
  "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800";

export async function GET(req: NextRequest, { params }: Params) {
  const { slug, size } = await params;

  const lado = Number(size);
  if (!Number.isInteger(lado) || !esTamanoIcono(lado)) {
    return new NextResponse(null, { status: 404 });
  }

  const negocio = await getPlaceBrandBySlug(slug.slice(0, 120));
  if (!negocio) return new NextResponse(null, { status: 404 });

  const maskable = new URL(req.url).searchParams.get("maskable") === "1";
  const png = await iconoDelNegocio(negocio.logoUrl, lado, {
    maskable,
    insignia: "menu",
  });
  if (!png) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": CACHE,
    },
  });
}
