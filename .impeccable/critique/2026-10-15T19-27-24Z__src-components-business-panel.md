---
target: dashboard del panel de negocio (/business)
total_score: 26
p0_count: 0
p1_count: 5
timestamp: 2026-10-15T19-27-24Z
slug: src-components-business-panel
---
# Crítica y auditoría — Dashboard del panel de negocio (`/business`)

**Fecha:** 2026-10-15
**Alcance:** `src/app/(main)/business/*`, `src/components/business/*`
**Objetivo revisado:** el dashboard del panel (`PanelShell` + `DashboardView` y sus tarjetas), con el armazón de navegación incluido porque es lo que lo contiene y lo que se toca para moverse entre secciones.
**Estado:** informe. **Sin cambios de código aplicados.**
**Registro:** `product` (design SERVES the product) · **Referencias:** `PRODUCT.md`, `DESIGN.md`, `AGENTS.md`, `CLAUDE.md`

---

## 1. Alcance y método

Archivos leídos íntegros:

| Archivo | Papel |
|---|---|
| `src/app/(main)/business/page.tsx` | Resolución en servidor: negocio, stats, plan, funciones, módulos, catálogo |
| `src/app/(main)/business/layout.tsx` | Puerta de sesión + `force-dynamic` |
| `src/components/business/panel-shell.tsx` | Armazón: cabecera, barra lateral, cajón móvil, cambio de vista |
| `src/components/business/business-panel.tsx` | Las seis vistas del panel (1747 líneas) |
| `src/components/business/dashboard-stats.tsx` | Las cuatro tarjetas del dashboard |
| `src/components/business/estadisticas-panel.tsx` | Cifras del mes, filas de cifras, candados |
| `src/components/business/plan-card.tsx`, `menu-link-card.tsx` | Tarjetas del dashboard |
| `src/components/business/business-switcher.tsx`, `form-section.tsx`, `mini-chart.tsx` | Selector de negocio, acordeón, gráfico |

Más: `tailwind.config.ts`, `DESIGN.md` (§2–3), `src/app/globals.css` (overrides de modo oscuro del panel), `src/components/ui/input.tsx`, `select.tsx`, `src/app/(main)/layout.tsx`, `src/components/layout/user-menu.tsx`.

**Cómo se verificó cada afirmación**

1. **Lectura de código.** Todo hallazgo de este informe lleva archivo y línea o clase exacta. No hay hallazgos «de sensación».
2. **Contraste calculado, no estimado.** Cada par de la §13 se calcula con la fórmula WCAG 2.x (luminancia relativa sRGB, `oklch` convertido a sRGB por las matrices Oklab estándar). Los ratios con «≈» son los que dependen de una conversión; los que van sin «≈» son hex puros del `tailwind.config.ts`.
3. **Detector determinista.** `node .agents/skills/impeccable/scripts/detect.mjs --json` sobre los nueve archivos del panel: **`[]`, 0 hallazgos, exit 0**. Verifiqué que el detector no es un no-op: con un archivo sonda propio (`bg-clip-text` + `from-purple-500`, `border-l-4`, `backdrop-blur-xl`) devuelve 3 anti-patrones y sale con **exit 2**. La limpieza es real, no un detector dormido. La sonda se borró después.
4. **Sin evidencia de navegador.** `CLAUDE.md` §38 lo prohíbe expresamente («No conduzcas el navegador. Nunca. Ni con herramientas ni con capturas»). Por tanto **no hay medición de rendimiento en runtime, ni capturas, ni overlays**. Lo que dependa de medir píxeles en vivo queda marcado como **pendiente de verificar en dispositivo**.

---

## 2. Design Health Score (crítica)

| # | Heurística | Nota | Hallazgo clave |
|---|-----------|-------|----------------|
| 1 | Visibilidad del estado | 2 | Guardado excelente (spinner + toast + rollback). Pero no hay `loading.tsx` en la ruta y el cupo sin leer se pinta como «—», igual que un fallo |
| 2 | Sistema ↔ mundo real | 4 | «Tu carta», «Cómo apareces», «Hoy hay», «Guardados». Habla como el mostrador, no como un panel |
| 3 | Control y libertad | 2 | Sección sin URL: el botón atrás sale del panel y recargar vuelve al dashboard. El cajón no cierra con Escape. «Liberar cupo» borra sin confirmación ni deshacer |
| 4 | Consistencia y estándares | 3 | Un solo armazón para los dos paneles. Pero «Ver planes» mide 40 px en un sitio y 44 en otro, y el `Switch` no comparte el vocabulario de foco del resto |
| 5 | Prevención de errores | 3 | La validación nombra la sección, el interruptor se deshace si el servidor dice que no, el WhatsApp se normaliza. Falta en «Liberar cupo» |
| 6 | Reconocer antes que recordar | 2 | Las seis secciones solo viven en el nav (nada en la URL) y el acordeón esconde qué secciones están rellenas |
| 7 | Flexibilidad y eficiencia | 2 | Sin atajos, sin búsqueda, sin acciones en bloque, sin «descartar cambios» |
| 8 | Estético y minimalista | 2 | **Tres capas de métricas** antes de cualquier acción, sobre siete superficies idénticas |
| 9 | Recuperación de errores | 3 | «no se cambió nada» es ejemplar y hay rollback. El cupo falla en silencio: «—» sin decir por qué |
| 10 | Ayuda y documentación | 3 | Cada sección explica para qué sirve su función y por qué importa. Sin guía de primera vez dentro del panel |
| **Total** | | **26/40** | **Aceptable** — mejoras significativas antes de que el dueño esté contento |

