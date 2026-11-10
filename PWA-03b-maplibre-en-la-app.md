# PWA, fase 3b: el mapa nuevo con MapLibre

## Contexto

Las teselas vectoriales de toda Cuba ya se sirven desde nuestro propio dominio: `https://prueba-laverde.kynari.dev/tiles/cuba.json` (TileJSON) y `/tiles/cuba/{z}/{x}/{y}.mvt`. Tienen el formato OpenMapTiles, generado con Planetiler.

[PEGA AQUÍ LA RESPUESTA DE `cuba.json`]

Esta fase sustituye Leaflet por **MapLibre GL JS**, con un estilo propio «La Verde» basado en OSM Liberty. El objetivo:

- **Que el mapa aparezca rápido.**
- **Que el zoom sea continuo, sin cuadros vacíos.**
- **Que se vea nítido en cualquier zoom.**
- **Que funcione sin conexión en las zonas que el usuario ya vio.** Solo lo ya visto, nunca descargas por adelantado.

## Reglas

- **Una sola dependencia nueva:** `maplibre-gl`, en una versión estable con al menos dos semanas desde su publicación. Nada más: ni `react-map-gl` ni plugins.
- **Carga diferida:** MapLibre y su CSS solo se cargan en las páginas que muestran el mapa, con `import()` dinámico. No entran en el JS del resto de la app.
- **El mapa no espera a los datos:** se pinta primero, y los negocios aparecen cuando llegan. Se mantiene lo de la fase 1b.
- **Todo sale de nuestro dominio:** teselas, fuentes del mapa (glyphs), iconos (sprite) y estilo. Nada de OpenFreeMap, CARTO ni OpenStreetMap en producción.
- **La atribución es obligatoria:** «© OpenStreetMap contributors © OpenMapTiles», con el control de atribución compacto.
- **Generales:** UI, código y comentarios en español.
- **Diseño:** igual que en las fases anteriores (skills `ui-ux-pro-max`, `design-taste-frontend` e `impeccable`, tokens del proyecto, prueba a 360 px, áreas táctiles de 44 px y contraste AA).

## Qué hay que hacer

### 1. Estilo «La Verde» alojado en la app

1. **Toma como base el estilo OSM Liberty** (el mismo que `https://tiles.openfreemap.org/styles/liberty`). Descárgalo una vez, mientras programas.
2. **Guárdalo en `public/mapa/estilo-la-verde.json`** con estos cambios:
   - **`sources`:** una sola fuente vectorial `openmaptiles` con `"url": "/tiles/cuba.json"`. Quita las demás fuentes y las capas que dependan de fuentes que no tengamos (por ejemplo, relieve o imágenes de satélite).
   - **`glyphs`:** `/mapa/fuentes/{fontstack}/{range}.pbf`.
   - **`sprite`:** `/mapa/sprite/sprite` (con sus `@2x`).
   - **Nombres en español:** las capas de texto usan `name:es` si existe, si no `name:latin`, y si no `name`.
   - **Los colores de La Verde,** los mismos que el demo:

| Elemento | Color |
| --- | --- |
| Fondo | `#F1F5EE` |
| Agua (relleno) | `#BFE3E6` |
| Agua (líneas) | `#A9D6DB` |
| Parques, césped, bosque | `#D3ECCB` |
| Zonas residenciales | `#ECF1E8` |
| Edificios | `#E2E8DE` |
| Autopistas y vías principales | `#F6E3A1` |
| Calles primarias y secundarias | `#FFFFFF` |
| Nombres de lugares | `#1F5A33` con halo `#FFFFFF` |
| Nombres de agua | `#3C8A92` |

     Los bordes (`casing`) de las calles se mantienen.
3. **Fuentes del mapa:** descarga a `public/mapa/fuentes/` solo las familias que use el estilo (por ejemplo, «Noto Sans Regular», «Noto Sans Bold» y «Noto Sans Italic»), con todos sus rangos `.pbf`. El navegador solo pedirá los rangos que necesite.
4. **Sprite:** descarga a `public/mapa/sprite/` el de Liberty (`sprite.json`, `sprite.png`, `sprite@2x.json`, `sprite@2x.png`).
5. **Origen:** dime de dónde sacaste las fuentes y el sprite, y su licencia, para dejarlo anotado.

### 1b. Modo oscuro del mapa

El mapa sigue el tema de la app: cuando la app pasa a oscuro (`data-theme="dark"` en `<html>`, con el `theme-provider` y el `ThemeToggle` que ya existen), el mapa cambia al instante, y vuelve al claro igual.

**Cómo hacerlo:**

