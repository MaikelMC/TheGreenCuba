import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { listCategories, listPlaces } from "@/lib/db/queries";
import { FILLER_PLACE_IDS } from "@/lib/places";
import {
  categoryCityPath,
  categoryPath,
  cityPath,
} from "@/lib/structured-data";
import { slugify } from "@/lib/utils";

/**
 * Las URL públicas que queremos que un buscador descubra.
 *
 * Además de la portada y las fichas, entran los hubs que compiten por consultas
 * genéricas: categoría, ciudad y la pareja de las dos. Solo se listan los que
 * tienen al menos una ficha; una URL de categoría vacía es contenido delgado y
 * el buscador aprende a desconfiar del archivo entero.
 *
 * El menú `/m/{slug}` solo entra si tiene entradas: la página se marca `noindex`
 * cuando está vacía, y mandar al sitemap una URL `noindex` es una contradicción.
 */
export const revalidate = 3600;

function latest(dates: (number | string | Date | undefined)[]): Date | undefined {
  const times = dates
    .filter((value): value is number | string | Date => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));
  return times.length > 0 ? new Date(Math.max(...times)) : undefined;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url.replace(/\/$/, "");

  const entries: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/lugares`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${base}/ranking`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${base}/terminos`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  try {
    const places = (await listPlaces({ onlyActive: true, limit: 500 })).filter(
      (place) => place.reviewStatus === "approved" && !FILLER_PLACE_IDS.has(place.id),
    );

    for (const place of places) {
      if (place.status === "active") {
        entries.push({
          url: `${base}/place/${place.id}`,
          lastModified: place.updatedAt ? new Date(place.updatedAt) : undefined,
          changeFrequency: "weekly",
          priority: 0.8,
        });
      }
      if (place.status === "active" && place.menu.length > 0) {
        entries.push({
          url: `${base}/m/${place.slug}`,
          lastModified: place.updatedAt ? new Date(place.updatedAt) : undefined,
          changeFrequency: "weekly",
          priority: 0.6,
        });
      }
    }

    /* El slug real de la categoría: «Vida nocturna» es `discoteca`, y
       `slugify` produciría una URL que la ruta no reconoce. */
    let categorySlugByName = new Map<string, string>();
    try {
      categorySlugByName = new Map(
        (await listCategories()).map((category) => [category.label, category.value]),
      );
    } catch {
      /* Sin categorías se publican fichas y ciudades; el archivo sigue válido. */
    }

    const categories = new Map<
      string,
      { slug: string; dates: (number | undefined)[] }
    >();
    const cities = new Map<string, { slug: string; dates: (number | undefined)[] }>();
    const combos = new Map<
      string,
      { category: string; city: string; dates: (number | undefined)[] }
    >();

    for (const place of places) {
      const categorySlug = categorySlugByName.get(place.category);
      const citySlug = slugify(place.city ?? "");
      if (categorySlug) {
        const entry = categories.get(categorySlug);
        if (entry) entry.dates.push(place.updatedAt);
        else categories.set(categorySlug, { slug: categorySlug, dates: [place.updatedAt] });
      }
      if (citySlug) {
        const entry = cities.get(citySlug);
        if (entry) entry.dates.push(place.updatedAt);
        else cities.set(citySlug, { slug: citySlug, dates: [place.updatedAt] });
      }
      if (categorySlug && citySlug) {
        const key = `${categorySlug}/${citySlug}`;
        const entry = combos.get(key);
        if (entry) entry.dates.push(place.updatedAt);
        else
          combos.set(key, {
            category: categorySlug,
            city: citySlug,
            dates: [place.updatedAt],
          });
      }
    }

    for (const category of categories.values()) {
      entries.push({
        url: `${base}${categoryPath(category.slug)}`,
        lastModified: latest(category.dates),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }

    for (const city of cities.values()) {
      entries.push({
        url: `${base}${cityPath(city.slug)}`,
        lastModified: latest(city.dates),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }

    for (const combo of combos.values()) {
      entries.push({
        url: `${base}${categoryCityPath(combo.category, combo.city)}`,
        lastModified: latest(combo.dates),
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  } catch {
    /* Si Neon no contesta se sirve lo estático. Un sitemap incompleto se
       corrige en la siguiente revalidación; un 500, no. */
  }

  return entries;
}
