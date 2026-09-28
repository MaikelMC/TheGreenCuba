import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { and, asc, eq } from "drizzle-orm";
import { canManagePlace } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { CATALOG_TAG } from "@/lib/db/queries";
import { placeImages, places } from "@/lib/db/schema";
import { S3_BUCKET, s3Client } from "@/lib/storage/s3";
import { keyFromUrl, uploadErrorResponse, uploadImage } from "@/lib/storage/upload";
import { generateId } from "@/lib/utils";

/**
 * Fotos de un negocio: listar, subir y borrar.
 *
 * La subida pasa por aquí, no por una URL firmada que el navegador use para
 * hablar con el bucket directo. No es solo comodidad: el CSP del sitio lleva
 * `connect-src 'self'`, así que una subida desde el navegador la bloquearía en
 * producción con un error que no menciona el CSP por ninguna parte. Además
 * haría falta `@aws-sdk/s3-request-presigner`, que no está instalado.
 *
 * El archivo que llega ya viene comprimido a WebP por `prepareImage()`, en el
 * navegador. Aquí no se recomprime nada: se comprueba y se guarda. Las
 * comprobaciones son las de `uploadImage` (`storage/upload.ts`), compartidas
 * con las fotos del menú.
 */

type Params = { params: Promise<{ id: string }> };

interface ClientImage {
  id: string;
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  isCover: boolean;
}

function toClientImage(row: typeof placeImages.$inferSelect): ClientImage {
  return {
    id: row.id,
    url: row.url,
    alt: row.alt,
    width: row.width,
    height: row.height,
    isCover: row.isCover,
  };
}

/** Entero positivo o `null`. Los dos vienen del navegador y son solo la
    proporción con la que reservar el hueco antes de que cargue la imagen. */
function optionalInt(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= 20000 ? n : null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  /* Sin comprobar sesión: las fotos de un negocio se ven en su ficha pública,
     que es lo que se comparte por enlace. */
  const rows = await db
    .select()
    .from(placeImages)
    .where(eq(placeImages.placeId, id))
    .orderBy(asc(placeImages.sortOrder), asc(placeImages.createdAt));

  return NextResponse.json(rows.map(toClientImage));
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  /* Sube fotos el dueño del negocio, no solo un administrador. Ver
     `canManagePlace`: el rol `owner` no basta, hace falta el vínculo concreto. */
  if (!(await canManagePlace(req, id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  /* El negocio primero. `place_id` es clave foránea, así que un id inventado
     reventaría en el INSERT —después de haber subido el archivo al bucket y
     haber dejado basura—. Mejor un 404 antes de gastar nada. */
  const [place] = await db
    .select({ id: places.id, name: places.name })
    .from(places)
    .where(eq(places.id, id))
    .limit(1);

  if (!place) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  /* La subida —configuración, cuerpo, tipo real y `PutObject`— vive en
     `uploadImage`, que es también la que usa `menu-image`. Devuelve el
     `FormData` ya leído porque el cuerpo solo se consume una vez y aquí hacen
     falta además el `alt` y las dimensiones. */
  const upload = await uploadImage(req, `places/${place.id}/`);
  if (!upload.ok) return uploadErrorResponse(upload);

  const form = upload.form;

  /* Las fotos por negocio se cuentan con los dedos, así que traer los ids es
     más barato que un `count(*)` y de paso dice cuál es el orden que sigue. */
  const existing = await db
    .select({ id: placeImages.id })
    .from(placeImages)
    .where(eq(placeImages.placeId, place.id));

  const alt = form.get("alt");

  const [row] = await db
    .insert(placeImages)
    .values({
      id: generateId(),
      placeId: place.id,
      url: upload.url,
      /* El texto alternativo lo manda el cliente, que conoce el nombre del
         negocio; si no llega, el nombre del sitio es mejor que un hueco vacío. */
      alt: typeof alt === "string" && alt.trim() ? alt.trim() : place.name,
      width: optionalInt(form.get("width")),
      height: optionalInt(form.get("height")),
      isCover: existing.length === 0,
      sortOrder: existing.length,
    })
    .returning();

  /* Las fotos van en el mismo objeto que sirve `/api/places` —llegan agrupadas
     dentro de cada negocio—, así que una subida deja el catálogo cacheado
     incompleto hasta que se invalide. */
  revalidateTag(CATALOG_TAG, "max");

  return NextResponse.json(toClientImage(row!), { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;

  if (!(await canManagePlace(req, id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const imageId = new URL(req.url).searchParams.get("imageId");
  if (!imageId) {
    return NextResponse.json({ error: "Falta `imageId`" }, { status: 400 });
  }

  /* Las dos condiciones en un solo `where`. Encadenar dos `.where()` en drizzle
     reemplaza en vez de combinar, y borraría una foto de otro negocio. */
  const [row] = await db
    .delete(placeImages)
    .where(and(eq(placeImages.id, imageId), eq(placeImages.placeId, id)))
    .returning();

  if (!row) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }

  /* Se borra también el objeto, que es de lo que va esto: si solo se quitara la
     fila, el bucket crecería con fotos que ya nadie puede ver ni alcanzar. Un
     fallo aquí deja un huérfano, no un error: la fila ya no está y devolver un
     500 haría que el cliente reintentara un borrado que ya ocurrió. */
  const key = keyFromUrl(row.url);
  if (key) {
    try {
      await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    } catch (error) {
      console.error(`No se pudo borrar el objeto ${key} del bucket:`, error);
    }
  }

  /* Si se fue la portada, la siguiente foto sube a portada. Sin esto el negocio
     se queda sin ninguna y la ficha pública vuelve al hueco de «sin fotos»
     aunque le queden siete. */
  if (row.isCover) {
    const [next] = await db
      .select({ id: placeImages.id })
      .from(placeImages)
      .where(eq(placeImages.placeId, id))
      .orderBy(asc(placeImages.sortOrder))
      .limit(1);

    if (next) {
      await db
        .update(placeImages)
        .set({ isCover: true })
        .where(eq(placeImages.id, next.id));
    }
  }

  revalidateTag(CATALOG_TAG, "max");

  return NextResponse.json({ id: row.id });
}
