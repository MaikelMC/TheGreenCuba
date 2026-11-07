/*
 * Service worker de La Verde.
 *
 * JavaScript plano, sin build step: se sirve tal cual desde `/sw.js`. Si se
 * escribiera con el bundler, cada despliegue cambiaría su nombre y el navegador
 * perdería el registro entre versiones.
 *
 * Reglas que no se negocian:
 *  - Solo se interceptan `GET` del propio origen.
 *  - Nunca se cachean respuestas de autenticación, de datos privados ni nada
 *    que venga marcado como `private` o `no-store`.
 *  - Las peticiones RSC del App Router no se tocan: devolver HTML donde el
 *    router espera un payload rompe la navegación.
 *  - `skipWaiting()` solo cuando la página lo pide (botón «Actualizar»). Si se
 *    fuerza, una pestaña vieja puede pedir chunks que ya no existen.
 *
 * Al cambiar cualquier estrategia hay que subir `CACHE_VERSION`; `activate`
 * borra las cachés de versiones anteriores.
 */

/* v2: las navegaciones ya no caen a la copia guardada solo porque la red tarde
   más de 4 s. Ese camino servía HTML de un despliegue anterior mientras había
   conexión, y la app arrancaba con la sesión y los chunks viejos. Subir la
   versión purga las cachés que quedaron con la regla anterior.

   v3: las navegaciones privadas (`/business`, `/admin`, `/profile`) sin red
   caen a `offline.html` en vez de a la página de error del navegador. No se
   guarda su documento —siguen sin cachearse—, pero `offline.html` pinta los
   snapshots de IndexedDB que antes quedaban inalcanzables.

   v4: caché de teselas del mapa (`lv-tiles-v4`). Las teselas de OSM y CartoDB
   se interceptan cross-origin y se guardan con cache-first (máx 1 500,
   30 días). `crossOrigin="anonymous"` en el `<TileLayer>` hace que lleguen
   como CORS normal —no opacas— y se puedan inspeccionar y cachear sin coste
   de cuota exagerado. Tesela transparente de respaldo cuando no hay red ni
   caché. Se elimina `/fonts/space-grotesk.woff2` del precache: Space Grotesk
   se sirve desde `/_next/static/media/` (next/font/local) y ya cae en la
   caché estática inmutable. */
const CACHE_VERSION = "lv-v4";

const STATIC_CACHE = `lv-static-${CACHE_VERSION}`;
const PAGES_CACHE = `lv-pages-${CACHE_VERSION}`;
const API_CACHE = `lv-api-${CACHE_VERSION}`;
const IMAGES_CACHE = `lv-images-${CACHE_VERSION}`;
const TILES_CACHE = `lv-tiles-${CACHE_VERSION}`;

const CURRENT_CACHES = new Set([STATIC_CACHE, PAGES_CACHE, API_CACHE, IMAGES_CACHE, TILES_CACHE]);

/* `lv-private-` se reserva para cachés de datos privados. Hoy no existe
   ninguna, pero la purga ya las contempla para que el día que se añada una no
   haya que acordarse de tocar esto. */
const PRIVATE_CACHE_PREFIX = "lv-private-";

const PRECACHE_URLS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
  "/logo.png",
  /* Las fuentes de la app (DM Sans, Source Sans 3, Space Grotesk) se sirven
     desde `/_next/static/media/` con hash —next/font/local— y ya caen en la
     caché estática inmutable al primer uso. No se pueden precachear aquí porque
     sus rutas cambian en cada build. */
];

/* Rutas de API que jamás entran en una caché compartida. */
const API_PROHIBIDAS = [
  "/api/auth/",
  "/api/me",
  "/api/notifications",
  "/api/business/",
  "/api/negocio/",
  "/api/pedidos/",
  "/api/reservas",
];

/* Una ruta de API pública que sí se cachea, con su caducidad. */
const API_PUBLICAS = ["/api/places", "/api/categories"];
const API_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const IMAGE_MAX_ENTRIES = 80;
const IMAGE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/* Dominios de teselas del mapa. Se interceptan aunque sean cross-origin porque
   `crossOrigin="anonymous"` en el <TileLayer> hace que lleguen como CORS normal
   y no como respuestas opacas. Nunca se descargan por adelantado (prohíbido por
   las normas de uso de OSM); solo se guardan las que el usuario ya vio. */
