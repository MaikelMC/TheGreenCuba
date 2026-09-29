/**
 * Cliente de analítica PostHog.
 *
 * Un solo punto para todo lo que el sitio manda a PostHog: la inicialización,
 * la conservación de la atribución UTM (§28 del plan SEO/AEO) y los eventos
 * nombrados del plan (§27: acquisition, discovery, place engagement, business).
 *
 * Decisiones:
 *
 * - **Sin key no hay nada.** `NEXT_PUBLIC_POSTHOG_KEY` vacía deja cada función
 *   en no-op: el sitio funciona igual y ningún evento sale a la red. La
 *   integración se activa sola en el momento en que la key exista.
 * - **`$pageview` manual.** `capture_pageview: false` y el provider emite el
 *   pageview en cada cambio de ruta: es la única forma de contar bien una SPA
 *   de App Router (el conteo automático solo ve la primera carga).
 * - **UTM persistente.** posthog-js ya adjunta los `utm_*` que llegan en la URL
 *   al `$pageview` de esa entrada, pero se pierden en cuanto el usuario navega
 *   por dentro. Aquí se guardan en `localStorage` —última fuente, con caducidad
 *   de 30 días— y se registran como *super properties*, así un registro o un
 *   alta de negocio días después siguen llevando la campaña que lo trajo.
 * - **Eventos con nombre, no autocaptura de negocio.** La autocaptura queda
 *   activada para tener clicks genéricos desde el día uno, pero lo que el plan
 *   pide medir se emite explícito aquí, con propiedades estables que no cambian
 *   si mañana se reordena el DOM.
 */

import posthog from "posthog-js";

/* El nombre canónico es `NEXT_PUBLIC_POSTHOG_KEY`; el wizard de PostHog escribe
   `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`. Se aceptan los dos para que re-ejecutar
   el wizard no deje la integración muda por un cambio de nombre. */
const POSTHOG_KEY =
  process.env.NEXT_PUBLIC_POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

/* Conservación de UTM (§28). Última fuente gana: una campaña nueva reemplaza a
   la anterior, como en cualquier herramienta de atribución. */
const UTM_STORAGE_KEY = "lv_utm";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;
const UTM_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type Utm = Partial<Record<(typeof UTM_KEYS)[number], string>>;

function isInitialized(): boolean {
  return Boolean(POSTHOG_KEY) && typeof window !== "undefined" && posthog.__loaded;
}

/**
 * Inicializa PostHog una sola vez. Lo llama el provider del layout raíz.
 *
 * `capture_exceptions` manda los errores no capturados del navegador al
 * proyecto: es el "monitor" que faltaba — fallos de JS en producción con su
 * traza, sin depender de que alguien abra la consola.
 */
export function initAnalytics(): void {
  if (!POSTHOG_KEY || typeof window === "undefined") return;
  if (posthog.__loaded) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    /* El pageview lo emite `PostHogPageView` en cada cambio de ruta; el
       automático solo contaría la primera carga de cada visita. */
    capture_pageview: false,
    capture_exceptions: true,
    persistence: "localStorage+cookie",
  });

  restoreAttribution();
}

/** Pageview manual por ruta (SPA). `referrer` lo adjunta posthog-js él solo. */
export function trackPageView(): void {
  if (!isInitialized()) return;
  posthog.capture("$pageview", { $current_url: window.location.href });
}

/** Asocia los eventos siguientes a un usuario registrado. */
export function identifyUser(
  userId: string,
  props?: { email?: string; name?: string },
): void {
  if (!isInitialized()) return;
  posthog.identify(userId, props);
}

function readUtmFromUrl(): Utm {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const utm: Utm = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) utm[key] = value;
  }
  return utm;
}

function readStoredUtm(): Utm {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { savedAt?: number; utm?: Utm };
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > UTM_TTL_MS) {
      window.localStorage.removeItem(UTM_STORAGE_KEY);
      return {};
    }
    return parsed.utm ?? {};
  } catch {
    return {};
  }
}

function storeUtm(utm: Utm): void {
  try {
    window.localStorage.setItem(
      UTM_STORAGE_KEY,
      JSON.stringify({ savedAt: Date.now(), utm }),
    );
  } catch {
    // Almacenamiento lleno o bloqueado: se pierde la atribución, no la página.
  }
}

