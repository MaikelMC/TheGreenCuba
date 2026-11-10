# PWA, fase 2: los negocios en el teléfono

## Contexto

Hoy el mapa pide `/api/places`, que devuelve hasta 200 negocios completos, con su carta y sus fotos (entre 200 y 500 KB sin comprimir). El service worker guarda esa respuesta en `lv-api`. Pasan tres cosas:
- si la descarga se corta, no queda nada,
- cada actualización vuelve a bajarlo todo,
- con más negocios no escala.

Esta fase cambia ese modelo por uno pensado para datos caros:

1. **Datos ligeros:** para el mapa, la lista y la búsqueda, solo lo necesario, sin la carta.
2. **Por provincia:** se descarga la provincia que el usuario está mirando, y otras solo cuando mueve el mapa hasta ellas. Es la misma regla que el mapa: solo lo que el usuario ve.
3. **Guardado en IndexedDB:** la app abre al instante con lo guardado y se actualiza por detrás.
4. **Actualizaciones pequeñas:** después de la primera descarga, solo se piden los cambios desde la última vez.
5. **La carta, aparte:** se descarga al abrir la ficha o la carta, o al guardar un negocio, y queda guardada.
6. **Ficha sin conexión** de cualquier negocio ya descargado, aunque nunca se haya abierto su página.

**Requisito:** la fase 1 está terminada (cola, persistencia e indicador de conexión).

## Reglas

- **Generales:** sin dependencias nuevas. UI, código y comentarios en español.
- **Lo que no se rompe:** la búsqueda con IA sigue siendo solo con conexión. La búsqueda de texto y filtros, en el cliente, sigue funcionando y ahora lee los datos locales.
- **Compatibilidad:** `/api/places` no se borra ni cambia su respuesta, por si algo más lo usa. El mapa y la búsqueda dejan de usarlo.
- **Nada privado:** nada de datos de sesión ni de dueños en los datos públicos descargados.
- **Diseño:** igual que en las fases anteriores (skills `ui-ux-pro-max`, `design-taste-frontend` e `impeccable`, tokens del proyecto, prueba a 360 px, áreas táctiles de 44 px y contraste AA).

## Antes de empezar: revisa lo que ya existe

Cuéntame y espera mi visto bueno:

1. **Fecha de modificación de `places`:** si existe una columna como `updated_at`, si se actualiza en **todas** las escrituras (ficha, carta, «Hoy hay», tasa, zonas, estado) y si tiene índice.
2. **Negocios que dejan de ser públicos:** cómo se dan de baja o se ocultan (`is_active`, `status`, borrado real) y qué filtros aplica hoy `/api/places`.
3. **`PlacesProvider`:** qué datos usa cada componente (mapa, lista, tarjeta, filtros, búsqueda de texto) y cuáles necesitan la carta.
4. **La carga del mapa:** si el mapa pide los negocios por zona visible (bounds), por ciudad o todos de golpe.
5. **Tamaños reales:**
   - el tamaño de una respuesta típica de `/api/places`, con y sin gzip,
   - el tamaño medio de un `menu` (jsonb) por negocio.
6. **Guardados:** cómo funcionan (`saved_places`, su ruta de API y su componente).
7. **Cómo se pone la versión del service worker:** hoy es `v4` a mano en `public/sw.js`.

## Qué hay que hacer

### 1. Versión del service worker automática

Hoy la versión del SW se sube a mano. Si un despliegue no la sube, los teléfonos se quedan con HTML viejo que apunta a archivos de JavaScript que ya no existen.

- Haz que la versión del SW salga del id del build de Next (o del hash del commit) **automáticamente en cada build**. Por ejemplo, con un script `prebuild` que escriba la versión en `public/sw.js` o en un archivo que el SW importe.
- Funciona igual en el `Dockerfile` o el comando de build que use el VPS. Dime qué toca cambiar ahí.

### 2. Endpoints ligeros

**`GET /api/negocios/provincia/[provincia]`:** los negocios públicos de una provincia, con **solo** estos campos (ajusta los nombres a los reales):

