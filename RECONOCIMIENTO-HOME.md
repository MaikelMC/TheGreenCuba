# Reconocimiento del home

Documento de trabajo de la sesión 1. **No se commitea.** Las líneas son las del
estado del repositorio al empezar la sesión; si cambian, mandan los nombres de
las funciones.

## 0. Decisiones tomadas antes de empezar

- **El mapa no se toca** en esta sesión. Ni pines ni cámara.
- **«Populares» será un filtro** (destacados + oferta), como el prototipo. El
  botón de fuego actual **no** hace eso: abre el panel de **Novedades**. Habrá
  que decidir dónde vive Novedades antes de quitarlo.
- **La luna es el tema de la app**, no un modo nocturno separado del mapa. El
  interruptor de tema va al menú del perfil; en «Opciones del mapa» no se pinta
  «Mapa nocturno».
- **`InstallMapButton` es un noveno botón flotante** que el prompt no inventaría.
  Queda pendiente decidir si se mueve a Opciones del mapa o se queda.
- **No hay refresco automático periódico** del catálogo: solo al montar y al
  recuperar la conexión. El botón de la hoja es el único refresco manual.
- La barra superior y el menú del perfil **se cambian solo en una variante del
  home**; no se globalizan todavía.
- «Mis tarjetas» irá en la navegación. «Mis pedidos» irá en el perfil de los
  dueños cuyo negocio tenga pedidos activos. El informe de tipos sospechosos se
  revisa desde el panel de administración.

## 1. Componentes del home

| Pieza | Dónde |
|---|---|
| Barra superior global | `src/components/layout/header.tsx:325` (buscador 349-417, avatar 580) |
| Montaje de la barra | `src/app/(main)/layout.tsx:33` |
| Buscador con IA | `header.tsx:349-417` + `src/providers/search-provider.tsx` |
| Categorías sobre el mapa | `src/app/(main)/home/page.tsx:1635-1643`; `src/components/layout/category-bar.tsx` |
| Botones flotantes | `home/page.tsx:1644-1689` |
| Hoja de recomendaciones | `home/page.tsx:1736-1955`; `src/components/layout/bottom-sheet.tsx` |
| Ventana del pin | `src/components/map/MapContent.tsx:383-405` y `643-652`; `src/components/map/PlacePopup.tsx` |
| Tarjeta de detalle antigua | `home/page.tsx:274-514` y `1957-1971` |
| Menú del perfil | `src/components/layout/user-menu.tsx:88-123` y `534-554` |

## 2. La frontera del mapa

### No se toca

- `src/components/map/MapView.tsx`: carga diferida y armazón del mapa.
- `src/components/map/MapContent.tsx`: inicialización (`215-267`), estilo y tema
  (`288-297`), fuentes y capas (`299-380`), ruta y ubicación (`536-605`).
- `src/components/map/pin-icon.tsx`: generador de SVG de pines.
- `src/lib/map/*`: configuración, geolocalización, rutas, vista guardada.
- El service worker y la caché del mapa offline.
- La telemetría del mapa (`crearVigilanteMapa`, `enviarDiagnostico`).

### Lo único que se puede tocar (y aun así con revisión)

- **Pines**: `MapContent.tsx:49-151` (GeoJSON y orden de apilado) y `499-534`
  (actualización); `pin-icon.tsx:22-170` (aspecto).
- **Cámara**: `MapContent.tsx:536-605` (`fitBounds`, `flyTo`, `easeTo`).
- **Capas de interfaz**: categorías, botones, hoja y tarjeta, que viven en
  `home/page.tsx` y no en la inicialización del mapa.

> Ojo: el popup y el botón de ubicación están dentro de `MapContent.tsx`
> (`383-405`, `643-652`, `666-753`). Moverlos a la tarjeta inferior y a la
> columna de botones es una capa de interfaz, pero el diff del archivo incluirá
> más que pines y cámara. Se revisará línea a línea.

## 3. Qué hace cada botón flotante hoy

