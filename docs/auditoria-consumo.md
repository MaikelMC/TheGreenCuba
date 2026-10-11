# Auditoría de consumo — La Verde

Fecha: 2026-10-11. Alcance: Next.js 16.3.5, build de producción local
(`npm run build`, exit 0). Sin cambios de código.

Métricas objetivo en Vercel Hobby/Pro: **Edge Requests**, **CPU activa**,
**invocaciones de funciones** y **transferencia**.

---

## 1. Mapa de rutas (build real)

Salida de `next build` (55 páginas, 11 workers).

### Estáticas (`○`) — HTML desde CDN, sin invocación

| Ruta | Revalidate |
|---|---|
| `/` | 5m (heredado de `listPlaces`, no declarado) |
| `/_not-found`, `/icon.png`, `/apple-icon.png`, `/opengraph-image`, `/manifest.webmanifest`, `/robots.txt` | — |
| `/forgot-password`, `/reset-password`, `/restablecer-contrasena` | — |
| `/home`, `/notifications`, `/onboarding`, `/profile`, `/terminos` | — |
| `/sitemap.xml` | 5m (declara 3600; gana el mínimo de `listPlaces`) |

`/home`, `/profile` y `/notifications` son estáticas porque la página entera es
un componente de cliente: el HTML es la cáscara y los datos llegan después por
`fetch`. Estático aquí no significa barato — mueve el costo al cliente (§3.2,
§3.3).

### Dinámicas (`ƒ`) — una invocación por petición

**Páginas:**

| Ruta | Por qué es dinámica |
|---|---|
| `/m/[slug]` | Declara `revalidate = 300` pero **el build la sirve como dinámica**. Sin `generateStaticParams`. Causa probable: `getAppUser()` → `headers()` (`m/[slug]/page.tsx:258` → `lib/auth/user.ts:115`). Verificar antes de tocar (§4). |
| `/place/[id]` | Igual: `getAppUser()` en `place/[id]/page.tsx:42`. Además **no declara `revalidate` en absoluto**. |
| `/login`, `/register`, `/verify-email` | `needsAppUser` → sesión en el render. |
| `/admin/*` (10 rutas) | `admin/layout.tsx:16` → `force-dynamic`. |
| `/business`, `/projects`, `/enlaces`, `/ranking`, `/dev-login` | `force-dynamic` declarado (`enlaces:17`, `business/layout:13`, `ranking:28`) o lectura de sesión. |

**API (~52 rutas)**: todas dinámicas. Las que no declaran `force-dynamic` lo son
igual porque usan `NextRequest`.

---

## 2. Causas por categoría (con archivo y línea)

### Marcadores de dinamicidad

| Marcador | Dónde |
|---|---|
| `export const dynamic = "force-dynamic"` | `admin/layout.tsx:16`, `(main)/business/layout.tsx:13`, `(main)/enlaces/page.tsx:17`, `(main)/ranking/page.tsx:28`, `(main)/place/[id]/carta/route.ts:22`, `api/telegram/webhook:28`, `api/seguidores:29`, `api/cron/{analytics,ranking}:29`, `api/business/asistente:24`, `api/admin/analytics:38`, `api/admin/analytics/export:36`, `api/notifications/stream:7` |
| `cache: 'no-store'` | Ninguno |
| `revalidate = 0` | Ninguno |

No hay `no-store` ni `revalidate = 0` en el proyecto. El problema no son los
marcadores explícitos, son las dependencias implícitas de abajo.

### `cookies()` / `headers()` fuera de sitios obvios

- `src/app/(main)/place/[id]/page.tsx:42` — `getAppUser()` condicionado a
  `id === DEV_PLACE_ID`, pero arrastra `headers()` al grafo del módulo.
- `src/app/m/[slug]/page.tsx:258` — idéntico.
- `src/lib/auth/user.ts:115` (`headers()`), `:133` (`cookies()`),
  `:153` (`cookies()`).
- `src/app/api/metrics/place/route.ts:111` — `cookies()` para leer UTM.

Contrato incumplido: `src/lib/session.ts:73-79` exige que toda ruta que llame a
`getAppUser` esté en `needsAppUser`. `/m/[slug]` y `/place/[id]` no están. Hoy
solo se nota con el negocio de prueba, pero es una bomba de relojería: si el
negocio de prueba se pide en producción, el render cae al respaldo y
`auth.getSession()` intenta escribir cookie dentro del render (E1180).

### `proxy.ts` (el `middleware.ts` de Next 16)

`src/proxy.ts:212`:

```ts
matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"]
```