| Campos | Para qué |
| --- | --- |
| `id`, `slug`, `nombre`, `categoria`, `tipoNegocio` | Identificar y clasificar |
| `lat`, `lng`, `ciudad`, `barrio`, `direccion` | Mapa y ubicación |
| `descripcionCorta` | Tarjeta y búsqueda |
| `atributos`, `energiaRespaldo`, `verificado` | Filtros y etiquetas |
| `monedas` | Las que acepta |
| Horario compacto | Para calcular «abierto ahora» en el cliente |
| `whatsapp` | Botón de contacto |
| URL de la miniatura | Imagen de la tarjeta, ver punto 6 |
| `tieneCarta`, `cartaActualizadaEn` | Saber si hay carta y si cambió |
| `actualizadoEn` | Para las actualizaciones pequeñas |

- **Sin `menu`, sin fotos completas y sin datos privados.**
- Respuesta JSON compacta, con cabecera `ETag` (para responder 304 si no hay cambios) y `Cache-Control: no-cache`.
- Nginx la comprime con gzip, que ya está configurado.

**`GET /api/negocios/provincia/[provincia]/cambios?desde={ISO}`:** devuelve `{ cambiados: [...], eliminados: [ids], ahora: ISO }`.
- `cambiados`: negocios con `actualizadoEn > desde`, con los mismos campos ligeros.
- `eliminados`: los que dejaron de ser públicos desde esa fecha (cerrados, inactivos o borrados).
- Si hoy no hay forma de saber qué se borró, propón la más pequeña. Por ejemplo, una tabla `negocios_eliminados` (id, provincia, fecha) que se rellene al borrar o desactivar.
- Si `desde` tiene más de 30 días, responde `{ completo: true }` y el cliente vuelve a descargar la provincia entera.

**`GET /api/negocios/[id]/carta`:** el `menu` de un negocio con lo que se necesita para mostrarlo (`menu`, `menu_categorias`, `especial_dia`, ofertas vigentes, configuración de tasa y zonas si las tiene). Con `ETag`.

Ninguno de los tres pasa por la caché del service worker: de su almacenamiento se encarga IndexedDB. Añádelos a la lista de rutas que el SW no intercepta.

### 3. Almacén local (`src/lib/offline/negocios.ts`)

En la base `la-verde-offline` (sube su versión de esquema):

| Store | Qué guarda |
| --- | --- |
| `negocios` | Clave `id`, índices `provincia` y `slug` |
| `cartas` | Clave `id` del negocio, con `actualizadoEn` |
| `sync` | Por provincia: `ultimaSync`, `etag` |

**Funciones:**

| Función | Qué hace |
| --- | --- |
| `negociosDeProvincia(provincia)` | Devuelve los negocios guardados |
| `sincronizarProvincia(provincia)` | Sin datos: descarga completa. Con datos: pide los cambios desde `ultimaSync`, aplica `cambiados` y `eliminados` en una sola transacción y guarda la nueva `ultimaSync`. Si la descarga se corta, no deja la provincia a medias |
| `cartaDe(id)` | Devuelve la carta guardada y, si hay red y `cartaActualizadaEn` es más nueva, la actualiza por detrás |
| `guardarCarta(id, carta)` | Guarda la carta |
| `provinciasDescargadas()` | Para la fase 5 |

### 4. `PlacesProvider` lee de lo local

1. **Al abrir:** pinta en el acto los negocios guardados de la provincia actual, sin esperar a la red.
2. **Por detrás:** lanza `sincronizarProvincia`. Al terminar, actualiza la lista sin saltos visuales.
3. **Provincia actual:** la del centro del mapa. Usa `src/lib/map/cuba-areas` o las provincias que ya maneje la app para saber a qué provincia pertenece el centro.
4. **Al mover el mapa a otra provincia,** con el mapa quieto 1 segundo, se descarga y se guarda esa provincia. Nada se descarga si el usuario no llega a mirarla.
5. **Sin red:** solo lo guardado. Si una provincia no está descargada, un aviso discreto en el mapa: «Esta provincia no está guardada. Conéctate para verla».
6. **Frecuencia:** la sincronización se repite al volver a la app si han pasado más de 15 minutos, y al volver la red.

La búsqueda de texto y los filtros usan estos datos.
- Mejora la búsqueda de texto para que ignore tildes y mayúsculas.
- Que busque en nombre, categoría, barrio, descripción corta y atributos, y en los nombres de productos de las cartas que ya estén guardadas.

### 5. Ficha y carta sin conexión

