/** Centro por defecto: La Habana. MapLibre usa [lng, lat]. */
export const HAVANA_CENTER: [number, number] = [-82.359, 23.1374];

export const DEFAULT_ZOOM = 13;
export const MIN_ZOOM = 5;
/** Zoom máximo visible. MapLibre amplía digitalmente por encima del máximo de teselas. */
export const MAX_ZOOM = 19;
/** Zoom al centrar en la ubicación del usuario. */
export const GEO_ZOOM = 15;

/**
 * Límites de Cuba con margen, para maxBounds.
 *
 * Evita que el usuario navegue fuera de Cuba y gaste datos en teselas que
 * no sirven para esta app. El margen (~1°) permite que el mapa siga dando
 * perspectiva en las esquinas del país.
 */
export const CUBA_BOUNDS: [[number, number], [number, number]] = [
  [-85.5, 19.5],  // suroeste: longitud mín, latitud mín
  [-73.5, 23.5],  // noreste:  longitud máx, latitud máx
];

/**
 * URL del estilo MapLibre completo (teselas + fuentes + sprite).
 *
 * Liberty de OpenFreeMap = esquema OpenMapTiles + todo incluido.
 * Futuro: apuntar al estilo propio cuando el VPS esté listo.
 */
export const LIBERTY_STYLE_URL =
  process.env.NEXT_PUBLIC_MAPA_ESTILO ?? "https://tiles.openfreemap.org/styles/liberty";

/**
 * Atribución que muestra el control compacto.
 *
 * Mientras las teselas vengan de OpenFreeMap: las tres fuentes.
 * Cuando vengan del VPS: solo las dos últimas.
 */
export const MAP_ATTRIBUTION =
  "OpenFreeMap &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors &copy; <a href='https://openmaptiles.org/' target='_blank'>OpenMapTiles</a>";
