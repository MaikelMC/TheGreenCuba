# Auditoría SEO / AEO / Local SEO — La Verde

**Fecha:** 2026-09-10
**Estado:** Auditoría completa. **Sin cambios de código aplicados.**
**Base:** `PROMPT_AUDITORIA_LA_VERDE.md`

Este documento es el resultado de la fase **AUDITAR → DETECTAR → PRIORIZAR**.
Las fases IMPLEMENTAR / VALIDAR quedan pendientes y el plan detallado ya está
listo para ejecutarse (sección *Plan de implementación*).

---

## 1. Resumen ejecutivo

La Verde no es hoy descubrible por buscadores. El servidor no emite ni un solo
nombre de lugar ni un solo enlace a un lugar: todo el contenido vive en
`localStorage` y aparece solo después de hidratar el JavaScript. No hay
`robots.txt`, ni `sitemap.xml`, ni datos estructurados, ni arquitectura de URLs
por ciudad o categoría. La única puerta de entrada orgánica posible es la
landing, que no contiene datos.

Lo que sí existe y es aprovechable: **30 negocios reales y verificados de
Santiago de Cuba** en `src/lib/seed-places.ts`, con nombre, categoría,
coordenadas, dirección, barrio, descripción, horario, métodos de pago y rango de
precio. Es material suficiente para construir el catálogo público completo sin
inventar un solo dato.

### Hallazgos que bloquean un deploy

1. **`siteConfig.url` cae a `http://localhost:3000`.** Si se despliega así, todo
   canonical, Open Graph y entrada de sitemap apunta a localhost: desindexa el
   sitio entero en silencio. Requiere `NEXT_PUBLIC_APP_URL` en producción.
2. **Sin `sitemap.ts` ni `robots.ts`**, no hay ruta de descubrimiento declarada.
3. **Las páginas de lugar no tienen versión indexable en ninguna URL.**

### Diagnóstico por capa

| Capa | Estado |
|---|---|
| Infraestructura SEO | Inexistente. Cero `robots.ts`, `sitemap.ts`, `public/`, JSON-LD. |
| Rendering | Crítico. Todo el contenido de lugares es client-only desde `localStorage`. |
| Arquitectura de información | Inexistente. El mapa es el único mecanismo de descubrimiento. |
| Metadata | Mínima. Solo un objeto plano en el root layout. Sin canonical ni OG. |
| Seguridad API | `/api/places` y `/api/places/[id]` exponen la tabla completa sin auth. |

---

## 2. Contexto auditado

**Proyecto:** La Verde — plataforma web para descubrir lugares en Cuba.
**Stack real:** Next.js 15 (App Router), React 19, TypeScript, Tailwind,
leaflet/react-leaflet para el mapa, zustand, drizzle-orm + Neon Postgres
(declarado pero **sin uso en runtime**).

**Datos disponibles:** 30 lugares reales de Santiago de Cuba. 8 categorías con
contenido: Restaurante, Cafetería, Bar, Hospedaje, Mercado, Cultura, Naturaleza,
Playa.

**Decisión de fuente de datos:** el proyecto **no tiene base de datos en uso**.
Las páginas públicas nuevas leen `src/lib/seed-places.ts`. La ruta de migración a
DB queda documentada en `docs/migracion-db.md` para el futuro.

---

## 3. Discovery

**Estado: no cubierto (P2).**

No existe ninguna página orientada a necesidad, ocasión, zona o método de pago.
El descubrimiento depende exclusivamente del mapa interactivo y de la búsqueda
por lenguaje natural.

Oportunidades detectadas sobre datos reales existentes:

- **Por categoría** — los 30 lugares ya están clasificados en 8 categorías.
- **Por ciudad** — los 30 están en Santiago de Cuba (el brief no lo declara como
  limitación permanente, pero hoy es la única ciudad con datos).
- **Por rango de precio** — el campo `priceLabel` existe y es real
  (`"300–1200 CUP"`, `"Gratis"`, `"$95–180 USD"`).
- **Por método de pago** — el campo `payments` existe (`["CUP"]`, `["USD","MLC"]`).
- **Por horario** — el campo `schedule` es texto libre, **no normalizable** hoy
  ("Todo el día", "De noche", "De día"). Bloquea landings tipo "Abierto ahora".

Las landings por necesidad se difieren a P2 porque requieren normalizar
`schedule` y `payments` primero, y el brief prohíbe explícitamente generar
contenido thin o inventar datos.

---

## 4. Search Intent

**Estado: cobertura mínima (P1).**

Intenciones que el sitio puede atender hoy con datos reales:

| Intención | Ejemplo | Cubierta por el plan |
|---|---|---|
| Local | "restaurantes en Santiago de Cuba" | Sí — `/lugares/santiago-de-cuba/restaurante` |
| Local + entidad | "Primos Twice Santiago de Cuba" | Sí — ficha del lugar |
| Exploratoria | "qué hacer en Santiago de Cuba" | Parcial — índice de categorías |
| Informacional | "dónde comer en Santiago" | Parcial — índice de categorías |
| Comercial | "mejores hoteles en Santiago" | Parcial — `/lugares/santiago-de-cuba/hospedaje` |
| Contextual | "algo barato que acepte transferencia" | No — P2 |
| Urgente | "abierto ahora cerca de mí" | No — requiere normalizar `schedule` |

La intención contextual y urgente es el diferencial declarado de La Verde
(§Contexto del brief) y hoy **no tiene ninguna página que la capture**. Es el
hueco de mayor valor a medio plazo, pero depende de datos estructurados que aún
no existen en el formato correcto.

---

## 5. Local SEO

**Estado: crítico, sin cubrir (P0).**

No existe arquitectura de información. Verificado: no hay rutas por ciudad,
categoría ni zona en `src/app/`. El mapa es el único mecanismo de descubrimiento,
lo que el brief prohíbe expresamente (§11).

Arquitectura propuesta, soportada únicamente por datos reales:

