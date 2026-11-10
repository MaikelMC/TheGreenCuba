# PWA, fase 2b: la app completa sin conexión

## Contexto

Con las fases 1, 1b, 2 y 3 terminadas:
- el mapa (MapLibre) guarda las zonas vistas,
- los negocios de las provincias vistas, sus fichas y sus cartas están en IndexedDB,
- existe la página de ficha sin conexión (`/sin-conexion/negocio`),
- existe la cola de envíos pendientes.

Esta fase cierra el círculo: **que la app se abra sin conexión y muestre todo lo que el usuario ya vio con conexión**, y que ninguna pantalla se rompa.

**Requisito:** la fase 2 (negocios en el teléfono) está terminada.

## Reglas

- **Generales:** sin dependencias nuevas. UI, código y comentarios en español.
- **Datos privados:**
  - nunca en la Cache Storage del service worker, ni en HTML ni en respuestas de API,
  - van en IndexedDB, asociados al `userId`, y se pintan desde componentes de cliente,
  - se borran al cerrar sesión,
  - se bloquean si la sesión lleva más de 7 días sin verificarse, como ya hace `offline.html` con `lastAuthAt`.
- **Lo que de verdad necesita red se dice, no falla:** botón desactivado con «Necesita conexión», nunca un error ni una pantalla en blanco.
- **Diseño:** igual que en las fases anteriores (skills `ui-ux-pro-max`, `design-taste-frontend` e `impeccable`, tokens del proyecto, modo claro y oscuro, prueba a 360 px, áreas táctiles de 44 px y contraste AA).

## Antes de empezar: inventario de rutas

Haz una tabla con **todas** las rutas que puede abrir un usuario normal y un dueño (incluidas las del dock o menú de navegación), con estas columnas:

| Columna | Qué poner |
| --- | --- |
| Ruta | La ruta |
| Pública o privada | — |
| Hoy sin conexión | Qué pasa: funciona, `offline.html`, error o blanco |
| Datos que muestra | De dónde salen |
| Propuesta sin conexión | **Caché de página** (pública, network-first en `lv-pages`), **página local** (componente de cliente que pinta desde IndexedDB), o **«necesita conexión»** (pantalla con aviso y vuelta atrás) |

Espera mi visto bueno antes de implementar.

## Qué hay que hacer

### 1. Navegación sin conexión

- **Cada enlace del dock o menú principal** (mapa, buscar, guardados, perfil, notificaciones, panel si es dueño) abre algo útil sin red. Nunca la página de error del navegador ni un blanco.
- **Rutas públicas:** network-first en `lv-pages`, como hasta ahora.
  - Las principales (`/home` y las secciones del dock que sean públicas) se precachean al instalar el SW.
  - Si una pública no está guardada, se sirve su página local si existe, o la página «necesita conexión» con un enlace al mapa.
- **Navegación del App Router sin red:** comprueba que una petición RSC fallida acaba en navegación completa y en la página que toca según la tabla. Si no, corrígelo con la solución más pequeña posible.

### 2. Sección del usuario sin conexión

Las rutas privadas del usuario (perfil y sus subsecciones) **no** se cachean como HTML. En su lugar:

**Snapshot del usuario en IndexedDB:** amplía el snapshot `profile:{userId}` que ya existe. Se actualiza cada vez que el usuario abre su sección con conexión, y cada vez que cambia algo:

| Dato | Detalle |
| --- | --- |
| Perfil | Nombre, foto (en miniatura) y ciudad |
| Guardados | Ids, que se pintan con los datos de los negocios de la fase 2 |
| Actividad reciente | La de `activity-store` |
| Notificaciones | Las últimas 30 |
| Reseñas propias | Si existen |
| Pedidos y reservas | Los últimos 20 que hizo desde La Verde (ver punto 3) |

**Página local `/sin-conexion/perfil`:** de solo cliente, se precachea al instalar.
- Pinta la sección del usuario desde el snapshot, reutilizando los componentes de la sección real siempre que se pueda.
- En el SW, si se pide una ruta del perfil sin red, se sirve esta página. Nunca `offline.html`.
- Arriba, una franja discreta: «Sin conexión · Datos de {hace X}».
- **Acciones de escritura:**
  - **Necesitan red:** editar el perfil, escribir una reseña, cambiar ajustes de la cuenta. Se desactivan con «Necesita conexión».
  - **Funcionan sin red:** guardar o quitar un guardado, y marcar una notificación como leída, que se encolan con la cola de la fase 1.

**Sin sesión:** el perfil muestra los guardados y la actividad locales, como hoy, con la invitación a iniciar sesión, que se desactiva sin red.

### 3. Mis pedidos y reservas

