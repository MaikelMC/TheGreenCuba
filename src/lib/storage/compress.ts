"use client";

/**
 * Compresión de la imagen en el navegador, antes de subirla.
 *
 * Va aquí y no en el servidor por dos motivos. El archivo que viaja ya es
 * pequeño —una foto de móvil de 4 MB baja a unos 250 KB—, así que se ahorra
 * almacenamiento y ancho de banda a la vez. Y en el servidor haría falta
 * `sharp`, un binario nativo que este proyecto no tiene instalado.
 *
 * `createImageBitmap` y `OffscreenCanvas` son nativos del navegador: no entra
 * ninguna dependencia nueva.
 */

/** Tope del archivo que entra. Una foto de móvil ronda 3-5 MB. */
export const MAX_INPUT_BYTES = 12 * 1024 * 1024;

/* Lado mayor. 1600 px cubre la portada a 2x en las pantallas del sitio y deja
   margen para el recorte a 16/9 del carrusel. */
const MAX_EDGE = 1600;

/* WebP a 0,82 es el punto donde el ojo deja de notar la diferencia en foto y
   el archivo sigue bajando. Subirlo llena el bucket de bytes invisibles. */
const QUALITY = 0.82;

export interface PreparedImage {
  blob: Blob;
  /** `null` cuando no se pudo decodificar y se sube el original tal cual. */
  width: number | null;
  height: number | null;
  name: string;
}

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function baseName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

/** Decodifica, reescala y recomprime a WebP. Lanza si el navegador no sabe leerlo. */
async function toWebp(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  try {
    /* Solo se reduce, nunca se amplía: una foto pequeña subida de tamaño pesaría
       más y se vería peor. */
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("El navegador no dio contexto 2D");

    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvas.convertToBlob({ type: "image/webp", quality: QUALITY });
    return { blob, width, height };
  } finally {
    bitmap.close();
  }
}

/**
 * Deja un archivo listo para subir. Nunca lanza por un formato raro: si el
 * navegador no sabe decodificarlo —lo típico con un HEIC de iPhone abierto en
 * Chrome— devuelve el original y que lo juzgue el servidor, que mira los bytes
 * mágicos de todas formas.
 *
 * Sí lanza si el archivo pasa del tope, porque eso no hay forma de arreglarlo
 * más abajo y el usuario tiene que enterarse.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error(
      `«${file.name}» pesa ${megabytes(file.size)} y el máximo son ${megabytes(MAX_INPUT_BYTES)}.`,
    );
  }

  try {
    const { blob, width, height } = await toWebp(file);
    return { blob, width, height, name: `${baseName(file.name)}.webp` };
  } catch {
    return { blob: file, width: null, height: null, name: file.name };
  }
}
