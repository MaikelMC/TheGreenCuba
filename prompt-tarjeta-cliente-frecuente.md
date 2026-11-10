# Tarea: rediseño completo de la tarjeta de cliente frecuente (vista del cliente + panel)

## Objetivo

Rediseñar de una sola pasada las tres pantallas de la tarjeta de cliente frecuente de La Verde, **con todo conectado de verdad**:

1. **Vista del cliente**: la tarjeta pública que el cliente abre desde su enlace.
2. **Panel → pestaña Clientes**: uso diario del negocio (dar sellos, canjear premios).
3. **Panel → pestaña Ajustes de la tarjeta**: configuración con vista previa en vivo.

Al terminar no puede quedar **ningún elemento muerto**: ni botones sin acción, ni enlaces a `#`, ni datos de ejemplo, ni textos o valores escritos a mano que deberían salir de la base de datos, ni `TODO` pendientes.

## Reglas de trabajo

- Código y UI en español. Cambios mínimos fuera de este alcance. Reutiliza componentes, utilidades y estilos existentes antes de crear nuevos. Sin dependencias nuevas salvo que sea imprescindible (pregunta antes).
- Permisos, cálculos de sellos, premios y estadísticas **siempre en el servidor**. El cliente nunca decide cuántos sellos tiene nadie.
- `src/lib/plans.ts` sigue siendo la única fuente de verdad de qué funciones tiene cada negocio. Respeta también los permisos del equipo (quién puede dar sellos o canjear premios).
- **Regla anti-elemento muerto:** cada elemento de este documento debe funcionar de punta a punta. Si algo necesita backend que no existe, créalo. Si de verdad no se puede hacer en esta tarea, **no lo pintes** y dímelo en el informe final. Nunca dejes un botón decorativo.
- Si un dato está vacío, su elemento se oculta o muestra su estado vacío definido aquí. Nunca placeholders inventados.
- **Preguntas:** trabaja de una pasada. Solo detente a preguntar si algo bloquea de verdad (las preguntas obligatorias están marcadas con **PREGUNTA**). Para todo lo demás, decide con criterio y explícalo en el informe final.

## Fase 0 — Reconocimiento (rápido, sin preguntarme salvo bloqueo)

Antes de tocar nada, localiza y entiende:

1. Los componentes actuales de la vista del cliente y del panel de la tarjeta.
2. El modelo de datos: configuración de la tarjeta (activa, nombre, metas, compra mínima, moneda), clientes de la tarjeta, sellos, ciclos y canjes.
3. Cómo se dan hoy los sellos automáticamente al hacer un pedido, cómo se evalúa la compra mínima y cómo se dan "a mano".
4. Cómo se genera el enlace de la tarjeta del cliente y cómo se protege (token, teléfono enmascarado).
5. De dónde salen el logo y el color de marca del negocio.

### Errores ya detectados que hay que corregir

- El editor de metas del panel muestra **una sola meta** ("5 sellos → Un premio gratis") mientras el cliente ve **dos** (5 y 10). El editor no carga las metas guardadas o guarda mal: encuéntralo y corrígelo.
- La fila de un cliente en el panel dice "0 de 5 sellos" mientras su tarjeta dice "0 de 10". **El total de sellos de la tarjeta es siempre el valor de la última meta**, calculado en un solo lugar y usado en todas partes.
- El texto "Te faltan 5 sellos para Una bambina gratis" pega el nombre del premio con mayúscula a mitad de frase. Los mensajes deben construirse para leerse bien (minúscula inicial del premio dentro de la frase, salvo que empiece por nombre propio; si no puedes distinguirlo, reformula la frase: "Próximo premio: Una bambina gratis · te faltan 5 sellos").
- En la fila del cliente se repiten los sellos ("0 de 5 sellos" y "0 sellos" a la derecha).

## Reglas de negocio de los sellos (verifícalas y, si el código actual hace otra cosa, dímelo)

