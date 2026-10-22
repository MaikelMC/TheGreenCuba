---
target: sección Catálogo del panel del negocio (src/components/business/catalogo-view.tsx)
total_score: 24
p0_count: 0
p1_count: 3
timestamp: 2026-10-17T05-38-22Z
slug: src-components-business-catalogo-view-tsx
---
# Crítica de diseño — Sección «Catálogo» del panel del negocio

**Fecha:** 2026-10-17
**Objetivo:** `src/components/business/catalogo-view.tsx` (973 líneas) — la sección Catálogo del panel (`?seccion=catalogo`), con su armazón `PanelShell` como contexto.
**Registro:** `product` (el diseño SIRVE al producto). Referencias: `PRODUCT.md`, `DESIGN.md`, `reference/product.md`.
**Alcance:** la carta editable del dueño: buscador, filtros por categoría y agotados, agrupación, filas de producto, fotos por producto, importación CSV, barra de guardado y estados vacíos.

---

## 1. Design Health Score

| # | Heurística | Nota | Hallazgo clave |
|---|-----------|-------|----------------|
| 1 | Visibilidad del estado | 3 | Toasts y spinner de guardado, contador de productos y grupos. Falta anuncio del filtrado y de la lista del importador. |
| 2 | Sistema y mundo real | 3 | Lenguaje del barrio bien: «Hoy hay», «agotado hasta mañana», «carta». Se rompe al mezclar carta/catálogo/producto y «USD Clásica» junto a «USD». |
| 3 | Control y libertad | 2 | Sin deshacer el borrado de una fila, sin «descartar cambios» y sin salida cuando se deja la sección con cambios. |
| 4 | Consistencia y estándares | 2 | `<select>` nativo donde el resto del panel usa el `Select` de Radix; inputs a mano donde la ficha usa `Input`; foco casi inexistente. |
| 5 | Prevención de errores | 2 | Los cambios sin guardar se pierden al cambiar de sección sin aviso; el precio acepta cualquier texto. |
| 6 | Reconocer antes que recordar | 2 | Campos sin etiqueta visible: solo placeholder. «Hoy hay» se explica con `title`, que no existe en táctil. |
| 7 | Flexibilidad y eficiencia | 2 | Sin atajos, sin acciones en bloque (duplicar, mover de categoría, borrar varios). Bien: foco en el producto nuevo, Enter para confirmar categoría. |
| 8 | Estética y minimalismo | 3 | Disciplinado y limpio, con los tokens del sistema. Las filas cargan mucha densidad por renglón. |
| 9 | Reconocer y recuperar errores | 2 | Un único párrafo de error, en el fondo de la ficha, compartido por dos fuentes distintas. |
| 10 | Ayuda y documentación | 2 | Hay pistas puntuales (CSV exige guardar, tope del plan) y ningún contexto para «Hoy hay» ni para lo que pasa al llegar al tope. |
| **Total** | | **24/40** | **Acceptable — hacen falta mejoras antes de que el dueño esté contento** |

---

## 2. Veredicto de anti-patrones

**No parece hecho por una IA.** El registro es de producto y aquí se cumple: cero degradados decorativos, cero eyebrows numerados, cero ilustración SVG hecha a mano, cero tarjeta con borde de 1 px y sombra de 24 px a la vez. La paleta es la del sistema (`verde-400`, `ink`, `sand`, `elevación con tinta`), el radio de las superficies es `rounded-2xl`/`rounded-full`, y las microcopias hablan como el dueño («Tu carta está vacía», «Nada coincide»).

Tampoco parece una plantilla: las decisiones tienen motivo escrito (el filtro de agotados que se apaga solo, la categoría que se manda al salir del campo, la fila que se muda de grupo). Eso es voz de producto, no de generador.

**Lo que sí huele a `.component` genérico** es la ejecución del detalle: campos sin etiqueta visible, un `<select>` nativo suelto entre componentes Radix, y ninguna regla de foco. No es slop de estética: es slop de acabado.

**Escaneo determinista:** `detect.mjs --json src/components/business/catalogo-view.tsx` → `[]`, salida 0, sin hallazgos. El detector no ve anti-patrones de markup en este archivo; los problemas de abajo viven en interacción, accesibilidad y tipografía, que es justo lo que el detector determinista no cubre.

**Overlays en el navegador:** no disponibles. Ver §Run Notes.

---

## 3. Impresión general

La sección hace lo difícil bien: separa la carta de la ficha porque son dos ritmos distintos, trae el buscador y los filtros que la carta del móvil pide, y protege la importación con la regla de «guarda primero». Para un dueño que entra dos minutos antes de volver al mostrador, el camino «buscar el plato, ver que se acabó, marcar agotado» está resuelto y eso es el corazón del producto.

