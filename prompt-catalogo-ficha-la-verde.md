# Tarea: catálogo dentro de la ficha del lugar, según el tipo de negocio

## Contexto

Ya se aplicó el rediseño de la ficha pública (`/place/[id]`) con el esqueleto común y los módulos por tipo de negocio. **Pero el catálogo que se ve dentro de la ficha no cambió**: sigue usando las tarjetas antiguas (cuadrícula de 2 columnas, foto grande con placeholder gris, descripción cortada, paginación con flechas).

Esta tarea es **solo el bloque de catálogo dentro de la ficha**. No toques la carta completa (`Ver la carta` / menú QR) salvo que haga falta para compartir componentes, y si es así, pregúntame antes.

Respeta lo de siempre: código y UI en español, cambios mínimos, reutilizar antes de crear, sin dependencias nuevas, permisos y precios siempre en el servidor, y `src/lib/plans.ts` como única fuente de verdad de funciones.

## Fase 1 — Diagnóstico (antes de escribir código)

1. Localiza qué componente pinta hoy el catálogo dentro de la ficha y explícame **por qué el rediseño anterior no lo alcanzó** (componente separado, ruta distinta, variante cacheada, snapshot offline, etc.).
2. Revisa cómo se guarda un producto hoy: nombre, descripción, precio en texto libre, moneda, foto, categoría, etiqueta («Popular», «Nuevo», «2x1»), estado «Hoy hay» (disponible/agotado, con opción temporal), ofertas, orden.
3. Revisa cómo funcionan hoy el carrito y el envío del pedido por WhatsApp, y los tipos de reserva (`mesa`, `apartado`, `cita`).
4. Revisa dónde se guarda el tipo de negocio que se añadió en el rediseño.
5. Revisa cómo se tratan hoy los productos agotados en la ficha, en la carta completa, en el carrito, en la búsqueda con IA y en los snapshots offline, y explícame por qué el rediseño anterior no aplicó el tratamiento de agotados que se había pedido.
6. Hazme las preguntas que necesites, agrupadas y numeradas. Después propón el plan y espera mi aprobación.

## Reglas comunes a todos los tipos

### De dónde sale cada cosa
- Todo lo que se muestra viene de los datos del producto y de los ajustes del negocio. Nada escrito a mano.
- Si un campo está vacío, ese elemento no se pinta (sin descripción no hay línea de descripción; sin foto no hay hueco de foto).
- **Nunca mostrar placeholders grises con icono de imagen.** Si un producto no tiene foto, la tarjeta usa su variante sin foto (definida en cada tipo).

### Vista del catálogo editable
- Cada tipo tiene una **vista por defecto** (abajo), pero el negocio puede cambiarla desde **Ajustes → Catálogo en la ficha**: `lista con foto`, `lista de texto`, `cuadrícula`, `servicios`.
- También editable ahí: cuántos productos se muestran en la ficha antes de «Ver carta completa» (por defecto 6) y si se muestra el bloque de destacados.
- Si menos de la mitad de los productos visibles tiene foto y la vista es `cuadrícula`, usar automáticamente `lista de texto` en la ficha pública (y avisar al dueño en el panel: «Tus productos casi no tienen fotos; mostramos una lista. Sube fotos para usar la cuadrícula»).

### Orden y estados
- Orden: destacados primero, luego el orden que definió el negocio, y los agotados al final (ver la sección «Productos agotados»).
- Productos ocultos: no aparecen en ningún sitio público.
- Etiqueta («Popular», «Nuevo», «2x1»): una sola píldora pequeña junto al nombre.
- Oferta: precio de oferta en negrita y precio anterior tachado en gris al lado.

### Precio
- El precio es texto libre. Si se puede interpretar como número, formatearlo de forma uniforme (`2,000 CUP`). Si no (ej. «a consultar», «desde 500»), mostrar el texto tal cual.
- En el carrito, si algún producto no tiene precio numérico, el total muestra «Total a confirmar» en lugar de una cifra. Pregúntame cómo tratar carritos con monedas mezcladas.

