# Biblioteca 3D propia de La Verde

Queremos ilustraciones 3D con el estilo del perfil de Instagram de La Verde: objetos brillantes y redondeados, verde de la marca con reflejos, luz suave, sombra de contacto y pequeños destellos. **Las creas tú, en 3D real,** con `@remotion/three` (Three.js dentro de Remotion), en lugar de dibujarlas planas.

Se usan de dos formas:
1. **Animadas dentro del reel,** en vivo en 3D.
2. **Exportadas como PNG transparente,** para reutilizarlas en carruseles e historias.

Ejecuta este prompt **antes** del pase premium (`prompt-08-pase-premium.md`). El paso 3 del pase premium usará esta biblioteca en vez de `public/3d/`.

## Dependencias

| Paquete | Versión |
| --- | --- |
| `@remotion/three` | La misma versión que `remotion` |
| `three`, `@react-three/fiber` y `@react-three/drei` | Las compatibles con la versión de React del proyecto. Compruébalo en la documentación de `@remotion/three` antes de instalar |
| `@types/three` | Como dependencia de desarrollo |

No instales nada más sin preguntarme. **Nada de modelos descargados ni de entornos HDR de internet:** todo se modela y se ilumina por código, para que el render no dependa de la red y el estilo sea nuestro.

## Reglas técnicas de Remotion con 3D

- **El lienzo:** usa `ThreeCanvas` de `@remotion/three`, nunca el `Canvas` de fiber directamente.
- **La animación:** sale **solo** de `useCurrentFrame()` y `interpolate`/`spring`, nunca de `useFrame` ni de relojes, para que cada fotograma sea idéntico en cada render.
- **Nada aleatorio sin semilla:** usa `random(seed)` de Remotion.
- **Render con WebGL:** configura el render con WebGL acelerado (`chromiumOptions.gl`: `angle` en Windows; prueba `angle-egl` o `swangle` si falla) y documenta el comando exacto que funciona en mi PC. Si el render 3D va lento, baja la concurrencia y dímelo.
- **Fondo transparente** en todos los lienzos 3D (`gl={{ alpha: true }}`), para poder ponerlos encima de cualquier fondo.

## 1. Estilo común (`src/reel/3d/estilo.ts`)

**Materiales:** todos `MeshPhysicalMaterial`.

| Material | Color | Acabado |
| --- | --- | --- |
| `verdeBrillante` | `#2FBF6B` | `roughness` 0,28, `clearcoat` 1, `clearcoatRoughness` 0,12, un poco de `sheen` verde claro |
| `verdeProfundo` | `#1E9A48` | El mismo acabado |
| `blancoPorcelana` | `#FFFFFF` | `roughness` 0,35, `clearcoat` 0,6 |
| `amarilloSuave` | `#FBE7A1` | `roughness` 0,4, `clearcoat` 0,5 |
| `pantalla` | Emisiva | Para las pantallas, con su propia luz |
| `piel` | Un tono cálido neutro | Mate suave, `roughness` 0,6 |

**Geometría:** nada de aristas vivas.
- **Cajas:** `RoundedBox` de drei, con radio generoso.
- **Formas extruidas:** con bisel (`bevelEnabled`, `bevelSize` y `bevelSegments` de 6 o más).

**Iluminación** (componente `Estudio`):
- **Luz principal suave** arriba a la izquierda, y **luz de relleno** cálida a la derecha.
- **Contraluz** verde claro para el borde brillante.
- **Entorno:** `Environment` de drei **solo con `Lightformer`** (paneles de luz definidos por código), sin archivos HDR.
- **`ContactShadows`** bajo cada objeto: opacidad 0,35, desenfoque 2,5 y teñida de verde oscuro.

**Destellos:** componente `Destellos`, con estrellas de 4 puntas (la del logo) que aparecen, brillan y desaparecen alrededor de los objetos en momentos concretos. Pueden ser planos con `Billboard`, con brillo aditivo.

**Cámara:** en perspectiva, con un objetivo de unos 35°. Ligeramente desde arriba, como en las ilustraciones del perfil.

## 2. Objetos (`src/reel/3d/objetos/`)

Cada objeto es un componente con props para animarlo desde fuera: posición, rotación, escala y su estado propio.

| Componente | Qué es | Detalles y estados |
| --- | --- | --- |
| `Pin3D` | El pin de La Verde: gota extruida con bisel, un corazón dentro y la estrella de 4 puntas arriba a la derecha | Tomando como referencia la forma de `public/marca/logo.png`, con `verdeBrillante` y un corazón de `verdeProfundo` más claro. Estado `latido` (pulso del corazón) |
| `Paquete3D` | Caja de cartón premium con las solapas abiertas | Cuerpo `blancoPorcelana` con la franja y la etiqueta «Paquete» en verde (texto 3D con `Text3D` o `Text` de drei con Nunito). Estados `abierta`, `temblando` (con intensidad 0–1) y `reventando` (las solapas y los lados se separan con física simulada por fórmulas) |
| `Funcion3D` | Píldora 3D redondeada con un icono en relieve | Una por función: web, app, anuncios, bots, estadísticas, QR y redes. El icono, extruido desde el SVG de Lucide (`SVGLoader` de three). Variante `encajada`: más pequeña y alineada en el pack |
| `Escalera3D` | Cuatro escalones redondeados | El primero, el doble de alto. Verde claro con el borde de luz. Estado `brillo` en el primer escalón |
| `Personaje3D` | El dueño del negocio, estilo juguete de vinilo | Cuerpo cápsula con camisa `verdeBrillante`, cabeza esfera `piel`, ojos esféricos negros con un punto de brillo y boca de toroide parcial. Brazos y piernas cápsula. Estados `neutro`, `duda` (balanceo, cabeza ladeada y signo de interrogación 3D encima), `agobio` (0–1: se encoge, cejas inclinadas y gotas de sudor 3D) y `caido` (sentado en el suelo). Parpadeo automático cada 2–3 s, con semilla |
| `Telefono3D` | Teléfono moderno | Cuerpo `verdeProfundo` muy oscuro o grafito, esquinas redondeadas, cámara pequeña y pantalla emisiva. La pantalla acepta una textura: el logo, una imagen o un componente React pintado en una textura |
| `Regalo3D` | Caja de regalo | Caja `verdeBrillante`, lazo `amarilloSuave` hecho con toroides y cintas. Estado `abriendo` (0–1: la tapa salta, gira un poco y salen destellos) |
| `Tarjeta3D` | Tarjeta gruesa redondeada para «Mes 1» y «Mes 2» | `blancoPorcelana` o `verdeBrillante`, con texto en relieve suave |
| `Medidor3D` | Termómetro o cápsula vertical | Se llena de verde a amarillo y a rojo según un valor de 0 a 1. Vidrio con transmisión (`transmission`) |
| `Burbuja3D` | Bocadillo de chat, como el del carrusel de preguntas del perfil | Verde brillante con un icono dentro |
| `Mapa3D` | La silueta de `public/mapa/cuba.svg` extruida con un grosor pequeño y bisel | Verde claro, con `Pin3D` pequeños clavados en las posiciones de las ciudades del prompt 05, que caen y rebotan uno tras otro |

