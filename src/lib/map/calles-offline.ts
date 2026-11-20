import { CUBA_PROVINCES, locationCenter } from "@/lib/user-preferences-store";
import type { GeocodeSuggestion } from "@/lib/map/geocode";

/**
 * Búsqueda de calles sin conexión.
 *
 * Con red se busca en Photon. Sin red se busca en `public/calles/<provincia>.json`
 * (lo genera `scripts/calles-offline.ts` a partir de OSM): las calles con nombre
 * de la provincia, ~25 KB comprimido. Solo se guarda la provincia del usuario,
 * la primera vez que busca una dirección con red o al abrir la app instalada.
 *
 * La caché va **sin** el prefijo `lv-`: el `activate` del service worker borra
 * las `lv-*` que no conoce, y esta no es suya.
 */

const CACHE = "calles-v1";

type Archivo = {
  v: 1;
  pueblos: string[];
  calles: [nombre: string, lat: number, lng: number, pueblo: number][];
};

type Indice = { archivo: Archivo; normalizados: string[] };

const sinTildes = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const indices = new Map<string, Promise<Indice | null>>();
const guardadas = new Set<string>();

const PROVINCIAS = new Set(CUBA_PROVINCES.map((p) => p.value));

/** Provincia más cercana a un punto, por el centro de cada una. */
export function provinciaCercana(lat: number, lng: number): string {
  let mejor = "la-habana";
  let distancia = Infinity;
  for (const { value } of CUBA_PROVINCES) {
    const [pLat, pLng] = locationCenter(value);
    const d = (pLat - lat) ** 2 + (pLng - lng) ** 2;
    if (d < distancia) {
      distancia = d;
      mejor = value;
    }
  }
  return mejor;
}

/** El `location` de las preferencias como provincia; los valores viejos se traducen. */
export function provinciaDePreferencia(location: string, lat: number, lng: number): string {
  if (location === "santiago") return "santiago-de-cuba";
  if (location === "varadero") return "matanzas";
  return PROVINCIAS.has(location) ? location : provinciaCercana(lat, lng);
}

const url = (provincia: string) => `/calles/${provincia}.json`;

/*
 * `requestIdleCallback` no existe en Safari; sin él se usa un retraso corto. El
 * tope de 4 s evita que una pestaña muy ocupada aplace la tarea para siempre.
 */
function cuandoHayaHueco(tarea: () => void): void {
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => tarea(), { timeout: 4000 });
    return;
  }
  setTimeout(tarea, 1500);
}

/** El usuario pidió ahorro de datos: no se descarga nada por detrás. */
function ahorraDatos(): boolean {
  if (typeof navigator === "undefined") return false;
  /* `connection` es de Chromium y no está en los tipos del DOM estándar; se lee
     con la misma forma que en `/home`. */
  const conexion = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return conexion?.saveData === true;
}

/**
 * Descarga y guarda la provincia si aún no está. Silencioso: es una mejora.
 *
 * No descarga en el acto: espera a que el navegador esté libre. La llamada sale
 * justo después de una búsqueda de dirección con red —lo que más usa el
 * usuario— y el archivo más pesado (La Habana) son 50 KB comprimidos; bajarlo
 * ahí competía con Photon y con el mapa. Aplazarlo no cuesta nada: la copia
 * solo hace falta cuando se busca sin conexión.
 */
export function guardarCallesProvincia(provincia: string): void {
  if (guardadas.has(provincia) || typeof caches === "undefined") return;
  if (ahorraDatos()) return; // sin marcar: si lo desactiva, se reintenta
  guardadas.add(provincia);
  cuandoHayaHueco(() => void descargarProvincia(provincia));
}

async function descargarProvincia(provincia: string): Promise<void> {
  try {
    const cache = await caches.open(CACHE);
    if (!(await cache.match(url(provincia)))) {
      /* `low` para que no le quite ancho de banda a lo que se está viendo. */
      const res = await fetch(url(provincia), { priority: "low" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await cache.put(url(provincia), res);
    }
    /* La primera búsqueda sin red pagaba el parseo y la normalización de los
       nombres en el hilo principal (La Habana: ~5 000 calles). Se adelanta al
       hueco libre, así el primer tecleo sin conexión ya encuentra el índice. */
    cuandoHayaHueco(() => void indiceDe(provincia));
  } catch {
    guardadas.delete(provincia); // se reintenta en la siguiente búsqueda con red
  }
}

async function cargar(provincia: string): Promise<Indice | null> {
  try {
    const guardada =
      typeof caches !== "undefined"
        ? await caches.open(CACHE).then((c) => c.match(url(provincia)))
        : undefined;
    const res = guardada ?? (await fetch(url(provincia)));
    if (!res.ok) return null;
    const archivo = (await res.json()) as Archivo;
    if (archivo.v !== 1) return null;
    return { archivo, normalizados: archivo.calles.map((c) => sinTildes(c[0])) };
  } catch {
    return null;
  }
}

/** Índice de una provincia; el parseo se comparte y un fallo no se recuerda. */
function indiceDe(provincia: string): Promise<Indice | null> {
  let indice = indices.get(provincia);
  if (!indice) {
    indice = cargar(provincia);
    indices.set(provincia, indice);
    void indice.then((i) => {
      if (!i) indices.delete(provincia);
    });
  }
  return indice;
}

/**
 * Calles de la provincia que contienen todas las palabras, las que empiezan
 * por lo escrito primero y luego por cercanía.
 */
export async function buscarCallesOffline(
  provincia: string,
  palabras: string[],
  cerca: { lat: number; lng: number } | undefined,
  between: string | null,
): Promise<GeocodeSuggestion[]> {
  if (palabras.length === 0) return [];
  const datos = await indiceDe(provincia);
  if (!datos) return [];

  const { archivo, normalizados } = datos;
  const primera = palabras[0]!;
  const encontradas: { i: number; peso: number }[] = [];
  normalizados.forEach((nombre, i) => {
    if (!palabras.every((w) => nombre.includes(w))) return;
    const [, lat, lng] = archivo.calles[i]!;
    const distancia = cerca ? (lat - cerca.lat) ** 2 + (lng - cerca.lng) ** 2 : 0;
    /* Palabra exacta («Martí») antes que prefijo («Martínez») y prefijo antes
       que contenida. Cada escalón pesa más que cualquier distancia dentro de
       la provincia (como mucho ~4 grados²). */
    const tokens = nombre.split(/[^a-z0-9ñ]+/);
    const escalon = tokens.includes(primera)
      ? 0
      : tokens.some((t) => t.startsWith(primera))
        ? 50
        : 100;
    encontradas.push({ i, peso: escalon + distancia });
  });

  return encontradas
    .sort((a, b) => a.peso - b.peso)
    .slice(0, 6)
    .map(({ i }) => {
      const [nombre, lat, lng, p] = archivo.calles[i]!;
      const city = archivo.pueblos[p] ?? "";
      return {
        lat,
        lng,
        street: nombre,
        city,
        district: "",
        between: between ?? undefined,
        label: [nombre, city].filter(Boolean).join(", "),
      };
    });
}
