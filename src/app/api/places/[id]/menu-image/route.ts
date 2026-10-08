import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { canManagePlace } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { limite } from "@/lib/plans-server";
import { S3_BUCKET, s3Client } from "@/lib/storage/s3";
import {
  keyFromUrl,
  uploadErrorResponse,
  uploadImage,
} from "@/lib/storage/upload";

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
 * igual que las fotos del lugar. Las comprobaciones —tope de tamaño, tipo real
 * por los bytes— son las de `uploadImage` (`storage/upload.ts`), compartidas
 * con las del carrusel.
 */

type Params = { params: Promise<{ id: string }> };

/** Prefijo propio de las fotos del menú. Todo lo que no lo lleve, no se toca. */
function menuPrefix(placeId: string): string {
  return `places/${placeId}/menu/`;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  /* Mismo permiso que el resto del negocio: el dueño concreto o un admin. */
  if (!(await canManagePlace(req, id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  /* El negocio primero: `places/{id}/…` es la clave, y un id inventado
     subiría un objeto a una carpeta que nadie va a leer. Se trae también la
     carta, que es donde viven las URLs: esta tabla no tiene filas, así que
     contar las fotos de producto es contar los platos que llevan una. */
  const [place] = await db
    .select({ id: places.id, menu: places.menu })
    .from(places)
    .where(eq(places.id, id))
    .limit(1);
  if (!place) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  /* El tope de fotos de producto, antes de gastar una subida al bucket. Solo
     corta las nuevas: las que ya están siguen ahí aunque el plan haya bajado. */
  const tope = await limite(id, "fotos_productos_max");
  if (tope !== null) {
    const conFoto = (place.menu ?? []).filter((item) => item.image).length;
    if (conFoto >= tope) {
      return NextResponse.json(
        {
          error: `Tu plan permite hasta ${tope} fotos de producto. Mejora tu plan para subir más.`,
        },
        { status: 400 },
      );
    }
  }

  /* De la configuración al bucket, en una llamada. El `FormData` no trae nada
     más que la imagen aquí, así que se descarta lo que devuelve. `optimize`
     garantiza el tope de ≤150 KB en el servidor: la compresión del navegador
     puede fallar (un formato que no sabe decodificar) y la foto del producto no
     puede llegar al bucket sin comprimir. */
  const upload = await uploadImage(req, menuPrefix(place.id), { optimize: true });
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