```
/lugares                                       índice
/lugares/santiago-de-cuba                      ciudad
/lugares/santiago-de-cuba/restaurante          ciudad + categoría
/lugares/santiago-de-cuba/restaurante/<slug>   lugar
```

Se descarta el nivel de zona (`/lugares/[ciudad]/zona/[barrio]`): el campo
`barrio` existe y es real, pero con 30 negocios varios barrios tendrían 1–2
lugares, lo que produce exactamente el thin content que el brief prohíbe. El
barrio se muestra como filtro dentro de la página de ciudad, no como ruta.

**Nota de implementación:** el modelo `UserPlace` guarda la categoría como
**etiqueta visible** (`"Restaurante"`), no como slug. El mapa etiqueta→slug debe
derivarse de `BUSINESS_CATEGORIES` en `src/lib/places.ts` (que ya tiene los 12
slugs), no duplicarse.

---

## 6. Arquitectura

**Estado: crítico, sin cubrir (P0).**

Hallazgo verificado: **ningún HTML servido por la aplicación contiene un nombre
de lugar ni un enlace a un lugar.**

Evidencia:

- `src/app/(main)/place/[id]/page.tsx` es `"use client"` y resuelve el lugar con
  `usePlaces()`, un provider respaldado por `localStorage`
  (`src/providers/places-provider.tsx`, clave `la-verde:places`).
- En el servidor ese efecto no corre, `places` es `[]`, la búsqueda devuelve
  `null` y **toda URL de lugar renderiza "Lugar no encontrado"**.
- `src/app/(main)/home/page.tsx` es `"use client"`; su HTML servido es un shell
  vacío con cero tarjetas de lugar.
- El único enlace a un lugar en todo el código es `<a href="/place/${id}">`
  dentro de `src/components/map/PlacePopup.tsx:48`, que vive dentro de un popup
  de Leaflet — renderizado solo en cliente.

Arquitectura propuesta: cuatro rutas de servidor bajo `src/app/lugares/`, con
`generateStaticParams` y `generateMetadata`. Se ubican **fuera** del grupo
`(main)`, que es `"use client"` y monta `PlacesProvider` + `SearchProvider`;
heredarlo cargaría JavaScript de proveedores en páginas que no lo necesitan,
costo directo contra el objetivo de performance (§14) dado el contexto de
conectividad en Cuba.

---

## 7. Programmatic SEO

**Estado: sin cubrir (P1 — cubierto por el plan).**

No existe ninguna página derivada de datos. Con los 30 lugares reales se generan
aproximadamente 45 URLs sin thin content:

- 1 índice de lugares
- 1 página de ciudad
- 8 páginas de categoría (solo las categorías con al menos 1 lugar)
- 30 fichas de lugar

El brief prohíbe generar miles de páginas thin. 45 URLs con contenido real y
único está muy por debajo de cualquier umbral de riesgo.

---

## 8. Páginas de lugares

**Estado: existen pero no son indexables (P0).**

La ficha de lugar existe (`src/components/place/place-detail.tsx`, 542 líneas,
con carrusel, menú, horarios, métodos de pago y acciones) pero **solo se
renderiza tras hidratar desde `localStorage`**. Los buscadores ven
"Lugar no encontrado".

Datos reales disponibles por lugar que la ficha puede exponer sin inventar nada:

| Dato | Campo | Disponible |
|---|---|---|
| nombre | `name` | Sí, 30/30 |
| categoría | `category` | Sí, 30/30 |
| descripción | `description` | Sí, 30/30 |
| dirección | `address` | Sí, 21/30 (9 vacíos) |
| ubicación | `lat` / `lng` | Sí, 30/30, verificadas |
| zona | `barrio` | Sí, 28/30 |
| horarios | `schedule` | Sí, texto libre |
| precio | `priceLabel` | Sí, 30/30 |
| métodos de pago | `payments` | Sí, 30/30 |
| imágenes | `slides` | **No** — degradados, no fotos reales |
| menú | `menu` | **No** — `[]` en las 30 filas |
| reseñas | — | **No existen** |
| teléfono / web / redes | — | **No existen en el modelo** |

Consecuencia directa para Structured Data: sin teléfono, web, imágenes reales,
menú ni reseñas, el markup debe limitarse a nombre, descripción, dirección,
coordenadas, categoría y rango de precio.

---

## 9. Indexación

**Estado: sin cubrir (P0).**

Verificado: no existe `src/app/robots.ts`, ni `src/app/sitemap.ts`, ni carpeta
`public/`. `src/middleware.ts` es un no-op que siempre llama a `NextResponse.next()`.

**Recomendado indexar:** ficha de lugar, páginas de categoría, página de ciudad,
índice de lugares, landing.

**Recomendado no indexar:** `/admin`, `/api`, `/onboarding`, `/profile`,
`/business`, `/login`, `/register`, y la ruta legacy `/place/[id]`.

**Atención:** las búsquedas del usuario y su historial privado hoy no se exponen
en ninguna URL, así que no hay riesgo actual. Debe seguir siendo así.

`/place/[id]` requiere tratamiento especial: es una ruta viva con contenido real
para el usuario, pero no puede generar metadata (es client component) y
duplicaría la URL canónica nueva. La solución de menor costo es
`X-Robots-Tag: noindex, follow` vía `headers()` en `next.config.ts`. La
alternativa —partir la página en un wrapper de servidor— **no funciona**: el
wrapper no puede conocer el lugar, porque los datos viven en `localStorage`, así
que no podría emitir canonical ni `generateMetadata` ni `notFound()`.

---

## 10. Rendering

**Estado: crítico (P0).**

- Único server component real: `src/app/page.tsx` (landing), y **todos sus hijos
  son `"use client"`** (`src/components/landing/*.tsx`). El HTML servido de la
  landing no contiene datos.
- `src/app/(main)/home/page.tsx`, `place/[id]`, `business`, `onboarding`,
  `login`, `register`: todos `"use client"`.
