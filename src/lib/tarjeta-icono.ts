import sharp from "sharp";

/**
 * El icono de pantalla de inicio de una tarjeta de sellos.
 *
 * Los logos se guardan como WebP en el bucket y en otro dominio, y ninguna de
 * las dos cosas sirve para el icono de la app instalada:
 *
 *  - **iOS** solo lo acepta como `<link rel=\"apple-touch-icon\">`, ignora los
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

/** Margen del icono normal y del `maskable` (que Android recorta en círculo).
 *
 *  El normal no lleva margen: el logo se recorta a su caja real (transparente)
 *  y se escala a todo el lado, para que no quede fondo blanco vacío. El
 *  `maskable` mantiene el margen mínimo que exige el círculo del 80 % de
 *  Android (≈17 % por lado): con menos, el logo se corta en la pantalla de
 *  inicio. */
const MARGEN_NORMAL = 0;
const MARGEN_MASKABLE = 0.17;

/** Umbral de alfa para considerar un píxel parte del dibujo. */
const ALPHA_UMBRAL = 8;

/** Si el segmento de la URL es uno de los lados que sabemos servir. */
export function esTamanoIcono(valor: number): valor is TamanoIcono {
  return (TAMANOS_ICONO as readonly number[]).includes(valor);
}

/**
 * Recorta la imagen a su caja real (píxeles con alfa sobre el umbral), para
 * que el logo llene el icono en vez de nadar en su propio padding
 * transparente. Si no hay píxeles visibles, o algo falla, se devuelve null y
 * se usa la imagen tal cual.
 */
async function cajaReal(entrada: Uint8Array<ArrayBufferLike>): Promise<{
  left: number;
  top: number;
  width: number;
  height: number;
} | null> {
  try {
    const { data, info } = await sharp(entrada)
      .rotate()
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let minX = info.width;
    let minY = info.height;
    let maxX = -1;
    let maxY = -1;
    const canales = info.channels;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        if (data[(y * info.width + x) * canales + (canales - 1)]! > ALPHA_UMBRAL) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  } catch {
    return null;
  }
}

/**
 * Devuelve un PNG de `lado × lado` con el logo centrado sobre fondo blanco.
 *
 * Antes de escalar se recorta el logo a su caja real (transparente), para que
 * ocupe el icono completo en vez de dejar fondo blanco vacío. `margen` deja
 * libre esa fracción de cada lado (0 en el normal, ≈17 % en el `maskable`).
 */
export async function pngIconoCuadrado(
  entrada: Uint8Array<ArrayBufferLike>,
  lado: number,
  { margen = MARGEN_NORMAL }: { margen?: number } = {},
): Promise<Buffer> {
  const interior = Math.max(1, Math.round(lado * (1 - margen * 2)));

  const caja = await cajaReal(entrada);

  /* `contain` respeta la proporción del logo: uno apaisado no se estira, se
     queda con franjas del fondo a los lados. `rotate()` sin argumentos aplica
     la orientación EXIF, que es como vienen muchas fotos de móvil. */
  let pipeline = sharp(entrada).rotate();
  if (caja) {
    pipeline = pipeline.extract(caja);
  }
  const marca = await pipeline
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
