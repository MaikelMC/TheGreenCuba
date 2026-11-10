# PWA, fase 1: una base sólida sin conexión

## Contexto

La Verde ya tiene un service worker propio (`public/sw.js`, v3, escrito a mano), un manifest (`src/app/manifest.ts`), un aviso de versión nueva (`PwaRegister`) y snapshots del dueño en IndexedDB (`la-verde-offline`). Esta fase corrige los fallos que hacen que el modo sin conexión no sea fiable, **sin cambiar de arquitectura**:

1. El almacenamiento se puede borrar en cualquier momento.
2. El pedido por WhatsApp no funciona sin red.
3. Las teselas del mapa no se guardan.
4. No hay ningún aviso de que no hay conexión.

Las fases siguientes se encargarán de lo demás: los negocios por provincia (fase 2), el mapa propio en el VPS (fase 3), el panel del dueño sin conexión (fase 4) y la comodidad (fase 5).

## Reglas

- **Se mantiene el service worker escrito a mano.** No metas Serwist, `next-pwa` ni Workbox. Cambios mínimos sobre `public/sw.js`.
- **Las cuatro cachés y sus estrategias actuales se mantienen**, salvo lo que se indica aquí. Al cambiar el SW, sube la versión para que se limpien las cachés viejas, como ya hace el ciclo `install`/`activate`.
- **Nada privado se cachea:** auth, `/api/me`, `/api/business/*`, `/api/pedidos/*` y las rutas `/admin`, `/business` y `/profile` siguen fuera de la caché.
- **Generales:** sin dependencias nuevas. UI, código y comentarios en español.
- **Diseño:** igual que en las funcionalidades:
  - `ui-ux-pro-max` al planificar, `design-taste-frontend` al construir e `impeccable` para revisar,
  - los tokens del proyecto (`verde-*`, `ink`, `muted-foreground`, `bg-card`, radios `lv`) y `sonner`,
  - prueba a 360 px, áreas táctiles de 44 px y contraste AA.

## Qué hay que hacer

### 1. Almacenamiento persistente

- **Pedir persistencia:** llama a `navigator.storage.persist()` desde `PwaRegister`, sin molestar con permisos. Pídelo cuando ocurra lo primero de esto:
  - la app se abre instalada (`display-mode: standalone`),
  - el usuario guarda un negocio,
  - el usuario hace su primer pedido,
  - un dueño entra a su panel.
- **Guardar el resultado:** si ya es persistente (`navigator.storage.persisted()`), no lo vuelvas a pedir. Guarda el resultado en el store `meta` de IndexedDB.
- **Helper:** crea `estadoAlmacenamiento()` en `src/lib/offline/` que devuelva si es persistente y el uso y la cuota (`navigator.storage.estimate()`). Lo usará la fase 5.

### 2. Pedido y reserva sin conexión

Hoy el carrito y la reserva fallan sin red, porque primero se registra el pedido en el servidor y después se abre WhatsApp. **WhatsApp guarda el mensaje y lo envía cuando vuelve la red, así que La Verde no debe bloquearlo.**

- **Crea `src/lib/offline/cola.ts`:** una cola de envíos pendientes en un store nuevo `cola` de `la-verde-offline`. Cada elemento lleva:
  - un `id`,
  - un `tipo`: `pedido` o `reserva`,
  - la `ruta`, el `metodo` y el `cuerpo`,
  - `creadoEn` e `intentos`.

  **Funciones:** `encolar`, `pendientes`, `procesarCola`.

  **`procesarCola`:**
  - reenvía en orden,
  - borra lo que el servidor confirma,
  - con un error 4xx, descarta el elemento y lo registra en consola,
  - con un error de red o 5xx, lo deja para después, con espera creciente.

  Hazla genérica: la fase 4 la usará para las acciones del dueño.
- **En `src/lib/pedido.ts` y en el flujo de reserva (`src/lib/reserva.ts` y su componente):**
  - el mensaje y el enlace `wa.me` se arman en el cliente, como ya se hace,
  - si el registro en el servidor falla por falta de red, se encola **y se abre WhatsApp igualmente**,
  - con red, el comportamiento es el de ahora,
  - el registro en la tabla `pedidos` tiene que poder recibirse más tarde sin duplicarse: usa un id generado en el cliente como clave idempotente, y si la ruta no lo admite, adáptala.
- **Cuándo se procesa la cola:** al volver la red (evento `online`), al abrir la app y cada vez que el SW avise.
- **Aviso al usuario:** si un pedido se encoló, un toast discreto: «Te abrimos WhatsApp. Guardaremos tu pedido en La Verde cuando vuelva la conexión».

### 3. Teselas del mapa: guardar las que ya se vieron

Mientras llega el mapa propio de la fase 3, que el mapa no salga en blanco en las zonas que el usuario ya miró.

