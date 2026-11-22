import { NextRequest, NextResponse } from "next/server";

import { tarjetaPublica } from "@/lib/fidelidad-server";
import { iconoDelNegocio } from "@/lib/icono-pwa";
import { esTamanoIcono } from "@/lib/tarjeta-icono";

/**
 * El icono de pantalla de inicio de una tarjeta, en PNG y desde este dominio.
 *
 * Existe porque ni Safari ni Chrome pueden usar el logo tal como está guardado:
 * es WebP y vive en el bucket. El cuadrado, el fondo opaco y el PNG los resuelve
 * `iconoDelNegocio` (ver `icono-pwa.ts`), que es el mismo para la carta online.
 *
 * `?maskable=1` añade margen para el icono que Android recorta en círculo.
 *
 * Sin logo del negocio, o si el bucket no responde, se sirve el icono de La
 * Verde: un icono roto deja la tarjeta instalada sin nada que tocar.
 */

type Params = { params: Promise<{ token: string; size: string }> };

/* El logo del bucket es inmutable (la clave lleva un id aleatorio), así que el
   PNG se puede cachear. Un día en el navegador: si el negocio cambia el logo,
   el icono instalado no tiene por qué refrescarse al instante. */
const CACHE =
  "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800";

export async function GET(req: NextRequest, { params }: Params) {
  const { token, size } = await params;

  const lado = Number(size);
  if (!Number.isInteger(lado) || !esTamanoIcono(lado)) {
    return new NextResponse(null, { status: 404 });
  }

  const data = await tarjetaPublica(token.slice(0, 64));
  if (!data) return new NextResponse(null, { status: 404 });

  const maskable = new URL(req.url).searchParams.get("maskable") === "1";
  const png = await iconoDelNegocio(data.negocio.logoUrl, lado, { maskable });
  if (!png) return new NextResponse(null, { status: 404 });

  /* `new Uint8Array(...)` y no el `Buffer` tal cual: `BodyInit` acepta vistas
     sobre `ArrayBuffer`, y el buffer de `sharp` está respaldado por memoria
     compartida, que TypeScript no deja pasar. */
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": CACHE,
    },
  });
}