---

## 3. Audit Health Score (auditoría técnica)

| # | Dimensión | Nota | Hallazgo clave |
|---|-----------|-------|----------------|
| 1 | Accesibilidad | 2 | El cajón móvil no es un diálogo: sin `role="dialog"`, sin `aria-modal`, sin Escape, sin trampa de foco. Texto de error a 3,81:1 |
| 2 | Rendimiento | 3 | Panel resuelto en servidor, detector limpio. Pero el cambio de sección tarda ~800 ms y `PanelShell` pide `/api/me` para un dato que ya tiene |
| 3 | Responsive | 3 | Estructura responsive real (barra lateral ↔ cajón) y padding ajustado a mano. Seis blancos táctiles por debajo de 44 px |
| 4 | Theming | 3 | Tokens de punta a punta; el modo oscuro tiene overrides explícitos para `.business-panel`. Fuga: `amber-*` de Tailwind y `z-40`/`z-50` a mano |
| 5 | Anti-patrones | 3 | Borde de 1 px + sombra de 24 px de difusión en las siete superficies, y cuatro tarjetas de métrica idénticas. Sin degradados, sin cristal, sin franjas |
| **Total** | | **14/20** | **Bueno** (atacar las dimensiones débiles) |

---

## 4. Veredicto anti-patrón

**No parece hecho por una IA, pero sí se parece demasiado a sí mismo.**

**Evaluación propia.** No hay ni un solo elemento de la lista de prohibiciones duras: sin texto con degradado, sin franjas laterales de color, sin cristal decorativo (el `backdrop-blur` de la cabecera es el uso legítimo: una barra pegajosa que tapa contenido al desplazarse), sin plantilla de métrica gigante con degradado, sin SVGs dibujados a mano, sin `repeating-linear-gradient`. El copy es específico y no tiene una sola palabra de la familia *streamline / potenciar / sin fricciones*. Los comentarios del código razonan contra casos reales (un propietario que acaba de registrar su negocio, un número que no se puede comprobar), no contra un brief genérico.

Tres cosas que **sí** son tics y no deberían pasar el filtro, aunque ninguna sea de la lista dura:

- **El «fantasma» repetido siete veces.** Cada superficie del dashboard es `rounded-2xl border border-ink/5 bg-white shadow-soft`. `shadow-soft` es `0 1px 2px` **más** `0 8px 24px -12px`: un borde de 1 px con una sombra de 24 px de difusión en el mismo elemento. Es exactamente el patrón borde+sombra ancha que el registro *product* marca como defecto; en una superficie suelta es un matiz, repetido en siete tarjetas seguidas es la textura de toda la pantalla. Se cuenta en el dashboard: `DashboardStats` (4), «Cómo apareces», «Lo que puedes hacer ahora», `MenuLinkCard`, `PlanCard`, `EstadisticasPanel` (`Cifras` ×2, `TopProductos`, la tarjeta del mes), `MiniChart`.
- **Rejilla de tarjetas idénticas, sin excepción.** Las cuatro tarjetas de `DashboardStats` son el mismo cuadrado con la misma estructura. Aquí **no** es un error de marketing —cuatro cifras comparables piden cuatro marcos iguales—, pero el dashboard entero es *sólo* eso: cuadrados del mismo tamaño uno debajo de otro.
- **Tipografía fluida en una UI de producto.** `text-[clamp(28px,6vw,36px)]` en el número de cada tarjeta. El registro product lo dice explícito: escala fija en `rem`, no `clamp`, porque una cifra que encoge en una barra lateral se lee peor, no mejor. Los usuarios ven la misma pantalla siempre.

**Escaneo determinista.** `detect.mjs` sobre los nueve archivos del panel: **0 hallazgos** (exit 0), validado con sonda propia (exit 2, 3 anti-patrones). El detector no cubre la familia «borde + sombra ancha» ni la escala fluida; esos dos salen de mi lectura, no del escáner.

**Superposiciones visuales.** Ninguna. `CLAUDE.md` §38 prohíbe conducir el navegador, así que no hubo inyección, ni overlay, ni pestaña **\[Human\]**. La evidencia es lectura de código y cálculo de contraste.

---

## 5. Impresión general

El panel hace lo difícil bien: se resuelve en el servidor, no miente con ninguna cifra, y habla en el idioma del dueño. La deuda no está en lo que enseña sino en **cómo se navega y cómo aparece**: entrar en «Catálogo» cuesta 800 ms de pantalla vacía, el cajón del móvil no tiene salida con teclado, y el dashboard enseña tres bloques de números antes de proponer una sola acción.

