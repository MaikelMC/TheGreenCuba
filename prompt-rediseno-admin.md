# Tarea: rediseño completo del panel de administración de La Verde

## Objetivo

El panel de admin lo usamos solo dos personas, pero hoy está ordenado como un mapa del sistema: muchos datos de adorno, poco de lo que hay que **hacer** y nada de **dinero**. Quiero convertirlo en una herramienta de trabajo diaria: una bandeja de pendientes que se resuelve sin saltar de pantalla, la foto completa de cada negocio en un clic, los ingresos claros y un registro de quién hizo qué.

**No se pierde ninguna función actual.** Todo lo que hace hoy el panel sigue existiendo; cambia dónde está, cómo se llega y qué información lo acompaña.

## El mockup de referencia

El prototipo aprobado está en el repositorio en el archivo **`Panel de admin de la verde - rediseño.html`** (búscalo por nombre si no está en la raíz; ojo con los espacios y la «ñ» al abrirlo desde la terminal: usa comillas). Es una exportación del lienzo de diseño y contiene **dos pantallas**:
- **Escritorio** (1440 × 900), titulada «Panel de admin · prototipo».
- **Móvil** (390 × 844), titulada «Panel de admin · móvil».

**Cómo leerlo (no lo abras en el navegador):**
- Ábrelo como texto. Dentro encontrarás el código de cada pantalla, posiblemente incrustado como cadenas de texto o en bloques separados. Búscalo por estas marcas: `<x-dc>`, `<sc-if`, `<sc-for`, `renderVals()` y `class Component extends DCLogic`. Hay dos componentes: el de escritorio y el de móvil (el de móvil tiene `dock`, `stageTabs` y `chatOpen`).
- Si el contenido está comprimido o codificado (base64, JSON escapado), decodifícalo solo para leerlo, en un archivo temporal fuera del repositorio, sin modificar el original. **Si no consigues extraer el código de las dos pantallas, para y dímelo**: te pasaré las fuentes por separado.
- El marcado visual está dentro de `<x-dc>…</x-dc>`. `<sc-if value="{{…}}">` es un bloque condicional y `<sc-for list="{{…}}" as="x">` es una lista. Los `{{nombre}}` son valores que calcula el script.
- La lógica está en el script de cada pantalla, en la clase `Component`: el `constructor` tiene el estado y los **datos de ejemplo**, y `renderVals()` calcula todo lo que se pinta y lo que hace cada botón. Léelo para entender **qué muestra cada sección, de dónde sale cada cifra y qué hace cada acción**.
- **Es una guía de estructura y comportamiento, no código para copiar.** No copies su HTML, sus estilos en línea ni sus clases (`.card`, `.btn`, `.chip`…): usa los componentes y tokens reales del proyecto.
- **Los datos son de ejemplo.** Toda cifra, nombre o lista debe salir de la base de datos real. Lo que va entre corchetes (`[—]`, `[Tu compañero]`, `[Cuenta admin 3]`) son datos que faltaban: hay que obtenerlos de verdad o, si no existen, no pintarlos.
- Los avisos tipo «Se abriría…» del prototipo marcan acciones que en la app real **deben hacer algo**: abrir el editor, abrir WhatsApp, etc.
- **No incluyas ese archivo en el código de la app** (ni lo importes ni lo sirvas): es solo referencia. Si está en una carpeta pública (`public/`), avísame para moverlo.

## Reglas de trabajo