Alcance real: **todas** las rutas sin extensión, incluidas las públicas y las
estáticas (`/`, `/terminos`, `/m/...`, `/place/...`, `/home`, `/login`). Solo
excluye API, `_next/*`, y cualquier cosa con punto.

Trabajo por petición (`handle`, `proxy.ts:104-188`):
- Rutas públicas (`/`, `/terminos`, `/m/*`, `/place/*`): corta en `:111` con
  `NextResponse.next()` sin tocar Neon. Barato pero **la invocación ya se pagó**.
- Rutas con `needsAppUser`: `auth.getSession()` contra Neon (`:147`).

Redirigir `?ref=` (`carryReferralCode`, `:93`) es lo que obliga a que el matcher
sea global: un enlace de afiliado puede aterrizar en cualquier URL.

### Enlaces y navegación

- `<Link>` sin `prefetch={false}`: `ranking/page.tsx:53` (podio, lista corta),
  `place-strip.tsx`, `footer`. Ninguna lista larga.
- El home **no usa `<Link>`**: navega con `router.push` (`home/page.tsx:876`),
  así que el prefetch automático no dispara peticiones extra. Correcto.

### Polling en cliente

| Sitio | Patrón | Coste |
|---|---|---|
| `api/notifications/stream/route.ts:44` | `setInterval` 15 s que **re-consulta Neon** y lo empuja por SSE | 1 invocación viva por pestaña + 1 consulta cada 15 s por pestaña |
| `components/layout/user-menu.tsx:242` | `EventSource` a esa ruta, con reconexión | Mantiene la invocación abierta |
| `user-menu.tsx:223-261` | Respaldo a polling con backoff 10 s→5 min si SSE cae | Aceptable |
| `header.tsx:179`, `MapLocationPicker.tsx:165` | `setTimeout` 350 ms = **debounce** | Correcto |
| `MapContent.tsx:128` | `requestAnimationFrame` una vez | Correcto |
| `analytics-dashboard.tsx:1245` | Debounce 350 ms | Correcto |

Movimiento del mapa: no hay llamada a API por movimiento. La geocodificación
sale del navegador a Photon (no pasa por Vercel) y va con debounce. Correcto.

### Búsqueda con IA

`src/app/api/ai/search/route.ts`:

- **Sin caché de consultas repetidas.** Dos usuarios que escriban «pizza
  barata» = dos llamadas al LLM. No hay `unstable_cache` ni clave normalizada.
- **Rate limit por instancia** (`rate-limit.ts:8`, `Map` en memoria). Con N
  instancias frías el tope real es `15 × N` por minuto e IP. El propio archivo
  lo admite (`:43`).
- **El catálogo entero viaja en el cuerpo de la petición**, desde el navegador:
  `home/page.tsx:952` serializa hasta 80 lugares × 12 líneas de carta. El
  servidor lo vuelve a validar entero (`sanitizePlaces`, `:59`).
- Topes de tokens: parciales. `MAX_PLACES=80`, `MAX_MENU_ITEMS=12`,
  `MAX_MENU_LINE=60` acotan la entrada; no hay tope de tokens de salida.
- `trackEvent` × 2 por búsqueda (`:180`, `:211`) → 2 escrituras `after()`.

### `next/image`

| Archivo:línea | Problema |
|---|---|
| `components/place/place-detail.tsx:1097` | `quality={95}` **no está en `qualities` de `next.config.ts:89`** (`[70, 75]`). Next 16 rechaza la petición: la foto del visor da 400. Además q95 multiplica el peso de la transformación y de la transferencia. |
| `next.config.ts:84` | Sin `minimumCacheTTL`. Se re-optimiza antes de lo necesario. |
| `next.config.ts:102` | `remotePatterns` con comodín `**.neon.tech`. Necesario (la rama cambia), pero deja `/_next/image` abierto a transformar cualquier objeto del bucket. |

El resto está bien: todas las `<Image>` revisadas llevan `sizes`. `m/[slug]`
usa `sizes="72px" quality={70}`, correcto.

### Registro de eventos y estadísticas

| Sitio | Granularidad |
|---|---|
| `components/menu/eventos-menu.tsx` | **Bien resuelto**: un beacon por visita, los productos vistos se acumulan y salen juntos con `sendBeacon` en `pagehide` (`lib/eventos-client.ts:47`). |
| `lib/place-metrics.ts:15` | **Mal resuelto**: `fetch` normal, uno por gesto. `home/page.tsx:976` dispara **hasta 5 POST** por búsqueda de IA (uno por match). |
| `api/metrics/place/route.ts` | Por cada POST: 1 `select` a `places` (`:67`), 1 `upsert` (`:77`), 1 `getAppUser` (`:108`), 1 lectura de cookie (`:111`) y 1 inserción de analytics diferida (`:129`). Son **~4 accesos a base + 1 invocación por clic de pin**. |

