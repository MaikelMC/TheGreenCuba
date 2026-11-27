# Tarea: rediseño de la propuesta del pack a medida (y su factura)

## Objetivo

Cuando un negocio quiere nuestros servicios, le enviamos una página con su pack propuesto para que lo revise y lo acepte. Hoy esa página se llama «Factura de servicios» y tiene problemas que frenan el «sí»:
- se llama factura cuando todavía es una **propuesta**;
- el precio no explica qué se paga hoy, qué se lleva con el 2×1 ni cuánto pagará después;
- el importe en CUP sale con tres decimales y formato mezclado («5,695.832 CUP»);
- se incluye una función en **«próximamente»** (flyers) como si entrara en el precio;
- las listas de cada módulo hablan de cómo funciona el sistema y no de qué gana el negocio, y las dependencias («Requiere el módulo…») aparecen como ventajas;
- la nota mezcla «usted» con «tú» y no aporta;
- un solo botón ambiguo («Empezar»), sin forma de pedir cambios ni instrucciones de pago;
- tarjetas grises de poco contraste que parecen desactivadas.

Quiero aplicar **al pie de la letra** el rediseño aprobado, con todos sus estados y conectado de verdad.

## El mockup de referencia

El prototipo aprobado se llama «Propuesta de pack a medida – Rediseño». Si está en el repositorio, búscalo por ese nombre (con comillas por los espacios). El marcado está dentro de `<x-dc>`, `<sc-if>` son condiciones, `<sc-for>` listas, y toda la lógica (estados, textos, qué hace cada botón) está en `renderVals()` de `class Component`.
- **No lo abras en el navegador, no copies su HTML ni sus estilos y no lo incluyas en la app.** Es guía de estructura, textos y comportamiento.
- Sus datos son los de una propuesta real de ejemplo (Kynari Dev). **Todo debe salir de la base de datos.** Lo que va entre corchetes (vigencia, precio por separado, usuario de QvaPay, tarjeta, titular, número de factura, método) son datos que hay que obtener de verdad o, si no existen, no pintar.
- Si no está en el repositorio, este documento describe todo lo necesario.

## Reglas de trabajo

- Código y UI en español, **tuteando** siempre. Cambios mínimos fuera de esta página. Reutiliza antes de crear. **Sin dependencias nuevas** salvo que me preguntes.
- **No rompas enlaces:** las propuestas ya enviadas siguen abriéndose con su URL actual y su token, en el estado que les corresponda.
- **Solo se vende lo que está en producción.** Las funciones de un módulo que estén en demo o «próximamente» no aparecen en su lista ni en el precio (ver Fase 3).
- **Precios en USD y CUP**, con la tasa y su fecha visibles.
- **Seguridad:** la página es pública por enlace con token. Aceptar, avisar de pago o pedir cambios solo funciona con ese token válido; los datos de pago (tarjeta, titular, usuario de QvaPay) salen de la configuración del servidor, nunca escritos en el código. Nada de datos de otros negocios en la respuesta.
- **Registro:** cada cambio de estado queda registrado (si existe el registro de actividad del admin, úsalo) y genera un aviso para administración.
- **Ningún elemento muerto:** cada botón funciona de punta a punta. Si algo no se puede conectar, no se pinta y me lo dices. Nada de `href="#"`, handlers vacíos, datos de ejemplo ni `TODO`.
- **Fidelidad al diseño de la app**, en claro y en oscuro (el mockup está en oscuro, como la página actual): solo tokens y componentes del proyecto, sin colores ni tamaños arbitrarios nuevos. Si el oscuro funciona por overrides de clase en `globals.css`, usa clases que ya los tengan o añade el suyo; las hojas en portal también lo reciben. Botón primario con el verde de la app y texto oscuro. Tarjetas oscuras con borde suave (nada de grises planos). Contraste mínimo 4.5:1, objetivos táctiles de 44 px, foco visible, iconos `lucide-react`.
- **No conduzcas el navegador** (las reglas del proyecto lo prohíben). Verificación con `npm run typecheck`, `npm test` y la lista de prueba manual. `lint` y `build` no sirven como criterio.
- **Preguntas:** trabaja de corrido. Solo te detienes en lo marcado **PREGUNTA** o si algo bloquea de verdad.
- **Un commit por fase. Dos sesiones:** sesión 1 = fases 0 a 3; sesión 2 = fases 4 a 7 y verificación.

## Fase 0 — Reconocimiento (solo lectura)