### Categorías
- Píldoras horizontales con scroll (CSS `scroll-snap`, sin librerías), «Todas» primero, en el orden del negocio. Ocultar categorías sin productos visibles. Si solo hay una categoría, no mostrar píldoras.

### Permisos de plan
- El botón «+» y el carrito solo aparecen si el negocio tiene la función de pedidos (por módulo, pack o prueba) **y** los pedidos activados en Ajustes. Si no, la tarjeta se muestra igual pero sin botón de acción.
- Igual con «Reservar» y la función de reservas.
- La decisión se toma en el servidor; el cliente solo recibe si debe pintar la acción.

### Ligereza y accesibilidad
- Miniaturas pequeñas y optimizadas (WebP, tamaño acorde al hueco, `loading="lazy"`), nada de imágenes grandes en la ficha.
- Sin carruseles con flechas: listas verticales o scroll horizontal nativo.
- Zonas táctiles de al menos 44 px. `aria-label` en botones de icono («Añadir Tacos de Cerdo al pedido»). `alt` de la foto = nombre del producto.
- Debe funcionar en los snapshots offline de la PWA (el carrito puede armarse sin conexión; el envío abre WhatsApp).

### Estilo de las tarjetas (todas)
- Tarjeta blanca, borde 1 px `#E4E1D8`, radio 16 px, sin sombra.
- Nombre: 15 px, peso 700, color `#1C2620`, una línea con elipsis (dos en cuadrícula).
- Descripción: 13 px, color `#5B6660`, una línea con elipsis.
- Precio: 15 px, peso 800.
- Acciones en el verde de marca (`#2E7D3F` o el color de marca del negocio si existe).
- Adáptalo a los componentes y tokens que ya existen en el proyecto; estos valores son la referencia visual aprobada.

## Productos agotados (aplica a todos los tipos)

Esto no se tuvo en cuenta en el rediseño anterior y es obligatorio en esta tarea. Un agotado **no es un producto oculto**: sigue siendo útil que el cliente sepa que el negocio lo vende, pero nunca debe estorbar ni poder pedirse.

### Qué cuenta como agotado
- Estado «Hoy hay» en agotado, con o sin fecha de vuelta.
- En tiendas con existencias activas: existencias en 0.
- Si tiene fecha de vuelta, vuelve a disponible **solo** al llegar la fecha, calculado en el servidor con la zona `America/Havana`, sin que el dueño tenga que hacer nada.

### Dónde y cómo se muestra
- **Posición**: siempre después de todos los disponibles, en un grupo aparte con el subtítulo «Agotado por hoy» (13 px, peso 700, gris `#5B6660`). Nunca mezclados con los disponibles ni como primeros de la lista.
- **Aspecto**: la misma tarjeta del tipo, pero en versión compacta (miniatura de 56 px si tiene foto) y atenuada (opacidad ~0.6). Nada de etiquetas grandes encima de la foto.
- **Texto de estado** a la derecha, en 12 px peso 700 rojo oscuro `#8A2F1F`: «Agotado». Si tiene fecha de vuelta: «Vuelve mañana» o «Vuelve el jueves» (en lugar del precio, o junto a él, según el espacio).
- **Sin acciones**: sin botón «+», sin «Reservar», sin «Apartar». En la cuadrícula de tienda, al tocar la tarjeta se abre la hoja de detalle sin botón de pedido.
- **Contador**: si hay más de 3 agotados, mostrar solo 3 y un enlace «Ver N agotados más» que despliega el resto.
- **Categorías**: si al filtrar por una categoría todos sus productos están agotados, mostrarlos en su grupo con el mensaje «Todo lo de esta categoría está agotado por hoy». La píldora de esa categoría se mantiene.
- **Destacados**: un producto agotado sale del bloque de destacados.
- **Especial de hoy** (cafeterías): si el plato del especial está agotado, el banner muestra «Agotado por hoy» en lugar del precio.
- **Todo agotado**: si no queda ningún disponible, mostrar arriba del catálogo un aviso suave «Hoy no queda nada disponible. Vuelve a consultar más tarde» y la lista de agotados debajo. En domicilio, la barra fija cambia a «Escribir por WhatsApp» (sin carrito).