| Botón | Qué hace | Dónde |
|---|---|---|
| Recargar | `window.location.reload()`: recarga la página entera | `home/page.tsx:1644-1653` |
| 3D | Activa `vista3d`; `MapContent` inclina la cámara con `PITCH_3D`/`BEARING_3D` | `home/page.tsx:1659-1673`; `MapContent.tsx:456-478` |
| Fuego | Abre **Novedades cerca de ti** (`/api/novedades`): ofertas, productos nuevos, cambios de precio y actualizaciones | `src/components/map/novedades-mapa.tsx:47-59, 111, 318` |
| Campana | Panel de notificaciones | `src/components/map/map-notifications.tsx` |
| Luna | Cambia el tema claro/oscuro de **toda la app** con `next-themes` | `src/components/layout/theme-toggle.tsx:21, 31` |
| Ubicación | Pide GPS y vuela el mapa | `MapContent.tsx:666-753` |
| Zoom + / − | `NavigationControl` de MapLibre, abajo a la izquierda | `MapContent.tsx:269` |
| Instalar app | Prompt PWA, solo cuando Chromium lo permite | `src/components/map/install-map-button.tsx`; `home/page.tsx:1688` |

**El refresco real del catálogo** es el `RefreshCw` de la hoja
(`home/page.tsx:1742-1753`), que llama a `refreshPlaces()`
(`home/page.tsx:1249-1254`). El de arriba a la izquierda solo recarga la página.

## 4. Recomendaciones, orden, distancia y refresco

- La lista sale de `listVisiblePlaces` (`home/page.tsx:909-916`): catálogo
  recortado por provincia, sin fichas de relleno y con los filtros del usuario.
- `filteredPlaces` (`home/page.tsx:1028-1052`) mide distancias con `haversineM`
  y ahora ordena con `ordenarCercaDeTi` (`src/lib/cerca-de-ti.ts`): abiertos por
  distancia; cerrados por próxima apertura y después por distancia.
- `personalizePlaces` (`src/lib/personalized-recommendations.ts`) ordena antes;
  el orden final de «Cerca de ti» manda sobre él.
- La distancia se calcula desde `distanceOrigin` (`home/page.tsx:1019-1026`):
  GPS, última posición conocida o centro de la provincia.
- Refresco: `PlacesProvider` pide el catálogo al montar y al volver la conexión
  (`src/providers/places-provider.tsx:339-370`). **No hay intervalo periódico.**
  El home solo actualiza `ahora` cada minuto (`home/page.tsx:595-600`).
- Los resultados de la IA se guardan en `resultPlaces`
  (`home/page.tsx:1564-1588`) y respetan el orden del modelo.

## 5. «Abierto/Cerrado» y la hidratación

- La lógica vive en `src/lib/ficha/horario.ts`: `estadoApertura` (`447-571`),
  `proximaAperturaMs` (`582-596`) y, desde esta sesión, `estadoVisible` (nuevo).
- `estadoVisible` unifica el horario estructurado, las excepciones, el cierre
  manual, la apertura manual y las fichas antiguas con `schedule` en texto.
- El texto vive en `src/config/ficha.ts:215-243` (`textoEstado`). Ahora usa 24 h
  y las frases del prompt: «Abierto · cierra a las 23:00», «Cerrado · abre hoy a
  las 8:00», «Cerrado · abre mañana a las 8:00», «Cerrado · abre el lunes a las
  9:00» y «Cerrado temporalmente».
- La ficha lo pinta en `src/components/place/ficha/estado-apertura.tsx:39-49`:
  el `now` inicial viene del servidor (`nowIso`) y se recalcula cada minuto en el
  cliente. Ese patrón evita el desajuste de React #418; el home hace lo mismo con
  `ahora` en `null` hasta montar (`home/page.tsx:595-600`).
- Pruebas nuevas: `src/lib/ficha/estado-visible.test.ts`.

## 6. Tipo, barrio, dirección y el «·» suelto

- La base mapea a `UserPlace` en `src/lib/db/mappers.ts:127-300`: `category` sale
  de `categories.name`, `address` de `places.address`, `barrio` de
  `neighborhood` con caída a `city` (`152-158`).
