export interface TileConfig {
  url: string;
  attribution: string;
  maxZoom: number;
  label: string;
  subdomains?: string;
}

export const TILE_CONFIGS: Record<string, TileConfig> = {
  voyager: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>, &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
    label: "CartoDB Voyager",
    subdomains: "abcd",
  },
  positron: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>, &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
    label: "CartoDB Positron",
    subdomains: "abcd",
  },
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
    label: "OpenStreetMap",
    subdomains: "abc",
  },
};

export const DEFAULT_TILE = "voyager";

export const HAVANA_CENTER: [number, number] = [23.1374, -82.359];

export const DEFAULT_ZOOM = 13;
export const MIN_ZOOM = 10;
/** Lower max zoom = faster loading on slow connections. */
export const MAX_ZOOM = 17;
/** Zoom level used when centering on the user's location. */
export const GEO_ZOOM = 15;

export const PREFER_CANVAS = true;
/** Disabled to save data on slow connections (no @2x tiles). */
export const DETECT_RETINA = false;
