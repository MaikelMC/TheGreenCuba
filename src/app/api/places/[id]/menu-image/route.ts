import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { canManagePlace } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { S3_BUCKET, S3_PUBLIC_URL, s3Client, s3ConfigProblem } from "@/lib/storage/s3";
import { EXTENSION, MAX_UPLOAD_BYTES, sniffImageType } from "@/lib/storage/image";
import { generateId } from "@/lib/utils";

/**
 * La foto de un producto de «Lo que ofrece»: subirla y borrarla.
 *
 * Va aparte de `/api/places/[id]/images` y no a ese bucket por la misma
 * clave: las fotos de `place_images` son las del carrusel de la ficha, se
 * cuentan para el dashboard y la primera es portada. Un plato del menú no es
 * ninguna de esas cosas, y meterlo ahí lo habría enseñado en el carrusel.
 *
 * Aquí **no se escribe ninguna fila**: la URL acaba dentro del jsonb `places.menu`
 * en el PATCH que manda el formulario al guardar. Por eso esta ruta no toca
 * `revalidateTag` — el catálogo cacheado cambia cuando ese PATCH se ejecuta,
 * no cuando se sube el archivo — y por eso borrar un objeto sin que nadie
 * guarde la ficha no deja nada roto: solo un archivo de más en el bucket.
 *
 * El archivo llega ya comprimido a WebP por `prepareImage()`, en el navegador,
 * igual que las fotos del lugar.
 */

type Params = { params: Promise<{ id: string }> };

/** Prefijo propio de las fotos del menú. Todo lo que no lo lleve, no se toca. */
function menuPrefix(placeId: string): string {
  return `places/${placeId}/menu/`;
}

function publicUrl(key: string): string {
  return `${S3_PUBLIC_URL}/${key}`;
}

/** Clave del objeto a partir de su URL pública. `null` si no es de este bucket. */
function keyFromUrl(url: string): string | null {
  if (!S3_PUBLIC_URL || !url.startsWith(`${S3_PUBLIC_URL}/`)) return null;
  return url.slice(S3_PUBLIC_URL.length + 1);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  /* Mismo permiso que el resto del negocio: el dueño concreto o un admin. */
  if (!(await canManagePlace(req, id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  /* El negocio primero: `places/{id}/…` es la clave, y un id inventado
     subiría un objeto a una carpeta que nadie va a leer. */
  const [place] = await db
    .select({ id: places.id })
    .from(places)
    .where(eq(places.id, id))
    .limit(1);
  if (!place) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  /* Antes de tocar el bucket: un endpoint o unas claves a medio poner dan un
     fallo de red que no dice dónde está el problema. */
  const configProblem = s3ConfigProblem();
  if (configProblem) {
    return NextResponse.json({ error: configProblem }, { status: 500 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Falta la imagen" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "La imagen es demasiado grande." }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  /* El tipo sale de los bytes y no de lo que diga el navegador. */
  const contentType = sniffImageType(bytes);
  if (!contentType) {
    return NextResponse.json(
      { error: "El archivo no es una imagen JPEG, PNG o WebP." },
      { status: 415 },
    );
  }

  /* Id aleatorio y sin reutilizar: el objeto es inmutable, así que la URL se
     puede cachear para siempre y cambiar de foto nunca sirve la vieja. */
  const key = `${menuPrefix(place.id)}${generateId()}.${EXTENSION[contentType]}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return NextResponse.json({ url: publicUrl(key) }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;

  if (!(await canManagePlace(req, id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url).searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Falta `url`" }, { status: 400 });
  }

  const key = keyFromUrl(url);
  /* Dos comprobaciones en una y en el servidor: que sea de este bucket y que
     cuelgue de ESTE negocio. Sin el prefijo, un dueño mandando la URL de la
     foto de otro podría borrarla. */
  if (!key || !key.startsWith(menuPrefix(id))) {
    return NextResponse.json({ error: "Imagen no válida" }, { status: 400 });
  }

  /* Best-effort, igual que en las fotos del lugar: la fila no existe, así que
     un fallo del bucket deja un archivo huérfano y no algo roto. Devolver un
     500 haría que el cliente creyera que el borrado no ocurrió. */
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  } catch (error) {
    console.error(`No se pudo borrar el objeto ${key} del bucket:`, error);
  }

  return NextResponse.json({ url });
}