La mayor oportunidad, en una frase: **el dashboard debe abrir con la tarea, no con el marcador.** Hoy lo primero que ve alguien que entra desde el móvil a comprobar si su ficha está bien son ocho cifras repartidas en tres bloques; la lista de «Lo que puedes hacer ahora» —que es la razón por la que vino— está a media pantalla de scroll.

---

## 6. Lo que funciona

1. **Cero datos inventados, y está razonado en el propio archivo.** El comentario de `business-panel.tsx` explica que aquí había «342 visitas, +18%», «87 clics» y «156 recomendaciones IA» escritos a mano, y que se retiraron porque no existe tabla que los registre. `dashboard-stats.tsx` hizo `change` **opcional** para que un panel sin histórico no pueda pintar una flechita de tendencia. Es la regla 3 de `PRODUCT.md` cumplida con el tipo, no con la disciplina de quien escribe.
2. **El estado de guardado es de verdad optimista y reversible.** `alternarPedidos` y `alternarReservas` pintan el estado nuevo, mandan, y **devuelven el interruptor** si el servidor dice que no, con un toast que dice que no se cambió nada. Un interruptor que se queda en «sí» tras un fallo es peor que no tener interruptor, y aquí está resuelto.
3. **Los candados tienen puerta y explican el precio de la puerta.** `EstadisticasPanel` no enseña un candado mudo: enseña qué te pierdes («El gráfico día a día, tus 5 productos más vistos y las reservas») y un botón «Ver planes» que navega dentro del panel, sin recargar la página. Y el recorte lo hace el **servidor** (`statsVisitas`), no el cliente, con el razonamiento correcto: un número que viaja al navegador ya se puede leer aunque no se pinte.
4. **La validación nombra la sección, no el campo.** `save()` no dice «falta el nombre»: dice «El nombre del negocio no puede quedar vacío. **Está en «Información básica»**», en una pantalla donde las nueve secciones están plegadas. `sectionMessage()` formaliza esa idea para los dos formularios del proyecto.

---

## 7. Hallazgos por severidad

### P1 — Mayores (arreglar antes de publicar)

#### [P1] El cambio de sección deja la pantalla vacía ~800 ms

- **Qué.** `panel-shell.tsx` envuelve la vista activa en `<AnimatePresence mode="wait">` con `initial={{ opacity: 0, y: 12 }}`, `exit={{ opacity: 0, y: -12 }}` y `duration: 0.4` en las dos direcciones. Con `mode="wait"`, la vista nueva **no se monta** hasta que la vieja termina de salir: 400 ms de la vista anterior desvaneciéndose y 400 ms de la nueva entrando desde `opacity: 0`.
- **Por qué importa.** Pasa en **cada** cambio de sección: Dashboard ↔ Catálogo ↔ Editar ↔ Publicar ↔ Planes ↔ Ajustes. Para quien viene a resolver una tarea de dos minutos, cada salto cuesta casi un segundo mirando al vacío. Contra dos reglas escritas del proyecto: `PRODUCT.md` §Movimiento («El contenido nunca queda oculto esperando una animación») y el registro *product* («150–250 ms en la mayoría de las transiciones; los usuarios están en flujo, no los hagas esperar por la coreografía»), más «sin secuencias de carga orquestadas».
- **Arreglo.** Quitar `mode="wait"` y solapar: la vista nueva entra a `opacity: 1` mientras la vieja sale, con 180–220 ms y sin desplazamiento vertical (o `y: 6` a lo sumo). Si se quiere conservar el `y`, que sea `initial={{ opacity: 0 }}` sobre contenido ya visible. Y el `key={activeView}` del contenedor de motion debe quedarse: la vista cambia de verdad.
- **Comando.** `$impeccable animate`

#### [P1] El texto de error y el de sección inválida están por debajo de 4,5:1

- **Qué.** El aviso de error del editor es `text-meta` (12 px) `font-medium` en `text-destructive` sobre `bg-destructive/10` → **3,81:1**. Y la cabecera de sección marcada como inválida es `text-body` (16 px) `font-semibold` en `text-destructive` sobre `bg-destructive/5` → **4,08:1**. Ninguno de los dos llega al mínimo de 4,5:1 que pide AA para texto no grande (16 px semibold no cuenta como «large text»: hacen falta 18,66 px en negrita o 24 px). `PRODUCT.md` §Accesibilidad pide aún más: «secundario ≥4.5:1».
- **Ubicación.** `business-panel.tsx`: el `<motion.p>` del editor (~línea 862) y el de `SettingsView`; `form-section.tsx`: el `text-destructive` de la cabecera y del chevron.
- **Por qué importa.** Justo el texto que existe para decirte que algo salió mal es el menos legible de la pantalla. Y en un móvil a pleno sol —el caso de uso declarado— un rojo a 3,8:1 es prácticamente gris. Un octavo de la población masculina con deuteranomalía lo distingue peor todavía.
- **Arreglo.** Mantener el fondo teñido y subir la tinta: `text-destructive` no vale como color de texto a 12 px. Cambiar el texto a un rojo más oscuro (una parada más abajo) o, más barato y sin token nuevo, a `text-ink` sobre el mismo `bg-destructive/10` dejando el rojo al borde y al icono. El rojo se lee como «error» por el fondo y el icono, no por el texto.
- **Comando.** `$impeccable audit`