- El mapeo ahora normaliza **al mostrar**: `formatearBarrio` y
  `formatearDireccion` (`src/lib/texto-lugar.ts`) en `mappers.ts:152-165`.
  Al crear una ficha nueva también se guarda limpio (`toNewPlaceValues`).
  **No se reescriben filas existentes.**
- El «·» suelto venía de concatenar a mano: `home/page.tsx:559` (categoría +
  barrio), `home/page.tsx:425` (tarjeta de detalle), `place-detail.tsx:245` y
  `690` (dirección + barrio) y `direccion-contacto.tsx:113`. Ahora todos usan
  `unirPartes`/`formatearDireccion`.
- `PlaceCard` reconoce el estado por `state`, no por el texto, para que el chip
  pueda decir «Cerrado · abre hoy a las 8:00» sin perder el color
  (`src/components/layout/place-card.tsx:71-80`).
- Informe: `INFORME-BARRIOS-DIRECCIONES.md` (3 barrios, 3 direcciones).

## 7. Qué existe para el usuario

| Función | Estado real | Dónde |
|---|---|---|
| Favoritos | Sí: `savedIds` en `localStorage` y sección «Guardados» del perfil | `src/lib/activity-store.ts`; `src/components/profile/places-view.tsx:195-204` |
| Tarjetas de cliente frecuente | Solo la tarjeta pública por token; **no hay lista «mis tarjetas»** | `src/app/m/[slug]/tarjeta/[token]/page.tsx` |
| Pedidos del cliente | No hay historial de cliente; `/api/pedidos` es la cocina del negocio | `src/app/api/pedidos/route.ts` |
| Pedidos pendientes del negocio | Sí: contador por negocio | `src/app/api/pedidos/pendientes/route.ts` |
| Tema | Sí: `next-themes` y ajustes del perfil | `theme-toggle.tsx`; `src/components/profile/settings-view.tsx:181-197` |
| Ayuda y soporte | Sí: formulario de ticket en Ajustes | `src/components/profile/support-request.tsx` |
| Pendientes del admin | Sí: contadores | `src/app/api/admin/contadores/route.ts` |
| Tipos sospechosos | Nuevo: API y detección; la pantalla del admin queda pendiente de diseño | `src/lib/admin-tipos-sospechosos.ts`; `src/app/api/admin/tipos-sospechosos/route.ts` |

## 8. Búsqueda con IA

- `handleSearch` (`home/page.tsx:1044-1218`) arma el catálogo con ubicación,
  provincia, pagos, horario, energía, pedidos y distancia; hace `POST
  /api/ai/search`; guarda los `matches` en `saveAiRecommendations`; pone
  `sheetState` en `results` o `no-results`.
- Los resultados vuelven a la lista con `resultPlaces` y a los pines porque los
  pines salen de `places` filtrado, no de la respuesta de la IA.
- Sin red o con conexión lenta se cae a `buscarLugaresLocales` y se avisa con un
  `toast`; no se cambia el backend.

## 9. Riesgos para las siguientes fases

1. **Novedades no tiene sitio** si el fuego se convierte en «Populares». Hay que
   decidir si se mueve a la campana, a una sección propia o se queda como botón.
2. **`InstallMapButton`** no está en el inventario del prompt.
3. **No hay refresco automático**; quitar los dos botones deja la lista sin
   forma de actualizarse a mano.
4. **La barra y el menú son globales**; la variante del home necesita un `prop`
   para no cambiar todas las páginas.
5. **`BottomSheet` solo tiene dos alturas** (`peek` 120 px y `full` 70vh);
   habrá que extenderlo a tres.
6. **El popup y el botón de ubicación viven en `MapContent`**; moverlos exige
   revisar el diff del mapa línea a línea.
7. **«Mis pedidos» para dueños** debe mostrarse solo si el negocio tiene
   `pedidosHabilitado` y el usuario puede gestionarlo; el contador ya existe.
