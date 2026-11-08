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
 *  - Las peticiones RSC del App Router: si la red falla, se devuelve text/plain
 *    vacío para que Next haga MPA navigation y el SW intercepte la navegación.
 *  - `skipWaiting()` solo cuando la página lo pide (botón «Actualizar»). Si se
 *    fuerza, una pestaña vieja puede pedir chunks que ya no existen.
 *
 * `CACHE_VERSION` lo gestiona `public/sw-version.js`, generado en prebuild.
 */

/* La versión la escribe `scripts/sw-version.js` en prebuild y vive en
   `public/sw-version.js` (ignorado por git). El navegador rastrea los scripts
   importados: si cambia, instala una versión nueva del SW sin tocar sw.js. */
importScripts("/sw-version.js");

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
   caché estática inmutable.

   v5: teselas e imágenes ya no bloquean su respuesta al guardar en caché.
   El guardado y el recorte van dentro de `event.waitUntil`, así el SW
   devuelve la tesela en cuanto llega de la red. Recorte escalonado: solo
   cada 50 guardados o cada 5 minutos, en vez de en cada tesela.
   Subdominios limitados a dos (a/b) en todos los proveedores; preconexión
   TLS a esos dos desde el componente del mapa. Fondo del MapContainer al
   color de tierra real de OSM/dark. TileLayer con keepBuffer=4,
   updateWhenZooming=false, updateWhenIdle=true.

   v6: las teselas del mapa ya no pasan por el SW. La caché lv-tiles-v5
   se elimina al activar esta versión. Mientras las teselas vengan de
   dominios externos se sirven directamente desde la red.

   v7: vuelve la caché de teselas, pero ahora solo para MapLibre + OpenFreeMap.
   Patrón del anexo: clone ANTES de devolver, waitUntil para el put, 204 en
   fallo de red (no tesela falsa). TileJSON en red-first en la misma caché.
   Precaché del estilo, sprite y fuentes del mapa. `/mapa/` entra en la caché
   estática. Límite 3 000 teselas; recorte cada 100 guardados o 5 minutos.

   v8: RSC fallback: fallo de red → text/plain → Next hace MPA navigation →
   SW intercepta la navegación completa. Rutas /profile y /notifications sin
   red → /sin-conexion/perfil. Rutas públicas sin caché → redirect a
   /home?desde=pagina. IMAGE_MAX_ENTRIES 80 → 400. CACHE_VERSION deja de ser
   constante hardcoded: la gestiona sw-version.js generado en prebuild. */
const CACHE_VERSION = (typeof self.SW_VERSION === "string" && self.SW_VERSION) || "lv-v8-fallback";

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
  "/sin-conexion/perfil",
  "/sin-conexion/negocio",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
  "/logo.png",
  /* Las fuentes de la app (DM Sans, Source Sans 3, Space Grotesk) se sirven
     desde `/_next/static/media/` con hash —next/font/local— y ya caen en la
     caché estática inmutable al primer uso. No se pueden precachear aquí porque
     sus rutas cambian en cada build. */
  /* Mapa: estilo y sprite. Las fuentes del mapa (Noto Sans) se cachean en la
     primera carga por la misma ruta que el estilo —/mapa/ cae en STATIC_CACHE—;
     solo los rangos básicos se precachean aquí para que el texto de los mapas
     funcione en modo avión desde la primera visita al mapa.
     Los rangos 0-255 y 256-511 cubren el alfabeto latino completo —todo lo que
     aparece en los mapas de Cuba—. Los caracteres árabes, cirílicos y CJK solo
     se cargan si alguien los ve, que es el comportamiento correcto. */
  "/mapa/estilo-la-verde.json",
  "/mapa/sprite/sprite.json",
  "/mapa/sprite/sprite.png",
  "/mapa/sprite/sprite@2x.json",
  "/mapa/sprite/sprite@2x.png",
  "/mapa/fuentes/Noto%20Sans%20Regular/0-255.pbf",
  "/mapa/fuentes/Noto%20Sans%20Regular/256-511.pbf",
  "/mapa/fuentes/Noto%20Sans%20Bold/0-255.pbf",
  "/mapa/fuentes/Noto%20Sans%20Bold/256-511.pbf",
  "/mapa/fuentes/Noto%20Sans%20Italic/0-255.pbf",
  "/mapa/fuentes/Noto%20Sans%20Italic/256-511.pbf",
];

/* Rutas de API que jamás entran en una caché compartida. */
const API_PROHIBIDAS = [
  "/api/auth/",
  "/api/me",
  "/api/notifications",
  "/api/business/",
  "/api/negocio/",
  "/api/negocios/",
  "/api/pedidos/",
  "/api/reservas",
  "/sw-version.js",
];

