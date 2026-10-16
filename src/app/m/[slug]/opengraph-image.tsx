import { getPlaceBySlug } from "@/lib/db/queries";
import { DEV_PLACE_ID } from "@/lib/dev-place";
import { OG_SIZE, logoEnLinea, tarjetaNegocio } from "@/lib/og-card";

/**
 * La vista previa del enlace de una carta online.
 *
 * Hace falta un archivo propio y no basta con declarar `images` en
 * `generateMetadata`: cuando el negocio no tiene logo ni foto no hay ninguna URL
 * que declarar, y **omitir la clave es justo lo que hace que Next use esta
 * tarjeta**. Antes se declaraba `images: undefined`, que cuenta como declarada
 * —Next pregunta por `hasOwnProperty('images')`, ver
 * `next/dist/lib/metadata/resolve-metadata.js:149`—, así que la carta se quedaba
 * sin imagen y el enlace acababa enseñando el icono de La Verde.
 *
 * El lienzo está en `src/lib/og-card.tsx`, compartido con la ficha del lugar.
 */
export const alt = "Menú del negocio en La Verde";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug, {
    includeDev: slug === DEV_PLACE_ID,
  }).catch(() => null);

  const donde = place?.city || place?.barrio || "Cuba";

  return tarjetaNegocio({
    nombre: place?.name ?? "Menú",
    pie: place ? `${place.category} · ${donde}` : donde,
    titular: "Menú y precios",
    subtitulo: "Pide por WhatsApp desde la carta.",
    logo: await logoEnLinea(place?.logoUrl),
  });
}
