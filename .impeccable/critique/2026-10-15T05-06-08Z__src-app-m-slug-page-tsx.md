---
target: catálogo online (/m/[slug])
total_score: 28
p0_count: 0
p1_count: 2
timestamp: 2026-10-15T05-06-08Z
slug: src-app-m-slug-page-tsx
---
# Catálogo online — `/m/[slug]`

Objetivo: `src/app/m/[slug]/page.tsx` (+ `src/components/menu/*`).

## Design Health Score

| # | Heurística | Nota | Hallazgo clave |
|---|-----------|-------|----------------|
| 1 | Visibilidad del estado | 3 | Pastilla abierto/cerrado siempre visible; no hay `loading.tsx` para el fallo de caché en frío |
| 2 | Sistema ↔ mundo real | 4 | «¿Dónde te lo llevamos?», «Agotado», «1,200.00 CUP». Habla como el mostrador |
| 3 | Control y libertad | 3 | Diálogo con Volver + X + Escape. Falta vaciar el carrito entero y deshacer una línea |
| 4 | Consistencia y estándares | 3 | Sistema cohesionado; cuatro radios distintos (14/16/24/32 px) |
| 5 | Prevención de errores | 2 | Botones ± de 32 px con 2 px de hueco; precios del carrito envejecen sin aviso |
| 6 | Reconocer antes que recordar | 3 | Chips con texto, resumen con unidades y total. `+` y papelera solo icono |
| 7 | Flexibilidad y eficiencia | 2 | Sin búsqueda dentro de la carta ni acciones en bloque; carta larga = scroll puro |
| 8 | Diseño estético y minimalista | 3 | Limpio, pero cuatro controles + marca antes del nombre del negocio |
| 9 | Recuperación de errores | 2 | Carrito filtra datos corruptos; sin frontera de error propia de la carta |
| 10 | Ayuda y documentación | 3 | Sin ayuda, y no hace falta: el pie explica quién pone los precios |
| **Total** | | **28/40** | **Bueno** (base sólida, áreas débiles que arreglar) |

## Veredicto anti-patrón

**Esto no parece hecho por una IA.** Ni de lejos.

**Evaluación propia.** Sin texto con degradado, sin tarjetas de cristal decorativas (el `backdrop-blur` de la barra del carrito es el uso legítimo: tapa la carta mientras se desplaza), sin bordes de franja lateral, sin plantilla de métrica gigante. Los comentarios del archivo razonan contra anchos reales de 320 y 360 px y contra datos móviles contados, no contra un brief genérico. Los textos no llevan ni una palabra de la familia *empower/supercharge/seamless*. El hueco de foto sin imagen es un icono, no un SVG dibujado a mano.

Dos cosas que **sí** podría reprocharse y no lo son:

- **Rejilla de tarjetas idénticas.** Es un catálogo de productos: la uniformidad es el afordance correcto, porque permite comparar. La prohibición apunta a páginas de marketing que repiten icono+título+texto.
- **Mayúsculas pequeñas con tracking.** Aquí son chapitas de estado (`OFERTA`, `AGOTADO`, abierto/cerrado) y títulos de categoría, que es la convención de una carta. No es el *eyebrow* de sección.

**Escaneo determinista.** `detect.mjs` sobre `src/app/m/[slug]/page.tsx`, `src/components/menu/**` y `src/components/ui/dialog.tsx`: **0 hallazgos**. Verifiqué que el detector no era un no-op: con un archivo de prueba con texto en degradado devuelve 1 anti-patrón y sale con código 2. La limpieza es real.

**Superposiciones visuales.** No hay. Este proyecto prohíbe conducir el navegador, así que no hubo inyección ni overlay en pestaña **\[Human\]**. La evidencia es lectura de código y cálculo de contraste, no medición en el navegador.

## Impresión general

La página entiende su trabajo: se abre desde un QR, en un teléfono, con datos contados, y se resuelve en el servidor. La única isla de cliente que añade peso pinta nada. Eso no es una decisión de rendimiento genérica, es la decisión que más importa con este público, y está tomada en el sitio correcto.

Lo que falla es más pequeño y más físico: los controles que se tocan muchas veces son los más pequeños de la página, y la etiqueta que dice *por qué* un producto está apagado es la menos legible de la tarjeta. La mayor oportunidad es reordenar la cabecera: hoy la marca de la plataforma grita más que el negocio.

## Lo que funciona

