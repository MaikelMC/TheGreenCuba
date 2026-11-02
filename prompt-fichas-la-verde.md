# Tarea: fichas de negocio adaptadas por tipo en La Verde

## Contexto

La Verde (laverde.kynari.dev) es una plataforma donde la gente en Cuba encuentra negocios. Cada negocio tiene una ficha pública en `/place/<id>`. Hoy todas las fichas usan la misma plantilla y varias partes están "pintadas" por defecto o no las puede controlar el negocio.

Quiero rediseñar la ficha para que tenga **un esqueleto común** y **módulos que cambian según el tipo de negocio**, y que **absolutamente todo el contenido visible de la ficha venga de datos que el negocio puede crear, editar u ocultar desde su panel**.

## Regla principal (no negociable)

1. **Nada de contenido del negocio puede estar escrito a mano en el código.** Si un dato aparece en la ficha pública, tiene que existir un campo en la base de datos y una forma de editarlo en el panel del negocio.
2. **Si un dato está vacío, la sección o el elemento se oculta en la ficha pública.** Nunca se muestran placeholders, textos de ejemplo ni valores inventados al público.
3. **Los textos de interfaz de la plataforma** (por ejemplo "Ver más", "Ver todas", "Aceptan") sí pueden ser textos del sistema, pero centralizados en un archivo de traducciones/copys, no repartidos por los componentes.
4. **Los valores por defecto por tipo de negocio** (qué módulos se activan, qué botón principal se usa, el título de una sección) son solo un punto de partida: el negocio puede cambiarlos.
5. **Pregúntame antes de decidir** cualquier cosa que no esté clara en este documento o que dependa de cómo está hecho el proyecto. Prefiero una pregunta a una suposición.

## Cómo quiero que trabajes

**Fase 1 — Explorar y preguntar (no escribas código todavía).**
Revisa el repositorio y entiende: stack, base de datos y ORM, cómo se modela hoy un negocio, si ya existe un panel del negocio y cómo funciona, autenticación y roles, subida de imágenes, sistema de reseñas, componentes de UI y estilos existentes, y cómo se genera la página `/place/<id>`. Después hazme las preguntas que necesites (agrupadas y numeradas).

**Fase 2 — Proponer el plan.**
Antes de implementar, preséntame: el modelo de datos propuesto (tablas/campos nuevos y cambios), la migración de los negocios existentes, la lista de componentes de la ficha pública y la lista de pantallas o secciones del panel de edición. Espera mi aprobación.

**Fase 3 — Implementar por partes**, en este orden, avisándome al terminar cada una:
1. Modelo de datos y migraciones (sin romper los negocios actuales).
2. Esqueleto común de la ficha pública.
3. Módulos por tipo.
4. Panel de edición para cada campo.
5. Migración de datos existentes y revisión de fichas reales.
6. Pruebas.

## Tipos de negocio y módulos

Cuando un negocio se registra o edita su perfil, elige un **tipo principal**:
- Comida a domicilio
- Cafetería / restaurante
- Tienda / mipyme
- Servicios (barbería, taller, manicure, reparaciones, etc.)

El tipo principal **solo define los valores por defecto**. Los módulos deben poder activarse o desactivarse individualmente, porque hay negocios mixtos (por ejemplo, una cafetería que también hace domicilio). Pregúntame si prefieres modelarlo como "tipo + módulos activables" o de otra forma que encaje mejor con el proyecto.

## Esqueleto común (todas las fichas)

Para cada elemento indico: qué muestra, de dónde sale, y qué pasa si está vacío. Todo se edita desde el panel del negocio salvo que diga lo contrario.

### 1. Portada
- Foto de portada subida por el negocio (con recorte para móvil).
- Si no hay foto: fondo del color de marca del negocio con el nombre en marca de agua.
- Color de marca: editable, elegido de una paleta limitada que mantenga buen contraste (pregúntame si dejo color libre).

### 2. Cabecera
- **Logo**: subido por el negocio. Si no hay, iniciales del nombre sobre el color de marca.
- **Nombre**: obligatorio.
- **Valoración**: promedio y número de reseñas, calculados del sistema de reseñas (no editables por el negocio). Si hay menos de N reseñas, no se muestra el promedio; N configurable a nivel plataforma, pregúntame el valor.
- **Subtítulo / especialidad** (ej. "Tacos, empanadas y tequeños"): texto corto editable, con límite de caracteres. Si está vacío, se muestra solo la categoría.