/* Una ruta de API pública que sí se cachea, con su caducidad. */
const API_PUBLICAS = ["/api/places", "/api/categories"];
const API_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const IMAGE_MAX_ENTRIES = 400;
const IMAGE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const TILES_MAX_ENTRIES = 3000;
/* Las teselas se recortan cada 100 guardados (más infrecuente que las imágenes
   porque son más ligeras y el límite es mayor). */
const TILES_RECORTE_CADA_N = 100;

/* Recorte escalonado de cachés grandes (imágenes y teselas).
   Se recorta al llegar a RECORTE_CADA_N guardados, o si han pasado
   RECORTE_CADA_MS sin recortar (por si el SW se durmió y los contadores se
   reiniciaron). Los objetos se pasan por referencia para compartir la función. */
const RECORTE_CADA_N = 50;
const RECORTE_CADA_MS = 5 * 60 * 1000;
const _recorte = {
  imagenes: { n: 0, t: 0 },
  teselas: { n: 0, t: 0 },
};

/* Documentos que nunca se guardan: son privados. Se comparan por segmento para
   que `/business` no atrape a `/business-algo` y `/m/x` siga siendo público. */
const DOCUMENTOS_PRIVADOS = ["/admin", "/business", "/profile", "/notifications"];

/* Rutas privadas que sin red sirven /sin-conexion/perfil (snapshot en IndexedDB). */
const DOCUMENTOS_PERFIL_OFFLINE = ["/profile", "/notifications"];

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
                /* Páginas, catálogo, imágenes y teselas son públicos pero en
                   un teléfono compartido revelan el historial de quien se fue.
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

  /* Teselas y TileJSON de OpenFreeMap — cross-origin, se gestionan antes del
     guard de origen. Las teselas son `/planet/{z}/{x}/{y}.*`; el TileJSON es
     `/planet` a secas (devuelve JSON con las URLs de las teselas). */
  if (url.hostname === "tiles.openfreemap.org") {
    if (url.pathname.startsWith("/planet/")) {
      event.respondWith(tesela(event, request));
    } else if (url.pathname === "/planet") {
      event.respondWith(tilejson(event, request));
    }
    /* Cualquier otra ruta de ese host (improbable) se deja pasar sin interceptar. */
    return;
  }

  if (url.origin !== self.location.origin) return;

  /* Peticiones RSC del router de Next.js.
     - Prefetch (Next-Router-Prefetch): se deja pasar sin interceptar. Si falla,
       Next lo descarta silenciosamente. Responder con text/plain aquí dispararía
       doMpaNavigation y recargaría la página sin que el usuario haya navegado.
     - Navegación real (RSC o _rsc): si la red falla devolvemos text/plain para
       que Next haga MPA navigation y el SW pueda servir la ruta desde caché. */
  if (esPeticionRsc(request, url)) {
    if (request.headers.get("Next-Router-Prefetch")) return;
    event.respondWith(rscFallback(request));
    return;
  }

  if (esApiProhibida(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      esDocumentoPrivado(request, url) ? navegacionPrivada(request, url) : navegacion(request, url),
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
    event.respondWith(imagen(event, request));
  }
});

/**
 * RSC fallback: intenta la red; si falla (sin conexión), devuelve text/plain.
 * Next interpreta una respuesta no-RSC como señal de hacer MPA navigation,
 * con lo que el SW intercepta esa navegación completa y puede servir caché.
 * Solo devuelve text/plain en fallo de red — las respuestas 4xx/5xx del
 * servidor se devuelven tal cual para que Next las gestione.
 */
