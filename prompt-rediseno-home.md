# Tarea: rediseño del home (mapa + «Cerca de ti») sin tocar el mapa

## Objetivo

El home es lo primero que ve cualquier usuario al abrir La Verde. Hoy tiene problemas que le hacen perder tiempo o confianza:
- de noche **recomienda primero negocios cerrados** y solo dice «Cerrado»;
- al abrir, el mapa **enseña zona rural sin pines** cuando la hoja está abierta;
- hay **8 botones flotantes**, varios sin significado claro;
- una tarjeta de texto de la IA ocupa mucho y no aporta;
- la ventana que sale al tocar un pin **flota en medio, tapa pines, choca con los botones** (la X queda bajo la luna) y **no dice si el negocio está abierto**;
- hay datos mal mostrados: un «·» suelto tras la categoría, barrios con mayúsculas desiguales y direcciones que empiezan por «Dirección…».

Quiero aplicar el rediseño aprobado **sin romper nada**.

## Regla principal: el mapa no se toca

El mapa funciona y no se cambia. **Prohibido modificar**:
- la librería del mapa, su versión y su configuración;
- el estilo, las teselas, las fuentes y los sprites del mapa;
- el mapa descargado para uso sin conexión y su caché;
- la inicialización, los controles de gestos y el rendimiento;
- la vista 3D en sí y el modo nocturno del mapa en sí (solo se mueven sus **botones**, ver Fase 4);
- la telemetría del mapa (la arregla otro prompt, `prompt-diagnostico-admin.md`).

**Solo se permite** en el mapa:
1. **Los pines**: su aspecto (color según abierto o cerrado, estado seleccionado, orden de apilado) y qué pasa al tocarlos.
2. **La cámara al abrir y al seleccionar**, usando la API pública que ya se use en el proyecto (por ejemplo `fitBounds`/`easeTo` con `padding`), sin cambiar la configuración del mapa.
3. **Lo que se dibuja encima** como capas de interfaz (categorías, botones, hoja, tarjeta).

Antes de cerrar cada sesión, revisa `git diff` de los archivos del mapa: solo pueden aparecer cambios en el código de los pines y de la cámara. Si para algo del diseño crees que hay que tocar el mapa, **para y pregúntame**.

## El mockup de referencia

El prototipo aprobado se llama «Home y recomendaciones de La Verde – Rediseño». Si te lo he dejado en el repositorio (búscalo por ese nombre, con comillas por los espacios), úsalo como guía: el marcado está dentro de `<x-dc>`, `<sc-if>` son condiciones, `<sc-for>` listas, y la lógica (datos de ejemplo, orden, filtros, qué hace cada botón) está en `renderVals()` de `class Component`. **No lo abras en el navegador, no copies su HTML ni sus estilos** y no lo incluyas en la app. Sus datos (horarios, ofertas, distancias, notificaciones) son de ejemplo: todo sale de la base real. Si no está en el repositorio, este documento basta.

## Reglas de trabajo

- Código y UI en español. Cambios mínimos y localizados. Reutiliza antes de crear. **Sin dependencias nuevas** salvo que me preguntes.
- **Ningún elemento muerto:** cada botón, chip y enlace funciona de punta a punta. Si algo no se puede conectar, no se pinta y me lo dices. Nada de `href="#"`, handlers vacíos, datos de ejemplo ni `TODO`.
- **Nada de datos inventados:** lo que no exista (por ejemplo «Mis pedidos» si no hay pedidos del cliente) no se muestra.
- **Fidelidad al diseño de la app**, en claro y en oscuro: solo tokens y componentes del proyecto; sin colores, tamaños ni radios arbitrarios nuevos (`bg-[#…]`, `text-[13px]`); si el oscuro funciona por overrides de clase en `globals.css`, usa clases que ya los tengan o añade el suyo; lo que se abre en portal (hojas, menús) también recibe el oscuro. Botón primario con el verde de la app y texto oscuro. Iconos `lucide-react`. Filas horizontales con scroll sin barra visible.
- **Accesibilidad:** objetivos táctiles de al menos 44 px, `aria-label` en botones de icono, foco visible, contraste mínimo 4.5:1, y el estado de los interruptores y chips con `aria-pressed`.
- **Datos móviles:** nada de peticiones nuevas en cada movimiento del mapa; imágenes en tamaño pequeño; lo nuevo funciona con el snapshot offline que ya existe.
- **URL e historial:** el negocio seleccionado y las hojas abiertas (búsqueda, menú, opciones) se reflejan en la URL o el historial, para que el atrás de Android las cierre en vez de salir de la app.
- **No conduzcas el navegador** (las reglas del proyecto lo prohíben). Verificación con `npm run typecheck`, `npm test` y la lista de prueba manual. `lint` y `build` no sirven como criterio.
- **Preguntas:** trabaja de corrido. Solo te detienes en lo marcado **PREGUNTA** o si algo bloquea de verdad.
- **Un commit por fase.**

