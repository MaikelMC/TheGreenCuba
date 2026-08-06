const AUTH_KEY = "la-verde:admin";
const KEY_STORE = "la-verde:admin-key";

export function isAdminAuthed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(AUTH_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAdminAuthed(key: string): void {
  try {
    window.localStorage.setItem(AUTH_KEY, "1");
    window.localStorage.setItem(KEY_STORE, key);
  } catch {
    // ignore
  }
}

/** Clave validada del admin, para enviar a las API de administración. */
export function getAdminKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(KEY_STORE) ?? "";
  } catch {
    return "";
  }
}

export function clearAdminAuthed(): void {
  try {
    window.localStorage.removeItem(AUTH_KEY);
    window.localStorage.removeItem(KEY_STORE);
  } catch {
    // ignore
  }
}