**Escala común:** todos los objetos comparten la misma escala de tamaños, para que convivan en una misma escena sin parecer de mundos distintos.

## 3. Galería para revisión

1. **Composición `Galeria3D`:** todos los objetos en una cuadrícula, girando despacio, con el `Estudio` de luz. Una fila por cada estado de los objetos que los tengan.
2. **Hoja de contactos:** renderiza una imagen de cada objeto (y de cada estado) en `out/3d/galeria/` y una hoja de contactos en `out/3d/galeria/hoja.png`.
3. **Revísalo con ojo de director de arte:** que se vean premium, coherentes entre sí y con el estilo del perfil (verde brillante, redondeado, luz suave). Escribe en `out/3d/revision.md` lo que mejorarías de cada objeto, mejóralo y repite **hasta que todos estén al nivel**.
4. **Para** y enséñame la hoja de contactos antes de usarlos en las escenas.

## 4. Exportar PNG para carruseles e historias

Composición `Exportar3D`: cada objeto, solo, en su mejor ángulo, a 1600×1600 px con fondo transparente. Expórtalos con `npx remotion still --image-format=png` a `public/3d/export/` (por ejemplo, `pin.png`, `paquete.png`, `regalo.png`, `telefono.png`, `personaje-duda.png`, `personaje-agobio.png`, `burbuja.png` y `mapa.png`). Déjame el comando para volver a exportarlos.

## 5. Uso en las escenas (lo aplicará el pase premium)

Cuando el pase premium (`prompt-08`) mejore cada escena, usa estos objetos en 3D animado en lugar de las formas planas:

| Escena | Objetos |
| --- | --- |
| 1 (gancho) | `Paquete3D` pequeño cayendo junto al texto tachado, si mejora la composición sin tapar tu cara |
| 2 (agobio) | `Escalera3D`, `Personaje3D`, `Paquete3D`, `Funcion3D` y `Medidor3D`. El estallido con física simulada por fórmulas y destellos |
| 3 (negocios) | Cada tarjeta con un pequeño objeto 3D en la esquina (taza, tijeras, bolsa y gráfica, modelados con el mismo estilo). Si no da tiempo a modelarlos bien, usa insignias 3D con el icono en relieve |
| 4 (propuesta) | `Telefono3D` en el centro, `Burbuja3D` en el paso 1, las `Funcion3D` encajando en el paso 3 y `Mapa3D` con los `Pin3D` en el paso 4 |
| 5 (llamada a la acción) | `Regalo3D` abriéndose y las dos `Tarjeta3D` de los meses, encima de tu clip y respetando las zonas seguras |

- **Cámara 3D:** sigue el movimiento de cámara viva del pase premium (acercamiento lento y un leve giro).
- **Profundidad de campo** suave (`DepthOfField` solo si no dispara el tiempo de render; si no, un desenfoque falso en las capas de fondo).
- **Mezcla con lo 2D:** los textos y los subtítulos siguen en 2D, nítidos, por encima de los objetos 3D.

## Cómo trabajar

1. **Antes de instalar,** dime las versiones exactas que vas a usar y el comando de render con WebGL que vas a probar. Espera mi visto bueno.
2. **Haz primero una prueba:** solo `Estudio` + `Pin3D`, renderizada como imagen y como un video de 3 s. Enséñamela antes de seguir con el resto de objetos.
3. Luego el resto de objetos, la galería y el ciclo de revisión del punto 3. Para con la hoja de contactos.
4. Después, la exportación a PNG.
5. El uso en las escenas lo haces dentro del pase premium.

## Comprobación final

- [ ] Todos los objetos hechos por código: sin modelos ni HDR descargados.
- [ ] Mismo material, misma luz y misma escala en todos: parecen de la misma familia.
- [ ] Coherentes con el estilo 3D brillante del perfil de La Verde.
- [ ] Animaciones solo con `useCurrentFrame` y deterministas: dos renders dan el mismo resultado.
- [ ] Fondo transparente y bordes limpios, sin halos.
- [ ] Galería y hoja de contactos revisadas hasta el nivel premium.
- [ ] PNG exportados en `public/3d/export/` y comando para volver a exportarlos.
- [ ] Comando de render con WebGL documentado y probado en mi PC.
