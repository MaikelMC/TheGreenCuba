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
 *    que venga marcado como `private` o `no-store`, con dos excepciones
 *    documentadas: el catálogo de servicios y las fichas de negocio, que Next
 *    marca dinámicas pero son idénticas para todo el mundo. Las dos exigen
 *    `200` y la ausencia de `Set-Cookie`.
 *  - Las peticiones RSC del App Router: si la red falla, se devuelve text/plain
 *    vacío para que Next haga MPA navigation y el SW intercepte la navegación.
 *  - `skipWaiting()` solo cuando la página lo pide (botón «Actualizar»). Si se
 *    fuerza, una pestaña vieja puede pedir chunks que ya no existen.
 *
 * `CACHE_VERSION` lo gestiona `public/sw-version.js`, generado en prebuild.
 */

/* sw-version.js lo escribe el prebuild y lo rastrea el navegador para detectar
   actualizaciones del SW sin modificar este archivo. Va en try-catch: si el
   VPS no regeneró el archivo o lo sirve con 404, el SW sigue instalándose. */
try { importScripts("/sw-version.js"); } catch { /* sin sw-version.js: solo la detección de updates falla */ }

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
   red → /sin-conexion/perfil. IMAGE_MAX_ENTRIES 80 → 400.

   v9: CACHE_VERSION vuelve a ser un literal fijo que el desarrollador sube
   manualmente. El problema de tenerlo como timestamp del build es que cada
   deploy borraba TODAS las cachés y el usuario necesitaba reconectar online
   para reconstruirlas: si abría la app offline justo después de un deploy,
   el caché estaba vacío y no había nada que servir. La detección de updates
   sigue funcionando: el navegador rastrea sw-version.js (que sí cambia en
   cada build) y detecta el cambio sin que CACHE_VERSION tenga que moverse.
   Cuando la lógica del SW cambie de forma que requiera invalidar las cachés
   existentes (nueva estructura de datos, cambio de estrategia), se sube a
   mano: lv-v10, lv-v11, etc. */
const CACHE_VERSION = "lv-v9";

const STATIC_CACHE = `lv-static-${CACHE_VERSION}`;
const PAGES_CACHE = `lv-pages-${CACHE_VERSION}`;
const API_CACHE = `lv-api-${CACHE_VERSION}`;
const IMAGES_CACHE = `lv-images-${CACHE_VERSION}`;
const TILES_CACHE = `lv-tiles-${CACHE_VERSION}`;
/* Tarjetas de sellos: caché propia, aparte de lv-pages. Una tarjeta es de una
   persona, pero no es una página privada al uso: se guarda para que el cliente
   la vea sin red. Solo entran respuestas 200 de una tarjeta válida. */
const TARJETAS_CACHE = `lv-tarjetas-${CACHE_VERSION}`;
/* Catálogo de servicios: caché propia. Su documento es público —la página es
   la misma para todos—, pero Next lo marca dinámico al leer la sesión para
   decidir a dónde lleva cada CTA, así que `sePuedeCachear` lo descartaría. Es
   el material que los aliados abren sin red, y por eso tiene su regla. */
const CATALOGO_CACHE = `lv-catalogo-${CACHE_VERSION}`;

const CURRENT_CACHES = new Set([
  STATIC_CACHE,
  PAGES_CACHE,
  API_CACHE,
  IMAGES_CACHE,
  TILES_CACHE,
  TARJETAS_CACHE,
  CATALOGO_CACHE,
]);

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

/* Estilo por defecto de la app (`LIBERTY_STYLE_URL` en `map-config.ts`). Si
   algún día se sirve desde el VPS, se cambia también aquí. */
const ESTILO_MAPA_URL = "https://tiles.openfreemap.org/styles/liberty";

/* Fichas guardadas para abrirlas sin red. Se recortan por separado del resto
   de `lv-pages` —que solo tiene /home y el aviso offline— para que la app no
   retenga un número ilimitado de documentos de negocio. */
const FICHAS_MAX_ENTRIES = 120;
/* Cuántas fichas se dejan listas al recibir el catálogo. Cuatro es suficiente
   para la primera pantalla sin convertir cada carga del mapa en una tanda de
   renders de ficha. */
const FICHAS_PRECARGA = 4;

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
/* Arranque con copia guardada: se le concede a la red este margen corto antes
   de pintar la copia. Con conexión buena la red gana y la copia se refresca;
   con conexión lenta o sin ella se pinta la app guardada en cuanto expira, y la
   petición de red sigue viva para dejar la caché al día. */
