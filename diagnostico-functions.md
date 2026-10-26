# Diagnóstico del peso de las funciones serverless

Fecha: 2026-10-26 · Next.js 16.3.5 · Turbopack · `next build` local (Windows 11) · Sin deploy.

## Resumen ejecutivo

- **No hay riesgo de límite.** La función más pesada mide **17,05 MB**; la media, **7,61 MB**. El límite de una función en Vercel Hobby es **250 MB sin comprimir**, así que el margen es de más de 14×.
- **El peso es casi todo de dos paquetes compartidos:** `sharp` (**9,15 MB**, presente en 43 de 111 funciones) y el runtime de `@vercel/og` (**3,07 MB**, en 38 funciones). El resto del peso es el runtime de Next.
- **No hay archivos propios grandes** (JSON, imágenes, fuentes) dentro de los bundles. Lo que hay son binarios de terceros: el `.wasm` de sharp (8,58 MB), `resvg.wasm` (1,31 MB) y una fuente de 0,12 MB.
- **Sí hay trabajo de caché:** 93 rutas dinámicas (30 páginas, 63 API). Varias páginas públicas usan `force-dynamic` o `getAppUser()` cuando podrían ser ISR.

### Método y advertencia

No hay `.vercel/project.json`: `vercel build` pediría login y proyecto vinculado, así que no se intentó por no ser reproducible en esta máquina. En su lugar se analizaron los **`.nft.json`** que genera `next build` en `.next/server/` — son exactamente los trazados de `@vercel/nft` que Vercel usa para decidir qué archivos entran en cada función. Cada tamaño es la suma de archivos únicos trazados para esa ruta.

**Aviso de plataforma:** este build es de Windows. Traza `@img/sharp-wasm32` (8,58 MB) y `@img/sharp-win32-x64` (0,42 MB). En Vercel (Linux x64) se trazará `@img/sharp-linux-x64` en su lugar; el tamaño será parecido o algo mayor (~9–11 MB). Los números de sharp sirven para identificar el problema, no como cifra exacta del despliegue.

---

## a. Las 20 funciones más pesadas

| # | Función | Tamaño |
|---|---|---:|
| 1 | `/business` | 17,05 MB |
| 2 | `/admin/negocios/[id]/editar` | 16,85 MB |
| 3 | `/admin/negocios/nuevo` | 16,83 MB |
| 4 | `/place/[id]` | 16,83 MB |
| 5 | `/projects` | 16,82 MB |
| 6 | `/admin/solicitudes` | 16,78 MB |
| 7 | `/admin` | 16,75 MB |
| 8 | `/admin/negocios` | 16,75 MB |
| 9 | `/admin/categorias` | 16,74 MB |
| 10 | `/enlaces` | 16,74 MB |
| 11 | `/admin/publicaciones` | 16,74 MB |
| 12 | `/admin/analytics` | 16,74 MB |
| 13 | `/admin/proyectos` | 16,73 MB |
| 14 | `/admin/negocios/[id]/importar` | 16,73 MB |
| 15 | `/admin/proveedores-ia` | 16,72 MB |
| 16 | `/admin/planes` | 16,72 MB |
| 17 | `/admin/usuarios` | 16,72 MB |
| 18 | `/admin/soporte` | 16,72 MB |
| 19 | `/admin/notificaciones` | 16,71 MB |
| 20 | `/login` | 16,67 MB |

Las API más pesadas quedan por debajo, pero son las únicas que usan sharp **a propósito**:

| Función | Tamaño |
|---|---:|
| `/api/places/[id]/images` | 13,42 MB |
| `/api/places/[id]/menu-image` | 13,41 MB |
| `/api/places/[id]/logo` | 13,41 MB |
| `/api/admin/publicaciones/[id]/imagen` | 13,41 MB |
| `/api/business/publicaciones/imagen` | 13,41 MB |
| `/api/project-requests/[id]/images` | 3,49 MB |

Total trazado de las 111 funciones: 844,28 MB (suma; cada función se despliega por separado).

---

## b. Archivos más grandes dentro de las 5 funciones más pesadas