- Código y UI en español. Reutiliza antes de crear. **No añadas dependencias** sin preguntarme.
- **Todo solo para administradores:** cada endpoint, acción de servidor y consulta nueva comprueba el rol de admin en el servidor. Nada de lógica de permisos solo en el cliente.
- **Registro de actividad obligatorio:** cada acción que cambia datos (aprobar, rechazar, cambiar plan, confirmar pago, marcar pagado, quitar admin, enviar aviso, destacar, asignar conversación, mover prospecto…) escribe una entrada en el registro (Fase 1) con quién, qué, sobre qué y cuándo.
- **Confirmación** antes de lo masivo o irreversible: enviar avisos (con el número exacto de destinatarios), quitar rol de admin, rechazar solicitudes, acciones en lote, cambios de precio (con a cuántos negocios afecta).
- **Ningún elemento muerto:** cada botón, enlace, contador y resultado de búsqueda funciona de punta a punta. Si algo no se puede conectar, no se pinta y me lo dices. Nada de `href="#"`, handlers vacíos, datos de ejemplo ni `TODO`.
- **Rendimiento:** las cifras y contadores se calculan en el servidor con consultas agregadas y baratas (conteos, sumas, en paralelo). Nada de traer tablas enteras al cliente para contarlas.
- **URL e historial:** cada sección, pestaña, filtro y panel abierto (ficha 360, buscador) tiene su estado en la URL (`?seccion=`, `&negocio=`, `&filtro=`…), de forma que el atrás del navegador o de Android funciona y se puede compartir un enlace al otro admin. Los enlaces actuales al panel siguen funcionando.
- **No conduzcas el navegador** (las reglas del proyecto lo prohíben). Verificación con `npm run typecheck`, `npm test` y la lista de prueba manual. `lint` y `build` no sirven como criterio (ver `CLAUDE.md`).
- **Preguntas:** trabaja de corrido por fases. Solo te detienes en lo marcado **PREGUNTA** o si algo bloquea de verdad.
- **Un commit por fase.**

## Cómo se ejecuta: 6 sesiones

Al empezar te diré qué sesión toca; haz solo sus fases y cierra con el informe de esa sesión. Entre sesión y sesión pruebo yo.

| Sesión | Fases |
|---|---|
| 1 | 0 (reconocimiento) y 1 (base común, armazón, navegación, registro de actividad) |
| 2 | 2 (Pendientes), 3 (buscador global) y 4 (ficha 360) |
| 3 | 5 (Negocios), 6 (Solicitudes) y 7 (Soporte) |
| 4 | 8 (Ingresos y pagos), 9 (Afiliados), 10 (Planes), 11 (Proyectos) y 12 (Prospectos) |
| 5 | 13 (Publicaciones), 14 (Analytics), 15 (Notificaciones), 16 (Usuarios) y 17 (resto de secciones) |
| 6 | 18 (móvil: revisión completa) y verificación final |

**Cada sección se construye ya adaptada a móvil** (Fase 18 es solo la revisión final). Al empezar cada sesión, relee este documento y los informes de las sesiones anteriores.

## Fase 0 — Reconocimiento (solo lectura, sin preguntarme salvo bloqueo)

Antes de tocar nada, genera `RECONOCIMIENTO-ADMIN.md` en la raíz (no lo incluyas en ningún commit) con, para cada cosa, rutas y líneas:

0. **El mockup:** confirma que has podido extraer el código de las dos pantallas de `Panel de admin de la verde - rediseño.html` y resume, sección por sección, qué muestra y qué acciones tiene (según `renderVals()`). Si no puedes extraerlo, para aquí y avísame.
1. **Estructura del panel:** cómo se monta, cómo se cambia de sección, qué secciones hay y qué componente pinta cada una. Cómo se comprueba el rol de admin.
2. **Sistema de diseño:** tokens (`tailwind.config.ts`, `globals.css`), tipografías, componentes de tarjeta, botón, chapita, campo, interruptor, pestañas, diálogos, hojas, toasts y tablas que usa el admin, y **cómo funciona su modo oscuro** (si es el mismo mecanismo de overrides por clase que el Business Panel, dilo). Si existe `RECONOCIMIENTO-DISENO.md` del Business Panel, compáralo y anota solo las diferencias.
3. **Datos disponibles para cada sección nueva:** dónde están los negocios, planes, suscripciones, **pagos reales** (QvaPay y manuales), pruebas, módulos, afiliados y sus comisiones, solicitudes, conversaciones de soporte, publicaciones y su cupo, proyectos, analytics (búsquedas y búsquedas sin resultado), notificaciones enviadas, usuarios y roles, proveedores de IA y su uso. Para cada dato del mockup, marca: **existe** (con su tabla o fuente), **se puede calcular** (cómo) o **no existe**.
4. **Qué falta en el modelo de datos** para el mockup: registro de actividad, prospectos, pagos de comisiones a afiliados, asignación de conversaciones, respuestas guardadas, notas internas por negocio, gasto de IA, etc.
5. **Riesgos:** enlaces externos al panel, acciones sin confirmación, consultas pesadas, código duplicado, y cualquier incoherencia de datos que veas. En particular, **comprueba de dónde sale la «comisión generada» de Afiliados** (en el panel actual no cuadra con los pagos del mes).