const NAV_CACHE_GRACE_MS = 1200;
/* Una tarjeta espera 4 s a la red y, si no llega, enseña la copia guardada. */
const TARJETA_TIMEOUT_MS = 4000;
const TARJETAS_MAX_ENTRIES = 5;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      /* Precaché estático: `allSettled` para que un 404 puntual no impida
         instalar el SW. */
      const staticCache = await caches.open(STATIC_CACHE);
      await Promise.allSettled(
        PRECACHE_URLS.map((url) => staticCache.add(new Request(url, { cache: "reload" }))),
      );

      /* `/home` y el catálogo de servicios se guardan en red-primero, no en
         la caché estática: después de un despliegue los assets del static ya
         no existen, y una navegación hacia chunks viejos rompe la app.

         El catálogo se guarda aquí y no solo al visitarlo porque los aliados
         lo instalan para consultarlo sin red: si la primera apertura en frío
         fuese sin conexión, no habría copia que enseñar. */
      const pagesCache = await caches.open(PAGES_CACHE).catch(() => null);
      const catalogoCache = await caches.open(CATALOGO_CACHE).catch(() => null);
      await Promise.allSettled([
        pagesCache ? precachearPagina(pagesCache, "/home") : Promise.resolve(),
        catalogoCache
          ? precachearPagina(catalogoCache, "/servicios", { dinamica: true })
          : Promise.resolve(),
      ]);

      /* El catálogo alimenta el mapa, sus filtros y la búsqueda. Se guarda ya
         en la instalación: si la primera apertura sin conexión (o con red muy
         lenta) llega antes de que `/home` termine de pedirlo, sin esto no
         habría ni un punto que pintar. */
      try {
        const apiCache = await caches.open(API_CACHE);
        await Promise.allSettled(
          API_PUBLICAS.map(async (ruta) => {
            /* Con tope: la instalación no puede quedarse esperando a una red
               lenta; si no llega, se cachea en la primera visita controlada. */
            const res = await conTimeout(fetch(ruta, { cache: "reload" }), NAV_TIMEOUT_MS);
            if (sePuedeCachear(res)) await guardarApi(apiCache, ruta, res.clone());
          }),
        );
      } catch {
        /* Sin red al instalar: se cachea en la primera visita controlada. */
      }

      /* El mapa no se pinta sin su estilo, y MapLibre lo pide cross-origin.
         Sin esto la app abría sin red con las teselas ya guardadas pero con el
         mapa en blanco: `tesela()` solo alcanza `/planet/` y el estilo vive en
         `/styles/`. Se guardan también el TileJSON de sus fuentes y el sprite. */
      try {
        const tilesCache = await caches.open(TILES_CACHE);
        const estilo = await fetch(ESTILO_MAPA_URL, { cache: "reload" });
        if (estilo.ok) {
          /* Se parsea antes de guardar: si el servidor devolviera HTML con
             un 200, no queremos dejar un «estilo» inválido en la caché. */
          const cuerpo = await estilo.clone().json();
          await tilesCache.put(ESTILO_MAPA_URL, estilo);
          await precachearMapa(cuerpo, tilesCache);
        }
      } catch {
        /* Sin red al instalar: se cachea en la primera visita controlada. */
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

      /* Primera visita: el SW se instala mientras la página ya está pintada,
         así que la navegación inicial no pasó por el fetch handler y el
         documento nunca entra en caché por sí solo. Tras el claim, buscamos
         todos los clientes abiertos y guardamos sus páginas ahora.
         Esto soluciona "abrí la app una vez con red, la cerré, ahora sin red
         no carga" — tanto para /home como para las tarjetas de fidelidad. */
      try {
        const pagesCache = await caches.open(PAGES_CACHE);
        const tarjetasCache = await caches.open(TARJETAS_CACHE);
        const catalogoCache = await caches.open(CATALOGO_CACHE);
        const clientList = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(
          clientList.map(async (client) => {
            let clientUrl;
            try { clientUrl = new URL(client.url); } catch { return; }
            if (clientUrl.origin !== self.location.origin) return;

            if (esTarjeta(clientUrl)) {
              const res = await fetch(client.url).catch(() => null);
              if (res && res.status === 200 && !res.headers.get("Set-Cookie")) {
                const copia = res.clone();
                await tarjetasCache.put(claveTarjeta(client.url), res).catch(() => {});
                await calentarDocumento(copia);
              }
            } else if (esCatalogo(clientUrl)) {
              const res = await fetch(client.url).catch(() => null);
              if (res && res.status === 200 && !res.headers.get("Set-Cookie")) {
                const copia = res.clone();
                await catalogoCache
                  .put(claveCatalogo(client.url), res)
                  .catch(() => {});
                await calentarDocumento(copia);
              }
            } else if (esRutaPublica(clientUrl)) {
              const res = await fetch(client.url).catch(() => null);
              if (res && documentoCacheable(res, clientUrl)) {
                const copia = res.clone();
                await pagesCache
                  .put(claveDocumento(clientUrl) ?? client.url, res)
                  .catch(() => {});
                await calentarDocumento(copia);
              }
            }
          }),
        );
      } catch {
        /* Sin red o sin clientes: se guardará en la siguiente visita con conexión. */
      }
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};

  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  /* La página compara esto con `/sw-version.js` del servidor (40 bytes) para
     saber si hubo despliegue sin descargar los 60 KB de este archivo. */
  if (data.type === "GET_VERSION") {
    if (event.ports && event.ports[0]) event.ports[0].postMessage(self.SW_VERSION || null);
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
                name.startsWith("lv-tarjetas-") ||
                name.startsWith("lv-catalogo-") ||
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
    } else if (
      url.pathname.startsWith("/styles/") ||
      url.pathname.startsWith("/sprites/") ||
      url.pathname.startsWith("/fonts/") ||
      url.pathname.startsWith("/natural_earth/")
    ) {
      event.respondWith(recursoMapa(event, request));
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
    /* Abrir una ficha con el router de Next no descarga su documento: solo el
       payload RSC. Sin calentarlo, «abrir una ficha» no dejaba nada guardado y
       sin red no había forma de verla. Se guarda una vez por ficha, por
       detrás y sin retrasar la navegación. */
    if (url.pathname.startsWith("/place/")) {
      event.waitUntil(calentarFicha(url.pathname));
    }
    event.respondWith(rscFallback(request));
    return;
  }

  if (esApiProhibida(url)) return;

  if (request.mode === "navigate") {
    /* La tarjeta de sellos tiene su propia estrategia: red primero, con 4 s de
       espera si no hay copia y solo el margen corto si ya la hay, y si falla
       la copia guardada. Va antes de la navegación normal porque su documento
       nunca entra en `lv-pages`. */
    if (esTarjeta(url)) {
      event.respondWith(navegacionTarjeta(event, request));
      return;
    }

    /* El catálogo tiene caché propia porque su documento, siendo público,
       viene marcado como dinámico por leer la sesión. */
    if (esCatalogo(url)) {
      event.respondWith(navegacionCatalogo(event, request));
      return;
    }

    event.respondWith(
      esDocumentoPrivado(request, url)
        ? navegacionPrivada(request, url)
        : navegacion(event, request, url),
    );
    return;
  }

  if (esApiPublica(url)) {
    event.respondWith(apiPublica(event, request));
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

function esTarjeta(url) {
  return /^\/m\/[^/]+\/tarjeta\/[^/]+\/?$/.test(url.pathname);
}

/** El catálogo de servicios y sus fichas. */
function esCatalogo(url) {
  return url.pathname === "/servicios" || url.pathname.startsWith("/servicios/");
}

/**
 * Clave de la caché de tarjetas: la tarjeta es el camino (negocio + token).
 *
 * La query es ruido de seguimiento del enlace de WhatsApp. Si se guardara tal
 * cual, el `start_url` limpio del manifest no encontraría la copia al abrir sin
 * red y el cliente vería `offline.html` en vez de su tarjeta.
 */
function claveTarjeta(url) {
  const clave = new URL(url);
  clave.search = "";
  clave.hash = "";
  return clave.href;
}

/** La misma clave limpia para el catálogo: no usa query propia. */
function claveCatalogo(url) {
  return claveTarjeta(url);
}

function esDocumentoPrivado(request, url) {
  /* La tarjeta de sellos es de un cliente concreto: token en la URL, teléfono
     enmascarado y un saldo que cambia con cada pedido. Nunca entra en la caché
     de páginas (tiene la suya, `lv-tarjetas-`), así que un `/m/x` cacheado no
     puede enseñar el saldo de otra persona. */
  if (/^\/m\/[^/]+\/tarjeta(\/|$)/.test(url.pathname)) return true;

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

/**
 * Guarda una ruta pública en la caché de páginas durante la instalación.
 *
 * Si no hay red, o la respuesta no se puede guardar, se calla: la ruta se
 * guardará en la primera visita con conexión, igual que cualquier otra página
 * pública.
 */
async function precachearPagina(cache, ruta, { dinamica = false } = {}) {
  try {
    const response = await fetch(ruta, { cache: "reload" });
    /* El catálogo es público aunque Next lo marque dinámico; el resto pasa por
       la regla normal. En los dos casos, una respuesta con cookie no se guarda. */
    const guardable = dinamica
      ? response.status === 200 && !response.headers.get("Set-Cookie")
      : sePuedeCachear(response);
    if (!guardable) return;
    /* El clon se toma antes de `put`, que consume el cuerpo. */
    const copia = response.clone();
    await cache.put(ruta, response);
    await calentarDocumento(copia);
  } catch {
    /* Sin red al instalar: queda para la próxima visita. */
  }
}

/**
 * Guarda en caché los estáticos que el documento ya referencia.
 *
 * En la primera visita el service worker se instala cuando el HTML ya se
 * pintó, así que la hoja de estilos, los chunks y el logo del negocio nunca
 * pasaron por el `fetch` handler. Sin esto, cerrar la app y abrirla sin red
 * enseña el documento guardado sin estilos —y en la tarjeta de sellos, sin el
 * logo—. Al activar se relee el documento del cliente y se calientan sus
 * recursos, que es lo que hace que el arranque en frío se vea como la app.
 *
 * `/_next/static/` es inmutable y va a STATIC_CACHE; `/_next/image` (el logo
 * del negocio) va a IMAGES_CACHE, que es donde lo busca `imagen()`. El HTML
 * escapa los `&` de las URL como `&amp;`, de ahí el reemplazo.
 */
async function calentarDocumento(response) {
  let html;
  try {
    html = await response.clone().text();
  } catch {
    return;
  }

  const encontradas = html.match(/\/_next\/(?:static\/[^"'\s,)]+|image\?[^"'\s,)]+)/g) || [];
  const urls = [...new Set(encontradas.map((url) => url.replace(/&amp;/g, "&")))].slice(0, 60);
  if (urls.length === 0) return;

  const estaticos = await caches.open(STATIC_CACHE);
  const imagenes = await caches.open(IMAGES_CACHE);
  await Promise.allSettled(
    urls.map(async (url) => {
      const destino = url.startsWith("/_next/image") ? imagenes : estaticos;
      /* Los `_next/static` llevan hash: si ya están, no hace falta volver a
         bajarlos. Sin esta comprobación cada ficha calentada repetía por red
         todos los chunks de la app, justo en la conexión que va lenta. */
      if (await destino.match(url)) return;
      await destino.add(new Request(url, { cache: "reload" }));
    }),
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

/**
 * ¿Se guarda este documento público?
 *
 * `sePuedeCachear` respeta `Cache-Control`, que es la regla por defecto. La
 * ficha de un negocio es la excepción: Next la marca dinámica (`no-store`)
 * porque consulta la base en cada petición, pero su HTML es el mismo para todo
 * el mundo —la sesión solo decide el estado de guardado, que se resuelve en el
 * cliente tras hidratar—. Sin esta excepción, una ficha ya abierta no quedaba
 * guardada y no se podía ver sin red. Es la misma razón por la que el catálogo
 * de servicios tiene su propia regla.
 */
function documentoCacheable(response, url) {
  if (!response || response.status !== 200) return false;
  if (response.headers.get("Set-Cookie")) return false;
  if (url.pathname.startsWith("/place/")) return true;
  return sePuedeCachear(response);
}

/**
 * Clave de caché de un documento público, o `null` si vale la propia petición.
 *
 * `/home` se abre desde el manifest sin query y desde un aviso con
 * `?desde=pagina`; una ficha se comparte por WhatsApp con parámetros de
 * seguimiento. En los dos casos la query no cambia el documento, y guardarla en
 * la clave dejaría la copia invisible al abrir la URL limpia.
 */
function claveDocumento(url) {
  if (url.pathname === "/home") return "/home";
  if (url.pathname.startsWith("/place/")) return url.pathname;
  /* La carta online instalada abre en `/m/{slug}` sin query, mientras que el
     enlace que se reparte por WhatsApp puede llevar parámetros de seguimiento.
     Guardar la copia por camino hace que el arranque sin red la encuentre. La
     tarjeta de sellos no entra aquí: tiene su propia caché (`lv-tarjetas-`). */
  if (/^\/m\/[^/]+\/?$/.test(url.pathname)) return url.pathname;
  return null;
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

/**
 * Navegación a una ruta pública.
 *
 * Con documento guardado no se espera a la red más de `NAV_CACHE_GRACE_MS`:
 * en un móvil con conexión débil la petición puede tardar decenas de segundos,
 * y esperarla era justo la pantalla blanca al abrir la PWA. Pasado el margen se
 * devuelve la copia guardada y la petición de red sigue en segundo plano para
 * actualizarla, de modo que la siguiente apertura ya trae lo último. Si la red
 * se anuncia lenta (`redLenta`) la copia se sirve de inmediato, sin margen. Con
 * red rápida gana la red y se ve siempre el documento fresco.
 */
async function navegacion(event, request, url) {
  const cache = await caches.open(PAGES_CACHE);
  const clave = claveDocumento(url) ?? request;
  /* `ignoreSearch` conserva las copias guardadas con otra query por versiones
     anteriores del SW (p. ej. `/home?desde=pagina`). */
  const guardada = await cache.match(clave, { ignoreSearch: true });

  const red = fetch(request);

  if (guardada) {
    /* Red caída o declarada lenta: ni siquiera se espera el margen. La app
       guardada se pinta en el acto y el refresco va por detrás. */
    if (sinRedOLenta()) {
      event.waitUntil(actualizarDocumento(red, cache, clave, url));
      return guardada;
    }

    try {
      const response = await conTimeout(red, NAV_CACHE_GRACE_MS);
      if (documentoCacheable(response, url) && esRutaPublica(url)) {
        event.waitUntil(actualizarDocumento(Promise.resolve(response), cache, clave, url));
      }
      return response || guardada;
    } catch {
      /* La red no contestó a tiempo, pero `conTimeout` no la cancela. Se pinta
         la copia ya y se aprovecha esa misma petición para refrescarla. */
      event.waitUntil(actualizarDocumento(red, cache, clave, url));
      return guardada;
    }
  }

  /* Sin copia guardada no hay nada que pintar mientras la red contesta. */
  let response = null;
  try {
    response = await conTimeout(red, NAV_TIMEOUT_MS);
  } catch {
    if (self.navigator?.onLine !== false) {
      response = await red.catch(() => null);
    }
  }

  if (response) {
    if (documentoCacheable(response, url) && esRutaPublica(url)) {
      cache
        .put(clave, response.clone())
        .then(() => recortarFichas(cache))
        .catch(() => {});
    }
    return response;
  }

  /* Sin red y sin respuesta: puede que la copia se guardara con otra query. */
  const cached = await cache.match(clave, { ignoreSearch: true });
  if (cached) return cached;

  /* Sin caché y sin red. Si es una ruta distinta a /home y /home está en
     caché, redirigir con el aviso offline. Si /home tampoco está o ya
     estamos en /home, ir directo a offline.html para no caer en un bucle
     de redirecciones infinitas. */
  if (url.pathname !== "/home") {
    const homeEnCache = await cache.match("/home", { ignoreSearch: true });
    if (homeEnCache) return Response.redirect("/home?desde=pagina", 302);
  }
  const offline = await caches.match("/offline.html");
  if (offline) return offline;
  return respuestaSinConexion();
}

/**
 * ¿Hay que pintar la copia sin esperar a la red? Cuando el navegador ya sabe
 * que no hay conexión, `onLine` lo dice; cuando la hay pero es lenta, lo dice
 * `navigator.connection`.
 */
function sinRedOLenta() {
  return self.navigator?.onLine === false || redLenta();
}

/**
 * ¿La conexión se anuncia lenta? Chromium expone `navigator.connection`; en
 * Safari/iOS no existe y se responde `false` — allí manda el margen corto.
 */
function redLenta() {
  const conexion = self.navigator && self.navigator.connection;
  if (!conexion) return false;
  if (conexion.saveData) return true;
  return (
    conexion.effectiveType === "slow-2g" ||
    conexion.effectiveType === "2g" ||
    conexion.effectiveType === "3g"
  );
}

/**
 * Guarda la respuesta de red que llegó tarde y calienta sus estáticos, para que
 * la siguiente apertura ya arranque con el documento fresco. No se espera desde
 * la navegación: la página ya se está pintando con la copia guardada.
 */
async function actualizarDocumento(red, cache, clave, url) {
  try {
    const response = await red;
    if (!documentoCacheable(response, url) || !esRutaPublica(url)) return;
    const copia = response.clone();
    await cache.put(clave, response.clone()).catch(() => {});
    await recortarFichas(cache);
    await calentarDocumento(copia);
  } catch {
    /* Sin red: la copia guardada sigue siendo la válida. */
  }
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

/**
 * La tarjeta de sellos del cliente.
 *
 * Red primero, pero acotada si ya hay copia: se espera `NAV_CACHE_GRACE_MS`
 * (nada si la conexión se anuncia lenta o caída) y, si la red no llega, se
 * pinta la copia guardada —el cliente la ve con el aviso de que puede estar
 * desactualizada, que pinta la propia página— mientras la red la refresca por
 * detrás. Sin copia se espera `TARJETA_TIMEOUT_MS`; si tampoco hay respuesta,
 * `offline.html`.
 *
 * Un 404/410 significa que la tarjeta ya no existe (cliente borrado, negocio
 * sin la tarjeta): se borra la copia para que no se siga enseñando un saldo
 * que ya no vale.
 *
 * Solo se guardan respuestas 200. No se usa `sePuedeCachear` porque el App
 * Router marca estas páginas con `no-store` —son dinámicas a propósito— y aquí
 * la copia es justo lo que se quiere.
 */
async function navegacionTarjeta(event, request) {
  const cache = await caches.open(TARJETAS_CACHE);
  const clave = claveTarjeta(request.url);
  const guardada = await cache.match(clave);
  const red = fetch(request);

  /* Con copia guardada manda la velocidad: en un móvil lento esperar la red es
     quedarse en blanco. La tarjeta se pinta con el aviso de desactualizada —lo
     pone la propia página— y la red refresca por detrás. Sin copia se mantiene
     la espera de siempre, porque no hay nada que enseñar. */
  if (guardada) {
    if (sinRedOLenta()) {
      event.waitUntil(refrescarTarjeta(red, cache, clave));
      return guardada;
    }

    try {
      const response = await conTimeout(red, NAV_CACHE_GRACE_MS);
      if (response) {
        if (response.status === 404 || response.status === 410) {
          await cache.delete(clave).catch(() => {});
        } else if (response.status === 200 && !response.headers.get("Set-Cookie")) {
          event.waitUntil(
            cache
              .put(clave, response.clone())
              .then(() => trimCache(TARJETAS_CACHE, TARJETAS_MAX_ENTRIES))
              .catch(() => {}),
          );
        }
        return response;
      }
    } catch {
      event.waitUntil(refrescarTarjeta(red, cache, clave));
    }
    return guardada;
  }

  let response = null;
  try {
    response = await conTimeout(red, TARJETA_TIMEOUT_MS);
  } catch {
    response = null;
  }

  if (response) {
    if (response.status === 404 || response.status === 410) {
      await cache.delete(clave).catch(() => {});
      return response;
    }

    if (response.status === 200 && !response.headers.get("Set-Cookie")) {
      event.waitUntil(
        cache
          .put(clave, response.clone())
          .then(() => trimCache(TARJETAS_CACHE, TARJETAS_MAX_ENTRIES))
          .catch(() => {}),
      );
    }
    return response;
  }

  const copia = await cache.match(clave);
  if (copia) return copia;

  const offline = await caches.match("/offline.html");
  if (offline) return offline;

  return respuestaSinConexion();
}

/**
 * Refresco en segundo plano de una tarjeta guardada. Un 404/410 sigue mandando:
 * la tarjeta ya no existe y la copia se borra para no enseñar un saldo viejo.
 */
async function refrescarTarjeta(red, cache, clave) {
  try {
    const response = await red;
    if (!response) return;

    if (response.status === 404 || response.status === 410) {
      await cache.delete(clave).catch(() => {});
      return;
    }

    if (response.status !== 200 || response.headers.get("Set-Cookie")) return;
    await cache.put(clave, response.clone()).catch(() => {});
    await trimCache(TARJETAS_CACHE, TARJETAS_MAX_ENTRIES).catch(() => {});
  } catch {
    /* Sin red: la copia guardada sigue siendo la válida. */
  }
}

/**
 * Navegación al catálogo de servicios.
 *
 * Red primero, como el resto de páginas públicas, con el mismo margen corto
 * cuando ya hay copia: en una conexión lenta se pinta el catálogo guardado al
 * instante y la red lo refresca por detrás. Aquí no se usa `sePuedeCachear`
 * porque el App Router marca la página como dinámica —lee la sesión para los
 * enlaces de contratación—, y aun así su contenido es el mismo para todo el
 * mundo: lo que este caché guarda es el catálogo, no datos de una persona.
 *
 * Si falta la ficha concreta, se sirve el catálogo general guardado en vez de
 * `offline.html`: mejor el índice de servicios que un aviso de sin conexión.
 */
async function navegacionCatalogo(event, request) {
  const cache = await caches.open(CATALOGO_CACHE);
  const clave = claveCatalogo(request.url);
  const url = new URL(request.url);
  const guardada = await cache.match(clave);
  const red = fetch(request);

  /* Con copia guardada no se espera la red más allá del margen —ni nada si la
     conexión se anuncia lenta o caída—: el catálogo se pinta al instante y la
     red refresca la copia por detrás para la siguiente visita. */
  if (guardada) {
    if (sinRedOLenta()) {
      event.waitUntil(refrescarCatalogo(red, cache, clave));
      return guardada;
    }

    try {
      const response = await conTimeout(red, NAV_CACHE_GRACE_MS);
      if (!response) return guardada;
      if (response.status === 200 && !response.headers.get("Set-Cookie")) {
        event.waitUntil(cache.put(clave, response.clone()).catch(() => {}));
      }
      return response;
    } catch {
      event.waitUntil(refrescarCatalogo(red, cache, clave));
      return guardada;
    }
  }

  /* Sin copia no hay nada que pintar: se espera la red como antes. */
  let response = null;
  try {
    response = await conTimeout(red, NAV_TIMEOUT_MS);
  } catch {
    if (self.navigator?.onLine !== false) {
      response = await red.catch(() => null);
    }
  }

  if (response) {
    if (response.status === 200 && !response.headers.get("Set-Cookie")) {
      event.waitUntil(cache.put(clave, response.clone()).catch(() => {}));
    }
    return response;
  }

  if (url.pathname !== "/servicios") {
    const indice = await cache.match("/servicios");
    if (indice) return indice;
  }

  const offline = await caches.match("/offline.html");
  if (offline) return offline;

  return respuestaSinConexion();
}

/** Refresco en segundo plano de un catálogo guardado. */
async function refrescarCatalogo(red, cache, clave) {
  try {
    const response = await red;
    if (!response || response.status !== 200 || response.headers.get("Set-Cookie")) return;
    await cache.put(clave, response.clone()).catch(() => {});
  } catch {
    /* Sin red: la copia guardada sigue siendo la válida. */
  }
}

function respuestaSinConexion() {
  return new Response(
    "<!doctype html><html lang=\"es\"><meta charset=\"utf-8\"><title>Sin conexión</title><p>Sin conexión.</p></html>",
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

/**
 * Catálogo público (`/api/places`, `/api/categories`).
 *
 * Es lo que pinta los puntos del mapa, sus filtros y la búsqueda, así que
 * también entra en el arranque: con copia guardada la red tiene solo
 * `NAV_CACHE_GRACE_MS` —nada si la conexión se anuncia lenta o caída— y la
 * copia refresca por detrás en la misma petición. Sin copia se mantiene la
 * espera de antes (4 s). Las copias caducan a los 7 días.
 */
async function apiPublica(event, request) {
  const cache = await caches.open(API_CACHE);
  const guardada = await cache.match(request);
  const red = fetch(request);

  if (guardada && apiVigente(guardada)) {
    if (sinRedOLenta()) {
      event.waitUntil(actualizarApi(red, cache, request));
      return guardada;
    }

    try {
      const response = await conTimeout(red, NAV_CACHE_GRACE_MS);
      if (sePuedeCachear(response)) {
        event.waitUntil(guardarApi(cache, request, response.clone()));
        programarPrecargaFichas(event, request, response);
      }
      return response;
    } catch {
      event.waitUntil(actualizarApi(red, cache, request));
      return guardada;
    }
  }

  try {
    const response = await conTimeout(red, NAV_TIMEOUT_MS);
    if (sePuedeCachear(response)) {
      event.waitUntil(guardarApi(cache, request, response.clone()));
      programarPrecargaFichas(event, request, response);
    }
    return response;
  } catch (error) {
    /* La red no contestó en 4 s, pero puede contestar después: esa misma
       petición deja la copia lista para la próxima apertura. */
    event.waitUntil(actualizarApi(red, cache, request));

    const cached = guardada ?? (await cache.match(request));
    if (!cached || !apiVigente(cached)) throw error;
    return cached;
  }
}

/**
 * Deja listas las primeras fichas del catálogo, para que se puedan abrir sin
 * red sin haberlas abierto antes. Se lanza solo cuando el catálogo llegó por
 * red y la conexión no se anuncia lenta: en ese caso la precarga competiría
 * con lo que el usuario está intentando ver.
 *
 * `all=true` es el panel de administración y no entra: esas fichas no son las
 * que un visitante va a abrir.
 */
function programarPrecargaFichas(event, request, response) {
  let url;
  try {
    url = typeof request === "string" ? new URL(request, self.location.origin) : new URL(request.url);
  } catch {
    return;
  }
  if (url.pathname !== "/api/places" || url.searchParams.get("all") === "true") return;
  if (self.navigator?.onLine === false || sinRedOLenta()) return;

  event.waitUntil(prefetcharFichas(response.clone()));
}

/** Precarga en segundo plano las primeras fichas del catálogo recibido. */
async function prefetcharFichas(response) {
  try {
    const lugares = await response.json();
    if (!Array.isArray(lugares)) return;

    const rutas = lugares
      .filter(
        (lugar) =>
          lugar &&
          typeof lugar.id === "string" &&
          lugar.isActive !== false &&
          !lugar.isProject,
      )
      .slice(0, FICHAS_PRECARGA)
      .map((lugar) => `/place/${encodeURIComponent(lugar.id)}`);

    await Promise.allSettled(rutas.map((ruta) => calentarFicha(ruta)));
  } catch {
    /* Catálogo ilegible o almacenamiento lleno: no es crítico. */
  }
}

/**
 * Guarda el documento de una ficha que se abrió con navegación de cliente.
 *
 * Se pide una sola vez —si ya hay copia no se repite— con `Accept: text/html`
 * para que el servidor devuelva el documento entero y no el payload RSC. El
 * coste es una petición por ficha y dispositivo; a cambio, cada ficha abierta
 * queda disponible sin red. Con ahorro de datos no se hace: quien lo activó no
 * quiere descargas que no pidió.
 */
async function calentarFicha(ruta) {
  try {
    if (self.navigator?.connection?.saveData) return;
    const cache = await caches.open(PAGES_CACHE);
    if (await cache.match(ruta)) return;

    const response = await fetch(ruta, { headers: { Accept: "text/html" } });
    if (!documentoCacheable(response, new URL(ruta, self.location.origin))) return;
    const copia = response.clone();
    await cache.put(ruta, response);
    await recortarFichas(cache);
    await calentarDocumento(copia);
  } catch {
    /* Sin red o sin almacenamiento: se guardará al abrirla como documento. */
  }
}

/**
 * Recorta las fichas guardadas a `FICHAS_MAX_ENTRIES`, de la más antigua a la
 * más nueva. Se hace por bloques: no cuesta nada en cada apertura normal y
 * evita que Cache Storage crezca sin freno en un teléfono que abre muchas.
 */
async function recortarFichas(cache) {
  try {
    const keys = await cache.keys();
    const fichas = keys.filter((k) => new URL(k.url).pathname.startsWith("/place/"));
    const sobran = fichas.length - FICHAS_MAX_ENTRIES;
    if (sobran < 10) return;
    for (let i = 0; i < sobran; i += 1) await cache.delete(fichas[i]);
  } catch {
    /* Sin acceso a las claves: se reintenta en el siguiente guardado. */
  }
}

/** `true` si la copia del catálogo no ha pasado su caducidad. */
function apiVigente(cached) {
  const cachedAt = cached.headers.get("X-LV-Cached-At");
  return !cachedAt || Date.now() - Date.parse(cachedAt) <= API_MAX_AGE_MS;
}

/**
 * Guarda una respuesta del catálogo con su fecha. Al reconstruirla el cuerpo ya
 * viene descomprimido: dejar `Content-Encoding` haría que el navegador
 * intentara descomprimir otra vez y fallara al leerla.
 */
async function guardarApi(cache, request, responseClone) {
  try {
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
  } catch {
    /* Sin almacenamiento o cuerpo ilegible: la respuesta ya se sirvió. */
  }
}

/** Refresco en segundo plano del catálogo guardado. */
async function actualizarApi(red, cache, request) {
  try {
    const response = await red;
    if (!response || !sePuedeCachear(response)) return;
    await guardarApi(cache, request, response.clone());
  } catch {
    /* Sin red: la copia guardada sigue siendo la válida. */
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
 * TileJSON de OpenFreeMap (`/planet`).
 *
 * Se guarda en TILES_CACHE; sin red se sirve la copia guardada. El TileJSON
 * pesa unos pocos KB —no recorta— y es necesario antes de que MapLibre pueda
 * pedir cualquier tesela: con red lenta, esperarlo sin límite era el mapa en
 * blanco al abrir la app (el `load` del mapa no llega hasta resolverlo). Por
 * eso, si ya hay copia, la red tiene solo `NAV_CACHE_GRACE_MS` —o nada si la
 * conexión se anuncia lenta o caída— y el refresco va por detrás.
 */
async function tilejson(event, request) {
  const cache = await caches.open(TILES_CACHE);
  const guardada = await cache.match(request);
  const red = fetch(request);

  if (guardada) {
    if (sinRedOLenta()) {
      event.waitUntil(actualizarTilejson(red, cache, request));
      return guardada;
    }

    try {
      const response = await conTimeout(red, NAV_CACHE_GRACE_MS);
      if (response && response.ok) {
        event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
      }
      return response || guardada;
    } catch {
      event.waitUntil(actualizarTilejson(red, cache, request));
      return guardada;
    }
  }

  try {
    const response = await red;
    if (response.ok && (response.type === "cors" || response.type === "basic")) {
      event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
    }
    return response;
  } catch {
    return new Response(null, { status: 204 });
  }
}

/** Refresco en segundo plano del TileJSON guardado. */
async function actualizarTilejson(red, cache, request) {
  try {
    const response = await red;
    if (response && response.ok) await cache.put(request, response.clone()).catch(() => {});
  } catch {
    /* Sin red: la copia guardada sigue siendo la válida. */
  }
}

/**
 * Cache-first para el resto del paquete del mapa: el estilo, el sprite, las
 * fuentes de texto y el raster de base. Son inmutables dentro de una versión
 * del estilo, así que no tienen sentido en red-first.
 *
 * Sin red y sin copia se devuelve 504 en vez de dejar que la promesa rechace:
 * MapLibre trata el recurso como fallido y no intenta parsear un cuerpo vacío.
 */
async function recursoMapa(event, request) {
  const cache = await caches.open(TILES_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const copia = response.clone();
      event.waitUntil(cache.put(request, copia).catch(() => {}));
    }
    return response;
  } catch {
    return new Response(null, { status: 504 });
  }
}

/**
 * Guarda lo que MapLibre necesita antes de pedir teselas: el TileJSON de cada
 * fuente con `url` y el sprite en sus cuatro variantes (json/png, 1x y 2x).
 * Las pilas de fuentes de texto se cachean al usarse, con `recursoMapa`.
 */
async function precachearMapa(estilo, cache) {
  const urls = [];

  for (const fuente of Object.values((estilo && estilo.sources) || {})) {
    if (fuente && typeof fuente.url === "string") urls.push(fuente.url);
  }

  if (estilo && typeof estilo.sprite === "string") {
    const sprite = estilo.sprite;
    if (/\.(json|png)$/.test(sprite)) {
      urls.push(sprite);
    } else {
      urls.push(`${sprite}.json`, `${sprite}.png`, `${sprite}@2x.json`, `${sprite}@2x.png`);
    }
  }

  await Promise.allSettled(
    urls.map((url) => cache.add(new Request(url, { cache: "reload" }))),
  );
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
