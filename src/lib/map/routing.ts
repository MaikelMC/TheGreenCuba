export interface RouteResult {
  coordinates: [number, number][];
  distanceM: number;
  durationSec: number;
}

export interface RoutePoint {
  lat: number;
  lng: number;
}

/* La ruta la calcula el servidor, en `/api/route`. Antes se llamaba a OSRM
   desde aquí, desde el navegador, y el CSP del sitio (`connect-src 'self'`) lo
   bloqueaba en producción: el mapa caía al respaldo de línea recta y el error
   no mencionaba el CSP por ninguna parte. */
const ROUTE_API = "/api/route";
// Más que el timeout del servidor (8 s) a propósito: así el que corta es él,
// que puede devolver un error con sentido, y no un aborto del lado del cliente.
const ROUTE_TIMEOUT_MS = 12000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Distancia en metros entre dos puntos. La usan las rutas y los filtros. */
export function haversineM(a: RoutePoint, b: RoutePoint): number {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function fetchDrivingRoute(
  origin: RoutePoint,
  dest: RoutePoint,
): Promise<RouteResult | null> {
  try {
    const url = `${ROUTE_API}?from=${origin.lat},${origin.lng}&to=${dest.lat},${dest.lng}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(ROUTE_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      ok?: boolean;
      coordinates?: [number, number][];
      distanceM?: number;
      durationSec?: number;
    };
    if (data.ok !== true || !data.coordinates || data.coordinates.length < 2) {
      return null;
    }
    return {
      coordinates: data.coordinates,
      distanceM: data.distanceM ?? haversineM(origin, dest),
      durationSec: data.durationSec ?? 0,
    };
  } catch {
    return null;
  }
}

export function buildDirectRoute(
  origin: RoutePoint,
  dest: RoutePoint,
): RouteResult {
  const distanceM = haversineM(origin, dest);
  const walkingSpeedMs = 1.4;
  return {
    coordinates: [
      [origin.lat, origin.lng],
      [dest.lat, dest.lng],
    ],
    distanceM,
    durationSec: Math.round(distanceM / walkingSpeedMs),
  };
}

export function formatDistanceM(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
  return `${Math.round(meters)} m`;
}

export function formatDurationSec(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) return `${Math.max(1, totalMinutes)} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h} h ${m.toString().padStart(2, "0")}` : `${h} h`;
}

export function buildGoogleMapsUrl(origin: RoutePoint, dest: RoutePoint): string {
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${dest.lat},${dest.lng}`,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
