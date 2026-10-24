# Auditoría PWA — La Verde

Fecha: 24 de octubre de 2026  
Alcance: instalación en Android e iPhone, futuro TWA/APK, push web, rendimiento en gama baja y modo offline para dueños de negocio.  
Estado: **auditoría solamente. No se modificó código.**

---

## 1. Conclusión ejecutiva

La Verde **hoy es una web instalable, no una PWA offline**.

Lo que ya funciona:

- Manifiesto servido en producción: `GET https://laverde.kynari.dev/manifest.webmanifest` responde `200`, `application/manifest+json`, 589 bytes.
- Manifest con `name`, `short_name`, `id`, `start_url`, `scope`, `display: standalone`, `lang: es`, `orientation: portrait`, colores, iconos 192, 512 y 512 maskable (`src/app/manifest.ts:20-59`).
- Metadatos iOS: `appleWebApp.capable`, título e icono (`src/app/layout.tsx:94-103`).
- HTTPS, HSTS con `preload`, CSP y cabeceras de seguridad en producción (`next.config.ts:44-81`).
- Autenticación same-origin mediante `/api/auth/*`, sin llamadas del navegador a Neon (`src/lib/auth/client.ts:9`, `src/app/api/auth/[...path]/route.ts:25`).

Lo que falta para los objetivos:

- **No hay service worker.** `GET /sw.js` y `/service-worker.js` responden `404`. No hay precaché, ni página offline, ni estrategia de caché.
- **No hay push.** No existe tabla de suscripciones, ni endpoints de suscripción, ni claves VAPID, ni listener `push` en un service worker.
- **No hay TWA preparado.** `GET /.well-known/assetlinks.json` responde `404`. Sin Digital Asset Links, Android no verifica la app y el TWA muestra barra de navegador o falla la apertura.
- **El panel de negocio no se puede abrir sin red.** `/business` es dinámico y resuelve todo en el servidor (`src/app/(main)/business/layout.tsx:13`, `src/app/(main)/business/page.tsx:44-130`). Sin red no hay HTML, ni datos, ni métricas.
- **El catálogo público no se guarda en el teléfono.** `usePlaces()` pide `/api/places` y `/api/categories` al montar (`src/providers/places-provider.tsx:148-176`) y no persiste nada.
- **La sesión no se puede validar offline.** El proxy y los layouts consultan Neon; un fallo de red se trata como “sin sesión” (`src/proxy.ts:149-151`). Sin una capa local, el usuario offline acaba en login o en una pantalla de error.

Conclusión: para cumplir (a), (b), (c), (d) y (e) hace falta una fase de PWA real: service worker, caché pública, snapshot privado por usuario, push y Digital Asset Links. El orden y el esfuerzo están al final.

---

## 2. Hallazgos P0 — bloquean objetivos

### P0-1. No existe service worker ni modo offline

**Dónde:** `public/` no contiene `sw.js`; `src/app/manifest.ts` es el único artefacto PWA. Comprobación de producción: `https://laverde.kynari.dev/sw.js` → `404`, `https://laverde.kynari.dev/service-worker.js` → `404`.

**Riesgo:** sin service worker no hay precaché del app shell, ni página offline, ni caché de catálogo, ni push. Cualquier recarga sin red muestra el error del navegador. El objetivo (e) es imposible.

**Arreglo mínimo:**

1. Añadir `public/sw.js` con versión de caché, precaché de `offline.html`, iconos y fuentes.
2. Registrar el SW desde un componente cliente global, solo en producción o tras `load`.
3. Crear `public/offline.html` con enlaces a `/home` y al último negocio guardado.
4. En `fetch`, no interceptar peticiones RSC (`?_rsc=`, cabecera `RSC`, `Next-Router-Prefetch`, `Next-Router-State-Tree`).
5. Cachear solo `GET` same-origin con respuesta `200`, y nunca respuestas `private`/`no-store` ni `/api/auth/**`.

**Esfuerzo:** M (1–2 días).

---

### P0-2. El panel de negocio y las métricas no existen offline

**Dónde:** `src/app/(main)/business/layout.tsx:13` fuerza `dynamic`; `src/app/(main)/business/page.tsx:44-130` hace `getAppUser()`, `ownerPlaces()`, `getPlaceById()`, `placeStats()`, `statsVisitas()` y más consultas antes de renderizar. El cliente solo recibe props ya resueltas (`business/page.tsx:179-204`).

**Riesgo:** el dueño no puede consultar su ficha, métricas, catálogo ni plan sin red. Es exactamente el caso (e). Un service worker genérico no basta: el HTML está personalizado y no debe guardarse en una caché compartida.

**Arreglo mínimo:**

- Guardar un **snapshot saneado** de los props del panel en IndexedDB después de una carga correcta, desde `BusinessPanel`.
- Añadir una ruta cliente precacheada, por ejemplo `/offline/panel`, que lea ese snapshot y lo muestre en modo lectura con el aviso “sin conexión” y la fecha de actualización.
- No cachear el documento `/business` en Cache Storage compartida. El snapshot va namespaced por `user.id` y se borra al cerrar sesión.
- Datos a guardar: `place` (ficha), `stats`, `visitas`, `publicaciones`, `plan`, `funciones`, `modulos`, `negocios`, `permisos`. Peso estimado: 20–80 KB por negocio.
- Imágenes de logo y fotos: Cache Storage aparte, con límite de tamaño y expiración.

**Esfuerzo:** L (3–5 días).

---

### P0-3. No hay infraestructura de notificaciones push

**Dónde:** no hay tabla de suscripciones. La tabla existente es solo in-app: `src/lib/db/schema/notifications.ts:5-25`. La API solo lista y marca leídas: `src/app/api/notifications/route.ts:7-39`. El envío masivo actual inserta filas in-app, no push: `src/app/api/admin/broadcast/route.ts:42-127`. No hay VAPID ni listener `push`.

**Riesgo:** el objetivo (c) no se puede cumplir. Aunque se añada un service worker, sin suscripción, almacenamiento y envío no hay notificaciones.