### Consultas N+1 e índices

- Los uno-a-varios del catálogo ya están resueltos con `inArray`
  (`photosByPlace`, `ofertasByPlace`, `queries.ts:191-207`). Sin N+1.
- `listPlaces` / `getPlaceById` / `getPlaceBySlug` / `listCategories` pasan por
  `unstable_cache` con `CATALOG_TAG`, 300 s (`queries.ts:67-73`). **En producción
  la base está protegida**; en desarrollo no (`:71`), a propósito.
- Paginación: `listPlaces` topa en 500 (`queries.ts:265`). `/api/admin/users`
  filtra por `id`, sin listado paginado.

### Revalidaciones masivas

**No hay ninguna.** Cero `revalidatePath` en el proyecto; solo
`revalidateTag(CATALOG_TAG, "max")`, que es una sola etiqueta compartida por
`places`, `categories` y `place_images`. Es el diseño correcto aquí.

### robots.txt / sitemap

Correctos. `robots.ts:30` cierra `/admin`, `/api`, `/business`, `/profile`,
`/onboarding`, `/login`, `/home`. `sitemap.ts` lista portada, `/terminos` y
**hasta 500 lugares × 2 URLs = 1000 URLs** que apuntan justo a las dos rutas
dinámicas del §1.

---

## 3. Tabla de hallazgos, ordenada por impacto

| # | Ruta o archivo | Problema | Métrica | Impacto | Fix concreto | Esfuerzo |
|---|---|---|---|---|---|---|
| 1 | `api/notifications/stream/route.ts:44` + `user-menu.tsx:242` | SSE mantiene una invocación abierta por pestaña logueada y **re-consulta Neon cada 15 s**; el cliente reconecta al cerrarse (55 s), así que es un bucle de invocaciones | Invocaciones + CPU activa | **Alto** | Quitar el re-query del heartbeat (mandar un comentario SSE para mantener vivo, sin tocar la base) y subir el intervalo a 25-30 s. O pasar a polling puro con el backoff que ya existe | Bajo |
| 2 | `header.tsx:115`, `user-menu.tsx:163`, `home/page.tsx:636` | **`/api/me` se llama 3 veces por carga** de `/home`. Cada llamada = 1 invocación + `getAppUser` + `businessOf` + `userHasProjects` + `marketingState` | Invocaciones + CPU | **Alto** | Un solo `SessionProvider` que haga el fetch una vez y lo reparta; `getAppUser` ya está deduplicado por `cache()` de React dentro de una petición, pero son 3 peticiones | Medio |
| 3 | `providers/places-provider.tsx:157-158` + `api/places/route.ts:28` + `api/categories/route.ts:19` | El catálogo entero (y las categorías) se piden en **cada montaje** del layout `(main)` y las respuestas **no llevan `Cache-Control`** → el CDN de Vercel no las cachea nunca | Invocaciones + Transferencia | **Alto** | `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` en el GET de ambas rutas, **solo sin `?all=true`** (`all=true` es el catálogo de admin con no publicados: `private, no-store`) | Bajo |
| 4 | `proxy.ts:212` | El matcher cubre **todas** las rutas sin extensión, incluidas las públicas y las estáticas. Cada visita a `/`, `/terminos`, `/m/*`, `/place/*` paga una invocación de proxy | Edge Requests | **Alto** | Acotar el matcher a las rutas que de verdad necesitan al proxy (`/admin`, `/business`, `/projects`, `/profile`, `/onboarding`, `/home`, `/enlaces`, `/login`, `/register`, `/verify-email`) más `has: [{ type: "query", key: "ref" }]` en una segunda regla para no perder el `?ref=` | Medio |
| 5 | `m/[slug]/page.tsx:57,258`, `place/[id]/page.tsx:42` | Las dos páginas públicas son dinámicas: 1 invocación + SSR completo por petición. Son **las 1000 URLs del sitemap**, o sea el grueso del tráfico de bots | Invocaciones + CPU | **Alto** | Sacar `getAppUser()` del camino público (la personalización del negocio de prueba no debería vivir en el módulo de la página) y añadir `generateStaticParams` + `revalidate = 300` a `/m/[slug]`. Ver §4 antes | Medio |
| 6 | `home/page.tsx:952` + `api/ai/search/route.ts` | Sin caché de consultas repetidas; el catálogo entero viaja en el cuerpo desde el navegador; rate limit por instancia en memoria | CPU + Invocaciones + costo LLM | **Alto** | Cachear por consulta normalizada con `unstable_cache` (TTL corto, 10 min) y devolver el catálogo desde el servidor en vez de mandarlo el cliente | Medio |
| 7 | `home/page.tsx:976` + `lib/place-metrics.ts:15` | Hasta **5 POST** a `/api/metrics/place` por búsqueda de IA (uno por match) y uno por clic de pin. Cada POST son ~4 accesos a base | Invocaciones + CPU | **Medio** | Acumular y mandar con `sendBeacon` en lote — el patrón ya existe en `lib/eventos-client.ts:47`, se reusa | Bajo |
| 8 | `place-detail.tsx:1097` vs `next.config.ts:89` | `quality={95}` no declarada en `qualities: [70, 75]`. Next 16 **rechaza la petición** y la foto del visor da 400 | Transferencia + imagen rota | **Medio** | Bajar a `quality={75}` (ya está declarada) o añadir 95 a la lista. Bajar es lo correcto: es un visor, no una imprenta | Bajo |
| 9 | `next.config.ts:84` | Sin `minimumCacheTTL` | Transferencia | **Medio** | `images: { minimumCacheTTL: 2592000 }` (30 días). Las URL del bucket llevan el nombre del objeto, así que no hay riesgo de servir una versión vieja | Bajo |
| 10 | `lib/analytics/events.ts:151` | Cada `trackEvent` usa `after()`: alarga la vida de la invocación y suma a la CPU facturable. 2 por búsqueda de IA, 1 por evento de métrica | CPU activa | **Medio** | Es el patrón correcto para no perder eventos. No cambiar; solo tenerlo en cuenta al contar el costo de §6 y §7 | — |
| 11 | `sitemap.ts:36` | Hasta 1000 URLs apuntando a rutas dinámicas | Invocaciones (bots) | **Medio** | Se resuelve solo con el punto 5. Si no se toca el 5, bajar el `limit: 500` a lo que quepa con `lastModified` real | Bajo |
| 12 | `api/search/route.ts:11` | Ruta muerta: devuelve `{ results: [] }` siempre | Invocaciones | **Bajo** | Borrar la ruta | Bajo |
| 13 | `lib/rate-limit.ts:8` | Cubo en memoria por instancia; el tope real es `limit × instancias` | Costo LLM | **Bajo** | Es una salvaguarda, no una garantía — el archivo ya lo dice (`:43`). Solo subir si aparece abuso real | Alto |

