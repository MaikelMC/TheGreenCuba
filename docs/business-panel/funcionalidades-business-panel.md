# Business Panel de La Verde: funcionalidades por pantalla

Acompaña a `cascaron-business-panel.html`, una maqueta estática del panel con
datos de ejemplo. Aquí está **qué hace** cada cosa que se ve allí. La fuente de
verdad es el código: `src/components/business/` (sobre todo `business-panel.tsx`
y `panel-shell.tsx`).

Ruta real: `/business`. Una sección se abre directamente con
`/business?seccion=<id>` (por ejemplo, `?seccion=pedidos`).

---

## 1. Armazón (común a todas las pantallas)

**Barra superior** (fija, translúcida):
- Flecha **Volver al inicio**: va a `/home`. Si hay cambios sin guardar, pregunta antes.
- Marca «La Verde **Panel**».
- Chapita **Publicado en La Verde**: solo si la ficha está publicada; oculta en móvil.
- **Menú de usuario** (avatar con la inicial).
- **Hamburguesa**: solo en móvil y tablet (< 1024 px). Abre el cajón lateral.

**Navegación**, dos grupos separados por una línea:

| Grupo | Sección (`id`) | Para qué |
|---|---|---|
| Diario | Inicio (`dashboard`) | Resumen, estado, QR, tasas, plan |
| Diario | Catálogo (`catalogo`) | Editar la carta |
| Diario | Pedidos (`pedidos`) | Atender pedidos y la cocina |
| Diario | Editar (`editor`) | Datos de la ficha pública |
| Diario | Ajustes (`settings`) | Interruptores de funciones |
| Gestión | Frecuentes (`clientes`) | Tarjeta de sellos y clientes |
| Gestión | Ofertas (`ofertas`) | Ofertas flash |
| Gestión | Publicar (`publicaciones`) | Posts para Facebook con IA |
| Gestión | Asistente (`telegram`) | Bot de Telegram |
| Gestión | Equipo (`equipo`) | Trabajadores y permisos |
| Gestión | Planes (`planes`) | Comprar planes y módulos |

- **Escritorio (≥ 1024 px):** barra lateral fija de 260 px. Al pie, la tarjeta del negocio («Activo en La Verde»).
- **Móvil:** cajón desde la derecha (máx. 320 px), con el nombre del negocio al pie.
- **Visibilidad por permisos:**
  - El **dueño** ve todo.
  - Un **trabajador** ve solo lo que el dueño le marcó:
    - `catalogo` → Catálogo y Ofertas.
    - `pedidos` → Pedidos.
    - `ficha` → Editar y Ajustes.
    - `telegram` → Asistente.
    - `pedidos` o `ficha` → Frecuentes.
  - Publicar, Equipo y Planes son solo del dueño.
- **Guardia de salida:** si la pantalla tiene trabajo sin guardar (Catálogo, Ofertas, Editar), cambiar de sección pregunta antes.
- **Selector de negocio** («Estás en …»): con varios negocios en la cuenta, va encima de cada sección. En Inicio va en la cabecera.
- Enlace **«¿Qué hace esto?»**, arriba a la derecha en Catálogo, Pedidos, Frecuentes y Ofertas. Lleva a la página del servicio en `/servicios/...`.
- **Candado de plan:** cuando el plan no incluye una función, la tarjeta se ve igual, pero en lugar del control aparece **Ver los planes**. Un trabajador recibe en su lugar un aviso: «Los planes los gestiona el dueño».

---

## 2. Inicio (`dashboard`)

1. **Cabecera:** el antetítulo «Panel del negocio», el nombre en grande y el selector de negocio compacto.
2. **Vista previa de la ficha** (caja verde oscura):
   - Logo (o la primera foto, o el icono de la categoría), nombre y chapita **Publicada / Sin publicar**.
   - Categoría · barrio.
   - **Selector de estado** (Abierto / Cerrado temp. / Cerrado):
     - Cambia al momento. Si el servidor falla, vuelve al estado anterior.
     - «Abierto» fuera de horario abre de verdad: es una apertura manual que manda sobre el horario hasta la siguiente apertura.
   - **Ver mi ficha** → `/place/<id>`.
   - Pie: dirección, horario y si es visible en el mapa y el catálogo.
3. **Actividad este mes**, cuatro cifras reales:
   - **Clics a tu negocio:** ficha + menú, este mes.
   - **Búsquedas:** veces que la IA lo propuso como opción.
   - **Productos:** cuántos tiene el catálogo.
   - **Publicaciones:** usadas / tope de la semana, con barra de progreso. Se atenúa si el plan no las incluye.
