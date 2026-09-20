import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { and, asc, eq } from "drizzle-orm";
import { isAdminRequest } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { placeImages, places } from "@/lib/db/schema";
import { S3_BUCKET, S3_PUBLIC_URL, s3Client, s3ConfigProblem } from "@/lib/storage/s3";
import { EXTENSION, MAX_UPLOAD_BYTES, sniffImageType } from "@/lib/storage/image";
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
 * navegador. Aquí no se recomprime nada: se comprueba y se guarda.
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

function publicUrl(key: string): string {
  return `${S3_PUBLIC_URL}/${key}`;
}

/** Clave del objeto a partir de su URL pública. `null` si no es de este bucket. */
function keyFromUrl(url: string): string | null {
  const base = S3_PUBLIC_URL;
  if (!base || !url.startsWith(`${base}/`)) return null;
  return url.slice(base.length + 1);
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
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

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

  /* Antes de tocar el bucket. Un endpoint o unas claves a medio poner no dan un
     error de configuración: dan un ENOTFOUND, un fallo de TLS o un 403 opaco,
     y el sitio donde se busca eso no es donde está el problema. */
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
    return NextResponse.json(
      { error: "La imagen es demasiado grande." },
      { status: 413 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  /* El tipo sale de los bytes, no de lo que diga el navegador. Lo que no sea
     una imagen de verdad se cae aquí, antes de tocar el bucket público. */
  const contentType = sniffImageType(bytes);
  if (!contentType) {
    return NextResponse.json(
      { error: "El archivo no es una imagen JPEG, PNG o WebP." },
      { status: 415 },
    );
  }

  const key = `places/${place.id}/${generateId()}.${EXTENSION[contentType]}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      /* La clave lleva un id aleatorio y nunca se reescribe, así que el objeto
         es inmutable y el navegador no tiene por qué volver a pedirlo. */
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

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
      url: publicUrl(key),
      /* El texto alternativo lo manda el cliente, que conoce el nombre del
         negocio; si no llega, el nombre del sitio es mejor que un hueco vacío. */
      alt: typeof alt === "string" && alt.trim() ? alt.trim() : place.name,
      width: optionalInt(form.get("width")),
      height: optionalInt(form.get("height")),
      isCover: existing.length === 0,
      sortOrder: existing.length,
    })
    .returning();

  return NextResponse.json(toClientImage(row!), { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
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

  return NextResponse.json({ id: row.id });
}
