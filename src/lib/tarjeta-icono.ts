import sharp from "sharp";

/**
 * El icono de pantalla de inicio de una tarjeta de sellos.
 *
 * Los logos se guardan en el bucket como WebP y en otro dominio, y ninguna de
 * las dos cosas sirve para el icono de la app instalada:
 *
 *  - **iOS** solo lo acepta como `<link rel="apple-touch-icon">`, ignora los
 *    `icons` del manifest y no admite WebP ni transparencia. Con el logo del
 *    bucket, el iPhone ponía el icono de La Verde (o un cuadrado negro).
 *  - **Android** lee los `icons` del manifest con CORS, y el bucket público no
 *    manda `Access-Control-Allow-Origin`. Además Chrome prefiere el icono
 *    `maskable`, que hoy era el de La Verde: el logo no llegaba ni a elegirse.
 *
 * Aquí se resuelven las tres cosas a la vez: PNG cuadrado, sin alfa, sobre
 * fondo blanco y con el logo centrado. El fondo no es decorativo —iOS pinta de
 * negro el hueco transparente— y el margen del modo `maskable` mantiene el logo
 * dentro del círculo recortado que aplica Android.
 */

/** Lados que sirve la ruta, elegidos por plataforma. */
export const TAMANOS_ICONO = [180, 192, 512] as const;

export type TamanoIcono = (typeof TAMANOS_ICONO)[number];

/** Fondo del lienzo: el mismo blanco de la caja del logo en la tarjeta. */
const FONDO = { r: 255, g: 255, b: 255 } as const;

/** Margen del icono normal y del `maskable` (que Android recorta en círculo). */
const MARGEN_NORMAL = 0.08;
const MARGEN_MASKABLE = 0.25;

/** Si el segmento de la URL es uno de los lados que sabemos servir. */
export function esTamanoIcono(valor: number): valor is TamanoIcono {
  return (TAMANOS_ICONO as readonly number[]).includes(valor);
}

/**
 * Devuelve un PNG de `lado × lado` con la imagen centrada sobre fondo blanco.
 *
 * `margen` es la fracción de cada lado que queda libre alrededor del contenido:
 * 8 % en el icono normal para que el logo no toque el borde, y 25 % en el
 * `maskable`, que tiene que caber dentro del círculo del 80 % que recorta
 * Android.
 */
export async function pngIconoCuadrado(
  entrada: Uint8Array<ArrayBufferLike>,
  lado: number,
  { margen = MARGEN_NORMAL }: { margen?: number } = {},
): Promise<Buffer> {
  const interior = Math.max(1, Math.round(lado * (1 - margen * 2)));

  /* `contain` respeta la proporción del logo: uno apaisado no se estira, se
     queda con franjas del fondo a los lados. `rotate()` sin argumentos aplica
     la orientación EXIF, que es como vienen muchas fotos de móvil. */
  const marca = await sharp(entrada)
    .rotate()
    .resize(interior, interior, {
      fit: "contain",
      background: { ...FONDO, alpha: 0 },
    })
    .png()
    .toBuffer();

  /* Sin alfa: iOS rellena de negro los píxeles transparentes del
     `apple-touch-icon`, así que el fondo tiene que estar pintado, no vacío.
     Hacen falta las dos cosas: componer encima una imagen con transparencia
     devuelve RGBA aunque el lienzo sea RGB, y `flatten` pinta el fondo pero no
     quita el canal; el que lo quita es `removeAlpha` (comprobado: con solo
     `flatten` el PNG seguía saliendo con 4 canales). */
  return sharp({
    create: { width: lado, height: lado, channels: 3, background: FONDO },
  })
    .composite([{ input: marca, gravity: "center" }])
    .flatten({ background: FONDO })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Margen que toca según el propósito declarado en el manifest. */
export function margenIcono(maskable: boolean): number {
  return maskable ? MARGEN_MASKABLE : MARGEN_NORMAL;
}
