# PWA, fase 6: el mapa robusto en todos los teléfonos

## El problema

En Android con Chrome, el mapa tarda muchísimo o no llega a cargar: la pantalla se queda en blanco. En iPhone, con la misma conexión, la web y la PWA cargan bien y muestran las zonas ya vistas. **No es la red: es cómo Chrome de Android ejecuta el mapa.**

Causas probables, que pueden sumarse:

1. **Chrome desactualizado:** en Cuba no hay Google Play y muchos Android tienen versiones antiguas. El código de la app o de `maplibre-gl` puede usar sintaxis o funciones que ese Chrome no tiene, y la página se queda en blanco sin error visible.
2. **WebGL no disponible o por software:** en muchos Android baratos, Chrome bloquea la GPU o usa WebGL por software, y MapLibre va lentísimo o no pinta.
3. **Service worker viejo:** el SW roto de la fase 1b puede seguir instalado en teléfonos que nunca tocaron «Actualizar».
4. **Poca memoria:** en teléfonos con 2 GB de RAM, Chrome puede perder el contexto WebGL y el mapa queda en blanco.

**Objetivo:** que **nadie** vea una pantalla en blanco, que el mapa funcione en los teléfonos modestos y que, si no puede, entre solo un mapa de respaldo.

## Reglas

- **Dependencias:** la única nueva permitida es `leaflet`, **solo** para el mapa de respaldo, con carga diferida, y que no entre en el JS de quien usa MapLibre.
- **Lo que ya existe:** no se toca el comportamiento en iPhone ni en los Android que ya funcionan bien.
- **Generales:** UI, código y comentarios en español.
- **Diseño:** igual que en las fases anteriores (skills `ui-ux-pro-max`, `design-taste-frontend` e `impeccable`, tokens del proyecto, modo claro y oscuro, prueba a 360 px, áreas táctiles de 44 px y contraste AA).

## Parte 1: diagnóstico desde los teléfonos reales (desplegar primero)

No podemos depurar cada teléfono por cable, así que la app nos cuenta qué pasa.

### 1.1. Endpoint de diagnóstico

`POST /api/diagnostico`:
- **Sin sesión obligatoria,** con un límite por IP (por ejemplo, 20 por hora).
- **Guarda en una tabla `diagnosticos`:** fecha, tipo de evento y un JSON pequeño (máximo 4 KB).
- **Sin datos personales:** ni ubicación exacta, ni ids de usuario, ni teléfonos.

### 1.2. Qué se envía

Un componente cliente montado en el layout raíz envía, **una vez por sesión de navegador:**

| Dato | Detalle |
| --- | --- |
| Navegador | `navigator.userAgent` y versión de Chrome extraída |
| ¿Es la PWA instalada? | `display-mode: standalone` |
| Memoria | `navigator.deviceMemory` y `navigator.hardwareConcurrency` |
| WebGL | ¿WebGL1 y WebGL2 disponibles? ¿Hay `major performance caveat`, es decir, por software? (crea un contexto de prueba con `failIfMajorPerformanceCaveat: true` y otro sin él). La GPU, con `WEBGL_debug_renderer_info` si está |
| Conexión | `navigator.connection.effectiveType`, si existe |
| Service worker | La versión activa (`SW_VERSION`) y si hay uno esperando |

En el mapa, envía también:
- `mapa_cargado`, con los milisegundos desde que se montó el componente hasta el evento `load` de MapLibre y hasta el primer `idle`,
- `mapa_error`: errores de MapLibre (evento `error`), `webglcontextlost`, y el fallo al crear el mapa,
- `mapa_lento`: si a los 8 segundos no ha llegado `load`.

**Errores globales:** `window.onerror` y `unhandledrejection` envían el mensaje, el archivo y la línea, como mucho 5 por sesión. **Los errores de sintaxis de un Chrome viejo aparecerán aquí.**

**Sin red,** los eventos se encolan con la cola de la fase 1 y se envían después.

### 1.3. Resumen en administración

En `/admin`, una vista pequeña «Diagnóstico» con los últimos 7 días:
- porcentaje de cargas del mapa con éxito por plataforma (Android, iOS, escritorio),
- tiempo medio de carga del mapa,
- versiones de Chrome más comunes,
- porcentaje de Android sin WebGL o con WebGL por software,
- errores más repetidos,
- versiones del SW activas.

**Despliega la parte 1 sola y déjala correr 2 o 3 días** antes de seguir, si es posible. Mientras tanto, puedes avanzar con la parte 2.

## Parte 2: soluciones

### 2.1. Service worker que se actualiza solo con los arreglos importantes

