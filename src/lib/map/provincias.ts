/**
 * Provincias de Cuba: normalización de nombres y detección por coordenadas.
 *
 * La URL del endpoint usa claves en ASCII sin acentos (ej. "santiago-de-cuba").
 * La columna `province` de la tabla `places` usa el nombre con tildes
 * (ej. "Santiago de Cuba"). Este módulo traduce entre los dos.
 *
 * La detección por coordenadas es "provincia más cercana a su capital":
 * aproximación suficiente para un país alargado con capitales bien separadas.
 * No usa GIS; es intencional —sin dependencias nuevas—.
 */

export interface Provincia {
  slug: string;
  nombre: string;
  /** Coordenadas de referencia (capital o ciudad principal). */
  lat: number;
  lng: number;
}

export const PROVINCIAS: Provincia[] = [
  { slug: "pinar-del-rio",       nombre: "Pinar del Río",       lat: 22.412,  lng: -83.696 },
  { slug: "artemisa",            nombre: "Artemisa",             lat: 22.813,  lng: -82.762 },
  { slug: "la-habana",           nombre: "La Habana",            lat: 23.137,  lng: -82.359 },
  { slug: "mayabeque",           nombre: "Mayabeque",            lat: 22.838,  lng: -82.027 },
  { slug: "matanzas",            nombre: "Matanzas",             lat: 23.041,  lng: -81.576 },
  { slug: "cienfuegos",          nombre: "Cienfuegos",           lat: 22.146,  lng: -80.436 },
  { slug: "villa-clara",         nombre: "Villa Clara",          lat: 22.407,  lng: -79.965 },
  { slug: "sancti-spiritus",     nombre: "Sancti Spíritus",      lat: 21.930,  lng: -79.443 },
  { slug: "ciego-de-avila",      nombre: "Ciego de Ávila",       lat: 21.849,  lng: -78.761 },
  { slug: "camaguey",            nombre: "Camagüey",             lat: 21.379,  lng: -77.916 },
  { slug: "las-tunas",           nombre: "Las Tunas",            lat: 20.967,  lng: -76.950 },
  { slug: "holguin",             nombre: "Holguín",              lat: 20.888,  lng: -76.257 },
  { slug: "granma",              nombre: "Granma",               lat: 20.379,  lng: -76.643 },
  { slug: "santiago-de-cuba",    nombre: "Santiago de Cuba",     lat: 20.014,  lng: -75.826 },
  { slug: "guantanamo",          nombre: "Guantánamo",           lat: 20.145,  lng: -75.209 },
  { slug: "isla-de-la-juventud", nombre: "Isla de la Juventud",  lat: 21.885,  lng: -82.802 },
];

/** Map inverso: nombre con tildes → slug */
const NOMBRE_A_SLUG = new Map<string, string>(
  PROVINCIAS.map((p) => [p.nombre.toLowerCase(), p.slug]),
);

/** Map directo: slug → provincia */
const SLUG_A_PROVINCIA = new Map<string, Provincia>(
  PROVINCIAS.map((p) => [p.slug, p]),
);

/** `"Santiago de Cuba"` → `"santiago-de-cuba"` | `null` */
export function slugDeProvincia(nombre: string): string | null {
  return NOMBRE_A_SLUG.get(nombre.toLowerCase()) ?? null;
}

/** `"santiago-de-cuba"` → Provincia | `null` */
export function provinciaDeSlog(slug: string): Provincia | null {
  return SLUG_A_PROVINCIA.get(slug) ?? null;
}

/** `"santiago-de-cuba"` → `"Santiago de Cuba"` | `null` */
export function nombreDeSlog(slug: string): string | null {
  return SLUG_A_PROVINCIA.get(slug)?.nombre ?? null;
}

/** Distancia cuadrática (sin raíz: solo para comparar). */
function dist2(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dlat = lat1 - lat2;
  const dlng = lng1 - lng2;
  return dlat * dlat + dlng * dlng;
}

/**
 * Provincia más cercana a las coordenadas dadas.
 *
 * Devuelve siempre una provincia (hay 16 y Cuba está contenida en su bounding
 * box). Nunca devuelve `null`.
 */
export function provinciaDeCoordenadas(lat: number, lng: number): Provincia {
  let mejor = PROVINCIAS[0]!;
  let mejorDist = dist2(lat, lng, mejor.lat, mejor.lng);

  for (let i = 1; i < PROVINCIAS.length; i++) {
    const p = PROVINCIAS[i]!;
    const d = dist2(lat, lng, p.lat, p.lng);
    if (d < mejorDist) {
      mejorDist = d;
      mejor = p;
    }
  }

  return mejor;
}
