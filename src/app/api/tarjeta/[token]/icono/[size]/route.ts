import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

import { tarjetaPublica } from "@/lib/fidelidad-server";
import { keyFromUrl } from "@/lib/storage/upload";
import { esTamanoIcono, margenIcono, pngIconoCuadrado } from "@/lib/tarjeta-icono";

/**
 * El icono de pantalla de inicio de una tarjeta, en PNG y desde este dominio.
 *
 * Existe porque ni Safari ni Chrome pueden usar el logo tal como está guardado:
 * es WebP y vive en el bucket. Aquí se sirve cuadrado, opaco y en PNG, que es
 * lo único que aceptan los dos al instalar la tarjeta.
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
const CACHE = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800";
const ESPERA_LOGO_MS = 4000;
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

export async function GET(req: NextRequest, { params }: Params) {
  const { token, size } = await params;

  const lado = Number(size);
  if (!Number.isInteger(lado) || !esTamanoIcono(lado)) {
    return new NextResponse(null, { status: 404 });
  }

  const data = await tarjetaPublica(token.slice(0, 64));
  if (!data) return new NextResponse(null, { status: 404 });

  const maskable = new URL(req.url).searchParams.get("maskable") === "1";

  let png: Buffer | null = null;

  const logo = data.negocio.logoUrl;
  if (logo) {
    const bytes = await leerLogo(logo);
    if (bytes) {
      png = await pngIconoCuadrado(bytes, lado, { margen: margenIcono(maskable) }).catch(
        () => null,
      );
    }
  }

  if (!png) {
    png = await iconoDeReserva(lado, maskable).catch(() => null);
  }
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

/**
 * Baja el logo del bucket.
 *
 * Solo se aceptan URLs del bucket de los negocios (`keyFromUrl`): el valor sale
 * de la base, pero un `logo_url` mal puesto no debe convertir esta ruta en un
 * proxy hacia cualquier host.
 */
async function leerLogo(url: string): Promise<Buffer | null> {
  if (!keyFromUrl(url)) return null;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(ESPERA_LOGO_MS),
    });
    if (!res.ok) return null;

    const tipo = res.headers.get("content-type") ?? "";
    if (!tipo.startsWith("image/")) return null;

    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_LOGO_BYTES) return null;
    return bytes;
  } catch {
    /* Bucket caído, 403 de la red o tiempo agotado: se cae al icono de reserva. */
    return null;
  }
}

/**
 * El icono de La Verde, ya cuadrado.
 *
 * Se lee del disco y no por HTTP: en el contenedor `public/` está al lado del
 * servidor, y pedírselo a nosotros mismos sería una vuelta de red que puede
 * fallar justo cuando esta ruta se usa como respaldo.
 */
async function iconoDeReserva(lado: number, maskable: boolean): Promise<Buffer | null> {
  const original = await readFile(
    path.join(process.cwd(), "public", "icons", "icon-512.png"),
  );
  return pngIconoCuadrado(original, lado, { margen: margenIcono(maskable) });
}