Hoy, una versión nueva del SW espera a que el usuario toque «Actualizar». Si nunca lo hace, se queda con el SW viejo para siempre.

- **El SW nuevo llama a `self.skipWaiting()` en `install` y a `clients.claim()` en `activate`,** salvo que haya cambios pendientes en la cola. En ese caso espera, como dice la fase 5.
- **`PwaRegister`:** al detectar `controllerchange`, recarga la página una sola vez, de forma segura (con una bandera en `sessionStorage` para no entrar en bucle) y solo si no hay formularios sin guardar. Si los hay, muestra el aviso «Hay una versión nueva» como ahora.
- **Interruptor de emergencia:** si `/sw-version.js` define `self.SW_KILL = true`, el SW vacía sus cachés de páginas y teselas y se desregistra. Debe usarse solo en caso de desastre, y queda documentado en un comentario.
- **Comprueba que el SW de la fase 1b,** con la intercepción rota de teselas, no puede quedar activo en ningún teléfono tras desplegar esto.

### 2.2. Compilar para Chrome antiguos

1. **Mira qué versiones de Chrome soporta hoy el build** (`browserslist` en `package.json` o el valor por defecto de Next) y qué sintaxis usa la versión de `maplibre-gl` instalada (por ejemplo, `?.`, `??`, `??=`, campos privados `#`, `structuredClone`, `Array.prototype.at`).
2. **Fija `browserslist`** para soportar al menos Chrome 80 en Android, o la versión más baja razonable que encuentres. Si los datos de la parte 1 muestran Chrome más antiguos, ajústalo.
3. **Si `maplibre-gl` o alguna dependencia viene sin transpilar** con sintaxis más nueva, añádela a `transpilePackages` en `next.config.ts` para que Next la transpile.
4. **Polyfills** solo de lo que falte, cargados solo si el navegador no lo tiene. Sin librerías grandes de polyfills.
5. **Detección temprana:** un `<script>` mínimo en el `<head>`, escrito en ES5, que compruebe un par de funciones clave. Si faltan, muestra un mensaje claro en vez de una pantalla en blanco: «Tu navegador es muy antiguo para La Verde. Actualiza Chrome o abre la app en otro navegador».

### 2.3. Elegir el mapa según el teléfono

Antes de crear el mapa, decide qué usar:

| Situación | Mapa |
| --- | --- |
| WebGL disponible **sin** `major performance caveat` | **MapLibre normal** |
| WebGL disponible, pero memoria baja (`deviceMemory` ≤ 2), muchos píxeles o datos de la parte 1 que indiquen lentitud | **MapLibre en modo ligero** (2.4) |
| Sin WebGL, WebGL por software, error al crear MapLibre o `webglcontextlost` que no se recupera | **Mapa de respaldo** (2.5) |

- **La decisión se guarda en `localStorage`** para no repetir la prueba en cada carga. Se revisa cada 7 días o al cambiar la versión del navegador.
- **Vigilante:** si MapLibre no llega a `load` en **8 segundos**, se destruye y se carga el mapa de respaldo, con el aviso discreto «Usamos un mapa más ligero para tu teléfono».
- **`webglcontextlost`:** se intenta recuperar una vez. Si falla, se pasa al respaldo.
- **Opción visible en los ajustes:** «Mapa ligero», para forzar el respaldo a mano.

### 2.4. MapLibre en modo ligero

| Ajuste | Valor |
| --- | --- |
| `pixelRatio` | Como mucho 1,5 (o 1 con `deviceMemory` ≤ 2) |
| `antialias` | `false` |
| `fadeDuration` | 0 |
| `maxTileCacheSize` | Más pequeño (por ejemplo, 50) |
| `refreshExpiredTiles` | `false` |
| Edificios 3D (`fill-extrusion`) | Ocultos |
| Iconos de lugares (POI) | Ocultos por debajo del zoom 15 |
| Densidad de etiquetas | Menor, en las capas secundarias |
| Inclinación (`pitch`) | Desactivada |

Aplícalo también, en parte, a los teléfonos normales si los datos de la parte 1 muestran que mejora el tiempo de carga. Por ejemplo, limitar `pixelRatio` a 2 siempre.

### 2.5. Mapa de respaldo sin WebGL

