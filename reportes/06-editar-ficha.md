---
target: flujo de edición de ficha del panel de negocio (Editar)
total_score: 13
p0_count: 0
p1_count: 6
date: 2026-11-20
slug: business-editor
---

# Auditoría técnica: flujo de editar en el panel de negocio

**Objetivo.** El camino completo de «Editar»: `EditorView` en `business-panel.tsx`
(13 `FormSection`), `form-section.tsx` (acordeón), `logo-upload.tsx`,
`photo-grid.tsx`, `horario-editor.tsx`, `modulos-editor.tsx`,
`atributos-chips.tsx`, `payment-chips.tsx`, `MapLocationPicker.tsx` y la barra de
guardado pegada al pie.

**Registro:** `product`. **Referencias:** `PRODUCT.md`, `DESIGN.md`,
`reference/product.md`.

**Método.** Lectura del código y medición de contraste con los valores reales de
`tailwind.config.ts` (OKLCH convertido a sRGB). Detector determinista:
`detect.mjs --json` sobre los 7 archivos del flujo, `[]`, exit 0. Sin navegador:
la identidad de desarrollo no tiene negocio y `/business` rebota al alta, así que
no hay evidencia visual. Todo lo de abajo se apoya en el código.

## 1. Puntuación

| # | Dimensión | Nota | Hallazgo clave |
|---|-----------|------|----------------|
| 1 | Accesibilidad | 2 | 13 secciones sin encabezados y una validación que no puede llevar al campo que falla |
| 2 | Rendimiento | 3 | El borrador serializa toda la ficha y escribe en `localStorage` en cada tecla |
| 3 | Diseño adaptable | 2 | Controles de 20 a 32 px, acciones de foto solo con hover y la barra de guardado que no cabe a 320 px |
| 4 | Theming | 3 | Tokens y modo oscuro cubiertos por reglas globales; `z-index` y un hex sueltos |
| 5 | Anti-patrones | 3 | Nada de slop; quedan micro-etiquetas de 10 px y un `whileTap` decorativo |
| **Total** | | **13/20** | **Aceptable: hay que atacar las dimensiones débiles** |

## 2. Veredicto de anti-patrones

**Pasa.** No parece generado. Reutiliza el acordeón, el `Select` de Radix, los
chips de pago y de atributos, las curvas `ease-outquint` y los tokens de arena y
verde. No hay métricas inventadas, ni degradados, ni cristal decorativo, ni
tarjetas dentro de tarjetas.

Los dos tics reales: el rótulo «Añadir» de la rejilla de fotos en 10 px con
`tracking-[0.22em]` (micro-etiqueta que el sistema usa para categorías, no para
un control), y el `whileTap={{ scale: 0.995 }}` en la cabecera del acordeón, que
es movimiento decorativo en un control que no lo necesita.

## 3. Resumen

6 problemas P1, 6 P2 y 5 P3. Ninguno impide guardar: la ruta feliz (rellenar,
guardar, recuperar borrador) funciona y está bien protegida. Lo que falla es el
borde: quien usa lector de pantalla no puede recorrer las secciones, quien edita
desde el móvil no puede borrar una foto, y quien tiene un teléfono de 320 px ve
la barra de guardado desbordada.

Lo más grave, en orden:

1. La validación no lleva al campo (y el mecanismo para hacerlo ya existe).
2. Las acciones de las fotos viven detrás del hover.
3. El editor de horario tiene controles de 20 px.
4. Contraste por debajo de AA en textos de 12 px.
5. La barra de guardado no cabe en pantallas de 320 px.

## 4. Hallazgos

### [P1] Las secciones no son encabezados

- **Dónde:** `src/components/business/form-section.tsx`, la cabecera del acordeón.
- **Categoría:** Accesibilidad.
- **Qué pasa:** el título va en un `<span>` dentro de un `<motion.button>`. Hay
  un `<h1 class="sr-only">Editar ficha</h1>` y, debajo, trece secciones sin
  ningún `<h2>`. El botón tiene `aria-expanded`, pero no `aria-controls`, y el
  panel desplegado no tiene `id`, `role="region"` ni `aria-labelledby`.