**Arreglo mínimo:**

1. Tabla `push_subscriptions`: `id`, `userId`, `endpoint` único, `p256dh`, `auth`, `userAgent`, `createdAt`, `lastSuccessAt`, `failureCount`.
2. Endpoints autenticados `POST /api/push/subscribe` y `DELETE /api/push/unsubscribe`, con límite por usuario.
3. En el service worker: eventos `push`, `notificationclick` y `pushsubscriptionchange`.
4. Envío servidor con `web-push` (nueva dependencia, solo servidor) y variables `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
5. Limpieza: borrar suscripción ante `404`/`410`; incrementar `failureCount` ante `429`/`5xx`.
6. Integrar el envío en el broadcast existente, manteniendo el límite de 3/min (`admin/broadcast/route.ts:37-40,61-67`).

**Esfuerzo:** L (3–5 días), incluida prueba en Android e iPhone.

---

### P0-4. Sin Digital Asset Links no hay TWA verificable

**Dónde:** `https://laverde.kynari.dev/.well-known/assetlinks.json` → `404`. No existe `public/.well-known/assetlinks.json` ni una ruta equivalente.

**Riesgo:** al envolver la web en un TWA, Android no puede verificar que el dominio y la app pertenecen al mismo dueño. El TWA abre con barra de URL o directamente falla la verificación. Los enlaces profundos (`/m/[slug]`, `/place/[id]`) no vuelven a la app.

**Arreglo mínimo:**

- Publicar `/.well-known/assetlinks.json` con el `package_name` definitivo y el SHA-256 del certificado de firma.
- Declarar intent filters en el proyecto Android para `/m/`, `/place/` y `/business`.
- Verificar que la ruta no pase por autenticación ni por redirección. El matcher del proxy ya excluye rutas con extensión (`src/proxy.ts:213-215`), pero hay que comprobar el `Content-Type: application/json` en producción.

**Esfuerzo:** S–M (0,5–1 día, más el tiempo de firma del APK).

---

### P0-5. La sesión y las rutas privadas no sobreviven sin red

**Dónde:** el proxy resuelve la sesión contra Neon (`src/proxy.ts:149-151`); los layouts privados vuelven a consultar (`src/app/(main)/business/layout.tsx:33-41`). `fetchMe()` solo cachea en memoria y no persiste (`src/lib/session-client.ts:21-70`). La cookie de datos de sesión dura 7 días (`src/lib/auth/server.ts:39-45`), pero es `HttpOnly` y no se puede leer desde JavaScript.

**Riesgo:** una recarga offline de `/profile` o `/business` acaba en login, redirección o error. El snapshot privado no debe depender de una validación de red que offline es imposible.

**Arreglo mínimo:**

- El modo offline privado se sirve desde IndexedDB, no desde el servidor.
- Guardar `lastAuthAt` junto al snapshot. Si han pasado más de 7 días sin validar, bloquear el snapshot y pedir login al recuperar red.
- Al recibir `401` o una redirección a `/login`, purgar el snapshot y las cachés privadas.
- No intentar “simular” sesión offline en el servidor. El servidor sigue siendo la autoridad cuando hay red.

**Esfuerzo:** M (incluido en P0-2, más 0,5 día de guardas de sesión).

---

## 3. Hallazgos P1 — importantes

### P1-1. No hay aviso de instalación ni instrucciones para iPhone

**Dónde:** no hay `beforeinstallprompt` en `src/`. No hay botón “Instalar app” ni pantalla de instrucciones iOS.

**Riesgo:** Android no ofrece la instalación en el momento oportuno; iPhone nunca muestra un aviso automático porque Safari no implementa `beforeinstallprompt`. El usuario no descubre “Compartir → Añadir a pantalla de inicio”.

**Arreglo mínimo:**

- Componente cliente que capture `beforeinstallprompt`, lo guarde y muestre un botón solo si no está en modo standalone.
- En iOS, detectar `navigator.standalone === false` y mostrar instrucciones con iconos: Compartir → Añadir a pantalla de inicio.
- Ocultar el aviso si `display-mode: standalone` ya está activo.

**Esfuerzo:** S (0,5 día).

---

### P1-2. `start_url` abre la portada de marketing, no la app

**Dónde:** `src/app/manifest.ts:25-26` declara `id: "/"` y `start_url: "/"`. La portada es la landing; la app vive en `/home`.

**Riesgo:** al abrir el icono instalado, el usuario ve la landing y tiene que navegar. Para un dueño de negocio, la app debería abrir su zona o el catálogo. Además, `id: "/"` fija la identidad de la instalación; cambiarlo después crea otra app instalada.

**Arreglo mínimo:**

- Decidir ahora: `start_url: "/home"` para todos, o una ruta `/abrir` que redirija por rol (`/business` si es dueño, `/home` si no).
- Mantener `id` estable y documentarlo. Si se cambia, hacerlo antes de tener usuarios instalados.

**Esfuerzo:** S (0,5 día, incluida la ruta de arranque).

---

### P1-3. Faltan campos de manifest para una instalación completa

**Dónde:** `src/app/manifest.ts:20-59`. No hay `shortcuts`, `screenshots`, `display_override`, `launch_handler`, `handle_links` ni `prefer_related_applications`. Solo hay un icono maskable de 512; no hay 192 maskable ni `purpose: "any"` explícito.

**Riesgo:** Android puede instalar, pero la experiencia es pobre: sin accesos directos, sin capturas en el diálogo de instalación y sin control de ventana. Los shortcuts son especialmente útiles para “Mi negocio”, “Mi menú” y “Buscar”.

**Arreglo mínimo:**

- Añadir `shortcuts` a `/business`, `/m/[slug]` (si hay slug guardado) y `/home?tab=mapa`.
- Añadir `screenshots` reales de móvil (por ejemplo 1080×1920) y una de escritorio.
- Añadir `display_override: ["window-controls-overlay", "standalone"]` solo si se quiere; para móvil no es necesario.
- Añadir `launch_handler: { client_mode: "navigate-existing" }`.
- Añadir un maskable de 192 si se quiere cubrir todos los tamaños.

