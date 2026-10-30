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
   versión purga las cachés que quedaron con la regla anterior. */
const CACHE_VERSION = "lv-v2";

const STATIC_CACHE = `lv-static-${CACHE_VERSION}`;
const PAGES_CACHE = `lv-pages-${CACHE_VERSION}`;
const API_CACHE = `lv-api-${CACHE_VERSION}`;
const IMAGES_CACHE = `lv-images-${CACHE_VERSION}`;

const CURRENT_CACHES = new Set([STATIC_CACHE, PAGES_CACHE, API_CACHE, IMAGES_CACHE]);

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
  "/fonts/space-grotesk.woff2",
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

/* Documentos que nunca se guardan: son privados. Se comparan por segmento para
   que `/business` no atrape a `/business-algo` y `/m/x` siga siendo público. */
const DOCUMENTOS_PRIVADOS = ["/admin", "/business", "/profile"];

const NAV_TIMEOUT_MS = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      /* `allSettled` y no `all`: si un icono o una fuente falla, el service
         worker tiene que instalarse igual. Sin precaché parcial no hay offline,
         pero un 404 puntual no puede dejar la app sin SW. */
      await Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: "reload" }))),
      );
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
                name.startsWith(PRIVATE_CACHE_PREFIX) || name.startsWith("lv-images-"),
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

  if (url.origin !== self.location.origin) return;
  if (esPeticionRsc(request, url)) return;
  if (esApiProhibida(url)) return;
  if (esDocumentoPrivado(request, url) && request.mode === "navigate") return;

  if (request.mode === "navigate") {
    event.respondWith(navegacion(request, url));
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
