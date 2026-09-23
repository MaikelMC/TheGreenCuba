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

/** Quién guardó preferencias la última vez, para poder leerlas sin preguntar. */
const LAST_USER_KEY = "la-verde:last-user";

/** El cajón de quien no tiene sesión. */
const GUEST_ID = "guest";

/**
 * De dónde se leen las preferencias.
 *
 * Con `userId` hay una sola respuesta: su clave. El problema son las lecturas
 * **sin** id —el header, el selector de ubicación del mapa y los dos efectos del
 * home leen así—, que caían siempre en `…:guest`, un cajón que para alguien con
 * sesión está vacío. El resultado era que el home no veía la ciudad elegida en
 * el onboarding y volvía a comportarse como una visita nueva.
 *
 * Por eso, sin id, se prueba por orden:
 *
 * 1. la última sesión que guardó algo (`LAST_USER_KEY`),
 * 2. la clave de antes de separar por usuario —`la-verde:user` a secas—, que es
 *    donde escribió todo el mundo hasta esta rama: quien ya había hecho el
 *    onboarding no lo pierde al actualizar,
 * 3. el cajón de invitado.
 *
 * Gana la primera que tenga datos. En un navegador compartido esto enseña las
 * preferencias de la última persona que entró, que es exactamente lo que hacía
 * el almacén de una sola clave antes de este cambio: no se pierde nada que no
 * se hubiera perdido ya.
 */
function readKeys(userId?: string | null): string[] {
  const id = userId?.trim();
  if (id) return [`${STORAGE_KEY}:${id}`];
  let remembered: string | null = null;
  try {
    remembered = window.localStorage.getItem(LAST_USER_KEY);
  } catch {
    // localStorage bloqueado: se sigue con las claves fijas.
  }
  return [
    ...(remembered ? [`${STORAGE_KEY}:${remembered}`] : []),
    STORAGE_KEY,
    `${STORAGE_KEY}:${GUEST_ID}`,
  ];
}

/** Dónde escribe. Aquí sí o sí hay una sola clave: la suya o la de invitado. */
function writeKey(userId?: string | null): string {
  const id = userId?.trim();
  return `${STORAGE_KEY}:${id || GUEST_ID}`;
}

/** Recuerda de quién son las preferencias que se acaban de guardar. */
function rememberUser(userId?: string | null): void {
  const id = userId?.trim();
  if (!id) return;
  try {
    window.localStorage.setItem(LAST_USER_KEY, id);
  } catch {
    // Nada que hacer: si no se puede escribir el índice, el resto sigue igual.
  }
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
    let raw: string | null = null;
    /* La primera clave con datos: ver `readKeys` para el porqué del orden. */
    for (const key of readKeys(userId)) {
      raw = window.localStorage.getItem(key);
      if (raw) break;
    }
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
    window.localStorage.setItem(writeKey(userId), JSON.stringify(prefs));
    /* Se apunta quién escribió: es lo que permite que las lecturas sin id —el
       header, el mapa, el home— encuentren estas preferencias y no las del
       cajón de invitado. */
    rememberUser(userId);
  } catch {
    // localStorage unavailable (privacy mode / SSR) — ignore
  }
}

/**
 * Borra las preferencias de este navegador. Lo usa «borrar mi cuenta», que no
 * tiene nada más que borrar: las cuentas demo salen de `.env`, no de una base
 * de datos.
 *
 * Borra **todas** las claves candidatas y no solo la del id: con el id a mano se
 * borraría una y las otras seguirían ahí, y una lectura sin id —el header, el
 * mapa— volvería a encontrar lo que se acaba de borrar.
 */
export function clearUserPreferences(userId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of readKeys(userId)) {
      window.localStorage.removeItem(key);
    }
    window.localStorage.removeItem(LAST_USER_KEY);
  } catch {
    // Nada que hacer: si no se puede borrar, tampoco se pudo escribir.
  }
}