### Carrito y pedidos
- Un producto agotado no se puede añadir al carrito.
- Si un producto pasa a agotado mientras ya está en el carrito de un cliente (o en un carrito guardado offline), al abrir la ficha o antes de enviar el pedido se marca en el carrito como «Ya no está disponible», se excluye del total y del mensaje de WhatsApp, y se avisa al cliente con un aviso corto.
- El servidor valida la disponibilidad al generar el pedido; nunca se confía en el estado que tenga el cliente.

### Búsqueda, carta completa y offline
- La carta completa (menú QR) aplica las mismas reglas: agotados al final, atenuados y sin acción. Pregúntame si prefieres no tocar la carta en esta tarea.
- En los resultados de búsqueda con IA, los productos agotados no deben usarse como motivo principal para recomendar un negocio («sitios con tacos» no debería priorizar uno cuyos tacos están todos agotados). Pregúntame antes de tocar la búsqueda.
- En los snapshots offline, guardar el estado de agotado y la hora de la última actualización, y mostrar «Disponibilidad de hace X» cuando el cliente esté sin conexión.

### Configuración del negocio
- En **Ajustes → Catálogo en la ficha**: opción «Mostrar productos agotados» (activada por defecto). Si la desactiva, los agotados no aparecen en la ficha, pero el producto no se borra ni pierde datos.
- En **Catálogo**: cambio rápido disponible/agotado en un toque desde la lista de productos (sin entrar a editar), con opción «Agotado hasta…» (hoy, mañana, fecha elegida, sin fecha).
- Ese mismo cambio debe poder hacerse desde el bot de Telegram, si ya existe un comando para «Hoy hay»; revisa y dime cómo está hoy.

## Vista por tipo de negocio

### 1. Comida a domicilio → `lista con foto` + carrito
**Estructura de cada fila** (de izquierda a derecha, alineado al centro, padding 10 px, separación de 10 px entre filas):
1. Miniatura cuadrada 76 × 76, radio 12. Si no hay foto, la columna desaparece y el texto ocupa todo el ancho.
2. Bloque de texto: nombre, descripción, precio (con 4 px de separación encima del precio).
3. Acción a la derecha:
   - Cantidad 0: botón redondo 44 px, fondo verde, icono «+».
   - Cantidad ≥ 1: selector en píldora verde suave (`#E3F1E5`) con «−» blanco, número y «+» verde.

**Agotados**: filas compactas (miniatura 56 px), con «Agotado» en rojo oscuro (`#8A2F1F`) a la derecha, sin botón.

**Barra fija inferior**: sin productos, «Pedir por WhatsApp». Con productos, «Pedir N productos · TOTAL», y encima una línea pequeña: «Tu pedido se envía ya escrito en el mensaje». El mensaje usa la plantilla del negocio.

### 2. Cafetería / restaurante → `lista de texto` agrupada
**Antes de la lista**, si existe, el banner «Especial de hoy» (fondo verde de marca, texto blanco, plato y precio).

**Destacados (opcional)**: fila horizontal con scroll de tarjetas de 140 px de ancho con foto 140 × 100 arriba, nombre y precio. Solo productos destacados **con foto**. Si no hay ninguno, no se muestra.

**Lista principal**: una sola tarjeta blanca por categoría, con filas separadas por líneas de 1 px `#EEEBE3`:
- Izquierda: nombre (+ etiqueta) y descripción en una o dos líneas.
- Derecha: precio, sin saltos de línea.
- Sin fotos en las filas.