#### [P1] El cajón móvil no es un diálogo para el teclado ni para el lector de pantalla

- **Qué.** El cajón de `panel-shell.tsx` es un `<motion.div class="fixed inset-0 z-50">` con un velo y un panel. Le falta **todo**: no hay `role="dialog"`, ni `aria-modal="true"`, ni `aria-labelledby` (el «Secciones» que se ve está suelto), ni cierre con **Escape**, ni **trampa de foco** (el foco se queda detrás, en la cabecera y en el contenido de la página), ni movimiento del foco al abrir, ni devolución del foco al cerrar, ni bloqueo del scroll de fondo. El botón que lo abre ya declara `aria-expanded`, así que la intención está; falta la otra mitad.
- **Por qué importa.** Para quien navega con teclado o con lector, abrir el menú en un móvil es un callejón: el foco sigue por los enlaces de la página de detrás sin que nada lo anuncie, y no hay tecla que cierre. `PRODUCT.md` §Accesibilidad fija 44 px y contraste, pero un menú del que no se puede salir con teclado incumple el nivel A igual. Nota: el panel de **administración** usa el mismo cajón, así que el arreglo vale para los dos.
- **Arreglo.** Renderizarlo como el diálogo del sistema (Radix `Dialog` ya está en el proyecto: lo usa `dialog.tsx` y lo usó la carta con trampa de foco y Escape, según el informe anterior) o, como mínimo: `role="dialog"` + `aria-modal` + `aria-labelledby` sobre el «Secciones», un `useEffect` con `Escape` → `setDrawerOpen(false)`, foco inicial al primer item del nav, foco de vuelta al botón hamburguesa al cerrar, y `overflow: hidden` en el `body` mientras esté abierto.
- **Comando.** `$impeccable harden`

#### [P1] La ruta no tiene estado de carga: el panel es un hueco blanco

- **Qué.** `/business` no tiene `loading.tsx`. La ruta es `force-dynamic`, encadena tres oleadas de consultas —`ownerPlaces`, luego seis en paralelo, luego `statsVisitas`— y `CLAUDE.md` documenta el error real que producía el prerender. No hay esqueleto de ningún tipo. Compare: `/admin` **sí** tiene `loading.tsx`.
- **Por qué importa.** Es el caso declarado del producto: dueño en el móvil, datos caros, cobertura mala. Hoy eso es una pantalla en blanco sin señal de vida hasta que responden las consultas, y `PRODUCT.md` §Accesibilidad pide «skeletons sin salto de maquetación». Un esqueleto con las mismas medidas de la cabecera, las cuatro tarjetas y los dos paneles hace que la pantalla se sienta instantánea y evita el salto de maquetación al llegar los datos.
- **Arreglo.** `src/app/(main)/business/loading.tsx` con la cabecera (alto `h-header`), una rejilla `grid-cols-2 lg:grid-cols-4` de cuatro bloques `rounded-2xl bg-white/60` de la misma altura que las tarjetas reales, y dos bloques `lg:col-span-2`. Al ser server component sin cliente, cero JavaScript.
- **Comando.** `$impeccable harden`

#### [P1] Seis blancos táctiles por debajo de 44 px, y tres de ellos en la cabecera

- **Qué.** Medidos en el código:

  | Elemento | Tamaño | Archivo |
  |---|---|---|
  | Volver al inicio (flecha) | 36×36 (`size-9`) | `panel-shell.tsx` |
  | Abrir menú (hamburguesa) | 36×36 (`size-9`) | `panel-shell.tsx` |
  | Cerrar menú (X del cajón) | 40×40 (`size-10`) | `panel-shell.tsx` |
  | Item de sección (barra lateral) | ~40 px de alto (`py-[10px]` + icono 20) | `panel-shell.tsx` |
  | «Ver planes» del candado | **40 px** (`h-10`) | `estadisticas-panel.tsx` |
  | Interruptor de pedidos/reservas | 48×**28** (`h-[28px]`) | `business-panel.tsx` |

  El resto del sistema lo hace bien: `Input` y `SelectTrigger` son `h-12` (48 px), los botones principales `h-11` (44 px), el menú de cuenta 44 px. Los que fallan son los del armazón y el candado.
