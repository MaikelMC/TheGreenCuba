export interface RouteResult {
  coordinates: [number, number][];
  distanceM: number;
  durationSec: number;
}

export interface RoutePoint {
  lat: number;
  lng: number;
}

const OSRM_ENDPOINT = "https://router.project-osrm.org/route/v1/driving";
const OSRM_TIMEOUT_MS = 8000;

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
    const coords = `${origin.lng},${origin.lat};${dest.lng},${dest.lat}`;
    const url = `${OSRM_ENDPOINT}/${coords}?overview=full&geometries=geojson`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(OSRM_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      code?: string;
      routes?: { distance?: number; duration?: number; geometry?: { coordinates?: number[][] } }[];
    };
    if (data.code !== "Ok" || !data.routes?.length) return null;
    const route = data.routes[0]!;
    const geometry = route.geometry?.coordinates;
    if (!geometry || geometry.length < 2) return null;
    const coordinates = geometry.map(
      ([lng, lat]) => [lat, lng] as [number, number],
    );
    return {
      coordinates,
      distanceM: route.distance ?? haversineM(origin, dest),
      durationSec: route.duration ?? 0,
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
