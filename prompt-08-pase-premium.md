# Pase premium: llevar el reel a un acabado profesional

El reel ya está montado, pero el resultado no tiene el nivel que necesitamos. **El objetivo ahora es un acabado premium**, a la altura de un estudio de motion design: movimiento con intención, profundidad, tipografía cuidada, transiciones con sentido y un render limpio.

No se cambian el guion, los textos, los tiempos ni la sincronización con las palabras. **Se cambia cómo se ve y cómo se mueve todo.**

## Reglas

- **Paquetes oficiales de Remotion permitidos** (en la misma versión que `remotion`): `@remotion/transitions`, `@remotion/motion-blur`, `@remotion/noise`, `@remotion/shapes`, `@remotion/paths`, `@remotion/layout-utils` y `@remotion/google-fonts`. Nada más sin preguntarme.
- **Skills de diseño, si están instaladas:**

| Skill | Cuándo |
| --- | --- |
| `design-taste-frontend` | Para el criterio estético |
| `ui-ux-pro-max` | Para jerarquía y legibilidad |
| `impeccable` | Para la revisión final de cada escena |

- **La identidad de La Verde se mantiene:** colores, Nunito y logo. Premium no es cambiar de marca, es ejecutarla mejor.
- **Todo en español:** código, comentarios y textos.

## Paso 1: diagnóstico honesto

1. **Renderiza fotogramas fijos** (`npx remotion still`) de cada escena en sus momentos clave: al entrar, en cada palabra que dispara una animación (+10 frames) y al salir. Guárdalos en `out/revision/antes/`.
2. **Haz una hoja de contactos** (una imagen con todos los fotogramas en cuadrícula) en `out/revision/antes/hoja.png`.
3. **Mírala con ojo de director de arte** y escribe en `out/revision/diagnostico.md` una lista concreta de lo que hoy se ve amateur, escena por escena, por ejemplo:
   - formas planas sin luz,
   - textos que compiten entre sí,
   - movimientos lineales,
   - espacios desiguales,
   - elementos tapados por la interfaz de Instagram,
   - transiciones genéricas,
   - colores sin profundidad.

Enséñamelo y espera mi visto bueno antes de cambiar nada.

## Paso 2: sistema de movimiento (`src/reel/movimiento.ts`)

Un solo lugar para todas las curvas y duraciones. **Ningún componente usa valores sueltos.**

| Token | Valor | Uso |
| --- | --- | --- |
| `entrada` | `Easing.bezier(0.16, 1, 0.3, 1)` (out-expo) | Todo lo que aparece |
| `salida` | `Easing.bezier(0.7, 0, 0.84, 0)` (in-expo) | Todo lo que se va |
| `transicion` | `Easing.bezier(0.65, 0, 0.35, 1)` | Movimientos de un sitio a otro |
| `muelleSuave` | `spring` con `damping: 200` | Escalas y posiciones serenas |
| `muellePop` | `spring` con `mass: 0.6`, `damping: 14`, `stiffness: 160` | Solo para los momentos de impacto (estallido, regalo, «QUIERO») |
| Duración de entrada | 12–18 frames | — |
| Duración de salida | 8–10 frames | Las salidas siempre más rápidas que las entradas |
| Escalonado | 3–4 frames entre elementos de un mismo grupo | — |
| Rebote máximo | 4 % de escala | Nada de rebotes exagerados |

**Principios que se aplican en todo el reel:**
- **Nada lineal:** ningún `interpolate` sin `easing`.
- **Anticipación:** antes de un impacto, el elemento se recoge un poco (escala 0,97) durante 3 frames.
- **Superposición:** los elementos de un grupo no llegan todos a la vez. Primero el principal, y los secundarios arrastrados detrás.
- **Un foco cada vez:** como mucho dos cosas moviéndose al mismo tiempo. El ojo tiene que saber siempre dónde mirar.
- **Desenfoque de movimiento** en todo lo que se mueve rápido (rebotes, caídas, el estallido, las transiciones), con `CameraMotionBlur` de `@remotion/motion-blur` (unas 6 muestras).
- **Cámara viva:** cada escena de animación tiene un acercamiento lento y continuo (escala de 1,00 a 1,04 en toda la escena) y capas con parallax: el fondo se mueve más despacio que el primer plano.