4. **Clics en los últimos 7 días:** separados en Ficha y Catálogo.
5. **Tu menú online:**
   - QR (con o sin la marca de La Verde según el plan; Menú Pro lo quita) y enlace `/m/<slug>`.
   - Botones: **Compartir**, **Ver mi carta** y descargar el QR.
6. **Precios mixtos: tus tasas** (solo el dueño, y solo con Precios mixtos activado):
   - Tasa USD, EUR, USD Clásica y recargo por transferencia (%).
   - Redondeo y «Actualizada hoy/ayer».
   - **Guardar tasa**: la carta muestra los precios en CUP.
7. **Kynari Empleos:** publicar ofertas de trabajo (**Publica gratis**, **Ver Kynari**).
8. **Tu plan** (solo el dueño): plan y módulos actuales, y **Ver todos los planes** → Planes.

---

## 3. Catálogo (`catalogo`)

- **Borrador recuperado:** si se salió sin guardar, ofrece **Recuperar** o **Descartar**.
- **Buscador** por nombre, descripción o categoría.
- **Importar CSV:**
  - Abre un diálogo y suma los productos a lo ya guardado.
  - Solo funciona con el catálogo guardado; si no, avisa «Guarda el catálogo para poder importar».
- **Añadir producto.**
- **Filtros:** Todas, cada categoría y Agotados. Sin resultados sale «Nada coincide» con **Quitar filtros**.
- **Productos agrupados por categoría.** Cada uno tiene:
  - Foto: se sube al momento.
  - Nombre (obligatorio), descripción breve y categoría.
  - Precio y moneda.
    - Con una sola cifra, enseña la equivalencia en CUP con la tasa del día.
    - Con un rango o un texto, avisa: «Este precio no se suma en el carrito».
  - Disponibilidad, que se guarda al momento: **Marcar agotado**, **Agotado hasta mañana** (vuelve solo a medianoche) y **Marcar disponible**.
  - **Mostrar / Ocultar de la ficha** y **Eliminar**.
- **Barra de guardado** (fija abajo):
  - «Cambios sin guardar», **Descartar cambios** y **Guardar catálogo**.
  - Un producto sin nombre bloquea el guardado y queda marcado en rojo.
  - Si un producto cambió desde el móvil mientras se editaba, avisa para revisarlo.
- **Vacío:** «Tu catálogo está vacío».

---

## 4. Pedidos (`pedidos`)

- **Pestañas con contador:** Pendientes, Programados, Entregados y Cancelados.
- **Buscador por código** (`#XXXXX`) y botón **Actualizar**. Sin tocar nada, comprueba cada 60 s si hay pedidos nuevos y avisa: «Ha entrado un pedido nuevo».
- **Tarjeta de pedido:**
  - Código, estado y hace cuánto entró.
  - Cliente y teléfono.
  - Tipo de entrega: **A domicilio** (con zona y costo) o **Recogida en local**.
  - Productos con su importe, y el total (o «Total a convenir» si algún precio no es una cifra).
  - Avisos **Revisar**: el producto ya no está, está oculto o agotado, el precio no era el de la carta, o el pedido está fuera de horario o de los días aceptados.
  - Acciones: **Entregado**, **Avisar al cliente** (WhatsApp), **Sello a mano**, **Canjear** (premio de cliente frecuente) y **Cancelar**. Cancelar un pedido descuenta su sello.
- **Ver pedidos anteriores:** carga el historial de 100 en 100.
- **Vacío:** «Todavía no hay pedidos. Cuando un cliente toque «Realizar pedido» en tu carta, aparece aquí».
- **Cocina** (con el módulo de horario de cocina):
  - **Pausar / Abrir cocina**, con motivo (Sin luz, Sin inventario, Sin personal, Otro) y duración (Hasta mañana, Sin límite).
  - **Horario de cocina** por días. Sin horario, acepta pedidos siempre.
- **Pedidos programados** (solo con permiso de ficha): activo o inactivo, duración de la franja, límite por franja, antelación y días. Se guarda con **Guardar ajustes**.

---

## 5. Editar ficha (`editor`)

- **Borrador:** «Nos quedó una ficha sin guardar de la última vez», con **Recuperar** o **Descartar**.
- **Acordeón de secciones.** La primera abierta es Información del negocio. Si falta algo al guardar, la sección culpable se marca en rojo y se abre.

| Sección | Qué se edita |
|---|---|
| Fotos del lugar | Logo (círculo de la ficha, miniatura, pin) y rejilla de fotos por sección (Local / Trabajos) |
| Información del negocio | Nombre*, categoría, barrio/municipio, dirección, teléfono, descripción (sirve a la IA) |
| Contacto | Web, WhatsApp, Instagram, Facebook |
| Ubicación en el mapa | Buscador de calles y pin arrastrable* |
| Icono del negocio | Icono del pin y de las tarjetas |
| Horario | Texto libre y horario por días (abre y cierra solo) |
| Métodos de pago | Monedas y formas aceptadas |
| Tipo de negocio y bloques | Tipo y qué bloques muestra la ficha |
| Qué tiene el negocio | Atributos (terraza, climatizado…) |
| Color de marca | Selector y valor hex |
| Mensaje de cierre | Texto que se muestra cuando está cerrado |
| Energía de respaldo | Planta, solar… y una nota opcional |
| Estado del negocio | Abierto / Cerrado temporalmente / Cerrado |

