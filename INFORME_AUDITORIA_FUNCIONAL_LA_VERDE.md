# Auditoría funcional de La Verde

**Fecha:** 30 de octubre de 2026
**Rama:** `seo-audit`
**Commit base:** `92d5c87`
**Alcance:** funcionamiento, fluidez, botones y acciones del mapa, búsqueda con IA, sesión,
hoja de recomendaciones, PWA y compatibilidad con Android (Chrome / WebView) e iOS
(Safari / PWA instalada).

**Estado de este documento:** auditoría con los **P0 ya aplicados y verificados**
(actualización del 30 de octubre). Los hallazgos P1, P2 y P3 siguen pendientes y se
describen con archivo, línea y solución propuesta.

**P0 implementados:** LV-01 (header de portada con sesión y redirección de `/login`),
LV-02 (`/api/me` con `no-store` y `force-dynamic`), LV-03 (el menú limpia la sesión
caducada y se revalida al volver), LV-04 (mapa desplazado bajo el header), LV-05 (botón
de recoger, arrastre desde el encabezado y asa de 44 px), LV-06 (`invalidateSize` de
Leaflet) y LV-07 (service worker `lv-v2` sin HTML viejo con red disponible).

> **Nota importante sobre el árbol de trabajo.** Mientras se hacía esta auditoría había
> edición concurrente en el repositorio: `src/components/business/form-section.tsx`,
> `src/components/menu/*`, `src/app/m/[slug]/page.tsx`, `src/app/(main)/profile/page.tsx`,
> `src/components/profile/*`, `src/app/(main)/home/page.tsx` y el álbum de fotos en
> `Negocios/`. No se tocaron ni se revirtieron esos cambios. Las líneas citadas
> corresponden al estado auditado (base `92d5c87` más el working tree de ese momento) y
> pueden desplazarse si el trabajo en curso sigue. Antes de aplicar los parches, confirmar
> el estado real de cada archivo con `git diff`.

---

## 1. Resumen ejecutivo

La app no tiene un solo bug: tiene **tres fallos de estado** que se refuerzan entre sí y
explican la mayoría de los reportes.

1. **La portada tiene el botón «Iniciar sesión» escrito a mano.** No consulta la sesión.
   Un usuario con sesión abierta que vuelve a `/` lo ve otra vez, y al pulsarlo `/login`
   le pide la contraseña aunque ya esté dentro. Es el síntoma exacto reportado.
2. **Los chips de categoría del mapa están debajo del header.** Medido en el navegador:
   el header ocupa `y=0..60` y los chips `y=12..54`. Al tocar «Todo» el evento cae sobre el
   logo del header. En móvil la fila de categorías es inutilizable.
3. **La hoja de recomendaciones no tiene una salida explícita.** Solo se puede arrastrar
   por un asa de 4 px (20 px de zona táctil) o tocar esa misma asa. Quien intenta bajar la
   hoja empujando el titular no consigue nada, y en escritorio una regla CSS con
   `!important` anula incluso el arrastre. De ahí la sensación de «no me deja recogerla».

A eso se suman dos causas de «tengo que recargar»:

- **Leaflet nunca recalcula su tamaño.** Cuando Safari esconde la barra de URL, aparece el
  teclado o gira el teléfono, el lienzo se queda con la medida vieja: franjas grises, pines
  desplazados y mapa que no responde hasta recargar.
- **El service worker sirve HTML guardado a los 4 segundos** aunque haya conexión. En una
  red lenta de Cuba eso entrega el documento de un despliegue anterior, con chunks y
  sesión viejos. La app «se bugea» y la recarga lo arregla temporalmente.

Y un fallo de datos visible en los logs: **varias imágenes del almacenamiento responden
403** (portadas y logos), por lo que hay fichas y tarjetas con huecos.

### Conteo por severidad