- Una tarjeta tiene de 1 a 4 metas en orden ascendente. La última meta define el total de casillas.
- Las metas intermedias se canjean **sin restar sellos**. Cada meta se puede canjear **una vez por ciclo**.
- Al llegar a la última meta, el premio queda listo; al canjearlo se cierra el ciclo y empieza uno nuevo con los sellos que sobren.
- Un pedido da 1 sello si supera la compra mínima (si está vacía, cualquier pedido da sello).
- **Historial de eventos:** cada cambio de sellos queda registrado como evento (sello por pedido, sello dado en el local, sello deshecho, premio canjeado, ciclo completado), con fecha, ciclo, pedido relacionado si lo hay y quién lo hizo. Si hoy no existe esa tabla, créala con su migración. Las cifras de la tarjeta y del panel deben poder reconstruirse a partir de estos eventos.
- **PREGUNTA:** qué pasa con los clientes que ya tienen sellos si el negocio cambia las metas (por ejemplo, baja el total de 10 a 8 y un cliente tiene 9). Propón una regla y espera mi respuesta antes de implementar ese caso concreto; el resto sigue adelante.

## Componente compartido: la tarjeta

Crea **un solo componente de tarjeta** que usen a la vez la vista del cliente y la vista previa del panel. Así nunca pueden verse distintas.

**Contenido de la tarjeta**, de arriba abajo:
- Logo del negocio (48 px, radio 14, fondo blanco) y al lado el nombre del negocio (17 px, 800) y el nombre de la tarjeta (13 px, 600, blanco al 85 %). Sin logo: iniciales del negocio.
- Progreso grande: número de sellos (40 px, 800) y "de N sellos".
- Cuadrícula de casillas, 5 columnas, casillas cuadradas con radio 14 y separación de 8 px:
  - **Sello conseguido:** fondo blanco con icono de check en círculo en el color de marca.
  - **Casilla vacía:** borde discontinuo blanco al 55 % y el número de la casilla.
  - **Casilla de premio sin conseguir:** borde dorado `#F2C14E` de 2 px, fondo dorado muy suave, icono de regalo y el número debajo.
  - **Casilla de premio conseguida:** fondo blanco con el icono de regalo en dorado.
- Pie: nombre del cliente a la izquierda y teléfono enmascarado a la derecha ("+53 5••• ••38"), con la misma tipografía que el resto (**no** monoespaciada).
- Indicador de ciclo: **solo** si el cliente va por el segundo ciclo o más, como "Tarjeta n.º 2". Nunca "CICLO 1".
- Fondo: color de marca del negocio. Si el negocio no tiene color de marca, el verde de La Verde. El texto blanco debe cumplir contraste 4.5:1 sobre ese color; si el color de marca no lo cumple, oscurécelo automáticamente para la tarjeta.
- Estado inactivo (solo en la vista previa del panel): tarjeta al 45 % de opacidad.

**Animación:** cuando el cliente abre su tarjeta y tiene sellos nuevos desde su última visita (guarda en el dispositivo el último número visto), el sello nuevo aparece con una animación corta de "sellado". Si se completa un premio, una celebración breve. Respeta `prefers-reduced-motion`.

## 1. Vista del cliente

Orden de la página (ancho móvil, padding 20 px, separación 16 px):

1. **Tarjeta** (componente compartido). Sin cabecera duplicada encima: el logo y el nombre ya están dentro.
2. **Próximo premio:** tarjeta blanca con el mensaje ("Te falta 1 sello para una bambina gratis"), barra de progreso hacia ese premio en el color de marca, y debajo la regla del juego con icono de información:
   - sin compra mínima: "Ganas 1 sello con cada pedido";
   - con compra mínima: "Ganas 1 sello con cada pedido de 5 USD o más" (con la moneda configurada).
3. **Tus premios:** una tarjeta por meta, con icono de regalo, nombre, "x/N" y barra de progreso. Estados:
   - **bloqueado:** barra gris;
   - **listo para canjear:** tarjeta resaltada en ámbar con "¡Tu [premio] está listo!" y la instrucción "Pídelo en tu próximo pedido diciendo tu teléfono" (o el texto que use hoy el flujo real de canje; revísalo);
   - **canjeado en este ciclo:** atenuado con "Canjeado".
