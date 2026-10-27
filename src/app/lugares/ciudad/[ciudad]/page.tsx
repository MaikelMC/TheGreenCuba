import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HubPage } from "@/components/directory/hub-page";
import { siteConfig } from "@/config/site";
import { listCategories, listPlaces } from "@/lib/db/queries";
import { FILLER_PLACE_IDS } from "@/lib/places";
import { categoryCityPath, cityPath } from "@/lib/structured-data";
import { slugify } from "@/lib/utils";

/**
 * Un hub por ciudad: `/lugares/ciudad/santiago-de-cuba`.
 *
 * Filtra en memoria sobre el catálogo cacheado, igual que el directorio: hoy son
 * decenas de filas y mover esto a un `WHERE` solo tendría sentido con cientos.
 * La URL canónica es la de esta página, no la del directorio con `?provincia=`.
 */
export const revalidate = 3600;

type Params = { params: Promise<{ ciudad: string }> };

async function load(citySlug: string) {
  const places = (await listPlaces({ onlyActive: true, limit: 500 })).filter(
    (place) =>
      place.reviewStatus === "approved" &&
      !FILLER_PLACE_IDS.has(place.id) &&
      slugify(place.city ?? "") === citySlug,
  );
  if (places.length === 0) return null;

  /* El nombre con tildes sale de la fila, no del slug: el titular dice
     «Guantánamo», no «guantanamo». */
  const city = places[0]!.city ?? citySlug;
  return { city, places };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { ciudad } = await params;
  const data = await load(ciudad);
  if (!data) {
    return { title: "Ciudad no encontrada", robots: { index: false, follow: true } };
  }

  const { city, places } = data;
  const title = `Negocios y lugares en ${city}`;
  const description = `${places.length} ${
    places.length === 1 ? "negocio" : "negocios"
  } en ${city}: restaurantes, cafeterías, hospedajes y más, con dirección, horario y métodos de pago.`;

  return {
    title,
    description,
    alternates: { canonical: cityPath(ciudad) },
    openGraph: {
      type: "website",
      title,
      description,
      url: `${siteConfig.url.replace(/\/$/, "")}${cityPath(ciudad)}`,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CityPage({ params }: Params) {
  const { ciudad } = await params;
  const data = await load(ciudad);
  if (!data) notFound();

  const { city, places } = data;
  let categorySlugByName = new Map<string, string>();
  try {
    categorySlugByName = new Map(
      (await listCategories()).map((category) => [category.label, category.value]),
    );
  } catch {
    /* Sin catálogo se enseña la lista; solo faltan los atajos por categoría. */
  }
  const categoryLinks = Array.from(new Set(places.map((place) => place.category)))
    .map((name) => ({ name, slug: categorySlugByName.get(name) }))
    .filter((item): item is { name: string; slug: string } => Boolean(item.slug))
    .map((item) => ({
      name: item.name,
      href: categoryCityPath(item.slug, ciudad),
    }));

  return (
    <HubPage
      eyebrow="Ciudad"
      title={`Negocios y lugares en ${city}`}
      intro={`${places.length} ${
        places.length === 1 ? "negocio publicado" : "negocios publicados"
      } en La Verde para ${city}. Fichas con dirección, horario, precios y formas de pago, sin depender de un mapa que no cargue.`}
      crumbs={[
        { name: "Inicio", href: "/" },
        { name: "Directorio", href: "/lugares" },
        { name: city, href: cityPath(ciudad) },
      ]}
      links={categoryLinks}
      linksLabel="Por categoría"
      places={places}
    />
  );
}