| Prioridad | Cantidad | Significado |
|---|---|---|
| P0 | 7 | Rompe una tarea o explica un reporte directo |
| P1 | 8 | Dificulta mucho la tarea o incumple accesibilidad / iOS |
| P2 | 7 | Molestia con solución alternativa |
| P3 | 5 | Pulido, deuda o riesgo futuro |

### Los cinco arreglos con más impacto

1. Header de portada consciente de la sesión y `/login` que redirige si ya hay sesión.
2. Corregir el origen del mapa (`top`, no `padding-top`) para que categorías y filtros
   queden debajo del header.
3. Botón explícito de recoger/abrir la hoja y arrastre desde todo el encabezado.
4. `invalidateSize()` de Leaflet en resize, orientación y `visualViewport`.
5. Service worker: no caer a la copia guardada si hay red; subir la versión de caché.

---

## 2. Metodología y evidencia

Se combinaron cuatro fuentes:

1. **Lectura del código** de las rutas y componentes implicados (sesión, header, mapa,
   hoja inferior, PWA, service worker, perfil y onboarding).
2. **Render real en Chrome headless** contra el servidor de desarrollo en
   `http://localhost:3000`, con viewport móvil de 390 × 844, midiendo
   `getBoundingClientRect()` y `document.elementFromPoint()`.
3. **Peticiones HTTP reales** con `curl` para comprobar cabeceras de caché.
4. **Logs del servidor de desarrollo** para errores de imágenes y avisos de Node.