Si la cafetería tiene pedidos activos, añadir el botón «+» a la derecha del precio y la barra con carrito igual que en domicilio. Si no, la barra fija muestra las acciones del local (ej. «Reservar mesa» + «Cómo llegar»).

### 3. Tienda / mipyme → `cuadrícula` + existencias
**Cabecera del bloque**: título y debajo, en 12 px gris, «Precios y existencias actualizados hace X», calculado con la fecha de la última modificación del catálogo.

**Buscador** dentro del catálogo (filtra en cliente lo ya cargado; pregúntame si debe buscar en servidor cuando hay muchos productos).

**Tarjeta en cuadrícula de 2 columnas** (padding 8 px, separación 10 px):
1. Foto 1:1 o de 110 px de alto, radio 10.
2. Nombre en hasta 2 líneas.
3. Fila inferior: precio a la izquierda, estado de existencias a la derecha en 11 px peso 700: «Disponible» (verde `#1F5C2C`), «Quedan N» (ámbar `#8A4B00`), «Agotado» (rojo `#8A2F1F`).

La forma de mostrar existencias la elige el negocio en Ajustes: cantidad exacta, solo «pocas unidades», solo disponible/agotado, o nada. Deja el campo de existencias preparado para que en el futuro lo alimente el ERP de inventario de La Verde (no lo conectes ahora).

**Al tocar una tarjeta**: hoja inferior con foto, nombre, descripción completa, precio y botón «Apartar por WhatsApp» (reserva tipo `apartado` con producto y cantidad).

**Pie del bloque**: botón «Ver los N productos».

### 4. Servicios → `servicios` + trabajos realizados
**Lista**: una tarjeta blanca con filas separadas por líneas:
- Izquierda: nombre del servicio y debajo una línea gris con duración y precio («30 min · desde 500 CUP»). Cada parte solo si existe.
- Derecha: botón en píldora con borde verde, 40 px de alto, «Reservar». Abre WhatsApp con la plantilla de cita y el servicio ya escrito (reserva tipo `cita`).
- Sin fotos en las filas.

Pregúntame si los productos de un negocio de servicios necesitan campos nuevos (duración, tipo de precio fijo / «desde» / «a consultar») o si se pueden derivar de lo que ya existe.

**Trabajos realizados**: debajo de la lista, cuadrícula de 3 columnas con fotos cuadradas (radio 12, separación 6 px) y «Ver todos». Al tocar, visor a pantalla completa. Si no hay fotos, no se muestra.

**Barra fija**: «Pedir cita por WhatsApp».

## Panel del negocio

- En **Ajustes → Catálogo en la ficha**: vista del catálogo, número de productos visibles en la ficha, mostrar destacados (sí/no), forma de mostrar existencias (solo tiendas).
- En **Catálogo**, por producto: marcar como destacado, y para servicios, duración y tipo de precio si se aprueban esos campos.
- Vista previa del bloque de catálogo tal como lo verá el cliente.

## Pruebas

- Revisa la ficha real de Yoyi Sabor (domicilio, varios productos sin foto y dos agotados) y una ficha de prueba de cada uno de los otros tipos.
- Casos: sin fotos, con una sola categoría, precio no numérico, plan Gratis sin pedidos, prueba de Pro activa, modo offline.
- Casos de agotados: un agotado, más de 3 agotados, todo agotado, categoría entera agotada, agotado con fecha de vuelta (y que vuelva solo al llegar la fecha), producto que se agota estando en el carrito, especial del día agotado, existencias en 0 en una tienda y opción «Mostrar productos agotados» desactivada.
- Comprueba en un móvil de 360 px de ancho.

## Al terminar

Dime qué componente estaba causando el problema, qué cambiaste, qué decidiste y por qué, y qué necesitas que yo revise.
