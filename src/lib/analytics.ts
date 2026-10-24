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

import type posthogJs from "posthog-js";

/* El nombre canónico es `NEXT_PUBLIC_POSTHOG_KEY`; el wizard de PostHog escribe
   `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`. Se aceptan los dos para que re-ejecutar
   el wizard no deje la integración muda por un cambio de nombre. */
const POSTHOG_KEY =
  process.env.NEXT_PUBLIC_POSTHOG_KEY ??
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

/* Conservación de UTM (§28). Última fuente gana: una campaña nueva reemplaza a
   la anterior, como en cualquier herramienta de atribución. */
const UTM_STORAGE_KEY = "lv_utm";
const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
] as const;
const UTM_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type Utm = Partial<Record<(typeof UTM_KEYS)[number], string>>;

type ClientePostHog = typeof posthogJs;

/*
 * Carga diferida.
 *
 * `posthog-js` son ~40 KB de JavaScript que no hacen falta para pintar el
 * mapa. Antes se importaba en el layout raíz y viajaba en el bundle inicial de
 * todas las rutas, incluida la primera visita desde WhatsApp. Ahora el SDK se
 * pide con `import()` después de `load` o de la primera interacción —lo que
 * llegue antes— y solo si hay clave: sin `NEXT_PUBLIC_POSTHOG_KEY`, esta
 * maquinaria no descarga nada.
 *
 * Los eventos que ocurren mientras el SDK viaja se guardan en una cola corta y
 * se mandan al terminar de cargar. Sin eso, se perdería justo el `$pageview`
 * de la entrada, que es el que cuenta la visita.
 */
let cliente: ClientePostHog | null = null;
let arranque: Promise<ClientePostHog | null> | null = null;
let programado = false;

/** Una llamada al SDK que espera a que exista. */
type Tarea = (ph: ClientePostHog) => void;
const cola: Tarea[] = [];

function hayClave(): boolean {
  return Boolean(POSTHOG_KEY) && typeof window !== "undefined";
}

function isInitialized(): boolean {
  return hayClave();
}

function ejecutar(tarea: Tarea): void {
  if (!hayClave()) return;
  if (cliente) {
    tarea(cliente);
    return;
  }
  cola.push(tarea);
  programarArranque();
}

/**
 * La fachada que usan los helpers de este archivo.
 *
 * Mantiene la misma forma que el SDK (`capture`, `identify`, `register`) para
 * que las llamadas de abajo no sepan si PostHog ya cargó o no.
 */
const posthog = {
  get __loaded(): boolean {
    return cliente?.__loaded === true;
  },
  capture(event: string, props?: Record<string, unknown>): void {
    ejecutar((ph) => ph.capture(event, props));
  },
  identify(userId: string, props?: { email?: string; name?: string }): void {
    ejecutar((ph) => ph.identify(userId, props));
  },
  register(props: Record<string, unknown>): void {
    ejecutar((ph) => ph.register(props));
  },
};

function cargar(): Promise<ClientePostHog | null> {
  if (arranque) return arranque;
  if (!POSTHOG_KEY) return Promise.resolve(null);

  arranque = import("posthog-js")
    .then((modulo) => {
      const ph = modulo.default;

      if (!ph.__loaded) {
        ph.init(POSTHOG_KEY, {
          api_host: POSTHOG_HOST,
          /* El pageview lo emite el provider en cada cambio de ruta; el
             automático solo contaría la primera carga de cada visita. */
          capture_pageview: false,
          capture_exceptions: true,
          persistence: "localStorage+cookie",
        });
      }

      cliente = ph;

      /* La atribución se restaura antes de vaciar la cola: así los eventos que
         esperaban —incluido el primer `$pageview`— ya llevan las *super
         properties* de la campaña. */
      restoreAttribution();
      for (const tarea of cola.splice(0)) tarea(ph);

      return ph;
    })
    .catch(() => {
      /* Un bloqueador de anuncios o una red caída no puede romper la página:
         se pierde la analítica, no la app. Se permite reintentar en la
         siguiente llamada. */
      arranque = null;
      return null;
    });

  return arranque;
}

/**
 * Elige cuándo pedir el SDK: tras `load` o en la primera interacción.
 *
 * En una visita que solo mira el mapa sin tocar nada, `load` basta. Si la
 * persona toca antes de que la página termine de cargar, se adelanta porque en
 * ese momento ya está claro que va a interactuar.
 */
function programarArranque(): void {
  if (programado || !hayClave()) return;
  programado = true;

  const arrancar = () => {
    void cargar();
  };

  if (document.readyState === "complete") {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(arrancar, { timeout: 3000 });
    } else {
      setTimeout(arrancar, 0);
    }
  } else {
    window.addEventListener("load", arrancar, { once: true });
  }

  window.addEventListener("pointerdown", arrancar, { once: true, passive: true });
  window.addEventListener("keydown", arrancar, { once: true });
  window.addEventListener("scroll", arrancar, { once: true, passive: true });
}

/**
 * Programa la carga de PostHog. Lo llama el provider del layout raíz.
 *
 * `capture_exceptions` manda los errores no capturados del navegador al
 * proyecto: es el "monitor" que faltaba — fallos de JS en producción con su
 * traza, sin depender de que alguien abra la consola.
 */
export function initAnalytics(): void {
  programarArranque();
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
    // Also store in cookie for server-side access
    document.cookie = `lv_utm=${JSON.stringify({ savedAt: Date.now(), utm })};path=/;max-age=${UTM_TTL_MS / 1000}`;
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
  posthog.capture("ai_search_completed", {
    query,
    result_count: resultCount,
    status,
  });
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
  posthog.capture("place_shared", {
    place_id: placeId,
    place_name: placeName,
    method,
  });
}

export function trackDirectionsRequested(
  placeId: string,
  placeName: string,
): void {
  if (!isInitialized()) return;
  posthog.capture("directions_requested", {
    place_id: placeId,
    place_name: placeName,
  });
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