- **Por qué importa.** `PRODUCT.md` fija «44×44 px mínimo» y el panel lo incumple donde más se toca: dos de los seis son la **única** forma de abrir el menú y de volver atrás en móvil. Y el `Switch` a 28 px de alto es el control de un ajuste que el dueño usa de pie, con el dedo.
- **Arreglo.** `size-11` en la flecha y en la hamburguesa, `size-11` en la X del cajón, `h-11` en el «Ver planes» del candado (igual que el de `PlanCard`, que ya está bien y hace lo mismo con dos tamaños distintos). Para el `Switch`, subir el área tocable sin cambiar el dibujo: `py-2` en el botón y el carril de 28 px dentro, o `after:absolute after:-inset-y-2` (blanco táctil de 44 px) manteniendo 28 px visibles.
- **Comando.** `$impeccable adapt`

---

### P2 — Menores (siguiente pasada)

#### [P2] Tres capas de métricas antes de una sola acción

- **Qué.** El dashboard apila, en orden: (1) cuatro tarjetas `DashboardStats` (Guardados, Reseñas, Fotos, Valoración), (2) la tarjeta del mes de `EstadisticasPanel`, (3) la fila `Cifras` de visitas y llamadas… y luego dos tarjetas de texto y el QR. Son **ocho cifras en tres bloques con tres formas distintas** (cuadrado, banda verde, fila de cuatro) antes de que el dueño vea nada que pueda hacer.
- **Por qué importa.** `PRODUCT.md` se declara en contra de esto con nombre propio: «El SaaS genérico. Dashboards con cifras que van en un cuadrado blanco con una flechita de tendencia». Y la regla 4: «Una pantalla, una tarea». Además las tres capas no miden lo mismo ni se comparan: dos son de la ficha (cuánta gente guardó, cuántas reseñas), una es de tráfico del mes. Tres formas para tres escalas distintas obliga a leerlas todas para saber cuál importa, cuando la única pregunta real del dueño es «¿me está viendo alguien este mes?».
- **Arreglo.** Dejar **una** jerarquía: la cifra del mes como titular, las otras siete en una sola fila densa o plegadas tras un «ver el detalle», y subir «Lo que puedes hacer ahora» a la segunda posición de la pantalla. Si las cuatro tarjetas de la ficha se quedan, al menos que compartan forma con las demás cifras en vez de ser la única fila de cuadrados.
- **Comando.** `$impeccable distill`

#### [P2] Las secciones no tienen URL: el botón atrás sale del panel

- **Qué.** Las seis secciones son `useState` en `PanelShell` y se cambian con `<button>`, no con `<Link>`. Consecuencias: recargar siempre devuelve al dashboard, el botón atrás del móvil abandona el panel (no vuelve a la sección anterior), y no se puede mandar a alguien «mira, en tu Catálogo». El propio panel resolvió este problema **para el negocio activo** y lo razonó por escrito en `business-switcher.tsx`: «La elección viaja en `?negocio=`, no en un estado de React, por dos motivos: sobrevive al `router.refresh()` que disparan los guardados y el cambio de plan, y deja el negocio señalado en un marcador o en un enlace que se comparte». El mismo argumento vale para la sección, y no se aplicó.
- **Por qué importa.** El botón atrás es el primer reflejo de cualquiera con un móvil, y aquí expulsa de la herramienta. Y quien está rellenando su carta, sale a mirar el mapa y vuelve, aterriza en el dashboard y tiene que volver a entrar.
- **Arreglo.** Mover la sección a `?seccion=` con `Link` para los seis ítems (el dashboard sería el valor por defecto, sin query), leyendo `searchParams` en la página y pasándola como `defaultView`. Con un solo valor en la URL, atrás y recargar se comportan como se espera y el `?negocio=` existente sigue funcionando igual.
- **Comando.** `$impeccable harden`

#### [P2] `PanelShell` pide `/api/me` para un dato que ya tiene

- **Qué.** El `useEffect` de `panel-shell.tsx` llama a `fetchMe()` en cada montaje para resolver `sessionName`, pero `BusinessPanel` **siempre** le pasa `businessName={place.name}` — es un parámetro obligatorio de facto, y `business-panel.tsx` lo documenta: «`businessName` sale de la ficha que se está viendo y no de `/api/me`». La petición nunca gana: sólo pisa el valor cuando el prop es `undefined`, que hoy no ocurre en ningún llamador.
- **Por qué importa.** Es una petición HTTP por montaje del armazón pagada en datos móviles que el producto declara caros, y además es una segunda fuente de verdad para el mismo rótulo: si algún día alguien monta el armazón sin el prop, la barra lateral dirá un negocio y la cabecera otro.
- **Arreglo.** Quitar el `useEffect`, el `useState` y el import de `fetchMe`; hacer `businessName` obligatorio en `PanelShellProps`. Si se quiere conservar el respaldo, que sea un prop explícito del llamador, no una consulta de red.
- **Comando.** `$impeccable optimize`

#### [P2] «Liberar cupo» borra el día entero de un toque y sin deshacer

