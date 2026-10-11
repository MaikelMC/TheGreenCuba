import { NextRequest, NextResponse } from "next/server";
import { canManagePlace } from "@/lib/admin-server";
import { uploadErrorResponse, uploadImage } from "@/lib/storage/upload";

/**
 * Sube la foto o el flyer que acompaña a una publicación.
 *
 * Devuelve la URL y **no escribe nada** en la base: quien la guarda es el alta de
 * la publicación, que recibe la URL en su cuerpo. Igual que el logo del negocio,
 * el archivo sube primero y se persiste al guardar —si nadie guarda, queda un
 * objeto huérfano en el bucket, que es el mismo coste aceptado allí—.
 *
 * El `placeId` va en la **query** y no en el `FormData` a propósito: hay que
 * autorizar antes de leer el cuerpo, y el cuerpo solo se puede leer una vez
 * —`uploadImage` lo consume él—. Si viniera dentro, la comprobación llegaría
 * después de haber subido el archivo.
 *
 * El archivo llega ya comprimido por `prepareImage()` en el navegador, pero
 * **no se fía de eso**: `options.optimize` lo recompone a WebP en el servidor.
 * La compresión del navegador es best-effort —si no sabe decodificar el archivo,
 * o no tiene `OffscreenCanvas`, sube el original— y un flyer de 871 KB acaba en
 * el bucket y en la descarga del administrador. Es lo mismo que hace la foto del
 * menú, que tampoco puede llegar sin comprimir.
 */
export async function POST(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get("placeId")?.trim() ?? "";
  if (!placeId) {
    return NextResponse.json({ error: "Falta placeId" }, { status: 400 });
  }
  if (!(await canManagePlace(req, placeId))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const upload = await uploadImage(req, `publicaciones/${placeId}/`, {
    optimize: true,
  });
  if (!upload.ok) return uploadErrorResponse(upload);

  return NextResponse.json({ url: upload.url }, { status: 201 });
}