- **Con red:** al abrir `/place/[id]` o `/m/[slug]`, la carta se guarda con `guardarCarta`.
- **Al guardar un negocio** (acción del usuario): también se descarga y se guarda su carta.
- **Página nueva de solo cliente `/sin-conexion/negocio`:** lee el id de la URL y pinta la ficha y la carta desde IndexedDB, reutilizando los componentes que ya existen siempre que se pueda.
  - Se guarda en `lv-pages` al instalar el SW, con la estrategia network-first.
  - Sin carta guardada: muestra la ficha con el aviso «La carta no está guardada. Conéctate para verla».
  - Desde aquí también funciona el carrito y el pedido por WhatsApp, con la cola de la fase 1.
- **En el SW:** si se pide `/place/[id]` o `/m/[slug]` sin red y no está en `lv-pages`, sirve `/sin-conexion/negocio` (pasándole el id o el slug) en vez de `offline.html`.

### 6. Imágenes

- **Miniaturas:** la miniatura de la tarjeta sale de `/_next/image` con un ancho pequeño (por ejemplo, 160 px, calidad 60). Nunca la foto completa.
- **Caché `lv-images`:** súbela de 80 a 400 entradas, con miniaturas pequeñas, para que quepan las de los negocios vistos.
- **Sin red:** donde no haya imagen guardada, el mismo marcador de imagen vacía que ya use la app, con el icono de la categoría.

### 7. Guardados sin conexión

- Con sesión, los guardados del usuario se reflejan en IndexedDB.
- Guardar o quitar un negocio sin red se aplica al momento en local y se envía con la cola de la fase 1.

### 8. Mediciones

Antes y después, dame:
- el peso con gzip de la primera carga de datos del mapa en Santiago de Cuba,
- el peso de una actualización sin cambios (debería ser un 304 casi vacío),
- el peso de la carta de un negocio típico.

## Cómo trabajar

1. Haz primero la revisión de lo que ya existe y espera mi visto bueno.
2. Luego dime qué archivos vas a crear y modificar. Espera mi visto bueno otra vez.
3. Implementa en este orden:
   1. Versión automática del SW
   2. Endpoints
   3. Almacén local
   4. `PlacesProvider` y búsqueda
   5. Ficha y carta sin conexión
   6. Imágenes
   7. Guardados
4. Haz la revisión de diseño con `impeccable`, si está instalada.
5. Ejecuta el typecheck, el lint y los tests. El build lo lanzo yo.

## Cómo lo pruebo yo

Dame pasos para Chrome de escritorio y para un Android instalado en modo avión:

1. **Primera apertura con red en Santiago:** carga la provincia y mira su peso.
2. **Cerrar y abrir sin red:** el mapa y la lista salen al instante.
3. **Mover el mapa a otra provincia con red:** se descarga solo esa.
4. **Sin red, abrir la ficha de un negocio** nunca visitado, pero de una provincia descargada: se ve con la ficha local.
5. **Con red, cambiar «Hoy hay» en un negocio desde su panel.** En otro dispositivo, al volver a la app, el cambio llega en una actualización pequeña.
6. **Desactivar un negocio desde administración:** desaparece de los teléfonos en la siguiente sincronización.

## Comprobación final

Dame esta lista marcada:

- [ ] La versión del SW cambia sola en cada build, y tras desplegar la app no se queda con HTML viejo.
- [ ] El mapa y la búsqueda ya no usan `/api/places`, y `/api/places` sigue funcionando igual.
- [ ] La primera carga de Santiago pesa mucho menos que antes (dame las cifras).
- [ ] Las actualizaciones solo traen cambios, y un 304 cuando no hay nada.
- [ ] Los negocios dados de baja desaparecen del teléfono.
- [ ] Una descarga cortada no deja la provincia a medias.
- [ ] Solo se descargan las provincias que el usuario mira.
- [ ] La búsqueda de texto ignora tildes y busca también en las cartas guardadas.
- [ ] Ficha y carta sin conexión de negocios descargados, con pedido por WhatsApp funcionando.
- [ ] Guardar y quitar guardados sin red funciona y se sincroniza.
- [ ] Ningún dato privado en los endpoints públicos.
- [ ] Coherente con el resto de la app a 360 px, con todos los estados resueltos.
- [ ] Typecheck, lint y tests sin errores.

Termina con un resumen de los archivos tocados, las cifras de peso y cualquier decisión que hayas tomado por tu cuenta.