- **Qué.** `liberarFecha()` en `SettingsView` manda un `DELETE /api/reservas?negocioId=…&fecha=…` con un solo clic en el botón. El propio comentario lo justifica como el «a voluntad», y no hay ni confirmación, ni deshacer en el toast, ni aviso de cuántas reservas se van.
- **Por qué importa.** Es la única acción destructiva del panel y es irreversible. Borra el conteo de un día en el que ya puede haber gente apuntada. La pantalla dice «hoy van 12 de 40» justo al lado, así que el usuario sabe perfectamente lo que está a punto de perder: la información para pedir confirmación ya está en el DOM.
- **Arreglo.** Confirmación en línea, no un diálogo: el botón pasa a «¿Liberar los 12 de hoy? Sí / Cancelar» con dos botones hermanos, y el toast de éxito lleva «Deshacer» (re-postear el cupo consumido). Los 12 apuntados son el dato que hace que la pregunta tenga sentido.
- **Comando.** `$impeccable clarify`

#### [P2] La escala fluida en una cifra de producto

- **Qué.** `dashboard-stats.tsx`: `text-[clamp(28px,6vw,36px)]`.
- **Por qué importa.** El registro *product* lo prohíbe con argumento: «Fixed rem scale, not fluid. Clamp-sized headings don't serve product UI. Users view at consistent DPI, and a fluid h1 that shrinks in a sidebar looks worse, not better». Aquí el efecto es que la misma cifra mide distinto en la rejilla de 2 columnas del móvil y en la de 4 de escritorio, así que dos tarjetas de la misma fila pueden leerse con cuerpos distintos… y en la práctica cambia con el ancho de la ventana, no con la jerarquía.
- **Arreglo.** `text-h3` fijo (22 px) o un valor en `rem` (1.75–2rem) y `tabular-nums` para que las cifras no bailen. Los números de `Cifras` ya usan `text-h3` para lo mismo; así las dos rejillas de cifras del dashboard comparten escala.
- **Comando.** `$impeccable typeset`

#### [P2] Siete superficies con el mismo borde de 1 px y la misma sombra de 24 px

- **Qué.** `shadow-soft` es `0 1px 2px rgba(8,19,13,.05), 0 8px 24px -12px rgba(8,19,13,.12)` y va **siempre** acompañado de `border border-ink/5` sobre `bg-white`: en las cuatro tarjetas de `DashboardStats`, «Cómo apareces», «Lo que puedes hacer ahora», `MenuLinkCard`, `PlanCard`, las dos `Cifras`, `TopProductos` y `MiniChart`. En el modo oscuro hay incluso una regla dedicada a apagar esa sombra dentro de `.places-activity`, lo que confirma que la casa sabe que la sombra es lo que hace ruido.
- **Por qué importa.** Un borde de 1 px **más** una sombra de 24 px es el patrón «tarjeta fantasma»: dos formas de delimitar el mismo rectángulo. Repetido en toda la pantalla, lo que desaparece es la jerarquía: como todas las superficies tienen el mismo peso, el ojo no sabe qué es principal. La tarjeta delmes de `EstadisticasPanel` sí rompe el molde (banda `bg-verde-50/50` con `border-verde-200`) y se lee mucho mejor; ése es el camino.
- **Arreglo.** Un solo recurso por superficie: o borde **o** sombra. Para las tarjetas de contenido, `border border-ink/5` sin `shadow-soft` (o `shadow-lv-xs`); reservar `shadow-soft` para lo que de verdad flota (cajón, barras pegajosas, menús). Y dar a la tarjeta del mes más peso que a las demás, no el mismo.
- **Comando.** `$impeccable layout`

---

### P3 — Pulido

