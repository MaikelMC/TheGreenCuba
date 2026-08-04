export interface LatLng {
  lat: number;
  lng: number;
}

export interface CubaBounds {
  north: number;
  south: number;
  west: number;
  east: number;
}

/** Approximate bounding box of Cuba (includes Isla de la Juventud). */
export const CUBA_BOUNDING_BOX: CubaBounds = {
  north: 23.3,
  south: 19.8,
  west: -84.96,
  east: -74.13,
};

export type LandRectangle = [north: number, south: number, west: number, east: number];

/**
 * Coarse land approximation: rectangles tracing Cuba's main island and
 * Isla de la Juventud. Good enough to filter points clearly in the sea.
 * Precise land/sea validation should be done when creating/editing a business.
 */
export const CUBA_LAND_RECTANGLES: LandRectangle[] = [
  // Western Cuba (Pinar del Río → La Habana → Matanzas oeste)
  [23.2, 22.2, -84.95, -81.55],
  // Cinturón de La Habana (franja norte más fina)
  [23.16, 22.85, -82.6, -82.05],
  // Centro de Cuba (Matanzas este → Cienfuegos → Villa Clara → Sancti Spíritus → Ciego → Camagüey)
  [23.05, 21.3, -81.55, -77.55],
  // Franja norte-centro (costa norte / ciudades del norte)
  [22.85, 22.1, -80.2, -77.55],
  // Oriente (Camagüey este → Granma → Holguín → Santiago → Guantánamo)
  [21.1, 19.82, -77.55, -74.15],
  // Franja sur (zona de Manzanillo)
  [21.55, 20.1, -78.4, -77.1],
  // Isla de la Juventud
  [21.97, 21.55, -83.2, -82.45],
];

export function isFiniteCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng);
}

export function isWithinCubaBoundingBox(lat: number, lng: number): boolean {
  const { north, south, west, east } = CUBA_BOUNDING_BOX;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}

export function isApproximatelyOnLand(lat: number, lng: number): boolean {
  return CUBA_LAND_RECTANGLES.some(
    ([north, south, west, east]) =>
      lat <= north && lat >= south && lng >= west && lng <= east,
  );
}

export function isValidCubaCoordinate(lat: number, lng: number): boolean {
  return (
    isFiniteCoordinate(lat, lng) &&
    isWithinCubaBoundingBox(lat, lng) &&
    isApproximatelyOnLand(lat, lng)
  );
}

export type CoordinateValidationReason = "invalid" | "out-of-bounds" | "at-sea";

export interface CoordinateValidation {
  valid: boolean;
  reason?: CoordinateValidationReason;
}

export function validatePlaceCoordinates(
  lat: number,
  lng: number,
): CoordinateValidation {
  if (!isFiniteCoordinate(lat, lng)) return { valid: false, reason: "invalid" };
  if (!isWithinCubaBoundingBox(lat, lng)) return { valid: false, reason: "out-of-bounds" };
  if (!isApproximatelyOnLand(lat, lng)) return { valid: false, reason: "at-sea" };
  return { valid: true };
}

/** Filters out places with coordinates clearly outside Cuba or in the sea. */
export function filterValidPlaces<T extends LatLng>(places: T[]): T[] {
  return places.filter((p) => isValidCubaCoordinate(p.lat, p.lng));
}