---

## 4. Verificación pendiente antes de tocar `/m/[slug]`

El build sirve `/m/[slug]` como dinámica pese a `revalidate = 300`. La
explicación más probable es `getAppUser()` en `m/[slug]/page.tsx:258`, que
arrastra `headers()` al grafo del módulo. **No lo doy por hecho.**

Comprobar en 2 minutos, contra producción:

```bash
curl -sI https://laverde.kynari.dev/m/<slug-de-un-negocio-real> | grep -i -E "cache-control|x-vercel-cache"
```

- `x-vercel-cache: HIT` + `cache-control: s-maxage=300` → la ISR funciona y el
  punto 5 solo aplica a `/place/[id]`.
- `MISS` en peticiones seguidas → la caché no se aplica, y el culpable es
  `getAppUser()`.

---

## 5. Los 5 cambios de mayor ahorro, en orden

1. **Un solo `/api/me`** (§3.2) — quita 2 invocaciones y ~8 consultas a Neon por
   carga de página para todo usuario con sesión. Es el mayor recorte de
   invocaciones por línea escrita.
2. **`Cache-Control` en `/api/places` y `/api/categories`** (§3.3) — quita 2
   invocaciones por carga de cualquier página de `(main)`, para todo el mundo,
   logueado o no. Dos cabeceras.
3. **Heartbeat del SSE sin consulta a Neon** (§3.1) — quita la carga periódica
   que sostiene una invocación viva por pestaña. Es el mayor recorte de CPU
   activa.
4. **Hacer cacheables `/place/[id]` y `/m/[slug]`** (§3.5) — el mayor recorte de
   CPU por petición, y son las páginas que más peticiones reciben de bots.
   Empezar por la verificación del §4.
5. **Acotar el matcher del proxy** (§3.4) — recorta Edge Requests en todo el
   tráfico público. Va último porque toca la puerta de entrada y hay que
   probarlo con cuidado (el `?ref=` no se puede perder).

Orden sugerido de commits: 1 → 2 → 3 → 4 → 5. Los tres primeros son de bajo
riesgo y se pueden verificar con `curl` sin desplegar nada; 4 y 5 merecen su
propia prueba en preview.
