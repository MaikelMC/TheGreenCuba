import { getPlaceById, getPlaceBySlug } from "@/lib/db/queries";
import { DEV_PLACE_ID } from "@/lib/dev-place";
import { logoEnLinea, tarjetaNegocio } from "@/lib/og-card";
import { renderOgImage } from "@/lib/og-image";

/**
 * Una sola función para las tres tarjetas que se comparten.
 *
 * Antes eran tres archivos `opengraph-image.tsx`: uno raíz y uno por cada
 * segmento. La convención de metadatos mete el módulo de cada uno en el chunk
 * de su página, y con él `next/og` y su import dinámico de sharp, que pesan
 * ~12 MB aunque la página no genere ninguna imagen. Servidas desde aquí, solo
 * esta función los carga.
 */
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const id = url.searchParams.get("place");

  if (slug) {
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

  if (id) {
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

  return renderOgImage();
}
