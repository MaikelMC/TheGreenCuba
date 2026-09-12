export interface UserPreferences {
  onboardingCompleted: boolean;
  name: string;
  email: string;
  phone: string;
  location: string;
  locationName: string;
  interests: string[];
  moods: string[];
  currencies: string[];
}

export const STORAGE_KEY = "la-verde:user";

const LOCATION_META: Record<
  string,
  { label: string; center: [number, number] }
> = {
  "la-habana": { label: "La Habana", center: [23.1374, -82.359] },
  santiago: { label: "Santiago de Cuba", center: [20.0207, -75.8267] },
  varadero: { label: "Varadero", center: [23.1547, -81.2377] },
  otra: { label: "Otra ciudad", center: [23.1374, -82.359] },
};

/** MVP lanzado en Santiago de Cuba: esa es la ciudad por defecto. */
const FALLBACK_LOCATION = "santiago";

export function locationLabel(value: string): string {
  return LOCATION_META[value]?.label ?? value;
}

/** Centro del mapa para una provincia seleccionada (fallback a Santiago de Cuba). */
export function locationCenter(value: string): [number, number] {
  return LOCATION_META[value]?.center ?? LOCATION_META[FALLBACK_LOCATION]!.center;
}

export function isKnownLocation(value: string): boolean {
  return Boolean(LOCATION_META[value]);
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  onboardingCompleted: false,
  name: "Martín",
  email: "martin@email.com",
  phone: "+52 55 1234 5678",
  location: FALLBACK_LOCATION,
  locationName: LOCATION_META[FALLBACK_LOCATION]!.label,
  interests: [],
  moods: [],
  currencies: [],
};

function stringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function readUserPreferences(): UserPreferences {
  if (typeof window === "undefined") return DEFAULT_USER_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_USER_PREFERENCES;
    const p = JSON.parse(raw) as Partial<UserPreferences>;
    const location = isKnownLocation(String(p.location ?? ""))
      ? (p.location as string)
      : FALLBACK_LOCATION;
    return {
      onboardingCompleted: Boolean(p.onboardingCompleted),
      name: typeof p.name === "string" && p.name.length > 0 ? p.name : DEFAULT_USER_PREFERENCES.name,
      email: typeof p.email === "string" && p.email.length > 0 ? p.email : DEFAULT_USER_PREFERENCES.email,
      phone: typeof p.phone === "string" && p.phone.length > 0 ? p.phone : DEFAULT_USER_PREFERENCES.phone,
      location,
      locationName:
        typeof p.locationName === "string" && p.locationName.length > 0
          ? p.locationName
          : LOCATION_META[location]!.label,
      interests: stringArray(p.interests),
      moods: stringArray(p.moods),
      currencies: stringArray(p.currencies),
    };
  } catch {
    return DEFAULT_USER_PREFERENCES;
  }
}

export function writeUserPreferences(prefs: UserPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage unavailable (privacy mode / SSR) — ignore
  }
}