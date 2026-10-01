import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { canManagePlace } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { S3_BUCKET, s3Client } from "@/lib/storage/s3";
import {
  keyFromUrl,
  uploadErrorResponse,
  uploadImage,
} from "@/lib/storage/upload";

/**
 * El logotipo del negocio: subirlo y borrarlo.
 *
 * Va aparte de `/api/places/[id]/images` por el mismo motivo que la foto del
 * menú: lo de `place_images` es el carrusel de la ficha, se cuenta para el
 * dashboard y el primero es portada. Un logo no es ninguna de esas cosas, y
 * meterlo ahí lo habría enseñado como una foto más.
 *
 * **Aquí no se escribe ninguna fila**: la URL acaba en `places.logo_url` con el
 * PATCH que manda el formulario al guardar. Por eso esta ruta no toca
 * `revalidateTag` —el catálogo cacheado cambia cuando corre ese PATCH, no
 * cuando se sube el archivo— y por eso borrar un objeto sin que nadie guarde la
 * ficha no rompe nada: deja un archivo de más en el bucket, igual que
 * `menu-image`.
 *
 * El archivo llega ya comprimido a WebP por `prepareImage()`, en el navegador.
 * Las comprobaciones —tope de tamaño, tipo real por los bytes— son las de
 * `uploadImage` (`storage/upload.ts`).
 */

type Params = { params: Promise<{ id: string }> };

/** Prefijo propio del logo. `menu-image` no lo toca: cada ruta borra lo suyo. */
function logoPrefix(placeId: string): string {
  return `places/${placeId}/logo/`;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  /* Sube el logo el dueño del negocio o un administrador, igual que las fotos. */
  if (!(await canManagePlace(req, id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  /* El negocio primero: `places/{id}/…` es la clave, y un id inventado subiría
     un objeto a una carpeta que nadie va a leer. */
  const [place] = await db
    .select({ id: places.id })
    .from(places)
    .where(eq(places.id, id))
    .limit(1);
  if (!place) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  /* `FormData` no trae nada más que la imagen aquí, así que se descarta lo que
     devuelve aparte de la URL. */
  const upload = await uploadImage(req, logoPrefix(place.id));
  if (!upload.ok) return uploadErrorResponse(upload);

  return NextResponse.json({ url: upload.url }, { status: 201 });
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
  /* Dos comprobaciones en una: que sea de este bucket y que cuelgue de ESTE
     negocio. Sin el prefijo, cualquiera con permiso sobre un negocio podría
     borrar el logo de otro mandando su URL. */
  if (!key || !key.startsWith(logoPrefix(id))) {
    return NextResponse.json({ error: "Imagen no válida" }, { status: 400 });
  }

  /* Best-effort: la URL sigue en `logo_url` hasta que se guarde el formulario,
     así que un fallo del bucket deja un huérfano y no algo roto. Devolver un 500
     haría que el cliente creyera que el borrado no ocurrió. */
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  } catch (error) {
    console.error(`No se pudo borrar el objeto ${key} del bucket:`, error);
  }

  return NextResponse.json({ url });
}