- **Impacto:** con lector de pantalla, la única forma de llegar a «Horario» es
  tabular por trece botones; no hay índice de secciones ni forma de saltar. Un
  usuario de teclado sin lector sí puede, pero a ciegas de estructura.
- **Estándar:** WCAG 1.3.1 (información y relaciones), 2.4.6 (encabezados).
- **Arreglo:** `<h2>` envolviendo el título dentro del botón (es válido), o un
  `aria-labelledby` con un `id` en el título; añadir `aria-controls` al botón y
  `role="region"` + `aria-labelledby` al panel.
- **Comando:** `$impeccable harden`

### [P1] La validación no puede llevar al campo que falla

- **Dónde:** `business-panel.tsx`, `save()` (~línea 1116) y la franja de error
  (~línea 1940).
- **Categoría:** Accesibilidad y consistencia.
- **Qué pasa:** el editor valida nombre, ubicación y WhatsApp. Al fallar, pinta
  una sola franja con `role="alert"` y llama a `document.getElementById("bizName")?.focus()`.
  Pero el contenido de una sección cerrada **no está en el DOM**
  (`{open && <motion.div>}` en `form-section.tsx`), así que el `focus()` es un
  no-op en la mayoría de los casos, la sección no se abre y no se marca en rojo.
  El `FormSection` tiene la prop `invalid` exactamente para esto y el editor no
  la pasa en ninguna de sus trece secciones; el catálogo sí usa `aria-invalid`.
- **Impacto:** el aviso dice «Está en “Información del negocio”», el usuario
  busca, y el campo sigue cerrado y sin señal. En un formulario de trece
  secciones eso es un callejón.
- **Estándar:** WCAG 3.3.1 (identificación de errores), 3.3.3 (sugerencia).
- **Arreglo:** que la validación devuelva `{ seccion, campo }`, abra esa sección
  (`setOpenId`), espere al montaje y enfoque; pasar `invalid` a cada sección
  afectada; `aria-invalid` y `aria-describedby` en el campo.
- **Comando:** `$impeccable harden`

### [P1] El editor de horario tiene controles de 20 px

- **Dónde:** `horario-editor.tsx`.
- **Categoría:** Diseño adaptable.
- **Qué pasa:** el interruptor de día es `size-5` (20×20), los campos de hora
  `h-8` (32 px), «Franja» `h-7` (28 px) y la papelera `size-7` (28 px). El
  proyecto exige 44×44 con 8 px de separación.
- **Impacto:** es la sección que más se toca con el pulgar, en un móvil, y el
  control principal (abrir/cerrar un día) mide menos de la mitad del mínimo. Se
  falla el objetivo y se cierra el día equivocado.
- **Estándar:** WCAG 2.5.8 (objetivo táctil, 24 px como mínimo AA; el proyecto
  pide 44).
- **Arreglo:** subir el asa a 44 px con `::before` extendido o `p-3` en el
  botón, campos de hora a 44 px, y reutilizar el patrón de `Select` para las
  horas en vez de `type="time"` de 32 px.
- **Comando:** `$impeccable adapt`

### [P1] Las acciones de las fotos viven detrás del hover

- **Dónde:** `photo-grid.tsx`.
- **Categoría:** Diseño adaptable.
- **Qué pasa:** borrar, marcar portada y mover a «Trabajos» son botones
  `size-7` con `opacity-0 group-hover:opacity-100` (y `focus-visible`). En un
  dispositivo táctil no hay hover: el botón existe, es invisible y está debajo
  del pulgar. Además, borrar es inmediato, sin confirmación ni deshacer.
- **Impacto:** desde el móvil, que es el caso normal según `PRODUCT.md`, no se
  puede quitar una foto ni cambiarla de portada. Si se acierta a ciegas, la foto
  se borra sin vuelta atrás.
- **Estándar:** WCAG 2.5.8, y 3.3.4 para la acción destructiva.
- **Arreglo:** en puntero grueso (`@media (hover: none)`) mostrar los controles
  siempre, a 44 px; mantener el hover solo donde hay ratón. Añadir confirmación
  o deshacer al borrado.