**Esfuerzo:** S–M (0,5–1 día, incluidas capturas).

---

### P1-4. Los iconos pesan demasiado para datos móviles

**Dónde:** `public/icons/icon-192.png` = 56.495 B; `public/icons/icon-512.png` = 274.551 B; `public/icons/icon-512-maskable.png` = 152.226 B; `src/app/apple-icon.png` = 50.173 B. En producción los iconos y el manifest se sirven con `Cache-Control: public, max-age=0, must-revalidate`; los chunks estáticos sí llevan `max-age=31536000, immutable`.

**Riesgo:** la primera instalación y cada revalidación descargan cientos de KB innecesarios. En una red cubana lenta esto se nota.

**Arreglo mínimo:**

- Recomprimir los PNG con paleta/optimización; objetivo: 192 < 20 KB, 512 < 80 KB, maskable < 60 KB.
- Servir `/icons/*` y `/manifest.webmanifest` con `Cache-Control: public, max-age=604800` o versionar los nombres.
- Mantener `apple-icon.png` por debajo de 30 KB.

**Esfuerzo:** S (0,5 día).

---

### P1-5. JS inicial demasiado pesado y cargado en todas las rutas

**Dónde:**

- `src/lib/analytics.ts:27` importa `posthog-js` de forma estática; `PostHogAnalytics` se monta en el layout raíz (`src/app/layout.tsx:136`).
- `src/providers/auth-provider.tsx:3-7,18-35` importa `@neondatabase/auth-ui` y su CSS de forma estática y envuelve todo el árbol.
- `src/app/(main)/home/page.tsx:1` es un componente cliente completo; el fallback de `Suspense` es un div vacío (`home/page.tsx:1867-1873`).
- `src/components/map/MapView.tsx:8-21` carga Leaflet con `next/dynamic` (bien), pero el chunk de Leaflet es grande.
- `src/components/map/MapMarkers.tsx:82-106` pinta un marcador por cada lugar; el catálogo por defecto trae hasta 200 (`src/app/api/places/route.ts:77`).

**Medición local del build (raw, indicativa, no transferencia):** posthog 300.516 B; `@neondatabase/auth-ui` 305.403 B; Leaflet 357.710 B; chunks de `motion` 139.613/133.670 B. El HTML local de `/home` referencia ~2,12 MB de JS raw; la landing ~1,83 MB. Los chunks de producción son inmutables, pero el peso inicial sigue siendo alto para gama baja.

**Riesgo:** LCP tardío, CPU y memoria altas, batería y datos. En un teléfono de gama baja con 3G, la portada puede tardar varios segundos en ser interactiva.

**Arreglo mínimo:**

- Cargar PostHog con `import()` tras `load` o tras interacción, y solo si hay clave.
- Sacar `NeonAuthUIProvider` del árbol público; montarlo solo en `/login`, `/register` y rutas que lo necesiten. Si se mantiene global, cargarlo con `dynamic` y sin CSS en rutas públicas.
- Renderizar en servidor el armazón de `/home` (título, filtros, lista inicial) y dejar el mapa como isla cliente.
- Reducir el límite inicial de lugares o agrupar marcadores antes de pintar.
- Mantener `next/dynamic` para Leaflet y cargarlo solo al abrir la pestaña de mapa.

**Esfuerzo:** M–L (2–4 días).

---

### P1-6. El catálogo público se cachea solo en el CDN, no en el navegador

**Dónde:** `src/app/api/places/route.ts:141-145` envía `public, s-maxage=300, stale-while-revalidate=600`; `src/app/api/categories/route.ts:22-30` hace lo mismo. `s-maxage` es para CDN; el navegador no tiene garantía de reutilizarlo. `usePlaces()` no persiste (`places-provider.tsx:148-176`).

**Riesgo:** cada apertura del catálogo depende de red. Sin conexión no hay datos, y con señal mala se repite la descarga.

**Arreglo mínimo:**

- Añadir `max-age=60` a las respuestas públicas (`public, max-age=60, s-maxage=300, stale-while-revalidate=600`).
- Cachear `/api/places` y `/api/categories` en el service worker con stale-while-revalidate y metadatos de fecha.
- Guardar el catálogo en IndexedDB o Cache Storage con un wrapper `{ data, cachedAt }`.
- Respetar `private, no-store` para `?all=true` y para respuestas autenticadas.

**Esfuerzo:** M (2–3 días, junto con P0-1).

---

### P1-7. Fallos de escritura silenciosos o con mensaje técnico

**Dónde:**

- Perfil: el `catch` conserva la copia local y no avisa (`src/app/(main)/profile/page.tsx:219-221`). El usuario cree que guardó.
- Notificaciones: `markAllRead()` ignora la respuesta (`src/components/profile/notifications-view.tsx:38-46`); `handleOpen()` hace `.catch(() => {})` (`notifications-view.tsx:55-62`).
- Disponibilidad: sí muestra error (`src/components/business/catalogo-view.tsx:451-504`, `src/components/business/menu-item-editor.tsx:207-244`), pero el texto de un `fetch` fallido puede ser “Failed to fetch”, no una instrucción útil.
- Ficha de negocio: muestra un error correcto y no cambia nada (`src/components/business/business-panel.tsx:903-910`).

**Riesgo:** pérdida de datos percibida, reintentos a ciegas y desconfianza. En offline, “no se guardó” debe ser explícito.

**Arreglo mínimo:**

- Helper `mensajeDeRed(error)` que traduzca `TypeError`/`Failed to fetch` a “Sin conexión. No se guardó nada.”.
- En perfil y notificaciones, mostrar toast/aviso persistente con botón “Reintentar”.
- No aplicar cambios locales hasta confirmación del servidor en operaciones críticas.
- No implementar cola offline todavía; ver sección 5.

**Esfuerzo:** S (1 día).

---

### P1-8. El cierre de sesión no borra cachés privadas (hoy no existen)

**Dónde:** `src/lib/logout.ts:40-72` borra solo `localStorage` con prefijos y claves exactas. No toca Cache Storage ni IndexedDB.

