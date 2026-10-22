import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { listPlaces } from "@/lib/db/queries";

/**
 * Las URL públicas que queremos que un buscador descubra.
 *
 * Son la portada y las fichas de lugar activas, que salen de Neon: son las
 * únicas páginas públicas con contenido propio. Todo lo demás —el mapa, el
 * panel, el perfil— vive detrás de una sesión y no tiene una versión «de todos»
 * que indexar.
 *
 * No se listan categorías ni ciudades: esas páginas todavía no existen. Meter
 * aquí una URL que devuelve 404 es peor que no ofrecerla, porque el buscador
 * aprende a desconfiar del sitemap entero.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url.replace(/\/$/, "");

  const entries: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      /* El directorio es la puerta completa al catálogo y el camino de enlaces
         internos hacia cada ficha, así que va por encima del resto de páginas
         estáticas. */
      url: `${base}/lugares`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${base}/terminos`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  try {
    const places = await listPlaces({ onlyActive: true, limit: 500 });
    /* Solo lo que la ficha declara indexable. Meter en el sitemap una URL que
       lleva `noindex` —una ficha pendiente o un negocio cerrado— es una
       contradicción que Google acaba penalizando en todo el archivo. */
    for (const place of places.filter(
      (item) => item.reviewStatus === "approved" && item.status === "active",
    )) {
      entries.push({
        url: `${base}/place/${place.id}`,
        lastModified: place.updatedAt ? new Date(place.updatedAt) : undefined,
        changeFrequency: "weekly",
        priority: 0.8,
      });
      /* La URL corta del menú se indexa aparte: es la que lleva el QR y la que se
         comparte, y su contenido —precios, fotos— es propio. */
      entries.push({
        url: `${base}/m/${place.slug}`,
        lastModified: place.updatedAt ? new Date(place.updatedAt) : undefined,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  } catch {
    /* Si Neon no contesta —y desde esta red eso pasa por rachas—, se sirve la
       portada sola en vez de tumbar el build o devolver un 500. Un sitemap
       incompleto se corrige en la siguiente revalidación; un build que no
       termina, no. */
  }

  return entries;
}