- **Comando:** `$impeccable adapt`

### [P1] La barra de guardado no cabe a 320 px

- **Dónde:** `business-panel.tsx` (~línea 1948), barra `sticky bottom-4`.
- **Categoría:** Diseño adaptable.
- **Qué pasa:** «Ver ficha» y «Guardar cambios» van en fila, con `px-gap-lg`
  (24 px por lado), icono de 16 px, `gap-gap-xs` y `text-small`. Con los anchos
  de texto actuales son unos 320 px de botones más 8 de separación; a 320 px de
  pantalla quedan 296 útiles (12 px de padding por lado). No caben: el texto se
  parte dentro de un `h-12` fijo o la fila desborda.
- **Impacto:** scroll horizontal o texto cortado en el ancho que el proyecto
  declara soportado (320 a 430 px), justo en el botón que cierra la tarea.
- **Evidencia de que ya se sabía:** `save-bar.tsx` documenta este mismo fallo
  («en fila a 360 px no caben») y lo resuelve con `flex-col-reverse` en móvil.
  Ese componente está muerto; la barra viva no heredó la solución.
- **Estándar:** reflow a 320 px (WCAG 1.4.10).
- **Arreglo:** `flex-col-reverse` bajo `sm` como en `save-bar.tsx`, o dejar solo
  el primario a ancho completo y «Ver ficha» como enlace de texto.
- **Comando:** `$impeccable adapt`

### [P1] Textos de 12 px por debajo de AA

- **Dónde:** `business-panel.tsx` (contador `0/140`, «Borrar horario por día»,
  «Quitar»), `horario-editor.tsx` («Cerrado»), `photo-grid.tsx` y
  `MapLocationPicker.tsx` (errores), `logo-upload.tsx` (error).
- **Categoría:** Accesibilidad.
- **Qué pasa:** medido con los tokens reales:
  - `text-ink-soft/50` sobre blanco: **3,07:1** (contador 0/140, «Cerrado»).
  - `text-ink-soft/60` sobre blanco: **4,13:1** («Borrar horario por día»,
    «Quitar»).
  - `text-destructive` (`oklch(60% 0.2 25)`) sobre `bg-destructive/10`:
    **3,80:1**; sobre blanco, 4,38:1. Los tres errores citados usan esta pareja.
  - El token `destructive-ink` ya existe (8,16:1 sobre blanco, 7,09:1 sobre el
    tinte) y se usa en notificaciones y verificación. Aquí no.
- **Impacto:** los textos auxiliares son los que explican qué hace un control o
  cuánto falta; a 12 px y 3:1 no se leen con sol o en un móvil barato.
- **Estándar:** WCAG 1.4.3 (4,5:1 en texto normal).
- **Arreglo:** `/50` y `/60` a `/75`; en las filas de error, `text-destructive-ink`.
- **Comando:** `$impeccable polish`

### [P2] El borrador se serializa y se escribe en cada tecla

- **Dónde:** `business-panel.tsx`, `huella = JSON.stringify(estadoFicha)` y el
  efecto que hace `localStorage.setItem` con `[huella, sucio]`.
- **Categoría:** Rendimiento.
- **Qué pasa:** cada pulsación en la descripción (o en cualquier campo) recorre
  y serializa un objeto con 27 campos, incluidos `horario`, `entrega`,
  `comoComprar`, `especialDia` y arrays; después escribe de forma síncrona en
  `localStorage`.
- **Impacto:** en un Android de gama baja, escribir unos kilobytes síncronos por
  tecla compite con el render del campo. No se ha medido en dispositivo, así que
  se reporta como riesgo, no como regresión observada.
- **Arreglo:** debounce de 400 a 600 ms para la escritura, y comparar por
  referencias en vez de serializar en cada render (o serializar solo dentro del
  debounce).
- **Comando:** `$impeccable optimize`

### [P2] No hay señal de cambios pendientes ni forma de descartar

