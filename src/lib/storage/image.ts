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

/**
 * Tipo real a partir de los primeros bytes.
 *
 * El `Content-Type` que manda el navegador lo elige quien sube el archivo, así
 * que no sirve para decidir qué se guarda en un bucket público. Estos tres son
 * los formatos que produce el compresor más el JPEG y el PNG que se cuelan por
 * la vía de respaldo. Devuelve `null` para todo lo demás.
 */
export function sniffImageType(bytes: Uint8Array): "image/webp" | "image/jpeg" | "image/png" | null {
  if (bytes.length < 12) return null;

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

  return null;
}

/** Extensión para la clave del objeto, que se deriva del tipo ya comprobado. */
export const EXTENSION: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};
