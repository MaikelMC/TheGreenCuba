// Geocoding gratuito sin API key.
//  - Photon (Komoot): búsqueda mientras se escribe. Devuelve calles reales de OSM.
//  - Nominatim (OSM): reverse. Confirma calle/barrio del punto exacto.
// Ambas permiten CORS desde el navegador. Son best-effort: si fallan o están
// offline, el flujo actual (pin manual) sigue funcionando sin geocoder.

import { CUBA_AREAS } from "@/lib/map/cuba-areas";
import {
  buscarCallesOffline,
  guardarCallesProvincia,
  provinciaCercana,
} from "@/lib/map/calles-offline";
import { sinRed } from "@/lib/offline/estado-red";

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
  /** Nombre de la vía tal cual viene de OSM, para comparar tramos. */
  street?: string;
  /** Entre-calles «A y B», solo si las escribió el usuario. */
  between?: string;
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
  /** `santiago-de-cuba`: qué archivo de calles usar sin conexión. Sin él, la
      provincia más cercana al punto. */
  provincia?: string;
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

  /* Sin red, las calles guardadas de la provincia. Sin `ciudad` (sin pin ni
     preferencias) no se sabe qué provincia mirar. */
  const provincia = ciudad
    ? ciudad === near && near?.provincia
      ? near.provincia
      : provinciaCercana(ciudad.lat, ciudad.lng)
    : undefined;
  const sinConexion = () =>
    provincia ? buscarCallesOffline(provincia, palabras, ciudad, between) : [];
  if (typeof navigator !== "undefined" && (!navigator.onLine || sinRed())) {
    return sinConexion();
  }

  try {
    /* En Santiago la calle es «Francisco Vicente Aguilera (Marina)»: buscando
       «Aguilera» a secas ni sale entre los 15 primeros. Con la ciudad en la
       consulta sí. Si así no queda ninguna calle que contenga lo escrito, se
       repite sin ella (el usuario busca en otra ciudad). */
    let features = ciudad?.city
      ? await photon(`${calleQ} ${ciudad.city}`, ciudad, signal)
      : [];
    /* El punto desde el que se mide la cercanía es la ubicación del usuario; si
       escribió otra ciudad («Maceo, Holguín» desde Santiago), manda esa ciudad,
       que es donde están los resultados. */
    let sugerencias = aSugerencias(features, between, palabras, ciudad);
    if (sugerencias.length === 0) {
      features = await photon(calleQ, ciudad, signal);
      sugerencias = aSugerencias(features, between, palabras, ciudad);
    }
    // Hay red y el usuario busca direcciones: se guarda su provincia para luego.
    if (provincia) void guardarCallesProvincia(provincia);
    return sugerencias.slice(0, 6);
  } catch (error) {
    if (signal?.aborted) throw error;
    /* `navigator.onLine` miente en las redes cubanas con IP y sin internet, y
       Photon a veces da 503: se cae a lo guardado antes que a nada. */
    const locales = await sinConexion();
    if (locales.length > 0) return locales;
    throw error;
  }
}

/** Distancia en km entre dos puntos. Para ordenar por cercanía. */
function distanciaKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const RAD = Math.PI / 180;
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Escalón de la coincidencia: 0 si la calle lleva la palabra escrita tal cual,
 * 1 si la lleva al principio de otra («Martí» → «Martínez») y 2 si solo la
 * contiene. Separa coincidencias de distinta calidad sin mirar la distancia.
 */
function escalon(street: string, palabras: string[]): number {
  const primera = palabras[0];
  if (!primera) return 0;
  const tokens = sinTildes(street).split(/[^a-z0-9ñ]+/);
  if (tokens.includes(primera)) return 0;
  if (tokens.some((token) => token.startsWith(primera))) return 1;
  return 2;
}

/**
 * Ordena las sugerencias de calle por cercanía a la ubicación del usuario.
 *
 * Photon ordena por relevancia y su sesgo de ubicación es suave
 * (`location_bias_scale=0.1`), así que «Aguilera» podía enseñar primero la de
 * otra provincia estando en Santiago. Aquí manda la distancia al punto de
 * referencia; el escalón de coincidencia solo desempata entre calidades
 * distintas, igual que en la búsqueda sin conexión (`calles-offline.ts`). Sin
 * `cerca` —ni pin ni ciudad— se respeta el orden del proveedor.
 *
 * Exportada para poder probarla sin red.
 */