4. **Últimos sellos:** los 5 eventos más recientes del historial ("+1 sello · Pedido", "+1 sello · Dado en el local", "Premio canjeado: …"), con fecha relativa. Sin eventos: "Tu primer sello llega con tu próximo pedido".
5. **Acciones:**
   - **Pedir ahora** (botón principal): lleva a la ficha o al catálogo del negocio en La Verde, con el carrito si el negocio tiene pedidos, y con el teléfono del cliente asociado para que el próximo pedido sume sello.
   - **Enviármela por WhatsApp:** abre WhatsApp con un mensaje que contiene el enlace de la tarjeta, para que el cliente se lo guarde en su propio chat.
   - **Añadir a inicio:** si el navegador permite instalar la PWA, lanza el aviso de instalación; en iPhone, muestra una hoja con los pasos. Si en esta ruta no se puede instalar de ninguna forma, oculta el botón.

**Estados de la página:** tarjeta desactivada por el negocio ("Esta tarjeta no está activa ahora mismo"), enlace no válido o caducado, y sin conexión (mostrar la última versión guardada con "Actualizado hace X").

Se elimina el texto "Tu tarjeta vive en este enlace. Guárdalo…": lo sustituyen las dos acciones de guardar.

## 2. Panel → pestaña Clientes

- **Pestañas** "Clientes" y "Ajustes de la tarjeta" arriba, con el estado en la URL (`?tab=clientes` / `?tab=ajustes`). Clientes es la pestaña por defecto.
- Cabecera: título "Cliente frecuente", nombre del negocio y píldora de estado "Activa" / "Inactiva".
- **Resumen** en cuadrícula de 2 × 2, calculado en el servidor con la zona horaria `America/Havana`:
  - Clientes con tarjeta (total);
  - Sellos este mes (dados menos deshechos);
  - Premios canjeados este mes;
  - Clientes que repitieron (con 2 o más sellos en total).
- **Buscador** por nombre o teléfono (normaliza teléfonos: con o sin +53, con o sin espacios) y botón **Nuevo** que abre un formulario de alta (nombre y teléfono, validado como móvil cubano, sin duplicados).
- **Filtros:** Todos · Premio listo (con contador) · Sin volver (último sello hace más de 30 días; deja el número de días como constante en un solo lugar).
- **Fila de cliente:**
  - avatar con inicial, nombre, teléfono formateado ("+53 5533 6238");
  - barra de progreso y línea "x de N sellos · próximo: [premio] (faltan y)", y a la derecha la fecha del último sello o "Nuevo";
  - botón **+ Sello** en la propia fila (con `aria-label` "Dar un sello a [nombre]");
  - si tiene un premio listo: fila resaltada en ámbar, píldora "PREMIO LISTO", nombre del premio y botón **Canjear premio**, que abre una confirmación ("¿Canjear una bambina gratis para Maikel?").
  - Al tocar la fila (fuera de los botones): detalle del cliente con su tarjeta (componente compartido) y su historial completo.
- **+ Sello:** actualización optimista, evento "sello dado en el local" en el servidor y aviso inferior "+1 sello para [nombre]" con **Deshacer** durante 6 segundos. Deshacer crea un evento de "sello deshecho" (no borra el anterior) y solo se permite sobre la última acción de ese usuario dentro de la ventana.
- Estados vacíos: sin clientes ("Aún no hay clientes con tarjeta. Se apuntan solos al pedir, o añádelos con Nuevo"), búsqueda sin resultados, filtro vacío.
- Lista paginada o con carga progresiva si hay muchos clientes.
- **Se eliminan:** el botón "Actualizar" (la lista se refresca sola tras cada acción y al volver a la pestaña) y el botón general "Dar sello a mano" (pasa a cada fila).

## 3. Panel → pestaña Ajustes de la tarjeta