1. **Todo en el servidor menos dos islas.** La carta, las ofertas, el plan y el carrito se deciden en el servidor; `EventosMenu` no pinta nada y `ThemeToggle` es un disco. Para alguien pagando el kilobyte, es la diferencia entre abrir y no abrir.
2. **La pastilla de abierto/cerrado, siempre puesta.** Responde la pregunta real de quien llega del QR —¿puedo ir ahora?— antes de que la haga, y usa las palabras del negocio: «Cerrado temporalmente» no es lo mismo que «Cerrado».
3. **Copy honesto y concreto.** «La dirección va dentro del mensaje. Si vas a recogerlo, déjala en blanco.» y «La Verde no gestiona los pedidos: se hacen por WhatsApp o por teléfono, como siempre.» Dicen lo que pasa y no prometen lo que el producto no hace.

## Problemas prioritarios

### [P1] Las chapitas de estado caen a ~2,3:1 dentro de una tarjeta agotada

- **Qué.** `Agotado` es `text-destructive` sobre `bg-destructive/10`. Ya en reposo da **3,79:1** (por debajo de 4,5:1, y es texto de 10 px). Pero además la tarjeta entera lleva `opacity-60` cuando el producto está agotado, así que el texto cae a **≈2,3:1** y el `Oferta` (6,12:1 en reposo) a **≈2,5:1**.
- **Por qué importa.** La etiqueta que explica *por qué* el producto está apagado es, justo en ese estado, la menos legible de la tarjeta. Quien buscaba ese plato acaba de perder la única frase que le dice que hoy no hay, sin creer que desapareció del menú.
- **Arreglo.** Quitar el `opacity-60` de la tarjeta entera. Atenuar por token, no por opacidad global: foto ya en `grayscale`, nombre a `text-ink-soft`, y la chapita a opacidad plena. Si se quiere conservar el aplanado, subir a `opacity-90` como mucho.
- **Comando.** `$impeccable audit`

### [P1] Los botones que más se tocan son los más pequeños

- **Qué.** El «+» de cada producto mide 36 px (`size-9`); los «−» y «+» del carrito y la papelera, **32 px** (`size-8`), separados por `gap-[2px]`. Las pastillas de contacto de la cabecera bajan a 36 px en móvil (`min-h-9`), y las anclas de categoría miden ~31 px.
- **Por qué importa.** Va contra la regla que el propio PRODUCT.md fija (44×44 px, 8 px de separación). Y el sitio donde más duele es el carrito: «−» y «+» son acciones opuestas con el mismo aspecto, a 32 px y 2 px de distancia. Un toque en el equivocado no se ve hasta que se mira el total. Es el único error silencioso de la página.
- **Arreglo.** `size-11` (44 px) en los botones de cantidad y en la papelera del carrito, con `gap-gap-xs` (8 px). El «+» de la tarjeta puede quedarse en 40 px si el ancho de la tarjeta aprieta, pero no en 32.
- **Comando.** `$impeccable adapt`

### [P2] El carrito no se puede vaciar de una vez

- **Qué.** Para dejar el carrito en cero hay que quitar productos de uno en uno —papelera o bajar la cantidad— y no hay deshacer tras borrar una línea ni tras una pulsación larga en «−».
- **Por qué importa.** Quien añade ocho cosas por curiosidad y decide no pedir tiene que dar ocho toques con precisión. Es el momento en que la gente abandona el carrito en vez de limpiarlo.
- **Arreglo.** Una acción «Vaciar» en la cabecera de la lista desplegable. Un `<button>` de texto, sin diálogo de confirmación: el carrito se rehace en diez segundos.
- **Comando.** `$impeccable clarify`

### [P2] Un fallo de caché en frío es una pantalla en blanco

- **Qué.** `/m/[slug]` tiene `revalidate = 300` pero **no tiene `loading.tsx`** ni límite de `Suspense` propio. Sin él, Next no manda la cáscara antes de resolver los datos: el primer visitante tras expirar el ISR espera a que el servidor pinte entero.
- **Por qué importa.** Ese primer visitante es exactamente el del QR, en la conexión peor y muchas veces con la pantalla en blanco delante. PRODUCT.md pide skeletons sin salto de maquetación; aquí no hay ninguno.
- **Arreglo.** Un `loading.tsx` en la carpeta de la ruta con la cabecera y las dos columnas de tarjetas en gris, con las mismas medidas que el resultado real. Con server components no cuesta JavaScript.
- **Comando.** `$impeccable harden`

### [P2] La marca de la plataforma grita más que el negocio