const TILE_HOSTS = [
  "tile.openstreetmap.org",
  "basemaps.cartocdn.com",
];
const TILE_MAX_ENTRIES = 1500;
const TILE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/* Tesela transparente de respaldo: un PNG 1×1 de fondo neutro. Se devuelve
   sin red y sin la tesela en caché para que el mapa no muestre el error de
   imagen roto del navegador. */
const TILE_FALLBACK_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

/* Documentos que nunca se guardan: son privados. Se comparan por segmento para
   que `/business` no atrape a `/business-algo` y `/m/x` siga siendo público. */
const DOCUMENTOS_PRIVADOS = ["/admin", "/business", "/profile"];

const NAV_TIMEOUT_MS = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      /* Precaché estático: `allSettled` para que un 404 puntual no impida
         instalar el SW. */
      const staticCache = await caches.open(STATIC_CACHE);
      await Promise.allSettled(
        PRECACHE_URLS.map((url) => staticCache.add(new Request(url, { cache: "reload" }))),
      );

      /* `/home` va en la caché de páginas (network-first), no en la estática
         (cache-first): después de un despliegue los assets del static ya no
         existen, y una navegación hacia chunks viejos rompe la app. Se guarda
         solo si la respuesta es pública —sin `Set-Cookie` ni `private`. */
      try {
        const pagesCache = await caches.open(PAGES_CACHE);
        const response = await fetch("/home", { cache: "reload" });
        if (sePuedeCachear(response)) {
          await pagesCache.put("/home", response);
        }
      } catch {
        /* Sin red en el momento de instalar: sin `/home` en caché. Se guardará
           en la primera visita con conexión, como cualquier otra ruta pública. */
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith("lv-") &&
              !CURRENT_CACHES.has(name) &&
              !name.startsWith(PRIVATE_CACHE_PREFIX),
          )
          .map((name) => caches.delete(name)),
      );
      /* Una sola vez, al activar: la pestaña que ya estaba abierta pasa a estar
         controlada sin recargar. */
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};

  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (data.type === "PURGE_PRIVATE") {
    event.waitUntil(
      (async () => {
        const names = await caches.keys();
        await Promise.all(
          names
            .filter(
              (name) =>
                /* Páginas, catálogo e imágenes públicos no llevan sesión,
                   pero en un teléfono compartido son la última visita de
                   quien se fue. Las teselas también se purgan.
                   `lv-static-` se queda: es lo que permite abrir
                   `offline.html` después de salir. */
                name.startsWith(PRIVATE_CACHE_PREFIX) ||
                name.startsWith("lv-pages-") ||
                name.startsWith("lv-api-") ||
                name.startsWith("lv-images-") ||
                name.startsWith("lv-tiles-"),
            )
            .map((name) => caches.delete(name)),
        );
        const port = event.ports && event.ports[0];
        if (port) port.postMessage({ ok: true });
      })(),
    );
  }
});

/* ------------------------------------------------------------------------- */
/* Fetch                                                                     */
/* ------------------------------------------------------------------------- */

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  /* Teselas del mapa: cross-origin pero manejadas explícitamente. Van antes
     del bloqueo de origen para que no se salten. */
  if (esTesela(url)) {
    event.respondWith(tesela(request, url));
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (esPeticionRsc(request, url)) return;
  if (esApiProhibida(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      esDocumentoPrivado(request, url) ? navegacionPrivada(request) : navegacion(request, url),
    );
    return;
  }

  if (esApiPublica(url)) {
    event.respondWith(apiPublica(request));
    return;
  }

  if (esEstaticoInmutable(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (esImagen(request, url)) {
    event.respondWith(imagen(request));
  }
});

/**
 * Peticiones del React Server Components router.
 *
 * El `fetch` normal del navegador a una URL de navegación no lleva estas
 * cabeceras; las lleva el router de Next. Si el service worker contestara HTML a
 * una de ellas, el router intentaría parsearlo como payload y la navegación se
 * quedaría a medias.
 */
function esPeticionRsc(request, url) {
  if (url.searchParams.has("_rsc")) return true;
  if (request.headers.get("RSC")) return true;
  if (request.headers.get("Next-Router-Prefetch")) return true;
  if (request.headers.get("Next-Router-State-Tree")) return true;
  return false;
}

function esApiProhibida(url) {
  if (API_PROHIBIDAS.some((prefijo) => url.pathname.startsWith(prefijo))) return true;
  /* `/api/places/{id}/dis...` es una ruta de escritura de disponibilidad; el
     catálogo público es `/api/places` a secas. */
  return /^\/api\/places\/[^/]+\/dis/.test(url.pathname);
}

function esDocumentoPrivado(request, url) {
  return DOCUMENTOS_PRIVADOS.some(
    (base) => url.pathname === base || url.pathname.startsWith(`${base}/`),
  );
}

function esApiPublica(url) {
  return API_PUBLICAS.includes(url.pathname);
}

function esEstaticoInmutable(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/logo.png"
  );
}

