import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { isAdminRequest } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { publicaciones } from "@/lib/db/schema";
import { S3_BUCKET, s3Client } from "@/lib/storage/s3";
import { keyFromUrl } from "@/lib/storage/upload";

/**
 * Descarga del flyer de una publicación, por este origen.
 *
 * Existe porque el navegador **no puede** pedir el archivo al bucket: el `fetch`
 * a `*.neon.tech` es de otro origen y lo corta el CORS —y en producción, además,
 * `connect-src 'self'`—, y la descarga directa con un `<a download>` solo
 * funciona entre el mismo origen. Con archivos servidos desde aquí el navegador
 * habla únicamente con la aplicación, igual que con las fotos de los negocios,
 * y de paso la descarga funciona desde redes donde el dominio del bucket no
 * responde.
 *
 * El `id` de la publicación y no su URL: la ruta lee la imagen de la fila, así
 * que no hay forma de convertirla en un proxy abierto contra el bucket. El
 * prefijo se comprueba igual, porque la fila es lo único que dice de dónde
 * sale lo que se manda.
 */

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const [row] = await db
    .select({ imagenUrl: publicaciones.imagenUrl })
    .from(publicaciones)
    .where(eq(publicaciones.id, id))
    .limit(1);

  const key = row?.imagenUrl ? keyFromUrl(row.imagenUrl) : null;
  if (!key || !key.startsWith("publicaciones/")) {
    return NextResponse.json(
      { error: "Esta publicación no tiene flyer." },
      { status: 404 },
    );
  }

  const objeto = await s3Client.send(
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
  );
  if (!objeto.Body) {
    return NextResponse.json(
      { error: "El archivo no está en el bucket." },
      { status: 404 },
    );
  }

  return new NextResponse(objeto.Body.transformToWebStream(), {
    headers: {
      "Content-Type": objeto.ContentType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${key.split("/").pop() ?? "flyer"}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
