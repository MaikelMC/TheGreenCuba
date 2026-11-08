import type maplibregl from "maplibre-gl";

/**
 * Aplica la paleta de La Verde sobre cualquier estilo base (Liberty u otro).
 *
 * Mismo enfoque que el demo: itera todas las capas y pinta por patrón de id.
 * Se llama en el evento "load" antes de aplicarTemaMapa.
 */
export function aplicarColoresLaVerde(map: maplibregl.Map): void {
  const capas = map.getStyle()?.layers ?? [];
  for (const capa of capas) {
    const id = capa.id;
    const pintar = (prop: string, valor: unknown) => {
      try { map.setPaintProperty(id, prop, valor); } catch { /* capa no existe */ }
    };
    if (capa.type === "background") {
      pintar("background-color", "#F1F5EE");
    } else if (capa.type === "fill") {
      if (/water/.test(id))                                           pintar("fill-color", "#BFE3E6");
      else if (/park|grass|wood|forest|landcover|garden|pitch/.test(id)) pintar("fill-color", "#D3ECCB");
      else if (/residential|landuse/.test(id))                        pintar("fill-color", "#ECF1E8");
      else if (/building/.test(id))                                   pintar("fill-color", "#E2E8DE");
    } else if (capa.type === "fill-extrusion" && /building/.test(id)) {
      pintar("fill-extrusion-color", "#E2E8DE");
    } else if (capa.type === "line") {
      if (/water|river|stream/.test(id))        pintar("line-color", "#A9D6DB");
      else if (/motorway|trunk/.test(id))       pintar("line-color", "#F6E3A1");
      else if (/primary|secondary/.test(id))    pintar("line-color", "#FFFFFF");
      // casings: se mantienen sin tocar
    } else if (capa.type === "symbol") {
      if (/place|city|town|village|suburb|neighbourhood/.test(id)) {
        pintar("text-color", "#1F5A33");
        pintar("text-halo-color", "#FFFFFF");
      }
      if (/water/.test(id)) pintar("text-color", "#3C8A92");
    }
  }
}

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