- El mapa **ya está bien aislado**: `src/components/map/MapView.tsx` usa
  `dynamic(..., { ssr: false })` con fallback de spinner, y el CSS de Leaflet se
  importa dentro de ese chunk lazy, no globalmente. El mapa **no bloquea** la
  carga inicial. Esto está bien resuelto y no requiere cambios.
- No existe ningún `generateMetadata`, `generateStaticParams` ni
  `export const revalidate` en todo `src/`.

La corrección es añadir rutas de servidor nuevas (sección 6) sin desmontar el
mapa, que funciona correctamente como experiencia interactiva.

---

## 11. Structured Data

**Estado: cero (P0).** No hay ni un solo bloque JSON-LD en el proyecto.

Mapeo categoría → tipo schema.org, solo con tipos apropiados:

| Categoría | Tipo schema.org |
|---|---|
| Restaurante | `Restaurant` |
| Cafetería | `CafeOrCoffeeShop` |
| Bar | `BarOrPub` |
| Vida nocturna | `NightClub` |
| Mercado / Tienda | `Store` |
| Servicio / Otro | `LocalBusiness` |
| Hospedaje | `LodgingBusiness` |
| Cultura / Naturaleza / Playa | `TouristAttraction` |

Además: `BreadcrumbList` en las cuatro rutas y `WebSite` + `Organization` una vez.

**Restricciones que deben respetarse (el brief las exige y son riesgo real):**

- **No emitir `aggregateRating`.** El campo `rating` (4.7, 4.3…) es dato de
  muestra sin reseñas reales detrás. Emitirlo es violación de las políticas de
  datos estructurados de Google y riesgo de acción manual. La interfaz puede
  seguir mostrándolo; el markup no puede afirmarlo.