- **El gráfico solo se puede leer con ratón.** `mini-chart.tsx` resuelve el tooltip con `hidden group-hover:block`, así que en táctil no hay cifra por barra; el respaldo es un atributo `title`, que los lectores de pantalla no anuncian de forma fiable. Y las barras llevan `cursor-pointer` sin ser interactivas. Arreglo: `tabIndex={0}` + `focus-visible` por barra, o —más simple y más honesto— quitar el `cursor-pointer` y poner la serie en una `<table>` visualmente oculta. `$impeccable harden`
- **«Negocio verificado» promete más de lo que el sistema sabe.** El sello de la cabecera (`panel-shell.tsx`) dice «Negocio verificado», pero lo único que hay detrás es `place.isActive`, que es «publicado». `PRODUCT.md` es explícito: «Nunca vende de más ni promete lo que el producto no hace». O el rótulo pasa a «Publicado en La Verde», o existe de verdad una verificación. `$impeccable clarify`
- **Código muerto en las tarjetas de cifra.** `dashboard-stats.tsx` mantiene `change`: el tipo, `changeStyles`, `changeIcons` y los imports `TrendingUp/TrendingDown/Minus`. Ningún llamador lo pasa — es la rama que quedó al retirar el «+18%» inventado. Se borra el render de la pastilla y se conserva el tipo `change?` si se quiere dejar la puerta abierta; hoy el archivo arrastra cuatro imports y tres mapas por una ruta que no se pinta.
- **Hover decorativo en algo que no es interactivo.** `whileHover={{ y: -3 }}` más `hover:shadow-card` en las cuatro tarjetas de `DashboardStats`. No hay nada que hacer al pasar por encima; el registro *product* llama a esto «movimiento decorativo que no comunica estado». `$impeccable quieter`
- **Comentario obsoleto sobre un «dock» que ya no existe.** El bloque de padding de `panel-shell.tsx` justifica los márgenes diciendo que «las variantes responsive salen después en el CSS, se comía el hueco del dock de 640 px para arriba, justo donde el dock sigue visible (`lg:hidden`)». El dock **no está**: la navegación móvil es el cajón. El padding quedó calculado contra un elemento ausente, y el comentario manda a quien lo lea a buscar algo que no existe. Borrar el párrafo o recalcular el `pb` del `main` ahora que no hay barra fija.
- **Fuga de paleta y de z-index.** Los avisos usan `amber-50/200/800` de Tailwind en lugar del token `lv-amber` del sistema (`business-panel.tsx` ×2, `asistente-card.tsx` ×2, `seguidores-card.tsx`), y el armazón usa `z-50`/`z-40` a mano en vez de una escala semántica. Son deuda de sistema, no de pantalla: el modo oscuro los cubre por reglas globales, pero cualquier consumidor nuevo de `lv-amber` no verá esos avisos. `$impeccable polish`
- **El texto de al lado del interruptor no enciende el interruptor.** El rótulo «Recibir pedidos en mi carta» es un `<div>` hermano del `Switch`, no un `<label for>`, así que tocar el texto no hace nada y el blanco táctil real es de 48×28 px. Además el `Switch` y los presets de horario no declaran `focus-visible` mientras todo el resto del panel sí: dependen del anillo por defecto del navegador, que no es el vocabulario del sistema.

---

## 8. Patrones sistémicos

Tres cosas se repiten y por eso son deuda de sistema, no de pantalla:

1. **La tarjeta fantasma es el único lenguaje de superficie del panel.** Nueve de las once superficies del dashboard son `rounded-2xl border border-ink/5 bg-white shadow-soft`. Arreglarlo en una sola no sirve: hay que decidir una vez cuál de los dos recursos (borde o sombra) representa «contenido» y cuál representa «flotante», y aplicarlo a las dos pantallas (`.business-panel` y `.admin-panel` comparten armazón, layout y tarjetas).
2. **Todo lo navegable es un botón y nada vive en la URL.** `PanelShell` guarda la sección en estado y el `BusinessSwitcher` en query. Son dos mecanismos para dos cosas del mismo tipo. La deuda se paga dos veces: en el botón atrás, en recargar, y en cualquier enlace futuro («mira tu catálogo»).
3. **El feedback de guardado es excelente y el de lectura no existe.** Todo lo que escribe tiene spinner, toast de éxito y vuelta atrás si el servidor se niega. Nada de lo que lee tiene estado: no hay `loading.tsx`, el cupo sin leer es «—» y el gráfico aparece sin transición. La asimetría se nota porque la mitad buena está muy buena.

---

## 9. Banderas por persona

**Jordan (dueño de un negocio pequeño, nunca usó una herramienta así, entra desde el móvil).** Abre el panel y ve ocho cifras en tres bloques. Ninguna le dice qué hacer; las que puede hacer («Sube tus primeras fotos») están a media pantalla de scroll. Toca la hamburguesa —36 px, y es el único camino a las secciones—, abre «Editar ficha» y se encuentra nueve secciones plegadas: no sabe cuáles ya están rellenas, así que las abre todas para averiguarlo. Mete datos, y cuando quiere volver atrás toca la flecha del móvil: **sale del panel entero**. Sus datos siguen ahí, pero él no lo sabe, y el panel no se lo advirtió.

**Sam (lector de pantalla y teclado).** En escritorio la barra lateral es un `<aside>` con seis `<button>`: etiquetas correctas, `aria-current` no (usa color), y el estado activo se anuncia sólo por el `motion.span` de fondo. Al cambiar de sección, el contenido se desvanece y vuelve: con `mode="wait"` hay un hueco real de ~400 ms sin elemento, y el foco no se mueve a la vista nueva, así que tras pulsar «Catálogo» el foco sigue en el botón del nav. En móvil, al abrir el cajón el foco se queda detrás y **Escape no cierra**. Lo que sí está bien: los `sr-only h1` por vista mantienen el orden de encabezados, los `aria-label` de los botones de icono están todos, el `Switch` es `role="switch"` con `aria-checked`, y el error del editor es `role="alert"`.

**Casey (móvil, distraída, una mano, datos contados).** Entra a comprobar que su carta está bien. La pantalla tarda en aparecer y no hay esqueleto: blanco. Cuando carga, la cifra que viene a ver está en la tercera capa. Toca «Catálogo» y espera casi un segundo. La flecha de la cabecera y la hamburguesa están a 36 px, en la esquina superior izquierda y derecha: con el pulgar y en movimiento, son las dos peores dianas posibles de la pantalla. Y si en Ajustes pulsa «Liberar cupo para esa fecha» con el pulgar, borra el día: no hay confirmación y no hay deshacer.