- **Dónde:** `business-panel.tsx`, barra inferior.
- **Categoría:** Consistencia.
- **Qué pasa:** `sucio` se calcula y alimenta la guardia de salida, pero no se
  pinta. La barra solo tiene «Ver ficha» y «Guardar cambios», sin «Descartar» ni
  recuento, mientras el catálogo usa barra con «N cambios sin guardar» y
  «Descartar».
- **Impacto:** el mismo dueño aprende dos contratos en el mismo panel. Además,
  si se arrepiente, la única salida es recargar o deshacer a mano.
- **Arreglo:** unificar con la barra del catálogo, o al menos mostrar el estado
  (`role="status"`) y un «Descartar» que vuelva a `guardado.current`.
- **Comando:** `$impeccable polish`

### [P2] Tres controles sin nombre accesible

- **Dónde:** `business-panel.tsx`, secciones «Color de marca» (~1826) y
  «Mensaje de cierre» (~1846).
- **Categoría:** Accesibilidad.
- **Qué pasa:** el `input type="color"`, el `Input` del hex y el `Input` del
  mensaje de cierre no tienen `Label`, `id`, `aria-label` ni `aria-labelledby`.
  Solo el placeholder, que no es un nombre accesible.
- **Estándar:** WCAG 1.3.1, 4.1.2, 3.3.2.
- **Arreglo:** `Label htmlFor` como en el resto del editor; el selector nativo
  con `aria-label="Elegir color"` y el hex con su `Label`.
- **Comando:** `$impeccable harden`

### [P2] Campos de 14 px que disparan el zoom de iOS

- **Dónde:** `horario-editor.tsx` (campos de hora, `text-small`) y
  `MapLocationPicker.tsx` (campo de dirección, `FIELD` con `text-small`).
- **Categoría:** Diseño adaptable.
- **Qué pasa:** `PRODUCT.md` exige 16 px en campos para que iOS no haga zoom. El
  resto del editor lo cumple (el `Input` base es `text-body`); estos dos no.
- **Impacto:** al tocar una hora o la búsqueda de dirección, la página se
  amplía y hay que pellizcar para volver.
- **Arreglo:** `text-body` en ambos (o `text-[16px]` en móvil).
- **Comando:** `$impeccable adapt`

### [P2] Las fotos se guardan al instante y nada lo dice

- **Dónde:** `photo-grid.tsx` dentro de «Fotos del lugar».
- **Categoría:** Claridad.
- **Qué pasa:** subir, borrar y marcar portada escriben en la base al momento,
  mientras el resto de la ficha espera a «Guardar cambios». El texto de la
  sección explica el tamaño y la portada, pero no el contrato de guardado.
- **Impacto:** el dueño puede guardar creyendo que incluye las fotos (sí), o
  salir sin guardar creyendo que las fotos se pierden (no). Y al revés: un
  borrado accidental ya ocurrió aunque no pulse guardar.
- **Arreglo:** una línea en la sección: «Las fotos se guardan al momento; el
  resto, con “Guardar cambios”», y confirmación al borrar.
- **Comando:** `$impeccable clarify`

### [P2] El estado de guardado no se anuncia

- **Dónde:** barra inferior del editor.
- **Categoría:** Accesibilidad.
- **Qué pasa:** `saving` cambia el texto del botón a «Guardando…» y lo
  deshabilita, sin `aria-live` ni `aria-busy`. El éxito lo anuncia `sonner`, el
  fallo aparece en la franja con `role="alert"`.
- **Impacto:** quien no ve el icono girando no sabe si el guardado empezó.
- **Estándar:** WCAG 4.1.3 (mensajes de estado).
- **Arreglo:** `aria-live="polite"` en un estado cercano al botón, o
  `aria-busy` en el formulario.
- **Comando:** `$impeccable harden`

### [P3] Movimiento decorativo en el acordeón

`whileTap={{ scale: 0.995 }}` en la cabecera no aporta estado. Fuera.
(`$impeccable quieter`)

### [P3] `z-index` arbitrarios

`z-40` en la barra, `z-[500]` y `z-[600]` en el selector de mapa. El sistema no
tiene escala semántica; estos tres son los únicos del flujo. (`$impeccable polish`)

