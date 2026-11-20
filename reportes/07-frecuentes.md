---
target: flujo de clientes frecuentes del panel de negocio y tarjeta pública
total_score: 13
p0_count: 0
p1_count: 5
date: 2026-11-20
slug: business-frecuentes
---

# Auditoría técnica: flujo de clientes frecuentes

**Objetivo.** El camino completo de «Frecuentes»: la vista
`clientes-frecuentes-view.tsx` (lista, filtros, detalle, ajustes de tarjeta,
sellos, canjes, candados), las cinco rutas de
`/api/places/[id]/clientes-frecuentes/**`, la configuración en
`/api/places/[id]/fidelidad`, la lógica de `fidelidad-server.ts`, la tarjeta
pública en `/m/[slug]/tarjeta/[token]` con `tarjeta-cliente.tsx` y el paso de
pedidos que da sello en `pedidos-view.tsx`.

**Registro:** `product`. **Referencias:** `PRODUCT.md`, `DESIGN.md`,
`reference/product.md`.

**Método.** Lectura del código, contraste calculado con los valores reales de
`tailwind.config.ts` (hex de `ink-soft` y `verde`, composición alfa sobre el
fondo correspondiente) y detector determinista:
`detect.mjs --json` sobre la vista, la tarjeta y la página, `[]`, exit 0. Sin
navegador: la identidad de desarrollo no tiene negocio y `/business` rebota al
alta, así que no hay evidencia visual ni E2E. Todo lo de abajo se apoya en el
código.

## 1. Puntuación

| # | Dimensión | Nota | Hallazgo clave |
|---|-----------|------|----------------|
| 1 | Accesibilidad | 2 | El interruptor de la tarjeta no se puede usar con teclado, los campos de ajuste no tienen nombre y el contraste falla en ambos lados del flujo |
| 2 | Rendimiento | 3 | Búsqueda con respuestas sin cancelar y estadísticas recalculadas en cada tecla |
| 3 | Diseño adaptable | 2 | Objetivos de 32 a 36 px en todo el panel y diálogos sin altura máxima |
| 4 | Theming | 3 | Tokens y modo oscuro cubiertos, con dos banners en ámbar ya remapeados por `globals.css` |
| 5 | Anti-patrones | 3 | Sin slop de fondo; micro-etiquetas de 10 a 11 px en mayúsculas en cada sección y dos círculos decorativos |
| **Total** | | **13/20** | **Aceptable: las dimensiones débiles son accesibilidad y móvil** |

## 2. Veredicto de anti-patrones

**Pasa, con un tic repetido.** La tarjeta verde no es un degradado decorativo
gratuito: representa el objeto físico que el cliente guarda, y por eso se
repite en el panel, el detalle y la tarjeta pública. El flujo usa los tokens
`verde`, `sand` y `ink`, las curvas `ease-outquint`, el `Dialog` de Radix con
título y descripción, y no inventa métricas.

Lo que sí es tic de plantilla es la etiqueta de sección: `text-[10px]` o
`text-[11px]` en mayúsculas con `tracking-[0.14em]` a `[0.18em]` encima de casi
todo («Tarjeta de sellos», «Así la ve tu cliente», «Los premios», «Últimos
movimientos», «Ciclo»). En la tarjeta pública se convierte además en los dos
`<h2>`, así que la única jerarquía visible son dos rótulos de 11 px. Es la
versión de producto del kicker que la skill pide no repetir en cada sección.

Los dos círculos `bg-white/[0.04]` de la vista cerrada del editor
(`clientes-frecuentes-view.tsx:308-309`) son decoración pura: no comunican
estado ni profundidad y desaparecen si se quitan.

## 3. Resumen

0 P0, 5 P1, 9 P2 y 5 P3. El flujo funciona y el servidor está bien defendido:
los permisos se comprueban en cada ruta, el sello del pedido es atómico con un
índice único parcial, el canje no puede duplicarse por ciclo, el teléfono
público va enmascarado y el token se valida antes de tocar la base. Nada de eso
necesita cambios.

Lo que falla es el borde de accesibilidad y de móvil:

1. El interruptor «Tarjeta activa» es un `<span role="switch">` sin `tabIndex`
   ni teclado, y la etiqueta que lo envuelve no lo activa al pulsar el texto.
2. Las acciones principales miden 36 px y los filtros 32 px, en una app que
   exige 44.
