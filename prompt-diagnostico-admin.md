# Tarea: arreglar los problemas que muestra Diagnóstico y rediseñar la sección

## Contexto

La sección **Diagnóstico** del panel de admin muestra la telemetría de los últimos 7 días (sin datos personales). Con 322 sesiones, los datos actuales revelan problemas reales:

| Dato actual | Qué significa |
|---|---|
| Mapa: **0 cargas**, todo a 0 y tiempo medio «—» | Imposible con 322 sesiones: la telemetría del mapa no llega. |
| WebGL: **13 Android sin WebGL real** (de 95), 0 por software | A ~14 % de los Android probablemente no les carga el mapa. |
| Plataformas: Android 95 + iOS 182 + Escritorio 26 = **303 de 322** | 19 sesiones no se clasifican y no se muestran. |
| Errores: React **#418** (7 + 1) y «**Hydration failed**» (1) | El mismo problema (hidratación) contado en 3 filas: 9 casos. |
| Errores: **UnhandledRejection: Failed to execute 'transaction' on 'ID…'** (7) | Fallos de IndexedDB que nadie captura (guardado offline). |
| Errores: **«Script error.»** (2) | Error de un script de otro dominio sin `crossorigin`: sin detalle. |
| Versiones del SW: **«Sin datos aún»** | No se registra qué versión del service worker tiene cada usuario. |

Quiero que arregles la causa de cada problema y después rediseñes la sección para que estos fallos se vean y se entiendan de un vistazo.

## Reglas de trabajo

- Código y UI en español. Cambios mínimos y localizados. Reutiliza lo que existe. **No añadas dependencias** sin preguntarme (ni de producción ni de desarrollo).
- **Privacidad:** la telemetría sigue sin datos personales. Nada de nombres, correos, teléfonos, IP completas ni identificadores de usuario. Limpia de las URLs los parámetros de consulta y cualquier cosa que parezca un correo o un teléfono antes de guardar un mensaje de error.
- **No conduzcas el navegador** (las reglas del proyecto lo prohíben). La verificación es con `npm run typecheck`, `npm test` y la lista de prueba manual del final. `lint` y `build` no sirven como criterio (ver `CLAUDE.md`).
- **Diagnostica antes de arreglar:** en cada parte, primero localiza la causa con evidencia del código (archivo y línea) y explícala; después corrige. Si no puedes confirmar una causa, dilo y propón cómo comprobarla en producción, en vez de cambiar cosas a ciegas.
- **Preguntas:** trabaja de corrido. Solo te detienes en lo marcado **PREGUNTA** o si algo bloquea de verdad.
- **Un commit por parte**, con mensaje claro.
- **Dos sesiones:** sesión 1 = partes 0 a 5 (arreglos); sesión 2 = partes 6 a 9 (registro de datos y rediseño). Te diré cuál toca.

## Parte 0 — Reconocimiento (sin preguntarme salvo bloqueo)

Localiza y anota, con rutas:
1. **La tubería de telemetría completa:** dónde se generan los eventos en el cliente, cómo se envían (fetch, `sendBeacon`, cola offline), el endpoint que los recibe, la tabla donde se guardan, y las consultas que alimentan cada tarjeta de Diagnóstico.
2. **El componente del mapa** y su librería (MapLibre, Leaflet u otra), dónde se crea, qué eventos emite y dónde se mide WebGL.
3. **El service worker** (`public/sw.js`), su constante de versión o nombre de caché, y dónde se registra en el cliente.
4. **Todo el código que usa IndexedDB** (por ejemplo el guardado de snapshots offline) y cómo se abre la base.
5. **La captura de errores en cliente:** `window.onerror`, `unhandledrejection`, error boundaries de React, `global-error.tsx` / `error.tsx`, y cómo se agrupan los mensajes.
6. **El detector de plataforma** (user agent o client hints).
7. Componentes con riesgo de hidratación (Parte 3).

## Parte 1 — La telemetría del mapa no llega