Anota en el informe, con rutas y líneas:
1. La página actual de la factura: ruta pública, cómo se genera el token, componente y datos que recibe.
2. El modelo de la propuesta: negocio, módulos incluidos, precio, oferta 2×1, fecha, referencia, estado actual («pendiente de aceptar»…), y qué hace hoy «Empezar».
3. De dónde salen los **módulos y sus funciones** (catálogo, `src/lib/plans.ts`…) y si cada función tiene un estado (producción, demo, próximamente).
4. La **tasa** usada para el CUP y cómo se formatea hoy el importe.
5. Cómo se confirma hoy el pago y se activa el acceso, y qué parte de «pack a medida dentro de la app» (solicitud, armado desde administración, pago con QvaPay, 2×1) ya existe y qué está en desarrollo.
6. Si existe ya: recibo o factura en PDF, numeración de facturas, avisos al admin, registro de actividad, integración de QvaPay.

## Fase 1 — Estados y datos

1. **Estados de la propuesta** (añade los que falten, con migración y sin romper las existentes):
   - `pendiente` (enviada, esperando que el negocio la acepte);
   - `aceptada` (aceptada, falta el pago; guarda el método de pago elegido);
   - `en_revision` (el negocio avisó de que pagó; falta que administración lo confirme);
   - `pagada` (confirmada; se activan los servicios; desde aquí es una **factura**);
   - `caducada` (pasó la fecha de validez sin aceptarse).
   Mapea los estados actuales a estos.
2. **Validez:** fecha límite por propuesta. **PREGUNTA:** ¿cuántos días por defecto (por ejemplo 7)? Hasta que responda, usa 7 y déjalo configurable. Una propuesta `pendiente` pasada su fecha se muestra como `caducada` (calculado al servir la página; si hay tareas programadas, también se marca en la base).
3. **Nota personal:** campo de texto por propuesta, escrito por quien la prepara (con su nombre), editable desde administración. Si está vacío, no se muestra el bloque.
4. **Precio por separado:** calcúlalo sumando el precio mensual de cada módulo incluido según el catálogo vigente. Si falta el precio de algún módulo, no muestres esa fila (y anótalo).
5. **Fechas derivadas:** con el 2×1 del primer pago, «te llevas 2 meses» y el siguiente cobro es la fecha de pago + 2 meses (si no hay 2×1, + 1 mes). Calcúlalo en el servidor con la zona `America/Havana`.
6. **Datos de pago** configurables en el servidor (variables de entorno o tabla de ajustes del admin): usuario de QvaPay, tarjeta y titular para CUP, y si el efectivo está disponible (solo Santiago de Cuba: mostrarlo solo si el negocio es de Santiago).
7. **Número de factura:** secuencial, asignado al pasar a `pagada`. Si ya existe numeración, reutilízala.

## Fase 2 — Formato del dinero

- Utilidad única: USD sin decimales si es entero («5 USD»), con dos si no («3,50 USD»); CUP **redondeado a pesos enteros** con separador de miles por espacio fino o punto, según el formato que ya use la app («≈ 5 696 CUP»), nunca con tres decimales.
- Línea de tasa: «Tasa del 26 nov: 1 139 CUP por USD» (fecha de la tasa usada). En `pagada`: «Tasa aplicada: …».
- Pruebas con `npm test`.

## Fase 3 — Módulos: beneficios y lo que no se vende

1. Para cada módulo, un **beneficio en una línea** en lenguaje de resultado, y su lista de detalles. Usa estos textos (guárdalos junto al catálogo de módulos, no escritos en la página):
   - **Menú Pro** — «Tu carta online con QR y todos los productos que quieras.» Detalles: QR listo para imprimir como sticker · Productos ilimitados · Sección de ofertas y novedades en tu carta.
   - **Reservas y pedidos** — «Te llegan los pedidos ordenados por WhatsApp y controlas las reservas.» Detalles: Pedidos por WhatsApp desde tu carta · Reservas según la capacidad de tu local · Horario de cocina y pausa cuando lo necesites. Nota: «Incluye todo lo de Menú Pro.»
   - **Facebook** — «Una publicación lista cada semana, escrita con IA a partir de tus productos.» Detalles: Texto del post generado con IA · Usa los productos de tu carta como referencia · 1 publicación por semana.
   - **Pedidos programados** — «Tus clientes piden para la hora que quieran, hoy o mañana.» Detalles: Pedidos por franja horaria, hoy y días siguientes · Un código corto en cada pedido para encontrarlo en WhatsApp · Aviso por Telegram antes de cada pedido. Nota: «Funciona junto con Reservas y pedidos (incluido).»
   - **Cliente frecuente** — «Premia a los que repiten con una tarjeta de sellos en el móvil.» Detalles: Sellos automáticos al entregar un pedido · Premios por número de compras, con canje y ajustes · Pasa a digital las tarjetas de papel que ya usas. Nota: «Funciona junto con Reservas y pedidos (incluido).»
   - **Agente de Telegram** — «Cambia tu menú y el estado de tu negocio con botones, sin escribir.» Detalles: Consulta y edita tu menú al instante · Abre, cierra o pausa tu negocio · Todo con botones dentro del chat.
   Si algún detalle no es cierto en el código actual (por ejemplo, el sello no es automático al entregar), **corrígelo para que diga la verdad** y dímelo.
