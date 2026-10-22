---
target: home (mapa + buscador + hoja de recomendaciones)
total_score: 25
p0_count: 0
p1_count: 4
date: 2026-10-17
slug: src-app-main-home-page-tsx
---

# Crítica de diseño — Home

**Objetivo:** `src/app/(main)/home/page.tsx` (1580 líneas) con `src/components/layout/header.tsx`, `bottom-sheet.tsx`, `category-bar.tsx`, `mobile-dock.tsx`, `searching-animation.tsx`, `src/components/place/place-filters.tsx`.
**Registro:** `product`. **Referencias:** `PRODUCT.md`, `DESIGN.md`, `reference/product.md`.
**Estado:** informe, sin cambios de código en este pase.

## 1. Design Health Score

| # | Heurística | Nota | Hallazgo clave |
|---|-----------|-------|----------------|
| 1 | Visibilidad del estado | 2 | Skeletons y spinner sí; el cambio de resultados de la hoja no se anuncia y la animación de búsqueda es muda para un lector de pantalla. |
| 2 | Sistema y mundo real | 3 | «Cercanos», «Con corriente», «Hoy hay» hablan del barrio. El subtítulo por defecto de resultados es texto de ejemplo inventado. |
| 3 | Control y libertad | 3 | Bajar la hoja, cerrar ruta, quitar filtros. Falta deshacer el «favorito», que además no se guarda. |
| 4 | Consistencia y estándares | 2 | Escala de `z-index` arbitraria (5, 20, 30, 250, 300, 400) y chips del mapa sin foco visible. |
| 5 | Prevención de errores | 3 | Filtros controlados y deshabilitados con motivo, permiso de ubicación con aviso. |
| 6 | Reconocer antes que recordar | 3 | Historial + sugerencias + direcciones en el buscador; skeletons con forma. |
| 7 | Flexibilidad y eficiencia | 2 | Sin atajos; la barra de categorías y la de filtros compiten sin jerarquía. |
| 8 | Estética y minimalismo | 3 | Limpio y con tokens; demasiadas capas flotantes a la vez sobre el mapa. |
| 9 | Reconocer y recuperar errores | 2 | El estado de error es correcto, pero el texto del permiso de ubicación habla de un candado de escritorio. |
| 10 | Ayuda y documentación | 2 | Los filtros explican su motivo con `title`, que no existe en táctil. |
| **Total** | | **25/40** | **Acceptable** |

## 2. Anti-patrones

**LLM:** no parece hecho por una IA. Sin degradados decorativos, sin eyebrows numerados, sin ghost-cards: los bordes son `border-ink/5` con sombras del sistema (`shadow-soft`, `shadow-card`, `shadow-primary-halo`), y los radios de superficie son 16 px. La voz es del barrio. El problema no es slop, es **densidad de capas**: sobre el mapa conviven barra de categorías, chips de filtros, columna de campana + tema, botón de ubicación, dock y hoja, cada uno con su propia animación de entrada.

**Detector:** `detect.mjs --json src/app/(main)/home/page.tsx` → `[]`, exit 0 (sin hallazgos de markup).

## 3. Impresión general

Es una pantalla con criterio: la búsqueda en lenguaje natural con el catálogo que viaja con distancia, el horario y la carta es la mejor parte del producto, y el home la enseña sin explicarla de más. Lo que falla no es la idea, son tres detalles de confianza —un subtítulo inventado, un corazón que no guarda nada— y un piso de accesibilidad (anuncios, foco, blancos táctiles) que arrastra el resto.

## 4. Lo que funciona

1. **Los skeletons tienen la forma exacta de las tarjetas** y el contenedor lleva `aria-busy`: no hay salto de maquetación y el estado de carga es legible.
2. **Los filtros del mapa son controlados y se deshabilitan con motivo**: «Cercanos» se apaga sin ubicación en vez de encenderse sin efecto, y el componente ya no guarda su propio estado.
3. **El buscador reúne historial, sugerencias del catálogo y direcciones** en un mismo desplegable, cada bloque con su rótulo y sin secciones vacías.

## 5. Problemas prioritarios

