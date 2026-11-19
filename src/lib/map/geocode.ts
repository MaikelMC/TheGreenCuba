// Geocoding gratuito sin API key.
//  - Photon (Komoot): búsqueda mientras se escribe. Devuelve calles reales de OSM.
//  - Nominatim (OSM): reverse. Confirma calle/barrio del punto exacto.
// Ambas permiten CORS desde el navegador. Son best-effort: si fallan o están
// offline, el flujo actual (pin manual) sigue funcionando sin geocoder.

import { CUBA_AREAS } from "@/lib/map/cuba-areas";

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

export interface AreaSuggestion {
  id: string;
  name: string;
  province: string;
  lat: number;
  lng: number;
}

const PHOTON_URL = "https://photon.komoot.io/api/";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

/** Provincias/ciudades cubanas que suelen colarse al final de una dirección. */
const CUBA_TAIL =
  /\s*(?:santiago de cuba|la habana|varadero|cienfuegos|trinidad|santa clara|cuba)\s*$/i;

/** Extrae "A y B" de texto con formato cubano "e/ A y B" o "entre A y B". */
export function extractBetween(text: string): string | null {
  // Sin `\b` tras la barra: «e/ San Pedro» lleva espacio y no casaba.
  const idx = text.search(/\be\/|\bentre\b/i);
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

async function fetchJson(
  url: string,
  timeoutMs = 9000,
  signal?: AbortSignal,
): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  /* Cancelar la petición anterior deja de gastar datos cuando el usuario
     sigue escribiendo: el debounce solo evitaba lanzarla, no la abortaba. */
  const alAbortar = () => ctrl.abort();
  signal?.addEventListener("abort", alAbortar, { once: true });
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
    signal?.removeEventListener("abort", alAbortar);
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

/** Cuba entera: oeste, sur, este, norte. Corta resultados de otros países. */
const CUBA_BBOX = "-85.2,19.6,-73.9,23.4";

/** Dónde está el usuario, para que gane su ciudad y no la de otra provincia. */
export interface SearchNear {
  lat: number;
  lng: number;
  /** «Santiago de Cuba». Se añade a la consulta si el texto no nombra ya otra. */
  city?: string;
}

const sinTildes = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Palabras con las que el usuario busca la calle, sin «calle». */
function palabrasClave(calle: string): string[] {
  return sinTildes(calle)
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w.length >= 2 && w !== "calle" && w !== "ave" && w !== "avenida");
}

/** Ciudades y provincias, la más larga primero: «Santiago de Cuba» antes que «Cuba». */
const LUGARES = [
  ...new Set(CUBA_AREAS.flatMap((a) => [a.name, a.province]).concat("Cuba")),
]
  .map((nombre) => ({
    nombre,
    clave: sinTildes(nombre),
    area:
      CUBA_AREAS.find((a) => a.name === nombre) ??
      CUBA_AREAS.find((a) => a.province === nombre),
  }))
  .sort((a, b) => b.clave.length - a.clave.length);

/**
 * Separa «Maceo, Holguín» en calle y lugar. Si quitar el lugar deja la
 * búsqueda vacía («Calle Trinidad»), el lugar es el nombre de la calle y no se
 * quita.
 */
function separarLugar(q: string): { resto: string; lugar?: (typeof LUGARES)[number] } {
  const limpio = q.replace(/[,.;\s]+$/, "");
  const norm = sinTildes(limpio);
  for (const lugar of LUGARES) {
    if (!norm.endsWith(lugar.clave)) continue;
    const antes = norm.charAt(norm.length - lugar.clave.length - 1);
    if (antes && !/[\s,]/.test(antes)) continue;
    const resto = limpio
      .slice(0, limpio.length - lugar.clave.length)
      .replace(/[,\s]+$/, "");
    const sinCuba = separarLugar(resto); // «Maceo, Holguín, Cuba»
    const base = lugar.nombre === "Cuba" && sinCuba.lugar ? sinCuba : { resto, lugar };
    if (palabrasClave(base.resto.split(/\be\/|\bentre\b/i)[0] ?? "").length === 0) {
      return { resto: q };
    }
    return base;
  }
  return { resto: q };
}

async function photon(
  q: string,
  near: SearchNear | undefined,
  signal?: AbortSignal,
): Promise<PhotonFeature[]> {
  /* Sin sesgo fuerte Photon prima la coincidencia exacta en cualquier
     provincia: «Aguilera» daba la de Holguín estando en Santiago. `zoom` y
     `location_bias_scale` bajos hacen que pese la cercanía. */
  const bias = near
    ? `&lat=${near.lat}&lon=${near.lng}&zoom=12&location_bias_scale=0.1`
    : "";
  const url = `${PHOTON_URL}?q=${encodeURIComponent(q)}&limit=15&bbox=${CUBA_BBOX}${bias}`;
  const data = (await fetchJson(url, 9000, signal)) as {
    features?: PhotonFeature[];
  } | null;
  return data?.features ?? [];
}

