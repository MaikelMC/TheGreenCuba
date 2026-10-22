---
target: panel de negocio completo (/business)
total_score: 27
p0_count: 0
p1_count: 3
timestamp: 2026-10-17T06-11-09Z
slug: src-components-business
---
# Crítica de diseño — Panel de negocio (todas las secciones)

**Objetivo:** el panel completo: `src/app/(main)/business/page.tsx`, `panel-shell.tsx` (armazón), `business-panel.tsx` (dashboard, editor de ficha, ajustes), `catalogo-view.tsx`, `publicaciones-view.tsx`, `plans-section.tsx`, `estadisticas-panel.tsx`, `logo-upload.tsx`, `photo-grid.tsx`, `menu-link-card.tsx`, `ofertas-editor.tsx`, `save-bar.tsx`, `dashboard-stats.tsx`.
**Registro:** `product`. **Referencias:** `PRODUCT.md`, `DESIGN.md`, `reference/product.md`, y las dos críticas anteriores del propio panel (2026-10-15 dashboard, 24/40) y del catálogo (2026-10-17).
**Nota:** la sección Catálogo se revisó por separado y **sus arreglos ya están aplicados** (ver `reportes/01-catalogo-panel-negocio.md`); este informe la da por resuelta y mira el resto del panel.

## 1. Design Health Score

| # | Heurística | Nota | Hallazgo clave |
|---|-----------|-------|----------------|
| 1 | Visibilidad del estado | 3 | Guardado con botón y spinner, toasts, skeletons de ruta. Falta anunciar secciones al cambiar y hay dos barras de guardado distintas. |
| 2 | Sistema y mundo real | 3 | «Hoy hay», «agotado hasta mañana», «energía de respaldo»: lenguaje de la calle. Cojea con el vocabulario entre superficies. |
| 3 | Control y libertad | 2 | El catálogo ya avisa y guarda borrador; el editor de ficha sigue perdiendo lo escrito al cambiar de sección. |
| 4 | Consistencia y estándares | 3 | `FormSection`, `Input`, `Select` y los tokens se reutilizan; quedan el `h-12` heredado y dos maneras de guardar. |
| 5 | Prevención de errores | 3 | El servidor vuelve a comprobar los candados del plan y las fotos avisan si fallan; la ficha no tiene guardia de salida. |
| 6 | Reconocer antes que recordar | 3 | Campos con `Label` visible en el editor y ayudas por sección; el catálogo ya tiene etiquetas y sugerencias. |
| 7 | Flexibilidad y eficiencia | 2 | Seis secciones, sin atajos, sin acciones en bloque; el armazón evita el coste de navegar entre rutas (buen acierto). |
| 8 | Estética y minimalismo | 3 | Superficies y hairlines del sistema, cero decoración; la ficha es muy larga. |
| 9 | Reconocer y recuperar errores | 2 | Errores por `role="alert"` y mensajes concretos; el editor los muestra en una sola franja. |
| 10 | Ayuda y documentación | 2 | Muy buenas ayudas por sección en el editor; el catálogo y los planes repiten explicaciones largas. |
| **Total** | | **27/40** | **Acceptable, cerca de bueno** |

## 2. Anti-patrones

**LLM:** el panel no parece generado. Reutiliza `FormSection`, `PaymentChips`, `IconPicker`, `Select` y los tokens de arena/verde; los estados de las tarjetas de plan no se inventan (las tarjetas de estadística **omiten** la pastilla de variación cuando no hay histórico, con el porqué escrito en el componente). El dashboard evita el «hero-metric»: no hay cifras inventadas ni flechas de tendencia sin datos.

Los dos tics que quedan son de proceso, no de estética: **un componente muerto** (`SaveBar`, referenciado solo en un comentario) y **comentarios que ya no describen el código** (`MobileDock` dice que lo comparten los tres armazones, y el panel usa un cajón lateral desde hace dos iteraciones).

**Detector:** `detect.mjs --json src/components/business` → `[]`, exit 0, sin hallazgos en todo el directorio.

## 3. Impresión general