Con el reconocimiento hecho, continúa con la Fase 1 sin esperar, salvo que algo bloquee.

## Fidelidad al diseño (obligatorio en todas las fases)

- Todo lo nuevo debe verse como el resto del panel de admin y de La Verde, **en claro y en oscuro**, sin retoques posteriores.
- Usa solo tokens y componentes del proyecto. Nada de colores, tamaños o radios inventados (`bg-[#…]`, `text-[13px]`, `rounded-[18px]`) ni `style={{}}` para color o tipografía. Si falta un token, añádelo (con su versión oscura) y anótalo.
- Si el modo oscuro funciona por overrides de clase en `globals.css`, usa solo clases que ya tengan override o añade el suyo; los diálogos, hojas y menús que se abren en portal deben recibir el oscuro (por ejemplo con una clase común para portales del admin).
- Botón primario: el verde de la app con texto oscuro (nunca texto blanco sobre el verde claro). Iconos de `lucide-react` con el grosor habitual. Objetivos táctiles de al menos 44 px en móvil. Contraste mínimo 4.5:1. Foco visible en todo lo interactivo.
- Las filas horizontales con desplazamiento (filtros, pestañas, chips) ocultan su barra de desplazamiento; las zonas con scroll vertical usan una barra fina que se vea bien en claro y en oscuro.
- Los mockups usan Plus Jakarta Sans, Space Grotesk y colores aproximados: tradúcelos a lo real.

## Fase 1 — Base común, armazón y registro de actividad

1. **Componentes base del admin** (si no existen ya, a partir de los patrones actuales): tarjeta, cifra clave (KPI), fila de lista, chapita de estado (ok, aviso, error, info, neutra), botón primario/secundario/peligro/pequeño, casilla de selección, control segmentado, barra de progreso, hoja/diálogo (hoja inferior en móvil, diálogo o panel lateral en escritorio), estado vacío y toast con «Deshacer» opcional.
2. **Registro de actividad:** tabla (con migración) con `admin_id`, `accion`, `objeto_tipo`, `objeto_id`, `resumen` legible, `datos` (JSON sin secretos) y fecha; una función de servidor `registrarActividad()` y su uso en todas las acciones del admin que ya existen. Las acciones automáticas del sistema (pagos confirmados por QvaPay, envíos) se registran como «Sistema».
3. **Armazón de escritorio:** barra lateral agrupada con contadores en vivo:
   - **Día a día:** Pendientes, Solicitudes, Soporte, Publicaciones.
   - **Negocio:** Negocios, Ingresos y pagos, Afiliados, Proyectos, Prospectos.
   - **Crecimiento:** Analytics, Notificaciones, Onboarding.
   - **Configuración:** Planes y precios, Categorías, Proveedores IA, Usuarios, Diagnóstico, Actividad.
   Abajo, los dos administradores (nombre real del usuario conectado y del otro admin). Barra superior con el título de la sección y el **buscador global** (Fase 3).
4. **Armazón móvil:** barra superior con título y lupa; **dock inferior flotante** (el mismo patrón de dock que ya usa La Verde) con Pendientes, Negocios, Soporte, Ingresos y Más, cada uno con su contador; «Más» lista todas las secciones agrupadas como en escritorio.
5. **Contadores:** un endpoint o función de servidor única y ligera que devuelve todos los contadores de la navegación (pendientes, solicitudes, conversaciones sin asignar, publicaciones por revisar, cobros pendientes, avisos de diagnóstico, alerta de admins). Se refresca al volver a la pestaña y tras cada acción.
6. **URL e historial** como dice «Reglas de trabajo». Los `?seccion=` actuales siguen funcionando; si cambia algún id, redirige.
7. Quita los textos de ayuda que solo explican cosas obvias («Gestiona los negocios en…», «Las categorías se editan en…»).

## Fase 2 — Pendientes (nueva portada)