3. El contraste baja de 4.5:1 en placeholders, fechas y textos de 10 a 12 px,
   tanto en el panel como en la tarjeta del cliente.
4. Cambiar de pestaña en «Ajustes» descarta el borrador sin avisar.
5. La búsqueda, la cantidad del ajuste y el motivo no tienen etiqueta
   accesible: solo placeholder.

## 4. Hallazgos

### [P1] El interruptor de la tarjeta no existe para el teclado

- **Dónde:** `src/components/business/clientes-frecuentes-view.tsx:405-424`.
- **Categoría:** Accesibilidad.
- **Qué pasa:** el control es un `<span role="switch" aria-checked>` con
  `onClick`. No tiene `tabIndex`, no responde a `Enter` ni a `Espacio`, y no
  tiene `aria-labelledby` ni `aria-describedby`. El `<label>` que lo envuelve
  tampoco lo activa al pulsar «Tarjeta activa» o su descripción, porque un
  `label` solo asocia controles de formulario y este es un `span`.
- **Impacto:** con teclado o lector de pantalla la tarjeta no se puede activar
  ni desactivar. Con ratón, la fila entera parece clicable (tiene
  `cursor-pointer`) pero solo responde el rectángulo de 44×24 del interruptor.
- **Estándar:** WCAG 2.1.1 (teclado), 4.1.2 (nombre, rol, valor), 1.3.1.
- **Arreglo:** usar un `<button type="button" role="switch">` real con
  `aria-checked`, `aria-labelledby` apuntando al título y al texto de apoyo, o
  el `Switch` de Radix que ya está en el proyecto. Si se mantiene la fila
  clicable, mover el `onClick` al `label` no basta: el control debe ser
  enfocable.
- **Comando:** `$impeccable harden`

### [P1] Objetivos táctiles de 32 y 36 px en todo el flujo

- **Dónde:** `clientes-frecuentes-view.tsx:108-112` (`BTN_GHOST` y `BTN_VERDE`
  en `h-9`), `:1189` (filtros en `h-8`), `:465` y `:477` (stepper `h-9 w-8`),
  `:1272` («+Sello» de la fila en `h-9 w-9`), `:1340` (selector teléfono o
  código en `h-9`), `:364` (editar tarjeta en `h-9`) y el aspa del diálogo en
  `src/components/ui/dialog.tsx:53` (`size-9`).
- **Categoría:** Diseño adaptable.
- **Qué pasa:** la acción más frecuente del mostrador («+Sello»), la principal
  del detalle («Canjear», «Enviar tarjeta»), los filtros y el stepper de premios
  están entre 32 y 36 px. El proyecto exige 44×44 con separación.
- **Impacto:** en un móvil, que es el caso normal según `PRODUCT.md`, se falla
  el objetivo y se da sello al cliente equivocado o se cambia el filtro sin
  querer. El botón de 32 px del stepper es el más ajustado: dos flechas
  contiguas de 32×36 para subir y bajar sellos.
- **Estándar:** WCAG 2.5.8 (mínimo AA de 24 px; el sistema pide 44).
- **Arreglo:** subir `BTN_*` a `h-11`, filtros a `h-11`, stepper a `size-11`
  por flecha, «+Sello» a `size-11` y el aspa del diálogo a `size-11`. Mantener
  el tamaño visual con un `::before` extendido solo si el diseño se rompe.
- **Comando:** `$impeccable adapt`

### [P1] Contraste por debajo de AA en textos pequeños de las dos superficies

- **Dónde:** `clientes-frecuentes-view.tsx:114-115` (placeholder
  `text-ink-soft/40`), `:1253` (fecha o «Nuevo» en `/45`), `:514` y `:392`
  (`/50`), `:1050` y `:404` (`/55`), `:1189` y `:1258` (`/65`);
  `tarjeta-cliente.tsx:293`, `:373`, `:382`, `:414`, `:430`, `:439` y `:471`.