1. Sigue el evento de carga del mapa desde el componente hasta la consulta de Diagnóstico y encuentra dónde se pierde. Causas típicas a revisar: el evento nunca se dispara (escucha `load` después de que ya ocurrió, o el mapa usa otra señal como `idle`), se envía con un nombre distinto al que consulta el admin, se envía antes de que la telemetría esté inicializada, el endpoint lo rechaza por validación, se descarta por muestreo, o la consulta filtra por un campo que no se rellena.
2. Corrige la causa y deja estos eventos bien definidos, con un solo nombre en cliente y en consulta (constantes compartidas):
   - `mapa_inicio` (se empezó a cargar),
   - `mapa_cargado` con `ms` (tiempo hasta el primer render útil),
   - `mapa_lento` si supera 8 s,
   - `mapa_error` con un `motivo` corto y sin datos personales (`sin_webgl`, `teselas`, `estilo`, `red`, `desconocido`),
   - `mapa_abandonado` si la página se oculta o se cierra (`pagehide` / `visibilitychange`) antes de `mapa_cargado`.
   Un solo evento de cada tipo por carga de mapa.
3. Los eventos tienen que sobrevivir a la mala conexión: si ya hay cola offline, úsala; si no, usa `navigator.sendBeacon` al ocultarse la página y reintenta lo pendiente al volver la conexión. Sin dependencias nuevas.
4. Pruebas con `npm test` de: el orden de eventos de una carga correcta, una lenta, un error y un abandono, y de que la consulta del admin cuenta exactamente esos eventos.

## Parte 2 — Mapa para dispositivos sin WebGL

1. Comprueba si WebGL está disponible **antes** de crear el mapa (la función de soporte de la librería, o crear un contexto de prueba), y regístralo como hoy.
2. Si no hay WebGL, no intentes crear el mapa: muestra una **alternativa útil** y registra `mapa_error` con `motivo: sin_webgl`.
3. **PREGUNTA:** ¿qué alternativa prefieres? Propón dos opciones según lo que ya tenga el proyecto, por ejemplo:
   - a) una **lista de negocios cercanos** ordenada por distancia, con filtros y el mismo acceso a la ficha (sin dependencias nuevas);
   - b) un **mapa de teselas raster** (si la librería actual tiene un modo sin WebGL o ya existe otra instalada).
   Hasta que responda, implementa la opción a), que no necesita nada nuevo.
4. La alternativa debe funcionar también **sin conexión** si el mapa ya funciona offline, y explicar en una línea por qué se ve así («Tu teléfono no puede mostrar el mapa; aquí tienes los negocios cercanos»).

## Parte 3 — Errores de hidratación (React #418)

1. **Encuentra los componentes que pintan distinto en servidor y en cliente.** Revisa en especial, en las rutas públicas y en las fichas de negocio:
   - estado «Abierto / Cerrado» calculado con la hora,
   - tiempos relativos («hace 5 min», «Actualizado hace 5 h»),
   - fechas y números con `toLocaleString`, `toLocaleDateString` o `Intl` sin `locale` y `timeZone` fijos,
   - `Date.now()`, `new Date()` o `Math.random()` durante el render,
   - lecturas de `window`, `localStorage`, `navigator` o del tema dentro del render,
   - HTML inválido anidado (por ejemplo `<div>` dentro de `<p>`, o `<a>` dentro de `<a>`).
2. **Corrige con un patrón consistente**, en una utilidad compartida:
   - formatear siempre con locale y `timeZone: 'America/Havana'` explícitos;
   - para lo que depende del momento exacto (abierto ahora, tiempo relativo), renderizar en servidor un valor estable y actualizarlo en cliente después de montar (`useEffect`), sin cambiar la estructura del HTML;
   - `suppressHydrationWarning` solo en el elemento de texto de una hora o fecha, nunca en contenedores.
