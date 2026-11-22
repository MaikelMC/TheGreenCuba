import { readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { keyFromUrl } from "@/lib/storage/upload";
import { margenIcono, pngIconoCuadrado } from "@/lib/tarjeta-icono";

/**
 * El icono de pantalla de inicio de una página pública sobre un negocio.
 *
 * Lo comparten la tarjeta de sellos (`/api/tarjeta/{token}/icono`) y la carta
 * online (`/api/menu/{slug}/icono`): las dos parten del logo guardado y las dos
 * tienen que resolver lo mismo —PNG cuadrado, opaco y desde este dominio— por
 * las razones que cuenta `tarjeta-icono.ts`.
 *
 * Lo único propio de la carta es la **insignia**: un disco con tres líneas en
 * la esquina, para que el icono del menú no se confunda con el de la tarjeta
 * del mismo negocio cuando el cliente tiene los dos en la pantalla de inicio.
 * Va dibujada aquí y no en el logo guardado: el bucket no se toca y el día que
 * el negocio cambie su logo la insignia sigue puesta.
 */

/** Espera máxima al bucket: sin logo a tiempo, se usa el icono de reserva. */
const ESPERA_LOGO_MS = 4000;

/** Tope de peso del logo descargado, en bytes. */
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

/** Verde más oscuro de la marca (`verde-950`): el disco de la insignia. */
const TINTA = "#052017";

/** Blanco del lienzo. Es también el aro que separa la insignia del logo. */
const BLANCO = "#FFFFFF";

export type InsigniaIcono = "menu";

/**
 * Devuelve el PNG del icono, o `null` si no hay ni logo ni icono de reserva.
 *
 * `maskable` pide el margen que Android recorta en círculo —lo que afecta al
 * logo y a dónde puede vivir la insignia— y `insignia` superpone la marca que
 * distingue esta instalación de las demás. La insignia nunca es motivo para no
 * devolver un icono: si el dibujo falla, se sirve el logo solo.
 */
export async function iconoDelNegocio(
  logoUrl: string | null | undefined,
  lado: number,
  {
    maskable = false,
    insignia,
  }: { maskable?: boolean; insignia?: InsigniaIcono } = {},
): Promise<Buffer | null> {
  let png: Buffer | null = null;

  if (logoUrl) {
    const bytes = await leerLogoDelBucket(logoUrl);
    if (bytes) {
      png = await pngIconoCuadrado(bytes, lado, {
        margen: margenIcono(maskable),
      }).catch(() => null);
    }
  }

  /* Sin logo del negocio, o si el bucket no responde, el icono de La Verde:
     un icono roto deja la app instalada sin nada que tocar. */
  if (!png) png = await iconoDeReserva(lado, maskable).catch(() => null);
  if (!png || !insignia) return png;

  return marcarIcono(png, lado, insignia, maskable).catch(() => png);
}

/**
 * Baja el logo del bucket.
 *
 * Solo se aceptan URLs del bucket de los negocios (`keyFromUrl`): el valor sale
 * de la base, pero un `logo_url` mal puesto no debe convertir esta ruta en un
 * proxy hacia cualquier host.
 */
async function leerLogoDelBucket(url: string): Promise<Buffer | null> {
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
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_LOGO_BYTES)
      return null;
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
async function iconoDeReserva(
  lado: number,
  maskable: boolean,
): Promise<Buffer | null> {
  const original = await readFile(
    path.join(process.cwd(), "public", "icons", "icon-512.png"),
  );
  return pngIconoCuadrado(original, lado, { margen: margenIcono(maskable) });
}

/** Pinta la insignia sobre el PNG ya cuadrado. */
async function marcarIcono(
  png: Buffer,
  lado: number,
  insignia: InsigniaIcono,
  maskable: boolean,
): Promise<Buffer> {
  const svg = insignia === "menu" ? insigniaMenuSvg(lado, maskable) : null;
  if (!svg) return png;

  return (
    sharp(png)
      .composite([{ input: svg, top: 0, left: 0 }])
      /* Sin alfa: iOS rellena de negro los píxeles transparentes del
       `apple-touch-icon`. El fondo del SVG es transparente, así que se aplana
       sobre blanco y se quita el canal. */
      .flatten({ background: BLANCO })
      .removeAlpha()
      .png({ compressionLevel: 9 })
      .toBuffer()
  );
}

/**
 * El SVG de la insignia de la carta: un disco verde con tres líneas blancas.
 *
 * Se dibuja con geometría y no con texto a propósito: las dos plataformas
 * rasterizan el SVG con fuentes distintas (o sin ellas), y un «MENÚ» escrito
 * saldría distinto en cada servidor. Tres barras se leen como menú a cualquier
 * tamaño y no dependen de ninguna tipografía.
 *
 * Dónde va depende del propósito. El icono normal la lleva en la esquina
 * inferior derecha, dentro del recorte redondeado de iOS. El `maskable` la baja
 * al centro: Android recorta un círculo del 80 % y una insignia en la esquina
 * desaparecería al instalar.
 */
export function insigniaMenuSvg(lado: number, maskable: boolean): Buffer {
  const diametro = Math.max(8, Math.round(lado * (maskable ? 0.26 : 0.32)));
  const radio = diametro / 2;
  /* El aro blanco no es decoración: separa el disco del logo cuando el logo es
     oscuro o viene a sangre. */
  const aro = Math.max(2, Math.round(diametro * 0.085));

  let cx: number;
  let cy: number;
  if (maskable) {
    /* Dentro del círculo seguro de Android (80 % del lado), con un respiro. */
    const seguro = lado * 0.4;
    cx = lado / 2;
    cy = lado / 2 + seguro - radio - aro / 2 - lado * 0.02;
  } else {
    const margen = Math.round(lado * 0.075);
    cx = lado - margen - radio;
    cy = lado - margen - radio;
  }

  const barraAlto = Math.max(2, Math.round(diametro * 0.085));
  const barraAncho = Math.round(diametro * 0.46);
  const hueco = Math.round(diametro * 0.1);
  const bloque = barraAlto * 3 + hueco * 2;
  const primeraY = cy - bloque / 2;
  const rx = barraAlto / 2;

  const barras = [0, 1, 2]
    .map(
      (i) =>
        `<rect x="${round(cx - barraAncho / 2)}" y="${round(
          primeraY + i * (barraAlto + hueco),
        )}" width="${barraAncho}" height="${barraAlto}" rx="${round(rx)}" fill="${BLANCO}"/>`,
    )
    .join("");

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">` +
      `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(radio + aro / 2)}" fill="${BLANCO}"/>` +
      `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(radio)}" fill="${TINTA}"/>` +
      barras +
      `</svg>`,
  );
}

/** Cadena con dos decimales como mucho: SVG no necesita más y se lee mejor. */
function round(valor: number): number {
  return Math.round(valor * 100) / 100;
}