- **Categoría:** Accesibilidad.
- **Qué pasa:** medido con `ink-soft` (#1B2A21) compuesto sobre blanco:

  | Clase | Contraste | AA 12 px |
  |---|---|---|
  | `ink-soft/40` | 2.37:1 | no |
  | `ink-soft/45` | 2.70:1 | no |
  | `ink-soft/50` | 3.07:1 | no |
  | `ink-soft/55` | 3.55:1 | no |
  | `ink-soft/60` | 4.13:1 | no |
  | `ink-soft/65` | 4.77:1 | sí, al límite |
  | `ink-soft/75` | 6.65:1 | sí |

  Dentro de la tarjeta verde, `verde-100/60` sobre `verde-600` da 2.57:1 y
  `verde-100/65` da 2.74:1, con texto de 10 y 11 px. El pie de la tarjeta
  pública (`text-[11px] text-ink-soft/45`) queda en 2.70:1. El botón de borrar
  usa `bg-destructive` con `text-white` (4.32:1) y el enlace de borrar
  `text-destructive` sobre blanco (4.38:1); el token `destructive-ink` existe
  justamente para esto y no se usa.
- **Impacto:** el dato que el cliente mira de pie en el mostrador («te faltan
  3», la fecha del último sello) es el que menos se lee. El placeholder del
  teléfono y del motivo desaparece con luz de día.
- **Estándar:** WCAG 1.4.3 (4.5:1 en texto normal).
- **Arreglo:** subir todo texto informativo a `/70` o `/75`; placeholders a
  `/70`; en la tarjeta verde usar `verde-50` o `white/85` para los rótulos y
  `verde-100/90` para el pie; cambiar los botones destructivos a
  `text-destructive-ink` sobre `bg-destructive/10` y borde
  `destructive/30`.
- **Comando:** `$impeccable harden`

### [P1] Cambiar de pestaña descarta el borrador de la tarjeta

- **Dónde:** `clientes-frecuentes-view.tsx:1097-1112` (pestañas) y
  `:1117-1130` (el editor solo se monta con `tab === "ajustes"`).
- **Categoría:** Consistencia y prevención de errores.
- **Qué pasa:** `EditorTarjeta` guarda el borrador en su propio `useState`. Al
  pulsar «Clientes», el componente se desmonta y el borrador se pierde. No hay
  aviso, ni `beforeunload`, ni un estado de cambios sin guardar fuera del
  editor. `isDirty` existe, pero solo controla el botón «Guardar tarjeta».
- **Impacto:** quien ajusta cuatro premios, se distrae con un cliente y vuelve a
  «Ajustes» encuentra la tarjeta anterior. Es la misma clase de pérdida que ya
  se corrigió en el editor de ficha, aquí sin red de seguridad.
- **Estándar:** WCAG 3.3.4 (prevención de errores) y la convención del panel de
  ficha («Cambios sin guardar»).
- **Arreglo:** subir el borrador y `isDirty` a `ClientesFrecuentesView`, o
  mantener el editor montado y oculto con `hidden`; al intentar cambiar de
  pestaña con cambios, pedir confirmación o conservarlos. Reutilizar el patrón
  de la barra de guardado de `business-panel.tsx`.
- **Comando:** `$impeccable harden`

### [P1] Campos sin etiqueta accesible

- **Dónde:** `clientes-frecuentes-view.tsx:1155` (búsqueda), `:1009-1019`
  (cantidad y motivo del ajuste), `:483-490` (premio) y `:1300-1330` (teléfono
  y nombre del alta).
- **Categoría:** Accesibilidad.
- **Qué pasa:** la búsqueda y los campos de ajuste solo tienen `placeholder`.
  La cantidad del ajuste no tiene ni eso: es un `input type="number"` sin
  nombre. El premio tiene placeholder «Un refresco gratis», que no describe el
  campo. Los del alta están envueltos en `<label>` con texto visible, así que
  esos sí están bien.
- **Impacto:** con lector de pantalla, el campo de cantidad se anuncia como
  «cuadro de edición, 1» y el de motivo como «Motivo (obligatorio)» solo
  mientras está vacío. Al escribir, el nombre desaparece. En el ajuste, que es
  una operación con nota obligatoria, no se sabe qué se está corrigiendo.
- **Estándar:** WCAG 1.3.1, 3.3.2 (etiquetas o instrucciones), 4.1.2.
- **Arreglo:** `<label className="sr-only">` o visible para búsqueda y
  cantidad; `aria-describedby` para el motivo con el texto de la sección;
  `aria-label` en el premio de cada meta, incluyendo el número de sellos.
- **Comando:** `$impeccable harden`

### [P2] Las pestañas no están conectadas con su panel

- **Dónde:** `clientes-frecuentes-view.tsx:1097-1112`.
- **Categoría:** Accesibilidad.
- **Qué pasa:** hay `role="tablist"` y `role="tab"` con `aria-selected`, pero
  ningún botón tiene `aria-controls`, ningún panel tiene `role="tabpanel"` ni
  `aria-labelledby`, y las flechas del teclado no cambian de pestaña. El foco
  se queda en el botón y el contenido cambia debajo sin anunciarse.
- **Impacto:** un lector de pantalla anuncia «pestaña, seleccionada» y después
  no encuentra el panel asociado; el patrón de teclado esperado (flechas,
  Inicio, Fin) no funciona.
- **Estándar:** WAI-ARIA Authoring Practices, patrón Tabs; WCAG 4.1.2.
- **Arreglo:** `id` en cada panel, `aria-controls` en cada pestaña,
  `role="tabpanel"` + `aria-labelledby` + `tabIndex={0}` en el panel, y
  navegación con flechas. O usar el `Tabs` de Radix si ya está instalado.
- **Comando:** `$impeccable harden`

### [P2] Un fallo de carga se pinta como «todavía no hay tarjetas»

- **Dónde:** `clientes-frecuentes-view.tsx:641-675` (`cargar`) y `:1205-1220`
  (vacío), `:677-700` (`abrirDetalle`).
- **Categoría:** Estados y errores.
- **Qué pasa:** si el `fetch` falla, `cargar` muestra un toast y deja
  `clientes` como estaba; en el primer render eso es `[]`, así que al cerrar el
  toast queda el estado vacío con «Todavía no hay tarjetas» y la invitación a
  crear una. `abrirDetalle` no tiene `catch`: en un fallo de red se produce un
  rechazo sin manejar y el usuario solo ve que el spinner desaparece.
- **Impacto:** un problema de conexión se confunde con un negocio sin clientes,
  que es exactamente lo que este módulo intenta demostrar que no pasa. En el
  detalle, el botón parece no hacer nada.
- **Estándar:** WCAG 3.3.1 (identificación de errores) y la convención de
  `Result` del proyecto.
- **Arreglo:** guardar `errorCarga` y pintar un estado con «Reintentar»;
  distinguirlo de `clientes.length === 0`. En `abrirDetalle`, `catch` con toast
  y mantener el detalle anterior o volver a la lista.
- **Comando:** `$impeccable harden`

### [P2] La búsqueda no cancela respuestas y recalcula estadísticas por tecla

- **Dónde:** `clientes-frecuentes-view.tsx:641-675` y
  `src/app/api/places/[id]/clientes-frecuentes/route.ts:36-50`.
- **Categoría:** Rendimiento y consistencia.
- **Qué pasa:** cada cambio de `busqueda` lanza un `fetch` con `setTimeout` de
  300 ms, pero no hay `AbortController` ni comparación con la última consulta.
  Si la respuesta de «5» llega después de la de «53», la lista muestra los
  resultados viejos. Además, cada una de esas peticiones ejecuta
  `estadisticasFidelidad`, que cuenta toda la tabla de movimientos del negocio,
  y vuelve a leer configuración y negocio.
- **Impacto:** en una conexión lenta, la lista y el texto del buscador se
  desincronizan justo cuando la dependienta está buscando un teléfono delante
  del cliente. El coste crece con el historial del negocio.
- **Arreglo:** `AbortController` en el efecto y descartar respuestas que no
  correspondan a la consulta actual; separar las estadísticas de la búsqueda
  (pedirlas al montar y tras un sello o canje) o cachearlas unos segundos en el
  servidor.
- **Comando:** `$impeccable optimize`

### [P2] Los diálogos no caben con el teclado abierto

- **Dónde:** `src/components/ui/dialog.tsx:44` y los dos diálogos de
  `clientes-frecuentes-view.tsx:1290-1386`.
- **Categoría:** Diseño adaptable.
- **Qué pasa:** `DialogContent` está centrado con `top-1/2` y no tiene
  `max-height` ni `overflow-y-auto`. El alta tiene descripción, teléfono,
  nombre, sellos, nota y pie; en un móvil de 568 px de alto, con el teclado
  abierto, el botón «Crear tarjeta» queda fuera de la ventana y no hay scroll.
- **Impacto:** no se puede terminar el alta ni el sello a mano sin cerrar el
  teclado, y el pie queda tapado. Afecta a cualquier diálogo alto del panel.
- **Estándar:** WCAG 1.4.10 (reflujo) y 2.1.1.
- **Arreglo:** `max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain`
  y alinear arriba en móvil (`top-4 translate-y-0`); en los diálogos de esta
  vista, mover los botones dentro del área con scroll.
- **Comando:** `$impeccable adapt`

### [P2] La validación de la tarjeta solo existe como toast

- **Dónde:** `clientes-frecuentes-view.tsx:270-295` (`guardar`) y
  `src/lib/fidelidad.ts:85-117` (`esFidelidadConfig`).
- **Categoría:** Formularios.
- **Qué pasa:** el editor no valida antes de enviar. Un premio vacío, un nombre
  vacío o dos metas con los mismos sellos llegan al PATCH; el servidor devuelve
  «La tarjeta tiene datos inválidos» y el usuario recibe un toast genérico. El
  campo culpable no se marca, no se enfoca y el botón no indica por qué falló.
- **Impacto:** con cuatro premios, encontrar cuál está vacío es a ciegas. El
  servidor rechaza correctamente, pero la interfaz no ayuda a corregir.
- **Estándar:** WCAG 3.3.1 y 3.3.3 (sugerencia de corrección).
- **Arreglo:** validar en `guardar` con las mismas reglas de
  `esFidelidadConfig`, marcar `aria-invalid` y borde en el premio o el nombre
  afectado, enfocar el primero y escribir el motivo debajo. Reutilizar el
  patrón de validación del editor de ficha.
- **Comando:** `$impeccable harden`

### [P2] «+Sello» no reconcilia el estado ni comprueba que la tarjeta esté activa

- **Dónde:** `clientes-frecuentes-view.tsx:821-880` y
  `src/lib/fidelidad-server.ts:865-899`.
- **Categoría:** Consistencia.
- **Qué pasa:** el botón actualiza la fila de forma optimista y, si la
  petición sale bien, no vuelve a leer nada. `premioListo`, `proximoFaltan` y
  `sellosTotales` se quedan con los valores anteriores, así que el badge
  «Premio listo» no aparece hasta recargar o buscar de nuevo. Si la tarjeta
  está inactiva, el servidor responde 409 «La tarjeta no está activa»; el botón
  se sigue mostrando porque solo depende de `puedePedidos`, y el resultado es
  un toast de error tras un parpadeo del contador.
- **Impacto:** el mostrador da un sello, el cliente ya tiene premio y la lista
  no lo enseña. Al revés, en una tarjeta desactivada el botón invita a una
  acción que siempre falla.
- **Arreglo:** tras el éxito, `void cargar(busqueda)` o parchear también
  `premioListo` y `proximoFaltan` con la tarjeta que devuelve el servidor
  (hoy la respuesta solo trae `movimientoId`); ocultar o deshabilitar «+Sello»
  cuando `config?.activo` sea falso.
- **Comando:** `$impeccable harden`

### [P2] La tarjeta pública no tiene encabezado de nivel 1

- **Dónde:** `src/components/menu/tarjeta-cliente.tsx:270-295` y
  `:354` / `:414`.
- **Categoría:** Accesibilidad y jerarquía.
- **Qué pasa:** el nombre del negocio es un `<p>`, y las dos secciones son
  `<h2>` de 11 px. No hay `<h1>` ni un título que resuma la página. En el
  detalle del panel pasa algo parecido: la vista principal tiene un `<h1>`
  `sr-only`, pero al abrir un cliente desaparece y quedan dos `<h2>`.
- **Impacto:** el índice del lector de pantalla empieza en «Los premios» sin
  decir de quién es la tarjeta. Es una página que el cliente abre desde
  WhatsApp, sin otro contexto.
- **Estándar:** WCAG 1.3.1 y 2.4.6 (encabezados y etiquetas).
- **Arreglo:** `<h1>` con el nombre del negocio y el nombre de la tarjeta como
  subtítulo; en el detalle, un `<h1>` con el nombre del cliente. Bajar los
  rótulos de sección a `<h2>` con tamaño legible.
- **Comando:** `$impeccable harden`

### [P2] Micro-etiquetas de 10 y 11 px en mayúsculas en cada sección

- **Dónde:** `clientes-frecuentes-view.tsx:143`, `:315`, `:324`, `:392`;
  `tarjeta-cliente.tsx:304`, `:314`, `:354`, `:414`.
- **Categoría:** Tipografía y anti-patrones.
- **Qué pasa:** todas las secciones se anuncian con 10 u 11 px, mayúsculas y
  tracking de 0.14 a 0.18 em. El cuerpo del sistema es 16 px y `meta` es 12;
  estas etiquetas quedan por debajo de la escala y repiten el mismo gesto en
  cada bloque.
- **Impacto:** a 10 px el texto se lee mal incluso con buena vista, y el patrón
  hace que la tarjeta parezca una plantilla en vez de un objeto del negocio.
- **Arreglo:** una sola etiqueta pequeña por superficie, con `text-meta` (12 px)
  y sin tracking; el resto, títulos de 14 a 16 px con peso. En la tarjeta,
  dejar «Los premios» y «Últimos movimientos» como `<h2>` de 14 px.
- **Comando:** `$impeccable quieter`

### [P2] Confirmar el borrado deja el foco en el vacío

- **Dónde:** `clientes-frecuentes-view.tsx:1068-1085`.
- **Categoría:** Accesibilidad.
- **Qué pasa:** «Borrar cliente» se sustituye en línea por «Sí, borrar» y
  «Cancelar». Al confirmar, el botón que tenía el foco desaparece y el foco
  vuelve al `body`; no hay diálogo, ni `aria-live`, ni devolución del foco a
  «Clientes». El botón destructivo usa `bg-destructive` con texto blanco
  (4.32:1) a 12 px.
- **Impacto:** quien navega con teclado pierde el sitio; quien usa lector de
  pantalla no oye que la tarjeta se borró más allá del toast.
- **Estándar:** WCAG 2.4.3 (orden del foco) y 4.1.3 (mensajes de estado).
- **Arreglo:** confirmación en `Dialog` con título («Borrar la tarjeta de
  X»), descripción con el historial que se pierde y foco inicial en
  «Cancelar»; al terminar, enfocar el botón «Clientes».
- **Comando:** `$impeccable harden`

### [P3] El servidor no comprueba el plan en dos caminos de escritura

- **Dónde:** `src/lib/fidelidad-server.ts:865-899` (`sellarClienteExistente`),
  `:705-743` (`ajustarSellos`) y
  `src/app/api/places/[id]/clientes-frecuentes/[clienteId]/sellos/route.ts:16`.
- **Categoría:** Consistencia de permisos.
- **Qué pasa:** `sellarClienteExistente` comprueba `cliente_frecuente` y que la
  configuración esté activa, pero no `whatsapp_pedido`, que sí exigen
  `alCompletarPedido` y `fidelidadActiva`. `ajustarSellos` y su ruta no
  comprueban ni la función ni `activo`: con el plan caído, `ficha` puede seguir
  moviendo sellos. La UI esconde el candado correspondiente, pero la ruta
  responde.
- **Impacto:** un negocio que perdió el módulo puede seguir alterando saldos por
  API. No hay fuga de datos, pero el estado deja de ser coherente con el plan.
- **Arreglo:** añadir `tieneFuncion(placeId, "whatsapp_pedido")` a
  `sellarClienteExistente` y `tieneFuncion(..., "cliente_frecuente")` más
  `config.activo` a `ajustarSellos`, devolviendo `sin_funcion` como ya hacen
  las otras rutas.
- **Comando:** `$impeccable harden`

### [P3] La tarjeta pública sobrevive al plan de pedidos

- **Dónde:** `src/lib/fidelidad-server.ts:1141-1180` (`tarjetaPublica`).
- **Categoría:** Consistencia.
- **Qué pasa:** exige `cliente_frecuente` y `fidelidad.activo`, pero no
  `whatsapp_pedido`, mientras que `fidelidadActiva` (la que usa el panel) exige
  las dos. Si el negocio pierde pedidos, el cliente sigue abriendo su tarjeta
  por el enlace, pero ya no puede sumar sellos.
- **Impacto:** el enlace promete un mecanismo que ya no existe. La página
  debería decir que la tarjeta está en pausa.
- **Arreglo:** alinear `tarjetaPublica` con `fidelidadActiva`, o devolver un
  estado «en pausa» con copy propio en lugar de un 404.
- **Comando:** `$impeccable harden`

### [P3] La métrica «Repiten» mide sellos, no visitas

- **Dónde:** `src/lib/fidelidad-server.ts:833-860` y
  `clientes-frecuentes-view.tsx:1140-1144`.
- **Categoría:** Copy y datos.
- **Qué pasa:** la tarjeta dice «Repiten (2+ sellos)» y el cálculo es
  `sellos_totales >= 2`, que incluye sellos dados a mano y sellos iniciales de
  una tarjeta de papel. No mide clientes que volvieron.
- **Impacto:** el dueño lee «repiten» y entiende recompra; el número puede
  subir con una sola visita migrada.
- **Arreglo:** renombrar a «Con 2+ sellos» o calcular recompra real (dos
  movimientos de tipo `sello` en fechas distintas).
- **Comando:** `$impeccable clarify`

### [P3] Quitar un premio no avisa de los sellos que quedan fuera

- **Dónde:** `clientes-frecuentes-view.tsx:500-515`.
- **Categoría:** Prevención de errores.
- **Qué pasa:** el botón de papelera elimina la meta sin confirmación. Si el
  cliente tenía 12 sellos y la nueva última meta queda en 10, los sobrantes se
  conservan (`estadoTarjeta` no recorta), pero nadie lo explica al guardar.
- **Impacto:** el dueño puede creer que borró sellos ganados o que la tarjeta
  se reinició.
- **Arreglo:** nota bajo el botón o confirmación breve: «Los sellos por encima
  del nuevo último premio se guardan para la próxima tarjeta».
- **Comando:** `$impeccable clarify`

### [P3] Decoración y transiciones menores

- **Dónde:** `clientes-frecuentes-view.tsx:308-309` (círculos
  `bg-white/[0.04]`),  `:395` (`opacity-45` para la vista inactiva),
  `tarjeta-cliente.tsx:391-398` (`transition-all` sobre el ancho de la barra).
- **Categoría:** Anti-patrones y movimiento.
- **Qué pasa:** los círculos no comunican nada; `opacity-45` apaga también los
  textos que ya estaban en `/60`; la barra de progreso anima `width`, una
  propiedad de layout, y no tiene `role="progressbar"` ni `aria-valuenow`.
- **Impacto:** el estado inactivo se vuelve ilegible en vez de explicarse, y la
  barra no se anuncia.
- **Arreglo:** quitar los círculos; sustituir `opacity-45` por un tinte
  `bg-ink/[0.04]` y el texto «Inactiva» ya visible; animar `transform: scaleX`
  o dejar la barra sin transición, con `role="progressbar"` y valores.
- **Comando:** `$impeccable quieter`

## 5. Lo que ya está bien

- **Permisos.** Todas las rutas pasan por `canManagePlace`: `pedidos` para
  mostrador (sellar, canjear, alta), `ficha` para ajustar saldos, borrar y
  configurar. El `GET` de configuración lee los datos aunque el plan haya
  caído y avisa de qué función falta.
- **Concurrencia.** El sello del pedido es una sola sentencia con CTE y un
  índice único parcial (`movimientos_sellos_pedido_activo_idx`), el canje tiene
  su único `(cliente, ciclo, meta)` y la reversión se apoya en el sello activo.
  Dos pestañas no suman dos veces.
- **Privacidad.** La tarjeta pública va solo por token validado con regex, el
  teléfono sale enmascarado y el DTO no incluye id de cliente, usuario ni
  historial completo.
- **Recuperación.** El «+Sello» tiene deshacer de 6 s con `movimientoId`, y el
  historial guarda nota y autor.
- **Estados vacíos y candados.** La lista vacía explica cómo aparece el primer
  cliente y los dos candados dicen qué función falta y llevan a planes.
- **Sin P0.** No hay pérdida de datos ni agujero de permisos en el camino
  normal.

## 6. Comandos recomendados

En este orden:

1. `$impeccable harden`: interruptor, etiquetas, contraste, validación,
   estados de error, permisos de servidor y foco del borrado.
2. `$impeccable adapt`: objetivos de 44 px, diálogos con scroll y teclado.
3. `$impeccable clarify`: métrica «Repiten», aviso al quitar premios y copy de
   los estados de pausa.
4. `$impeccable quieter`: micro-etiquetas, círculos decorativos y `opacity-45`.
5. `$impeccable polish`: pasada final de foco, `aria-live` y consistencia.

## 7. Verificación

- Detector determinista sobre los tres archivos de superficie: `[]`, exit 0.
- Contraste calculado con los hex reales de `ink-soft` (#1B2A21), `verde` y
  `destructive` del `tailwind.config.ts`, componiendo alfa sobre blanco y sobre
  `verde-600`/`verde-800`.
- `npm run typecheck`: 0 errores, exit 0, después de los cambios.
- `node --import tsx --test src/lib/fidelidad.test.ts`: 8/8, exit 0.
- `npx tailwindcss -i src/app/globals.css`: exit 0; generan reglas
  `max-h-[calc(100dvh_-_2rem)]`, `size-11`, `text-destructive-ink` y
  `overscroll-contain`.
- `git diff --check`: sin errores de espacios en blanco.
- Sin comprobación en navegador: no hay cuenta con negocio en este entorno,
  `/business` rebota al alta y no hay E2E de esta sección.

## 8. Correcciones aplicadas

Se ejecutaron los arreglos de los cinco P1 y de los P2/P3 que no dependen de
una decisión de producto.

| Hallazgo | Cambio |
|---|---|
| Interruptor inaccesible | Ahora es un `<button role="switch">` de 44 px, con `aria-labelledby`, `aria-describedby` y foco visible; la fila ya no finge ser un `label` clicable |
| Objetivos táctiles | `BTN_*`, filtros, stepper, «+Sello», pestañas y aspa del diálogo a 44 px (`h-11`/`size-11`) |
| Contraste | Textos informativos a `/70` o `/75`; en la tarjeta verde, texto `verde-50` sobre un degradado que empieza en `verde-600`; destructivos con `destructive-ink` |
| Borrador perdido | Los dos paneles quedan montados y se alternan con `hidden`; el borrador y `isDirty` sobreviven al cambio de pestaña |
| Campos sin nombre | Etiquetas `sr-only` para búsqueda, cantidad y motivo; `aria-label` en premios y nota del sello |
| Pestañas | `aria-controls`, `role="tabpanel"`, `aria-labelledby`, `tabIndex` y flechas/Inicio/Fin |
| Error de carga | Estado `errorCarga` con «Reintentar», distinto del vacío; `abrirDetalle` con `catch` |
| Búsqueda | Guarda de petición para descartar respuestas viejas; las estadísticas solo se piden sin término de búsqueda |
| Diálogos | `max-h-[calc(100dvh_-_2rem)]`, `overflow-y-auto` y `overscroll-contain` |
| Validación | Nombre y premios se validan antes del PATCH, con `aria-invalid`, borde, mensaje y foco en el primer campo |
| «+Sello» | Refresco silencioso tras sumar o deshacer; el botón no aparece con la tarjeta inactiva |
| Encabezados | `<h1>` en la tarjeta pública, `<h1>` oculto en el detalle y rótulos de sección a 14 px |
| Micro-etiquetas | Se quitaron mayúsculas y tracking de 0.14 a 0.18 em; los rótulos pasan a `text-meta` o `text-small` |
| Borrado | Al confirmar, el foco vuelve a la pestaña «Clientes»; al cancelar, al botón de borrar |
| Permisos de plan | `sellarAMano`, `sellarClienteExistente` y `ajustarSellos` exigen las funciones; `ajustarSellos` distingue `inactiva` y la ruta responde 409 |
| Tarjeta pública | También exige `whatsapp_pedido`, alineada con `fidelidadActiva` (si falta, 404 en lugar de una tarjeta que ya no suma) |
| Métrica | «Repiten (2+ sellos)» pasa a «Con 2+ sellos» |
| Quitar premio | La ayuda del editor explica que los sellos por encima del último premio se conservan |
| Decoración y movimiento | Fuera los círculos `bg-white/[0.04]` y el `opacity-45`; la barra de progreso usa `scaleX`, `motion-reduce` y `role="progressbar"` |

**Queda pendiente, por decisión de producto:** confirmar el borrado en un
`Dialog` en vez de en línea (el foco ya no se pierde, pero el patrón sigue
siendo ligero), y un estado «en pausa» para la tarjeta pública cuando cae el
plan de pedidos; hoy se resuelve con el mismo 404 que un token borrado.