## Paso 3: acabado visual (`src/reel/acabado.tsx`)

Componentes reutilizables.

**Fondo:**
- el `#F5FAF2` de base, con un degradado radial muy suave de luz arriba a la izquierda (blanco al 60 %) y sombra abajo a la derecha (`#DFF1DA`),
- dos o tres formas orgánicas desenfocadas (`#DFF1DA` y `#FBF0C9`) que se desplazan muy despacio con `@remotion/noise`,
- un grano muy fino por encima (2–3 % de opacidad) para quitar el aspecto digital plano,
- una viñeta muy suave en los bordes.

**Sombras en capas:** nada de una sombra única. Tres capas (contacto, media y ambiente) teñidas de verde, por ejemplo `0 1px 2px rgba(31,90,51,.10), 0 8px 24px rgba(31,90,51,.10), 0 24px 64px rgba(31,90,51,.12)`.

**Tarjetas y píldoras:**
- borde interior de luz de 1 px (blanco al 60 %) arriba,
- radios consistentes con la escala de la marca,
- el icono dentro de una insignia con degradado sutil y brillo superior, no un círculo plano.

**Ilustraciones** (la escalera, el muñequito, la caja, el teléfono, el regalo, los pins):
- **Usa la biblioteca 3D propia** creada con `prompt-09-3d-propio.md` (`src/reel/3d/`), en 3D animado, siguiendo su punto 5. Esa biblioteca se crea **antes** de este pase.
- **Solo si algún objeto no existe en la biblioteca,** rehaz esa ilustración en SVG con aspecto de volumen:
  - degradados de luz y sombra,
  - un brillo especular en el borde superior,
  - una sombra de contacto en el suelo,
  - un borde de luz,
  - proporciones amables y redondeadas.

  El muñequito debe tener expresión: ojos que parpadean y una boca que cambia con el agobio.

**Tipografía:**
- **Títulos:** Nunito 900, interlineado 1,05, seguimiento −1 %.
- **Textos secundarios:** Nunito 700.
- **Como mucho tres tamaños por escena,** y ningún texto por debajo de 40 px.
- **Ajuste al ancho:** usa `fitText` de `@remotion/layout-utils` para que los títulos ajusten su tamaño sin cortarse.

## Paso 4: zonas seguras de Instagram

La interfaz del reel tapa partes del video. Nada importante (texto, caras, el 2x1) puede quedar en:

| Zona | Medida |
| --- | --- |
| Arriba | 220 px |
| Abajo | 420 px (descripción y nombre de la cuenta) |
| Derecha | 140 px (botones de me gusta, comentar y compartir) |

Crea una capa de guía `ZonasSeguras` que se active con una prop solo en Remotion Studio, para revisar cada escena.

## Paso 5: subtítulos premium

- **Bloques de 2 a 4 palabras,** en una sola línea siempre que se pueda y como mucho en dos.
- **Cada bloque sobre una píldora** semitransparente: blanca al 85 % con desenfoque de fondo sobre las animaciones, y `#1F5A33` al 75 % sobre tus clips.
- **La palabra que suena** pasa a `#1E9A48` (o a `#3CC46B` sobre fondo oscuro), con una escala de 1,00 a 1,06 con `entrada`, sin saltos.
- **Entrada de cada bloque:** sube 12 px con fundido en 6 frames. **Salida:** 4 frames.
- **Posición:** dentro de las zonas seguras, a la misma altura en todo el reel salvo donde algo importante lo impida.

## Paso 6: transiciones con sentido

Fuera los fundidos genéricos. Entre escenas:

| De | A | Transición |
| --- | --- | --- |
| Escena 1 (tu clip) | Escena 2 | Corte con un barrido de máscara con la forma del pin del logo, que se abre desde el centro (unos 14 frames) |
| Escena 2 | Escena 3 | Corte en el estallido: las piezas que salen volando se convierten en las tarjetas de la escena 3 |
| Escena 3 | Escena 4 | La tarjeta «¿Y tu negocio?» se amplía hasta convertirse en la pantalla del teléfono (match cut) |
| Escena 4 | Escena 5 | El mapa se aleja y un barrido rápido con desenfoque de movimiento revela tu clip |

Si alguna resulta demasiado compleja, propón una alternativa del mismo nivel y explícamela.

## Paso 7: tus clips grabados

- **Corrección de color suave** con filtros CSS en el `OffthreadVideo`: un poco más de contraste (1,06), saturación (1,05) y calidez. Sin que se note como filtro.
- **Encuadre:** si la cara queda alta o baja respecto a las zonas seguras, ajusta la escala o la posición del video sin deformarlo.
- **Entrada del primer fotograma:** un acercamiento sutil de 1,03 a 1,00 en los primeros 20 frames, para que el reel no empiece estático.

## Paso 8: render de máxima calidad

**Configura en `remotion.config.ts`** (o en los comandos de render que me dejes):

| Ajuste | Valor |
| --- | --- |
| Tamaño | 1080×1920, 30 fps (si el movimiento se ve entrecortado, prueba 60 fps y dímelo) |
| Códec | H.264, con `crf` 16 |
| Formato de píxel | `yuv420p` |
| Audio | AAC a 320 kbps |
| Imágenes | Calidad JPEG de los fotogramas al 100, o PNG si el tiempo de render lo permite |

**Dos archivos:**
- `out/reel-pack-a-medida-master.mov` en ProRes 422 HQ, para guardar,
- `out/reel-pack-a-medida.mp4` en H.264, para subir.

## Paso 9: ciclo de calidad por escena

Para cada escena, en orden:

1. Aplica los pasos 2 a 7.
2. Renderiza los mismos fotogramas fijos en `out/revision/despues/` y una vista previa en video de esa escena.
3. Revísalo con `impeccable` y con la lista de comprobación de abajo. Escribe en `out/revision/diagnostico.md` las 3 cosas que todavía mejorarías.
4. Mejóralas y repite **hasta que la escena cumpla toda la lista**.
5. **Para** y enséñame el antes y el después de esa escena (las dos hojas de contactos) antes de pasar a la siguiente.

## Lista de comprobación premium

- [ ] Ningún movimiento lineal. Todos usan los tokens de `movimiento.ts`.
- [ ] Las salidas son más rápidas que las entradas.
- [ ] Como mucho dos focos de movimiento a la vez.
- [ ] Desenfoque de movimiento en lo rápido.
- [ ] Cámara viva y parallax en las escenas de animación.
- [ ] Fondo con profundidad, grano y viñeta suaves.
- [ ] Sombras en capas teñidas, nunca negras.
- [ ] Las ilustraciones son los objetos de la biblioteca 3D propia, con su luz y sus materiales.
- [ ] Como mucho tres tamaños de texto por escena, ninguno por debajo de 40 px.
- [ ] Todo lo importante dentro de las zonas seguras de Instagram.
- [ ] Cada texto se puede leer en el tiempo que está en pantalla (regla: 1 segundo + 0,3 s por palabra).
- [ ] Las transiciones tienen relación con lo que pasa en la historia.
- [ ] Render en H.264 CRF 16 y máster en ProRes.

## Para subirlo a Instagram

Déjame anotado en `out/revision/subir-a-instagram.md`:
1. Pasar el MP4 al teléfono sin comprimir (por cable o por un servicio que no recomprima).
2. En Instagram: **Configuración → Uso de datos y calidad de contenido multimedia → Subir con la máxima calidad**, activado.
3. Subir con buena conexión.