Es el panel mejor resuelto del proyecto: una sección por tarea, ayudas que explican lo que el dueño no puede adivinar (la energía, el «hoy hay», el tope del plan), y ninguna métrica que no salga de la base. El catálogo, después de los arreglos de hoy, además no pierde trabajo. Lo que queda es lo mismo que le falta a la ficha que está al lado: la otra mitad del panel sigue tirando lo que se escribe si te vas sin guardar, y el usuario tiene que aprender dos formas de guardar en el mismo armazón.

## 4. Lo que funciona

1. **Los candados del plan se comprueban otra vez en el servidor.** El aviso del cliente es información, no permiso; está escrito y aplicado.
2. **Las métricas que no se pueden medir no se pintan.** `DashboardStats` acepta la variación como opcional y explica por qué no se inventa; el panel puede enseñar cifras pequeñas sin sentirse mentiroso.
3. **El armazón no navega entre rutas.** Las secciones son la misma página con `replaceState`, así que cambiar de pestaña no cuesta tres oleadas de consultas y el estado se conserva. El catálogo ya aprovecha eso para no perder lo escrito al irse a mirar los planes y volver.

## 5. Problemas prioritarios

### [P1] El editor de ficha pierde los cambios al cambiar de sección
- **Qué pasa:** `EditorView` guarda nombre, categoría, descripción, dirección, barrio, horario, pagos, energía, ofertas y ubicación en estado local, y solo los escribe con el botón de guardar. Al tocar otra sección del armazón el componente se desmonta y lo escrito se va. La guardia de salida ya existe y tiene módulo propio (`src/lib/unsaved-guard.ts`), pero **solo la registra el catálogo**.
- **Por qué importa:** es el mismo fallo que se acaba de arreglar en el catálogo, en la pantalla más larga del panel. El dueño que rellena su descripción y se va a mirar el plan pierde el texto, y el panel ya le enseñó que eso no pasa.
- **Arreglo:** que `EditorView` registre la misma guardia (con su propio mensaje) y añadir el borrador por sección, como en el catálogo. Es reutilizar lo que ya funciona, no inventar.
- **Comando:** `$impeccable harden`

### [P1] Dos formas distintas de guardar en el mismo armazón
- **Qué pasa:** el catálogo tiene barra propia con conteo de cambios y «Descartar»; la ficha se guarda con un botón (`Guardar` en la barra inferior del editor) y sus fotos se suben al instante (cada foto escribe en la base al elegirla); `SaveBar` existe sin usarse y el perfil usa un tercer patrón.
- **Por qué importa:** el mismo usuario tiene que aprender tres contratos de guardado en la misma sesión, y uno de ellos («subir foto ya la guarda, escribir texto no») es invisible hasta que se pierde algo.
- **Arreglo:** un único contrato por panel —barra con «N cambios sin guardar», «Descartar» y «Guardar»— y decir en el editor, junto a la rejilla de fotos, que esas sí se guardan al momento.
- **Comando:** `$impeccable polish`

### [P1] Los errores del editor viven en una sola franja
- **Qué pasa:** `EditorView` pinta `{error && …}` en una única posición con `role="alert"`, mientras la acción puede estar tres pantallas más abajo (`bizEnergia`, ofertas, horario). El texto es bueno y dice dónde mirar («Está en “Información básica”»), pero el error está lejos del campo.
- **Por qué importa:** es exactamente el patrón que se corrigió en el catálogo (tope junto al botón, fila marcada en rojo). Dejarlo en una pantalla y arreglarlo en la vecina produce dos comportamientos para el mismo problema.
- **Arreglo:** error en línea junto al control que lo provoca y un resumen junto al botón de guardar.
- **Comando:** `$impeccable clarify`

### [P2] Vocabulario todavía partido entre superficies
- **Qué pasa:** el panel dice «Catálogo» y «Ajustes»; el perfil dice «Configuración»; dentro del panel quedan textos que hablan de «la carta pública» y de «tu carta» en sitios que no se tocaron.
- **Por qué importa:** el vocabulario es parte del sistema de diseño; dos nombres para lo mismo frenan justo a quien menos experiencia tiene.
- **Arreglo:** cerrar el glosario («Catálogo» para lo que se vende, «Ajustes» para la configuración) y pasarlo por el panel, el perfil y el menú público.
- **Comando:** `$impeccable clarify`

