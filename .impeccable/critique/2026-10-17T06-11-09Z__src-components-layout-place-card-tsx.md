---
target: recomendaciones (hoja del home y tarjetas)
total_score: 24
p0_count: 0
p1_count: 4
timestamp: 2026-10-17T06-11-09Z
slug: src-components-layout-place-card-tsx
---
# Crítica de diseño — Recomendaciones

**Objetivo:** la hoja «Recomendaciones» del home y sus tarjetas: `src/components/layout/place-card.tsx`, `src/components/layout/bottom-sheet.tsx`, `PlaceCardRow` dentro de `src/app/(main)/home/page.tsx`.
**Registro:** `product`. **Referencias:** `PRODUCT.md`, `DESIGN.md`, `reference/product.md`.

## 1. Design Health Score

| # | Heurística | Nota | Hallazgo clave |
|---|-----------|-------|----------------|
| 1 | Visibilidad del estado | 2 | Skeletons y `aria-busy` bien; el resultado de la búsqueda y el conteo no se anuncian. |
| 2 | Sistema y mundo real | 3 | Distancia, moneda y horario en palabras del barrio; el banner promete «podrían gustarte» con un conteo que es de provincia, no de gusto. |
| 3 | Control y libertad | 2 | La hoja se baja y se estira; no hay deshacer ni estado persistente para el favorito. |
| 4 | Consistencia y estándares | 2 | Misma tarjeta en dos sitios con geometrías distintas; acciones `size-10` (40 px) con el patrón de 44 px del resto. |
| 5 | Prevención de errores | 2 | Tarjeta clicable con tres botones dentro: el toque se reparte entre cuatro objetivos que se solapan. |
| 6 | Reconocer antes que recordar | 3 | Cada tarjeta enseña logo, categoría, distancia, precio y etiquetas sin pedir memoria. |
| 7 | Flexibilidad y eficiencia | 2 | Sin filtros dentro de la hoja de resultados, sin ordenar, sin «ver todos» del grupo. |
| 8 | Aestética y minimalismo | 3 | Bien: tinte suave por estado, nada decorativo. La letra de las etiquetas a 11 px es el límite. |
| 9 | Reconocer y recuperar errores | 2 | El error de conexión de la hoja se explica y ofrece reintento; el fallo de una tarjeta no existe como caso. |
| 10 | Ayuda y documentación | 2 | El banner explica el porqué del listado, pero su primera línea es genérica. |
| **Total** | | **24/40** | **Acceptable** |

## 2. Anti-patrones

**LLM:** la tarjeta no es la rejilla de tarjetas clónicas: hay jerarquía (thumbnail de marca, nombre, categoría, metadatos, etiquetas) y el estado seleccionado cambia borde y fondo, no solo un borde izquierdo de color. Sin *side-stripe*, sin degradado en el texto, sin glassmorphism decorativo (el `backdrop-blur` de la hoja tiene función: tapa el mapa).

Lo que sí es de manual es el patrón de interacción: `role="button"` con `tabIndex` propio y tres `<button>` reales dentro. Es el anti-patrón de accesibilidad más común de las listas de resultados.

**Detector:** `detect.mjs --json src/components/layout/place-card.tsx` → `[]`, exit 0.

## 3. Impresión general

La tarjeta hace lo importante: se reconoce un lugar de un vistazo y se puede mirar en el mapa, guardar o abrir sin salir de la hoja. Lo que la hunde son dos cosas: el corazón que no guarda y el hecho de que la mitad de los datos que enseña (valoración, precio) son opcionales y a veces se pintan vacíos dejando huecos raros en la línea de metadatos.

## 4. Lo que funciona

1. **El thumbnail da prioridad al logo del negocio y cae al icono de la categoría**: la marca se reconoce antes que un pictograma genérico, y hay comentario del porqué.
2. **El estado seleccionado se lee sin color**: borde verde + fondo teñido, y también la tarjeta lleva `whileHover`/`whileTap` contenidos.
3. **Los skeletons tienen la geometría exacta de la tarjeta** y el contenedor se marca `aria-busy` durante la carga.

## 5. Problemas prioritarios

### [P1] Cuatro objetivos que se solapan en una sola tarjeta
- **Qué pasa:** la tarjeta es un `motion.div role="button" tabIndex={0}` con `onClick`, y dentro lleva tres botones reales (mapa, favorito, detalle) que cortan la propagación. Para el teclado eso son cuatro paradas por tarjeta y un patrón ARIA inválido (interactivos anidados); para el pulgar, la zona derecha de la tarjeta alterna entre «seleccionar», «desmarcar del mapa», «favorito» y «abrir detalle» con 14 px de separación.
- **Por qué importa:** en una lista de resultados larga el usuario encadena toques rápidos; equivocarse en el corazón de la tarjeta de al lado se paga con una acción que no se puede deshacer (y que además no persiste, ver abajo).
- **Arreglo:** una sola acción primaria por tarjeta (abrir detalle) y las demás dentro de un menú de la tarjeta, o bien botones separados visualmente con 44 px y sin `role="button"` en el contenedor.
- **Comando:** `$impeccable adapt`