- **No emitir `openingHours`.** `schedule` es texto libre en español ("Todo el
  día", "De noche"), no una especificación parseable.
- **No emitir `SearchAction`.** `/api/search` es un stub que devuelve
  `{ results: [], reasoning: "Función de búsqueda por implementar" }`. Apuntar un
  `SearchAction` a un endpoint muerto es riesgo de penalización.
- **No emitir** `telephone`, `image`, `hasMenu`, `servesCuisine`, `review`: no
  existe el dato.

---

## 12. AEO

**Estado: no cubierto (P1 — cubierto por el plan).**

Hoy, un motor de respuesta que rastree La Verde no puede extraer:

- **Qué es** — la landing lo dice en prosa, sin entidades marcadas.
- **Dónde opera** — no está declarado en ninguna parte. Los 30 lugares están en
  Santiago de Cuba pero el sitio en ningún momento lo afirma de forma
  estructurada.
- **Qué lugares contiene** — inaccesible: no están en el HTML servido.
- **Cómo funciona** — solo en la landing, en prosa.
- **Qué la diferencia** — solo en la landing, en prosa.

La corrección viene de las páginas de catálogo más `WebSite`/`Organization` y
`BreadcrumbList`, que dan la jerarquía explícita.

---

## 13. Entity SEO

**Estado: no cubierto (P1 — cubierto por el plan).**

No existe ninguna relación explícita entre ciudad, categoría, zona y lugar. Las
entidades viven únicamente como datos sueltos en `localStorage`.

Arquitectura de entidades propuesta:

```
Ciudad → categoría → lugar
Lugar  → categoría → ubicación → rango de precio → métodos de pago
```

Materializada mediante breadcrumbs (HTML + `BreadcrumbList`) y enlaces internos
reales entre niveles. **No se materializa el nivel de zona** por la razón de thin
content explicada en la sección 5.

---

## 14. Internal Linking

**Estado: crítico, sin cubrir (P0).**

Verificado: `src/components/layout/header.tsx` tiene esencialmente **un solo
enlace**, `<Link href="/home">` en el logo. No hay menú de navegación.
`src/components/layout/footer.tsx` tiene anclas `#` y `<a href="/business">`, más
dos `href="#"` muertos para Privacidad y Términos.

Dos oportunidades de costo cero ya que **ambos archivos son server components**
(verificado: ninguno tiene la directiva `"use client"`):

1. **`src/app/page.tsx`** (landing, server component) — añadir una sección con
   `<Link>` reales a cada categoría con lugares y a los lugares principales. Este
   es el cambio de mayor impacto del plan: mete la ruta de crawl completa en el
   HTML servido de la página que los buscadores ya conocen.
2. **`src/components/layout/footer.tsx`** — columna "Explorar" con enlaces a
   `/lugares`, la ciudad y cada categoría con lugares.

Los `href="#"` de Privacidad y Términos **deben quedarse como están**: esas
páginas no existen y enlazar a un 404 es peor que un ancla muerta.

---

## 15. Discovery por necesidad

**Estado: no existe (P2).**

No hay ninguna landing de tipo "Dónde...", "Qué hacer...", "Algo barato...",
"Cerca de...", "Que acepte...".

Bloqueador real: `schedule` y `payments` no están normalizados. `schedule` es
texto libre y `payments` es un array de códigos de moneda (`["CUP"]`,
`["USD","MLC"]`), no de métodos de pago. Construir estas landings hoy implicaría
interpretar texto libre y producir afirmaciones no verificables, lo que el brief
prohíbe.

**Recomendación:** normalizar ambos campos primero (P2), y solo entonces crear
las landings.

---

## 16. Performance

**Estado: parcialmente resuelto; falta medición (P2).**

**Lo que ya está bien:**

- El mapa está aislado con `dynamic(..., { ssr: false })` y no bloquea la carga
  inicial (`src/components/map/MapView.tsx`).
- El CSS de Leaflet se importa por componente dentro del chunk lazy, no en el
  bundle inicial.
- Las fuentes usan `next/font/google` con `preload: false` para el mono.
- El `<img>`/imágenes remotas usan `next/image` con `remotePatterns` restringidos
  en `next.config.ts`.

**Lo que falta:**

- No hay medición de Core Web Vitals. Sin analytics (sección 19) no hay datos.
- El bundle de la ruta `/home` carga `PlacesProvider` + `SearchProvider` en el
  layout `(main)`, que es `"use client"`.
- Degradación elegante: si el JavaScript falla, `/home` y `/place/[id]` no
  muestran nada útil. Las nuevas rutas de `/lugares` sí, por ser server
  components sin dependencia de JS.

No se puede auditar performance con números sin instrumentación. Se registra como
pendiente P2 con la recomendación de medir antes de optimizar.

---

## 17. Social Discovery

**Estado: sin cubrir (P1 — cubierto por el plan).**

Verificado: **no hay ni una sola etiqueta Open Graph ni Twitter Card en todo el
proyecto.** La única referencia es `siteConfig.ogImage = "/og.png"` en
`src/config/site.ts:6`, que apunta a un archivo **que no existe** (no hay carpeta
`public/`).

Cualquier enlace compartido de La Verde se muestra hoy como un enlace sin imagen
ni descripción.

El brief pide priorizar contenido tipo "5 lugares en La Habana para una cita
tranquila" sobre "Usa La Verde". Con los datos reales disponibles, la versión
honesta es por categoría y ciudad ("Restaurantes en Santiago de Cuba
recomendados por La Verde"), no por ocasión — la ocasión no es un dato que
exista.

---

## 18. Conversión

**Estado: parcial (P2).**

Elementos de conversión presentes en la ficha de lugar
(`src/components/place/place-detail.tsx`): compartir, guardar, ver menú,
navegar al mapa, oferta especial.

**Hallazgo:** en `src/app/(main)/place/[id]/page.tsx` los handlers están vacíos:

```tsx
onShare={() => {}}
onMenuSeeAll={() => {}}
```

Compartir y ver menú completo **no hacen nada**. El botón de navegación
(`router.push('/home?lugar=...')`) sí funciona.

No existe llamada telefónica ni WhatsApp, porque el modelo de datos no tiene
teléfono (§8).

---

## 19. Analytics

**Estado: no instrumentado (P2).**

Verificado: no hay ninguna integración de analytics. `.env.example` trae
`NEXT_PUBLIC_POSTHOG_KEY` y `NEXT_PUBLIC_GA_ID` **comentados** con la etiqueta
`# ─── Analytics (post-MVP) ───`.

No se puede definir ni verificar ningún evento de adquisición, búsqueda, consulta
a IA, vista de lugar, filtro, clic, share, llamada, WhatsApp, registro o
conversión sin instrumentación previa.

**Nota importante:** el brief prohíbe inventar estadísticas. Este informe no
reporta ninguna métrica de tráfico, indexación, backlinks o citas de IA, porque
no existe ninguna fuente para obtenerlas.

---

## 20. Modelo de negocio

**Estado: panel de negocio con datos no reales (P2).**

`src/app/(main)/business/page.tsx` es un panel de demostración con datos
**hardcodeados** (`CHART_DATA`, `"St. Pauli"` como ejemplo). `usePlaces()` no se
usa ahí.

Esto es coherente con el principio del brief —"No es publicidad pagada: lo bueno
aparece porque lo merece"— porque no hay ningún mecanismo de pago implementado ni
de priorización por pago distinta de `isBoosted`, que sí existe en el modelo
(`UserPlace.isBoosted`, `boostExpiresAt`) pero **lo controla el administrador, no
un pago**.

Riesgo a vigilar: `isBoosted` sí altera el orden y añade la etiqueta "Destacado"
en `place/[id]/page.tsx`. Si en el futuro se ordena el catálogo público por ese
campo, entraría en tensión con el principio del brief. Registrado como nota.

---

## 21. ASO

**Estado: no aplica.**

Coincidiendo con el brief: La Verde es web y no existe aplicación móvil nativa.
No hay `manifest.json`, ni service worker, ni configuración PWA. No se prepara
arquitectura futura porque no aporta valor hoy.

---

## 22. Seguridad

Prioridad transversal. Se auditaron autenticación, autorización, endpoints,
exposición de datos, formularios, secretos, headers y dependencias.

### P0 — Fuga de datos en `/api/places`

**Problema.** `src/app/api/places/route.ts` y `src/app/api/places/[id]/route.ts`
no tienen autenticación, ni rate limiting, ni `try/catch`, y ejecutan
`db.select()` **sin proyección**.

**Impacto.** Cualquiera que acierte la ruta obtiene la tabla completa, incluidas
columnas que no deberían salir del servidor: `createdBy` (FK a `users`), `phone`,
`website`, `hoursJson`, además de filas con `isActive = false` y `status =
"closed"`.

**Evidencia.** En `route.ts`:

```ts
let query = db.select().from(places).$dynamic();   // sin proyección
if (city) query = query.where(eq(places.city, city));
if (category) query = query.where(eq(places.categoryId, category));
query = query.limit(limit);                        // limit sin validar
```

**Bugs adicionales verificados en el mismo archivo:**

| Bug | Detalle |
|---|---|
| `limit` sin validar | `?limit=abc` produce `NaN` y llega a `.limit(NaN)`; `?limit=-5` también pasa |
| `category` mal comparado | se compara contra `places.categoryId` (id interno), no contra el slug que un cliente enviaría |
| `lat` / `lng` muertos | se leen de `searchParams` y **nunca se usan** |
| Sin `try/catch` | un error de DB se convierte en rechazo no manejado |

**Nota adicional:** ninguna de las dos rutas se usa realmente. La app lee de
`localStorage`; no hay ni una referencia a `/api/places` en todo el código. Son
superficie de ataque sin consumidor.

### Hallazgos de seguridad adicionales

| Hallazgo | Severidad | Nota |
|---|---|---|
| Rutas de administración sin rate limiting | P2 | `isAdminRequest` protege, pero `ai-providers/test` permite disparar peticiones salientes arbitrarias con la clave almacenada |
| Claves de proveedores de IA en texto plano | P2 | `data/ai-providers.json` (gitignoreado, fuera del repo, pero en texto plano en el filesystem) |
| Waitlist con PII en texto plano | P2 | `data/waitlist.json`, datos de contacto de negocios |
| Escritura en filesystem en serverless | P2 | `writeProviders` / `writeWaitlist` usan `process.cwd()`; en Vercel el FS es de solo lectura y falla |
| `rateLimit` es un Map en memoria | P3 | Por instancia; en serverless es best-effort y no frena un ataque distribuido |
| `src/middleware.ts` | P3 | No-op con matcher amplio; cuesta una invocación por request sin aportar nada |

### Lo que está bien

- **Headers de seguridad completos** en `next.config.ts`: CSP, HSTS (prod),
  `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy` con `geolocation=(self)`.
- **La clave de administración se compara con `timingSafeEqual`** y falla en
  seco si `ADMIN_KEY` no está configurada — sin fallback por defecto
  (`src/lib/admin-server.ts`).
- **El endpoint de IA sanea roles**: `sanitizeMessages` rechaza cualquier rol
  `"system"` enviado por el cliente y acota longitud y número de mensajes.
- **Rate limiting presente** en `/api/ai` (20/min), `/api/ai/search` (15/min),
  `/api/waitlist` (3/hora) y `/api/admin/verify` (10/15min).
- **Sin secretos expuestos en el cliente**: no hay ninguna variable sin prefijo
  `NEXT_PUBLIC_` usada desde componentes de cliente.

**No se detectaron secretos comiteados.** `.env` está en `.gitignore`, `data/`
también, y `/.clerk/` también.

---

## 23. Cambios realizados

**Ninguno.** Esta pasada se limitó a auditar y documentar, por decisión expresa.
No se modificó ni un archivo de código.

---

## 24. Archivos modificados

**Ninguno.** Este informe es el único artefacto nuevo.

---

## 25. Validaciones

No aplica: no hubo cambios que validar. Las validaciones a ejecutar tras la
implementación están especificadas en la sección *Verificación*.

---

## 26. Plan de implementación (P0 + P1)

Alcance acordado: **P0 + P1**. P2/P3 quedan documentados como pendientes.

### Decisiones tomadas

1. **Sin base de datos.** Las páginas leen `src/lib/seed-places.ts`. La DB está
   declarada pero nada la lee en runtime.
2. **Alcance P0 + P1.**
3. **Arquitectura Ciudad + categoría**, sin rutas de zona.

### Fase 0 — Prerrequisitos

- **`src/config/site.ts`** — dejar `url` env-driven con
  `process.env.NEXT_PUBLIC_APP_URL`. **No inventar dominio**: se registra como
  acción manual P0.
- **`src/lib/db/index.ts`** — `neon(process.env.DATABASE_URL!)` corre en module
  scope. Hacerlo perezoso para que el build no dependa de `DATABASE_URL`. Hoy
  `npm run build` falla sin esa variable solo por este import.

### Fase 1 — `src/lib/catalog.ts` (nuevo, server-safe)

Módulo único de acceso a datos. **Reutiliza `BUSINESS_CATEGORIES` de
`src/lib/places.ts`** — no duplicar la lista.

- `CATALOG_CITY` es una constante (`santiago-de-cuba`), **no** un array: el
  `CITIES` de `src/lib/constants.ts` lista 10 ciudades pero 9 tienen cero
  lugares; derivar rutas de ahí generaría 9 páginas vacías.
- **`id` ES el slug.** Los ids ya son kebab-case únicos (`primos-twice`,
  `casa-de-la-trova`). No añadir campo `slug`.
- `toPublicPlace()` es la **única definición** de qué campos salen del servidor.

Funciones: `categorySlug`, `categoryBySlug`, `getAllPlaces`, `getPlaceBySlug`,
`getPlacesByCity`, `getPlacesByCategory`, `getCategoriesWithCounts`,
`getActiveCities`, `absoluteUrl`, `toPublicPlace`, y los builders de URL
`urlLugares` / `urlCiudad` / `urlCategoria` / `urlLugar`.

### Fase 2 — Rutas `/lugares/*`

Cuatro server components bajo `src/app/lugares/`, **fuera** del grupo `(main)`
(que es `"use client"` y cargaría JS de proveedores innecesario).

```
src/app/lugares/layout.tsx
src/app/lugares/page.tsx
src/app/lugares/[ciudad]/page.tsx
src/app/lugares/[ciudad]/[categoria]/page.tsx
src/app/lugares/[ciudad]/[categoria]/[slug]/page.tsx
```

Con `generateStaticParams`, `generateMetadata` y `dynamicParams = false`.
Firma Next 15: `params` es una `Promise` y debe esperarse.

Componentes nuevos en `src/components/catalog/index.tsx`: `PlaceCard`,
`Breadcrumbs`, `JsonLd`, `CategoryGrid`, `ExploreLinks`.

**`PlaceCard` es nuevo, no reutiliza `src/components/layout/place-card.tsx`.**
Razón: la tarjeta existente es `"use client"` + `motion` y su acción principal es
un callback `onDetail`, **no un `<a href>`** — invisible para un crawler. Además
un server component no puede pasar funciones a un client component.

### Fase 3 — `/place/[id]` vs URL canónica

`X-Robots-Tag: noindex, follow` vía `headers()` en `next.config.ts`. No partir la
página: el wrapper de servidor no podría conocer el lugar (los datos viven en
`localStorage`), así que no podría emitir canonical ni `generateMetadata`.
`follow` y no `nofollow` es deliberado: los enlaces salientes siguen pasando
señal. Añadir el mismo tratamiento a `/admin`, `/onboarding`, `/profile`,
`/business`, `/login`, `/register`.

### Fase 4 — `robots.ts` + `sitemap.ts`

- `src/app/robots.ts` — allow `/`, disallow rutas privadas y `/place`.
- `src/app/sitemap.ts` — recorre ciudades → categorías → lugares. **Omitir
  `lastModified`**: no hay timestamp real (`createdAt` en los seeds es
  literalmente `1`, `2`, `3`), y `new Date()` afirmaría una frescura falsa.
- Filtrar `status === "closed"` del sitemap, pero **mantener esas páginas
  accesibles** para no romper enlaces entrantes.
- ~45 URLs. Sin sharding ni paginación.

### Fase 5 — `src/lib/seo.ts`

Structured data (`buildPlaceSchema`, `buildBreadcrumbSchema`,
`buildWebSiteSchema`) con el mapeo de tipos y las restricciones de la sección 11,
más `buildPageMetadata(...)` que devuelve title, description, canonical,
Open Graph y Twitter card.

`metadataBase` se añade al objeto `metadata` existente en `src/app/layout.tsx:31`,
no se crea uno nuevo.

Las descripciones se derivan de contenido real (`place.description` es una frase
real por fila), no de plantillas repetidas.

### Fase 6 — Imagen Open Graph

`src/app/opengraph-image.tsx` con `ImageResponse` de `next/og` — una sola imagen
a nivel raíz, sin assets binarios ni `public/`. Si falla en build, se quita
`images` de la metadata y se registra como acción manual. **No dejar un
`og:image` apuntando a un 404.** OG dinámica por lugar se difiere a P2.

### Fase 7 — Internal Linking

- `src/app/page.tsx` (ya es server component) — sección `<ExploreLinks />` con
  enlaces reales a categorías y lugares principales.
- `src/components/layout/footer.tsx` (ya es server component) — columna
  "Explorar". Dejar los `href="#"` existentes como están.
- `Breadcrumbs` en las cuatro rutas de `/lugares`.
- **No tocar** `header.tsx` (client component con formulario `flex-1` en el
  medio) ni `/home`.

### Fase 8 — Seguridad `/api/places`

Reescribir ambas rutas sobre `catalog.ts`. Arregla la fuga, hace que el endpoint
funcione de verdad y elimina el fallo de import por `DATABASE_URL` ausente.

| Bug | Fix |
|---|---|
| Sin proyección — filtra `createdBy`, `phone`, `website`, `hoursJson` | `toPublicPlace()` |
| `?limit=abc` → `NaN`; negativos pasan | `Number.isFinite` + clamp(1, 50) |
| `category` comparado contra `categoryId` interno | comparar contra `categorySlug(p.category)` |
| `lat`/`lng` leídos y descartados | borrar los params |
| Sin `try/catch` | try/catch → 500 JSON |
| Sin rate limit | `rateLimit(req, 60, 60_000)` |

Regla: la ruta de listado filtra `closed`; la de detalle lo devuelve con `status`
visible — un lugar cerrado conserva página viva.

### Fase 9 — Documentación

- **`docs/migracion-db.md`** — estado actual (10 tablas declaradas, cero uso), el
  punto de cambio (`catalog.ts` es el único módulo que toca datos de catálogo,
  así que migrar = reimplementar sus funciones contra `db.select()` sin tocar
  páginas ni componentes), el desajuste real a resolver (`UserPlace` no tiene
  `city` y guarda la **etiqueta** de categoría; la tabla `places` tiene `city` y
  FK `categoryId`), y que `generateStaticParams` debe pasar a ISR on-demand.
- **`INFORME_AUDITORIA_LA_VERDE.md`** — este documento.

### Archivos afectados

**Nuevos (13):** `src/lib/catalog.ts`, `src/lib/seo.ts`,
`src/components/catalog/index.tsx`, `src/app/lugares/layout.tsx`,
`src/app/lugares/page.tsx`, `src/app/lugares/[ciudad]/page.tsx`,
`src/app/lugares/[ciudad]/[categoria]/page.tsx`,
`src/app/lugares/[ciudad]/[categoria]/[slug]/page.tsx`, `src/app/robots.ts`,
`src/app/sitemap.ts`, `src/app/opengraph-image.tsx`, `docs/migracion-db.md`,
`INFORME_AUDITORIA_LA_VERDE.md`

**Modificados (10):** `src/config/site.ts`, `src/lib/db/index.ts`,
`src/lib/auth.ts`, `src/app/layout.tsx`, `next.config.ts`, `src/app/page.tsx`,
`src/components/layout/footer.tsx`, `src/components/map/PlacePopup.tsx`,
`src/app/api/places/route.ts`, `src/app/api/places/[id]/route.ts`

### Verificación

```bash
npm run typecheck   # captura la firma Promise<params> de Next 15
npm run lint
npm run build
```

En la salida de `build`, confirmar que `/lugares*` aparece como `○` (estático) o
`●` (SSG), **no** `ƒ` (dinámico). Confirmar los conteos: 1 ciudad, 8 categorías,
~30 lugares. Un `0` significa que `generateStaticParams` devolvió `[]`.

```bash
npm run start
```

```bash
# La prueba que importa: ¿el HTML servido contiene un nombre real de lugar?
curl -s http://localhost:3000/lugares/santiago-de-cuba/restaurante | grep -c "Primos Twice"

# ancla crawlable, no un handler JS
curl -s http://localhost:3000/lugares/santiago-de-cuba | grep -o 'href="/lugares/santiago-de-cuba/[a-z]*/[a-z-]*"'

# JSON-LD presente
curl -s http://localhost:3000/lugares/santiago-de-cuba/restaurante/primos-twice | grep -o 'application/ld+json'

# aggregateRating NO debe aparecer
curl -s http://localhost:3000/lugares/santiago-de-cuba/restaurante/primos-twice | grep -c "aggregateRating"

# canonical
curl -s http://localhost:3000/lugares/santiago-de-cuba/restaurante/primos-twice | grep -o '<link rel="canonical"[^>]*>'

# ruta legacy desindexada
curl -sI http://localhost:3000/place/primos-twice | grep -i "x-robots-tag"

# robots + sitemap
curl -s http://localhost:3000/robots.txt
curl -s http://localhost:3000/sitemap.xml | grep -c "<url>"

# la landing ahora enlaza al catálogo — este número era 0 antes
curl -s http://localhost:3000/ | grep -c 'href="/lugares/'

# API endurecida
curl -s "http://localhost:3000/api/places?limit=abc"           # 200 + array, no 500
curl -s "http://localhost:3000/api/places?category=restaurante" # sin createdBy/phone/website
```

Validación final manual: comprobar el JSON-LD en el Rich Results Test de Google
con una URL pública (no acepta localhost).

### Riesgos

- **`siteConfig.url` en localhost** — si se salta la Fase 0, todo canonical/OG/
  sitemap apunta a localhost en producción. Desindexa el sitio en silencio e es
  invisible en pruebas locales. Bloqueante de deploy.
- **Lugares creados desde el admin no aparecen en el catálogo público.**
  `addPlace` escribe solo en `localStorage`; `/lugares` lee `SEED_PLACES`.
  Consecuencia directa de la decisión de no usar DB. Documentado en
  `docs/migracion-db.md`.
- **Trampa de integridad de categorías.** Existen **cuatro listas de categorías
  inconsistentes**: `BUSINESS_CATEGORIES` (`src/lib/places.ts`, la viva),
  `CATEGORIES` (`src/lib/constants.ts`, sin uso), `category-bar.tsx` (incluye
  `deporte` y `transporte`, que no están en `BUSINESS_CATEGORIES`) y
  `onboarding/page.tsx` (`cafes`, `restaurantes`, ...). Si se crea un lugar con
  una etiqueta de las otras listas, `categorySlug` devuelve `"otro"` en
  silencio. Es degradación, no crash — pero real. Reconciliar las cuatro listas
  es P2.
- **`rating` fabricado se muestra pero no se marca.** Correcto, pero latente: si
  alguien añade `aggregateRating` más adelante "para arreglarlo", es riesgo de
  acción manual de Google.

---

## 27. Pendientes (P2 / P3)

| # | Pendiente | Prioridad |
|---|---|---|
| 1 | Eliminar `/place/[id]` y migrar `place-detail.tsx` a ruta de servidor | P2 |
| 2 | Renderizar `/home` en servidor (el shell del mapa es el último bloqueador) | P2 |
| 3 | Open Graph dinámica por lugar | P2 |
| 4 | `SearchAction` real cuando `/api/search` deje de ser un stub | P2 |
| 5 | Reconciliar las 4 listas de categorías inconsistentes | P2 |
| 6 | Normalizar `schedule` y `payments` → landings por necesidad | P2 |
| 7 | Reseñas reales → y solo entonces `aggregateRating` + markup `Review` | P2 |
| 8 | Analytics (PostHog/GA) y eventos de conversión | P2 |
| 9 | Rate limiting con store compartido (WAF / Redis) | P3 |
| 10 | Rate limiting en rutas de administración | P2 |
| 11 | Mover claves de IA y waitlist fuera del filesystem (serverless-safe) | P2 |
| 12 | Eliminar `src/middleware.ts` (no-op) | P3 |
| 13 | Medir Core Web Vitals antes de optimizar | P2 |
| 14 | Handlers vacíos `onShare` / `onMenuSeeAll` en la ficha de lugar | P2 |
| 15 | Landings por ocasión ("cita tranquila", "salir de noche") | P3 |

---

## 28. Acciones manuales

Estas acciones requieren acceso a plataformas externas. **No se inventa acceso
ni se dan por hechas.**

### AM-1 — Definir la URL de producción (P0, bloqueante)

1. **Plataforma:** hosting (Vercel u otro) + registrador de dominio.
2. **Objetivo:** fijar `NEXT_PUBLIC_APP_URL` con el origen público real.
3. **Paso a paso:** comprar/configurar el dominio → añadirlo al proyecto de
   hosting → crear la variable de entorno `NEXT_PUBLIC_APP_URL` en el entorno de
   producción con el valor `https://<dominio-real>` (sin barra final) → redeploy.
4. **Valor exacto:** `https://<dominio-real>` — sin barra final, con `https://`.
5. **Dónde obtenerlo:** panel del registrador (el dominio) y panel del hosting
   (la variable de entorno).
6. **Cómo verificarlo:** `curl -s https://<dominio>/sitemap.xml | head` debe
   devolver URLs con el dominio real, **no** `localhost`. Y
   `curl -s https://<dominio>/lugares | grep canonical` debe mostrar el dominio.
7. **Estado:** pendiente. **Bloquea el deploy**: sin esto, todo canonical, OG y
   sitemap apunta a localhost.

### AM-2 — Google Search Console

1. **Plataforma:** Google Search Console.
2. **Objetivo:** verificar la propiedad y enviar el sitemap.
3. **Paso a paso:** alta de la propiedad por prefijo de URL o por registro DNS →
   verificación → sección *Sitemaps* → enviar `sitemap.xml` → sección *Inspección
   de URLs* para las páginas principales.
4. **Valor exacto:** `https://<dominio-real>/sitemap.xml`
5. **Dónde obtenerlo:** `search.google.com/search-console`.
6. **Cómo verificarlo:** el sitemap debe aparecer como *Correcto* con el número
   de URLs detectadas cercano al total generado.
7. **Estado:** pendiente. **Requiere AM-1 completada primero.**

### AM-3 — Validación de datos estructurados

1. **Plataforma:** Rich Results Test de Google.
2. **Objetivo:** confirmar que el JSON-LD es válido y elegible.
3. **Paso a paso:** abrir la herramienta → introducir la URL de una ficha de
   lugar → ejecutar → revisar los tipos detectados.
4. **Valor exacto:** `https://<dominio-real>/lugares/santiago-de-cuba/restaurante/primos-twice`
5. **Dónde obtenerlo:** `search.google.com/test/rich-results`.
6. **Cómo verificarlo:** debe detectarse el tipo `Restaurant` con nombre,
   dirección y coordenadas. **`aggregateRating` NO debe aparecer** — si aparece,
   algo lo está emitiendo y hay que corregirlo.
7. **Estado:** pendiente. La herramienta **no acepta localhost**.

### AM-4 — Analytics

1. **Plataforma:** PostHog o Google Analytics 4.
2. **Objetivo:** instrumentar adquisición, búsquedas, consultas a IA, vistas de
   lugar, filtros, clics, shares y conversiones.
3. **Paso a paso:** crear el proyecto → obtener la clave pública → activar la
   variable en `.env` (las plantillas ya están comentadas en `.env.example`) →
   instalar el SDK → definir los eventos.
4. **Valor exacto:** `NEXT_PUBLIC_POSTHOG_KEY=phc_xxx` o
   `NEXT_PUBLIC_GA_ID=G-xxxxx`
5. **Dónde obtenerlo:** panel de PostHog o de Google Analytics.
6. **Cómo verificarlo:** debe registrarse una visita propia en tiempo real.
7. **Estado:** pendiente, P2. No es bloqueante.

### AM-5 — Bing Webmaster Tools

1. **Plataforma:** Bing Webmaster Tools.
2. **Objetivo:** verificar la propiedad y enviar el sitemap.
3. **Paso a paso:** alta → importar desde Search Console si ya existe (AM-2) →
   enviar el sitemap.
4. **Valor exacto:** `https://<dominio-real>/sitemap.xml`
5. **Dónde obtenerlo:** `bing.com/webmasters`.
6. **Cómo verificarlo:** el sitemap debe aparecer como procesado.
7. **Estado:** pendiente, P3. Depende de AM-1.

### AM-6 — Imagen Open Graph

1. **Plataforma:** ninguna (build del proyecto).
2. **Objetivo:** que exista una imagen social válida.
3. **Paso a paso:** la Fase 6 del plan genera la imagen en build con
   `next/og`. Si falla, crear a mano `public/og.png` de 1200×630.
4. **Valor exacto:** 1200×630 px, PNG, ruta `/og.png` o `/opengraph-image`.
5. **Dónde obtenerlo:** diseñar en cualquier editor; o generarla la Fase 6.
6. **Cómo verificarlo:** pegar la URL pública en un validador de Open Graph (o
   enviarla por WhatsApp/Telegram) y confirmar que aparece la tarjeta con imagen.
7. **Estado:** pendiente. P1.

### AM-7 — Revisión de seguridad de headers

1. **Plataforma:** cualquier escáner de cabeceras HTTP.
2. **Objetivo:** confirmar CSP, HSTS y el resto de cabeceras en producción.
3. **Paso a paso:** escanear la URL de producción tras el deploy.
4. **Valor exacto:** URL raíz del sitio.
5. **Dónde obtenerlo:** `securityheaders.com` o equivalente.
6. **Cómo verificarlo:** deben aparecer `Content-Security-Policy` y
   `Strict-Transport-Security` (solo se aplican con `NODE_ENV=production`) y
   `X-Robots-Tag: noindex, follow` en `/place/<id>`.
7. **Estado:** pendiente.

---

## 29. Roadmap priorizado

### P0 — Crítico

1. `NEXT_PUBLIC_APP_URL` en producción (**AM-1**, bloqueante).
2. `src/app/robots.ts` + `src/app/sitemap.ts`.
3. Rutas `/lugares/*` renderizadas en servidor (arquitectura ciudad → categoría → lugar).
4. Fichas de lugar indexables con `generateStaticParams` + `generateMetadata`.
5. Structured Data (JSON-LD) con las restricciones de la sección 11.
6. Internal linking: landing + footer + breadcrumbs.
7. Seguridad `/api/places` (proyección, validación, rate limit, try/catch).

### P1 — Alto

8. `metadataBase`, canonical, Open Graph y Twitter cards en todas las páginas.
9. Imagen Open Graph.
10. AEO: `WebSite` + `Organization` + descripciones derivadas de contenido real.
11. Entity SEO materializado vía breadcrumbs y enlaces entre niveles.
12. `X-Robots-Tag: noindex, follow` en `/place/[id]` y rutas privadas.
13. Google Search Console (**AM-2**) y validación de structured data (**AM-3**).

### P2 — Medio

14. Renderizar `/home` en servidor.
15. Eliminar `/place/[id]` y migrar la ficha a ruta de servidor.
16. Reconciliar las 4 listas de categorías.
17. Normalizar `schedule` y `payments`.
18. Landings por necesidad.
19. Analytics (**AM-4**) y eventos de conversión.
20. OG dinámica por lugar.
21. Rate limiting en rutas de administración.
22. Mover claves de IA y waitlist fuera del filesystem.
23. Medir Core Web Vitals.
24. Handlers vacíos `onShare` / `onMenuSeeAll`.

### P3 — Mejora

25. Rate limiting con store compartido (WAF / Redis).
26. Eliminar `src/middleware.ts` (no-op).
27. Bing Webmaster Tools (**AM-5**).
28. Landings por ocasión.
29. **AM-7** — revisión de headers de seguridad.

---

## 30. Restricciones respetadas

Este informe cumple las restricciones del brief:

- **No se inventó ningún negocio, horario, precio, moneda, método de pago,
  reseña, estadística, indexación, backlink ni cita de IA.** Todo dato citado
  proviene de `src/lib/seed-places.ts` o de archivos leídos directamente.
- **No se reporta ninguna métrica de tráfico, indexación o backlinks** porque no
  existe fuente para obtenerlas (no hay analytics instrumentado).
- **No se propone thin content.** El nivel de zona se descartó explícitamente por
  ese motivo.
- **No se expusieron secretos.** Los valores de `.env` no se transcriben en este
  documento.

**Objetivo final del brief:**
`NECESIDAD → DISCOVERY → SEO → AEO/IA → LA VERDE → EXPLORACIÓN → RECOMENDACIÓN → ACCIÓN → RETENCIÓN`

Estado actual: el tramo `SEO → LA VERDE` está roto. La plataforma **no es
alcanzable desde un buscador**. La implementación P0+P1 del plan de la sección 26
es lo que abre ese tramo.