**Riesgo:** cuando se añada el snapshot de negocio y el catálogo cacheado, el siguiente usuario del mismo teléfono podría ver datos del anterior. En un dispositivo compartido es una fuga de datos.

**Arreglo mínimo:**

- Añadir al `finally` de `logout()`: enviar mensaje `PURGE_PRIVATE` al service worker y borrar la base IndexedDB (`indexedDB.deleteDatabase(...)`) y las cachés con prefijo `lv-private-`.
- Hacerlo aunque `signOut()` falle por red. El `finally` actual ya garantiza la salida; ampliarlo.
- Namespacing por `user.id` en todas las claves privadas.
- Purgar también al detectar un cambio de usuario en el login.

**Esfuerzo:** S (0,5 día, junto con P0-2).

---

### P1-9. Google OAuth en iPhone standalone y en TWA necesita prueba específica

**Dónde:** `src/components/auth/auth-card.tsx:167-205` construye `callbackURL` y `errorCallbackURL` con `window.location.origin` y llama `authClient.signIn.social({ provider: "google" })`. El cliente es same-origin (`src/lib/auth/client.ts:9`).

**Riesgo:** en iPhone, el flujo OAuth puede abrir Safari o una hoja externa y volver allí, no a la PWA instalada. En TWA, si no hay Digital Asset Links e intent filters, el retorno puede quedarse en Chrome/Custom Tabs. El correo OTP no tiene ese problema.

**Arreglo mínimo:**

- Probar Google en iPhone instalado y en TWA antes de promocionarlo.
- En iOS standalone, ofrecer correo OTP como opción principal y mostrar un aviso si Google falla.
- En TWA, no promocionar Google hasta tener `assetlinks.json` y probar el retorno.
- No cambiar el `callbackURL` a un esquema custom: la app es web y debe seguir usando HTTPS.

**Esfuerzo:** S–M (0,5–1 día de pruebas; el arreglo puede ser solo copy/orden de opciones).

---

### P1-10. El mapa no tiene caché offline y pinta demasiados marcadores

**Dónde:** `src/components/map/MapContent.tsx:185-190` usa `TileLayer`; `src/lib/map/map-config.ts:9-33` define CARTO/OSM. `MapMarkers.tsx:82-106` no agrupa. El catálogo por defecto es 200 (`api/places/route.ts:77`).

**Riesgo:** sin red, el mapa queda en blanco aunque el catálogo esté cacheado. Con 200 marcadores en gama baja, el arrastre y el zoom se degradan.

**Arreglo mínimo:**

- Cachear teselas con límite (por ejemplo 20 MB / 14 días) y LRU; respetar atribución y política del proveedor.
- Agrupar marcadores o limitar la vista inicial.
- En offline, mostrar la lista en lugar del mapa si no hay teselas.

**Esfuerzo:** M (1–2 días, solo si se quiere mapa offline; la lista offline es más barata).

---

## 4. Hallazgos P2 — mejoras

| ID | Dónde | Riesgo | Arreglo mínimo |
|---|---|---|---|
| P2-1 | `src/app/layout.tsx:53-58` usa `#ffffff`/`#0e1720`; `src/app/manifest.ts:35-36` usa `#06211a` | La barra del navegador y la pantalla de arranque no coinciden | Unificar el color o documentar por qué difieren |
| P2-2 | `src/app/manifest.ts:29` fija `orientation: "portrait"` | Impide landscape en tablets y en el mapa | Quitar `orientation` o usar `"any"` |
| P2-3 | `src/app/manifest.ts:20-59` sin `prefer_related_applications`, `launch_handler`, `handle_links` | Menos control de apertura y enlaces | Añadirlos cuando exista TWA |
| P2-4 | `next.config.ts:46-47` usa `'unsafe-inline'` en script y style | Reduce la protección de la CSP | Nonce/hash para el script inline de `layout.tsx:121-128`; styles inline son más difíciles |
| P2-5 | `next.config.ts:48` permite `img-src https:` | Superficie amplia para imágenes | Restringir a hosts concretos (`*.neon.tech`, `images.unsplash.com`, tiles) |
| P2-6 | Producción envía `X-Powered-By: Next.js` | Fingerprinting innecesario | `poweredByHeader: false` en `next.config.ts` |
| P2-7 | `src/app/layout.tsx:16-34` precarga varias fuentes; ~115 KB en cuatro woff2 | Peso inicial en datos lentos | Dejar dos pesos y subset latino |
| P2-8 | `src/components/profile/notifications-view.tsx:55-62` | Marcar leído falla en silencio | Reintento y aviso, igual que P1-7 |
| P2-9 | No hay `apple-touch-startup-image` | Pantalla de arranque iOS genérica | Generar splash por tamaños si se quiere pulir |
| P2-10 | `public/icons/*` y manifest con `max-age=0` | Revalidación constante | Cache largo o nombres versionados |

---

## 5. Modo offline

### 5.1. Qué ocurre hoy

Sin red, una apertura nueva de cualquier ruta falla en el navegador porque no hay service worker. Si la pestaña ya estaba abierta y solo se corta la conexión, parte del estado cliente sigue visible hasta que se recarga o se navega a otra ruta.

- **Catálogo público:** `usePlaces()` carga al montar (`places-provider.tsx:148-176`). Si falla, guarda un error en estado, pero no hay datos persistidos. Al recargar, no hay nada.
- **Ficha pública y menú:** son páginas de servidor; sin red no se sirve HTML. `m/[slug]` usa ISR de 300 s (`src/app/m/[slug]/page.tsx:89`), pero eso es caché del servidor, no del teléfono.
- **Perfil:** el componente lee preferencias locales y luego `fetchMe()`; el fallo cae a la copia local sin aviso (`src/app/(main)/profile/page.tsx:81-130,219-221`). Al recargar, el documento no carga.
- **Panel de negocio y métricas:** todo servidor (`business/page.tsx:100-130`). No hay snapshot.
- **Escrituras:** “marcar agotado” falla con error visible en catálogo/editor (`catalogo-view.tsx:451-504`, `menu-item-editor.tsx:207-244`). El perfil y las notificaciones pueden fallar en silencio.
- **Sesión:** la cookie puede seguir en el teléfono, pero el servidor no puede validarla. El proxy trata el fallo como no autenticado (`proxy.ts:149-151`).