### [P1] El subtítulo de resultados es contenido inventado
- **Qué pasa:** `SHEET_TITLES.results.subtitle` es la cadena literal `"4 cafés tranquilos en Santiago"` (`home/page.tsx`, línea 243). Solo se sustituye cuando `searchingQuery` no está vacío; en cualquier otro camino que llegue a `results` —o tras recargar con la hoja abierta— el dueño de la pantalla lee una cifra y una ciudad que nadie midió.
- **Por qué importa:** es exactamente lo que `PRODUCT.md` prohíbe («una cifra que no se puede comprobar no se enseña») y lo que ya se corrigió una vez en el panel («342 visitas, +18%»). Que vuelva por el subtítulo es la misma mentira con otro traje.
- **Arreglo:** quitar el texto de ejemplo y caer a «Lugares cerca de ti» o, mejor, al conteo real (`{shownCount} lugares`). Añadir una prueba que falle si un subtítulo no depende de datos.
- **Comando:** `$impeccable clarify`

### [P1] El «favorito» no guarda nada y arranca con un lugar ya guardado
- **Qué pasa:** `likedIds` es un `useState` local inicializado con `new Set(["6"])` (`home/page.tsx`, 527) y `handleLike` solo alterna ese Set. No hay `localStorage` ni endpoint: el corazón se enciende, se apaga y se pierde al salir de la pantalla; y el id `"6"` viene marcado sin que nadie lo haya guardado.
- **Por qué importa:** es una función que parece funcionar y no funciona (la peor clase de fallo del `stress tester`), y en La Verde «guardar» es la señal de intención más fuerte que da el usuario.
- **Arreglo:** persistir en el almacén del usuario (hay `places-view` y `saved_places` en camino) o, mientras no exista, quitar el botón: un corazón muerto cuesta más que su ausencia. Nunca sembrarlo con ids fijos.
- **Comando:** `$impeccable harden`

### [P1] La hoja de resultados no se anuncia y la búsqueda es muda
- **Qué pasa:** el progreso de búsqueda rota cinco mensajes (`searching-animation.tsx`) dentro de un `AnimatePresence` sin `aria-live`; la lista de resultados se sustituye por completo sin región viva y el contador del encabezado (`badge`) cambia en silencio.
- **Por qué importa:** con lector de pantalla, buscar es pulsar Enter y no oír nada hasta que el foco se mueva a mano. `PRODUCT.md` pide estados de carga explícitos y avisos claros.
- **Arreglo:** `role="status"` en el contenedor de mensajes de búsqueda y en el encabezado de la hoja, y anunciar «N resultados para “consulta”» al terminar.
- **Comando:** `$impeccable audit`

### [P1] El permiso de ubicación se explica con un candado de escritorio
- **Qué pasa:** el error por permiso denegado dice «Habilítalo en el candado junto a la URL y recarga» (`home/page.tsx`, ~1237). En el móvil —el caso mayoritario— ese candado no existe: en iOS se va a Ajustes, en Android al candado del sitio en el menú del navegador.
- **Por qué importa:** el dueño o el visitante se queda sin mapa centrado y con una instrucción que no puede seguir; el buscador sigue funcionando, así que la persona cree que la app está rota a medias.
- **Arreglo:** un aviso por plataforma y, sobre todo, un camino de salida: elegir la ciudad a mano (ya existe el selector de preferencias) desde el propio aviso.
- **Comando:** `$impeccable clarify`

### [P2] Escala de `z-index` arbitraria en toda la pantalla
- **Qué pasa:** conviven `z-[5]`, `z-20`, `z-30`, `z-50`, `z-200` (cabecera del panel), `z-250` (desplegable del buscador), `z-[300]` (chip de ruta) y `z-[400]` (superposición de detalle).
- **Por qué importa:** cada capa nueva hay que negociarla con un número inventado; el desplegable del buscador (`z-250`) y el chip de ruta (`z-[300]`) ya están en orden discutible y cualquier sección nueva puede tapar la hoja. Es la clase de deuda que hace que un aviso deje de verse sin que nadie sepa por qué.
- **Arreglo:** una escala semántica en los tokens (`--z-dropdown`, `--z-sticky`, `--z-sheet`, `--z-modal`, `--z-toast`, `--z-tooltip`) y usarla en todas las capas.
- **Comando:** `$impeccable layout`

