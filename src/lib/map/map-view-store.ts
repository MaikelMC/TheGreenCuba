/**
 * La última vista del mapa del home: centro y zoom.
 *
 * Cada vez que se sale del home hacia otra sección o a la ficha de un negocio,
 * el mapa se desmonta y vuelve a montarse al regresar. Sin recordar dónde
 * estaba, la vuelta empezaba en el centro de la provincia y borraba el
 * encuadre que el usuario había dejado. `sessionStorage` es el alcance
 * correcto: es la misma pestaña, no una preferencia permanente —al abrir la
 * app de nuevo, la primera vista sigue siendo la ciudad del perfil—.
 */

export interface SavedMapView {
  lat: number;
  lng: number;
  zoom: number;
  /**
   * Provincia del perfil cuando se guardó la vista.
   *
   * Se compara al restaurar: si el usuario cambió de provincia en Ajustes,
   * volver al home debe llevar a la provincia nueva, no al encuadre de la
   * anterior.
   */
  location: string | null;
}

const STORAGE_KEY = "la-verde:map-view";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function readMapView(location?: string | null): SavedMapView | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const {
      lat,
      lng,
      zoom,
      location: savedLocation,
    } = parsed as Record<string, unknown>;
    if (!isFiniteNumber(lat) || lat < -90 || lat > 90) return null;
    if (!isFiniteNumber(lng) || lng < -180 || lng > 180) return null;
    if (!isFiniteNumber(zoom) || zoom < 1 || zoom > 22) return null;
    if (
      (typeof savedLocation === "string" ? savedLocation : null) !==
      (location ?? null)
    ) {
      return null;
    }
    return {
      lat,
      lng,
      zoom,
      location: typeof savedLocation === "string" ? savedLocation : null,
    };
  } catch {
    return null;
  }
}

export function saveMapView(
  lat: number,
  lng: number,
  zoom: number,
  location?: string | null,
): void {
  if (typeof window === "undefined") return;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !Number.isFinite(zoom)
  ) {
    return;
  }
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        lat,
        lng,
        zoom,
        location: typeof location === "string" ? location : null,
      } satisfies SavedMapView),
    );
  } catch {
    // sessionStorage no disponible (modo privacidad) — se ignora, como en el
    // resto de almacenes del proyecto.
  }
}