El problema mayor no es visual: es que **el trabajo sin guardar se cae sin avisar** en el gesto más probable de todos —tocar otra sección del panel— y que tres detalles de acabado (quitar la foto en táctil, el zoom de iOS en los campos, los errores al fondo) devuelven fricción a un público con datos caros y sin paciencia.

La mayor oportunidad: convertir la sección en un editor que **aguanta** —borrador, aviso al salir, errores junto al campo— y no solo en una lista que guarda cuando se lo piden.

---

## 4. Lo que funciona

1. **La agrupación por categoría respeta el orden en que el dueño las creó** y los grupos se recalculan tras cada tecla de búsqueda. No hay dos órdenes para la misma lista, y eso lo nota quien ya vio su carta pública.
2. **El filtro de agotados se apaga solo cuando deja de haber agotados** y solo se pinta cuando hay alguno. Es la clase de detalle que evita el callejón sin salida («lista vacía con una pastilla que ya no existe»), y está explicado en el código.
3. **La importación CSV está bloqueada mientras hay cambios sin guardar, con su explicación debajo.** Un botón deshabilitado sin texto al lado se lee como roto; aquí se lee como una regla.

---

## 5. Problemas prioritarios

### [P1] El trabajo sin guardar desaparece al cambiar de sección, sin aviso ni borrador

- **Qué pasa:** `sucio` solo gobierna la barra de guardado y el botón de importar. Si el dueño toca «Editar», «Dashboard» o cualquier otra sección del panel con la carta a medias, `PanelShell.go()` cambia de vista, `CatalogoView` se desmonta y lo escrito se va. No hay `beforeunload`, no hay confirmación y no hay borrador en `localStorage` (a diferencia de otras cosas del MVP, que sí lo usan).
- **Por qué importa:** rellenar una carta de veinte platos con el pulgar en una conexión mala es justo el trabajo largo que este panel existe para permitir. Perderlo cuesta media hora y confianza; para el dueño, que se le borre lo escrito es «la app me falló».
- **Arreglo:** confirmación en línea al cambiar de sección cuando `sucio` («Tienes cambios sin guardar. ¿Salir igual?») y borrador por `place.id` en `localStorage`, restaurado al volver con un aviso de «Recuperamos tu carta sin guardar». Añadir `beforeunload` para el cierre de pestaña.
- **Comando sugerido:** `$impeccable harden`

### [P1] Quitar la foto de un producto es imposible en el móvil

- **Qué pasa:** la X que llama a `onPatch(id, { image: undefined })` lleva `opacity-0 group-hover:opacity-100 focus-visible:opacity-100`. En un dispositivo táctil no existe `hover` cómodo, así que la única forma de quitar una foto es con ratón.
- **Por qué importa:** la foto mala —un plato en sombra, el precio de la competencia de fondo— es exactamente la que hay que poder borrar desde el teléfono, y `PRODUCT.md` dice que el dueño trabaja desde el móvil con datos caros.
- **Arreglo:** pintar la X siempre que `item.image` exista (o al menos con `@media (hover: none)` / `(pointer: coarse)`), subiendo el botón a 32 px; alternativa: ofrecer «Quitar foto» dentro del propio botón de la foto (escoge si hay imagen: cambiar / quitar).
- **Comando sugerido:** `$impeccable adapt`

### [P1] Los campos van a 14 px y el precio no abre teclado numérico

- **Qué pasa:** `INPUT` usa `text-small` (14 px) en nombre, descripción, categoría y precio; el precio es `type="text"` sin `inputMode`, así que en iOS la página hace zoom al enfocar cada campo y el teclado sale con letras.
- **Por qué importa:** `PRODUCT.md` exige «texto ≥16px en campos para que iOS no haga zoom» y el teclado de letras en un campo de precios es un tecleo de más por producto, por cada producto, cada semana. Con el zoom, además, la fila se sale del encuadre y el dueño se pierde en la lista.
- **Arreglo:** 16 px en los campos en móvil (o `text-body` en el input, `text-small` solo a partir de `sm:`), `inputMode="decimal"` y `enterKeyHint` en el precio, y `type="search"` ya está bien en el buscador.
- **Comando sugerido:** `$impeccable adapt`

### [P2] Los errores viven en un único párrafo al fondo de la sección

- **Qué pasa:** hay un solo `<p role="alert">` alimentado por `error ?? errorEstado`, colocado después de toda la carta. El fallo del tope («Tu plan permite hasta 20 productos…») se dispara desde el botón de arriba y aparece al fondo, fuera de pantalla. Los errores de disponibilidad y los del catálogo compiten por el mismo sitio.
- **Por qué importa:** el dueño pulsa «Añadir producto», no pasa nada visible y vuelve a pulsar. Un error que no se ve es un error que se convierte en «esto está roto».
- **Arreglo:** error en línea junto al botón que lo provoca (tope, CSV) y junto a la fila (producto sin nombre), más un resumen pegado a la barra de guardar. Separar los dos canales: uno informa de la disponibilidad, otro del guardado.
- **Comando sugerido:** `$impeccable clarify`