1. Saludo con el nombre del admin conectado, fecha (`America/Havana`) y número de pendientes.
2. **Bandeja «Necesita a uno de los dos»**, calculada en el servidor y ordenada por urgencia. Cada fila con tipo, título, detalle y **una acción que la resuelve ahí mismo** (más una secundaria opcional). Tipos y origen:
   - conversación de soporte esperando respuesta (más antigua primero) → Responder (abre Soporte en esa conversación);
   - solicitudes nuevas → Aprobar (si la revisión automática está completa) / Revisar;
   - pago por confirmar (QvaPay o manual) → Confirmar pago;
   - cobro vencido → Recordar por WhatsApp (abre `wa.me` con el número del dueño y un mensaje predefinido);
   - prueba que vence en 7 días o menos → Ofrecer plan;
   - publicaciones por revisar → Revisar;
   - fichas con problemas (sin tipo, sin fotos, más de 30 días sin actividad) → Abrir ficha 360;
   - problemas de Diagnóstico (ver el prompt de Diagnóstico; si ya está aplicado, reutiliza su función de resumen).
   Al resolver una fila, desaparece sin recargar y se registra en Actividad. Sin pendientes: «Todo al día».
3. **Cifras clave**: ingreso mensual (CUP y USD), negocios que pagan, pruebas que vencen esta semana, búsquedas sin resultado (30 días). Cada una enlaza a su sección.
4. **Sistema**: solo los avisos activos, con su acción. **Tasa de hoy** (la fuente que ya usa el panel).

## Fase 3 — Buscador global

- Escritorio: botón en la barra superior y atajo `Ctrl/Cmd + K`. Móvil: lupa que abre el buscador a pantalla completa con «Cancelar».
- Busca en **negocios** (nombre, dueño, teléfono, ciudad), **usuarios** (nombre, correo, teléfono) y **secciones**. Sin tildes ni mayúsculas; teléfonos con o sin `+53` y espacios. Búsqueda en el servidor, con un límite de resultados y espera breve al teclear.
- Cada resultado lleva a su sitio: negocio → ficha 360; usuario → su negocio o su ficha de usuario; sección → la sección. Navegable con teclado (flechas, Enter, Escape).

## Fase 4 — Ficha 360 del negocio

- Panel lateral en escritorio (≈ 480 px) y hoja a casi pantalla completa en móvil. Se abre al tocar el nombre de un negocio **en cualquier sección** y queda en la URL (`&negocio=<id>`).
- Contenido, todo real:
  - cabecera: logo o iniciales, nombre, ubicación, tipo, chapitas de plan, estado y destacado;
  - acciones: **WhatsApp al dueño**, ver ficha pública, editar (al editor actual del admin), cambiar plan, destacar / quitar destacado (con registro);
  - **pago**: estado (al día con fecha de renovación, por confirmar, vencido con días, prueba con días restantes, gratis) y precio en CUP y USD;
  - **ficha**: % de completitud con lo que falta (misma regla en todo el panel, definida en un solo sitio);
  - visitas y pedidos de 30 días, publicaciones usadas del cupo semanal;
  - dueño, última actividad del dueño (último inicio de sesión o cambio en su panel), afiliado, fecha de alta;
  - conversaciones de soporte abiertas, con enlace;
  - **nota interna** solo para admins, que se guarda al salir del campo (tabla nueva si no existe) y queda en Actividad.

## Fase 5 — Negocios

- **Filtros guardados** como chips con contador: Todos, Prueba vence (≤ 7 días), Impagos, Sin fotos, Sin actividad 30 días, Sin tipo. Además el buscador y los filtros actuales (categoría, plan, estado) si existen.
- Tabla en escritorio con columnas: selección, negocio (nombre + ubicación y tipo), plan, pago, ficha (barra y %), última actividad (en rojo si > 30 días), visitas 30 días, estado. Ordenable. Paginada en el servidor.
- En móvil, tarjetas con la misma información.
- **Selección múltiple** con barra de acciones: asignar tipo, destacar, enviar aviso (lleva a Notificaciones con esos negocios como destinatarios), quitar selección. Confirmación con el número de negocios y registro en Actividad.
- «Nuevo negocio» abre el alta que ya existe.

## Fase 6 — Solicitudes

- Cada solicitud muestra sus datos y una **revisión automática** con chapitas: fotos, horario, ubicación, tipo, teléfono duplicado (con otro negocio) y mismo dueño que otro negocio (informativo). La lógica de revisión, en el servidor y en un solo sitio.
- Si falta el tipo, **un selector para asignarlo ahí mismo**; «Aprobar y publicar» queda desactivado (con explicación) hasta que lo esté.
- Acciones: **Rechazar** (con confirmación y motivo), **Pedir cambios** (envía al solicitante un mensaje generado con lo que falta) y **Aprobar y publicar**. **PREGUNTA:** ¿por qué canal se manda «Pedir cambios» (correo, notificación en la app, WhatsApp)? Propón según lo que exista.
- Todas registran Actividad y actualizan los contadores.