async function rscFallback(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response("", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

/**
 * Peticiones del React Server Components router.
 *
 * El `fetch` normal del navegador a una URL de navegación no lleva estas
 * cabeceras; las lleva el router de Next.
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
    /* Estilo, sprite y fuentes del mapa. No llevan hash —viven en rutas fijas—,
       pero la caché se purga con CACHE_VERSION en cada despliegue. */
    url.pathname.startsWith("/mapa/") ||
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
    url.pathname === "/offline.html" ||
    url.pathname === "/sin-conexion/perfil" ||
    url.pathname === "/sin-conexion/negocio"
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

  /* Sin red: buscar en caché. Solo /home tolera ignoreSearch (para /home?desde=pagina). */
  const cached =
    url.pathname === "/home"
      ? await cache.match("/home", { ignoreSearch: true })
      : await cache.match(request);
  if (cached) return cached;

  /* Sin caché: redirigir a /home con aviso en vez de mostrar offline.html.
     /home ya está en caché (precaché + primera visita), así que el redirect
     siempre aterriza en algo útil. */
  return Response.redirect("/home?desde=pagina", 302);
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
 *
 * /profile y /notifications sin red → /sin-conexion/perfil (snapshot IndexedDB).
 * /admin y /business sin red → offline.html.
 */
async function navegacionPrivada(request, url) {
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

  /* Sin red: elegir la pantalla offline según la ruta. */
  const esPerfilONotif = DOCUMENTOS_PERFIL_OFFLINE.some(
    (base) => url.pathname === base || url.pathname.startsWith(`${base}/`),
  );
  if (esPerfilONotif) {
    const perfilOffline = await caches.match("/sin-conexion/perfil");
    if (perfilOffline) return perfilOffline;
  }

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

async function imagen(event, request) {
  const cache = await caches.open(IMAGES_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    const guardadaEl = cached.headers.get("X-LV-Cached-At");
    if (!guardadaEl || Date.now() - Date.parse(guardadaEl) <= IMAGE_MAX_AGE_MS) {
      return cached;
    }
    cache.delete(request); // fire-and-forget: imagen caducada, se recarga
  }

  const response = await fetch(request);
  if (sePuedeCachear(response)) {
    /* El guardado va en waitUntil para no bloquear la respuesta. El clon se
       consume en guardarYRecortar; la respuesta original llega al navegador
       en cuanto `fetch` la devuelve. */
    event.waitUntil(
      guardarYRecortar(cache, request, response.clone(), IMAGES_CACHE, IMAGE_MAX_ENTRIES, _recorte.imagenes),
    );
  }
  return response;
}

/**
 * Guarda una copia en caché y, si toca, recorta las entradas sobrantes.
 *
 * El recorte no ocurre en cada guardado: solo cada RECORTE_CADA_N guardados
 * o cuando el SW lleva más de RECORTE_CADA_MS sin recortar (por si se durmió
 * y los contadores se reiniciaron). Así `cache.keys()` no se llama en cada
 * tesela sino en lotes, sin bloquear el flujo de respuestas.
 */
async function guardarYRecortar(cache, request, responseClone, cacheName, maxEntries, contador) {
  const headers = new Headers(responseClone.headers);
  headers.set("X-LV-Cached-At", new Date().toISOString());
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");
  const body = await responseClone.blob();
  await cache.put(request, new Response(body, {
    status: responseClone.status,
    statusText: responseClone.statusText,
    headers,
  }));

  contador.n++;
  const ahora = Date.now();
  if (contador.n >= RECORTE_CADA_N || ahora - contador.t >= RECORTE_CADA_MS) {
    contador.n = 0;
    contador.t = ahora;
    await trimCache(cacheName, maxEntries);
  }
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
/* Teselas (OpenFreeMap, cross-origin)                                       */
/* ------------------------------------------------------------------------- */

/**
 * Cache-first para teselas individuales. Patrón del anexo:
 *  1. Si está en caché → devuelve sin red.
 *  2. fetch() → si es cors/basic: clone ANTES de devolver, waitUntil(put).
 *  3. Sin red → 204 (MapLibre lo ignora limpiamente; no hay tesela falsa).
 *
 * El clone se toma ANTES de devolver la respuesta original —no después—
 * porque la spec dice que el body solo se puede consumir una vez, y el
 * navegador ya empieza a leerlo en cuanto `respondWith` lo recibe.
 */
async function tesela(event, request) {
  const cache = await caches.open(TILES_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  let response;
  try {
    response = await fetch(request);
  } catch {
    return new Response(null, { status: 204 });
  }

  if (response.ok && (response.type === "cors" || response.type === "basic")) {
    const copia = response.clone();
    event.waitUntil(
      cache.put(request, copia).then(recortarSiToca),
    );
  }
  return response;
}

/**
 * Network-first para el TileJSON de OpenFreeMap (`/planet`).
 * Se guarda en TILES_CACHE; sin red se sirve la copia guardada.
 * El TileJSON pesa unos pocos KB —no recorta— y es necesario antes de
 * que MapLibre pueda pedir cualquier tesela.
 */
async function tilejson(event, request) {
  const cache = await caches.open(TILES_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && (response.type === "cors" || response.type === "basic")) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(null, { status: 204 });
  }
}

/** Recorte escalonado de la caché de teselas. */
async function recortarSiToca() {
  const contador = _recorte.teselas;
  contador.n++;
  const ahora = Date.now();
  if (contador.n >= TILES_RECORTE_CADA_N || ahora - contador.t >= RECORTE_CADA_MS) {
    contador.n = 0;
    contador.t = ahora;
    await trimCache(TILES_CACHE, TILES_MAX_ENTRIES);
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
