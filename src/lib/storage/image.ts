/**
 * Reglas de la imagen que se acepta, compartidas por el servidor.
 *
 * Aquí no hay compresión: eso pasa en el navegador, en `compress.ts`. Este
 * archivo solo mira bytes, así que es puro y se puede comprobar sin levantar
 * nada.
 */

/**
 * Tope del archivo **ya comprimido**. Una foto de móvil a 1600 px y WebP pesa
 * unos 250 KB; 4 MB deja margen para una imagen muy ruidosa sin acercarse al
 * límite de 4,5 MB que imponen las plataformas tipo Vercel, que cortan la
 * petición antes de que llegue a este código.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_GIF_UPLOAD_BYTES = 2 * 1024 * 1024;

/**
 * Tipo real a partir de los primeros bytes.
 *
 * El `Content-Type` que manda el navegador lo elige quien sube el archivo, así
 * que no sirve para decidir qué se guarda en un bucket público. Estos tres son
 * los formatos que produce el compresor más el JPEG y el PNG que se cuelan por
 * la vía de respaldo. Devuelve `null` para todo lo demás.
 */
export type SniffedType =
  | "image/webp"
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/tiff"
  | "image/heic";

/**
 * Los formatos de cámara que el navegador no pinta.
 *
 * El HEIC se intenta convertir en el servidor: si la compilación de `sharp` lo
 * sabe decodificar, queda en WebP; si no, la subida se rechaza con un mensaje
 * que dice qué hacer, nunca guardando el original.
 *
 * El DNG de ProRAW es un TIFF cuyo primer IFD es el mosaico del sensor, no una
 * foto en color, y `sharp` lo lee por la ruta de TIFF porque recibe bytes y no
 * un nombre de archivo. Convertirlo así daría una imagen rota. Por eso el DNG
 * se rechaza con un mensaje claro; ver `uploadImage`.
 */
export const CAMERA_FORMATS: ReadonlySet<SniffedType> = new Set([
  "image/tiff",
  "image/heic",
]);

/** Marcas del contenedor ISO BMFF que son fotos HEIC, no vídeo ni AVIF. */
const HEIC_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
]);

export function sniffImageType(bytes: Uint8Array): SniffedType | null {
  if (bytes.length < 12) return null;

  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }

  /* JPEG: FF D8 FF. PNG: los ocho bytes de cabecera. */
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  /* WebP es un contenedor RIFF: "RIFF" + 4 bytes de tamaño + "WEBP". Los cuatro
     del tamaño se saltan; comprobarlos sería atarse al encoder. */
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  /* TIFF: `II*\0` en little endian o `MM\0*` en big endian. Aquí cae también el
     DNG de ProRAW del iPhone, que es un TIFF con la foto del sensor y una vista
     previa JPEG dentro. */
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
    (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)
  ) {
    return "image/tiff";
  }

  /* HEIC: caja `ftyp` del contenedor ISO BMFF y la marca en los cuatro bytes
     siguientes. El HEIC de iPhone entró aquí por el mismo motivo que el DNG:
     es lo que sale de la cámara y no se puede pedir al usuario que lo cambie
     a mano. */
  if (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70 &&
    HEIC_BRANDS.has(String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!))
  ) {
    return "image/heic";
  }

  return null;
}

/** Extensión para la clave del objeto, que se deriva del tipo ya comprobado. */
export const EXTENSION: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  /* Los dos de cámara no deberían llegar aquí —se convierten a WebP antes de
     guardarse—, pero la clave del objeto no puede salir con «.undefined». */
  "image/tiff": "tif",
  "image/heic": "heic",
};