### [P2] Componente muerto y comentarios desactualizados
- **Qué pasa:** `SaveBar` no se usa en ninguna pantalla (solo aparece nombrado en un comentario) y `MobileDock`/`panel-shell` describen un armazón que ya no es el que se usa.
- **Por qué importa:** es lo que hace que el siguiente que toque el panel dude de qué es la verdad: hay dos barras de guardado en el repo, una viva y una muerta.
- **Arreglo:** borrar `SaveBar` o usarlo en las tres superficies; actualizar los comentarios o sustituir el cajón por el dock.
- **Comando:** `$impeccable distill`

### [P2] La ficha es larga y la acción de guardar, única
- **Qué pasa:** el editor reúne fotos, información, ubicación, icono, horario, pagos, ofertas, energía, contacto y ajustes en una sola página con siete secciones y un único botón al final.
- **Por qué importa:** en el móvil son varias pantallas de scroll; si el dueño se pierde a mitad, no hay señal de que su trabajo sigue pendiente ni de cuánto falta.
- **Arreglo:** estado por sección («Completado» / «Falta el horario») en las cabeceras plegables y la barra de guardado siempre visible cuando haya cambios.
- **Comando:** `$impeccable layout`

## 6. Banderas rojas por persona

**Casey (móvil, a media tarea):** rellena la descripción, va a mirar el plan, vuelve y el texto no está; sube la foto y cree que no se guardó hasta que vuelve a entrar; el botón de guardar está al final de siete secciones.

**Sam (lector de pantalla):** cambiar de sección no mueve el foco ni anuncia la vista nueva; el error es una franja única que puede quedar a diez elementos de distancia del campo; las fotos y el logo suben sin anunciar el fin de la subida más allá del spinner.

**Jordan (primerizo):** «Hoy hay» sigue siendo dos círculos sin texto (con `title` que no llega en táctil); «Ajustes», «Configuración» y «Publicar» conviven sin decir cuál es cuál; el tope del plan se explica en tres sitios con tres frases.

## 7. Observaciones menores

- El armazón tiene seis secciones: entra en el límite de memoria de trabajo (≤5 recomendado) pero ya deja fuera «Estadísticas», que vive dentro del dashboard.
- Los `Label` del editor usan el `Input` heredado con `h-12`; el catálogo acaba de bajar a `h-11` con 16 px en móvil: conviene unificar el contrato de campos.
- `IconPicker`, `PaymentChips` y `PhotoGrid` están en `components/business` y se usan también en administración: son de sistema, y su sitio sería `components/ui`.
- Los avisos conviven en tres mecanismos (`sonner`, `sileo` y el toast propio del `SaveBar`).
- `bg-sand-deep/50` y `bg-verde-50` se alternan para el mismo tipo de aviso informativo (tope del plan, borrador, ayuda).
- La cabecera del panel ya tiene blancos de 44 px; el dock móvil y el cajón lateral usan geometrías distintas para el mismo grupo de secciones.

## 8. Preguntas para considerar

- ¿El panel debería tener **una** barra de guardado para todas las secciones, con conteo y descarte?
- ¿Las fotos deben guardarse al instante o esperar al botón, como el resto de la ficha?
- ¿Qué secciones son de verdad tareas separadas y cuáles son partes de «Editar ficha»?
- ¿El dueño necesita ver «completado / falta» por sección, o el panel debería decirle qué le falta a su ficha para salir mejor en las búsquedas?

## Run Notes

- slug: `src-components-business` · ignore.md: no existe.
- Independencia: **degradada** (`spawn_agent` no disponible en esta sesión).
- Detector CLI: `[]`, exit 0 en todo el directorio `src/components/business`.
- Navegador: sin evidencia visual (la identidad de desarrollo no tiene negocio: `/business` redirige a la pantalla de alta; y el servidor de este entorno tarda ~90 s en servir el fallback). Todo el informe se apoya en el código y en las crónicas de las dos críticas anteriores del panel.
- Arreglos ya aplicados en esta pasada (sección Catálogo): quitar foto en táctil, campos de 16 px con teclado decimal, blancos de 44 px, contraste de las pastillas, `Select` de Radix, errores en línea, vocabulario «Catálogo», borrador en `localStorage`, guardia al cambiar de sección y `beforeunload`.
- Temporales: limpiados.
