import type maplibregl from "maplibre-gl";

/**
 * Paletas de color para el mapa.
 *
 * El estilo base (estilo-la-verde.json) contiene los colores claros. Esta
 * función solo cambia los valores que difieren entre modos; al volver a claro
 * se restauran los originales guardados en el primer cambio a oscuro.
 */

type Tema = "claro" | "oscuro";

/** Propiedades de capa que el modo oscuro modifica. */
interface Override {
  layerId: string;
  prop: string;
  oscuro: unknown;
  _claro?: unknown; // se rellena la primera vez, al capturar el valor original
}

const OVERRIDES: Override[] = [
  // Fondo
  { layerId: "background", prop: "background-color", oscuro: "#141B17" },

  // Agua relleno
  { layerId: "water", prop: "fill-color", oscuro: "#16313A" },
  { layerId: "water_shadow", prop: "fill-color", oscuro: "#16313A" },

  // Agua líneas
  { layerId: "waterway", prop: "line-color", oscuro: "#1F4450" },
  { layerId: "waterway_tunnel", prop: "line-color", oscuro: "#1F4450" },

  // Parques, bosque, césped
  { layerId: "park", prop: "fill-color", oscuro: "#1B2E22" },
  { layerId: "landcover_wood", prop: "fill-color", oscuro: "#1B2E22" },
  { layerId: "landcover_grass", prop: "fill-color", oscuro: "#1B2E22" },

  // Zonas residenciales
  { layerId: "landuse_residential", prop: "fill-color", oscuro: "#18211C" },

  // Edificios
  { layerId: "building", prop: "fill-color", oscuro: "#222C26" },
  { layerId: "building_top", prop: "fill-color", oscuro: "#222C26" },

  // Autopistas y vías principales (relleno de línea, no casing)
  { layerId: "road_motorway", prop: "line-color", oscuro: "#5C5130" },
  { layerId: "road_trunk", prop: "line-color", oscuro: "#5C5130" },
  { layerId: "road_primary", prop: "line-color", oscuro: "#2E3A33" },
  { layerId: "road_secondary", prop: "line-color", oscuro: "#2E3A33" },
  { layerId: "road_tertiary", prop: "line-color", oscuro: "#26302A" },
  { layerId: "road_minor", prop: "line-color", oscuro: "#26302A" },
  { layerId: "road_path", prop: "line-color", oscuro: "#26302A" },
  { layerId: "road_service", prop: "line-color", oscuro: "#26302A" },

  // Casing (bordes)
  { layerId: "road_motorway_casing", prop: "line-color", oscuro: "#0E1411" },
  { layerId: "road_trunk_casing", prop: "line-color", oscuro: "#0E1411" },
  { layerId: "road_primary_casing", prop: "line-color", oscuro: "#0E1411" },
  { layerId: "road_secondary_casing", prop: "line-color", oscuro: "#0E1411" },
  { layerId: "road_minor_casing", prop: "line-color", oscuro: "#0E1411" },

  // Nombres de lugares
  { layerId: "place_city", prop: "text-color", oscuro: "#CDE9D6" },
  { layerId: "place_city", prop: "text-halo-color", oscuro: "#0E1411" },
  { layerId: "place_town", prop: "text-color", oscuro: "#CDE9D6" },
  { layerId: "place_town", prop: "text-halo-color", oscuro: "#0E1411" },
  { layerId: "place_village", prop: "text-color", oscuro: "#CDE9D6" },
  { layerId: "place_village", prop: "text-halo-color", oscuro: "#0E1411" },
  { layerId: "place_suburb", prop: "text-color", oscuro: "#CDE9D6" },
  { layerId: "place_suburb", prop: "text-halo-color", oscuro: "#0E1411" },
  { layerId: "place_hamlet", prop: "text-color", oscuro: "#CDE9D6" },
  { layerId: "place_hamlet", prop: "text-halo-color", oscuro: "#0E1411" },
  { layerId: "place_country_1", prop: "text-color", oscuro: "#CDE9D6" },
  { layerId: "place_country_1", prop: "text-halo-color", oscuro: "#0E1411" },
  { layerId: "place_country_2", prop: "text-color", oscuro: "#CDE9D6" },
  { layerId: "place_country_2", prop: "text-halo-color", oscuro: "#0E1411" },
  { layerId: "place_country_3", prop: "text-color", oscuro: "#CDE9D6" },
  { layerId: "place_country_3", prop: "text-halo-color", oscuro: "#0E1411" },
  { layerId: "place_state", prop: "text-color", oscuro: "#CDE9D6" },
  { layerId: "place_state", prop: "text-halo-color", oscuro: "#0E1411" },

  // Nombres de calles
  { layerId: "road_label", prop: "text-color", oscuro: "#A9BCAF" },
  { layerId: "road_label", prop: "text-halo-color", oscuro: "#0E1411" },

  // Nombres de agua
  { layerId: "water_name_line", prop: "text-color", oscuro: "#6FB3BE" },
  { layerId: "water_name_line", prop: "text-halo-color", oscuro: "#0E1411" },
  { layerId: "water_name_point", prop: "text-color", oscuro: "#6FB3BE" },
  { layerId: "water_name_point", prop: "text-halo-color", oscuro: "#0E1411" },

  // Iconos de lugares (sprite)
  { layerId: "poi_z14", prop: "icon-opacity", oscuro: 0.85 },
  { layerId: "poi_z15", prop: "icon-opacity", oscuro: 0.85 },
  { layerId: "poi_z16", prop: "icon-opacity", oscuro: 0.85 },
];

let capturado = false;

/**
 * Aplica la paleta de un tema al mapa.
 *
 * La primera vez que se llama con "oscuro" captura los valores actuales del
 * estilo claro, para poder restaurarlos exactamente. `setPaintProperty` sobre
 * una capa que no existe no lanza error — MapLibre lo ignora en silencio.
 */
export function aplicarTemaMapa(map: maplibregl.Map, tema: Tema): void {
  if (tema === "oscuro") {
    for (const o of OVERRIDES) {
      if (!map.getLayer(o.layerId)) continue;
      if (!capturado) {
        o._claro = map.getPaintProperty(o.layerId, o.prop);
      }
      map.setPaintProperty(o.layerId, o.prop, o.oscuro);
    }
    capturado = true;
  } else {
    for (const o of OVERRIDES) {
      if (!map.getLayer(o.layerId)) continue;
      if (o._claro !== undefined) {
        map.setPaintProperty(o.layerId, o.prop, o._claro);
      }
    }
  }
}