### 3. Estado y distintivos
- **Estado abierto/cerrado**: calculado en tiempo real a partir del horario (zona horaria `America/Havana`). Textos tipo "Abierto · cierra a las 6:00 p. m." o "Cerrado · abre mañana a las 9:00 a. m.". El negocio no escribe este texto, edita el horario.
- **Horario**: por día de la semana, con varias franjas por día, días cerrados, cierres especiales con fecha (feriados, vacaciones) y un interruptor de "cerrado temporalmente" con mensaje opcional.
- **Distintivos (atributos)**: catálogo de atributos predefinidos por tipo que el negocio activa o desactiva. Uno de ellos es **"Tiene planta eléctrica"**, que se muestra destacado. Pregúntame si los negocios pueden crear atributos propios o solo elegir de la lista.

### 4. Fila de acciones
- Botones con icono y etiqueta: Cómo llegar, Guardar, Llamar, WhatsApp, Compartir, Ofertas.
- Cada botón aparece **solo si existe el dato que necesita** (sin teléfono no hay "Llamar", sin coordenadas no hay "Cómo llegar").
- El negocio puede elegir cuáles mostrar y en qué orden (máximo 4 visibles).
- "Ofertas" permite a los usuarios suscribirse para recibir avisos del negocio. Pregúntame cómo funcionan hoy las notificaciones.

### 5. Tarjeta clave del negocio
Cambia según los módulos activos (ver más abajo). Siempre incluye **métodos de pago**: selección múltiple de una lista (CUP, USD, MLC, Transferencia, Zelle, etc.) más opción de añadir otro. Todos los métodos se muestran con el mismo estilo, sin destacar uno.

### 6. Dirección y contacto
- Dirección en texto, más ubicación en el mapa (coordenadas) para "Cómo llegar".
- Contactos: WhatsApp, teléfono, Instagram, Facebook, web. Todos opcionales.

### 7. Sobre este lugar
- **Descripción larga**: editable, admite emojis.
- **Resumen corto** (2–3 líneas) que se muestra primero con "Ver más". El negocio puede escribirlo o generarlo con la IA de La Verde y luego editarlo. Si no hay resumen, se recorta la descripción larga.

### 8. Catálogo (productos, menú o servicios)
Su forma depende del módulo activo (ver abajo). Comunes a todos:
- Categorías creadas por el negocio, con orden editable.
- Cada ítem: nombre, descripción, precio, moneda, foto(s), categoría, orden, destacado (sí/no) y disponibilidad (disponible / agotado / oculto).
- Los ítems agotados van al final y atenuados; los ocultos no se muestran.
- **Título de la sección** con valor por defecto según el tipo ("Lo que ofrece", "Menú", "Productos", "Servicios y precios"), editable por el negocio.

### 9. Galería de fotos
Fotos del local o de trabajos realizados, con orden editable. Si no hay fotos, la sección no aparece.

### 10. Reseñas
Resumen visible (promedio, número, una reseña destacada) y enlace a todas. Pregúntame si el negocio puede responder reseñas o elegir la destacada.

### 11. Barra fija de acción principal
- Siempre visible abajo en móvil.
- **Acción principal y secundaria configurables** por el negocio: Pedir por WhatsApp, Pedir cita, Reservar mesa, Apartar productos, Cómo llegar, Llamar.
- El texto del botón tiene un valor por defecto según la acción y es editable.
- Los mensajes de WhatsApp se generan desde **plantillas editables** por el negocio con variables (ej. `{productos}`, `{total}`, `{servicio}`, `{nombre_cliente}`).

## Módulos por tipo

### Comida a domicilio
- **Tarjeta clave "Entrega a domicilio"**: costo de envío (fijo, por zona, gratis a partir de un monto, o "a consultar"), tiempo estimado (rango en minutos), pedido mínimo y zonas o repartos que cubre. Opcional: horario de domicilio distinto al del local.
- **Catálogo con carrito**: botón "+" en cada producto disponible y selector de cantidad. La barra fija muestra "Pedir N productos · TOTAL" y envía por WhatsApp el pedido ya escrito usando la plantilla del negocio.
- Pregúntame cómo manejar pedidos que mezclan monedas.