## Fase 7 — Soporte

- Escritorio en tres columnas: conversaciones, chat y **contexto** (el negocio de esa persona con su estado y plan, la pista de por qué escribe —por ejemplo «su ficha está en Solicitudes»— y acciones directas como **aprobar su ficha desde aquí** o abrir la ficha 360). En móvil: lista → chat con flecha para volver; el contexto va arriba del chat.
- **Asignación** por conversación: Mía, del otro admin (con su nombre real) o Sin asignar, guardada y registrada.
- **Respuestas guardadas** editables (tabla nueva si no existe) que rellenan el campo de respuesta.
- Enviar respuesta y cerrar conversación usan la lógica actual. Tiempo medio de respuesta de la semana, calculado de verdad o, si no hay datos, no se muestra.

## Fase 8 — Ingresos y pagos (sección nueva)

- **PREGUNTA (antes de calcular):** confirma la fuente de verdad del dinero: ¿pagos registrados (QvaPay + manuales) o suscripciones activas por precio de catálogo? Propón mostrar ambos si difieren: «facturado este mes» (pagos reales) e «ingreso recurrente esperado» (suscripciones × precio).
- Cifras: ingreso del mes en **CUP y USD** (tasa del día, indicada), neto tras comisiones de afiliados, negocios que pagan (por plan), conversión de prueba a pago y bajas del mes (solo si se pueden calcular con el historial; si no, no se pintan y lo anotas).
- **De dónde viene el dinero**: por plan y por módulo, con barras.
- **Cobros pendientes**: vencidos, por confirmar y pruebas que vencen, con su acción (Recordar, Confirmar, Ofrecer plan). Confirmar pago usa la lógica de pagos existente.
- **Conciliación**: si las comisiones de afiliados no cuadran con los pagos referidos, aviso con las dos cifras y enlace a Afiliados.

## Fase 9 — Afiliados

- Cifras: activos, pagos referidos del mes y **lo que hay que pagarles este mes** (con la regla real de comisión: 15 % recurrente, 20 % con 10 negocios pagando a la vez, o la que esté en el código).
- Lista con lo que corresponde a cada uno y **Marcar como pagado** (tabla de liquidaciones con mes, importe, fecha y admin; registro en Actividad). Lo ya pagado se muestra como tal.
- Corrige o explica la «comisión generada» que no cuadra (Fase 0). **PREGUNTA** si la corrección cambia importes que ya se comunicaron a afiliados.

## Fase 10 — Planes y precios

- Precios en **CUP y USD** (tasa del día) en planes y módulos sueltos, con negocios en cada uno e ingreso mensual por módulo.
- Al editar un precio, antes de guardar: «Afecta solo a suscripciones nuevas; hoy N negocios tienen este plan y no cambian». Confirmación y registro.

## Fase 11 — Proyectos

Lista con proyecto, negocio (abre ficha 360), tipo, presupuesto, fecha y estado, con Aprobar / Rechazar en los pendientes (lógica actual, con registro).

## Fase 12 — Prospectos (sección nueva)

- Tabla nueva (con migración): nombre, provincia, origen (visita propia, afiliado con su código, analytics), etapa (Contactado, Visitado, Interesado, Pack enviado, Pagando), próximo paso, notas, admin responsable, fechas. Cuando pasa a «Pagando» y existe el negocio, se enlaza.
- Escritorio: tablero de 5 columnas con «Mover a…» (y opción de retroceder). Móvil: pestañas por etapa.
- «Nuevo prospecto» con un formulario corto. Todo con registro.

## Fase 13 — Publicaciones

- **Semana en calendario** (lunes a domingo) con las publicaciones programadas, publicadas y borradores sin fecha.
- **Por revisar** con selección múltiple y «Aprobar N seleccionadas», además de Editar y Aprobar por fila (lógica actual).
- **Negocios que no han usado sus publicaciones** esta semana, con «Generar» (abre el generador actual con ese negocio).

## Fase 14 — Analytics