### [P3] Hex suelto

`#0F7A41` repetido como valor por defecto del selector de color; es
`verde-600`. Duplicar el token en JavaScript lo deja fuera de cualquier cambio
futuro de paleta. (`$impeccable polish`)

### [P3] El acordeón anima altura con movimiento reducido

`MotionConfig reducedMotion="user"` desactiva transformaciones, no la animación
de `height` de 300 ms. En `prefers-reduced-motion` conviene un corte seco.
(`$impeccable animate`)

### [P3] Alfas y radios fuera de escala

`border-ink/8` (el sistema usa `/5`, `/10`, `/15`) y `rounded-xl` mezclado con
`rounded-lv` y `rounded-2xl` en campos de la misma pantalla.
(`$impeccable polish`)

## 5. Lo que está bien y hay que conservar

1. **El borrador y la guardia ya cubren la ficha.** Lectura única al montar,
   oferta explícita («¿La recuperas?»), borrado al guardar, `beforeunload` y
   `registrarGuarda`. Es el P1 de la crítica de octubre, resuelto.
2. **El mapa no se carga hasta que hace falta.** `MapLocationPicker` importa el
   mapa con `dynamic(..., { ssr: false })` y vive dentro de una sección cerrada:
   la primera pintura del editor no paga el JavaScript del mapa.
3. **Campos principales a 16 px y 48 px de alto**, con `focus-visible` y anillo
   verde. La regla de iOS se cumple en el 90% del formulario.
4. **Los errores dicen qué pasó y dónde**, y al guardar fallido dejan claro que
   no se cambió nada. El tono es el del producto.
5. **Cero datos inventados.** No hay métricas ni promesas de destacado; el
   comentario del código explica por qué se retiró el bloque de 25 USD.
6. **El modo oscuro está cubierto** por los overrides de `.business-panel`, sin
   variantes `dark:` repartidas por los componentes.

## 6. Acciones recomendadas

1. **[P1] `$impeccable harden`**: encabezados y `aria-controls` en el acordeón;
   validación que abre la sección y enfoca el campo; `invalid` y `aria-invalid`;
   nombres accesibles en color y mensaje de cierre; `aria-live` del guardado.
2. **[P1] `$impeccable adapt`**: horario y fotos a 44 px, acciones visibles sin
   hover, barra de guardado en columna a 320 px, campos a 16 px.
3. **[P1] `$impeccable polish`**: contraste de `/50`, `/60` y de los errores
   (`destructive-ink`), `z-index`, hex suelto y radios.
4. **[P2] `$impeccable clarify`**: decir que las fotos se guardan al momento y
   añadir «Descartar» con estado de cambios pendientes.
5. **[P2] `$impeccable optimize`**: debounce del borrador en `localStorage`.
6. **[P3] `$impeccable quieter`**: quitar el `whileTap` de la cabecera.

## Arreglos aplicados en esta pasada (2026-11-20)

Tras el informe se ejecutaron los seis comandos recomendados:

- **`harden`**: el título de cada sección vive en un `h2`; el botón lleva
  `aria-expanded` y `aria-controls`, y el panel `role="region"` con
  `aria-labelledby`. La validación abre la sección que falla, la marca con
  `invalid`, enfoca el campo después del render y pone `aria-invalid`. Color,
  hex y mensaje de cierre tienen nombre accesible, y el guardado se anuncia con
  `role="status"`.
- **`adapt`**: asa de 44 px en el horario, campos de hora de 44 y 16 px,
  papelera y «Franja» de 44; acciones de foto visibles sin hover, de 44 px y con
  confirmación al borrar; chips de atributos y pagos de 44; barra de guardado en
  columna por debajo de `sm`; campo de dirección del mapa a 16 px.
- **`polish`**: `/50` y `/60` a `/75`, errores con `destructive-ink`,
  `border-ink/8` a `/10` y `#0F7A41` como constante nombrada. El `z-index`
  arbitrario se dejó igual: una escala semántica toca los dos paneles y no cabe
  en esta pasada.