3. **Mejora el reporte:** que los errores de hidratación guarden también la ruta (sin parámetros) y, si está disponible, el componente o el texto que difiere, para poder confirmar en producción que desaparecen.
4. Pruebas con `npm test`: renderiza en servidor y compara con el render inicial de cliente los componentes corregidos, con la zona horaria del proceso distinta a `America/Havana` (por ejemplo `TZ=UTC`), y comprueba que el HTML coincide.

## Parte 4 — Fallos de IndexedDB sin capturar

1. Centraliza el acceso a IndexedDB en un módulo (si no lo está) y que **ninguna operación** pueda terminar en `unhandledrejection`.
2. Maneja estos casos:
   - `InvalidStateError` / base cerrada: cerrar, reabrir una vez y reintentar la operación;
   - `onversionchange`: cerrar la conexión para no bloquear la actualización;
   - `onblocked` al abrir: reintentar más tarde sin bloquear la UI;
   - `QuotaExceededError`: borrar los snapshots más antiguos y reintentar una vez;
   - IndexedDB no disponible (modo privado de iPhone, navegadores viejos): seguir funcionando sin guardado offline, en memoria, sin errores.
3. Registra un evento de telemetría con el **nombre del error** (`InvalidStateError`, `QuotaExceededError`…) y la operación (`guardar_snapshot`, `leer_snapshot`…), no el mensaje completo.
4. Pruebas con `npm test` simulando cada caso (con mocks propios; **PREGUNTA** si necesitas `fake-indexeddb` como dependencia de desarrollo).

## Parte 5 — «Script error.»

1. Identifica los scripts de otros dominios que carga la app (analítica, mapas, fuentes, etc.).
2. Añade `crossorigin="anonymous"` donde el servidor de origen permita CORS, para que los errores lleguen con detalle.
3. En la telemetría, agrupa «Script error.» en su propio grupo «Script externo sin detalle», con severidad baja, para que no se mezcle con errores propios.

## Parte 6 — Registrar la versión del service worker y la plataforma

1. **Versión del SW:** expón la versión que ya existe en `sw.js` (constante o nombre de caché) y envíala con la telemetría de cada sesión (por ejemplo preguntándole al SW activo con `postMessage` o leyendo una constante compartida en el build). Guarda también la versión publicada actual para comparar.
2. **Plataformas sin clasificar:** averigua qué son las 19 sesiones (sin guardar el user agent completo: solo su familia) y clasifícalas. Revisa iPadOS que se identifica como Mac, tablets Android, HarmonyOS, KaiOS y bots. Lo que no se pueda clasificar va a «Otros», y **las plataformas siempre suman el total de sesiones**.
3. Filtra los bots de la telemetría (no deben contar como sesiones).

## Parte 7 — Errores agrupados y con contexto

1. **Normaliza el mensaje** para agruparlo: quita prefijos como `Uncaught `, `Error: `, `UnhandledRejection: `; convierte los errores minificados de React en una clave (`react-418`); une «Hydration failed…» con `react-418` en el grupo «Hidratación».
2. Por cada grupo guarda: clave, título legible, número de casos, sesiones afectadas, plataformas, navegador, ruta (sin parámetros), versión de la app y del SW, primera y última vez, y hasta 3 mensajes completos de ejemplo (limpios de datos personales, máximo 500 caracteres).
3. Severidad: alta para hidratación, IndexedDB y errores del mapa; baja para «Script error.» y extensiones del navegador.

## Parte 8 — Comprobación de servicios

Si ya existe algo que compruebe el estado de los servicios, reutilízalo. Si no, crea una comprobación **en el servidor**, con tiempo límite por servicio y resultado cacheado 5 minutos, para: base de datos (Neon), autenticación, subida de archivos, correo, webhook de Telegram (pendientes y último error), QvaPay, proveedores de IA y PostHog si se usa. Solo se puede consultar con rol de administrador. Sin secretos en la respuesta.

## Parte 9 — Rediseño de la sección Diagnóstico

Sigue el mockup aprobado (te pasaré capturas): **dos pestañas**, «Dispositivos y errores» (por defecto) y «Servicios», y el botón Actualizar.