- **Sin un segundo archivo de estilo y sin `setStyle`.** `setStyle` borraría los marcadores, la ruta y la ubicación, y tendría que volver a pedir el estilo. En su lugar, crea `src/lib/map/tema-mapa.ts` con dos paletas (`claro` y `oscuro`) y una función `aplicarTemaMapa(map, tema)` que cambie los colores con `setPaintProperty` sobre las capas del estilo, por su id o por su tipo.
- **Volver al claro sin dejar restos:** al cargar el estilo, guarda el valor original de cada propiedad que la paleta oscura cambia. Al volver a claro, restaura esos valores originales donde la tabla dice «Los de Liberty», para que no quede ninguna calle o nombre con el color oscuro.
- **Escuchar el cambio de tema:** usa el `theme-provider`, o un `MutationObserver` sobre el atributo `data-theme` de `<html>` si el provider no lo expone. Al cambiar el tema, se llama a `aplicarTemaMapa`.
- **Sin destello:** el mapa nace ya con el tema correcto. Antes de pintar, se lee el tema actual y se aplica en el evento `load`, antes de mostrar el contenedor.
- **Mismas fuentes, sprite y teselas** en los dos modos. No hay nada nuevo que descargar.

**Paleta oscura** (pensada para el fondo oscuro de la app, `oklch(15% 0.01 250)`):

| Elemento | Claro | Oscuro |
| --- | --- | --- |
| Fondo | `#F1F5EE` | `#141B17` |
| Agua (relleno) | `#BFE3E6` | `#16313A` |
| Agua (líneas) | `#A9D6DB` | `#1F4450` |
| Parques, césped, bosque | `#D3ECCB` | `#1B2E22` |
| Zonas residenciales | `#ECF1E8` | `#18211C` |
| Edificios | `#E2E8DE` | `#222C26` |
| Autopistas y vías principales | `#F6E3A1` | `#5C5130` |
| Calles primarias y secundarias | `#FFFFFF` | `#2E3A33` |
| Calles menores | Las de Liberty | `#26302A` |
| Bordes de calles (`casing`) | Los de Liberty | `#0E1411` |
| Nombres de lugares | `#1F5A33`, halo `#FFFFFF` | `#CDE9D6`, halo `#0E1411` |
| Nombres de calles | Los de Liberty | `#A9BCAF`, halo `#0E1411` |
| Nombres de agua | `#3C8A92` | `#6FB3BE` |
| Iconos de lugares (sprite) | Opacidad 1 | Opacidad 0,85 |

**Lo que no es del estilo base:**

| Elemento | En modo oscuro |
| --- | --- |
| Marcadores de negocios | El mismo verde con borde blanco, que destaca sobre el fondo oscuro |
| Línea de la ruta | `#3CC46B` en vez del verde oscuro |
| Popup | Usa los tokens del tema oscuro de la app, no `bg-white` |
| Controles de zoom y brújula | Fondo y color de icono del tema oscuro |
| Atribución | Legible sobre el fondo oscuro |

Comprueba el contraste de los nombres de lugares y de calles sobre el fondo oscuro, AA para texto. Ajusta un tono si no llega, y dime cuál cambiaste.

### 2. Componente del mapa con MapLibre

Sustituye la parte de Leaflet de `src/components/map/` (`MapContent.tsx`, `MapMarkers.tsx`, `PlacePopup.tsx` y lo que use `react-leaflet`) por un componente con MapLibre. **El resto de la app no debe notar el cambio:** mismas props, mismos eventos y mismo comportamiento.

- **Vista inicial:** el centro y el zoom de hoy. Zoom máximo 19: por encima del zoom máximo de las teselas, MapLibre amplía las últimas. Zoom mínimo, el de toda Cuba.
- **Límites:** `maxBounds` alrededor de Cuba con margen, para que no se pierda en el océano.
- **Marcadores de negocios:**
  - Una fuente GeoJSON con todos los negocios y una capa `symbol` (o `circle` + `symbol`), **no un `Marker` del DOM por negocio**, para que vaya fluido con muchos negocios.
  - Los iconos SVG que ya usa `MapMarkers.tsx` se registran con `map.addImage`.
  - El color o icono por categoría, como hoy.
- **Popup del negocio:** al tocar un marcador se abre el mismo `PlacePopup`, montado en un `maplibregl.Popup` con un portal de React.
- **Ruta:** la línea que hoy dibuja `routing.ts` (con `/api/route` y el respaldo en línea recta) se dibuja como una capa `line` con el verde de la marca.
- **Ubicación del usuario:** el punto y el círculo de precisión, como hoy, con una capa propia. No uses `GeolocateControl` si cambia el comportamiento actual.
- **Controles:**
  - zoom y brújula (`NavigationControl`), en la misma posición que los controles de hoy,
  - el giro y la inclinación se permiten, y la brújula vuelve al norte al tocarla.
- **Centrar en ciudades:** las funciones que usan `cuba-areas.ts` usan `flyTo` o `fitBounds`.
- **`fadeDuration`:** bajo (por ejemplo, 100 ms), para que las etiquetas no tarden en aparecer.

### 3. Sin WebGL

MapLibre necesita WebGL. Si el navegador no lo tiene (es muy raro, pero pasa en teléfonos muy viejos), no se rompe nada: se muestra la lista de negocios con el aviso «Tu teléfono no puede mostrar el mapa. Aquí tienes la lista de negocios».

