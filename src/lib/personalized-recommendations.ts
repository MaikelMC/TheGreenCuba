import type { UserPreferences } from "@/lib/user-preferences-store";
import type { UserPlace } from "@/lib/places-store";

const INTEREST_CATEGORIES: Record<string, string[]> = {
  cafes: ["cafetería", "cafeteria"],
  restaurantes: ["restaurante"],
  discotecas: ["discoteca", "vida nocturna"],
  mercados: ["mercado"],
  bares: ["bar"],
  playas: ["playa", "naturaleza"],
  cultura: ["cultura"],
  fitness: ["deporte", "fitness"],
};

const MOOD_VIBES: Record<string, string[]> = {
  tranquilo: ["tranquilo", "relajado"],
  fiesta: ["fiesta", "musical", "noche"],
  romantico: ["romántico", "romantico"],
  familiar: ["familiar"],
  cultural: ["cultural"],
  aventura: ["aventura"],
  trabajo: ["trabajo", "estudio"],
  salud: ["salud", "bienestar", "fitness"],
};

const PAYMENT_METHODS: Record<string, string[]> = {
  mlc: ["mlc", "usd clásica", "usd clasica"],
  cup: ["cup"],
  usd: ["usd"],
  eur: ["eur"],
  transfer: ["transferencia", "transfer"],
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function containsAny(values: string[], candidates: string[]): boolean {
  return values.some((value) => candidates.some((candidate) => value.includes(normalize(candidate))));
}

/**
 * Cuánto encaja un negocio con el perfil de quien mira.
 *
 * Exportada porque las sugerencias del buscador puntúan con esta misma regla,
 * y dos tablas de equivalencias —intereses, ambientes, monedas— que se separan
 * con el tiempo serían peor que compartir una.
 */
export function recommendationScore(place: UserPlace, prefs: UserPreferences): number {
  const category = normalize(place.category);
  const vibes = (place.vibe ?? []).map(normalize);
  const payments = place.payments.map(normalize);
  let score = 0;

  for (const interest of prefs.interests) {
    const categories = INTEREST_CATEGORIES[interest] ?? [interest];
    if (categories.some((candidate) => category.includes(normalize(candidate)))) score += 6;
  }

  for (const mood of prefs.moods) {
    const vibesForMood = MOOD_VIBES[mood] ?? [mood];
    if (containsAny(vibes, vibesForMood)) score += 4;
  }

  for (const currency of prefs.currencies) {
    const paymentOptions = PAYMENT_METHODS[currency] ?? [currency];
    if (containsAny(payments, paymentOptions)) score += 2;
  }

  if (place.isBoosted) score += 1;
  if (place.rating) score += Math.min(place.rating, 5) * 0.1;
  return score;
}

/**
 * Pone primero lo que coincide con el perfil y alterna categorías cuando hay
 * empate o candidatos equivalentes, para no llenar el inicio con un solo tipo
 * de negocio.
 */
export function personalizePlaces(places: UserPlace[], prefs: UserPreferences): UserPlace[] {
  if (prefs.interests.length === 0 && prefs.moods.length === 0 && prefs.currencies.length === 0) {
    return places;
  }

  const ranked = places
    .map((place, index) => ({ place, index, score: recommendationScore(place, prefs) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const result: typeof ranked = [];
  const remaining = [...ranked];
  let previousCategory = "";

  while (remaining.length > 0) {
    const nextIndex = remaining.findIndex(
      (candidate) => normalize(candidate.place.category) !== previousCategory,
    );
    const selected = remaining.splice(nextIndex >= 0 ? nextIndex : 0, 1)[0]!;
    result.push(selected);
    previousCategory = normalize(selected.place.category);
  }

  return result.map(({ place }) => place);
}