function restoreAttribution(): void {
  const fromUrl = readUtmFromUrl();
  if (Object.keys(fromUrl).length > 0) {
    storeUtm(fromUrl);
    posthog.register(fromUrl);
    posthog.capture("utm_captured", {
      ...fromUrl,
      landing_path: window.location.pathname,
      referrer: document.referrer || null,
    });
    return;
  }
  /* Sin UTM en la URL, manda la última campaña conocida: los eventos de esta
     sesión siguen llevando la atribución aunque el usuario ya haya navegado. */
  const stored = readStoredUtm();
  if (Object.keys(stored).length > 0) {
    posthog.register(stored);
  }
}

/* ─── Discovery (§27) ─────────────────────────────────────────────────── */

export function trackAiSearchSubmitted(query: string): void {
  if (!isInitialized()) return;
  posthog.capture("ai_search_submitted", { query });
}

export function trackAiSearchCompleted(
  query: string,
  resultCount: number,
  status: "ok" | "empty" | "error",
): void {
  if (!isInitialized()) return;
  posthog.capture("ai_search_completed", { query, result_count: resultCount, status });
}

export function trackCategorySelect(value: string): void {
  if (!isInitialized()) return;
  posthog.capture("category_selected", { category: value });
}

export function trackFilterToggle(value: string, active: boolean): void {
  if (!isInitialized()) return;
  posthog.capture("filter_toggled", { filter: value, active });
}

export function trackMapMarkerClick(placeId: string): void {
  if (!isInitialized()) return;
  posthog.capture("map_marker_clicked", { place_id: placeId });
}

/** Botón "Ver en el mapa" (📍) de una tarjeta: vuela el mapa hasta el lugar. */
export function trackMapLocate(placeId: string): void {
  if (!isInitialized()) return;
  posthog.capture("map_locate_clicked", { place_id: placeId });
}

export function trackRouteRequested(
  placeId: string,
  source: "ficha" | "popup",
  fallback: boolean,
): void {
  if (!isInitialized()) return;
  posthog.capture("route_requested", {
    place_id: placeId,
    source,
    /* `true` = OSRM no dio ruta por calles y se pintó la recta de respaldo. */
    fallback,
  });
}

/* ─── Place engagement (§27) ──────────────────────────────────────────── */

export function trackPlaceViewed(place: {
  id: string;
  name: string;
  category?: string;
  barrio?: string;
}): void {
  if (!isInitialized()) return;
  posthog.capture("place_viewed", {
    place_id: place.id,
    place_name: place.name,
    category: place.category ?? null,
    barrio: place.barrio ?? null,
  });
}

export function trackPlaceShared(
  placeId: string,
  placeName: string,
  method: "native" | "clipboard",
): void {
  if (!isInitialized()) return;
  posthog.capture("place_shared", { place_id: placeId, place_name: placeName, method });
}

export function trackDirectionsRequested(placeId: string, placeName: string): void {
  if (!isInitialized()) return;
  posthog.capture("directions_requested", { place_id: placeId, place_name: placeName });
}

export function trackPlaceSaveToggled(
  placeId: string,
  placeName: string,
  saved: boolean,
): void {
  if (!isInitialized()) return;
  posthog.capture("place_save_toggled", {
    place_id: placeId,
    place_name: placeName,
    saved,
  });
}

/* ─── Business (§27) ──────────────────────────────────────────────────── */

export function trackUserRegistered(identified: boolean): void {
  if (!isInitialized()) return;
  posthog.capture("user_registered", { identified });
}

export function trackUserLoggedIn(identified: boolean): void {
  if (!isInitialized()) return;
  posthog.capture("user_logged_in", { identified });
}

export function trackOnboardingCompleted(props: {
  location: string;
  interests: string[];
  moods: string[];
  currencies: string[];
}): void {
  if (!isInitialized()) return;
  posthog.capture("onboarding_completed", props);
}

export function trackBusinessSubmitted(props: {
  plan: string;
  category: string;
  photoCount: number;
  /** Fotos que no subieron: el alta vale igual, pero conviene saberlo. */
  photoFailures?: number;
}): void {
  if (!isInitialized()) return;
  posthog.capture("business_registration_submitted", props);
}
