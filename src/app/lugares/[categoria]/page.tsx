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
 * Un hub por categoría: `/lugares/cafeteria`.
 *
 * Solo se publica si hay al menos una ficha aprobada. Una página de categoría
 * vacía no compite por nada y sí resta: el sitemap no la lista y aquí se
 * responde 404 en vez de un 200 delgado. La ciudad tiene su propio hub en
 * `/lugares/ciudad/{ciudad}` y la combinación en `/{categoria}/{ciudad}`.
 */
export const revalidate = 3600;

type Params = { params: Promise<{ categoria: string }> };

async function load(slug: string) {
  const category = await findCategoryBySlug(slug);
  if (!category) return null;

  const places = (await listPlaces({ categorySlug: slug, onlyActive: true, limit: 500 }))
    .filter(
      (place) =>
        place.reviewStatus === "approved" && !FILLER_PLACE_IDS.has(place.id),
    );
  if (places.length === 0) return null;

  return { category, places };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { categoria } = await params;
  const data = await load(categoria);
  if (!data) {
    return { title: "Categoría no encontrada", robots: { index: false, follow: true } };
  }

  const { category, places } = data;
  const title = `${category.name} en Cuba`;
  const description = `Directorio de ${category.name.toLowerCase()} en Cuba: ${places.length} ${
    places.length === 1 ? "negocio" : "negocios"
  } con dirección, horario y métodos de pago.`;

  return {
    title,
    description,
    alternates: { canonical: categoryPath(category.slug) },
    openGraph: {
      type: "website",
      title,
      description,
      url: `${siteConfig.url.replace(/\/$/, "")}${categoryPath(category.slug)}`,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CategoryPage({ params }: Params) {
  const { categoria } = await params;
  const data = await load(categoria);
  if (!data) notFound();

  const { category, places } = data;
  const cityLinks = Array.from(
    new Map(
      places.map((place) => [slugify(place.city ?? ""), place.city ?? ""]),
    ),
  )
    .filter(([slug]) => Boolean(slug))
    .map(([slug, city]) => ({
      name: city,
      href: categoryCityPath(category.slug, slug),
    }));

  return (
    <HubPage
      eyebrow="Categoría"
      title={`${category.name} en Cuba`}
      intro={`${places.length} ${
        places.length === 1 ? "negocio" : "negocios"
      } de ${category.name.toLowerCase()} publicados en La Verde. Cada ficha trae dirección, horario, precios y formas de pago, para decidir sin llamar.`}
      crumbs={[
        { name: "Inicio", href: "/" },
        { name: "Directorio", href: "/lugares" },
        { name: category.name, href: categoryPath(category.slug) },
      ]}
      links={cityLinks}
      linksLabel="Por ciudad"
      places={places}
    />
  );
}