## Cómo se ejecuta: 3 sesiones

| Sesión | Fases |
|---|---|
| 1 | 0 (reconocimiento), 1 (estado abierto/cerrado y datos), 2 (barra superior y búsqueda), 3 (categorías) |
| 2 | 4 (botones flotantes), 5 (pines), 6 (hoja «Cerca de ti») |
| 3 | 7 (tarjeta del negocio), 8 (menú del perfil), 9 (respaldo sin mapa) y verificación final |

Al empezar te diré qué sesión toca. Haz solo sus fases y cierra con su informe.

## Fase 0 — Reconocimiento (solo lectura)

Genera `RECONOCIMIENTO-HOME.md` en la raíz (sin incluirlo en commits) con rutas y líneas de:
1. Los componentes del home: barra superior, buscador, categorías, botones flotantes, hoja de recomendaciones, ventana del pin y menú del perfil.
2. **La frontera del mapa:** qué archivos y funciones son el mapa (no se tocan) y dónde exactamente se crean los pines y se mueve la cámara (lo único que se toca).
3. **Qué hace cada botón flotante actual:** actualizar, 3D, fuego, campana, luna, ubicación, zoom + y −.
4. De dónde salen las recomendaciones, cómo se ordenan, cómo se calcula la distancia y cuándo se refrescan.
5. Cómo se calcula hoy «Abierto/Cerrado» y si se comparte con la ficha del negocio (ojo: es sospechoso de los errores de hidratación de React #418; ver `prompt-diagnostico-admin.md`).
6. De dónde salen el tipo de negocio, el barrio y la dirección, y por qué aparece el «·» suelto.
7. Qué existe para el usuario: favoritos, tarjetas de cliente frecuente, pedidos del cliente, tema, ayuda; y cómo se obtienen los pendientes de cada panel.
8. Cómo se lanza la búsqueda con IA y cómo vuelven sus resultados al mapa y la lista.

Con eso, continúa sin esperar salvo bloqueo.

## Fase 1 — Estado abierto/cerrado y limpieza de datos

1. **Una sola utilidad compartida** (home, tarjeta del pin y ficha) que, a partir del horario del negocio, sus cierres especiales y su estado manual (cerrado temporalmente, etc.), devuelva:
   - `abierto` (sí/no), `cierraA` y `abreA`, con el **próximo día de apertura** si no abre hoy;
   - el texto: «Abierto · cierra a las 23:00», «Cerrado · abre hoy a las 8:00», «Cerrado · abre mañana a las 8:00», «Cerrado · abre el lunes a las 9:00», o «Cerrado temporalmente»;
   - siempre con la zona `America/Havana`, y renderizado sin provocar errores de hidratación (valor estable en servidor y actualización en cliente tras montar, sin cambiar la estructura del HTML).
   Pruebas con `npm test` de todos los casos, incluidos horarios que pasan de medianoche y días cerrados.
2. **Orden de «Cerca de ti»:** primero los abiertos, por distancia; después los cerrados, por lo que abre antes y luego por distancia. Si el orden se hace en el servidor, hazlo allí.
3. **Separadores:** el «·» solo se pinta entre dos valores que existen. Busca el mismo fallo en la ficha y en las tarjetas.
4. **Barrios y direcciones (solo al mostrar, y al guardar lo nuevo):** mayúsculas normalizadas en barrios («Santa Bárbara», «Los Murros de Altamira») respetando partículas («de», «la»); quitar un prefijo «Dirección» o «Dir.» al inicio. **No reescribas datos existentes en la base** sin preguntarme: genera un informe con los registros que cambiarían.
5. **Tipos de negocio mal asignados** (por ejemplo una pizzería marcada como «Cafetería»): no los cambies automáticamente. Genera una lista de sospechosos (nombre o productos que contradicen el tipo) para revisarla desde el panel de admin.

## Fase 2 — Barra superior y búsqueda

- Logo, **campo de búsqueda** con un texto corto que no se corte en un iPhone normal («Pregúntale a la IA…») y botón de buscar en verde (no gris), y el **avatar** sin flecha, con un punto si algún panel tiene pendientes.
- Al tocar el buscador: pantalla de búsqueda con el campo, «Buscar», y **ejemplos** que enseñan a hablarle a la IA («pizza a domicilio que acepte CUP», «dónde desayunar ahora», «tienda con productos de aseo», «barbería abierta hoy»). Usa la búsqueda con IA que ya existe, **sin cambiar su backend**.
- Con una búsqueda activa, la hoja muestra arriba «La IA buscó: «…»» con **Quitar**.

## Fase 3 — Categorías

- Mantén las categorías actuales sobre el mapa, con scroll horizontal sin barra.
- Añade el chip **«Populares»** con el icono de fuego (sustituye al botón flotante rojo): muestra lo que hoy muestra ese botón. Confírmalo en el reconocimiento; si el fuego hace otra cosa, dímelo antes de quitarlo.

## Fase 4 — Botones flotantes: de 8 a 3

Quedan a la derecha, en columna, ocultos mientras la tarjeta de un negocio está abierta:
1. **Notificaciones** (campana con punto si hay nuevas), con su panel actual.
2. **Centrar en mi ubicación**, con un icono de navegación (no el actual, que parece un sol).
3. **Opciones del mapa**, que abre una hoja con interruptores:
   - **Solo lo abierto** (mismo estado que el filtro «Abierto ahora» de la hoja);
   - **Mapa nocturno**: el mismo modo que hoy activa la luna, sin cambiar su implementación; si la luna en realidad cambia el tema de la app, ese interruptor va al menú del perfil y aquí no aparece;
   - **Vista 3D**: el mismo modo actual, con la nota «gasta más batería y datos».
- **Se quitan:** el botón de actualizar del mapa (la lista ya se actualiza; mantén el refresco automático y, si existe, el de arrastrar hacia abajo en la lista) y los botones de **zoom + y −** en pantallas táctiles (en escritorio con ratón pueden quedarse).
- Ningún botón flotante puede quedar debajo de la tarjeta ni de la hoja.

## Fase 5 — Pines

Sin tocar cómo el mapa dibuja ni agrupa los marcadores más allá de lo necesario:
- Los pines mantienen su icono de categoría.
- **Abiertos en verde, cerrados en gris**, con suficiente contraste sobre el mapa claro y el nocturno.
- **Seleccionado**: más grande, en el color oscuro de la app y por encima del resto.
- Los abiertos se apilan por encima de los cerrados.
- Al tocar un pin: se selecciona, se abre la tarjeta del negocio (Fase 7) y la cámara lo centra por encima de la tarjeta (con `padding`), sin cambiar el zoom bruscamente.
- **Al abrir el home**, la cámara encuadra la ubicación del usuario o la ciudad con los negocios cercanos visibles **por encima de la hoja** (no la zona rural). Si el usuario no da su ubicación, la ciudad que ya se use por defecto.
- Si hoy los pines llevan una pequeña insignia (el círculo con «+» o el rayo), averigua qué significa y dímelo; si no tiene un significado claro para el usuario, propón quitarla.

## Fase 6 — Hoja «Cerca de ti»

Sustituye a «Recomendaciones» (el nombre cambia porque hoy ordena por cercanía).
1. **Tres alturas** (mínima, media y casi completa), con la barrita para cambiar y un botón «Ver lista» / «Ver mapa». Reutiliza el componente de hoja actual si lo permite.
2. **Cabecera:** «Cerca de ti», el número de lugares y una línea de estado: «N abiertos ahora · primero lo abierto y más cercano», o «Todo cerrado a esta hora · ordenado por lo que abre antes». Se quita el botón de actualizar duplicado de la hoja.
3. **Filtros** de un toque, con scroll horizontal: Abierto ahora, A domicilio, Acepta CUP, Tiene planta, Con oferta. Solo los que se puedan calcular con datos reales.
4. **Se quita la tarjeta de texto de la IA** («Según tu ubicación…»). En su lugar, una línea con una **sugerencia de búsqueda** que lanza la búsqueda al tocarla.
5. **Todo cerrado:** aviso en ámbar «A esta hora no hay nada abierto cerca» con «Lo primero abre a las 8:00: [los dos primeros]» y el botón **«Ver quién lleva a domicilio»** (activa ese filtro).
6. **Tarjetas más compactas** (logo de 52 px):
   - nombre y corazón de favoritos (zona táctil de 44 px, guarda como hoy);
   - «Tipo · Barrio»;
   - estado y distancia («Cerrado · abre hoy a las 8:00 · 876 m»), en verde si está abierto;
   - hasta 2 chips con **por qué destaca**: «Oferta: [su texto real]», «Top del mes», «A domicilio», «Tiene planta»;
   - sin logo: iniciales sobre el color de marca o el icono de su categoría (lo que ya se use).
   Tocar la tarjeta selecciona el negocio en el mapa y abre su tarjeta (Fase 7).
7. **Sin resultados** con los filtros: «Nada cerca con estos filtros» y **Quitar filtros**.

## Fase 7 — Tarjeta del negocio (sustituye a la ventana flotante del pin)

- **Anclada abajo**, a todo el ancho y en lugar de la hoja (la hoja vuelve al cerrarla). Ya no flota en medio del mapa.
- Contenido:
  - **miniatura de la portada** (versión pequeña, con su espacio reservado para que no salte; sin portada, el logo o el color de marca);
  - nombre, **corazón** y **cerrar** (X de 44 px, siempre visible);
  - «Tipo · Barrio»;
  - **estado y distancia** («Cerrado · abre hoy a las 16:00 · 1,4 km»);
  - hasta 3 chips: oferta con su texto, top del mes, a domicilio, tiene planta, acepta CUP;
  - dos botones: **acción principal según el tipo** y **Ver ficha**.
- **Acción principal:**
  - negocio con pedidos o a domicilio → **Pedir** (abre su carta con el carrito, o WhatsApp si no tiene carrito);
  - servicios con citas (barbería, etc.) → **Pedir cita** (el flujo de reservas actual o WhatsApp);
  - resto → **Cómo llegar** (lo que hoy hace «Ruta»).
- **Ver ficha** (antes «Ver más») abre la ficha; tocar la tarjeta también.
- **Anterior / Siguiente** y **deslizar a los lados** para pasar al negocio siguiente de la lista actual (mismo orden y filtros), seleccionando su pin. El deslizamiento con eventos de puntero, sin dependencias; los botones siguen ahí para quien no deslice.
- Deslizar hacia arriba o tocar «Ver ficha» abre la ficha completa.

## Fase 8 — Menú del perfil

Mismo disparador (el avatar), reorganizado:
- Cabecera con nombre y correo (y la chapita de rol solo para administradores).
- **Lo mío:** Mis favoritos (con cuántos), Mis tarjetas de cliente frecuente, Mis pedidos. Cada uno solo si la función existe para el usuario.
- **Tus paneles** (solo los que tenga): Panel de negocio **con el nombre del negocio y lo que le espera** («PQTT? Pizzería · 2 pedidos»), Panel de afiliado, Panel de administración con sus pendientes. Los números salen de un endpoint ligero de contadores (si el rediseño del Business Panel o del admin ya creó uno, reutilízalo).
- **Tema** claro/oscuro y **Ayuda y soporte**.
- **Cerrar sesión** separado al final, en rojo, con confirmación.
- Para un usuario sin negocio ni otros roles, el menú solo muestra «Lo mío», tema, ayuda y cerrar sesión.

## Fase 9 — Respaldo cuando el mapa no puede cargar

Si ya se aplicó `prompt-diagnostico-admin.md` (alternativa sin WebGL), conéctala aquí. Si no: cuando el mapa no esté disponible (sin WebGL o error de carga), la hoja «Cerca de ti» se abre a pantalla completa como lista, con una línea que lo explique («Tu teléfono no puede mostrar el mapa; aquí tienes los negocios cercanos»), sin cambiar el mapa en sí.

## Verificación final (sesión 3)

1. **El mapa intacto:** `git diff` desde antes de la sesión 1 sobre los archivos del mapa muestra solo cambios en pines y cámara. Lístalos en el informe.
2. **Funciones:** todo lo que hacía el home sigue funcionando (búsqueda, categorías, notificaciones, ubicación, 3D, modo nocturno, favoritos, ruta, ficha, menú y paneles), aunque haya cambiado de sitio. Tabla «antes → ahora».
3. Sin elementos muertos, datos de ejemplo ni valores arbitrarios nuevos; toda clase de color nueva con su versión oscura.
4. `npm run typecheck` y `npm test` sin errores, con pruebas de: estado abierto/cerrado y próxima apertura, orden de la lista, filtros, separadores, normalización de barrios y direcciones, acción principal por tipo.
5. **Lista de prueba manual para mí**, en iPhone y Android, en claro y oscuro:
   - abrir de noche: aviso de todo cerrado, «abre a las…», orden por lo que abre antes, «Ver quién lleva a domicilio»;
   - abrir de día: abiertos primero en verde, pines verdes y grises;
   - al abrir, el mapa muestra la ciudad con pines por encima de la hoja;
   - tocar un pin: tarjeta abajo, X visible, acción correcta (Pedir en Yoyi Sabor, Pedir cita en una barbería, Cómo llegar en una cafetería), anterior/siguiente y deslizar;
   - filtros y «Populares»; búsqueda con un ejemplo y «Quitar»;
   - opciones del mapa: solo abierto, nocturno y 3D funcionan como antes;
   - menú del perfil con el nombre del negocio y sus pendientes;
   - atrás de Android cierra la tarjeta, la búsqueda y el menú sin salir de la app;
   - el mapa se ve, se mueve y funciona sin conexión exactamente como antes.

## Informe de cada sesión

- Qué cambiaste y dónde (rutas).
- Diff de los archivos del mapa (solo pines y cámara).
- Datos que no existían y qué hiciste con ellos.
- Informes de barrios, direcciones y tipos sospechosos.
- Respuestas pendientes a las **PREGUNTAS**.
