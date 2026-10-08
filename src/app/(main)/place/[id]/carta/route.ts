import { NextRequest, NextResponse } from "next/server";
import { getPlaceById } from "@/lib/db/queries";
import { DEV_PLACE_ID } from "@/lib/dev-place";

/**
 * La carta antigua redirige a la URL corta, con un **308 real**.
 *
 * Existía en `/place/{id}/carta` y ahora el menú vive en `/m/{slug}`. Se deja
 * esta puerta por un motivo concreto: hay QR ya impresos y pegados en mesas que
 * apuntan aquí, y enlaces repartidos por WhatsApp. Un 308 —permanente y
 * cacheable, equivalente SEO de un 301— los lleva a la URL nueva conservando lo
 * que Google ya sabía; borrarla los rompería.
 *
 * Es un **route handler y no una página** a propósito. Como página dentro del
 * grupo `(main)`, el `loading.tsx` de ese grupo hace que Next ya haya mandado la
 * cáscara en streaming cuando se descubre el `permanentRedirect`, así que no
 * puede fijar el código de estado y devuelve un 200 con `<meta refresh>`.
 * Funciona en el navegador, pero un buscador lo lee como contenido duplicado.
 * Un route handler no pasa por layouts ni por ese límite de Suspense: responde
 * `Location` + 308 antes de pintar nada.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const place = await getPlaceById(id, { includeDev: id === DEV_PLACE_ID });
  if (!place) {
    return new NextResponse("Menú no encontrado", { status: 404 });
  }
  return NextResponse.redirect(
    new URL(`/m/${place.slug}`, request.url),
    308,
  );
}