### [P2] Contraste por debajo de AA en las pastillas de filtro y en su contador

- **Qué pasa:** el contador de una pastilla inactiva es `text-ink-soft/50` (≈3,1:1 sobre blanco) y en la activa `text-verde-950/70` sobre `verde-400` (≈3,6:1). Son 12 px, o sea texto normal: el mínimo es 4,5:1, y `PRODUCT.md` pide 4,5:1 para secundario.
- **Por qué importa:** el contador y el rótulo de cada categoría son el dato que el dueño lee de un vistazo para saber qué tiene; a pleno sol en la puerta del negocio, 3:1 no se lee.
- **Arreglo:** `/75` en los contadores inactivos (≈6,5:1) y `text-verde-950` entero sobre la pastilla activa. Un token de «texto sobre verde-400» evita que el siguiente se lo invente.
- **Comando sugerido:** `$impeccable colorize`

### [P2] Blancos táctiles por debajo del mínimo del sistema, con dos peligrosos apilados

- **Qué pasa:** las pastillas de filtro miden 36 px de alto (el sistema pide 40 para chips), y en la columna de acciones de cada fila se apilan dos botones de 40 px (borrar y «Hoy hay») con 8 px de aire, en el borde derecho por donde pasa el pulgar al hacer scroll.
- **Por qué importa:** un toque en el borrado vecino cuando querías marcar «agotado» cuesta una fila entera, y el scroll de la lista con el pulgar vive justo encima de esa columna.
- **Arreglo:** 44 px en los dos botones de acción con 12 px de separación, o mover «Hoy hay» a la línea de metadatos (categoría/precio) y dejar en la columna solo el borrado.
- **Comando sugerido:** `$impeccable adapt`

---

## 6. Banderas rojas por persona

**Casey (móvil, a media tarea):** no puede quitar una foto (solo hay `hover`); iOS le hace zoom en cada campo de 14 px y le abre teclado de letras para el precio; si la llaman y toca «Dashboard», pierde la carta entera sin aviso; y el autoenfoque del producto nuevo le sube el teclado encima de la fila, tapando el nombre que acaba de crear.

**Sam (lector de pantalla y teclado):** los campos se anuncian solo por `aria-label` —bien—, pero el campo de categoría usa `list`/`datalist`, que Safari en iOS no expone, así que la sugerencia de categorías es muda en una parte del público; el contador filtrado no se anuncia (no hay `aria-live`); y el error, siendo `role="alert"`, interrumpe con el mensaje del fondo aunque el problema esté en la fila 12, sin relación entre ambos.

**Jordan (primerizo):** llega a una sección sin título visible (`h1` con `sr-only`) y se encuentra cuatro campos por fila sin más etiqueta que el placeholder, que desaparece en cuanto escribe; ve «USD Clásica» y «USD» en el mismo desplegable sin saber cuál es su moneda; y el icono circular de «Hoy hay» no dice nada hasta que lo toca.

---

## 7. Observaciones menores

- El botón de borrar es una X, que en el resto de la app significa cerrar; un icono de papelera diría «eliminar».
- El precio no valida ni formatea: acepta «abc», emoji o «1.500,50», y el importador sí normaliza precios, así que la carta puede acabar con dos convenciones.
- El borrador de fila no avisa de que el cambio no se ha guardado hasta pulsar «Guardar carta»; la barra solo aparece cuando ya hay algo sucio, lo cual está bien, pero no hay contador de «3 cambios sin guardar».
- La barra de guardado es `sticky bottom-4` sin relleno de compensación: puede tapar la última fila y, con ella, su control de disponibilidad.
- La sección de importación repite un encabezado propio y un «Cerrar» que compiten con la cabecera del buscador a pocos píxeles.
- Los grupos son `h2` dentro de `section` sin `aria-labelledby`: el conteo se anuncia como parte del título, lo cual es útil, pero conviene atarlo explícitamente.
- `title` en los dos botones de «Hoy hay» no llega nunca en táctil; el `aria-label` cubre al lector de pantalla, no al dedo.

---

## 8. Preguntas para considerar

- ¿Y si la sección se comportara como un documento con cambios: guardado automático cada pocos segundos y un «deshacer» visible, en vez de un botón que hay que recordar pulsar?
- ¿La columna de acciones de cada fila necesita existir, o «Hoy hay» pertenece a la línea de metadatos junto a la categoría y el precio?
- ¿Cuál es la palabra de la casa, «carta» o «catálogo»? Lo que se elija debería aparecer en la navegación, los botones y los avisos.
- ¿Qué debería pasar cuando el dueño llega al tope del plan con productos ya guardados: bloquear, o dejar editar y sugerir el plan en el momento en que se toca el límite?