- Mantén las cifras y gráficos actuales que sirvan; **la distribución por categoría vive aquí** (y desaparece del inicio).
- **Demanda vs oferta**: término, búsquedas, negocios y brecha, con **Captar**, que crea un prospecto con ese término y lleva a Prospectos.
- Lista de **búsquedas sin resultado** (si se guardan los términos; si no, anótalo).
- Embudo y exportar CSV (lo actual).

## Fase 15 — Notificaciones

- Segmentos con el **número real de destinatarios** calculado en el servidor (todos, dueños, afiliados activos, en prueba, por plan, por provincia).
- Asunto, mensaje con variables (`nombre`, `negocio`, `ciudad`), **Enviarme una prueba**, Programar (si existe la función; si no, no se pinta) y **Enviar a N**, que abre una confirmación con el número exacto y si ya se envió la prueba.
- Respeta las bajas de cada usuario. Lista de enviados. Registro en Actividad.

## Fase 16 — Usuarios

- **Alerta** si hay más cuentas con rol de administrador de las esperadas, con la lista real y **Quitar admin** por cuenta. Nunca se puede quitar el rol a uno mismo ni dejar el sistema con menos de un administrador. **PREGUNTA:** confírmame cuántas cuentas deben quedar como admin y cuáles, antes de mostrar la alerta como error.
- Lista de usuarios con ciudad, rol, negocio vinculado (abre ficha 360) y fecha de alta, paginada en el servidor.

## Fase 17 — Resto de secciones

- **Onboarding**: embudo por paso con % y la caída mayor destacada (datos actuales).
- **Categorías**: igual que hoy, en cuadrícula.
- **Proveedores IA**: por proveedor, rol, modelo, estado, latencia, coste por millón de tokens, y **gasto del mes y veces que entró como respaldo** si se registran; si no, propón cómo registrarlo y no pintes esas cifras hasta tenerlas.
- **Diagnóstico**: aplica (o mantén, si ya está aplicado) lo descrito en `prompt-diagnostico-admin.md`; aquí solo enlázalo con la navegación y Pendientes.
- **Actividad**: el registro de la Fase 1, con filtros por admin, tipo de acción y fecha, y enlace a cada objeto.

## Fase 18 — Móvil: revisión completa

Recorre todas las secciones a 360 px: dock con contadores, «Más», tarjetas en lugar de tablas, Soporte como mensajería, Prospectos por pestañas, Publicaciones con la semana deslizable, ficha 360 y buscador a pantalla completa, confirmaciones como hojas inferiores, botones de al menos 44 px y nada tapado por el dock (toasts y barras de acciones por encima).

## Verificación final (sesión 6)

1. **Funciones:** recorre todas las funciones del panel actual (según `RECONOCIMIENTO-ADMIN.md`) y marca dónde viven ahora. Ninguna puede faltar.
2. **Mockup:** recorre `renderVals()` de las dos pantallas de `Panel de admin de la verde - rediseño.html` y confirma que cada lista, cifra y acción tiene su equivalente real, o que se omitió por falta de datos (con motivo).
3. **Permisos:** todos los endpoints y acciones nuevas comprueban el rol de admin en el servidor.
4. **Actividad:** cada acción que cambia datos deja su entrada.
5. **Elementos muertos y estilo:** sin `href="#"`, handlers vacíos, `TODO`, datos de ejemplo ni valores arbitrarios nuevos; toda clase de color nueva tiene su versión oscura.
6. `npm run typecheck` y `npm test` sin errores, con pruebas de: cálculo de ingresos y comisiones, revisión automática de solicitudes, completitud de ficha, contadores de navegación y permisos de admin.
7. **Lista de prueba manual para mí**, en escritorio y móvil, en claro y oscuro: resolver cada tipo de pendiente; buscar un negocio por teléfono y abrir su 360; filtrar Impagos y recordar un cobro; asignar el tipo a una solicitud y aprobarla; aprobar una ficha desde Soporte; asignar una conversación; marcar pagada una comisión; mover un prospecto y crear otro desde Analytics; aprobar varias publicaciones; enviar un aviso de prueba y luego a un segmento pequeño; quitar el rol de admin a una cuenta de prueba; ver todo en Actividad; atrás de Android dentro de la ficha 360 y del buscador.

## Informe final de cada sesión

- Qué hiciste y dónde (rutas).
- Tablas y migraciones nuevas.
- Datos del mockup que no existen y qué hiciste con ellos.
- Decisiones propias y por qué.
- Respuestas pendientes a las **PREGUNTAS**.