2. **Dependencias:** nunca como línea de la lista; como nota pequeña bajo los detalles, y solo si el módulo requerido está incluido. Si no lo está, la propuesta no se puede enviar así (valídalo en el servidor al crearla).
3. **«Todo el Menú Pro»** dentro de Reservas y pedidos se sustituye por la nota «Incluye todo lo de Menú Pro».
4. **Funciones en demo o «próximamente»** (como los flyers): fuera de la lista y del precio. Si alguna aplica al pack, un bloque aparte con borde discontinuo: «Próximamente, sin coste extra: [funciones]. No forma parte del precio.»

## Fase 4 — La página, sección por sección

Una sola columna, pensada para móvil (360–430 px) y centrada en escritorio con ancho máximo de unos 480 px.

1. **Cabecera** (franja verde muy oscura en oscuro, su equivalente en claro):
   - «LA VERDE» pequeño y, a la derecha, la **chapita de estado**: «Pendiente de aceptar», «Aceptado · falta el pago», «Pago en revisión» (ámbar), «Pagada · activo» (verde) o «Caducada» (neutra);
   - **título** según el estado: «Tu pack a medida», «Pack aceptado: solo falta pagar», «Estamos revisando tu pago», «Factura de servicios» (solo en `pagada`) o «Tu pack a medida» (caducada);
   - «Para **[negocio]** · [fecha y hora]»;
   - «Ref. [REFERENCIA EN MAYÚSCULAS]» con botón **Copiar** (al portapapeles, con aviso «Referencia copiada») y, en `pendiente`, «· válida hasta el [fecha]»; en `pagada`, «· Factura n.º [número]».
2. **Barra de 3 pasos** «1 · Aceptas», «2 · Pagas», «3 · Activo»: completados en verde, el actual en ámbar, los siguientes apagados.
3. **Avisos por estado:**
   - `caducada`: bloque ámbar «Esta propuesta caducó el [fecha]» + «Los precios o la tasa pueden haber cambiado. Pide una nueva y te la preparamos al momento.»;
   - `en_revision`: tarjeta «Recibimos tu aviso de pago» + «Lo confirmamos en menos de 24 h y te avisamos por WhatsApp. No tienes que hacer nada más.» (sin el enlace de demo del mockup);
   - `pagada`: tarjeta verde «Tu pack está activo» + «Ya puedes usar los [N] servicios desde tu panel. Esta es tu factura.»
4. **Nota personal** (en `pendiente` y `caducada`, si hay nota): inicial o foto de quien la preparó, su nombre, «La Verde · te armó este pack», el texto y el enlace **«Escribirle por WhatsApp»** (al número de esa persona o al de La Verde).
5. **Precio:**
   - en `pendiente`, `aceptada`, `en_revision` y `caducada`: «PAGAS HOY» · **[importe] USD** grande · «≈ [importe] CUP» · línea de tasa; filas: «Te llevas — 2 meses gracias al 2×1» (en verde; solo si hay 2×1), «Después — [importe] USD/mes desde el [fecha]», «Por separado costaría — [importe] USD/mes» (Fase 1.4), «Permanencia — Ninguna»;
   - en `pagada`: «PAGADO EL [fecha]» · importe · «Tasa aplicada…»; filas: «Periodo — [inicio] – [fin]», «Incluye — 2 meses (2×1 del primer pago)», «Próximo cobro — [fecha] · [importe] USD», «Método — [método]».
6. **¿Cómo quieres pagar?** (solo en `aceptada`): opciones seleccionables de 56 px: **QvaPay** («En USD · se confirma más rápido»), **Transferencia en CUP** («Desde tu banca móvil»), **Efectivo** («Solo en Santiago de Cuba», solo si aplica). Al elegir una, sus instrucciones con los datos reales de la Fase 1.6 y «Pon la referencia [REF] para que lo encontremos rápido». El método elegido se guarda.
7. **Qué incluye tu pack** («Tienes activo» en `pagada`), con «[N] servicios»: una fila por módulo con icono de check, nombre y beneficio; se despliega con «+»/«−» para ver detalles y nota (Fase 3). Debajo, el bloque de «Próximamente» si aplica.
8. **Cómo empezar** (solo en `pendiente`): 1 «Aceptas el pack.» Con un toque, aquí abajo. · 2 «Pagas como prefieras.» [métodos disponibles]. · 3 «Lo activamos en menos de 24 h.» Te avisamos por WhatsApp y lo ves en tu panel. Y el enlace **«¿Tienes una duda? Pregúntanos»** (WhatsApp con la referencia).
9. **Pie:** «Sin permanencia: cancelas cuando quieras. El 2×1 aplica solo al primer pago. El importe en CUP sigue la tasa del día en que pagas.» y «La Verde · Servicios para negocios». Si alguna de estas condiciones no es cierta hoy, **PREGUNTA** antes de publicarla.