**Elimina Leaflet y `react-leaflet` del proyecto** cuando el componente nuevo esté terminado y probado.

### 4. Service worker: guardar lo que se ve

Las teselas, fuentes y sprite ahora son de nuestro propio dominio, así que no hay respuestas opacas ni problemas de CORS. Sube la versión del SW.

- **Quita** cualquier intercepción de los dominios de OpenStreetMap y CARTO.
- **`/tiles/cuba/*`, caché `lv-tiles`, cache-first:**
  - si está en la caché, se responde directamente,
  - si no, se pide a la red y **se responde en cuanto llega**, y se guarda una copia con `response.clone()` **antes** de responder, dentro de `event.waitUntil`,
  - límite de 3 000 teselas, recortado por lotes como mucho cada 100 guardadas o cada 5 minutos,
  - nunca se descargan teselas por adelantado,
  - sin red y sin la tesela, se responde con un 204 sin contenido. MapLibre lo trata como una tesela vacía y sigue mostrando la del zoom anterior.
- **`/tiles/cuba.json`:** network-first, con la copia guardada para usarla sin red.
- **`/mapa/fuentes/*`, `/mapa/sprite/*` y `/mapa/estilo-la-verde.json`:** cache-first en `lv-static`. Precachea al instalar el estilo, el sprite y los rangos básicos de fuentes (`0-255.pbf` y `256-511.pbf` de cada familia), para que el mapa se dibuje sin red desde el primer día.
- **Preconexiones:** quita las de los proveedores externos de teselas.

### 5. Rendimiento

- MapLibre se carga en diferido, y el mapa se monta antes de tener los negocios.
- Las imágenes de la lista siguen perezosas y en tamaño pequeño.
- Mide y dame:
  - el peso del JS de la página del mapa, antes y después,
  - el tiempo hasta ver el mapa en una carga sin caché y en una con caché, con red «Fast 4G» y CPU 4x más lenta en DevTools,
  - el peso total de teselas, fuentes y sprite en la primera vista de Santiago.

## Cómo trabajar

1. Revisa los componentes actuales del mapa y dime qué archivos vas a crear, modificar y borrar, y cómo vas a mantener las mismas props y eventos. Espera mi visto bueno.
2. Implementa en este orden:
   1. Estilo, fuentes y sprite
   2. Paletas y `aplicarTemaMapa`
   3. Componente MapLibre con el mapa base, ya con el tema
   4. Marcadores y popup
   5. Ruta y ubicación
   6. Sin WebGL
   7. Service worker
   8. Retirada de Leaflet
3. Haz la revisión de diseño con `impeccable`, si está instalada.
4. Ejecuta el typecheck, el lint y los tests. El build lo lanzo yo.

## Cómo lo pruebo yo

Dame pasos para el móvil, en la web y en la PWA instalada. Antes, borra los datos del sitio o reinstala la PWA:

1. **Abrir el mapa:** aparece rápido, con los colores de La Verde.
2. **Zoom con dos dedos** hasta el máximo y de vuelta: sin cuadros vacíos.
3. **Moverse por Santiago y otra ciudad,** y luego pasar a modo avión.
4. **En modo avión, volver a las zonas vistas:** se ven completas.
5. **En modo avión, ir a una zona no vista:** se ve el nivel de zoom anterior, sin errores.
6. **Tocar un negocio:** se abre su popup y se dibuja la ruta.
7. **Cambiar la app a modo oscuro y volver:** el mapa cambia al instante, sin recargar y sin perder los marcadores ni la ruta. También funciona sin conexión.

## Comprobación final

- [ ] El mapa carga desde nuestro dominio: teselas, estilo, fuentes y sprite. Ninguna petición a OpenFreeMap, CARTO ni OpenStreetMap.
- [ ] El estilo tiene los colores de La Verde y los nombres en español.
- [ ] El mapa sigue el tema de la app: cambia al instante entre claro y oscuro, sin destello al abrir y sin perder marcadores, ruta ni ubicación.
- [ ] En modo oscuro, los nombres cumplen el contraste AA, y el popup y los controles usan el tema oscuro.
- [ ] El zoom es continuo y sin cuadros vacíos, también en el móvil.
- [ ] Las zonas ya vistas se ven sin conexión, y nunca se descarga nada por adelantado.
- [ ] Los marcadores, el popup, la ruta y la ubicación funcionan como antes.
- [ ] Sin WebGL, se muestra la lista con el aviso.
- [ ] MapLibre no entra en el JS de las páginas sin mapa.
- [ ] Leaflet y `react-leaflet` eliminados del proyecto.
- [ ] La atribución de OpenStreetMap y OpenMapTiles es visible.
- [ ] Mediciones de antes y después.
- [ ] Typecheck, lint y tests sin errores.

Termina con un resumen de los archivos tocados, las cifras y cualquier decisión que hayas tomado por tu cuenta.