- Cada pedido o reserva que el usuario hace (con o sin red) se guarda también en un store `mis_pedidos` de IndexedDB:
  - negocio, líneas, total, entrega y fecha,
  - estado local: `enviado` o `pendiente de registrar` si está en la cola.
- Se muestran en la sección del usuario, «Mis pedidos», con el botón «Repetir pedido», que rellena el carrito con lo mismo y funciona sin red.
- Si la app ya tiene una lista de pedidos del usuario en el servidor, se mezcla con la local sin duplicar, por el id del pedido.

### 4. Imágenes de lo ya visto

- **Fotos de portada y de productos** de las fichas y cartas abiertas: se guardan en `lv-images` en tamaño reducido (unos 640 px de ancho, calidad 60), dentro del mismo límite y recorte por lotes.
- **La foto del usuario,** en miniatura.
- **Sin imagen guardada:** el marcador vacío con el icono de la categoría, como en la fase 2. Nunca el icono de imagen rota del navegador.

### 5. Estados y avisos comunes

- **Componente reutilizable `NecesitaConexion`:** icono, una línea y botón de volver. Para las pantallas que solo funcionan con red.
- **Botones de acciones que necesitan red:** desactivados con un texto corto y el motivo accesible (`aria-describedby`). No basta con ocultarlos.
- **«Datos de hace X»** en las vistas locales, calculado con la fecha de la última sincronización.
- **Al volver la red:** las vistas locales se refrescan solas, sin recargar la página.

### 6. `offline.html`

Queda solo como último recurso, cuando no hay nada mejor que servir. Que tenga enlaces al mapa, a «Mis guardados» y a «Mi perfil». Los dos últimos apuntan a las páginas locales.

### 7. Cerrar sesión

- Borra el snapshot del usuario, `mis_pedidos`, las entradas de la cola de ese usuario (avisando antes si hay pendientes: «Tienes 2 cambios sin enviar. Si cierras sesión se perderán») y cualquier otro dato privado de IndexedDB.
- Los negocios públicos y las teselas del mapa se quedan.

## Cómo trabajar

1. Primero el inventario de rutas, y espera mi visto bueno.
2. Luego dime qué archivos vas a crear y modificar. Espera mi visto bueno otra vez.
3. Implementa en este orden:
   1. Navegación
   2. Snapshot del usuario y `/sin-conexion/perfil`
   3. Mis pedidos
   4. Imágenes
   5. Estados comunes
   6. `offline.html`
   7. Cierre de sesión
4. Haz la revisión de diseño con `impeccable`, si está instalada.
5. Ejecuta el typecheck, el lint y los tests. El build lo lanzo yo.

## Cómo lo pruebo yo

En un Android con la PWA instalada y en un iPhone con la app en la pantalla de inicio:

1. **Con red:** usar la app normalmente. Ver el mapa, abrir 3 negocios, guardar 2, hacer un pedido y entrar al perfil.
2. **Modo avión y cerrar la app del todo.**
3. **Abrir la app:**
   - el mapa con las zonas vistas y los negocios,
   - la navegación por todas las secciones del dock,
   - las fichas y cartas abiertas,
   - los guardados,
   - el perfil con sus datos,
   - «Mis pedidos», con «Repetir pedido» funcionando hasta WhatsApp.
4. **Lo que necesita red** muestra «Necesita conexión», sin errores.
5. **Volver a tener red:** todo se actualiza solo, y lo encolado se envía.
6. **Cerrar sesión:** el perfil ya no muestra datos privados, ni con red ni sin ella.

## Comprobación final

- [ ] Inventario de rutas aprobado, y cada ruta se comporta sin red como dice la tabla.
- [ ] Ningún enlace de la navegación lleva a un error o a un blanco sin conexión.
- [ ] El perfil se ve sin red con su snapshot, y ningún HTML ni respuesta privada está en Cache Storage.
- [ ] «Mis pedidos» funciona sin red, y «Repetir pedido» llega a WhatsApp.
- [ ] Las imágenes ya vistas salen sin red, y las que no, con su marcador.
- [ ] Las acciones que necesitan red están desactivadas con su motivo.
- [ ] «Datos de hace X» aparece en las vistas locales.
- [ ] Al volver la red, todo se refresca y la cola se envía.
- [ ] Cerrar sesión borra los datos privados locales y avisa de los pendientes.
- [ ] La sesión caducada (más de 7 días) bloquea los datos privados sin red.
- [ ] Modo claro y oscuro, 360 px, áreas táctiles de 44 px y contraste AA.
- [ ] Typecheck, lint y tests sin errores.

Termina con un resumen de los archivos tocados y cualquier decisión que hayas tomado por tu cuenta.
