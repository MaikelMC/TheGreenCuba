import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { S3_BUCKET, S3_PUBLIC_URL, s3Client, s3ConfigProblem } from "./s3";
import { EXTENSION, MAX_UPLOAD_BYTES, sniffImageType } from "./image";
import { generateId } from "@/lib/utils";

/**
 * La subida a bucket, en un solo sitio.
 *
 * Esto vivía dos veces —en `/api/places/[id]/images` y en
 * `/api/places/[id]/menu-image`— con el mismo cuerpo palabra por palabra y lo
 * único distinto en la clave del objeto. Duplicado, el tope de tamaño y la
 * comprobación de tipo son justo lo que no se puede permitir: apretar
 * `MAX_UPLOAD_BYTES` en una ruta dejaba la otra abierta, y no había forma de
 * mirar una y saber qué acepta la aplicación.
 *
 * Lo que **no** entra aquí es la autorización. Cada ruta comprueba a quién deja
 * subir —y a qué negocio— antes de llamar, porque esa decisión sí es suya:
 * `canManagePlace` necesita el id de la ruta y el `req`, y quien lea esto tiene
 * que verlo antes de la subida, no escondido detrás.
 *
 * El archivo llega ya comprimido a WebP desde el navegador, en `prepareImage()`.
 * Aquí no se recomprime: se comprueba y se guarda.
 */

export type UploadResult =
  | { ok: true; url: string; form: FormData }
  | { ok: false; error: string; status: number };

/** URL pública de un objeto del bucket, la que acaba guardada en la base. */
export function publicUrl(key: string): string {
  return `${S3_PUBLIC_URL}/${key}`;
}

/** Clave del objeto a partir de su URL pública. `null` si no es de este bucket. */
export function keyFromUrl(url: string): string | null {
  if (!S3_PUBLIC_URL || !url.startsWith(`${S3_PUBLIC_URL}/`)) return null;
  return url.slice(S3_PUBLIC_URL.length + 1);
}

/**
 * Sube la imagen que venga en el `FormData` bajo `prefix` y devuelve su URL.
 *
 * Devuelve también el `FormData` ya leído, y no es un extra: el cuerpo solo se
 * puede consumir una vez, así que quien necesite otros campos —el `alt`, el
 * ancho y el alto de las fotos del lugar— no puede volver a pedirlo. Se lo
 * queda quien llama en vez de que esta función sepa de fotos de negocio.
 *
 * Las comprobaciones van en este orden a propósito: primero la configuración,
 * que no depende de la petición; después el cuerpo; y solo al final el bucket.
 * Un endpoint o unas claves a medio poner no dan un error de configuración, dan
 * un `ENOTFOUND` o un 403 opaco, y el sitio donde se busca eso no es donde está
 * el problema — así que se descarta antes de gastar nada.
 *
 * El tipo sale de los bytes y no del `Content-Type` que manda el navegador, que
 * lo elige quien sube el archivo y no sirve para decidir qué se guarda en un
 * bucket público.
 */
export async function uploadImage(
  req: NextRequest,
  prefix: string,
): Promise<UploadResult> {
  const configProblem = s3ConfigProblem();
  if (configProblem) return { ok: false, error: configProblem, status: 500 };

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return { ok: false, error: "Cuerpo inválido", status: 400 };
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Falta la imagen", status: 400 };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "La imagen es demasiado grande.", status: 413 };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  const contentType = sniffImageType(bytes);
  if (!contentType) {
    return {
      ok: false,
      error: "El archivo no es una imagen JPEG, PNG o WebP.",
      status: 415,
    };
  }

  /* La clave lleva un id aleatorio y nunca se reescribe, así que el objeto es
     inmutable: el navegador no tiene por qué volver a pedirlo, y cambiar una
     foto nunca sirve la vieja aunque la anterior siga en alguna caché. */
  const key = `${prefix}${generateId()}.${EXTENSION[contentType]}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return { ok: true, url: publicUrl(key), form };
}

/** La respuesta de error, para no repetir el `NextResponse.json` en cada ruta. */
export function uploadErrorResponse(result: {
  error: string;
  status: number;
}) {
  return NextResponse.json({ error: result.error }, { status: result.status });
}
