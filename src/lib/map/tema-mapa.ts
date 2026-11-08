import type maplibregl from "maplibre-gl";

/** Props que el modo oscuro toca, por tipo de capa y patrón de id. */
const PROPS_OSCURO: Record<string, string[]> = {
  background: ["background-color"],
  fill: ["fill-color"],
  "fill-extrusion": ["fill-extrusion-color"],
  line: ["line-color"],
  symbol: ["text-color", "text-halo-color", "text-halo-width", "icon-color", "icon-halo-color", "icon-opacity"],
};

/**
 * Snapshot de los valores La Verde (claro) tomado la primera vez que se llama.
 * Clave: `${layerId}::${prop}`.
 * Se restaura exactamente al volver al tema claro, así no quedan residuos del
 * oscuro en capas que La Verde no pinta (casings, rutas menores, etiquetas…).
 */
let snapshot: Map<string, unknown> | null = null;

function tomarSnapshot(map: maplibregl.Map): void {
  if (snapshot) return;
  snapshot = new Map();
  const capas = map.getStyle()?.layers ?? [];
  for (const capa of capas) {
    const props = PROPS_OSCURO[capa.type];
    if (!props) continue;
    for (const prop of props) {
      try {
        const val = map.getPaintProperty(capa.id, prop);
        snapshot.set(`${capa.id}::${prop}`, val);
      } catch { /* capa sin esa prop */ }
    }
  }
}

function restaurarSnapshot(map: maplibregl.Map): void {
  if (!snapshot) return;
  for (const [key, val] of snapshot) {
    const sep = key.lastIndexOf("::");
    const id = key.slice(0, sep);
    const prop = key.slice(sep + 2);
    try { map.setPaintProperty(id, prop, val); } catch { /* capa ya no existe */ }
  }
}

/**
 * Aplica la paleta de La Verde sobre cualquier estilo base (Liberty u otro).
 * También toma el snapshot claro la primera vez, para que `aplicarTemaMapa`
 * pueda restaurar exactamente al volver al modo claro.
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
      if (/water/.test(id))                                               pintar("fill-color", "#BFE3E6");
      else if (/park|grass|wood|forest|landcover|garden|pitch/.test(id)) pintar("fill-color", "#D3ECCB");
      else if (/residential|landuse/.test(id))                           pintar("fill-color", "#ECF1E8");
      else if (/building/.test(id))                                      pintar("fill-color", "#E2E8DE");
    } else if (capa.type === "fill-extrusion" && /building/.test(id)) {
      pintar("fill-extrusion-color", "#E2E8DE");
    } else if (capa.type === "line") {
      if (/water|river|stream/.test(id))        pintar("line-color", "#A9D6DB");
      else if (/motorway|trunk/.test(id))       pintar("line-color", "#F6E3A1");
      else if (/primary|secondary/.test(id))    pintar("line-color", "#FFFFFF");
    } else if (capa.type === "symbol") {
      if (/place|city|town|village|suburb|neighbourhood/.test(id)) {
        pintar("text-color", "#1F5A33");
        pintar("text-halo-color", "#FFFFFF");
      }
      if (/water/.test(id)) pintar("text-color", "#3C8A92");
    }
  }

  // Snapshot después de aplicar La Verde (valores de referencia del modo claro).
  tomarSnapshot(map);
}

type Tema = "claro" | "oscuro";

/**
 * Cambia el tema del mapa.
 * Claro: restaura el snapshot La Verde exacto (todos los props que el oscuro
 *        pudo haber tocado vuelven al valor original, sin residuos).
 * Oscuro: itera todas las capas por patrón de id, igual que aplicarColoresLaVerde.
 */
export function aplicarTemaMapa(map: maplibregl.Map, tema: Tema): void {
  if (tema === "claro") {
    restaurarSnapshot(map);
    return;
  }

  const capas = map.getStyle()?.layers ?? [];
  for (const capa of capas) {
    const id = capa.id;
    const p = (prop: string, valor: unknown) => {
      try { map.setPaintProperty(id, prop, valor); } catch { /* capa no existe */ }
    };

    if (capa.type === "background") {
      p("background-color", "#141B17");
    } else if (capa.type === "fill") {
      if (/water/.test(id))                                               p("fill-color", "#16313A");
      else if (/park|grass|wood|forest|landcover|garden|pitch/.test(id)) p("fill-color", "#1B2E22");
      else if (/residential|landuse/.test(id))                           p("fill-color", "#18211C");
      else if (/aeroway|aerodrome|airport/.test(id))                     p("fill-color", "#1E2820");
      else if (/building/.test(id))                                      p("fill-color", "#222C26");
    } else if (capa.type === "fill-extrusion" && /building/.test(id)) {
      p("fill-extrusion-color", "#222C26");
    } else if (capa.type === "line") {
      if (/water|river|stream/.test(id))                  p("line-color", "#1F4450");
      else if (/motorway|trunk|highway|freeway/.test(id)) p("line-color", /casing/.test(id) ? "#0E1411" : "#5C5130");
      else if (/primary|secondary/.test(id))              p("line-color", /casing/.test(id) ? "#0E1411" : "#2E3A33");
      else if (/aeroway|aerodrome|runway|taxiway/.test(id)) p("line-color", "#26302A");
      else if (/road|path|track/.test(id))                p("line-color", /casing/.test(id) ? "#0E1411" : "#26302A");
    } else if (capa.type === "symbol") {
      if (/water/.test(id)) {
        p("text-color", "#5A9BA5");
        p("text-halo-color", "#141B17");
      } else if (/road|street|motorway|trunk|highway|freeway|shield|ref|transport/.test(id)) {
        p("text-color", "#6E8878");
        p("text-halo-color", "#141B17");
        p("icon-color", "#2E3A33");
        p("icon-halo-color", "#141B17");
      } else if (/poi/.test(id)) {
        p("icon-opacity", 0.55);
        p("text-color", "#6E8878");
        p("text-halo-color", "#141B17");
        p("text-halo-width", 1.5);
      } else {
        /* Nombres de lugares: ciudad, pueblo, barrio, localidad y cualquier
           otra capa de texto que Liberty añada. Halo oscuro elimina el
           resplandor blanco del estilo base. */
        p("text-color", "#8DB89E");
        p("text-halo-color", "#141B17");
        p("text-halo-width", 1.5);
      }
    }
  }
}
