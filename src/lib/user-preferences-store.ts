export interface UserPreferences {
  onboardingCompleted: boolean;
  name: string;
  email: string;
  avatarUrl?: string;
  phone: string;
  location: string;
  locationName: string;
  interests: string[];
  moods: string[];
  currencies: string[];
}

export const STORAGE_KEY = "la-verde:user";

function userStorageKey(userId?: string | null): string {
  const safeId = (userId ?? "guest").trim();
  return safeId ? `${STORAGE_KEY}:${safeId}` : `${STORAGE_KEY}:guest`;
}

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
  /* Valores neutrales para no dejar un perfil con identidad falsa. El nombre y
     el correo reales los toma la sesión autenticada o el formulario de alta. */
  name: "Usuario",
  email: "",
  avatarUrl: "",
  phone: "",
  location: FALLBACK_LOCATION,
  locationName: LOCATION_META[FALLBACK_LOCATION]!.label,
  interests: [],
  moods: [],
  currencies: [],
};

function stringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function readUserPreferences(userId?: string | null): UserPreferences {
  if (typeof window === "undefined") return DEFAULT_USER_PREFERENCES;
  try {
    const key = userStorageKey(userId);
    const raw = window.localStorage.getItem(key);
    if (!raw) return DEFAULT_USER_PREFERENCES;
    const p = JSON.parse(raw) as Partial<UserPreferences>;
    const location = isKnownLocation(String(p.location ?? ""))
      ? (p.location as string)
      : FALLBACK_LOCATION;
    return {
      onboardingCompleted: Boolean(p.onboardingCompleted),
      name: typeof p.name === "string" && p.name.length > 0 ? p.name : DEFAULT_USER_PREFERENCES.name,
      email: typeof p.email === "string" && p.email.length > 0 ? p.email : DEFAULT_USER_PREFERENCES.email,
      avatarUrl:
        typeof p.avatarUrl === "string" && p.avatarUrl.length > 0
          ? p.avatarUrl
          : DEFAULT_USER_PREFERENCES.avatarUrl,
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

export function writeUserPreferences(prefs: UserPreferences, userId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(userStorageKey(userId), JSON.stringify(prefs));
  } catch {
    // localStorage unavailable (privacy mode / SSR) — ignore
  }
}

/**
 * Borra las preferencias de este navegador. Lo usa «borrar mi cuenta», que no
 * tiene nada más que borrar: las cuentas demo salen de `.env`, no de una base
 * de datos.
 */
export function clearUserPreferences(userId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(userStorageKey(userId));
  } catch {
    // Nada que hacer: si no se puede borrar, tampoco se pudo escribir.
  }
}