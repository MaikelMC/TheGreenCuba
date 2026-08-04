# Plan: Perfeccionamiento del mapa (geolocalización + validación + rendimiento)

## Diagnóstico actual

1. **Geolocalización**: lógica duplicada en `LocateButton` y en el home (`handleRequestLocation`). Sin manejo de errores (timeout, permiso denegado, no soportado), sin estados de carga, sin caché de última posición.
2. **Coordenadas inválidas**: no existe validación. Un negocio con `lat/lng` malos se renderiza en el mar o fuera de Cuba.
3. **Rendimiento**: `maxZoom=18` (pesado en conexiones lentas), sin `preferCanvas`, sin filtrado/memo de markers válidos, sin ahorro de datos (`detectRetina` activado implícitamente por CartoDB `{r}`).
4. **Arquitectura**: `map-config.ts` vive dentro de components; nombres kebab-case vs. la estructura PascalCase pedida.

## Estructura de archivos

### Nuevos (en `src/lib/map/`)
- `geolocation.ts` — `getCurrentPosition` robusto + caché + códigos de error en español
- `coordinates.ts` — validación Cuba (bbox + filtro de tierra/mar) + `filterValidPlaces`
- `map-config.ts` — tiles, zooms, flags de rendimiento (movido desde `components/map/`)

### Renombrados a PascalCase (en `src/components/map/`)
- `MapView.tsx` ← `map-view.tsx` (mantiene API pública, añade ErrorBoundary ligero)
- `MapContent.tsx` ← `map-content.tsx` (`preferCanvas`, `maxZoom` configurable, tiles con ahorro de datos)
- `MapMarkers.tsx` ← `map-markers.tsx` (filtra lugares inválidos + `useMemo`)
- `UserLocationMarker.tsx` ← `user-location.tsx` (sin cambios funcionales)
- `PlacePopup.tsx` ← `place-popup.tsx` (sin cambios funcionales)
- `LocateButton.tsx` ← `locate-button.tsx` (usa `lib/map/geolocation.ts`, spinner + toast de error)

### Modificados
- `src/components/map/types.ts` — añade `maxZoom`, `onLocateStateChange`; conserva API existente
- `src/components/map/index.ts` — nuevos exports
- `src/app/(main)/home/page.tsx` — import de `MapView`, usa helper de geolocalización, elimina flujo redundante del bottom-sheet "location"
- `src/app/globals.css` — estilos extra si se requieren

### Eliminados (legacy, sin uso tras refactor)
- `map-marker.tsx` (marker CSS posicionado, ya no se usa)
- `map-controls.tsx` (suplido por el `LocateButton` flotante dentro del mapa)
- `map-config.ts` en components (movido a `lib/map/`)

## Decisiones clave por archivo

### `lib/map/geolocation.ts`
- `getCurrentPosition({ enableHighAccuracy=true, timeout=10000, maximumAge=120000, useCache=true })` → `Promise<UserPosition>`
- Mapea errores del API: `1→"denied"`, `2→"unavailable"`, `3→"timeout"`, falta de soporte→`"unsupported"`
- Caché en `localStorage` (`la-verde:last-position` + timestamp, TTL 5 min) para no pedir ubicación constante; `getLastKnownPosition()` / `clearCachedPosition()`
- `GEO_ERROR_MESSAGES: Record<GeoErrorCode,string>` en español (usados en toasts)
- Guards `try/catch` para localStorage y `navigator.geolocation`

### `lib/map/coordinates.ts`
- `CUBA_BOUNDING_BOX = { north: 23.30, south: 19.80, west: -84.96, east: -74.13 }`
- `LAND_RECTANGLES`: array de ~8-10 rectángulos que aproximan la masa de tierra (Cuba + Isla de la Juventud) para filtrar puntos claramente en el mar
- `isValidCubaCoordinate(lat,lng)` = finito + dentro de bbox + dentro de un rectángulo de tierra
- `validatePlaceCoordinates(place)` → `{ valid, reason: "invalid" | "out-of-bounds" | "at-sea" }`
- `filterValidPlaces(places)` → solo válidas (reutilizable para creación/edición de negocios)
- Documentado como aproximación gruesa; la validación fina se hará al crear negocios

### `lib/map/map-config.ts`
- `MAX_ZOOM = 17` (configurable), `MIN_ZOOM = 10`, `DEFAULT_ZOOM = 13`, `GEO_ZOOM = 15`
- `DETECT_RETINA = false` (ahorra datos en conexiones lentas)
- `PREFER_CANVAS = true`
- `TILE_CONFIGS`: voyager (default), positron, osm; cada uno con `subdomains`, `maxZoom`, atribución

