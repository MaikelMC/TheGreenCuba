/**
 * Pruebas de la lógica de provincia en la búsqueda (sin red, sin base).
 *
 * Cubre el contrato completo de `src/lib/user-province.ts` y el boost de
 * provincia en `recommendationScore`/`personalizePlaces`. Falla con exit 1 si
 * cualquier comprobación no se cumple, para poder colgarlo de CI más adelante.
 */
import type { UserPlace } from "@/lib/places-store";
import type { UserPreferences } from "@/lib/user-preferences-store";
import {
  placeInUserProvince,
  queryMentionsOtherProvince,
  userProvinceLabel,
} from "@/lib/user-province";
import {
  personalizePlaces,
  recommendationScore,
} from "@/lib/personalized-recommendations";

let passed = 0;
let failed = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  const ok = actual === expected;
  if (ok) passed += 1;
  else failed += 1;
  console.log(`${ok ? "✅" : "❌"} ${name}${ok ? "" : ` — esperado ${JSON.stringify(expected)}, recibido ${JSON.stringify(actual)}`}`);
}

/* ── Fixtures ── */

function mkPrefs(overrides: Partial<UserPreferences> = {}): UserPreferences {
  return {
    onboardingCompleted: true,
    name: "Test",
    email: "",
    phone: "",
    location: "otra",
    locationName: "Otra ciudad",
    interests: [],
    moods: [],
    currencies: [],
    ...overrides,
  };
}

function mkPlace(overrides: Partial<UserPlace> = {}): UserPlace {
  return {
    id: "p",
    name: "Lugar",
    category: "Restaurante",
    lat: 20.01,
    lng: -75.82,
    address: "",
    barrio: "",
    description: "",
    schedule: "",
    payments: [],
    menu: [],
    offer: null,
    status: "active",
    isActive: true,
    reviewStatus: "approved",
    isBoosted: false,
    boostExpiresAt: "",
    createdAt: 0,
    ...overrides,
  };
}

const SANTIAGO = "Santiago de Cuba";

/* ── userProvinceLabel ── */

console.log("\n— userProvinceLabel —");
check("provincia del selector → etiqueta", userProvinceLabel(mkPrefs({ location: "santiago-de-cuba" })), SANTIAGO);
check("valor legacy «santiago» → etiqueta", userProvinceLabel(mkPrefs({ location: "santiago" })), SANTIAGO);
check("«otra» → null (no se sabe dónde está)", userProvinceLabel(mkPrefs({ location: "otra" })), null);
check("sin preferencias → null", userProvinceLabel(null), null);

/* ── placeInUserProvince ── */

console.log("\n— placeInUserProvince —");
check("«Santiago de Cuba» pertenece", placeInUserProvince(mkPlace({ province: "Santiago de Cuba" }), SANTIAGO), true);
check("«Santiago» a secas también (contención)", placeInUserProvince(mkPlace({ province: "Santiago" }), SANTIAGO), true);
check("«SANTIAGO DE CUBA» en mayúsculas también", placeInUserProvince(mkPlace({ province: "SANTIAGO DE CUBA" }), SANTIAGO), true);
check("«La Habana» no pertenece", placeInUserProvince(mkPlace({ province: "La Habana" }), SANTIAGO), false);
check("sin provincia ni ciudad → false", placeInUserProvince(mkPlace({ province: undefined, city: "" }), SANTIAGO), false);
check("usa city si no hay province", placeInUserProvince(mkPlace({ province: undefined, city: "Santiago de Cuba" }), SANTIAGO), true);
check("barrio escrito como ciudad («Vista Alegre») → fuera", placeInUserProvince(mkPlace({ province: "Vista Alegre" }), SANTIAGO), false);

/* ── queryMentionsOtherProvince ── */

console.log("\n— queryMentionsOtherProvince —");
check("«restaurantes en La Habana» menciona otra", queryMentionsOtherProvince("restaurantes en La Habana", SANTIAGO), true);
check("«playas de varadero» (legacy) menciona otra", queryMentionsOtherProvince("playas de varadero", SANTIAGO), true);
check("«un bar tranquilo» no menciona", queryMentionsOtherProvince("un bar tranquilo", SANTIAGO), false);
check("«en santiago» NO cuenta como otra (es la propia)", queryMentionsOtherProvince("mejores lugares en santiago", SANTIAGO), false);
check("«santiago de cuba» en la consulta NO cuenta como otra", queryMentionsOtherProvince("pizzería en Santiago de Cuba", SANTIAGO), false);
check("consulta vacía → false", queryMentionsOtherProvince("", SANTIAGO), false);

/* ── Boost de provincia en el ranking ── */

console.log("\n— boost de provincia en recommendationScore —");
const prefsSantiago = mkPrefs({ location: "santiago-de-cuba" });
const local = mkPlace({ id: "local", province: SANTIAGO });
const foraneo = mkPlace({ id: "foraneo", province: "La Habana" });
check("el de la provincia puntúa más que el de fuera", recommendationScore(local, prefsSantiago) > recommendationScore(foraneo, prefsSantiago), true);
check("el boost vale +3 exacto a igualdad de todo lo demás", recommendationScore(local, prefsSantiago) - recommendationScore(foraneo, prefsSantiago), 3);
check("sin provincia el boost no aplica", recommendationScore(local, mkPrefs({ location: "otra" })) === recommendationScore(foraneo, mkPrefs({ location: "otra" })), true);

console.log("\n— personalizePlaces —");
const catalog = [foraneo, local, mkPlace({ id: "otro-foraneo", province: "Holguín" })];
const ranked = personalizePlaces(catalog, prefsSantiago);
check("con solo provincia definida sí ordena (no salida temprana)", ranked[0]?.id, "local");
check("perfil vacío y sin provincia → orden intacto", JSON.stringify(personalizePlaces(catalog, mkPrefs({ location: "otra" })).map((p) => p.id)), JSON.stringify(["foraneo", "local", "otro-foraneo"]));
/* Con perfil «otra» e intereses marcados, el boost no existe pero sí ordena por intereses. */
const rankedByInterest = personalizePlaces(
  [foraneo, local],
  mkPrefs({ location: "otra", interests: ["restaurantes"] }),
);
check("sin provincia, empate → orden por índice original", rankedByInterest.map((p) => p.id).join(","), "foraneo,local");

/* ── Resumen ── */

console.log(`\n${failed === 0 ? "🟢" : "🔴"} ${passed} pasan, ${failed} fallan`);
if (failed > 0) process.exit(1);
