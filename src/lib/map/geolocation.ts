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
 * Precisión máxima (en metros) que aceptamos como ubicación real.
 * Un navegador de escritorio sin GPS resuelve por Wi-Fi/IP y puede devolver un
 * punto a cientos de km con una precisión declarada de kilómetros. Preferimos
 * rechazar esa lectura antes que mover el mapa a otra ciudad.
 * ponytail: umbral fijo; súbelo si en móvil llega a rechazar fixes buenos en interiores.
 */
export const MAX_ACCURACY_M = 1000;

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
    if (Date.now() - parsed.savedAt > USER_LOCATION_CACHE_TTL) {
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

export interface DetectedCity {
  value: string;
  label: string;
}

/** Ciudades elegibles del onboarding contra las que se compara la posición GPS. */
const ONBOARDING_CITIES: { value: string; label: string; lat: number; lng: number }[] = [
  { value: "la-habana", label: "La Habana", lat: 23.1374, lng: -82.359 },
  { value: "santiago", label: "Santiago de Cuba", lat: 20.0207, lng: -75.8267 },
  { value: "varadero", label: "Varadero", lat: 23.1547, lng: -81.2377 },
];

/** Distancia máxima (km) para considerar que el GPS cae dentro de una ciudad. */
const DETECT_MAX_KM = 65;

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
 * Mapea una posición GPS a la ciudad del onboarding más cercana.
 * Si ninguna queda dentro de DETECT_MAX_KM devuelve "otra".
 */
export function detectNearestCity(lat: number, lng: number): DetectedCity {
  const first = ONBOARDING_CITIES[0];
  if (!first) return { value: "otra", label: "Otra ciudad" };
  let best = first;
  let bestKm = Infinity;
  for (const city of ONBOARDING_CITIES) {
    const km = haversineKm(lat, lng, city.lat, city.lng);
    if (km < bestKm) {
      bestKm = km;
      best = city;
    }
  }
  if (bestKm <= DETECT_MAX_KM) return { value: best.value, label: best.label };
  return { value: "otra", label: "Otra ciudad" };
}