function esImagen(request, url) {
  if (request.destination === "image") return true;
  return (
    url.pathname.startsWith("/_next/image") ||
    /\.(png|jpe?g|webp|avif|gif|svg)$/i.test(url.pathname)
  );
}

function esTesela(url) {
  return TILE_HOSTS.some((host) => url.hostname.endsWith(host));
}

/** Una respuesta puede guardarse si es correcta y no es privada. */
function sePuedeCachear(response) {
  if (!response || !response.ok) return false;
  const cacheControl = (response.headers.get("Cache-Control") || "").toLowerCase();
  if (cacheControl.includes("private") || cacheControl.includes("no-store")) return false;
  if (response.headers.get("Set-Cookie")) return false;
  return true;
}

function conTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("tiempo agotado")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Ruta pública: su documento puede guardarse para abrirlo sin red. */
function esRutaPublica(url) {
  if (esDocumentoPrivado(null, url)) return false;
  return (
    url.pathname === "/" ||
    url.pathname === "/home" ||
    url.pathname.startsWith("/place/") ||
    url.pathname.startsWith("/m/") ||
    url.pathname === "/offline.html"
  );
}

async function navegacion(request, url) {
  const cache = await caches.open(PAGES_CACHE);
  const red = fetch(request);

  let response = null;
  try {
    response = await conTimeout(red, NAV_TIMEOUT_MS);
  } catch {
    /* El timeout no cancela `red`: la petición sigue viva. Si hay conexión, se
       espera a que conteste en vez de servir la copia guardada, que puede ser
       de otro despliegue (chunks que ya no existen, sesión de antes). Solo sin
       red se usa el documento guardado por debajo. */
    if (self.navigator?.onLine !== false) {
      response = await red.catch(() => null);
    }
  }

  if (response) {
    if (sePuedeCachear(response) && esRutaPublica(url)) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  }

  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const offline = await caches.match("/offline.html");
  if (offline) return offline;

  return respuestaSinConexion();
}

/**
 * Navegación a una ruta privada.
 *
 * Nunca se guarda su documento: son pantallas con la sesión dentro y Cache
 * Storage es compartida por todo el origen. Solo cambia el camino sin red —
 * antes se cedía la petición al navegador, que contestaba con su página de
 * error; ahora se sirve `offline.html`, que pinta los snapshots privados de
 * IndexedDB (`la-verde-offline`) y bloquea los que tengan más de 7 días.
 *
 * Se espera la petición viva cuando hay conexión, igual que en `navegacion`:
 * un timeout de 4 s no significa que no haya red, y mentir con «sin conexión»
 * cuando la página solo tarda es peor que esperar.
 */
async function navegacionPrivada(request) {
  const red = fetch(request);

  let response = null;
  try {
    response = await conTimeout(red, NAV_TIMEOUT_MS);
  } catch {
    if (self.navigator?.onLine !== false) {
      response = await red.catch(() => null);
    }
  }

  if (response) return response;

  const offline = await caches.match("/offline.html");
  if (offline) return offline;

  return respuestaSinConexion();
}

