"use client";

import { EXTENSION, MAX_GIF_UPLOAD_BYTES } from "./image";

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
const PROJECT_MAX_EDGE = 2400;

/* WebP a 0,82 es el punto donde el ojo deja de notar la diferencia en foto y
   el archivo sigue bajando. Subirlo llena el bucket de bytes invisibles. */
const QUALITY = 0.82;
const PROJECT_QUALITY = 0.9;

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

/**
 * Codifica el lienzo en el formato con pérdida más ligero que el navegador sepa
 * escribir.
 *
 * El `type` que se pide **no es una promesa**. Quien no sabe codificar WebP
 * —Safari— no falla al pedirlo: devuelve PNG, y el PNG sin pérdida pesa varias
 * veces más. Así llegó al bucket un flyer de 1168×784 con 871 KB: el lienzo
 * había corrido, pero lo que salió era PNG. Por eso se mira lo que devolvió de
 * verdad y, si no es WebP, se pide JPEG, que sí saben escribir todos.
 */
async function encode(canvas: OffscreenCanvas, quality: number): Promise<Blob> {
  const webp = await canvas.convertToBlob({ type: "image/webp", quality });
  if (webp.type === "image/webp") return webp;

  /* El JPEG no tiene transparencia y lo transparente saldría negro. Se pinta
     blanco **por debajo** de lo ya dibujado (`destination-over`), que es como
     acaba viéndose el flyer en Facebook. */
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return canvas.convertToBlob({ type: "image/jpeg", quality });
}

/** Decodifica, reescala y recomprime. Lanza si el navegador no sabe leerlo. */
async function reencode(
  file: File,
  maxEdge = MAX_EDGE,
  quality = QUALITY,
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  try {
    /* Solo se reduce, nunca se amplía: una foto pequeña subida de tamaño pesaría
       más y se vería peor. */
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("El navegador no dio contexto 2D");

    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await encode(canvas, quality);
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
export async function prepareImage(
  file: File,
  options: { maxEdge?: number; quality?: number } = {},
): Promise<PreparedImage> {
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error(
      `«${file.name}» pesa ${megabytes(file.size)} y el máximo son ${megabytes(MAX_INPUT_BYTES)}.`,
    );
  }

  try {
    const { blob, width, height } = await reencode(
      file,
      options.maxEdge,
      options.quality,
    );
    /* La extensión sale del blob que se devolvió y no del que se pidió: donde
       no hay WebP, el archivo es JPEG. El servidor decide igual por los bytes
       mágicos, así que esto es solo el nombre que ve quien lo sube. */
    return {
      blob,
      width,
      height,
      name: `${baseName(file.name)}.${EXTENSION[blob.type] ?? "jpg"}`,
    };
  } catch {
    return { blob: file, width: null, height: null, name: file.name };
  }
}

/** Preserves short project GIFs as animations while compressing regular photos. */
export async function prepareProjectImage(file: File): Promise<PreparedImage> {
  if (file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif")) {
    if (file.size > MAX_GIF_UPLOAD_BYTES) {
      throw new Error(`Los GIF deben pesar como máximo ${megabytes(MAX_GIF_UPLOAD_BYTES)}.`);
    }
    return { blob: file, width: null, height: null, name: file.name };
  }

  return prepareImage(file, { maxEdge: PROJECT_MAX_EDGE, quality: PROJECT_QUALITY });
}