export function ordenarSugerencias(
  sugerencias: GeocodeSuggestion[],
  {
    palabras,
    cerca,
  }: { palabras: string[]; cerca?: { lat: number; lng: number } },
): GeocodeSuggestion[] {
  return [...sugerencias].sort((a, b) => {
    const porEscalon = escalon(a.street, palabras) - escalon(b.street, palabras);
    if (porEscalon !== 0) return porEscalon;
    if (cerca) {
      const porCercania = distanciaKm(cerca, a) - distanciaKm(cerca, b);
      if (porCercania !== 0) return porCercania;
    }
    // La calle entera antes que un portal suyo con número.
    return Number(Boolean(a.housenumber)) - Number(Boolean(b.housenumber));
  });
}

function aSugerencias(
  features: PhotonFeature[],
  between: string | null,
  palabras: string[],
  cerca?: { lat: number; lng: number },
): GeocodeSuggestion[] {
  const vistas = new Set<string>();
  const sugerencias = features
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
    });

  /* Se ordena **antes** de quitar duplicados a propósito: de cada calle se
     conserva su tramo más cercano, y no el que Photon colocó en cabeza. */
  return ordenarSugerencias(sugerencias, { palabras, cerca }).filter((s) => {
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

/**
 * Convierte el `address` de Nominatim en lo que rellena el formulario.
 *
 * Los nombres se copian **tal cual** de OSM. Antes se les quitaban los dígitos
 * del principio para «limpiar números de casa», pero Nominatim manda el número
 * aparte (`house_number`), así que lo único que se quitaba era parte del
 * nombre: «5ta Avenida» salía «ta Avenida» y el reparto «30 de Noviembre»,
 * «de Noviembre». Una dirección inventada por recorte.
 *
 * Las entre-calles no salen de aquí: Nominatim no las da y no se deducen. Solo
 * aparecen si el usuario las escribe («e/ A y B»).
 *
 * Exportada para poder probarla sin red.
 */
export function resolverNominatim(
  addr: Record<string, string> | undefined,
): ResolvedLocation | null {
  if (!addr || addr.country_code !== "cu") return null;

  const street = (addr.road ?? addr.pedestrian ?? addr.footway ?? "").trim();
  const barrio = (
    addr.suburb ??
    addr.neighbourhood ??
    addr.quarter ??
    addr.city_district ??
    addr.district ??
    ""
  ).trim();
  const city =
    addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? "";
  if (!street && !barrio) return null;

  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];
  const address = uniq([street, barrio, city]).join(", ");
  const label = uniq([street || barrio, city]).join(" · ");
  return { address, barrio, label, street: street || undefined };
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
  return resolverNominatim(data?.address);
}

/**
 * Mantiene las entre-calles que el usuario escribió al buscar cuando después
 * solo ajusta el pin **en la misma calle**. Si el pin pasa a otra calle, las
 * entre-calles de la anterior ya no son de este punto y se descartan.
 */
export function conservarEntreCalles(
  nueva: ResolvedLocation | null,
  anterior: ResolvedLocation | null,
): ResolvedLocation | null {
  if (!nueva?.street || nueva.between || !anterior?.between) return nueva;
  if (sinTildes(nueva.street) !== sinTildes(anterior.street ?? "")) return nueva;
  return {
    ...nueva,
    between: anterior.between,
    address: nueva.address.replace(
      nueva.street,
      `${nueva.street}, e/ ${anterior.between}`,
    ),
  };
}

/**
 * Qué valor queda en un campo del formulario (dirección o barrio) cuando el
 * selector resuelve un punto nuevo.
 *
 * - Lo que el usuario escribió o ya venía guardado **no se pisa nunca**.
 * - Lo que rellenó el selector antes se sustituye por lo del punto nuevo.
 * - Si el punto nuevo no tiene calle conocida, o la consulta falla, el
 *   relleno automático anterior se vacía: era de otro sitio, y dejarlo
 *   mostraría una calle que no es la del pin.
 *
 * `anterior` es el último valor que el propio selector rellenó.
 */
export function campoResuelto(
  actual: string,
  nuevo: string | undefined,
  anterior: string | undefined,
): string {
  const escritoAMano = actual.trim() !== "" && actual !== anterior;
  if (escritoAMano) return actual;
  return nuevo ?? "";
}