function respuestaSinConexion() {
  return new Response(
    "<!doctype html><html lang=\"es\"><meta charset=\"utf-8\"><title>Sin conexión</title><p>Sin conexión.</p></html>",
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

async function apiPublica(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await conTimeout(fetch(request), NAV_TIMEOUT_MS);
    if (sePuedeCachear(response)) {
      const headers = new Headers(response.headers);
      headers.set("X-LV-Cached-At", new Date().toISOString());
      /* Al reconstruir la respuesta el cuerpo ya viene descomprimido: dejar
         `Content-Encoding` haría que el navegador intentara descomprimir otra
         vez y la respuesta fallara al leerse. */
      headers.delete("Content-Length");
      headers.delete("Content-Encoding");
      const body = await response.clone().blob();
      const copy = new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      cache.put(request, copy).catch(() => {});
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (!cached) throw error;

    const cachedAt = cached.headers.get("X-LV-Cached-At");
    if (cachedAt && Date.now() - Date.parse(cachedAt) > API_MAX_AGE_MS) {
      throw error;
    }
    return cached;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (sePuedeCachear(response)) {
    const copy = response.clone();
    cache.put(request, copy).catch(() => {});
  }
  return response;
}

async function imagen(request) {
  const cache = await caches.open(IMAGES_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    const guardadaEl = cached.headers.get("X-LV-Cached-At");
    if (!guardadaEl || Date.now() - Date.parse(guardadaEl) <= IMAGE_MAX_AGE_MS) {
      return cached;
    }
    await cache.delete(request);
  }

  const response = await fetch(request);
  if (sePuedeCachear(response)) {
    const headers = new Headers(response.headers);
    headers.set("X-LV-Cached-At", new Date().toISOString());
    headers.delete("Content-Length");
    headers.delete("Content-Encoding");
    const body = await response.clone().blob();
    const copy = new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
    cache
      .put(request, copy)
      .then(() => trimCache(IMAGES_CACHE, IMAGE_MAX_ENTRIES))
      .catch(() => {});
  }
  return response;
}

/** Deja como máximo `maxEntries` entradas: borra las más antiguas primero. */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;

  const sobran = keys.length - maxEntries;
  for (let i = 0; i < sobran; i += 1) {
    await cache.delete(keys[i]);
  }
}

/**
 * Caché de teselas del mapa.
 *
 * Cache-first sobre lo que el usuario ya vio. Si la red falla y la tesela no
 * está en caché, devuelve un PNG transparente 1×1 —no el error roto del
 * navegador—. Solo se guardan respuestas `ok` de tipo `cors` o `basic`; las
 * opacas (`no-cors`) no se inspeccionan ni se cachean: llegarían solo si
 * `crossOrigin="anonymous"` no estuviera puesto en el <TileLayer>.
 */
async function tesela(request, url) {
  const cache = await caches.open(TILES_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    const guardadaEl = cached.headers.get("X-LV-Cached-At");
    if (!guardadaEl || Date.now() - Date.parse(guardadaEl) <= TILE_MAX_AGE_MS) {
      return cached;
    }
    await cache.delete(request);
  }

  try {
    const response = await fetch(request);

    /* Solo cacheamos respuestas inspeccionables: cors o basic. Una opaca
       ocuparía ~7 MB de cuota sin poder leer su contenido. */
    if (
      response.ok &&
      (response.type === "cors" || response.type === "basic")
    ) {
      const headers = new Headers(response.headers);
      headers.set("X-LV-Cached-At", new Date().toISOString());
      headers.delete("Content-Length");
      headers.delete("Content-Encoding");
      const body = await response.clone().blob();
      const copia = new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      cache
        .put(request, copia)
        .then(() => trimCache(TILES_CACHE, TILE_MAX_ENTRIES))
        .catch(() => {});
    }

    return response;
  } catch {
    /* Sin red y sin caché: PNG transparente en vez del icono de imagen rota. */
    return fetch(TILE_FALLBACK_PNG);
  }
}

/* ------------------------------------------------------------------------- */
/* Push                                                                      */
/* ------------------------------------------------------------------------- */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "La Verde";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "la-verde",
    /* Toda la app está en español; sin esto el lector de pantalla del móvil
       pronuncia el aviso con la voz del sistema. */
    lang: "es",
    data: { url: data.url || "/home" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/home";

  event.waitUntil(
    (async () => {
      const destino = new URL(url, self.location.origin).href;
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const ventana of ventanas) {
        if (ventana.url === destino && "focus" in ventana) {
          return ventana.focus();
        }
      }
      return self.clients.openWindow(destino);
    })(),
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const anterior = event.oldSubscription;
        if (!anterior) return;
        /* Sin `applicationServerKey` no se puede renovar: se avisa a la página
           para que ofrezca volver a activar el aviso. */
        const suscripcion = await self.registration.pushManager.subscribe(
          anterior.options,
        );
        const json = suscripcion.toJSON();
        const clientes = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const cliente of clientes) {
          cliente.postMessage({ type: "PUSH_SUBSCRIPTION_CHANGED", subscription: json });
        }
      } catch {
        const clientes = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const cliente of clientes) {
          cliente.postMessage({ type: "PUSH_SUBSCRIPTION_FAILED" });
        }
      }
    })(),
  );
});
