// Geocoding gratuito sin API key.
//  - Photon (Komoot): búsqueda mientras se escribe. Devuelve calles reales de OSM.
//  - Nominatim (OSM): reverse. Confirma calle/barrio del punto exacto.
// Ambas permiten CORS desde el navegador. Son best-effort: si fallan o están
// offline, el flujo actual (pin manual) sigue funcionando sin geocoder.

export interface GeocodeSuggestion {
  lat: number;
  lng: number;
  /** Calle principal, ej: "Calle Heredia". */
  street: string;
  /** Número, si Photon lo conoce (raro en Cuba). */
  housenumber?: string;
  district?: string;
  city?: string;
  /** Entre-calles "A y B" extraídas del texto del usuario ("e/ A y B"). */
  between?: string;
  /** Línea completa para mostrar en la lista. */
  label: string;
}

export interface ResolvedLocation {
  /** Calle confirmada + entre-calles, ej: "Calle Heredia, e/ San Pedro y Santo Tomás". */
  address: string;
  /** Barrio/municipio, ej: "Centro histórico". */
  barrio: string;
  /** Etiqueta corta para la tarjeta del picker, ej: "Calle Heredia · Centro histórico". */
  label: string;
}

const PHOTON_URL = "https://photon.komoot.io/api/";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

/** Provincias/ciudades cubanas que suelen colarse al final de una dirección. */
const CUBA_TAIL =
  /\s*(?:santiago de cuba|la habana|varadero|cienfuegos|trinidad|santa clara|cuba)\s*$/i;

/** Extrae "A y B" de texto con formato cubano "e/ A y B" o "entre A y B". */
export function extractBetween(text: string): string | null {
  const idx = text.search(/\be\/\b|entre/i);
  if (idx < 0) return null;
  const rest = text
    .slice(idx)
    .replace(/^e\/\s*/i, "")
    .replace(/^entre\s*/i, "")
    .replace(CUBA_TAIL, "")
    .replace(/[,.;]\s*$/, "")
    .trim();
  if (!rest) return null;
  const parts = rest.split(/\s+(?:y|e)\s+/i);
  if (parts.length >= 2) return `${parts[0]!.trim()} y ${parts[1]!.trim()}`;
  return rest;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
    osm_key?: string;
    osm_value?: string;
    /** Photon: "street" (calle), "house" (dirección), "city", "district", ... */
    type?: string;
  };
}

async function fetchJson(url: string, timeoutMs = 9000): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/**
 * Photon devuelve dos tipos útiles:
 *  - "street": un objeto de vía highway → name = calle.
 *  - "house": una dirección con número → street puede venir con entre-calles
 *    reales de OSM (ej: "Calle Heredia e/e Barnada y Paraiso").
 * Para "house" priorizamos `street` (el nombre de la vía) sobre `name` (local).
 */
function streetLabel(feature: PhotonFeature): string {
  const p = feature.properties;
  const addr = p.street;
  if (addr) return p.housenumber ? `${addr} ${p.housenumber}` : addr;
  const name = p.name ?? "";
  return p.housenumber ? `${name} ${p.housenumber}` : name;
}

/** Búsqueda de direcciones con Photon. Devuelve calles de OSM ordenadas. */
export async function searchAddress(
  query: string,
): Promise<GeocodeSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  // Sesgo hacia Cuba: evita que "Calle 3" o "Santa Clara" matcheen en otro país.
  const qSearch = CUBA_TAIL.test(q) ? q : `${q}, Santiago de Cuba, Cuba`;
  const between = extractBetween(q);
  const url = `${PHOTON_URL}?q=${encodeURIComponent(qSearch)}&limit=6`;
  const data = (await fetchJson(url)) as {
    features?: PhotonFeature[];
  } | null;
  if (!data?.features) return [];
  return data.features
    .filter((f) => {
      const p = f.properties;
      const t = p.type;
      const isRoad =
        t === "street" ||
        p.osm_key === "highway" ||
        p.osm_key === "building" ||
        t === "house" ||
        (Boolean(p.housenumber) && Boolean(p.street));
      return isRoad && Number.isFinite(f.geometry.coordinates[0]);
    })
    .map((f) => {
      const p = f.properties;
      const street = streetLabel(f);
      const city = p.city ?? p.state ?? "";
      const district = p.district ?? "";
      const label = [street, district, city].filter(Boolean).join(", ");
      return {
        lat: f.geometry.coordinates[1]!,
        lng: f.geometry.coordinates[0]!,
        street,
        housenumber: p.housenumber,
        district,
        city,
        between: between ?? undefined,
        label,
      };
    })
    .filter((s) => s.street.length > 0)
    .slice(0, 6);
}

/** Reverse: confirma calle y barrio reales del punto usando Nominatim. */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ResolvedLocation | null> {
  const url = `${NOMINATIM_URL}?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&accept-language=es`;
  const data = (await fetchJson(url)) as {
    address?: Record<string, string>;
  } | null;
  const addr = data?.address;
  if (!addr || addr.country_code !== "cu") return null;

  const street = addr.road ?? addr.pedestrian ?? addr.footway ?? "";
  const barrio =
    addr.suburb ??
    addr.neighbourhood ??
    addr.quarter ??
    addr.city_district ??
    addr.district ??
    "";
  const city =
    addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? "";
  if (!street && !barrio) return null;

  const clean = (s: string) => s.replace(/^\d+\s*/, "").trim();
  const streetC = clean(street);
  const barrioC = clean(barrio);
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];
  const address = uniq([streetC, barrioC, city]).join(", ");
  const label = uniq([streetC || barrioC, city]).join(" · ");
  return { address, barrio: barrioC, label };
}
