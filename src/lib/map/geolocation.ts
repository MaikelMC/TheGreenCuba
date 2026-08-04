export type GeolocationErrorCode =
  | "unsupported"
  | "denied"
  | "timeout"
  | "unavailable"
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
  unknown: "Error inesperado al obtener tu ubicación.",
};

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
        savePosition(position);
        resolve(position);
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