### [P1] El favorito no persiste y arranca con un lugar marcado
- **Qué pasa:** `likedIds` es estado local sembrado con `new Set(["6"])`; `onLike` solo alterna el Set. Al recargar, todo favorito desaparece; y el id `6` aparece guardado sin que nadie lo haya guardado.
- **Por qué importa:** la tarjeta promete una función que no existe. Es la clase de fallo que hace desconfiar de todo lo demás de la lista.
- **Arreglo:** persistencia real (almacén del usuario o `saved_places`) o quitar el botón hasta que exista.
- **Comando:** `$impeccable harden`

### [P1] El estado de la lista no se anuncia
- **Qué pasa:** la lista se vuelve a montar (`AnimatePresence` con `key="list"`) al pasar de búsqueda a resultados y el `badge` del encabezado cambia de número, pero nada es una región viva.
- **Por qué importa:** sin lector de pantalla, la búsqueda termina en silencio y el usuario no sabe si hay resultados, cuántos, ni que puede bajar la hoja.
- **Arreglo:** `role="status"` en el encabezado de la hoja («N resultados») y `aria-live="polite"` en el contenedor de la lista.
- **Comando:** `$impeccable audit`

### [P1] El banner de IA afirma un conteo que no es del gusto del usuario
- **Qué pasa:** sin resultados de IA el banner dice «encontré N lugares que podrían gustarte», donde N es `provinceScopedPlaces.length` (todo el catálogo de la provincia). Cuando hay resultados, en cambio, enseña el resumen real de la IA.
- **Por qué importa:** mezcla una cifra de inventario con una promesa de personalización; el usuario que ve «12 lugares que podrían gustarte» y luego abre la hoja con 30 entiende que el número era decorativo.
- **Arreglo:** dos textos distintos y honestos: «Hay N lugares en tu provincia» en reposo, y el resumen de la IA solo cuando hay respuesta.
- **Comando:** `$impeccable clarify`

### [P2] Metadatos opcionales que dejan la línea a medias
- **Qué pasa:** valoración, distancia y precio se pintan en la misma fila pero cada uno es opcional (`rating > 0`, `distance`, `price`). Sin valoración la fila empieza por un hueco de 3 px y sin ninguno de los tres queda una línea vacía con margen.
- **Por qué importa:** la línea que da contexto al nombre es lo primero que se lee; vacía o coja sugiere que faltan datos del negocio cuando el dato simplemente no aplica.
- **Arreglo:** pintar la fila solo si hay al menos un dato y omitir el margen inferior cuando no haya ninguno.
- **Comando:** `$impeccable layout`

### [P2] Etiquetas de 11 px y una pastilla «MLC» que nadie entiende
- **Qué pasa:** las etiquetas van a `text-[11px]` sobre `bg-sand-deep`; entre ellas «MLC», que es jerga de casa y no lo que dice la calle.
- **Por qué importa:** es el dato de pago, y se decide con prisa en la puerta del negocio. A 11 px y con sigla propia, se ignora.
- **Arreglo:** 12 px mínimo (`text-meta`) y la etiqueta con la palabra completa («Acepta MLC» o «Acepta USD clásica»).
- **Comando:** `$impeccable typeset`

## 6. Banderas rojas por persona

**Casey (móvil):** toca la tarjeta para ver el mapa y abre el detalle (o al revés); el corazón que pulsa no guarda nada; las tres acciones de la derecha son de 40 px y están a 14 px del borde del dedo.

**Sam (lector de pantalla):** «botón» con cuatro paradas, `aria-label="Favorito"` sin estado, lista que cambia sin aviso, imágenes del logo con `alt=""` (correcto, decorativo) pero sin texto alternativo del nombre en la miniatura.

**Jordan (primerizo):** no sabe si tocar la tarjeta o el círculo de la derecha; «MLC» no le dice nada; el conteo del banner no coincide con lo que ve al desplegar.

## 7. Observaciones menores

- `whileTap={{ scale: 1.35 }}` en el corazón es la animación más llamativa de la lista y la menos importante (un tap que agranda el icono un 35 %).
- `title="Ver en el mapa"` duplica el `aria-label` en el mismo botón: no aporta y añade un tooltip solo de escritorio.
- La tarjeta no tiene estado «cargando» propio cuando la foto del logo falla: el `Image` deja el fondo degradado y no se distingue de «sin logo».
- La hoja tiene un `h-10` de degradado inferior (`bottom-sheet.tsx`) que no se anuncia ni se puede saltar, bien como transición visual.
- El alto del asa no cambia entre estados: el `peek` de 120 px corta las primeras tarjetas a media altura.

## 8. Preguntas para considerar

- ¿La tarjeta necesita tres acciones, o el patrón correcto es «abrir» y dejar las demás dentro del detalle?
- ¿Guardar un lugar debería ser una acción de la tarjeta o del detalle, donde hay sitio para confirmarla?
- ¿Qué se enseña cuando no hay valoración? ¿Se omite la fila o se dice «Sin reseñas todavía»?
- ¿La hoja debe poder filtrar y ordenar, o su trabajo es solo mostrar lo que la IA eligió?

## Run Notes

- slug: `src-components-layout-place-card-tsx` · ignore.md: no existe.
- Independencia: **degradada** (`spawn_agent` no disponible).
- Detector CLI: `[]`, exit 0.
- Navegador: sin evidencia visual (el panel y las listas dependen del servidor, que en este entorno tarda ~90 s y sirve el fallback). Se revisó el código de la tarjeta, la hoja y la animación de búsqueda.
- Temporales: limpiados.