Las cinco comparten prácticamente la misma lista. Se muestra la de `/business` (17,05 MB); las otras cuatro varían menos de 0,6 MB.

| Tamaño | Archivo |
|---:|---|
| 8,58 MB | `node_modules/@img/sharp-wasm32/lib/sharp-wasm32-0.35.4.node.wasm` |
| 1,31 MB | `node_modules/next/dist/compiled/@vercel/og/resvg.wasm` |
| 0,83 MB | `node_modules/next/dist/compiled/@vercel/og/index.node.js` |
| 0,70 MB | `node_modules/next/dist/compiled/@vercel/og/index.edge.js` |
| 0,66 MB | `node_modules/next/dist/compiled/next-server/app-page-turbo.runtime.prod.js` |
| 0,42 MB | `node_modules/@img/sharp-win32-x64/lib/sharp-win32-x64-0.35.4.node` |
| 0,39 MB | `.next/server/chunks/ssr/src_lib_auth_client_ts_1c5njno._.js` |
| 0,29 MB | `.next/server/chunks/ssr/node_modules_posthog-js_dist_module_mjs_1q3iz1x._.js` |
| 0,26 MB | `.next/server/chunks/ssr/_1ho9lo3._.js` |
| 0,18 MB | `.next/server/chunks/ssr/[root-of-the-server]__1f3w1ok._.js` |
| 0,17 MB | `.next/server/chunks/ssr/_1vyq693._.js` |
| 0,16 MB | `.next/server/chunks/ssr/_04xp67n._.js` |
| 0,15 MB | `node_modules/@img/sharp-wasm32/lib/sharp-wasm32-0.35.4.node.js` |
| 0,12 MB | `.next/server/chunks/ssr/node_modules_13hhvxi._.js` |
| 0,12 MB | `node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf` |

Diferencias entre las cinco: solo cambia el chunk SSR específico de la ruta (`_1jiik0m._.js` en `/place/[id]`, `node_modules_0rmzlrr._.js` en las de admin, etc.). El 90 % del peso es idéntico.

---

## c. Paquetes repetidos en muchas funciones

| Paquete | Funciones | Peso máximo trazado |
|---|---:|---:|
| `@img/sharp-wasm32` (+ `sharp-win32-x64`) | 43 / 111 | **9,15 MB** |
| `next/dist/compiled/@vercel/og` | 38 / 111 | **3,07 MB** |
| `next` (runtime app-page + Next server) | 111 / 111 | **4,48 MB** |
| `@aws-sdk/client-s3` | 6 / 111 | 0,68 MB |
| `@opentelemetry/*` | 0 / 111 | — |
| `@neondatabase/*` | 0 / 111 | — |

Solo `sharp` supera los 5 MB, y lo hace en el 39 % de las funciones. No es casualidad: `src/lib/storage/optimize.ts` importa sharp directamente y, además, `next/image` arrastra el optimizador en toda página que lo use. Las 38 páginas con `@vercel/og` lo llevan por las rutas `opengraph-image`.

---

## d. Archivos no-JS grandes dentro de los bundles

| Tamaño | Archivo | Origen |
|---:|---|---|
| 8,58 MB | `@img/sharp-wasm32/lib/sharp-wasm32-0.35.4.node.wasm` | binding wasm de sharp (sustituido por el nativo en Linux) |
| 1,31 MB | `next/dist/compiled/@vercel/og/resvg.wasm` | render de OG images |
| 0,12 MB | `next/dist/compiled/@vercel/og/Geist-Regular.ttf` | fuente de OG images |

No hay JSON, imágenes ni fuentes **del proyecto** dentro de los bundles. El chunk propio más grande es de 0,58 MB (`chunks/[root-of-the-server]__09k_q8k._.js`).

---

## e. Configuración de Vercel

`vercel.json` existe y solo declara un cron; no hay `.vercelignore`.

```json
{
  "crons": [
    { "path": "/api/cron/analytics", "schedule": "0 3 * * *" }
  ]
}
```

No hay límites de `maxDuration`, región ni `functions` configurados: todo va con los valores por defecto de Hobby.

