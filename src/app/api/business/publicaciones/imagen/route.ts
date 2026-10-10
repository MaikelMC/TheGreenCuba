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
 * El archivo llega ya comprimido a WebP por `prepareImage()` en el navegador y
 * pasa por las mismas comprobaciones de tipo y tamaño que el resto
 * (`storage/upload.ts`).
 */
export async function POST(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get("placeId")?.trim() ?? "";
  if (!placeId) {
    return NextResponse.json({ error: "Falta placeId" }, { status: 400 });
  }
  if (!(await canManagePlace(req, placeId))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const upload = await uploadImage(req, `publicaciones/${placeId}/`);
  if (!upload.ok) return uploadErrorResponse(upload);

  return NextResponse.json({ url: upload.url }, { status: 201 });
}
