/**
 * Prueba end-to-end de la búsqueda con IA, replicando EXACTAMENTE lo que hace
 * el navegador en `home/page.tsx`:
 *
 *   1. Carga el catálogo real desde la base (lo publicado).
 *   2. Simula un usuario de Santiago de Cuba, con GPS (origin) y sin él.
 *   3. Aplica el filtro duro por provincia + la excepción de mención explícita.
 *   4. Ordena por cercanía y envía el mismo payload que manda el home.
 *   5. Llama a `recommendPlaces` (el mismo failover que usa la ruta API).
 *
 * Valida que los resultados respeten la provincia y que la consulta que nombra
 * otra provincia sí pueda salir de ella.
 *
 * Uso: npx tsx --env-file-if-exists=.env scripts/test-ai-search.ts
 */
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { recommendPlaces, type CatalogPlace } from "@/lib/ai";
import { toUserPlace } from "@/lib/db/mappers";
import type { UserPlace } from "@/lib/places-store";
import type { UserPreferences } from "@/lib/user-preferences-store";
import { haversineM } from "@/lib/map/routing";
import {
  placeInUserProvince,
  queryMentionsOtherProvince,
  userProvinceLabel,
} from "@/lib/user-province";

const PROVINCIA = "Santiago de Cuba";
const prefs: UserPreferences = {
  onboardingCompleted: true,
  name: "Roberto",
  email: "test@test.cu",
  phone: "",
  location: "santiago-de-cuba",
  locationName: PROVINCIA,
  interests: [],
  moods: [],
  currencies: [],
};

/** El centro de la provincia: el origen que usa el home sin permiso de GPS. */
const ORIGIN = { lat: 20.014, lng: -75.826 };

interface Case {
  name: string;
  query: string;
  /** Con GPS (origin = centro de la provincia) o sin ubicación alguna. */
  withOrigin: boolean;
  /** Además del filtro por provincia, exige que el resultado pertenezca a ella. */
  expectInProvince: boolean;
}

const CASES: Case[] = [
  { name: "genérica, con GPS", query: "un lugar tranquilo para comer algo rico", withOrigin: true, expectInProvince: true },
  { name: "hospedaje, con GPS", query: "quiero un hotel en el centro histórico", withOrigin: true, expectInProvince: true },
  { name: "naturaleza, con GPS", query: "un mirador o lugar natural para visitar", withOrigin: true, expectInProvince: true },
  { name: "genérica, SIN ubicación", query: "un lugar tranquilo para comer algo rico", withOrigin: false, expectInProvince: true },
  { name: "menciona La Habana → sin recorte", query: "busco algo que hacer en La Habana", withOrigin: true, expectInProvince: false },
];

let failures = 0;

async function runCase(c: Case, catalog: UserPlace[]): Promise<void> {
  console.log(`\n━━━ Caso: ${c.name} — "${c.query}" ━━━`);

  /* Lo mismo que hace handleSearch en el home. */
  const province = userProvinceLabel(prefs);
  if (!province) throw new Error("El fixture debe tener provincia definida");
  const mentionsOther = queryMentionsOtherProvince(c.query, province);
  const pool =
    province && !mentionsOther
      ? catalog.filter((p) => placeInUserProvince(p, province))
      : catalog;
  console.log(`   Provincia: ${province} · menciona otra provincia: ${mentionsOther ? "SÍ" : "no"} · pool: ${pool.length}/${catalog.length}`);
  if (pool.length === 0) throw new Error("El filtro duro vació el pool (la red de seguridad del home mandaría todo el catálogo)");

  const payload: CatalogPlace[] = (pool.length > 0 ? pool : catalog)
    .map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      barrio: p.barrio,
      payments: p.payments,
      schedule: p.schedule,
      description: p.description,
      distanceM: c.withOrigin
        ? Math.round(haversineM(ORIGIN, { lat: p.lat, lng: p.lng }))
        : undefined,
    }))
    .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));

  const { data, provider } = await recommendPlaces(
    c.query,
    payload,
    mentionsOther ? null : province,
  );

  const matches = (data.matches ?? []).filter((m) => m && m.id).slice(0, 5);
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const picked = matches
    .map((m) => ({ match: m, place: byId.get(m.id) }))
    .filter((x): x is { match: { id: string; reason: string }; place: UserPlace } => Boolean(x.place));

  console.log(`   Proveedor: ${provider} · summary: ${data.summary?.slice(0, 140)}`);
  if (picked.length === 0) {
    console.log("   ⚠️  Sin matches (la IA devolvió lista vacía)");
    if (c.expectInProvince) failures += 1;
    return;
  }
  for (const { match, place } of picked) {
    console.log(`   → ${place.name} [${place.province || place.city}] — ${match.reason.slice(0, 90)}`);
  }

  /* Verificaciones. */
  const ids = new Set(matches.map((m) => m.id));
  if (!ids.has(matches[0]!.id) || matches.some((m, i) => matches.findIndex((x) => x.id === m.id) !== i)) {
    console.log("   ❌ matches con ids repetidos");
    failures += 1;
  }
  const outOfProvince = picked.filter((x) => !placeInUserProvince(x.place, province));
  if (c.expectInProvince && outOfProvince.length > 0) {
    console.log(`   ❌ ${outOfProvince.length} resultado(s) FUERA de ${province}: ${outOfProvince.map((x) => `${x.place.name} (${x.place.province || x.place.city})`).join(", ")}`);
    failures += 1;
  } else if (c.expectInProvince) {
    console.log(`   ✅ Todos los resultados dentro de ${province}`);
  } else if (mentionsOther && picked.length > 0) {
    console.log("   ✅ La consulta que nombra otra provincia pudo salir (filtro retirado)");
  }
}

async function main(): Promise<void> {
  console.log("Cargando catálogo publicado desde la base...");
  const rows = await db
    .select()
    .from(schema.places)
    .where(eq(schema.places.isActive, true));

  const catalog = rows.map((row) => toUserPlace({ ...row, categoryName: "" }));
  const provinces = new Set(catalog.map((p) => p.province || p.city || "(sin provincia)"));
  console.log(`Catálogo: ${catalog.length} lugares · provincias: ${[...provinces].join(" | ")}`);
  if (catalog.length < 2) throw new Error("Catálogo demasiado pequeño para probar");

  for (const c of CASES) {
    await runCase(c, catalog);
  }

  console.log(`\n${failures === 0 ? "🟢 TODOS LOS CASOS PASARON" : `🔴 ${failures} caso(s) con problemas`}`);
  if (failures > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error("❌ Test E2E falló:", e);
    process.exit(1);
  })
  .then(() => process.exit(0));