---

## f. `package.json` actual

`dependencies` (43 entradas):

`@ai-sdk/openai`, `@aws-sdk/client-s3`, `@neondatabase/auth`, `@neondatabase/serverless`, 8 paquetes `@radix-ui/*`, `@types/leaflet`, `ai`, `autoprefixer`, `class-variance-authority`, `clsx`, `drizzle-orm`, `leaflet`, `lucide-react`, `motion`, `nanoid`, `next`, `next-themes`, `postgres`, `posthog-js`, `react`, `react-dom`, `react-leaflet`, `react-qr-code`, `resend`, `sharp`, `sileo`, `sonner`, `tailwind-merge`, `tailwindcss-animate`, `typescript`, `web-push`, `zod`, `zustand`.

`devDependencies`: `@types/node`, `@types/react`, `@types/react-dom`, `drizzle-kit`, `postcss`, `prettier`, `prettier-plugin-tailwindcss`, `tailwindcss`, `tsx`.

Hay tres paquetes de desarrollo declarados como producción: `typescript`, `autoprefixer` y `@types/leaflet`.

---

## g. Top 20 de `node_modules` en disco

| Tamaño | Paquete |
|---:|---|
| 224 MB | `next` |
| 102 MB | `@next` |
| 78 MB | `@neondatabase` |
| 41 MB | `lucide-react` |
| 28 MB | `@img` |
| 23 MB | `typescript` |
| 20 MB | `posthog-js` |
| 16 MB | `drizzle-orm` |
| 12 MB | `tsx` |
| 12 MB | `@opentelemetry` |
| 11 MB | `sileo` |
| 10 MB | `prettier` |
| 10 MB | `@esbuild` |
| 10 MB | `@esbuild-kit` |
| 9 MB | `@aws-sdk` |
| 8 MB | `react-dom` |
| 8 MB | `drizzle-kit` |
| 8 MB | `ai` |
| 8 MB | `@instantdb` |
| 7 MB | `core-js` |

El tamaño en disco no equivale al peso de la función: `lucide-react` (41 MB) no aparece en ninguna traza porque el bundler solo incluye los iconos importados. Lo mismo con `posthog-js` en el servidor (0,29 MB). Lo que importa es lo de la sección (c).

---

## h. Rutas dinámicas y candidatas a estáticas/ISR

**93 rutas marcadas ƒ**: 30 páginas y 63 endpoints de API. Además, `Proxy (Middleware)` (1,95 MB) corre como función aparte en runtime Node.

Estáticas hoy: `/`, `/home`, `/profile`, `/notifications`, `/onboarding`, `/forgot-password`, `/restablecer-contrasena`, `/terminos`, `/robots.txt`, `/sitemap.xml`, iconos y manifest.

Páginas públicas dinámicas que podrían cachearse (solo listado, no se cambió nada):

| Ruta | Por qué es dinámica hoy | Candidata a |
|---|---|---|
| `/m/[slug]` | declara `revalidate = 300` pero llama a `getAppUser()` en la rama del lugar demo; eso fuerza ƒ | ISR 300 s real |
| `/place/[id]` | `getAppUser()` en la rama del lugar demo | ISR |
| `/place/[id]/carta` | hereda del detalle | ISR |
| `/ranking` | `export const dynamic = "force-dynamic"` explícito | ISR 5–10 min |
| `/enlaces` | `force-dynamic` + `getAppUser()` | shell estático + comprobación en cliente |
| `/projects` | `getAppUser()` en el cuerpo de la página | shell estático + comprobación en cliente |
| `/lugares` | usa `searchParams` para filtros | dinámica por diseño; el shell podría ser estático |
| `/m/[slug]/opengraph-image`, `/place/[id]/opengraph-image` | se generan por petición | caché larga (`revalidate` alto o `immutable`) |

---

## Prueba verificada: una sola ruta OG

Rama `test/og-split`, commit `cda265b`. Se movieron las tres tarjetas a `/api/og` (sin `opengraph-image.tsx`), se declaró `images` en la metadata del layout, de `/m/[slug]` y de `/place/[id]`, y se midió con el mismo método.