### Cafetería / restaurante
- **Especial del día**: plato, precio y fecha de vigencia. Se oculta solo cuando caduca.
- **Tarjeta "En el local"**: atributos del local (servicio en mesa, para llevar, climatizado, wifi, terraza, reservas para grupos…), activables desde el catálogo de atributos.
- **Reservas**: activar o desactivar, y elegir cómo se reserva (WhatsApp, llamada). Pregúntame si quieres un sistema de reservas propio o solo enlace a WhatsApp por ahora.
- **Menú** sin carrito (solo precios), salvo que el negocio también tenga activo el módulo de domicilio.
- La foto de portada se recomienda fuertemente (el panel debe insistir en ello).

### Tienda / mipyme
- **Tarjeta "Cómo comprar"**: recoger en tienda / apartar por WhatsApp y domicilio (sí/no, costo).
- **Catálogo con buscador** y cuadrícula de productos.
- **Existencias**: el negocio elige cómo mostrarlas: cantidad exacta ("Quedan 3"), solo aviso de pocas unidades, solo disponible/agotado, o nada.
- **"Precios y existencias actualizados hace X"** calculado desde la fecha de la última actualización del catálogo.
- Este módulo debe quedar preparado para conectarse en el futuro con el ERP de inventario de La Verde (las existencias y precios vendrían de allí). No lo implementes todavía, pero diseña el modelo para que sea posible y explícame cómo lo dejarías listo.

### Servicios
- **Tarjeta "Cómo atiende"**: con cita, sin cita, a domicilio (cada una activable).
- **Estado de turno**: "Atiende hoy · próximo turno 3:00 p. m.". Pregúntame si existe o habrá una agenda; si no, mostrar solo "Atiende hoy" a partir del horario.
- **Lista de servicios**: nombre, descripción, duración, tipo de precio (fijo, "desde", "a consultar") y botón "Reservar" que abre WhatsApp con el servicio ya escrito.
- **Trabajos realizados**: galería tipo portafolio.

## Panel del negocio

- Cada campo de este documento debe tener su lugar para **crear, editar y quitar** en el panel.
- **Vista previa** de la ficha mientras se edita.
- **Indicador de completitud** de la ficha (ej. "Tu ficha está al 70%: añade fotos de tus productos") con sugerencias concretas de lo que falta.
- Validaciones claras: formato de teléfono cubano y WhatsApp, precios positivos, límites de caracteres, tamaño de imágenes.
- Pensado para usarse desde el móvil, porque la mayoría de los dueños lo harán desde el teléfono.

## Diseño visual de referencia

Mantén el sistema de diseño y los componentes que ya existen en el proyecto. Como referencia de los mockups aprobados:
- Fondo crema `#F6F4EE`, tarjetas blancas con borde `#E4E1D8` y esquinas redondeadas (16–18 px).
- Texto principal `#1C2620`, texto secundario `#5B6660`.
- Verde de marca `#2E7D3F` para acciones principales.
- Estado "Abierto" en verde suave (`#E3F1E5` / `#1F5C2C`) y distintivo de planta en ámbar (`#FFF1CC` / `#6E4A00`).
- Botones táctiles de al menos 44 px y contraste accesible (mínimo 4.5:1 en textos).
- Orden de la ficha: portada → cabecera → estado y distintivos → acciones → tarjeta clave → dirección → sobre → catálogo → galería → reseñas, con la barra fija abajo.

Si te paso capturas de los mockups, úsalas como guía visual, no como fuente de datos.

## Datos existentes

- Los negocios actuales deben seguir funcionando tras la migración.
- Propón cómo asignar el tipo principal a los negocios existentes (automático por categoría, o que yo lo revise uno por uno).
- Los datos que hoy estén escritos a mano en el código o mezclados en la descripción (por ejemplo, métodos de pago o "con planta") deben pasar a sus campos propios.

## Al terminar cada fase

Dime qué hiciste, qué decidiste y por qué, qué quedó pendiente y qué necesitas que yo revise o responda.