### `MapView.tsx`
- `forwardRef<HTMLDivElement, MapViewProps>`, `dynamic(() => import("./MapContent"), { ssr:false })` con loading spinner
- ErrorBoundary clase que captura errores de render y muestra "No se pudo cargar el mapa" + botón reintentar
- Children renderizados como hermanos (sin overlay que robe eventos — fix previo)
- API pública: **sin cambios de props existentes**, se añaden opcionales `maxZoom` y `onLocateStateChange`

### `MapContent.tsx`
- Guard `mounted` (evita `appendChild` de StrictMode/SSR)
- `MapContainer` con `preferCanvas`, `minZoom`, `maxZoom` (de props o default), `zoomControl={false}` + `<ZoomControl position="bottomleft" />`
- `MapChildren` con guard `ready` (no renderiza markers/tiles hasta que el mapa esté listo)
- `MapMarkers` recibe `places` ya filtrados; `UserLocationMarker` si `userLocation`; `LocateButton` con callbacks
- `FitBoundsOnMount` usa solo lugares válidos

### `MapMarkers.tsx`
- `useMemo(() => filterValidPlaces(places), [places])`
- `MarkerItem` memoizado con `divIcon` memoizado (default/selected/boosted)
- Estructura lista para envolver con clustering en el futuro (se extrae la lista de `MarkerItem`)

### `LocateButton.tsx`
- Usa `useMap()` + `getCurrentPosition` de `lib/map/geolocation.ts`
- Estado local `locating` → spinner en el botón; `onLocateStateChange("loading"|"success"|"denied"|"error"|"idle")`
- Éxito → `map.flyTo(..., GEO_ZOOM)` + `onUserLocated(lat, lng, accuracy)`
- Error → `toast.error(GEO_ERROR_MESSAGES[code])` (sonner ya está instalado) + `clearCachedPosition()` en caso de denied
- Posición: `leaflet-bottom leaflet-right` (abajo a la derecha)

### `home/page.tsx`
- Import: `@/components/map/MapView`
- Elimina `MapControls` (el `LocateButton` del mapa es el botón "Mi ubicación" flotante)
- Elimina estado `"location"` del `SheetState`, su entrada en `SHEET_TITLES`, su referencia en `showFilters` y su bloque JSX
- `handleRequestLocation` → usa `getCurrentPosition` de `lib/map/geolocation.ts` (éxito→`handleUserLocated`, error→toast)
- Se mantienen `userLocation` y `onUserLocated`

## Qué NO cambia (regla de no romper API)
- Props existentes de `MapView`: `places`, `selectedPlaceId`, `onPlaceSelect`, `onMapMove`, `userLocation`, `onUserLocated`, `initialCenter`, `initialZoom`, `tileKey`, `searching`, `children`, `className`
- Comportamiento de marcadores, popup y user location

## Qué se mejora (resumen)
- Geolocalización robusta: errores mapeados, caché, loading/denied/error, funciona móvil+desktop
- Validación Cuba: no se muestran markers en el mar o fuera de Cuba; reutilizable en creación de negocios
- Rendimiento: `preferCanvas`, `maxZoom=17`, `detectRetina=false`, markers filtrados y memoizados, render gateado por `ready`, import dinámico `ssr:false` (se mantiene)
- UX: botón "Mi ubicación" fijo abajo a la derecha con spinner y toasts de error, popup limpio, ErrorBoundary con reintentar

## Cómo probar la geolocalización
1. DevTools → Sensors → override geolocation con coordenadas de La Habana (23.1374, -82.359)
2. Probar casos: permiso otorgado (marca azul + círculo + flyTo), denegado (toast "Permiso denegado"), sin soporte (modo incógnito con geolocation desactivada)
3. Móvil: asegurar HTTPS o localhost, activar GPS

## Cómo cambiar tiles
- Editar `DEFAULT_TILE` en `lib/map/map-config.ts`, o pasar `tileKey="positron" | "osm"` a `MapView`

## Próximos pasos recomendados
- Clustering (`react-leaflet-cluster` o `leaflet.markercluster`) para cientos de lugares
- Validación fina de tierra/mar al crear/editar negocios (polígono detallado o reverse geocoding)
- Caché de tiles en Service Worker para conexiones lentas
- `watchPosition` para seguimiento en vivo (solo si el producto lo requiere)