- **En la configuración de la capa de Leaflet (`map-config.ts` y el componente del mapa):** activa `crossOrigin: true`. Así las teselas de OpenStreetMap llegan como respuestas CORS normales y no opacas, que en Chrome ocupan muchísimo espacio de cuota.
- **En `sw.js`, una caché nueva `lv-tiles-{v}`:** para las peticiones a los dominios de teselas configurados en `map-config.ts`, usa cache-first sobre lo ya visto, con un máximo de 1 500 teselas y caducidad de 30 días. Borra las más antiguas al pasar el límite.
- **Nunca descargues teselas por adelantado** (ni prefetch ni zonas enteras). Las normas de uso de OpenStreetMap lo prohíben. Solo se guarda lo que el usuario ya vio.
- **Sin red y sin la tesela guardada:** responde con una tesela de relleno transparente o del color de fondo de la app, en vez de un error.

### 4. Indicador de conexión

- **Componente nuevo `src/components/layout/estado-conexion.tsx`:** se monta una sola vez en el layout principal y escucha `online` y `offline`.
- **Sin conexión:** una franja fina arriba, debajo de la barra de estado, que no tape la navegación, con el texto «Sin conexión · Viendo datos guardados».
- **Al volver:** «De nuevo en línea», que desaparece a los 2 segundos. Si había pedidos en la cola, «Enviando 1 pedido pendiente…».
- **Accesibilidad:** el anuncio va en `role="status"`, y el aviso no depende solo del color.
- **Búsqueda con IA sin red:** el botón de búsqueda IA se desactiva con «Necesita conexión», y la búsqueda de texto y filtros sigue funcionando. Si falla a mitad de una búsqueda, cae sola a la búsqueda de texto con el aviso «Sin conexión: mostrando resultados guardados».

### 5. Navegación sin conexión

- **Comprueba qué pasa al navegar sin red** entre rutas públicas ya visitadas (`/home`, `/place/[id]`, `/m/[slug]`). Las peticiones RSC del App Router no se interceptan. Confirma que, si fallan, Next hace una navegación completa y el SW sirve el HTML guardado.
- **Si no es así,** propón la solución más pequeña y explícamela antes de aplicarla.
- **Ruta pública no visitada:** una página sin conexión útil en vez de la de error del navegador. Que `offline.html` muestre arriba un enlace a «Volver al mapa» (`/home`, que estará en caché) y la lista de fichas y cartas guardadas en `lv-pages-{v}`, leyendo sus URLs de la caché.

### 6. Precache del arranque

Revisa la lista de precache de `lv-static-{v}`:
- **La fuente:** precachea Space Grotesk, pero la app usa DM Sans y Source Sans 3. Precachea las fuentes que de verdad se usan, desde `src/fonts/` o las que genera `next/font`.
- **La página de inicio:** añade `/home` al precache, para que la app abra siempre aunque sea la primera vez sin conexión después de instalarla.

## Cómo trabajar

1. Dime qué archivos vas a crear y modificar, y cómo quedan las cachés del SW después del cambio (tabla de caché, qué guarda, estrategia y límites). Espera mi visto bueno.
2. Implementa en este orden:
   1. Persistencia
   2. Cola y pedido/reserva sin red
   3. Teselas
   4. Indicador de conexión
   5. Navegación sin conexión y `offline.html`
   6. Precache
3. Haz la revisión de diseño con `impeccable`, si está instalada.
4. Ejecuta el typecheck, el lint y los tests. El build lo lanzo yo: dime cuándo.

## Cómo lo pruebo yo

Al terminar, dame una lista de pasos para probarlo en Chrome de escritorio (DevTools → Application → Service Workers y Network → Offline) y en un Android real con la app instalada, en modo avión. Incluye:

1. **Instalar la app** y comprobar que el almacenamiento es persistente.
2. **Ver el mapa con red,** pasar a modo avión y volver a esa zona: el mapa se ve.
3. **En modo avión, abrir una carta ya visitada,** añadir productos y pedir: se abre WhatsApp y el pedido queda en la cola.
4. **Volver a tener red:** el pedido se registra una sola vez en `pedidos`.
5. **El indicador de conexión** aparece y desaparece bien.
6. **Navegar sin red** entre páginas ya visitadas.

## Comprobación final

Dame esta lista marcada:

- [ ] `navigator.storage.persist()` se pide en los momentos indicados, y solo una vez.
- [ ] Con red, pedidos y reservas funcionan exactamente igual que antes.
- [ ] Sin red, el pedido y la reserva abren WhatsApp y quedan en la cola.
- [ ] La cola se envía al volver la red, sin duplicar pedidos.
- [ ] Las teselas ya vistas se ven sin conexión, y nunca se descargan por adelantado.
- [ ] La caché de teselas no pasa de 1 500 entradas.
- [ ] El indicador de conexión funciona y es accesible.
- [ ] La búsqueda IA se desactiva sin red, y la de texto sigue.
- [ ] Ninguna ruta privada ni dato de sesión entra en la caché.
- [ ] La versión del SW sube y las cachés viejas se limpian.
- [ ] Typecheck, lint y tests sin errores.

Termina con un resumen de los archivos tocados y cualquier decisión que hayas tomado por tu cuenta.
