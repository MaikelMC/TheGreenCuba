import { siteConfig } from "@/config/site";
import { contactLinks } from "@/lib/contact-links";
import { currencyLabel } from "@/lib/utils";
import type { UserPlace } from "@/lib/places-store";

/**
 * El marcado estructurado de una ficha de lugar.
 *
 * Regla que gobierna todo lo de aquí: **solo sale lo que está en la base**. El
 * marcado estructurado que no coincide con lo que se ve en la página no da
 * resultados enriquecidos, da una penalización. Por eso no se emite
 * `aggregateRating` —`rating` existe, pero sin el número de reseñas que lo
 * forman un `aggregateRating` es una nota sin respaldo—, ni `openingHours`,
 * porque `schedule` es texto libre («De noche», «Todo el día») y el campo de
 * schema.org espera una hora.
 *
 * La URL se construye desde `siteConfig.url` y no desde la petición: unos datos
 * estructurados que cambian según cómo se llegue a la página apuntan a varias
 * identidades del mismo negocio.
 */

/** Tipo de schema.org de cada categoría del catálogo. `LocalBusiness` es el
    genérico y el respaldo: marcar todo como `Restaurant` es el error clásico. */
const SCHEMA_TYPE: Record<string, string> = {
  Restaurante: "Restaurant",
  Cafetería: "CafeOrCoffeeShop",
  Bar: "BarOrPub",
  "Vida nocturna": "NightClub",
  Mercado: "Store",
  Tienda: "Store",
  Servicio: "LocalBusiness",
  Hospedaje: "LodgingBusiness",
  Cultura: "TouristAttraction",
  Naturaleza: "TouristAttraction",
  Playa: "TouristAttraction",
};

export function placeUrl(id: string): string {
  return `${siteConfig.url.replace(/\/$/, "")}/place/${id}`;
}

/**
 * La carta pública del negocio: la ruta que se comparte y la que va dentro del
 * QR de la mesa.
 *
 * Cuelga de la ficha —`/place/{id}/carta`— y no de un `/carta/{slug}` propio.
 * El `slug` existe, es único y hoy no cambia, pero el id no depende de ninguna
 * regla: un QR impreso y pegado en una mesa no se puede romper porque alguien
 * decida mañana rehacer los slugs. Y la ruta cuelga de `/place`, que es la que
 * el proxy deja abierta a propósito, así que no hay que tocar el control de
 * acceso.
 */
export function menuUrl(id: string): string {
  return `${placeUrl(id)}/carta`;
}

export function placeJsonLd(place: UserPlace): Record<string, unknown> {
  const url = placeUrl(place.id);

  return {
    "@context": "https://schema.org",
    "@type": SCHEMA_TYPE[place.category] ?? "LocalBusiness",
    "@id": url,
    url,
    name: place.name,
    description: place.description || undefined,
    /* La dirección se arma con lo que hay: una calle sin ciudad sigue siendo
       útil, y Cuba es el único país donde opera el catálogo. */
    address: {
      "@type": "PostalAddress",
      streetAddress: place.address || undefined,
      addressLocality: place.city || undefined,
      addressRegion: place.province || undefined,
      addressCountry: "CU",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: place.lat,
      longitude: place.lng,
    },
    image: place.photos?.length ? place.photos.map((photo) => photo.url) : undefined,
    telephone: place.phone || undefined,
    priceRange: place.priceLabel || undefined,
    /* Los métodos de pago son el diferencial del producto en Cuba, así que van
       con su nombre largo: en la base están como código («MLC») y así no
       significan nada fuera de aquí. */
    paymentAccepted: place.payments.length
      ? place.payments.map(currencyLabel).join(", ")
      : undefined,
    /* La web y las redes que el dueño dio en la sección «Contacto». `sameAs`
       espera una lista y aquí iba la web sola: son las URLs que Google asocia
       con la entidad, así que cuanto más haya, mejor. Sale de
       `contactLinks`, con lo que ya se ha normalizado para la ficha. */
    sameAs: (() => {
      const links = contactLinks({
        website: place.website,
        instagram: place.instagram,
        facebook: place.facebook,
      });
      const list = [links.website, links.instagram, links.facebook].filter(
        (value): value is string => Boolean(value),
      );
      return list.length > 0 ? list : undefined;
    })(),
  };
}