### [P2] Blancos táctiles y foco en las filas de chips
- **Qué pasa:** los chips de categoría (`py-2`, 14 px de texto ≈ 36 px de alto) y los de filtros quedan por debajo de los 40 px que el design system pide para un chip, y ninguno de los dos conjuntos tiene anillo de foco propio (el dock sí lo tiene: `focus-visible:ring-2`).
- **Por qué importa:** son los controles que más se pulsan con el pulgar y los que más se equivocan; y con teclado, el foco cae en un estilo del navegador que no dice nada del sistema.
- **Arreglo:** 40 px de alto mínimo y el mismo `focus-visible:ring-2 ring-verde-400/40` que ya usan el dock y el panel.
- **Comando:** `$impeccable adapt`

### [P2] El motivo de un filtro deshabilitado solo existe en `title`
- **Qué pasa:** «Cercanos» se deshabilita sin ubicación y explica el porqué con `title` (`place-filters.tsx`). Un elemento `disabled` no recibe foco y en táctil no hay tooltip, así que el motivo no llega a nadie.
- **Por qué importa:** un chip apagado sin razón se lee como error de la app, justo en el filtro que más se quiere usar al abrir.
- **Arreglo:** texto visible junto a la fila («Activa tu ubicación para filtrar por cercanía») o chip que abre el permiso en vez de apagarse.
- **Comando:** `$impeccable clarify`

## 6. Banderas rojas por persona

**Casey (móvil, interrumpida):** pulsa el corazón de una tarjeta, cierra la app, vuelve y el favorito no está; recibe un aviso de ubicación que le manda a un candado que su navegador no tiene; y con el pulgar en la fila de chips roza el filtro vecino cuando quería «Abiertos ahora» (chips de ~37 px de alto).

**Sam (lector de pantalla):** busca y no oye ni el progreso ni el resultado; el `role="button"` de cada tarjeta contiene tres botones reales (mapa, favorito, detalle), así que tabular entra y sale de una región anunciada como botón con botones dentro; el corazón se anuncia siempre «Favorito», sin estado.

**Jordan (primerizo):** ve tres filas de controles flotantes sobre el mapa sin saber cuál manda; el subtítulo de resultados le dice «4 cafés tranquilos en Santiago» aunque no haya buscado nada.

## 7. Observaciones menores

- El aviso de sesión (`showSessionNotice`) es un toast de dos líneas con `sessionStorage` de por medio: cabe en una frase.
- `DetailOverlay` usa `z-[400]`, por encima de la hoja y de la cabecera; con la hoja abierta el orden visual depende de números a mano.
- Los chips de filtro y categoría no comparten componente, así que sus estilos ya divergen (36 vs 40 px, uno con `aria-pressed` y `title`, otro sin nada).
- `searching-animation` reinicia su intervalo cada vez que se monta y no respeta `prefers-reduced-motion` (el CSS solo cubre dos reglas en `globals.css`).
- El buscador del header y el de la hoja son el mismo campo: el foco se queda en el header y la hoja cambia debajo, sin mover el foco al resultado.
- La campana y el interruptor de tema comparten columna en la esquina (`right-gutter top-[110px]`) con separación de 10 px: 12 px evita el toque cruzado.

## 8. Preguntas para considerar

- ¿El corazón debe existir antes de que exista el guardado real, o conviene retirarlo hasta que persista?
- ¿Cuál de las tres filas flotantes del mapa es la principal: categorías, filtros o la hoja; y cuáles podrían vivir dentro de la hoja?
- ¿Qué debería decir el home cuando la ubicación está denegada: un aviso o un selector de ciudad en el sitio del error?
- ¿Los chips de categoría y filtro son el mismo control? Si lo son, ¿por qué no el mismo componente?

## Run Notes

- slug: `src-app-main-home-page-tsx` · ignore.md: no existe.
- Independencia de evaluaciones: **degradada** (`spawn_agent` no disponible en esta sesión; A y B en secuencia).
- Detector CLI: `[]`, exit 0, sin hallazgos.
- Navegador: intentado con Chrome headless + CDP y cookie de `/dev-login`. `/business` quedó en `Cargando…` (servidor de 90,4 s sirviendo el fallback) y el home no se inspeccionó en vivo por el mismo motivo (el catálogo del mapa llega del servidor). Sin evidencia visual; el informe se apoya en el código.
- Overlay: no ejecutado (sin página estable). Live-server propio: no se arrancó. Temporales: limpiados.