/** Búsqueda de direcciones con Photon. Devuelve calles de OSM ordenadas. */
export async function searchAddress(
  query: string,
  signal?: AbortSignal,
  near?: SearchNear,
): Promise<GeocodeSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const { resto, lugar } = separarLugar(q);
  const between = extractBetween(resto);
  // A Photon solo le llega la calle: con «e/ A y B» detrás no encuentra nada.
  const corte = resto.search(/\be\/|\bentre\b/i);
  const calleQ = (corte > 0 ? resto.slice(0, corte) : resto)
    .replace(/[,\s]+$/, "")
    /* OSM en Cuba casi nunca pone «Calle» en el nombre, y con él delante
       Photon no encontraba «Calle Trinidad» en Santiago. Se respeta en las
       numeradas y de una letra («Calle 23», «Calle K»), donde sí forma parte. */
    .replace(/^calle\s+(?=\p{L}{2,})/iu, "");
  const palabras = palabrasClave(calleQ);

  /* «Maceo, Holguín» desde Santiago: manda la ciudad escrita, no la del
     usuario. «Cuba» a secas no es una ciudad y deja el sesgo como estaba. */
  const ciudad =
    lugar?.area && lugar.nombre !== "Cuba"
      ? { lat: lugar.area.lat, lng: lugar.area.lng, city: lugar.nombre }
      : near;

  /* En Santiago la calle es «Francisco Vicente Aguilera (Marina)»: buscando
     «Aguilera» a secas ni sale entre los 15 primeros. Con la ciudad en la
     consulta sí. Si así no queda ninguna calle que contenga lo escrito, se
     repite sin ella (el usuario busca en otra ciudad). */
  let features = ciudad?.city
    ? await photon(`${calleQ} ${ciudad.city}`, ciudad, signal)
    : [];
  let sugerencias = aSugerencias(features, between, palabras);
  if (sugerencias.length === 0) {
    features = await photon(calleQ, ciudad, signal);
    sugerencias = aSugerencias(features, between, palabras);
  }
  return sugerencias.slice(0, 6);
}

function aSugerencias(
  features: PhotonFeature[],
  between: string | null,
  palabras: string[],
): GeocodeSuggestion[] {
  const vistas = new Set<string>();
  return features
    .filter((f) => {
      const p = f.properties;
      const t = p.type;
      const isRoad =
        t === "street" ||
        p.osm_key === "highway" ||
        p.osm_key === "building" ||
        t === "house" ||
        (Boolean(p.housenumber) && Boolean(p.street));
      return (
        isRoad &&
        (!p.country || p.country.toLowerCase() === "cuba") &&
        Number.isFinite(f.geometry.coordinates[0])
      );
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
    // La calle entera antes que un portal suyo con número.
    .sort((a, b) => Number(Boolean(a.housenumber)) - Number(Boolean(b.housenumber)))
    .filter((s) => {
      if (!s.street) return false;
      // La calle tiene que contener lo escrito; «Hostal Heredia» en la calle
      // Saco no es la calle Heredia.
      const calle = sinTildes(s.street);
      if (!palabras.every((w) => calle.includes(w))) return false;
      // OSM parte cada calle en tramos y portales con número: uno por calle
      // y ciudad.
      const base = s.housenumber
        ? calle.slice(0, -s.housenumber.length).trim()
        : calle;
      const ciudad = sinTildes(s.city ?? "").replace(/^ciudad de /, "");
      const clave = `${base}|${ciudad}`;
      if (vistas.has(clave)) return false;
      vistas.add(clave);
      return true;
    });
}

/** Busca ciudades, municipios y pueblos de Cuba para el salto rápido del mapa. */
export async function searchCubaAreas(
  query: string,
): Promise<AreaSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = `${PHOTON_URL}?q=${encodeURIComponent(`${q}, Cuba`)}&limit=10`;
  const data = (await fetchJson(url)) as { features?: PhotonFeature[] } | null;
  if (!data?.features) return [];

  return data.features
    .filter((feature) => {
      const properties = feature.properties;
      const type = properties.type;
      return (
        [
          "city",
          "town",
          "village",
          "municipality",
          "district",
          "suburb",
        ].includes(type ?? "") &&
        properties.country?.toLowerCase() === "cuba" &&
        Number.isFinite(feature.geometry.coordinates[0])
      );
    })
    .map((feature, index) => {
      const properties = feature.properties;
      const name =
        properties.name ?? properties.city ?? properties.district ?? "";
      const province = properties.state ?? properties.city ?? "Cuba";
      return {
        id: `search-${name}-${feature.geometry.coordinates.join("-")}-${index}`,
        name,
        province,
        lat: feature.geometry.coordinates[1]!,
        lng: feature.geometry.coordinates[0]!,
      };
    })
    .filter((area) => area.name.length > 0);
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
