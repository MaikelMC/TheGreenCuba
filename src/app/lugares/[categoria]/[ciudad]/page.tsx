import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HubPage } from "@/components/directory/hub-page";
import { siteConfig } from "@/config/site";
import { findCategoryBySlug, listPlaces } from "@/lib/db/queries";
import { FILLER_PLACE_IDS } from "@/lib/places";
import {
  categoryCityPath,
  categoryPath,
} from "@/lib/structured-data";
import { slugify } from "@/lib/utils";

/**
 * La página que compite por «cafeterías en Santiago de Cuba»:
 * `/lugares/cafeteria/santiago-de-cuba`.
 *
 * Solo se publica si la pareja tiene fichas. La categoría y la ciudad se
 * validan por separado para que un slug inventado sea 404 y no un listado vacío.
 */
export const revalidate = 3600;

type Params = { params: Promise<{ categoria: string; ciudad: string }> };

async function load(categorySlug: string, citySlug: string) {
  const category = await findCategoryBySlug(categorySlug);
  if (!category) return null;

  const places = (
    await listPlaces({ categorySlug, onlyActive: true, limit: 500 })
  ).filter(
    (place) =>
      place.reviewStatus === "approved" &&
      !FILLER_PLACE_IDS.has(place.id) &&
      slugify(place.city ?? "") === citySlug,
  );
  if (places.length === 0) return null;

  const city = places[0]!.city ?? citySlug;
  return { category, city, places };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { categoria, ciudad } = await params;
  const data = await load(categoria, ciudad);
  if (!data) {
    return { title: "Página no encontrada", robots: { index: false, follow: true } };
  }

  const { category, city, places } = data;
  const title = `${category.name} en ${city}`;
  const description = `${places.length} ${
    places.length === 1 ? "negocio" : "negocios"
  } de ${category.name.toLowerCase()} en ${city}, con dirección, horario, precios y formas de pago.`;
  const path = categoryCityPath(category.slug, ciudad);

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      title,
      description,
      url: `${siteConfig.url.replace(/\/$/, "")}${path}`,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CategoryCityPage({ params }: Params) {
  const { categoria, ciudad } = await params;
  const data = await load(categoria, ciudad);
  if (!data) notFound();

  const { category, city, places } = data;

  /* Las otras ciudades con esta categoría: enlaces laterales que reparten
     autoridad entre los hubs en vez de dejar esta página como un callejón. */
  const allInCategory = (
    await listPlaces({ categorySlug: category.slug, onlyActive: true, limit: 500 })
  ).filter(
    (place) =>
      place.reviewStatus === "approved" && !FILLER_PLACE_IDS.has(place.id),
  );
  const cityLinks = Array.from(
    new Map(
      allInCategory.map((place) => [
        slugify(place.city ?? ""),
        place.city ?? "",
      ]),
    ),
  )
    .filter(([slug]) => Boolean(slug) && slug !== ciudad)
    .map(([slug, name]) => ({
      name,
      href: categoryCityPath(category.slug, slug),
    }));

  return (
    <HubPage
      eyebrow="Categoría y ciudad"
      title={`${category.name} en ${city}`}
      intro={`${places.length} ${
        places.length === 1 ? "negocio" : "negocios"
      } de ${category.name.toLowerCase()} en ${city} publicados en La Verde. Dirección, horario, precios y formas de pago en cada ficha.`}
      crumbs={[
        { name: "Inicio", href: "/" },
        { name: "Directorio", href: "/lugares" },
        { name: category.name, href: categoryPath(category.slug) },
        { name: city, href: categoryCityPath(category.slug, ciudad) },
      ]}
      links={cityLinks}
      linksLabel="Otras ciudades"
      places={places}
    />
  );
}
