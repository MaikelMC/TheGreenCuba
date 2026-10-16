import { getPlaceById } from "@/lib/db/queries";
import { DEV_PLACE_ID } from "@/lib/dev-place";
import { OG_SIZE, logoEnLinea, tarjetaNegocio } from "@/lib/og-card";

/**
 * La vista previa del enlace de una ficha de lugar.
 *
 * Tenía el mismo fallo que la carta online y se veía igual: `generateMetadata`
 * declaraba `images: undefined` cuando el lugar no tenía fotos, y una clave
 * declarada —aunque sea con `undefined`— le dice a Next que la página trae su
 * propia imagen. Sin ninguna, el enlace compartido acababa con el icono de La
 * Verde. La ficha se comparte tanto como la carta, así que las dos enseñan
 * ahora la tarjeta del negocio.
 *
 * El lienzo está en `src/lib/og-card.tsx`, compartido con `/m/[slug]`.
 */
export const alt = "Ficha del lugar en La Verde";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  /* Sin sesión: a esta ruta la llama un rastreador. El negocio de prueba se
     resuelve igual que en su carta (`/m/dev-cafe-la-ceiba`), que ya es pública
     a propósito —se reparte por QR—; `overrideFor` es para la copia personal de
     su dueño y aquí no hay dueño mirando. */
  const place = await getPlaceById(id, { includeDev: id === DEV_PLACE_ID }).catch(
    () => null,
  );

  const donde = place?.city || place?.barrio || "Cuba";

  return tarjetaNegocio({
    nombre: place?.name ?? "Lugar",
    pie: place ? `${place.category} · ${donde}` : donde,
    titular: "Dirección, horario y precios",
    subtitulo: "Con fotos, mapa y formas de contacto.",
    logo: await logoEnLinea(place?.logoUrl),
  });
}