| Métrica | Antes | Después |
|---|---:|---:|
| Función de página más pesada | 17,05 MB | **3,93 MB** |
| Media de las 36 páginas | ~16 MB | **3,31 MB** |
| Funciones con sharp | 43 de 111 | **6 de 109** |
| Suma de todas las funciones | 844,28 MB | **355,08 MB** |
| Funciones OG | 3 | 1 (`/api/og`, 15,33 MB) |
| `/place/[id]` | 16,83 MB | **3,71 MB** |
| `/m/[slug]` | 16,21 MB | **3,10 MB** |
| `/login` | 16,67 MB | **3,56 MB** |

Las 6 funciones que conservan sharp son las 5 rutas que procesan imágenes de verdad (`/api/places/[id]/images`, `/menu-image`, `/logo`, `/api/admin/publicaciones/[id]/imagen`, `/api/business/publicaciones/imagen`) y `/api/og`.

Dato importante: quitar **solo** la tarjeta raíz deja `/place/[id]` y `/m/[slug]` en 16,76 y 16,14 MB, porque cada una tiene su propio `opengraph-image.tsx` en el mismo segmento. Hay que quitar las tres.

`npm run typecheck` y `npm run build` pasan limpios en la rama.

---

## Recomendaciones

1. **No tocar el tamaño de las funciones por el límite.** 17 MB frente a 250 MB no justifica cirugía. Si preocupa el arranque en frío, el orden de ataque es el de abajo, no el límite.

2. **Un solo cambio ataca sharp y `@vercel/og` a la vez.** El origen no es `next/image`: es `src/app/opengraph-image.tsx`. Ese archivo se compila en un chunk raíz (`[root-of-the-server]__0dq0ntw._.js`, confirmado en su source map) que **cargan las 38 páginas**, y `@vercel/og/index.node.js` hace `await import("sharp")` para redimensionar emojis. Por eso sharp (9,15 MB) y og (3,07 MB) viajan juntos en cada página, aunque la página no pinte ni una imagen. Mover la generación a una ruta fuera del árbol de metadatos (por ejemplo `/api/og/route.ts`), borrar el `opengraph-image.tsx` raíz y apuntar `metadata.openGraph.images` a esa ruta debería dejar las páginas en **~5 MB** (de 17 MB). Ahorro estimado: **~12,2 MB por función** en 38 funciones. Hay que confirmarlo con un `next build` y conservar las rutas viejas como redirección para no romper enlaces ya compartidos.

3. **Consolidar las tres rutas OG en una sola función.** Hoy hay tres funciones que cargan og+sharp: `/opengraph-image` (14,79 MB), `/m/[slug]/opengraph-image` y `/place/[id]/opengraph-image` (15,26 MB cada una). Una sola ruta `/api/og` con caché las sustituye. Ahorro: dos funciones menos que desplegar y una sola que mantener caliente; el ahorro por función de página ya está contado en el punto 2.

4. **Mover `typescript`, `autoprefixer` y `@types/leaflet` a `devDependencies`.** No cambia el peso de las funciones (no se trazan), pero recorta la instalación del despliegue y evita que `typescript` (23 MB) se trate como runtime. Ahorro: instalación más ligera y build más rápido; **0 MB en funciones**.

5. **Convertir a ISR las rutas públicas de la sección (h).** El ahorro no es de tamaño sino de ejecuciones y latencia: `/m/[slug]`, `/place/[id]`, `/ranking`, `/enlaces` y `/projects` pueden servirse desde caché 5–10 minutos. Para `/m/[slug]` y `/place/[id]` basta sacar la rama de `getAppUser()` del render de producción (por ejemplo, a un componente cliente). Ahorro estimado: **la mayoría de las invocaciones de esas 5 rutas**; en Hobby, menos ejecuciones y menos arranques en frío.

6. **Cachear las OG images.** Hoy se generan por petición. Con `revalidate` alto, cada bot de WhatsApp/Telegram deja de costar una invocación con `resvg.wasm` cargado. Ahorro: **~3 MB de trabajo y una invocación por enlace compartido**.
