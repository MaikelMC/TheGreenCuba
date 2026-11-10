# Anexo a la fase 3b: empezar con las teselas de OpenFreeMap

Implementa **PWA-03b-maplibre-en-la-app.md** completo (MapLibre, estilo «La Verde», modo oscuro, marcadores, popup, ruta, sin WebGL, service worker y retirada de Leaflet), con estos cambios: **el servidor de teselas del VPS todavía no está listo**. Mientras tanto, las teselas vienen de **OpenFreeMap**, que usa el mismo formato OpenMapTiles. Cuando el VPS esté listo, solo cambiará la dirección de las teselas.

Donde este anexo y el prompt de la fase 3b digan cosas distintas, manda este anexo.

## 1. Fuente de teselas configurable

- **Variable de entorno pública:** `NEXT_PUBLIC_MAPA_TILEJSON`.
  - **Valor por defecto, ahora:** `https://tiles.openfreemap.org/planet`.
  - **Valor futuro, cuando el VPS esté listo:** `/tiles/cuba.json`.
- **En `public/mapa/estilo-la-verde.json`:** la fuente `openmaptiles` se rellena con esa variable **al cargar el estilo en el cliente**. Por ejemplo, cargando el JSON y sustituyendo `sources.openmaptiles.url` antes de pasárselo a MapLibre. Nada de la URL escrita a mano en varios sitios.
- **El cambio futuro** tiene que ser solo cambiar la variable y redesplegar. Déjalo explicado en un comentario y en el `.env.example`.
- **Fuentes del mapa (glyphs), sprite y estilo:** se alojan ya en nuestra app (`/mapa/...`), como dice la fase 3b. Así el mapa se dibuja sin conexión aunque las teselas sean de fuera.

## 2. Límites de la vista

Como OpenFreeMap tiene el mundo entero, el `maxBounds` alrededor de Cuba (con margen) es todavía más importante: evita que el usuario se vaya a otros países y gaste datos.

## 3. Política de seguridad (CSP)

La app tiene una CSP. Revísala y añade **solo** lo necesario:
- **`connect-src`:** `https://tiles.openfreemap.org`, para el TileJSON y las teselas, que MapLibre pide con `fetch` desde sus workers.
- **`worker-src`:** `blob:`, si MapLibre lo necesita para sus workers y no está ya.
- **`img-src`:** nada nuevo, si el sprite se sirve desde nuestro dominio.

Dime exactamente qué añadiste. Cuando el VPS esté listo, `tiles.openfreemap.org` se quita de la CSP.

## 4. Service worker con teselas de otro dominio

Esta vez las teselas son de otro dominio. **Este es el punto donde falló la fase 1b**, así que cuidado:

- **Caché `lv-tiles`:** intercepta solo `https://tiles.openfreemap.org/planet/*` (las teselas) y, en el futuro, `/tiles/cuba/*`. Prepara las dos reglas.
- **El patrón exacto:**
  1. Busca en la caché. Si está, devuélvela.
  2. Si no, `fetch(request)`.
  3. Si la respuesta es `ok` **y** su tipo es `cors` o `basic`: `const copia = respuesta.clone()` **antes** de devolverla, y `event.waitUntil(cache.put(request, copia).then(recortarSiToca))`.
  4. Devuelve la respuesta original.
  5. Si el `fetch` falla (sin red): devuelve `new Response(null, { status: 204 })`.

  **Nunca** leas el cuerpo (`blob()`, `arrayBuffer()`) ni clones después de devolver. **Nunca** guardes respuestas opacas.
- **TileJSON** (`https://tiles.openfreemap.org/planet`): network-first, con la copia guardada en `lv-tiles`. Sin red, se usa la guardada, que apunta a las mismas URLs de teselas ya guardadas.
- **Límite y recorte:** como en la fase 3b, 3 000 teselas, recortadas por lotes.
- **Sin prefetch:** nunca se descargan teselas por adelantado.

**Antes de desplegar, pruébalo:**
1. En Edge, con DevTools en modo móvil.
2. Abre el mapa con el SW activo, **sin** «Omitir para red».
3. Muévete y haz zoom: el mapa tiene que verse completo.
4. Pasa a «Sin conexión» y vuelve a las mismas zonas: tienen que verse.

Dime el resultado antes de que yo despliegue.

## 5. Atribución

Mientras se usen sus teselas: «OpenFreeMap © OpenMapTiles © OpenStreetMap contributors», con el control compacto.

## 6. Lo que queda para cuando el VPS esté listo

Déjame al final una lista corta de lo que habrá que cambiar entonces:
- la variable `NEXT_PUBLIC_MAPA_TILEJSON`,
- quitar `tiles.openfreemap.org` de la CSP,
- quitar su regla del SW y subir la versión,
- la atribución.

Nada más debería cambiar.