\* Obligatorio.

- **Barra fija abajo:** estado («Guardando…» / «Cambios sin guardar»), **Descartar cambios**, **Ver ficha** (en otra pestaña) y **Guardar cambios**.

---

## 6. Ajustes (`settings`)

Todos los interruptores **guardan al momento**, sin botón de guardar.

1. **Pedidos por WhatsApp:**
   - «Recibir pedidos en mi carta»: muestra u oculta el carrito.
   - Avisa si falta el número de WhatsApp.
2. **Precios mixtos:** «Mostrar mi carta en varias monedas». Está en todos los planes. Las tasas se ponen en Inicio.
3. **Reservas por WhatsApp:**
   - «Aceptar reservas»: muestra el botón en la ficha y en la carta.
   - Desplegable **Configurar la reserva**:
     - Qué se reserva: mesa, cita o apartado.
     - Aforo máximo por reserva y cupo diario.
     - **Cupo de un día:** elegir fecha y **Liberar ese día**, con Deshacer.
     - Plantilla del mensaje que llega.
     - Botón **Guardar reservas**.
4. **Avisos a seguidores:**
   - Número de seguidores y avisos enviados esta semana.
   - Sin límite: los cambios seguidos llegan juntos en un solo mensaje, como mucho uno cada 30 min.
   - Enlace del bot para compartir.
5. **Domicilio y zonas:**
   - «Pueden pasar a recoger» y «Hago entregas a domicilio».
   - Lista de zonas, cada una con nombre, costo (o Gratis), interruptor y **Editar**.
   - **Añadir zona** abre un diálogo. Al borrar una zona hay Deshacer.
   - Pedido mínimo con su moneda, nota de entrega y **Guardar mínimo y nota**.
6. **Plan actual y Soporte:** WhatsApp y correo.
7. **Cerrar sesión.**

---

## 7. Frecuentes (`clientes`)

Tarjeta de sellos digital. Necesita el módulo de pedidos y reservas.

- **Tarjeta de sellos:**
  - Activa o inactiva, con la vista «Así la ve tu cliente».
  - **Editar tarjeta:** nombre, sellos, premios (varias metas; cada premio «completa la tarjeta y empieza una nueva» o «se canjea sin perder los sellos») y compra mínima.
  - Botones **Añadir otro premio**, **Descartar cambios** y **Guardar tarjeta**.
- **Cifras:** clientes, sellos y premios listos.
- **Barra de controles:** buscador (teléfono o nombre), **Dar sello** y **Nuevo**. En móvil van en una sola fila.
  - **Dar sello:** por teléfono o por código de pedido. Comprueba la compra mínima y que no se haya sellado ya ese pedido. Tiene Deshacer.
  - **Nuevo:** teléfono, nombre, sellos que ya tiene (de la tarjeta de papel) y nota.
- **Filtros** y **lista de clientes**, con «Premio listo» cuando toca.
- **Detalle del cliente:**
  - **Enviar tarjeta por WhatsApp** y **Ver como el cliente**.
  - **Ajustar sellos:** sumar o restar, con motivo obligatorio.
  - **Historial:** pedido, sello a mano, ajuste, pedido cancelado.
  - **Canjear premio** y **Borrar cliente**.

---

## 8. Ofertas (`ofertas`)

- Cabecera **Ofertas flash**: rebaja un producto por tiempo limitado. Sale en la ficha, en la tarjeta y en el pin del mapa. El plan marca un tope de ofertas a la vez.
- **Lista** con estado: **En curso**, **Programada**, **Terminada** o «Producto ya no está en el catálogo». Botones **Editar** y quitar (con Deshacer).
- **Nueva oferta:**
  - Producto del catálogo, título (máx. 80) y descripción (máx. 200).
  - Tipo **Por ciento** o **Precio nuevo**; el precio nuevo tiene que ser menor que el original.
  - Inicio, que no puede ser antes de ahora, y fin.
- En la ficha pública se ve con el acabado del 2×1 de la portada: caja cálida, chapita «OFERTA», precio de antes tachado, precio nuevo grande y «−X %».
- Sin carta publicada, pide primero publicar la carta.
- **Guardar ofertas**, con guardia de salida.

---

## 9. Publicar (`publicaciones`), solo el dueño