1. **Vista previa en vivo** arriba, con la etiqueta "ASÍ LA VE TU CLIENTE": el componente compartido de la tarjeta, con 0 sellos, actualizándose al instante con cada cambio del formulario (aún sin guardar). Debajo: "Tu tarjeta tiene **N sellos**." más la regla del juego tal como la verá el cliente.
2. **Tarjeta activa:** interruptor (no casilla de verificación) con el texto de ayuda "Tus clientes podrán dejar su teléfono al pedir y sumar sellos".
3. **Nombre de la tarjeta:** obligatorio, con límite de caracteres.
4. **Premios** (antes "Metas"), con la ayuda "Hasta 4. El último completa la tarjeta y empieza una nueva":
   - Cada premio en su bloque: selector de sellos con botones − y + (no un campo de texto pequeño), campo con el nombre del premio y papelera para quitarlo (no se puede quitar si es el único).
   - Límites: cada premio tiene más sellos que el anterior y menos que el siguiente; máximo total de 20 casillas (constante en un solo lugar). Los botones − y + se desactivan al llegar al límite.
   - Texto bajo cada premio: "Se canjea sin perder los sellos" para los intermedios y "Completa la tarjeta y empieza una nueva" para el último.
   - Botón "+ Añadir otro premio" (oculto al llegar a 4 premios o a 20 sellos).
5. **Compra mínima para dar sello:** importe y moneda (CUP o USD), con la ayuda "Déjalo vacío si cualquier pedido da sello". Si el negocio usa una tasa del día, muestra el equivalente en la otra moneda.
6. **Botones abajo:** "Descartar cambios" y "Guardar tarjeta". Se elimina el "Cancelar" de la cabecera.
   - "Guardar" desactivado si no hay cambios o hay errores; validación también en el servidor.
   - Si el usuario intenta salir con cambios sin guardar, avisar.
   - Al guardar con éxito: aviso "Tarjeta guardada" y la pestaña Clientes refleja los nuevos totales.

## Estilo visual

Respeta los tokens y componentes que ya existen; como referencia de los mockups aprobados:
- Fondo `#F6F4EE`, tarjetas blancas con borde `#E4E1D8` y radio 16–18 px, sin sombras.
- Texto `#1C2620`, secundario `#5B6660`.
- Verde de acción `#2E7D3F`. Premio listo: fondo `#FFF8E6`, borde `#E0A526`, texto `#5B4A2A`. Casilla de premio: dorado `#F2C14E`.
- Pestañas en control segmentado (fondo `#ECE8DF`, pestaña activa blanca).
- Botones de al menos 44 px de alto, `aria-label` en los botones de icono, pestañas con `role="tab"` y `aria-selected`, interruptor con `aria-pressed`, contraste mínimo 4.5:1.
- Iconos de `lucide-react`, nunca emojis en la interfaz.
- Pensado para 360 px de ancho.

## Verificación antes de dar por terminado

1. Búsqueda de elementos muertos en todos los archivos tocados: `href="#"`, `onClick={() => {}}`, handlers vacíos, `TODO`, `FIXME`, textos de ejemplo, datos de prueba fijos. No debe quedar ninguno.
2. Pruebas automáticas de la lógica de sellos: sello por pedido con y sin compra mínima, canje de meta intermedia sin restar sellos, una meta no se canjea dos veces en el mismo ciclo, cierre de ciclo con sellos sobrantes, deshacer dentro y fuera de la ventana, cálculo del total desde la última meta.
3. Recorrido manual de cada flujo: dar sello, deshacer, canjear premio intermedio, canjear el último y ver el ciclo nuevo, crear cliente, buscar, filtrar, editar premios con la vista previa, guardar, descartar, salir con cambios sin guardar, desactivar la tarjeta y ver la vista del cliente.
4. Comprobación de que la vista del cliente y la vista previa del panel son el mismo componente y se ven igual.
5. Tipos, lint y build sin errores.

## Informe final

Dime:
- qué causaba el error de las metas y de "0 de 5 / 0 de 10";
- qué tablas o campos nuevos creaste y sus migraciones;
- qué decidiste por tu cuenta y por qué;
- si algún elemento no se pudo conectar y por eso no se pinta;
- la respuesta pendiente a la **PREGUNTA** sobre el cambio de metas, si aún no te la he dado.