- **`clarify`**: la sección de fotos dice que se guardan al momento; la barra
  muestra «Cambios sin guardar» y ofrece «Descartar cambios».
- **`optimize`**: el borrador se escribe 500 ms después de la última tecla.
- **`quieter`**: retirado el `whileTap` de la cabecera del acordeón.

Verificación: `npm run typecheck` en verde. Sin comprobación en navegador: el
entorno no tiene una cuenta con negocio.

## Verificación funcional campo a campo (2026-11-20)

Se siguió cada campo del editor hasta su columna y hasta el componente que lo
vuelve a pintar. La cadena es: estado del formulario → `UserPlacePatch` →
`PATCH /api/places/[id]` → `toPlaceValues` → columna → `toUserPlace` →
`userPlaceToPlaceData` → ficha o tarjeta.

| Campo | Columna | Se ve en |
|---|---|---|
| `name` | `name` | cabecera, tarjetas, pin |
| `category` | `category_id` | chip de la ficha y filtros |
| `icon` | `icon` | pin y tarjeta; vacío = el de la categoría |
| `logoUrl` | `logo_url` | cabecera, portada y pin |
| `photos` | tabla `place_images` | portada y galería |
| `description` | `description` | ficha |
| `address`, `barrio` | `address`, `neighborhood` | tarjeta de dirección |
| `lat`, `lng` | `lat`, `lng` | mapa y «cómo llegar» |
| `phone`, `website`, `whatsapp`, `instagram`, `facebook` | sus columnas | tarjeta de contacto y botones |
| `schedule` | `schedule` | ficha antigua sin horario estructurado |
| `status` | `status` | «Abierto / Cerrado» y chip |
| `payments` | `payment_methods` | tarjeta de pagos |
| `energiaRespaldo`, `notaApagon` | sus columnas | distintivos y pin |
| `tipoNegocio`, `modulosActivos` | sus columnas | qué tarjetas y qué vista de carta |
| `atributos` | `atributos` | fila de distintivos |
| `colorMarca` | `color_marca` | portada sin fotos y monograma |
| `horario`, `cerradoMensaje` | `horario`, `cerrado_mensaje` | estado de apertura y cocina |
| `entrega` | `entrega` (jsonb, escritura parcial) | tarjeta de domicilio |
| `comoComprar` | `como_comprar` | tarjeta de tienda |
| `comoAtiende` | `como_atiende` | tarjeta de servicios |
| `especialDia` | `especial_dia` | tarjeta local y banner del catálogo |

Todo lo anterior estaba ya en la lista blanca de `toPlaceValues`; no hay ningún
campo del editor que se caiga en silencio al guardar.

Lo que sí fallaba era el guardado de cuatro valores que el servidor valida y el
formulario dejaba producir: un hex de marca mal escrito, una franja de horario
sin hora, un tiempo de entrega con el mínimo por encima del máximo y un especial
del día encendido sin título ni fecha de fin. Los cuatro devolvían 400 y el panel
lo contaba como «revisa la conexión». Ahora se comprueban antes de salir, abren
su sección y dicen qué arreglar.

También se hizo controlado `PaymentChips`: era el único campo con estado propio,
así que «Descartar cambios» devolvía el valor guardado pero los chips seguían
enseñando la selección descartada.

**Hueco conocido:** el editor no edita `city` ni `province`. `toPlaceValues` ya
los admite, y el título de la ficha los usa para el SEO («Restaurante en Vedado,
La Habana»), así que una ficha que nació sin ellos no se puede completar desde el
panel.

## Run Notes

- slug: `business-editor` · ignore.md: no existe.
- Independencia: degradada (sin subagente disponible en esta sesión).
- Detector: `[]`, exit 0 sobre los siete archivos del flujo.
- Navegador: no usado. `/business` requiere una cuenta con negocio y el entorno
  de desarrollo no la tiene; no se afirma nada visual que no salga del código.
- Contraste calculado convirtiendo los OKLCH del `tailwind.config.ts` a sRGB,
  componiendo las opacidades sobre el fondo real.
- Arreglos de los seis comandos aplicados el mismo día; ver la sección anterior.