Posts para grupos de Facebook, con tope semanal según el plan.

- **Producto del catálogo** («Toca para cambiar»), con buscador en la carta, o «Sin producto concreto» (la IA elige).
- **Tipo:** Directa o Antojo.
- **Prompt** libre y **Generar con IA**, que da varias variantes; **Usar esta** copia la elegida al texto.
- **Texto del post** editable y **Añadir foto o flyer**.
- **Enviar a la cola.**
- **En cola esta semana:** estado de cada publicación y eliminar.

---

## 10. Asistente (`telegram`)

- Estado **Vinculado / Sin vincular**.
- **Generar código**, **Copiar** y **Abrir en Telegram** para vincular el chat. **Generar otro** vincula otro chat.
- Dos variantes según el plan:
  - **Agente de Telegram:** botones.
  - **Agente de Telegram (IA):** lenguaje natural. Sirve para marcar agotados, abrir el día o cambiar precios.

---

## 11. Equipo (`equipo`), solo el dueño

- **Añadir o invitar:** correo del trabajador, permisos (Catálogo, Pedidos, Ficha, Telegram) y **Añadir**.
- **Generar enlace de invitación:** vale 7 días y un solo uso.
- **En el equipo:** cada trabajador con sus permisos y **Quitar**.
- **Vacío:** «Todavía no hay trabajadores. Solo entras tú».

---

## 12. Planes (`planes`), solo el dueño

- **Lo que ya tienes:** lo incluido en cualquier negocio, con o sin plan.
- **Nota de tasa de cambio:** precios en USD que se pagan en CUP al cambio del día.
- **Packs completos:**

| Pack | Precio | Lema |
|---|---|---|
| Esencial | 3.5 USD/mes | Para vender sin perder clientes |
| Publicidad Max | 6 USD/mes | Para que te vean |
| Pro | 10 USD/mes | Todo, sin depender de nadie (Más popular) |

- **Servicios por separado** (al mes):

| Módulo | Precio |
|---|---|
| Menú Pro | 1 USD |
| Reservas y pedidos | 1.5 USD |
| Facebook | 1 USD |
| Facebook ×3 | 3 USD |
| Eventos | 3 USD |
| Pedidos programados | 1 USD |
| Cliente frecuente | 1.5 USD |
| Agente de Telegram | 1 USD |
| Agente de Telegram (IA) | 2.5 USD |

- **Botones según el estado:** «Es el que tienes», **Pagar 1 mes**, **Contratar por 1 mes**, **Renovar 1 mes** y «Contratar el módulo que falta». Si hay descuento, sale «Tu descuento».
- **Pack a medida:**
  - **Solicitar pack a medida** abre el diálogo «¿Qué necesitas?»: marcar packs o módulos y **Pedir precio a medida**. El equipo responde en menos de 24 horas.
  - Estados: En revisión, Preparando, Listo para pagar, Activo, Vencido, Cancelado y Rechazado.
- **Pago:** **Pagar con QvaPay** o **Transferir en CUP por WhatsApp**. «Bajar de plan no borra nada».

---

## 13. Diálogos que incluye el cascarón

| Diálogo | Desde |
|---|---|
| Nuevo cliente | Frecuentes → Nuevo |
| Dar sello | Frecuentes → Dar sello |
| Importar catálogo | Catálogo → Importar CSV |
| Nueva zona / Editar zona | Ajustes → Domicilio y zonas |
| ¿Qué necesitas? (pack a medida) | Planes → Solicitar pack a medida |

No se reproducen en el cascarón: los diálogos de confirmación nativos (guardia de salida, borrar), los avisos emergentes (toasts) y el menú de usuario.

---

## 14. Sistema visual (para la optimización)

- **Tokens** (`tailwind.config.ts`):
  - Verde de `verde-50` a `verde-950`; el primario es `verde-400` #35AF6D.
  - `ink` #08130D, `ink-soft` #1B2A21.
  - Fondos `sand` #F6F3EC, `sand-warm` #FBF9F4 y `sand-deep` #EAE4D6.
- **Tipografía:** display (títulos y botones) y sans (texto). Escala: `body` 16, `small` 14, `meta` 12, `h3` 22.
- **Formas:** tarjetas con radio de 16 px y borde `ink/5`; botones en píldora de 44 px de alto (el primario lleva halo verde); campos de 44 px con radio de 12 px.
- **Modo oscuro:** `html[data-theme="dark"]`, con los overrides en `src/app/globals.css`. El cascarón lo imita con el botón «Tema».
- **Patrón de tarjeta de Ajustes:** título con icono, chapita de estado a la derecha, una línea de apoyo y la fila del interruptor separada por una línea fina. Si el plan no llega, **Ver los planes** en lugar del control.