- **Leaflet** con carga diferida, solo cuando hace falta, con su CSS.
- **Teselas raster:**
  - Mientras el VPS no sirva las nuestras: las de OpenStreetMap (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`), respetando sus normas: solo lo que el usuario ve, sin descargas por adelantado y con la atribución. Como solo lo usarán los teléfonos sin WebGL, el volumen será pequeño.
  - Deja preparada una variable `NEXT_PUBLIC_MAPA_RASTER` para cambiarlas más adelante por unas propias.
- **Mismo comportamiento que el mapa normal:** las mismas props y eventos, marcadores con `divIcon` ligero, popup del negocio, ruta, ubicación y tema claro u oscuro (en oscuro, un filtro CSS de oscurecido sobre la capa de teselas).
- **Lo que sabemos que funciona:** `keepBuffer: 4`, `updateWhenZooming: false`, `updateWhenIdle: true` y fondo del color de tierra.
- **El SW guarda las teselas de respaldo** con el patrón correcto de la fase 3b: `clone()` antes de responder, `waitUntil`, solo respuestas `cors` u `ok`, recorte por lotes y sin prefetch.

### 2.6. Nunca una pantalla en blanco

- **Mientras carga el mapa:** un esqueleto con el color de tierra del mapa, el logo pequeño y «Cargando el mapa…». Nunca blanco.
- **Si a los 4 segundos no hay mapa:** debajo, el botón «Ver la lista de negocios», que abre la lista con los negocios de IndexedDB. Así el usuario puede buscar y entrar a fichas aunque el mapa tarde.
- **Los negocios y la lista no esperan al mapa.**

### 2.7. Carga más rápida en Android

- **El componente del mapa y el estilo** empiezan a descargarse en cuanto se sabe que se va a mostrar el mapa (`<link rel="modulepreload">` o `import()` temprano), en paralelo con el resto.
- **El estilo, las fuentes básicas y el sprite** precacheados (ya lo hace la fase 3b). Comprueba que en Android también se sirven desde la caché.
- **Preconexión al servidor de teselas** que se esté usando en cada momento.
- **Mide el JS que se ejecuta antes del mapa** en un Android de gama baja simulado (CPU 6x más lenta). Si algo pesado se ejecuta antes sin ser necesario (analítica, componentes ocultos, librerías), aplázalo hasta después del primer `idle` del mapa.

## Cómo trabajar

1. **Parte 1:** dime qué archivos vas a crear y modificar. Espera mi visto bueno, implementa y avísame para desplegarla.
2. **Parte 2:** antes de implementar, dime:
   - qué `browserslist` hay hoy y qué sintaxis de `maplibre-gl` falla en Chrome 80,
   - cómo vas a detectar el WebGL por software,
   - qué archivos vas a crear y modificar.

   Espera mi visto bueno.
3. **Implementa la parte 2** en el orden de sus apartados.
4. Haz la revisión de diseño con `impeccable`, si está instalada.
5. Ejecuta el typecheck, el lint y los tests. El build lo lanzo yo.

## Cómo lo pruebo yo

1. **Con un Android afectado conectado por USB al PC:**
   - activa en el teléfono las opciones de desarrollador y la depuración USB,
   - abre `edge://inspect` en Edge del PC,
   - inspecciona la pestaña de La Verde y mira la consola.

   Así se ve el error real en ese teléfono.
2. **En ese mismo teléfono,** apunta la versión de Chrome que sale en `chrome://version`.
3. **Tras desplegar:**
   - el teléfono que fallaba muestra el mapa normal, el ligero o el de respaldo, nunca un blanco,
   - en `/admin` → «Diagnóstico» se ve qué mapa usó y cuánto tardó.
4. **En Edge del PC, con WebGL desactivado** (en `edge://flags`, «WebGL» desactivado, o con un perfil de prueba): entra el mapa de respaldo.

## Comprobación final

- [ ] La parte 1 envía diagnósticos sin datos personales, con límite por IP y encolados sin red.
- [ ] `/admin` → «Diagnóstico» muestra éxito, tiempos, versiones de Chrome, WebGL y errores por plataforma.
- [ ] El SW se actualiza solo con los arreglos, sin bucles de recarga y sin perder la cola ni formularios.
- [ ] Ningún teléfono puede quedarse con el SW roto de la fase 1b.
- [ ] El build soporta Chrome 80 (o la versión acordada), y un Chrome más viejo ve un mensaje claro, no un blanco.
- [ ] La elección del mapa (normal, ligero o respaldo) funciona y se recuerda.
- [ ] El vigilante de 8 segundos pasa al respaldo si MapLibre no carga.
- [ ] El mapa de respaldo tiene marcadores, popup, ruta, ubicación y tema, y guarda las teselas vistas.
- [ ] Nunca hay una pantalla en blanco: esqueleto y botón de la lista a los 4 segundos.
- [ ] En iPhone y en los Android que ya iban bien, todo sigue igual o más rápido.
- [ ] Mediciones de antes y después en Android de gama baja simulado.
- [ ] Typecheck, lint y tests sin errores.

Termina con un resumen de los archivos tocados y cualquier decisión que hayas tomado por tu cuenta.