### Pestaña «Dispositivos y errores»
1. **Resumen arriba**, calculado en el servidor con reglas explícitas en un solo archivo de configuración:
   - grave: el mapa no reporta cargas con más de 50 sesiones; más de un 5 % de Android sin WebGL; errores de severidad alta en los últimos 7 días; más de un 10 % de cargas de mapa lentas o con error;
   - aviso: no se registra la versión del SW; más de un 20 % de sesiones con un SW anterior al publicado; sesiones sin clasificar.
   Cada línea dice el problema en lenguaje claro. Sin problemas: «Todo correcto esta semana».
2. **Tarjetas** de Mapa, WebGL y Service worker, con el dato principal, una explicación de una línea y una chapita de estado. Cuando no hay datos, la tarjeta explica por qué («No llegan datos del mapa: revisa la telemetría»), nunca un «—» suelto.
3. **Plataformas** con número, porcentaje y barra, sumando el total (incluida «Otros»). **Versiones de Chrome** con barras.
4. **Porcentajes y comparación** con los 7 días anteriores en cada cifra importante («13 de 95 Android · 13,7 % · +4»).
5. **Errores agrupados** (Parte 7): severidad, título, casos, causa probable en una línea, plataformas, última vez y un botón para ver los mensajes completos con «Copiar» (para pegarlos en Claude Code).
6. **Versiones del SW**: reparto por versión y % de sesiones en la versión publicada.
7. Quita los iconos decorativos que no significan nada (el wifi en WebGL, el reloj en versiones de Chrome).

### Pestaña «Servicios»
Lista de la Parte 8 con nombre, detalle (latencia, último evento) y chapita OK / Revisar / Caído.

### Integración
Si el panel de admin ya tiene una bandeja de pendientes o un resumen en el inicio, los problemas graves y avisos de Diagnóstico aparecen allí con enlace a esta sección. Si no existe, deja expuesta la función que los calcula para conectarla más adelante.

### Estilo
- Mantén el sistema de diseño del panel de admin, en **modo claro y oscuro** (las capturas actuales son en oscuro). Reutiliza sus tarjetas, chapitas, botones y pestañas; sin colores ni tamaños inventados ni valores arbitrarios nuevos.
- Funciona a 360 px de ancho: en móvil las tarjetas se apilan, las pestañas ocupan el ancho y los mensajes de error se ajustan sin desbordar.
- Objetivos táctiles de al menos 44 px y contraste mínimo 4.5:1.

## Verificación

1. `npm run typecheck` y `npm test` sin errores, con las pruebas nuevas de las partes 1, 3 y 4.
2. Búsqueda en lo tocado de `href="#"`, handlers vacíos, `TODO`, datos de ejemplo y valores arbitrarios nuevos: ninguno.
3. Revisa que ningún evento ni mensaje guardado contiene datos personales.
4. **Lista de prueba manual para mí, en producción, tras desplegar:**
   - abrir el mapa en un iPhone y un Android y ver en Diagnóstico, tras Actualizar, las cargas, el tiempo medio y la versión del SW;
   - abrir la app en un Android sin WebGL (o forzarlo desactivando la aceleración por hardware en Chrome de escritorio) y ver la alternativa y el `mapa_error: sin_webgl`;
   - navegar por fichas y comprobar al cabo de unos días que los errores de hidratación bajan a 0;
   - abrir la app en modo privado de Safari y comprobar que no aparecen nuevos errores de IndexedDB;
   - ver que las plataformas suman el total de sesiones;
   - revisar ambas pestañas en claro, oscuro, móvil y escritorio.

## Informe final de cada sesión

- Causa de cada problema con archivo y línea, y qué cambiaste.
- Lo que no se pudo confirmar sin datos de producción y cómo comprobarlo.
- Respuestas pendientes a las **PREGUNTAS** (alternativa al mapa sin WebGL; `fake-indexeddb`).
- Reglas del resumen y umbrales usados.