---

## 10. Observaciones menores

- **Dos tamaños para el mismo botón.** «Ver los planes» (candado de `EstadisticasPanel`): `h-10`. «Ver todos los planes» (`PlanCard`): `h-11`. «Ver los planes» (`SettingsView`): `h-11`. Tres sitios, dos alturas, misma acción.
- **«Estás en» en mayúsculas con `tracking-[0.1em]` sobre el selector** es el único eyebrow del panel y convive con las etiquetas en mayúsculas de las cuatro tarjetas (`text-[11px] uppercase tracking-[0.06em]`) y con las cinco chapitas de estado (`text-[11px] uppercase tracking-[0.12em]`). En un panel de producto el micro-label en mayúsculas es convención de sistema y aquí está justificado, pero son **tres** escalas de interletrado (`0.06em`, `0.1em`, `0.12em`) para el mismo tipo de rótulo. Unificarlas en un solo valor las hace parecer un sistema y no tres decisiones.
- **`Row` truncará la dirección.** El `dd` lleva `truncate` y la dirección del negocio puede ser larga: en el móvil se corta sin elipsis visible ni forma de verla entera. «Cómo apareces» es justamente donde el dueño viene a comprobar que la dirección está bien escrita.
- **El pie del cajón usa `text-ink-soft/65`** (4,80:1): pasa AA por los pelos y es el único `/65` del panel; todo lo demás usa `/75` (6,65:1). Uniformar.
- **El contador del cupo aparece incluso con el cupo vacío.** `cargarOcupacion` corre al montar `SettingsView` aunque `aceptaReservas` esté apagado y no haya nada que liberar.
- **`sr-only h1` duplica el nombre de la sección.** `Dashboard`, `Ajustes`, `Editar ficha`… Está bien para el orden de encabezados, pero el `h1` de «Dashboard» no coincide con el rótulo del nav, que dice «Dashboard» (bien) mientras el de «Editar» es «Editar ficha» y el de «Publicar» es «Publicaciones». Tres nombres distintos para la misma sección entre nav, `h1` y comentarios.

---

## 11. Preguntas para pensar

- El dueño entra a saber si su ficha está bien. ¿Por qué lo primero que ve son ocho números y no la lista de lo que le falta?
- Si el cambio de sección tiene que costar una animación, ¿por qué no la de la vista que sale y el contenido nuevo ya puesto?
- ¿Qué pasaría si el negocio activo **y** la sección viveran en la URL, con el mismo criterio que ya se razonó para `?negocio=`?
- ¿La cifra del mes es lo que el dueño viene a ver, o lo que el panel quiere enseñar? ¿Cuál de las ocho es la que justifica las otras siete?
- El panel ya sabe qué secciones están incompletas (lo dice «Lo que puedes hacer ahora»). ¿Puede decirlo también en el nav, en vez de que el dueño abra nueve acordeones para averiguarlo?

---

## 13. Anexo — contrastes medidos

Calculados con la fórmula WCAG 2.x (luminancia relativa sRGB). Los `oklch` se convierten a sRGB con las matrices Oklab estándar, así que van marcados con «≈». AA pide 4,5:1 para texto normal y 3:1 para texto grande (≥18,66 px en negrita o ≥24 px).

| Par | Tamaño | Ratio | Veredicto |
|---|---|---|---|
| `text` blanco sobre `bg-verde-400` (botón principal, `verde-950`) | 14 px | 6,12:1 | ✅ |
| `text-verde-700` sobre `bg-verde-50` (nav activo) | 14 px | 6,86:1 | ✅ |
| `text-verde-700` sobre `bg-verde-100` (icono del mes) | 20 px | 6,08:1 | ✅ |
| `text-verde-600` sobre blanco (etiqueta de tarjeta) | 11 px | 5,41:1 | ✅ |
| `text-ink-soft/75` sobre blanco (`Row`, cuerpo) | 14 px | 6,65:1 | ✅ |
| `text-ink-soft/75` sobre `sand` (pie del panel) | 14 px | 6,27:1 | ✅ |
| `text-ink-soft/75` sobre `bg-sand-deep` (pastillas) | 12 px | 5,81:1 | ✅ |
| `text-ink-soft/65` sobre blanco (pie del cajón) | 12 px | 4,80:1 | ⚠️ pasa, pero es el único `/65` |
| `text-amber-800` sobre `bg-amber-50` (aviso de WhatsApp) | 12 px | 6,84:1 | ✅ |
| `text-destructive` sobre `bg-destructive/5` (sección inválida) | 16 px semibold | **4,08:1** | ❌ P1 |
| `text-destructive` sobre `bg-destructive/10` (aviso de error) | 12 px medium | **3,81:1** | ❌ P1 |

`destructive` = `oklch(60% 0.20 25)` → ≈ `#DE3B3D` en sRGB. Ninguno de los dos textos rojos llega al mínimo, y el de 12 px está a 0,7 puntos de distancia: no es un margen de medición, es un fallo real con cualquier redondeo razonable.
