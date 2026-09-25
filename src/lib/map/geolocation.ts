import { CUBA_PROVINCES, locationCenter } from "@/lib/user-preferences-store";

export type GeolocationErrorCode =
  | "unsupported"
  | "denied"
  | "timeout"
  | "unavailable"
  | "imprecise"
  | "unknown";

export interface GeolocationError extends Error {
  code: GeolocationErrorCode;
}

export interface UserPosition {
  lat: number;
  lng: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface GetPositionOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  /** Use a fresh cached position (default true) to avoid prompting the user repeatedly. */
  useCache?: boolean;
}

const DEFAULT_OPTIONS: GetPositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 120000,
  useCache: true,
};

const CACHE_KEY = "la-verde:last-position";
export const USER_LOCATION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const GEO_ERROR_MESSAGES: Record<GeolocationErrorCode, string> = {
  unsupported: "Tu navegador no soporta geolocalización.",
  denied:
    "Permiso de ubicación denegado. Actívalo en los ajustes del navegador y vuelve a intentarlo.",
  timeout: "No se pudo obtener tu ubicación. Revisa tu conexión e inténtalo de nuevo.",
  unavailable: "Tu ubicación no está disponible en este momento.",
  imprecise:
    "Tu ubicación aproximada es demasiado imprecisa (típico de Wi-Fi o IP). Usa el GPS del móvil o elige tu zona en el buscador.",
  unknown: "Error inesperado al obtener tu ubicación.",
};

/**
 * Precisión máxima (en metros) que aceptamos como ubicación útil.
 * En Cuba y en móviles con Wi‑Fi/IP o cobertura débil, una lectura de 1–5 km
 * sigue siendo válida para centrar la vista en una ciudad/provincia. Si se
 * pasa mucho de ese valor, sí que es demasiado imprecisa para mover el mapa a
 * otra provincia.
 */
export const MAX_ACCURACY_M = 5000;

function isAccurate(accuracy: number): boolean {
  return Number.isFinite(accuracy) && accuracy <= MAX_ACCURACY_M;
}

export function isGeolocationSupported(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

function makeError(code: GeolocationErrorCode, message?: string): GeolocationError {
  const err = new Error(message ?? GEO_ERROR_MESSAGES[code]) as GeolocationError;
  err.code = code;
  return err;
}

function mapPositionError(code: number | undefined): GeolocationErrorCode {
  switch (code) {
    case 1:
      return "denied";
    case 2:
      return "unavailable";
    case 3:
      return "timeout";
    default:
      return "unknown";
  }
}

/** Returns the last known position if it is still fresh (within the TTL). */
export function getLastKnownPosition(): UserPosition | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserPosition & { savedAt: number };
    const validCoordinates =
      Number.isFinite(parsed.lat) &&
      Number.isFinite(parsed.lng) &&
      parsed.lat >= -90 &&
      parsed.lat <= 90 &&
      parsed.lng >= -180 &&
      parsed.lng <= 180;
    const validMetadata =
      Number.isFinite(parsed.accuracy) &&
      Number.isFinite(parsed.timestamp) &&
      Number.isFinite(parsed.savedAt);

    if (!validCoordinates || !validMetadata || Date.now() - parsed.savedAt > USER_LOCATION_CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    const { savedAt: _savedAt, ...pos } = parsed;
    return pos;
  } catch {
    return null;
  }
}

function savePosition(pos: UserPosition): void {
  // Solo guardamos fixes fiables: cachear una lectura por IP/Wi-Fi envenenaría
  // la próxima carga y desplazaría el mapa a otra ciudad.
  if (!isAccurate(pos.accuracy)) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...pos, savedAt: Date.now() }));
  } catch {
    // localStorage unavailable (privacy mode / SSR) — ignore
  }
}

export function clearCachedPosition(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Robust one-shot geolocation. Resolves with the position (cached or fresh)
 * and rejects with a `GeolocationError` carrying a friendly error code.
 */
export function getCurrentPosition(
  options: GetPositionOptions = {},
): Promise<UserPosition> {
  const opts: Required<GetPositionOptions> = {
    enableHighAccuracy:
      options.enableHighAccuracy ?? DEFAULT_OPTIONS.enableHighAccuracy ?? true,
    timeout: options.timeout ?? DEFAULT_OPTIONS.timeout ?? 10000,
    maximumAge: options.maximumAge ?? DEFAULT_OPTIONS.maximumAge ?? 120000,
    useCache: options.useCache ?? DEFAULT_OPTIONS.useCache ?? true,
  };

  if (opts.useCache) {
    const cached = getLastKnownPosition();
    if (cached) return Promise.resolve(cached);
  }

  if (!isGeolocationSupported()) {
    return Promise.reject(makeError("unsupported"));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const position: UserPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          altitudeAccuracy: pos.coords.altitudeAccuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        };
        if (isAccurate(position.accuracy)) {
          savePosition(position);
          resolve(position);
          return;
        }
        // Lectura imprecisa: un fix bueno ya guardado es mejor que volar el mapa
        // a un punto que puede estar a cientos de km.
        const cached = getLastKnownPosition();
        if (cached) {
          resolve(cached);
          return;
        }
        reject(makeError("imprecise"));
      },
      (err) => {
        reject(makeError(mapPositionError(err?.code), err?.message));
      },
      {
        enableHighAccuracy: opts.enableHighAccuracy,
        timeout: opts.timeout,
        maximumAge: opts.maximumAge,
      },
    );
  });
}

export interface DetectedProvince {
  value: string;
  label: string;
}

/** Las 16 provincias contra las que se compara la posición GPS, con el centro
 * que ya usa el mapa (`locationCenter`). Antes eran dos —La Habana y
 * Varadero—, así que pulsar «Usar mi ubicación actual» desde Holguín devolvía
 * «Otra ciudad» y el mapa volaba a La Habana.
 *
 * No se fuerza una provincia por defecto: si no hay un fix válido o la persona
 * ya tenía una ubicación guardada, esa zona debe seguir siendo la que se
 * muestre. */
const ONBOARDING_PROVINCES = CUBA_PROVINCES.map(({ value, label }) => {
  const [lat, lng] = locationCenter(value);
  return { value, label, lat, lng };
});

/** Distancia máxima (km) para considerar que el GPS cae dentro de una provincia.
 *
 * Los 65 km de antes valían con dos ciudades; con las 16 capitales, que quedan a
 * unos 90-100 km entre sí, dejaban fuera a media isla. Cuba mide unos 1.200 km
 * de punta a punta, así que 150 km cubren el país entero y siguen dejando fuera
 * a quien no está en Cuba. */
const DETECT_MAX_KM = 150;

function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Mapea una posición GPS a la provincia del onboarding más cercana.
 * Si ninguna queda dentro de DETECT_MAX_KM devuelve "otra".
 */
export function detectNearestProvince(lat: number, lng: number): DetectedProvince {
  const first = ONBOARDING_PROVINCES[0];
  if (!first) return { value: "otra", label: "Otra ciudad" };
  let best = first;
  let bestKm = Infinity;
  for (const province of ONBOARDING_PROVINCES) {
    const km = haversineKm(lat, lng, province.lat, province.lng);
    if (km < bestKm) {
      bestKm = km;
      best = province;
    }
  }
  if (bestKm <= DETECT_MAX_KM) return { value: best.value, label: best.label };
  return { value: "otra", label: "Otra ciudad" };
}