### 5.2. Estrategia recomendada

**Capas, de abajo arriba:**

1. **App shell precacheado:** `offline.html`, iconos, fuentes y CSS/JS estáticos de `/_next/static/`. Cache-first para estáticos inmutables.
2. **Navegación pública:** network-first con timeout corto (3–5 s) y fallback a la copia cacheada; si no hay copia, `offline.html`.
3. **Datos públicos:** stale-while-revalidate para `/api/places` y `/api/categories`, con `cachedAt`. Respetar `Cache-Control` y no cachear `private`/`no-store`.
4. **Imágenes:** Cache Storage con límite de tamaño y expiración (LRU). Objetivo inicial: 50 MB / 30 días.
5. **Datos privados:** IndexedDB por usuario, nunca Cache Storage compartida. Snapshot de perfil y panel.
6. **Escrituras:** sin cola. Fallo explícito + reintento manual. La cola completa se valora después.

**Reglas del service worker:**

- No interceptar `?_rsc=`, cabecera `RSC`, `Next-Router-Prefetch` ni `Next-Router-State-Tree`. Si se devuelve HTML a una petición RSC, el router de Next se rompe.
- No cachear `/api/auth/**`, `/api/me`, `/api/notifications`, `/api/business/**`, `/api/negocio/**`, `/api/pedidos/**`, `/api/reservas` ni ningún `POST`/`PATCH`/`DELETE`.
- No cachear respuestas con `Set-Cookie`, `Cache-Control: private` o `no-store`.
- Solo same-origin. No cachear redirecciones a login.
- Versionar la caché (`lv-v1`, `lv-v2`, …) y borrar las antiguas en `activate`.
- `skipWaiting` solo cuando el usuario pulse “Actualizar”, no automáticamente. Si se fuerza, una pestaña vieja puede pedir chunks que ya no existen.
- `clients.claim()` después de activar, una sola vez.

**Flujo de actualización:**

1. El SW nuevo se instala y queda en `waiting`.
2. La página detecta `registration.waiting` y muestra “Hay una versión nueva. Toca para actualizar”.
3. Al pulsar, `postMessage({ type: "SKIP_WAITING" })`.
4. En `controllerchange`, recargar una vez. Evitar bucles con una bandera.
5. El script de recarga por chunk perdido (`layout.tsx:121-128`) sigue siendo la red de seguridad.

### 5.3. Tabla de pantallas

| Pantalla | ¿Funciona offline hoy? | Qué falta | Esfuerzo |
|---|---|---|---|
| `/` portada | No (solo si ya estaba abierta) | Documento precacheado o fallback a `offline.html` | S |
| `/home` mapa y catálogo | Parcial: estado en memoria; recarga pierde todo | Catálogo y categorías en caché, imágenes, teselas opcionales, indicador y botón actualizar | M |
| `/place/[id]` ficha pública | No | Documento network-first con fallback, datos públicos e imágenes | M |
| `/m/[slug]` menú público | No | Documento cacheado, menú y fotos; es la pantalla más compartida | M |
| `/profile` perfil | Parcial: preferencias locales; recarga falla | Snapshot de perfil en IndexedDB, indicador y fecha | M |
| `/business` dashboard y métricas | No | Snapshot de props en IndexedDB + ruta offline de lectura | L |
| `/business` catálogo y menú | No para abrir; escrituras fallan con error visible | Snapshot de catálogo; modo lectura; errores claros y reintento | L |
| `/business` estadísticas | No | Incluidas en el snapshot del panel | L |
| `/notifications` | No | Snapshot de últimas 20 o mensaje “no disponible sin conexión” | M |
| `/login` | No | `offline.html` con explicación; no hay login offline | S |
| `/admin` | No | Fuera de alcance; no cachear | — |

### 5.4. Qué guardar y dónde

| Dato | Almacén | Peso estimado | Retención |
|---|---|---|---|
| App shell, CSS/JS estáticos, fuentes | Cache Storage | 2–6 MB | Hasta cambio de versión |
| Catálogo público (`/api/places`) | Cache Storage o IndexedDB | 100–400 KB raw; 30–80 KB comprimido | 7 días |
| Categorías | Cache Storage | < 10 KB | 7 días |
| Ficha pública y menú (HTML) | Cache Storage | 50–200 KB por página | 7 días |
| Logos y fotos de menú | Cache Storage | 10–60 KB por imagen | 30 días / 50 MB tope |
| Teselas del mapa (opcional) | Cache Storage | ~20 MB tope | 14 días |
| Snapshot de perfil | IndexedDB | < 10 KB | Hasta logout o 7 días sin validar |
| Snapshot de panel de negocio | IndexedDB | 20–80 KB por negocio | Hasta logout o 7 días sin validar |
| Metadatos (`cachedAt`, `userId`, `lastAuthAt`) | IndexedDB | < 5 KB | Igual que el snapshot |

Total típico: 5–15 MB. Tope recomendado: 80 MB, con LRU y `navigator.storage.estimate()` antes de crecer.

**Cache Storage vs IndexedDB:**

- **Cache Storage** para pares petición/respuesta que el service worker puede devolver tal cual: estáticos, HTML público, imágenes, JSON público.
- **IndexedDB** para snapshots privados, metadatos y cualquier dato que haya que mostrar con “actualizado hace X”. No guardar datos privados en Cache Storage compartida.

### 5.5. Indicador y actualización manual

- Componente `OfflineStatus` que escuche `online` y `offline`.
- Texto: “Sin conexión · datos del 24 oct, 14:32”. Si nunca hubo datos: “Sin conexión. Aún no hay datos guardados.”
- Botón “Actualizar” siempre visible en pantallas con caché. No depender de pull-to-refresh: el gesto puede no existir en el APK y no es descubrible.
- Si no hay red, el botón muestra “Necesitas conexión para actualizar” y no borra los datos.
- En el panel de negocio, indicar “Vista guardada” o “Datos de la última conexión” de forma persistente, no solo un toast.