Comprobaciones ejecutadas:

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` | Pasa sin errores |
| `npm run lint` | No ejecutable: Next 16 eliminó `next lint` (`Invalid project directory .../lint`) |
| `GET /` | 200 |
| `GET /home` | 200 |
| `GET /login` | 200 |
| `GET /lugares` | 200 |
| `GET /api/me` | 200, **sin cabecera `Cache-Control`** |
| Medición DOM del home (390 px) | Chips tapados por el header; hoja sin botón de recoger |
| Log del servidor | Varias respuestas 403 de imágenes del bucket |

---

## 3. Diagnóstico de los síntomas reportados

| Síntoma del usuario | Causa raíz | Hallazgos |
|---|---|---|
| «Inicia sesión y el header sigue diciendo Iniciar sesión» | Portada con enlace fijo; `/login` sin redirección; `/api/me` sin `no-store`; estado del menú que no se limpia y no se revalida al volver del historial | LV-01, LV-02, LV-03 |
| «Abro recomendaciones y a veces no me deja recogerlas» | Asa de 20 px, arrastre solo en el asa, sin botón de recoger, `!important` en escritorio, hoja que nunca baja de 120 px | LV-05 |
| «Para volver a ver el mapa tengo que recargar» | Leaflet sin `invalidateSize`; HTML viejo del service worker; mapa que arranca bajo el header | LV-04, LV-06, LV-07 |
| «Se ve bugueada / secciones que no responden» | Chips de categoría bajo el header; objetivos táctiles pequeños; cierres de menú con `mousedown` que iOS a veces no emite | LV-04, LV-09, LV-10 |

---

## 4. Hallazgos P0

### LV-01. El header de la portada ignora la sesión

**Ubicación:** `src/components/landing/header.tsx:82-88` (escritorio) y `:126-132` (menú móvil).

**Evidencia:** son dos `<Link href="/login">Iniciar sesión</Link>` literales. El componente
no importa `fetchMe` ni `UserMenu`. El header de la app (`src/components/layout/header.tsx`)
sí usa `UserMenu`, pero la portada no.

**Impacto:** cualquier persona con sesión que llegue a `/` (logo, atrás, enlace compartido)
ve «Iniciar sesión». Ese es el reporte principal. En móvil ocurre lo mismo dentro del panel
lateral.

**Agravante:** `src/app/(auth)/login/page.tsx:35-40` obtiene el usuario pero solo lo usa
para el caso `motivo=rol`. Con sesión válida sigue pintando el formulario
(`<AuthCard mode="login" />`), así que el usuario vuelve a escribir su contraseña sin
necesidad.

**Solución propuesta:**

1. En `src/components/landing/header.tsx`, sustituir el enlace de escritorio por
   `<UserMenu />` (el mismo componente que ya resuelve «sin sesión / con sesión / todavía
   no se sabe»). Eliminar el enlace de acceso del panel móvil, porque la pastilla de cuenta
   ya queda visible en la barra.
2. En `src/app/(auth)/login/page.tsx`, después de `getAppUser()`:

```tsx
if (user && params.motivo !== "rol") {
  redirect(next ?? "/home");
}
```

**Verificación:** con sesión abierta, abrir `/` y comprobar que aparece el avatar y no el
botón; abrir `/login` y comprobar que redirige a `/home`.

---

### LV-02. `/api/me` se puede cachear y no lo impide nadie

**Ubicación:** `src/app/api/me/route.ts:193` y `src/lib/session-client.ts:40`.

**Evidencia:** la respuesta real de `GET /api/me` no trae `Cache-Control`:

```
HTTP/1.1 200 OK
content-type: application/json
vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
```

El `fetch("/api/me")` del cliente tampoco pide `cache: "no-store"`.

**Impacto:** Safari en iOS es el navegador que más reutiliza respuestas sin cabeceras
explícitas. Una respuesta `authenticated: false` guardada antes de entrar puede seguir
sirviendo después del login, y el header continúa mostrando «Iniciar sesión» hasta una
recarga forzada. Encaja con el reporte y con que solo pase «a veces» y en móvil.

**Solución propuesta:**

- En la ruta, devolver todas las respuestas con
  `Cache-Control: no-store, no-cache, must-revalidate` y declarar
  `export const dynamic = "force-dynamic"`.
- En `session-client.ts`, `fetch("/api/me", { cache: "no-store", credentials: "same-origin" })`.

**Verificación:** `curl -D -` debe mostrar `cache-control: no-store...`; en Safari, entrar y
volver a abrir la app sin recargar no debe mostrar el botón de acceso.

---

### LV-03. El menú de usuario conserva un usuario que ya no tiene sesión

**Ubicación:** `src/components/layout/user-menu.tsx:205-232`, `:249`.

**Evidencia:**

```tsx
if (data) setStatus("out");
```

cuando `/api/me` responde `authenticated: false` se cambia el estado, pero **no** se limpia
`user` ni `lastKnownUser`. El render decide con `if (!user && !initial)`, así que el avatar
continúa pintado y el menú ofrece «Cerrar sesión» a alguien cuya sesión ya caducó.

Además, el efecto de montaje no escucha `pageshow` ni `visibilitychange`. Safari iOS
restaura la página desde bfcache con el DOM tal cual se dejó y no vuelve a montar el
componente, de modo que el avatar o el botón se quedan congelados hasta recargar.

**Solución propuesta:**

- En la respuesta `authenticated: false`: `lastKnownUser = null; setUser(null); setStatus("out")`.
- Al restaurar desde bfcache o volver a la pestaña: `refreshSession()` y volver a pedir
  `/api/me` con `force`.
- En el fallo final por red, no convertir una sesión conocida en «sin sesión»:
  `if (!lastKnownUser) setStatus("out")`.
- Limpiar `lastKnownUser` en `handleLogout`.

**Verificación:** cerrar la sesión desde otra pestaña y volver: el avatar debe desaparecer.
Simular bfcache con atrás/adelante en Safari.

---

### LV-04. Los chips de categoría están debajo del header (inutilizables)

**Ubicación:** `src/app/(main)/home/page.tsx:1522` y `src/components/map/MapView.tsx`
(`absolute inset-0`), con `CategoryBar` en
`src/components/layout/category-bar.tsx:57` (`top-gap-sm`).

**Evidencia medida en Chrome, viewport 390 × 844 y también en escritorio:**

```
header: top 0,    bottom 60
mapa:   top 0,    bottom 844
chip:   top 12,   bottom 54
elementFromPoint(centro del chip) -> IMG del logo del header
```

La causa es concreta: el contenedor del home usa `fixed inset-0 pt-[var(--header-h)]`, pero
`MapView` es un hijo **absoluto**. Un hijo absoluto toma como origen el borde de padding,
así que el `padding-top` no lo desplaza. El mapa empieza en `y=0` y el chip a 8 px queda
detrás del header fijo (`z-200`).

**Impacto:** la fila de categorías no se ve ni se puede tocar en ningún tamaño de pantalla.
Tocar donde debería estar el chip golpea el logo y recarga el home. Es un fallo de
funcionamiento, no de estética.

**Solución propuesta:** cambiar el contenedor a un desplazamiento real:

```tsx
<div className="fixed inset-x-0 bottom-0 top-[var(--header-h)] font-lv text-ink">
```

Con eso, las posiciones internas ya existentes vuelven a tener sentido: categorías a 8 px
del borde superior del mapa, filtros a 72 px y columna de campana/tema a 110 px. Se verificó
con la corrección aplicada temporalmente: chips en `72..114`, filtros en `132..170` y
`elementFromPoint` devolviendo «Todo» y «Cercanos».

**Verificación:** medir de nuevo; el hit test del chip debe devolver el texto del chip.

---

### LV-05. La hoja de recomendaciones no tiene una forma clara y fiable de recogerse

**Ubicación:** `src/components/layout/bottom-sheet.tsx:28`, `:130`, `:143`, `:192`,
`:254-264`; `src/app/globals.css:1112`.

**Evidencia:**

- El único gesto nace en el asa: `onPointerDown` está en el `div` de 20 px de alto
  (`py-[10px]`), con una barra visible de 4 px.
- No existe botón de recoger. En el DOM medido, `sheetToggle: false`.
- El estado más bajo (`peek`) deja 120 px visibles y no hay forma de ocultarla del todo.
- Arrastrar el titular o el contenido no mueve la hoja, algo que la gente intenta por
  reflejo.
- En escritorio, `globals.css:1112` aplica
  `transform: translateY(calc(100% - 100px)) !important;`, y ese `!important` gana al
  transform en línea del arrastre: la hoja tampoco se deja empujar con el ratón.
- `PEEK_INSET` (120) y el `100px` del CSS no coinciden, así que el umbral del gesto y la
  posición de reposo no son el mismo número.

**Solución propuesta:**

1. Añadir en el encabezado un botón de 44 × 44 px con `ChevronDown`,
   `aria-label` dinámico («Recoger el panel» / «Abrir el panel») y `aria-expanded`, que
   llame a `cycleState()`.
2. Convertir todo el encabezado en zona de arrastre, ignorando los clics sobre
   `button`, `a`, `input`, etc. (`closest("button,a,input,select,textarea")`).
3. Elevar el asa a `min-h-11` (44 px).
4. Eliminar la regla `!important` de `.bottom-sheet-desktop[data-state="peek"]` y dejar que
   el componente mande con su transform en línea.
5. Añadir `overscroll-contain` al contenedor con scroll para que el gesto no encadene con
   el fondo.

**Verificación realizada con el parche temporal:** el estado pasó de `peek` a `full` y
volvió a `peek` con el botón, y el transform/rect cambiaron en consecuencia. Sin el parche,
el botón no existe.

---

### LV-06. Leaflet no recalcula su tamaño nunca

**Ubicación:** `src/components/map/MapContent.tsx` (no hay ninguna llamada a
`invalidateSize` en todo `src`, verificado con búsqueda).

**Impacto en iOS Safari y Android:**

- Al esconderse o mostrarse la barra de URL, el contenedor cambia de alto.
- Al abrir el teclado del buscador, el layout se desplaza.
- Al girar el teléfono, cambia el ancho y la orientación.
- Al volver del segundo plano, el WebView puede haber cambiado de tamaño.

Leaflet mide una sola vez. Después de cualquiera de esos eventos los tiles se pintan
desplazados, aparecen franjas del color del fondo y los pines dejan de coincidir con el
mapa. Recargar lo arregla temporalmente, que es exactamente lo que reportan los usuarios.

**Solución propuesta:** un componente dentro de `<MapContainer>` que use `useMap()` y
escuche `ResizeObserver` sobre `map.getContainer()`, `window.resize`,
`window.orientationchange`, `visualViewport.resize` y `visibilitychange`, agrupando en un
`requestAnimationFrame`:

```tsx
map.invalidateSize({ pan: false, animate: false });
```

**Verificación:** en Safari iOS, abrir el teclado sobre el buscador, cerrarlo, girar el
teléfono y comprobar que los tiles y los pines siguen alineados sin recargar.

---

### LV-07. El service worker entrega HTML viejo cuando la red tarda más de 4 segundos

**Ubicación:** `public/sw.js:21` (`CACHE_VERSION = "lv-v1"`) y `:259-263`.

**Evidencia:**

```js
const response = await conTimeout(fetch(request), NAV_TIMEOUT_MS); // 4000 ms
// ...
} catch {
  const cache = await caches.open(PAGES_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
```

El `catch` no distingue «sin red» de «red lenta». En una conexión cubana de 3G, 4 segundos
son normales, así que el service worker responde con el documento guardado de un
despliegue anterior aunque haya conexión. Ese documento referencia chunks que ya no
existen o trae el árbol de sesión de antes. El `<script>` de recuperación de
`ChunkLoadError` recarga, y el ciclo se repite.

**Solución propuesta:**

- Usar la copia guardada **solo** si `self.navigator.onLine === false`.
- Si la red existe, esperar a la petición real aunque tarde.
- Subir `CACHE_VERSION` a `lv-v2` para purgar las copias viejas en `activate`.

**Verificación:** simular red lenta (DevTools, 3G + latency) y comprobar que el documento
entregado corresponde al despliegue actual, no a la caché.

---

## 5. Hallazgos P1

### LV-08. El área segura superior no se respeta en las barras de la app

**Ubicación:** `src/app/globals.css:41` y `:67` (`--header-h: 56px` / `60px`),
`src/components/layout/header.tsx:257` (sin `safe-top`),
`src/app/(main)/profile/page.tsx` barra superior sticky.

**Contexto:** `src/app/layout.tsx` declara `viewportFit: "cover"`. En la PWA instalada en
iPhone con notch, el header fijo arranca debajo de la hora y los iconos de estado. El
buscador y el menú quedan parcialmente tapados.

**Solución propuesta:**

```css
--header-h: calc(56px + env(safe-area-inset-top, 0px));
/* y en el breakpoint de 640 px: calc(60px + env(...)) */
```

Añadir la clase `safe-top` al header del mapa y a las barras propias del perfil y del
negocio. Así todo lo que se mide desde `--header-h` (mapa, `padding` del `main`,
desplegable del buscador, alto máximo de la hoja en escritorio) queda también por debajo.

**Verificación:** abrir la app instalada en un iPhone con notch y comprobar que el título y
los botones no tocan la barra de estado.

---

### LV-09. Objetivos táctiles por debajo de 44 px (medidos)

| Control | Ubicación | Medida real |
|---|---|---|
| Botón de enviar del buscador | `header.tsx:330` | 32 × 32 |
| «Iniciar sesión» del menú | `user-menu.tsx` (LoginButton) | 106 × 36 |
| Botón Guardar del perfil | `profile/page.tsx:275` | alto 36 |
| Zoom + y zoom − de Leaflet | `MapContent.tsx` | 42 × 42 |
| «Ir a mi ubicación» | `LocateButton.tsx` | 42 × 42 |
| Acciones del popup del mapa | `PlacePopup.tsx:33` (`min-h-9`) | alto 36 |
| Logo de la portada | `landing/header.tsx` | 25 × 26 |

No incumplen un bloqueo funcional, pero en un móvil con dedos y conexión lenta cada toque
fallido cuesta. WCAG 2.5.8 pide 24 px como mínimo y la guía del proyecto habla de 44.

**Solución propuesta:** subir los controles principales a `min-h-11` / `size-11`, dejando
las excepciones documentadas (las acciones del popup pueden quedarse en 36 si se amplía el
área con padding transparente).

---

### LV-10. Menús que se cierran con `mousedown`, que iOS no siempre emite

**Ubicación:** `src/components/layout/header.tsx:195`,
`src/components/layout/user-menu.tsx:249`,
`src/components/map/map-notifications.tsx:145`,
`src/components/menu/menu-header.tsx:155`.

**Impacto:** en iOS Safari, un toque fuera del desplegable sobre una zona no interactiva no
siempre dispara `mousedown`. El menú se queda abierto y tapa la pantalla; el usuario vuelve
a tocar y parece que la app no responde.

**Solución propuesta:** usar `pointerdown` en los cuatro sitios. En los elementos que
dependen de conservar el foco (filas del buscador) se mantiene `onMouseDown` con
`preventDefault`, que es una intención distinta.

**Verificación:** abrir cada menú y tocar el fondo del mapa en Safari iOS y en Chrome
Android.

---

### LV-11. El mapa se monta detrás del header y el popup calcula mal su margen

Relacionado con LV-04. Además de los chips, `getPopupOptions()` en
`src/components/map/PlacePopup.tsx` usa `autoPanPadding: [16, 68]`. Si el mapa pasa a
empezar debajo del header (arreglo de LV-04), ese margen superior de 68 px sobra y los
popups quedarán más abajo de lo necesario. Conviene reducirlo a 16 cuando se aplique
LV-04.

---

### LV-12. La hoja no puede ocultarse del todo

`RESTING_OFFSET.peek` y `PEEK_INSET` dejan siempre 120 px visibles. Para quien está
mirando el mapa, la hoja tapa el tercio inferior y no hay un estado «cerrada». Es una
decisión de diseño defendible (la sección no desaparece), pero conviene que el botón de
recoger explique el estado y, si se quiere un cierre real, añadir un tercer estado
`closed` con una pestaña flotante para recuperarla.

---

### LV-13. Onboarding con `h-dvh` y `overflow-hidden` en iOS

**Ubicación:** `src/app/onboarding/layout.tsx:16`.

**Riesgo:** cuando aparece el teclado, `dvh` se reduce y el contenedor tiene
`overflow-hidden`. En pasos con campos de texto el botón «Continuar» puede quedar fuera de
la zona visible y no hay forma de desplazarse dentro del contenedor externo.

**Solución propuesta:** usar `min-h-dvh` en lugar de `h-dvh`, o mantener el alto pero con
un contenedor interno `overflow-y-auto` y `pb-[env(safe-area-inset-bottom)]`, y probar el
paso de ciudad y el de teléfono con el teclado abierto en iPhone.

---

### LV-14. Imágenes del bucket responden 403

**Evidencia en los logs del servidor:**

```
upstream image response failed for
https://...neon.tech/la-verde-images/places/... 403
```

**Impacto:** portadas y logos rotos en tarjetas, popups y fichas. No es un bug de UI, es
de configuración o de caducidad de las URLs firmadas. Hay que revisar:

- políticas del bucket (lectura pública o firma vigente),
- `images.remotePatterns` en `next.config.ts`,
- si las URLs guardadas en la base siguen siendo válidas.

---

### LV-15. `fetchMe` y la sesión del home no se revalidan tras bfcache

`src/app/(main)/home/page.tsx` guarda `authState` en un efecto que corre una sola vez. Si
Safari restaura la página desde el historial, el banner de «La IA necesita una cuenta»
puede seguir visible para alguien que ya entró, o al revés. Conviene reutilizar el mismo
`pageshow` + `refreshSession()` de LV-03 y volver a pedir `/api/me` sin recargar la página.

---

## 6. Hallazgos P2

1. **Cabecera del buscador y desplazamiento de la hoja.** Cada foco en el campo de búsqueda
   dispara `onSuggestionsOpen()` y baja la hoja a `peek`, aunque el usuario solo quería
   escribir. Funciona, pero se percibe como que la sección «se cierra sola». Considerar
   bajar la hoja solo si estaba en `full` y restaurarla al cerrar el desplegable.
2. **`max-h-[70vh]` en la hoja.** En iOS conviene `70dvh` (con respaldo `vh`) para que la
   barra de URL no recorte el contenido.
3. **`preferCanvas: true` con catálogos grandes.** En Android de gama baja, cientos de
   marcadores dibujados en canvas compiten con las animaciones de la hoja. Medir con el
   catálogo real y, si hace falta, agrupar pines o limitar los visibles por viewport.
4. **El buscador pide direcciones a Photon en cada cambio, con debounce de 350 ms.** En
   redes lentas se encadenan peticiones y la lista de resultados llega tarde. Ya hay
   `AbortController` por secuencia, pero no cancela la petición anterior. Añadir
   `AbortController` real.
5. **El script de recuperación de chunks recarga la página sin límite de intentos si el
   error se repite en un bucle de chunks.** Ya hay una bandera `__laVerdeChunkReloaded`,
   pero se resetea en cada documento nuevo. Con el service worker sirviendo HTML viejo
   (LV-07), el ciclo puede repetirse entre despliegues.
6. **Caché de `/api/places` con timeout de 4 s.** El catálogo se sirve desde caché si la
   red tarda, con `X-LV-Cached-At` para avisar. Es aceptable para lectura, pero conviene
   que la UI muestre la fecha de forma más visible cuando el dato viene de caché.
7. **Alturas y radios con `!important` en `globals.css:1098-1112`.** Dificultan el
   mantenimiento y ya causaron el fallo de arrastre de LV-05. Migrar las excepciones de
   escritorio a clases del componente.

---

## 7. Hallazgos P3

1. **Mezcla de escalas de `z-index`** (`z-200`, `z-250`, `z-300`, `z-[400]`, `z-[5]`).
   Documentar una escala semántica única.
2. **`100vh` en `src/app/global-error.tsx:63`.** Cambiar a `100dvh` con respaldo.
3. **El asa de la hoja tiene `role="button"` pero no `aria-controls`.** Añadirlo apuntando
   al id del panel.
4. **El asa cambia de `aria-expanded` pero no anuncia el estado del panel al lector.**
   Revisar con VoiceOver.
5. **Textos con `text-ink-soft/60`** en metadatos pequeños. Revisar contraste en modo
   claro sobre `sand-warm`; algunos usos quedan cerca del mínimo de 4.5:1.

---

## 8. Matriz de verificación recomendada

Probar cada arreglo en los cuatro entornos reales, no solo en Chrome de escritorio:

| Escenario | Android Chrome | Android WebView / Instagram | iOS Safari | iOS PWA instalada |
|---|---|---|---|---|
| Entrar y volver a `/` | | | | |
| Recargar `/home` con sesión | | | | |
| Cerrar sesión en otra pestaña | | | | |
| Abrir/recoger recomendaciones con botón | | | | |
| Arrastrar la hoja desde el titular | | | | |
| Abrir teclado y cerrar | | | | |
| Girar el teléfono con el mapa abierto | | | | |
| Volver desde otra app (bfcache) | | | | |
| Navegar con 3G simulado | | | | |
| Tocar chips de categoría | | | | |
| Tocar «Todo» con el header encima | | | | |
| Abrir menú y tocar fuera | | | | |
| Notch / barra de estado | n/a | n/a | | |

---

## 9. Plan de corrección sugerido

Orden pensado para que cada paso se pueda verificar solo y no dependa del siguiente:

1. **Sesión y header** (LV-01, LV-02, LV-03, LV-15).
   Archivos: `landing/header.tsx`, `(auth)/login/page.tsx`, `api/me/route.ts`,
   `lib/session-client.ts`, `layout/user-menu.tsx`, `(main)/home/page.tsx`.
2. **Layout del mapa y chips** (LV-04, LV-11).
   Archivos: `(main)/home/page.tsx`, `map/PlacePopup.tsx`.
3. **Hoja de recomendaciones** (LV-05, LV-12).
   Archivos: `layout/bottom-sheet.tsx`, `globals.css`.
4. **Mapa estable en móvil** (LV-06).
   Archivo: `map/MapContent.tsx`.
5. **Service worker** (LV-07).
   Archivo: `public/sw.js`.
6. **Área segura y táctiles** (LV-08, LV-09, LV-10, LV-13).
   Archivos: `globals.css`, `layout/header.tsx`, `layout/user-menu.tsx`,
   `layout/bottom-sheet.tsx`, `map/map-notifications.tsx`, `menu/menu-header.tsx`,
   `profile/page.tsx`, `onboarding/layout.tsx`.
7. **Imágenes 403** (LV-14): configuración de bucket y `next.config.ts`, fuera del código de
   UI.

Cada paso debe cerrarse con `npm run typecheck` y una vuelta manual en los cuatro entornos
de la matriz. No hay suite de tests para estos componentes; sería recomendable añadir tests
de humo de DOM para la hoja y para el menú de usuario cuando se estabilicen.

---

## 10. Lo que funciona bien y conviene no romper

- El patrón de tres estados del menú de usuario («no se sabe» distinto de «sin sesión») es
  correcto y evita el parpadeo de «Iniciar sesión» durante la carga.
- El contador de señales (`peekSignal`, `openSignal`) de la hoja es una buena solución al
  problema clásico de los booleanos que no vuelven a disparar.
- La limpieza del `pointercancel` para los WebView de Instagram está bien pensada.
- `fetchMe` cacheado por pestaña ahorra tres peticiones por carga del home.
- El modo offline está diseñado con cuidado: datos privados fuera de caché, snapshots por
  usuario y purga al cambiar de cuenta.
- El diseño usa tokens, `dvh` con respaldo y `-webkit-text-size-adjust: 100%`, que ya
  corrigió el engorde de texto de Android.

---

## 11. Limitaciones de esta auditoría

- No se probó en un iPhone ni en un Android físicos. Las mediciones de viewport se
  hicieron con Chrome headless a 390 × 844; iOS Safari y la PWA instalada pueden diferir en
  la barra de URL, el teclado y el área segura.
- No se inició sesión con una cuenta real: los flujos de sesión se auditaron por código y
  por las respuestas de `/api/me`.
- El árbol de trabajo tenía cambios en curso en `src/components/menu/*` y
  `src/app/m/[slug]/page.tsx`; no se auditaron en profundidad para no mezclar estados.
- `npm run lint` no funciona en Next 16 (`next lint` fue eliminado). No hay ESLint
  configurado de forma independiente, así que la verificación estática quedó limitada a
  `tsc --noEmit`.
- Los 403 de imágenes se observaron en el servidor de desarrollo; hay que confirmar si
  también ocurren en producción o si son URLs caducadas de un entorno concreto.

---

**Fin del informe.** No se modificó ningún archivo de código. El siguiente paso es
revisar el plan de la sección 9, decidir qué entra en esta iteración y aplicar los parches
en ese orden.
