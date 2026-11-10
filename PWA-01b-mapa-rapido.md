# PWA, fase 1b: que el mapa cargue rápido

## El problema (reportado en el móvil)

- El mapa tarda en aparecer, más todavía en la PWA instalada.
- **Las fotos de los negocios cargan antes que el mapa.**
- Al hacer zoom, lo que ya se veía desaparece y queda una cuadrícula vacía, y las teselas aparecen muy despacio. Al moverse pasa lo mismo.

## Lo primero: medir

Antes de cambiar nada, con Chrome DevTools en modo móvil (CPU 4x más lenta y red «Fast 4G»), haz una grabación de Performance y otra de Network al abrir `/home` y hacer dos zooms. Dime:

1. **En qué orden se piden** el JS del mapa, `/api/places`, las imágenes y las teselas, y cuánto tarda cada grupo.
2. **El tiempo del service worker** en atender las teselas (en Network, la columna Time de las peticiones de teselas, con y sin SW).
3. **El trabajo del SW:** si `sw.js` hace `cache.keys()` o borra entradas en cada tesela.
4. **Cuántas imágenes se piden** antes de que se pinte la primera tesela, y de qué componente salen (marcadores, lista, tarjetas).

## Qué hay que corregir

### 1. Service worker: que no frene las teselas

- **Con la tesela en la caché:** se responde directamente, sin otra comprobación.
- **Sin la tesela en la caché:** se pide a la red y se responde **en cuanto llega**. El guardado en la caché va después, dentro de `event.waitUntil`, sin hacer esperar a la respuesta.
- **Limpieza del límite de 1 500:** nunca en cada petición. Hazla por lotes: como mucho una vez cada 100 teselas guardadas o cada pocos minutos, en segundo plano, borrando de una vez las más antiguas que sobren.
- **Aplica lo mismo a `lv-images`.**
- **Sube la versión del SW.**

### 2. Primero el mapa, después lo demás

1. **El mapa y sus teselas se pintan primero.** El componente del mapa y Leaflet se cargan sin esperar a `/api/places`. Si hoy el mapa espera a tener los negocios para montarse, sepáralo: el mapa sale con su fondo y los marcadores aparecen cuando llegan los datos.
2. **Los marcadores no llevan fotos.** Pin o círculo con el color o el icono de la categoría, dibujado en canvas o como `divIcon` ligero. Si hoy un marcador carga una imagen, quítala del marcador.
3. **Las imágenes de la lista y de las tarjetas:**
   - solo se cargan cuando están a la vista (`loading="lazy"`), con `fetchPriority="low"`,
   - con un tamaño pequeño en `/_next/image` (unos 160 px de ancho, calidad 60),
   - ninguna imagen se pide antes de que el mapa haya pintado sus primeras teselas.
4. **Preconexión:** `<link rel="preconnect">` a los dominios de teselas configurados, en el `<head>` de las páginas con mapa.

### 3. Leaflet: suavizar el zoom y el movimiento

En `map-config.ts` y en el `<TileLayer>` de `MapContent.tsx`:

| Ajuste | Valor | Por qué |
| --- | --- | --- |
| `keepBuffer` | 4 | Guarda más teselas alrededor de la vista, para que al moverse ya estén |
| `updateWhenZooming` | `false` | No pide teselas a mitad de la animación del zoom |
| `updateWhenIdle` | `true` | Pide las teselas cuando el mapa se queda quieto, en vez de en cada movimiento |
| Color de fondo del contenedor | El de la tierra del mapa | Mientras llega una tesela no se ve una cuadrícula gris o blanca |
| `crossOrigin` | Se mantiene | Lo necesita la caché de teselas |

Comprueba también:
- **`fadeAnimation`:** si está activo, mantenlo corto o desactívalo en móvil si da sensación de lentitud.
- **El zoom máximo:** que no pase del máximo nativo del proveedor, para no pedir teselas que no existen.

### 4. Mantener la vista de antes del zoom

Mientras cargan las teselas del nuevo zoom, que siga visible la capa del zoom anterior, escalada, en vez de un vacío. Si Leaflet no lo hace con la configuración actual, prueba la solución más ligera **sin dependencias nuevas** y dime qué hiciste. Si no hay una solución limpia, dímelo: se resolverá en la fase 3 con el mapa vectorial.

## Cómo trabajar

1. Dame primero las mediciones y lo que vas a cambiar. Espera mi visto bueno.
2. Implementa.
3. Repite las mismas mediciones y dame el antes y el después.
4. Ejecuta el typecheck, el lint y los tests. El build lo lanzo yo.

## Comprobación final

- [ ] La primera tesela se pinta antes que cualquier imagen de negocio.
- [ ] Los marcadores no cargan fotos.
- [ ] El SW ya no recorre la caché en cada tesela, y el tiempo de las teselas con SW es parecido al de sin SW.
- [ ] Al hacer zoom y al moverse no aparece una cuadrícula vacía, o se nota mucho menos (con antes y después).
- [ ] Las imágenes de la lista solo cargan al verse y en tamaño pequeño.
- [ ] Mediciones de antes y después.