### 5.6. Escrituras offline

Hoy:

- **Catálogo y editor de menú:** el `fetch` falla y se muestra un error; el estado local no se toca (`catalogo-view.tsx:451-504`, `menu-item-editor.tsx:207-244`). Correcto en cuanto a no mentir, pero el mensaje puede ser técnico y no hay botón de reintento.
- **Ficha de negocio:** error explícito y no cambia nada (`business-panel.tsx:903-910`).
- **Perfil:** falla en silencio (`profile/page.tsx:219-221`).
- **Notificaciones:** marcar leído falla en silencio (`notifications-view.tsx:38-46,55-62`).
- **Pedidos y reservas:** hay toasts en varios puntos; no hay cola ni reintento automático.

Propuesta inmediata:

- Mensaje único: “Sin conexión. No se guardó nada.” + botón “Reintentar”.
- No aplicar el cambio local hasta que el servidor confirme.
- Distinguir “error de red” de “error del servidor” y de “permiso/plan”.
- No prometer sincronización futura.

**Cola offline completa:** coste L–XL (2–4 semanas). Requiere claves de idempotencia por acción, política de conflictos, estados “pendiente”, sincronización al recuperar red y manejo de iOS (Background Sync no es fiable en Safari). No hacerla todavía.

**Primera función que la justificaría:** “marcar agotado/disponible”. Es un booleano por producto, el conflicto se resuelve con “gana la última escritura”, el payload es mínimo y el valor para el dueño es alto. Pedidos, reservas y pagos no: tienen dinero, stock y conflictos reales.

### 5.7. Privacidad

- Namespacing por `user.id` en todas las claves privadas.
- Borrar Cache Storage privada e IndexedDB en `logout()`, incluso si `signOut()` falla por red (`logout.ts:54-70`).
- Purgar antes de guardar un snapshot de otro usuario.
- Nunca cachear `/api/auth/**`, `/api/me`, `/api/notifications`, `/api/business/**`, `/api/negocio/**`, `/api/pedidos/**`, `/api/reservas`, `/business`, `/profile` ni `/admin`.
- No cachear respuestas de otros usuarios: el SW no debe guardar respuestas autenticadas en una caché compartida.
- En un teléfono compartido, el snapshot privado debe quedar inutilizable tras logout. Si se quiere más protección, pedir confirmación local antes de abrir el panel offline.

### 5.8. Sesión offline

- La cookie de sesión es `HttpOnly`, `Secure` y `SameSite=Lax`; JavaScript no puede leer su caducidad. La caché firmada de datos de sesión dura 7 días (`auth/server.ts:39-45`), limitada por la caducidad real de la sesión de Neon.
- Offline no se puede validar la sesión. El snapshot se muestra en modo lectura con `lastAuthAt`.
- Si `lastAuthAt` tiene más de 7 días, bloquear el snapshot y mostrar “Sesión sin verificar. Conéctate para entrar”.
- Al recuperar red, la primera llamada a `/api/me` decide: si `401`, purgar snapshot y cachés privadas y mandar a login.
- Si el usuario cierra sesión offline, purgar localmente y salir a la portada; no dejar datos privados abiertos.

### 5.9. Escenarios de prueba

1. **Sin conexión desde el inicio:** instalar, cerrar, activar modo avión, abrir icono. Debe abrir `offline.html` o el último snapshot, sin error del navegador.
2. **Corte a mitad de carga:** abrir `/home`, cortar red mientras carga el catálogo. Debe quedar el estado anterior o un aviso, nunca una pantalla en blanco.
3. **Señal lenta:** throttling 3G/2G (400 ms, 50–200 kbps). Medir LCP, tiempo hasta catálogo y peso descargado.
4. **Primera apertura sin red:** usuario nuevo, sin caché. Debe ver una explicación clara y ningún dato inventado.
5. **Sesión caducada offline:** manipular `lastAuthAt` o esperar; el snapshot debe bloquearse y pedir conexión.
6. **Cambio de usuario:** usuario A cierra sesión online, usuario B entra, se activa modo avión. B no debe ver datos de A.
7. **Logout offline:** cerrar sesión sin red y reabrir. No debe quedar snapshot privado.
8. **Actualización del SW:** publicar versión nueva, abrir app, ver aviso, actualizar y comprobar que no se mezclan chunks viejos.

---

## 6. Instalabilidad

### Android / Chrome

Criterios que ya se cumplen: HTTPS, manifest válido, `name`/`short_name`, iconos 192 y 512, `start_url`, `display: standalone`, `theme_color`/`background_color`.

Criterios que conviene revisar en DevTools → Application → Manifest:

- `start_url` accesible y sin redirección a login.
- Icono 192 y 512 accesibles.
- Service worker con `fetch` handler (para offline y push).
- `beforeinstallprompt` capturado para mostrar el botón propio.

No afirmar una versión concreta de Chrome sin comprobarla en el dispositivo. La comprobación práctica es DevTools → Application → Manifest y el evento `beforeinstallprompt` en consola.

### iPhone / Safari

- `appleWebApp.capable` y `apple-icon.png` ya están (`layout.tsx:94-103`).
- Safari no dispara `beforeinstallprompt`. Hay que mostrar instrucciones manuales: Compartir → Añadir a pantalla de inicio.
- iOS 16.4+ permite push solo en web apps instaladas. El permiso debe pedirse dentro de la app instalada y tras una acción del usuario.
- Añadir splash screens solo si se quiere pulir; no bloquea la instalación.

### TWA / APK

- Requiere `assetlinks.json` y el SHA-256 del certificado de firma.
- Requiere intent filters para los enlaces que deban abrir la app.
- El TWA usa Chrome como motor y comparte cookies de Chrome; la auth same-origin debería funcionar mejor que en iOS standalone, pero hay que probar el retorno de Google OAuth.
- Decidir `package_name` antes de firmar. Cambiarlo después obliga a republicar.