## Fase 5 — Barra inferior y acciones

Barra fija abajo, por encima del contenido, con margen para la zona segura del móvil:
- `pendiente`: **«Quiero cambiar algo»** (secundario; abre WhatsApp con «Hola, sobre la propuesta [REF] quiero cambiar…» y registra la petición para administración) y **«Acepto el pack»** (primario).
- «Acepto el pack» abre una **hoja de confirmación**: «¿Aceptas tu pack a medida?» · «Pagas hoy **[importe] USD** (≈ [CUP]) y te llevas **2 meses**.» · «Después, [importe] USD al mes desde el [fecha]. Sin permanencia.» · «En el paso siguiente eliges cómo pagar.» · **«Sí, acepto»** / «Ahora no». Al confirmar → `aceptada` (servidor, con token), registro y aviso a administración.
- `aceptada`: **«Ya pagué»**, desactivado con el texto «Elige cómo pagar» hasta elegir método. Al pulsar → `en_revision`, aviso a administración con el método y la referencia (y en la bandeja de Pendientes del admin si existe).
- `en_revision`: **«Escribir a [nombre]»** (WhatsApp).
- `pagada`: **«Descargar PDF»** (si ya existe generación de PDF, úsala; si no, **PREGUNTA**: ¿generarlo en el servidor sin dependencias nuevas o dejar una versión imprimible con `window.print()` y estilos de impresión?) y **«Ir a mi panel»** (al Business Panel de ese negocio).
- `caducada`: **«Pedir una propuesta nueva»** → registra la petición para administración y muestra «Te mandamos una nueva por WhatsApp».

## Fase 6 — Lado de administración

Lo mínimo para que el flujo funcione, reutilizando lo que exista:
- al crear o editar una propuesta: escribir la **nota personal**, ver la validez y el **precio por separado** calculado, y la validación de dependencias;
- ver las propuestas por estado; en `en_revision`, **«Confirmar pago»**, que pasa a `pagada`, asigna número de factura, activa los servicios con la lógica actual y avisa al negocio;
- ver las peticiones de «Quiero cambiar algo» y «Pedir una propuesta nueva».

## Fase 7 — Accesibilidad y detalles

- Botones de icono con `aria-label`; opciones de pago con `aria-pressed`; módulos desplegables con `aria-expanded`; la hoja de confirmación como diálogo con foco atrapado y cierre con Escape.
- El estado se anuncia en el título de la página («Tu pack a medida · La Verde»).
- La página funciona con conexión lenta: sin imágenes pesadas; el contenido principal llega renderizado del servidor.

## Verificación (sesión 2)

1. Las propuestas existentes abren bien con su enlace y su estado.
2. Ningún texto promete funciones que no están en producción; los flyers (y similares) solo aparecen en el bloque «Próximamente».
3. Importes: USD y CUP con el formato nuevo en todas las vistas; la tasa y su fecha visibles.
4. Sin elementos muertos, datos de ejemplo ni valores arbitrarios nuevos; toda clase de color nueva con su versión oscura.
5. `npm run typecheck` y `npm test` sin errores, con pruebas de: transiciones de estado (y que no se puedan saltar pasos ni repetir), caducidad, fechas del 2×1, precio por separado, formato de dinero y validación del token.
6. **Lista de prueba manual para mí**, en móvil y escritorio, claro y oscuro: abrir una propuesta pendiente; desplegar módulos; copiar la referencia; «Quiero cambiar algo»; aceptar con confirmación; elegir cada método de pago y ver sus instrucciones; «Ya pagué»; confirmar el pago desde administración y ver la factura con número; descargar el PDF; abrir una propuesta caducada y pedir otra nueva.

## Informe de cada sesión

- Qué cambiaste y dónde (rutas), y migraciones.
- Estados antiguos → nuevos.
- Textos de módulos que tuviste que corregir para que fueran ciertos.
- Datos que faltaban (precios de módulos, datos de pago) y qué hiciste.
- Respuestas pendientes a las **PREGUNTAS**.
