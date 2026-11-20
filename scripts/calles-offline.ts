/**
 * Genera `public/calles/<provincia>.json`: las calles con nombre de cada
 * provincia, para buscar direcciones en la PWA sin conexión.
 *
 * Fuente: OpenStreetMap vía Overpass (mismos datos que Photon, que es lo que
 * se usa con red). Cada calle va con su punto central y el pueblo más cercano,
 * y se agrupan los tramos de una misma calle en un mismo pueblo. Formato
 * compacto, porque se descarga con datos móviles:
 *
 *   { v: 1, pueblos: ["Santiago de Cuba", ...], calles: [[nombre, lat, lng, iPueblo], ...] }
 *
 * Uso:  npx tsx scripts/calles-offline.ts            (todas)
 *       npx tsx scripts/calles-offline.ts holguin    (una o varias)
 *
 * No se ejecuta en el build: los datos de calles cambian poco y Overpass se
 * satura a menudo. Se regenera a mano cuando haga falta y se commitea.
 */

import fs from "node:fs";
import path from "node:path";

/** Clave = el `location` de las preferencias; valor = nombre de la provincia en OSM. */
const PROVINCIAS: Record<string, string> = {
  "pinar-del-rio": "Pinar del Río",
  artemisa: "Artemisa",
  "la-habana": "La Habana",
  mayabeque: "Mayabeque",
  matanzas: "Matanzas",
  cienfuegos: "Cienfuegos",
  "villa-clara": "Villa Clara",
  "sancti-spiritus": "Sancti Spíritus",
  "ciego-de-avila": "Ciego de Ávila",
  camaguey: "Camagüey",
  "las-tunas": "Las Tunas",
  holguin: "Holguín",
  granma: "Granma",
  "santiago-de-cuba": "Santiago de Cuba",
  guantanamo: "Guantánamo",
  "isla-de-la-juventud": "Isla de la Juventud",
};

const SERVIDORES = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

interface Elemento {
  type: "way" | "node";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function overpass(nombre: string): Promise<Elemento[]> {
  /* Nivel 4 es provincia; la Isla de la Juventud es municipio especial (6). */
  /* 400 s y no 180: La Habana es la provincia más densa y con 180 Overpass la
     cortaba en los seis intentos. */
  const consulta = `[out:json][timeout:400];
area["name"="${nombre}"]["boundary"="administrative"]["admin_level"~"^(4|6)$"]->.a;
(way(area.a)["highway"]["name"]; node(area.a)["place"~"^(city|town|village|suburb)$"]["name"];);
out tags center;`;
  for (let intento = 0; intento < 6; intento++) {
    const url = SERVIDORES[intento % SERVIDORES.length]!;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "User-Agent": "osm-street-index/1.0", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: consulta }),
        signal: AbortSignal.timeout(420_000),
      });
      const texto = await res.text();
      if (!res.ok || !texto.startsWith("{")) throw new Error(`HTTP ${res.status}`);
      const datos = JSON.parse(texto) as { elements: Elemento[] };
      return datos.elements;
    } catch (e) {
      const hora = new Date().toLocaleTimeString("es");
      console.warn(`  [${hora}] ${new URL(url).host} falló (${String(e)}), reintento…`);
      await dormir(10_000 * (intento + 1));
    }
  }
  throw new Error(`Overpass no contestó para ${nombre}`);
}

function distancia2(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLng = (aLng - bLng) * Math.cos((aLat * Math.PI) / 180);
  return (aLat - bLat) ** 2 + dLng ** 2;
}

async function generar(clave: string, nombre: string) {
  console.log(`${nombre}…`);
  const elementos = await overpass(nombre);

  /* Los barrios (`suburb`) solo valen como pueblo si no hay ciudad cerca: en
     Photon la «ciudad» de una calle de Vista Alegre es Santiago de Cuba. */
  const lugares = elementos
    .filter((e) => e.type === "node" && e.tags?.place && e.lat != null)
    .map((e) => ({ nombre: e.tags!.name!, lat: e.lat!, lng: e.lon!, barrio: e.tags!.place === "suburb" }));
  const pueblosBase = lugares.filter((l) => !l.barrio);

  const pueblos: string[] = [];
  const indice = new Map<string, number>();
  const vistas = new Set<string>();
  const calles: [string, number, number, number][] = [];

  for (const e of elementos) {
    if (e.type !== "way" || !e.center || !e.tags?.name) continue;
    const { lat, lon } = e.center;
    let cercano = pueblosBase[0];
    let mejor = Infinity;
    for (const p of pueblosBase) {
      const d = distancia2(lat, lon, p.lat, p.lng);
      if (d < mejor) {
        mejor = d;
        cercano = p;
      }
    }
    const pueblo = cercano?.nombre ?? nombre;
    const clavePueblo = `${e.tags.name}|${pueblo}`;
    if (vistas.has(clavePueblo)) continue;
    vistas.add(clavePueblo);
    if (!indice.has(pueblo)) {
      indice.set(pueblo, pueblos.length);
      pueblos.push(pueblo);
    }
    calles.push([e.tags.name, +lat.toFixed(4), +lon.toFixed(4), indice.get(pueblo)!]);
  }

  const destino = path.join(__dirname, "..", "public", "calles", `${clave}.json`);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, JSON.stringify({ v: 1, pueblos, calles }));
  console.log(`  ${calles.length} calles en ${pueblos.length} pueblos → ${path.relative(process.cwd(), destino)}`);
}

async function main() {
  const args = process.argv.slice(2);
  /* Sin `--forzar` se saltan las provincias ya generadas: Overpass se satura
     a menudo y relanzar no debe repetir horas de descargas. */
  const forzar = args.includes("--forzar");
  const pedidas = args.filter((a) => !a.startsWith("--"));
  const claves = pedidas.length > 0 ? pedidas : Object.keys(PROVINCIAS);
  const fallidas: string[] = [];
  for (const clave of claves) {
    const nombre = PROVINCIAS[clave];
    if (!nombre) {
      console.error(`Provincia desconocida: ${clave}`);
      process.exitCode = 1;
      continue;
    }
    const destino = path.join(__dirname, "..", "public", "calles", `${clave}.json`);
    if (!forzar && fs.existsSync(destino)) {
      console.log(`${nombre}: ya existe, se salta (--forzar para regenerar)`);
      continue;
    }
    // Una provincia que falla no detiene las demás.
    try {
      await generar(clave, nombre);
    } catch (e) {
      console.error(`  ${nombre} falló: ${String(e)}`);
      fallidas.push(clave);
    }
    await dormir(5_000); // Overpass pide no encadenar consultas pesadas.
  }
  if (fallidas.length > 0) {
    console.error(`\nFaltan: ${fallidas.join(" ")}. Relanza el script para reintentarlas.`);
    process.exitCode = 1;
  }
}

void main();