---

## 7. Push web

### Estado actual

No hay suscripción ni envío. La tabla `notifications` es solo in-app (`src/lib/db/schema/notifications.ts:5-25`); el broadcast inserta filas (`src/app/api/admin/broadcast/route.ts:42-127`); la API solo lee y marca leídas (`src/app/api/notifications/route.ts:7-39`).

### Plan mínimo

1. **Esquema** `push_subscriptions` con `endpoint` único y FK a `users` con `onDelete: "cascade"`.
2. **Suscripción:** `POST /api/push/subscribe` con `endpoint`, `keys.p256dh`, `keys.auth`; validar sesión, limitar a 3–5 suscripciones por usuario.
3. **Baja:** `DELETE /api/push/unsubscribe` por endpoint.
4. **Service worker:** `push` → `showNotification`; `notificationclick` → `clients.openWindow(url)` o foco; `pushsubscriptionchange` → renovar y reenviar al servidor.
5. **Envío:** `web-push` en servidor. Variables:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT` (mailto)
6. **Limpieza:** `404`/`410` → borrar suscripción; `429`/`5xx` → marcar fallo y reintentar más tarde.
7. **Integración:** enviar push desde el broadcast de admin, además de insertar la notificación in-app.
8. **Permiso:** solo tras acción del usuario, nunca al cargar. En iOS, solo dentro de la app instalada.

### Limitaciones iOS

- Push web solo en iOS 16.4+ y solo si la web está añadida a la pantalla de inicio.
- No hay `beforeinstallprompt`; el usuario debe instalar manualmente.
- El permiso no se puede pedir desde una pestaña normal de Safari.
- Si la app se elimina de la pantalla de inicio, la suscripción se pierde.

### Limitaciones TWA

- Android puede delegar notificaciones al TWA; probar en dispositivo.
- El endpoint sigue siendo web push; la suscripción se crea en el contexto Chrome.
- Sin assetlinks, el TWA puede no abrir desde la notificación.

---

## 8. Autenticación en standalone y TWA

- El navegador habla solo con `/api/auth/*` en el mismo origen (`auth/client.ts:9`, `api/auth/[...path]/route.ts:25`). Esto evita problemas de terceros y funciona en standalone.
- Cookies `HttpOnly`, `Secure`, `SameSite=Lax`; la sesión de datos dura 7 días (`auth/server.ts:39-45`).
- En iPhone standalone, las cookies de la PWA se guardan en el contenedor de Safari; la sesión persistente debería sobrevivir, pero Google OAuth puede salir del contexto. Probar y ofrecer OTP como alternativa.
- En TWA, Chrome gestiona cookies y OAuth; el retorno depende de intent filters y assetlinks.
- No cachear respuestas de auth. El service worker debe dejar pasar todo `/api/auth/**`.
- Si el usuario está offline, no hay login posible. Mostrar `offline.html` con una explicación, no un formulario que va a fallar.

---

## 9. Rendimiento en gama baja y datos lentos

### Lo que ya está bien

- Leaflet se carga con `next/dynamic` y `ssr: false` (`MapView.tsx:8-21`); no viaja en el HTML inicial.
- `next/image` se usa en tarjetas y fichas; hay `qualities: [70, 75]` (`next.config.ts:83-110`).
- Los chunks de `/_next/static/` se sirven inmutables en producción.
- La compresión de imágenes de menú ocurre antes de subir (`catalogo-view.tsx:418-424`).

### Lo que pesa

| Punto | Evidencia | Impacto |
|---|---|---|
| PostHog estático en todas las rutas | `analytics.ts:27`, `layout.tsx:136` | ~300 KB raw; se descarga aunque no haya clave |
| `@neondatabase/auth-ui` global | `auth-provider.tsx:3-7,18-35` | ~305 KB raw + CSS en páginas públicas |
| `/home` es cliente completo | `home/page.tsx:1` | Sin HTML útil en el primer paint; LCP depende de JS |
| Fallback de Suspense vacío | `home/page.tsx:1867-1873` | Pantalla en blanco hasta hidratar |
| Leaflet | chunk ~358 KB raw | Coste alto al abrir mapa |
| 200 marcadores sin clúster | `api/places/route.ts:77`, `MapMarkers.tsx:82-106` | CPU y memoria en gama baja |
| Iconos grandes | `public/icons/*` | 56–275 KB por icono |
| Cuatro fuentes precargadas | `layout.tsx:16-34` | ~115 KB antes de pintar |
| API pública solo `s-maxage` | `api/places/route.ts:141-145` | El navegador no reutiliza de forma garantizada |

### LCP

La portada y `/home` no tienen contenido de servidor útil. Para mejorar LCP sin reescribir todo:

1. Renderizar en servidor el título, la barra de búsqueda y una lista inicial de lugares.
2. Dejar el mapa y los filtros interactivos como islas cliente.
3. Reservar el espacio del mapa con `min-height` para evitar CLS.
4. Reducir fuentes y cargar PostHog después.

### Caché de mapa y catálogo

- Catálogo: cachear JSON público con SWR y fecha.
- Mapa: cachear teselas con tope y LRU; si no hay red, mostrar lista.
- Imágenes: `next/image` + Cache Storage con tope de 50 MB y expiración de 30 días.
- No cachear imágenes privadas de otros usuarios.

---

## 10. Enlaces profundos y Digital Asset Links

### Estado

`/.well-known/assetlinks.json` → `404`. No hay archivo estático ni ruta. El proxy excluye rutas con extensión (`src/proxy.ts:213-215`), así que un archivo en `public/.well-known/` no debería pasar por auth, pero hay que verificar el `Content-Type` y que no haya redirección.

### Plantilla

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "dev.kynari.laverde",
      "sha256_cert_fingerprints": [
        "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99"
      ]
    }
  }
]
```

Los valores son marcadores: el `package_name` y la huella deben salir del APK firmado. No inventarlos.

### Intent filters sugeridos

- `https://laverde.kynari.dev/m/` → abre menú público.
- `https://laverde.kynari.dev/place/` → abre ficha.
- `https://laverde.kynari.dev/business` → abre panel si hay sesión.

Verificar con `adb shell am start -a android.intent.action.VIEW -d "https://laverde.kynari.dev/m/slug"` y con la herramienta de verificación de enlaces de Android.

---

## 11. Seguridad

### Bien

- HSTS en producción con `max-age=63072000; includeSubDomains; preload` (`next.config.ts:76-80`).
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` (`next.config.ts:64-73`).
- CSP con `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'` (`next.config.ts:44-61`).
- Cookies de auth `HttpOnly`, `Secure`, `SameSite=Lax` (observado en producción; el SDK las serializa así en `@neondatabase/auth/dist/server-b0OzGjXl.mjs:357-364`).
- No hay secretos en git: `.env`, `data/`, `Cloudflare/`, `groq-for-claude-code/`, `CREDENCIALES-DEMO.md` y `.clerk/` no aparecen en `git ls-files`; `git status` limpio.
- El navegador no llama a Neon directamente; todo va por `/api/auth/*`.

### Riesgos y mejoras

- `script-src 'unsafe-inline'` y `style-src 'unsafe-inline'` reducen el valor de la CSP (`next.config.ts:46-47`). El script inline de recarga por chunk (`layout.tsx:121-128`) lo necesita hoy; se puede pasar a hash/nonce.
- `img-src https:` es amplio (`next.config.ts:48`). Restringir a los hosts reales.
- `X-Powered-By: Next.js` se envía en producción. Desactivarlo.
- El service worker debe ser estricto: solo same-origin, solo `GET`, nunca auth ni respuestas privadas, y purga al logout.
- Los endpoints de push deben validar sesión, limitar suscripciones y no aceptar endpoints arbitrarios sin autenticación.
- No imprimir credenciales en logs ni en el informe.
- El `assetlinks.json` es público por diseño; no incluye secretos, solo huellas de certificado.

---

## 12. Lighthouse

No se ejecutó Lighthouse ni se condujo el navegador: CLAUDE.md lo prohíbe en este proyecto. Comando exacto para ejecutarlo tú contra producción:

```bash
npx lighthouse@11 https://laverde.kynari.dev \
  --only-categories=performance,pwa,accessibility,best-practices,seo \
  --form-factor=mobile \
  --screenEmulation.mobile \
  --throttling-method=simulate \
  --output=html \
  --output-path=./lighthouse-la-verde.html \
  --chrome-flags="--headless=new"
```

Notas:

- Se fija `lighthouse@11` porque la categoría `pwa` se eliminó en versiones posteriores. Si tu versión no la acepta, quita `pwa` y revisa la instalación en DevTools → Application → Manifest.
- El throttling simulado no sustituye a una prueba en un teléfono real con red cubana. Para la prueba real, usa Chrome DevTools → Network → Slow 3G/2G y un Android de gama baja.
- Revisar también `chrome://inspect` o `adb` para el TWA, y Safari Web Inspector para iPhone.

---

## 13. Plan de cambios ordenado

| Orden | Cambio | Depende de | Esfuerzo | Tiempo estimado |
|---|---|---|---|---|
| 0 | Decidir `start_url`, `id`, nombre de paquete TWA y alcance offline | — | S | 0,5 día |
| 1 | Manifest: shortcuts, screenshots, iconos optimizados, campos de arranque | 0 | S–M | 0,5–1 día |
| 2 | Botón de instalación Android + instrucciones iPhone | 1 | S | 0,5 día |
| 3 | Service worker base: precaché, offline.html, versión, actualización | 0 | M | 1–2 días |
| 4 | Caché pública: `/api/places`, `/api/categories`, fichas y menú, imágenes | 3 | M | 2–3 días |
| 5 | Indicador offline, fecha de actualización y botón refrescar | 4 | S | 0,5–1 día |
| 6 | Snapshot de perfil y panel de negocio en IndexedDB + ruta offline | 3, 4 | L | 3–5 días |
| 7 | Purga de cachés privadas en logout y cambio de usuario | 6 | S | 0,5 día |
| 8 | Errores de escritura claros + reintento (sin cola) | 5 | S | 1 día |
| 9 | Push: esquema, endpoints, SW, VAPID, envío y limpieza | 3 | L | 3–5 días |
| 10 | TWA: assetlinks, intent filters, firma y pruebas | 0 | S–M | 0,5–1 día + firma |
| 11 | Rendimiento: PostHog/auth-ui diferidos, home servidor, marcadores, fuentes | — | M–L | 2–4 días |
| 12 | Seguridad y caché: CSP, headers, `max-age` de públicos | — | S | 0,5 día |

**Total realista:** 2–3 semanas de trabajo de una persona, sin contar la firma y publicación del APK ni las pruebas en dispositivos físicos.

**Orden recomendado si hay que recortar:** 3 → 4 → 5 → 6 → 7. Eso entrega el modo offline para dueños, que es el objetivo de mayor valor. Push (9) y TWA (10) pueden ir después; no bloquean la consulta offline.

---

## 14. Decisiones que necesitan tu aprobación

1. **Arranque:** ¿`start_url` a `/home`, o una ruta `/abrir` que mande a `/business` a los dueños?
Respuesta: que sea a /home
2. **Alcance offline:** ¿solo lectura (recomendado) o también escritura con cola? La cola no está en este plan.
Respuesta: solo lectura
3. **TWA:** ¿`package_name` definitivo y certificado de firma? Sin eso no se puede publicar `assetlinks.json`.
Respuesta: que sea asi certificado
4. **Push:** ¿se acepta añadir `web-push` como dependencia de servidor?
Resouesta: si es necesario para recibir las notificaciones a los dispositivos , si añadella
5. **Prioridad:** ¿offline primero y push/TWA después, o se necesitan los tres a la vez?
Respuesta: se necesitan los 3 a la ves, pero probando por fases para no dejas huecos : primero ofline, luego push, y luego twa

Cuando apruebes, empiezo por el orden 0–3 y no toco nada más hasta que lo revises.