- **Qué.** Por encima de la tarjeta del negocio hay una fila con la pastilla blanca «La Verde» (44 px, logo, borde y sombra), el disco de tema (44 px) y «Ver ficha»; dentro de la tarjeta, el nombre del negocio es un `h3`. Sumando `Llamar` (36 px arriba a la derecha) y hasta tres pastillas de contacto, el encabezado tiene **siete controles** antes de la primera entrada del menú. Y el `h2` «Menú» (16 px) es más pequeño que los `h3` de categoría (22 px en mayúsculas), así que la jerarquía visual va al revés que la semántica.
- **Por qué importa.** El negocio es el contenido y La Verde es el marco; hoy el marco lleva pastilla con borde, logo y sombra, y el nombre del negocio va suelto. Es la misma lección que ya se aplicó a los botones de contacto —comprimirlos— sin aplicarla al bloque de arriba. Y quien abre la carta desde un QR debería ver un precio antes que dos controles de la plataforma.
- **Arreglo.** La fila de marca baja a texto con flecha, como el «Ver ficha» del pie; el disco de tema se queda (se usa a pleno sol) pero pierde el borde si hace falta. Y el `h2` «Menú» sube a `text-h3` para que la jerarquía visual siga a la semántica.
- **Comando.** `$impeccable layout`

## Banderas por persona

**Casey (móvil, distraída, una mano).** Añade tres productos y el carrito aparece fijo abajo: bien, en la zona del pulgar. Pero los botones de cantidad están a 32 px con 2 px entre ellos y la mano va con el pulgar. Peor: si la llaman a mitad del pedido y vuelve a los veinte minutos, el carrito sigue (localStorage) — eso está resuelto — pero no hay forma de saber si los precios que guardó siguen vigentes.

**Riley (probador de stress).** Abre la carta, añade un producto en oferta, cierra. Vuelve al día siguiente: la oferta ya caducó, pero el precio con descuento vive en `localStorage` y **viaja tal cual al mensaje de WhatsApp** (el carrito guarda `price` como cadena). El negocio recibe un pedido con un precio que ya no existe y no hay nada en la pantalla que lo detecte. Editar el producto en el panel tiene el mismo efecto.

**Sam (lector de pantalla / teclado).** Los botones tienen `aria-label` correcto, incluidos los de cantidad («Quitar uno de X»), y el diálogo es Radix, con trampa de foco y Escape. Lo que falla es de vista, no de lector: las chapitas a 2,3:1. Y `html { scroll-behavior: smooth }` no está dentro de ningún `@media (prefers-reduced-motion: reduce)` — hay dos bloques de movimiento reducido en `globals.css` y ninguno cubre el desplazamiento suave, que es justo el efecto más molesto para quien tiene sensibilidad vestibular y el más grande de esta página (saltar de categoría en una carta larga).

## Observaciones menores

- **Precio tachado a 4,04:1.** `text-ink-soft/60` sobre blanco en la oferta, a 12 px. Por debajo de 4,5:1. Subir a `/70` (6,0:1) y sigue leyéndose como precio viejo.
- **Cuatro radios en juego.** Foto `14 px`, tarjeta `16 px`, cabecera `24 px`, diálogo `32 px`. Los tres últimos conviven en la misma pantalla. El diálogo a 32 px es el más lejos de la escala del resto.
- **El `h-[104px]` que deja hueco para la barra fija** es un número mágico acoplado al alto de la barra. Si la línea del resumen cambia de alto, el final de la carta queda tapado.
- **La fila de chips esconde su barra de desplazamiento** (`scrollbar-hide`) y no tiene degradado en el borde. Que existan más categorías depende de que un chip quede cortado por casualidad.
- **`--carta-filtros-h: 56px`** cuando la barra real mide ~43 px. El titular del grupo aterriza 13 px por debajo de lo necesario. Cosmético, pero el token no coincide con lo que describe.
- **El `h2` «Menú» se pinta aunque la carta esté vacía**, y entonces queda un titular «Menú» encima de un párrafo que dice que no hay menú.
- **El aviso de la carta vacía habla al dueño, no al cliente.** «X todavía no ha publicado su menú aquí» no le da nada que hacer a quien llegó del QR.

## Preguntas para pensar

- ¿Qué pasaría si el nombre del negocio fuera lo más grande de la pantalla y La Verde, texto con flecha en el pie?
- ¿Y si el carrito guardara el `id` del producto y volviera a pedir el precio al servidor, en vez de guardar la cifra?
- ¿Este encabezado necesita siete controles, o dos y el resto en «Ver ficha»?
- ¿Se puede saber si alguien encontró lo que buscaba en la carta, o solo cuántos productos vio?
