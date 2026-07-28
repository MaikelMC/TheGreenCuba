# La Verde — Design System

> Plataforma de descubrimiento de lugares en Cuba. IA que entiende lenguaje natural.

---

## 1. Identidad visual

**La Verde** es verde porque Cuba es verde — la naturaleza, la esperanza, la oportunidad. El nombre conecta el mundo natural con el economico (verde = dinero en Cuba). La paleta refleja esa dualidad: frescura organica con calidez tropical.

**Posicionamiento:** premium pero accesible. No corporate, no startup generica. Local y autentico.

---

## 2. Paleta de colores

### Primario — Verde La Verde

| Token | Valor | Uso |
|---|---|---|
| `--lv-green-50` | `oklch(97% 0.02 145)` | Backgrounds sutiles, hover states |
| `--lv-green-100` | `oklch(94% 0.04 145)` | Superficies elevadas, badges |
| `--lv-green-200` | `oklch(88% 0.07 145)` | Bordes activos, tags |
| `--lv-green-300` | `oklch(80% 0.10 145)` | Iconos secundarios |
| `--lv-green-400` | `oklch(72% 0.14 145)` | Hover primario, acentos suaves |
| `--lv-green-500` | `oklch(62% 0.16 145)` | **Primario** — CTAs, links, acento principal |
| `--lv-green-600` | `oklch(54% 0.15 145)` | Hover primario oscuro |
| `--lv-green-700` | `oklch(45% 0.13 145)` | Texto sobre fondos claros |
| `--lv-green-800` | `oklch(35% 0.10 145)` | Texto sobre fondos muy claros |
| `--lv-green-900` | `oklch(25% 0.07 145)` | Variantes dark mode |

### Secundario — Arena / Cálido

| Token | Valor | Uso |
|---|---|---|
| `--lv-sand-50` | `oklch(98% 0.005 85)` | **Background principal** |
| `--lv-sand-100` | `oklch(96% 0.008 85)` | Superficies, cards |
| `--lv-sand-200` | `oklch(92% 0.010 85)` | Bordes, divisores |
| `--lv-sand-300` | `oklch(85% 0.012 85)` | Bordes fuertes |

### Neutrales — Texto

| Token | Valor | Uso |
|---|---|---|
| `--lv-gray-900` | `oklch(18% 0.01 250)` | Texto primario |
| `--lv-gray-700` | `oklch(35% 0.01 250)` | Texto secundario |
| `--lv-gray-500` | `oklch(52% 0.01 250)` | Texto placeholder, captions |
| `--lv-gray-400` | `oklch(65% 0.008 250)` | Iconos inactivos |
| `--lv-gray-300` | `oklch(82% 0.006 250)` | Bordes suaves |
| `--lv-gray-200` | `oklch(90% 0.004 250)` | Bordes standard |
| `--lv-gray-100` | `oklch(96% 0.003 250)` | Backgrounds alternos |
| `--lv-white` | `oklch(100% 0 0)` | Superficies blancas |

### Acentos funcionales

| Token | Valor | Uso |
|---|---|---|
| `--lv-amber` | `oklch(75% 0.15 75)` | Destacados, negocios boosteados |
| `--lv-red` | `oklch(60% 0.20 25)` | Errores, alertas |
| `--lv-blue` | `oklch(62% 0.14 250)` | Informativo, enlaces |
| `--lv-teal` | `oklch(70% 0.12 175)` | Exito, confirmaciones |

### CSS Variables (Light mode default)

```css
:root {
  /* Primario */
  --bg:          oklch(98% 0.005 85);
  --surface:     oklch(100% 0 0);
  --fg:          oklch(18% 0.01 250);
  --muted:       oklch(52% 0.01 250);
  --border:      oklch(90% 0.004 250);
  --accent:      oklch(62% 0.16 145);
  --accent-soft: oklch(62% 0.16 145 / 0.10);
  --accent-hover:oklch(54% 0.15 145);

  /* Superficies */
  --surface-raised: oklch(96% 0.008 85);
  --surface-overlay: oklch(100% 0 0 / 0.95);

  /* Funcionales */
  --success:     oklch(70% 0.12 175);
  --warning:     oklch(75% 0.15 75);
  --danger:      oklch(60% 0.20 25);
  --info:        oklch(62% 0.14 250);

  /* Tipografia */
  --font-display: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --font-body:    'Source Sans 3', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', 'SF Mono', ui-monospace, Menlo, monospace;

  /* Escala */
  --fs-hero:   clamp(40px, 7vw, 72px);
  --fs-h1:     clamp(32px, 5vw, 52px);
  --fs-h2:     clamp(26px, 3.5vw, 40px);
  --fs-h3:     22px;
  --fs-lead:   18px;
  --fs-body:   16px;
  --fs-small:  14px;
  --fs-meta:   12px;
  --fs-xs:     11px;

  /* Espaciado (8-point grid) */
  --gap-2xs: 4px;
  --gap-xs:  8px;
  --gap-sm:  12px;
  --gap-md:  16px;
  --gap-lg:  24px;
  --gap-xl:  32px;
  --gap-2xl: 48px;
  --gap-3xl: 64px;
  --gap-4xl: 96px;

  /* Layout */
  --container:     1120px;
  --container-sm:  640px;
  --container-lg:  1440px;
  --gutter:        20px;
  --gutter-lg:     32px;

  /* Radios */
  --radius-sm:  6px;
  --radius:     10px;
  --radius-lg:  14px;
  --radius-xl:  20px;
  --radius-full: 999px;

  /* Sombras */
  --shadow-xs:  0 1px 2px oklch(18% 0.01 250 / 0.04);
  --shadow-sm:  0 2px 8px oklch(18% 0.01 250 / 0.06);
  --shadow-md:  0 4px 16px oklch(18% 0.01 250 / 0.08);
  --shadow-lg:  0 8px 32px oklch(18% 0.01 250 / 0.10);
  --shadow-xl:  0 16px 48px oklch(18% 0.01 250 / 0.12);

  /* Transiciones */
  --ease-out:   cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --duration-fast: 120ms;
  --duration-normal: 200ms;
  --duration-slow: 400ms;
}
```

### Dark Mode

```css
[data-theme="dark"] {
  --bg:          oklch(15% 0.01 250);
  --surface:     oklch(20% 0.01 250);
  --fg:          oklch(95% 0.005 85);
  --muted:       oklch(60% 0.01 250);
  --border:      oklch(28% 0.01 250);
  --accent:      oklch(70% 0.16 145);
  --accent-soft: oklch(70% 0.16 145 / 0.15);
  --accent-hover:oklch(78% 0.14 145);

  --surface-raised: oklch(24% 0.01 250);
  --surface-overlay: oklch(18% 0.01 250 / 0.95);

  --success:     oklch(75% 0.12 175);
  --warning:     oklch(80% 0.14 75);
  --danger:      oklch(65% 0.20 25);
  --info:        oklch(68% 0.14 250);

  --shadow-xs:  0 1px 2px oklch(0% 0 0 / 0.2);
  --shadow-sm:  0 2px 8px oklch(0% 0 0 / 0.25);
  --shadow-md:  0 4px 16px oklch(0% 0 0 / 0.3);
  --shadow-lg:  0 8px 32px oklch(0% 0 0 / 0.35);
}
```

---

## 3. Tipografia

### Fuentes

- **Display:** DM Sans (700, 600) — geometrica, moderna, con personalidad. Legible a tamanos grandes.
- **Body:** Source Sans 3 (400, 500, 600) — optimizada para pantalla, excelente legibilidad en movil.
- **Mono:** JetBrains Mono — para datos, precios, IDs, timestamps.

### Escala de tipografia

| Token | Tamaño | Line-height | Letter-spacing | Uso |
|---|---|---|---|---|
| `--fs-hero` | clamp(40px, 7vw, 72px) | 1.05 | -0.03em | Hero headlines |
| `--fs-h1` | clamp(32px, 5vw, 52px) | 1.1 | -0.02em | Titulares de seccion |
| `--fs-h2` | clamp(26px, 3.5vw, 40px) | 1.15 | -0.015em | Subtitulares |
| `--fs-h3` | 22px | 1.3 | -0.005em | Titulos de card |
| `--fs-lead` | 18px | 1.6 | 0 | Texto introductorio |
| `--fs-body` | 16px | 1.55 | 0 | Texto general |
| `--fs-small` | 14px | 1.5 | 0 | Texto auxiliar |
| `--fs-meta` | 12px | 1.4 | 0.02em | Captions, timestamps |
| `--fs-xs` | 11px | 1.3 | 0.04em | Badges, labels minusculos |

### Reglas

- Display weight: 700 para hero, 600 para h2/h3
- Body weight: 400 para texto, 500 para enlaces/botones, 600 para bold
- Nunca usar italic en body — solo en quotes/citas
- `text-wrap: pretty` en parrafos largos
- `text-wrap: balance` en titulares
- Monospace para: numeros de stats, timestamps, precios, IDs de busqueda

---

## 4. Espaciado y layout

### Grid

- **Max width:** 1120px (contenido), 1440px (ancho completo)
- **Gutter movil:** 20px
- **Gutter desktop:** 32px
- **Breakpoints:**
  - Movil: < 640px (base)
  - Tablet: 640px - 1024px
  - Desktop: > 1024px

### Espaciado

Sistema de 8px: 4, 8, 12, 16, 24, 32, 48, 64, 96

- Secciones: `clamp(48px, 8vw, 96px)` vertical
- Entre elementos: 16px (gap-md)
- Entre grupos: 24px (gap-lg)
- Padding de cards: 20-24px movil, 28-32px desktop

### Border radius

- **Cards y superficies elevadas:** 14px (radius-lg)
- **Botones:** 10px (radius)
- **Chips y pills:** 999px (radius-full)
- **Inputs:** 10px (radius)
- **Bottom sheet movil:** 20px arriba (radius-xl)
- **Map markers:** 50% (circle)

### Sombras

- **Elevacion sutil:** `shadow-xs` — cards en reposo
- **Hover:** `shadow-sm` — cards interactivas
- **Overlays:** `shadow-md` — bottom sheets, modales
- **Tooltips:** `shadow-lg` — elementos浮動
- Nunca sombras coloreadas — solo sombras neutras con opacidad

---

## 5. Componentes

### Botones

```
Primary:   bg accent, text white, radius 10px, padding 11px 20px
Secondary: bg transparent, border border, text fg, hover border fg
Ghost:     bg transparent, no border, text fg, hover accent
Icon:      40x40, radius-full, centered icon
```

- **Altura minima:** 44px (touch target movil)
- **Font:** 15px, weight 500
- **Hover:** background oscurece 10% via `color-mix()`
- **Active:** translateY(1px)
- **Disabled:** opacity 0.5, pointer-events none

### Inputs / Search bar

```
Height: 48px movil, 52px desktop
Border: 1px solid border
Radius: 10px
Padding: 0 16px
Focus: 2px accent outline, border accent
Placeholder: muted color
```

- **Search bar principal (IA):** mas grande (56px), con icono de IA (sparkle/magic), fondo raised
- **Validacion:** borde danger en error, texto helper en muted

### Cards

```
Background: surface
Border: 1px solid border
Radius: 14px (radius-lg)
Padding: 20px movil, 24px desktop
Shadow: shadow-xs en reposo, shadow-sm en hover
```

- **Card de lugar:** imagen arriba (16:9), contenido abajo — nombre, categoria, rating, distancia
- **Card de recomendacion IA:** borde izquierdo accent, icono IA, texto de razonamiento
- **Card de filtro/chip:** padding 6px 14px, radius-full, font mono xs

### Chips / Filtros

```
Padding: 6px 14px
Radius: 999px
Border: 1px solid border
Font: mono, xs, uppercase
Selected: bg accent-soft, border accent, text accent
```

### Map markers

- **Default:** circulo verde 24x24 con icono blanco
- **Destacado (boosted):** circulo amber 32x32 con borde blanco
- **Seleccionado:** circulo verde grande 36x36 con sombra
- **Hover:** scale 1.15

### Bottom sheet (movil)

```
Position: fixed bottom 0
Border-radius: 20px 20px 0 0
Background: surface
Shadow: shadow-xl
Max-height: 60vh (expanded), 40vh (peek)
Drag handle: 36x4px bar, center, muted
```

- **Transiciones:** transform 400ms ease-out
- **Backdrop:** scrim oscuro 40% opacidad cuando expandido
- **States:** peek (solo handle + preview), half, full

### Header / Topbar

```
Height: 56px movil, 64px desktop
Background: surface/95 + backdrop-blur(12px)
Border-bottom: 1px solid border
Position: sticky top 0
```

- **Logo:** izquierda, font-display bold 18px
- **Search:** centro, flex-grow
- **Avatar:** derecha, 32px circulo

---

## 6. Iconografia

### Estilo

- **Line-style,** 1.5px stroke, rounded caps
- **Tamaño base:** 20x20px
- **Tamaño en cards:** 18x18px
- **Tamaño en nav:** 24x24px
- **Color:** hereda del contexto (fg, accent, muted)

### Iconos clave

- **IA / Busqueda magica:** sparkle, wand, brain — para el input de IA
- **Categorias:** coffee (cafeteria), utensils (restaurante), music (discoteca), shopping-bag (mercado), map-pin (lugar), star (favorito), navigation (direccion)
- **UI:** search, x (cerrar), filter, chevron-down, chevron-up, arrow-right, heart, share, clock, phone, globe

### Reglas

- Nunca mas de 1 icono por heading
- Iconos en botones: 16-18px, alineados al centro del texto
- Iconos solos (icon buttons): siempre con aria-label
- No usar emojis como iconos en la UI — solo en contenido de usuario

---

## 7. Accesibilidad y contraste

### Contraste

- **Texto primario sobre bg:** minimo 7:1 (AAA)
- **Texto secundario (muted) sobre bg:** minimo 4.5:1 (AA)
- **Accent sobre white:** minimo 4.5:1 (AA)
- **Accent sobre surface:** minimo 3:1 (AA large text)

### Touch targets

- **Minimo absoluto:** 44x44px en movil
- **Botones primarios:** 48px altura minima
- **Chips/filtros:** 40px altura minima con padding generoso
- **Espacio entre targets:** minimo 8px

### Navegacion

- **Focus visible:** 2px accent outline, 2px offset
- **Skip link:** "Saltar al contenido principal"
- **Tab order:** logo > search > contenido > filtros > bottom sheet
- **Screen readers:** aria-label en todos los icon buttons, aria-expanded en bottom sheet

### Movil

- **Texto minimo:** 16px (evita zoom automatico en iOS)
- **No scroll horizontal:** verificar en 320px-430px
- **Safe areas:** padding para notch/Dynamic Island
- **Connection awareness:** placeholders elegantes, skeleton loading, no layout shift

---

## 7b. Componentes de busqueda y mapa

### SearchBarIA

Barra de busqueda principal con capacidad de IA. Es el elemento mas importante de la pantalla — siempre visible.

```
Mobile:
  Height: 48px reposo, 56px expandido (focus)
  Border: 1.5px solid border → accent en focus
  Radius: 14px (radius-lg)
  Padding: 0 8px 0 16px
  Shadow: none → 0 0 0 3px accent-soft + shadow-md en focus

Desktop (>1024px):
  Max-width: 560px, centrado
  Height: 52px

Elementos internos:
  [Icono busqueda] [Input] [Boton microfono] [Boton "Buscar con IA"]
```

- **Placeholder inteligente:** texto que rota entre sugerencias cubanas ("Que buscas hoy...", "Un cafe tranquilo cerca de mi...", "Restaurante con vista al mar...")
- **Microfono:** botón icono 36x36, color muted, hover accent
- **Boton IA:** background accent, texto blanco, font-display 13px 600, radius 10px. En movil: solo icono (sin texto)
- **Pulse animation:** borde accent pulsa cuando esta buscando
- **Suggestions dropdown:** position absolute debajo del input, surface background, border + shadow-lg, max 4 sugerencias + historial

### MapMarker

Marcadores de mapa con 4 variantes de estado:

```
Default:
  Size: 32x32
  Background: accent
  Shadow: 0 2px 8px accent/0.35
  Icon: blanco, 16x16

Boosted (negocio pagado):
  Size: 40x40
  Background: amber
  Border: 3px solid white
  Shadow: 0 3px 12px amber/0.4
  Pulse animation: ring expanding

Selected:
  Size: 44x44
  Background: accent
  Border: 3px solid white
  Shadow: 0 4px 16px accent/0.45
  Z-index: 20

User location:
  Size: 20x20
  Background: info (azul)
  Border: 3px solid white
  Inner: dot blanco 8x8
  Range ring: 80x80, info/0.08 bg + info/0.2 border
```

- **Hover:** scale(1.15), z-index 15
- **Searching animation:** opacity 0.3→1, scale 0.8→1, infinite
- **Transiciones:** transform 200ms ease-out, box-shadow 200ms

### RecommendationCard (AI Banner)

Banner de recomendacion IA que aparece arriba de la lista de resultados.

```
Layout: flex row, gap 12px
Padding: 14px 16px
Background: linear-gradient(135deg, accent/0.06, accent/0.02)
Border: 1px solid accent/0.15
Radius: 14px (radius-lg)
Margin-bottom: 16px

Icono IA:
  Size: 36x36
  Radius: 10px
  Background: accent
  Color: white

Texto:
  Font-size: 14px
  Line-height: 1.5
  Strong: font-weight 600
```

- El banner explica POR QUE se recomienda cada lugar (ubicacion, preferencias, horario)
- En estado de busqueda: muestra typing dots animation
- Nunca inventar razonamiento — usar datos reales del contexto cubano

### BottomSheet (version busqueda)

Extension del bottom sheet existente con estados especificos para busqueda:

```
Estados:
  peek:  translateY(calc(100% - 120px)) — solo handle + preview
  half:  translateY(calc(100% - 50vh))  — lista parcial
  full:  translateY(0)                   — lista completa

Desktop (>1024px):
  Position: fixed right 20px, bottom 20px
  Width: 400px
  Max-height: calc(100vh - header - 40px)
  Border-radius: 14px (radius-xl)
  Shadow: shadow-lg
```

**Contenido del sheet por estado:**

| Estado | Header | Contenido |
|--------|--------|-----------|
| Default | "Recomendaciones IA" | AI banner + 5 place cards |
| Buscando | "Buscando IA" | Typing dots + 3 skeleton cards |
| Resultados | "Resultados IA" | AI banner + place cards filtrados |
| Sin resultados | "Sin resultados" | Empty state + sugerencias |
| Error red | "Error de conexion" | Error icon + retry + tip Cuba |
| Ubicacion | "Ubicacion" | Permission prompt + skip |

### Filtros rapidos

Chips de filtro que aparecen debajo de las categorias cuando hay resultados:

```
Position: absolute top 56px (debajo de category-bar)
Display: flex row, gap 6px, overflow-x scroll
Visibility: solo visible en estado default + resultados

Filter chip:
  Padding: 5px 10px
  Radius: 999px (radius-full)
  Font: mono, 11px, 500
  Border: 1px solid border
  Active: accent/0.08 bg, accent/0.3 border, accent text

Filtros disponibles:
  - Cercanos (distancia)
  - Aceptan MLC (moneda)
  - Abiertos ahora (horario)
  - Tranquilo (ambiente)
  - Con musica (ambiente)
```

---

## 7c. Componentes de ficha del lugar (Place Detail)

### PhotoCarousel

Carrusel de fotos del lugar con navegación táctil y visual.

```
Mobile:
  Aspect-ratio: 4/3
  Border-radius: 0 (full-bleed)
  Overflow: hidden
  Position: relative

Desktop (>1024px):
  Aspect-ratio: 16/9
  Border-radius: 20px (radius-xl)
  Margin-bottom: 0

Elementos internos:
  Track: flex row, translateX para slide
  Dots: posición absoluta bottom 12px, centrados
  Counter: posición absoluta top-right, bg scrim
  Nav arrows: solo visibles en hover (desktop)
```

- **Slides:** gradientes de placeholder con icono + label descriptivo
- **Touch/swipe:** soporte nativo con touchstart/touchmove/touchend, threshold 50px
- **Transición:** transform 400ms ease-out
- **Estado sin fotos:** placeholder centrado con icono de imagen + texto "Fotos próximamente", aspect-ratio más corto (16:7)
- **Dots:** 7px círculos, activo = 20px pill con bg surface

### PlaceInfo

Encabezado de información del lugar.

```
Layout: flex column
Padding: 24px movil, 32px desktop
Background: surface

Elementos:
  [Nombre lugar]              — font-display, h2 clamp, weight 700
  [Badge abierto/cerrado]     — pill, mono xs, dot indicator
  [Categoría]                 — chip accent-soft, mono xs uppercase
  [Rating]                    — mono meta, estrella llena (futuro)
  [Distancia + barrio]        — mono meta, muted
```

- **Badge abierto:** bg success/0.12, dot verde 6px
- **Badge cerrado:** bg danger/0.10, dot rojo 6px
- **Rating futuro:** label "Próximamente en La Verde" en muted italic
- **Desktop:** padding generoso, nombre más grande

### InfoBar

Barra de información rápida en grid horizontal.

```
Layout: flex row, gap 1px (borders entre items)
Background: border color entre items
Border-top + border-bottom: 1px solid border
Item: flex column centrado, min-height 72px

Items:
  [Horario]   — icono reloj + label mono + valor display
  [Distancia] — icono pin + label mono + valor display
  [Pagos]     — icono tarjeta + label mono + pills de moneda
```

- **Pills de moneda:** radius-sm, mono 10px, colores diferenciados:
  - MLC: accent/0.12 bg, accent text
  - CUP: info/0.10 bg, info text
  - USD: success/0.10 bg, success text
- **Estado cerrado:** valor de horario cambia a "Cerrado"
- **Desktop:** border-radius-lg, borde completo, overflow hidden

### ActionButtons

Grid de acciones principales del lugar.

```
Grid: 4 columnas (2 columnas en <380px)
Gap: 8px
Padding: 16px movil, 24px desktop
Background: surface

Botón:
  Flex column centrado
  Gap: 6px
  Padding: 12px 8px
  Border-radius: 14px (radius-lg)
  Border: 1px solid border
  Min-height: 72px

Variantes:
  Primary: bg accent, text white (Cómo llegar)
  Saved:   border accent, bg accent-soft (Guardar)
  Default: border border, text fg (Compartir, Quiero ir)
```

- **Hover:** border accent, bg accent-soft
- **Active:** scale(0.97)
- **Iconos:** 24x24, accent color (white en primary)
- **Labels:** font-display xs, weight 600
- **Desktop:** border-radius-lg, borde completo, padding 24px

### MenuItem

Card de item de menú u oferta destacada.

```
Layout: flex row, gap 16px
Padding: 16px 0 (vertical spacing entre items)
Border-bottom: 1px solid border (último sin borde)

Elementos:
  [Imagen/placeholder] — 72x72, radius, bg warm neutral
  [Contenido]          — flex 1, min-width 0
    [Nombre]           — font-display, small, weight 600
    [Descripción]      — meta, muted, 2 líneas clamp
    [Bottom row]       — flex between:
      [Precio]         — mono small, weight 500 + span "MLC/CUP"
      [Tag]            — pill, mono 10px, variantes:
        Popular:  warning/0.12 bg
        Nuevo:    accent/0.10 bg
        Oferta:   danger/0.10 bg
```

- **Desktop:** padding 24px, gap más generoso

### OfferBanner

Banner de oferta especial que aparece en estados específicos.

```
Margin: 0 16px 16px (movil)
Padding: 16px
Background: linear-gradient(135deg, warning/0.10, warning/0.04)
Border: 1px solid warning/0.20
Border-radius: 14px (radius-lg)

Elementos:
  [Label]   — mono xs, uppercase, weight 500, warning color
  [Texto]   — font-display, small, weight 600
  [Expiry]  — meta, muted
```

- Solo visible en estado `special-offer`
- Desktop: integrado en el layout de dos columnas

### AIRecommendation (Place Detail)

Versión extendida del RecommendationCard para fichas de lugar.

```
Misma estructura que RecommendationCard (sección 7b)
Pero con contenido más detallado:
  - Query original del usuario en negrita
  - Razonamiento: ubicación, reputación, horario, pagos
  - Tags: "Cerca de ti", "Comida criolla", "Acepta MLC", etc.
```

### PlaceDetailHeader (Mobile)

Header sticky con navegación de vuelta.

```
Height: 56px
Background: surface/0.92 + backdrop-blur(16px)
Border-bottom: 1px solid border
Position: sticky, top: 0 (mobile), top: 0 (desktop)
Z-index: 100

Elementos:
  [Back arrow]  — 40x40, radius-full, hover accent-soft
  [Título]      — font-display, small, weight 600, flex-grow, truncate
  [Actions]     — share + more, 40x40, radius-full
```

### PlaceDetailLayout (Desktop)

Layout de dos columnas para desktop.

```
Max-width: 1200px, centrado
Padding: 32px 24px

Grid:
  Columna izquierda: 1fr
    - PhotoCarousel (16:9, radius-xl)
    - PlaceInfo (radius 0 bottom)
    - InfoBar (border-radius-lg)
    - ActionButtons (border-radius-lg)
    - Description (border-radius-lg)
    - Reviews (border-radius-lg)

  Columna derecha: 420px, sticky
    - AIRecommendation
    - MenuSection (border-radius-lg)
    - ( Más secciones en futuro )

Section dividers: se ocultan en desktop (spacing via gap)
```

### Estados de la ficha

| Estado | Cambios |
|--------|---------|
| Normal | Todo visible, badge "Abierto", horario activo |
| Cerrado | Badge "Cerrado" rojo, banner de cerrado, horario oculto |
| Sin fotos | Carousel → placeholder centrado, aspect-ratio 16:7 |
| Oferta especial | Banner de oferta visible entre info-bar y menú |

---

## 7d. Componentes del Panel del Negocio (Business Panel)

### PanelShell

Layout del panel con sidebar (desktop) y bottom nav (movil).

```
Mobile:
  Topbar: height 56px, sticky, bg surface/95 + backdrop-blur(16px)
  Main:   flex 1, padding 16px, padding-bottom 80px (space for bottom-nav)
  Bottom nav: fixed bottom, height 64px, 4 items (Dashboard, Editar, Vista previa, Ajustes)

Desktop (>1024px):
  Topbar: same, padding 24px
  Sidebar: width 260px, sticky top 56px, height calc(100vh - 56px)
  Main:   padding 32px, max-width 900px
  No bottom nav

Elementos:
  [Logo]       — font-display 18px, accent color + "Panel" en muted
  [Title]      — font-display small 600, flex-grow, truncate
  [Badge]      — mono xs, accent-soft bg, accent text
  [Avatar]     — 36px circle, gradient accent
```

- **Sidebar items:** icon 20x20 + label small 500, active = accent-soft bg + accent text
- **Sidebar business card:** surface-raised bg, business name 700, status dot verde
- **Bottom nav items:** icon 22x22 + label xs, active = accent color
- **Transiciones:** fadeIn 300ms ease-out al cambiar de vista

### DashboardStats

Grid de tarjetas de estadísticas del negocio.

```
Mobile:
  Grid: 2 columnas, gap 12px

Desktop (>1024px):
  Grid: 4 columnas

Stat card:
  Background: surface
  Border: 1px solid border
  Radius: 14px (radius-lg)
  Padding: 16px
  Display: flex column, gap 8px

Elementos:
  [Label]   — mono xs, uppercase, muted, 500 weight
  [Value]   — display clamp(28px, 6vw, 36px), 700 weight
  [Change]  — mono xs, pill:
    Up:   success/0.12 bg, success text
    Down: danger/0.10 bg, danger text
    Neutral: surface-raised bg, muted text
```

- **Hover:** shadow-sm

### MiniChart

Grafico de barras simple para visitas por día.

```
Layout: flex row, gap 3px, align-items flex-end
Height: 120px

Bar:
  Flex: 1
  Background: accent-soft
  Radius: 3px 3px 0 0
  Min-height: 4px
  Hover: accent bg
  Last bar: always accent bg

Tooltip:
  Display: none (block en hover)
  Position: absolute bottom calc(100% + 6px), centrado
  Background: fg, color surface, mono xs
  Radius: radius-sm
```

- **Labels:** mono 10px, muted, justify-between

### AIInsightCard

Tarjeta de insight/recomendación de la IA para el dueño del negocio.

```
Layout: flex row, gap 12px
Padding: 16px
Background: linear-gradient(135deg, accent/0.06, accent/0.02)
Border: 1px solid accent/0.15
Radius: 14px (radius-lg)

Icono:
  Size: 40x40
  Radius: 10px
  Background: accent
  Color: white

Contenido:
  [Label] — mono xs, accent, uppercase, 500
  [Text]  — small, body color, 1.5 line-height, strong 600
```

### ActivityItem

Fila de actividad reciente del negocio.

```
Layout: flex row, gap 12px, align-items center
Padding: 8px 0
Border-bottom: 1px solid border

Dot:
  Size: 8px circle
  Colores: search=accent, view=info, save=warning, nav=success

Text:   flex 1, small, min-width 0
Time:   mono xs, muted, white-space nowrap
```

### FormSection

Sección colapsable del editor de ficha.

```
Background: surface
Border: 1px solid border
Radius: 14px (radius-lg)
Overflow: hidden

Header:
  Display: flex, align-items center, justify-content space-between
  Padding: 16px
  Border-bottom: 1px solid border
  Cursor: pointer
  Hover: surface-raised bg

  Title: font-display body 600, flex row con icono accent 18x18
  Arrow: svg 18x18, muted, rotate(-90deg) when collapsed

Body:
  Padding: 16px
  Display: flex column, gap 16px
  Toggle: display none when collapsed
```

### FormInput / FormTextarea / FormSelect

Elementos de formulario unificados.

```
Input:
  Height: 48px
  Padding: 0 16px
  Border: 1.5px solid border → accent en focus
  Radius: 10px (radius)
  Font: body, body size
  Focus: 0 0 0 3px accent/0.12 + accent border

Textarea:
  Height: auto, min-height 100px
  Padding: 12px 16px
  Resize: vertical

Select:
  Same as input + custom chevron svg
  Cursor: pointer
  Padding-right: 40px

Label:
  font-display, small, 600

Hint:
  meta, muted
```

### PhotoGrid (Editor)

Grid de fotos del negocio para el editor.

```
Mobile:
  Grid: 3 columnas, gap 8px

Desktop (>1024px):
  Grid: 4 columnas

Photo slot:
  Aspect-ratio: 1
  Border: 2px dashed border
  Radius: 10px
  Display: flex column centrado
  Color: muted
  Hover: accent border, accent-soft bg, accent text

  Cover slot:
    Grid-column: 1 / -1
    Aspect-ratio: 16/9

  Filled:
    Border-style: solid
    Photo placeholder: absolute inset
    Remove btn: 24x24 circle, bg fg/0.7, white, hidden until hover

Add slot:
  Same dimensions, dashed border
  Icon: + svg, label "Añadir"
```

### HoursEditor

Editor de horarios por día.

```
Layout: flex column, gap 8px

Row:
  Display: flex, align-items center, gap 12px
  Padding: 8px 0

Day label:
  Width: 40px
  Mono xs, 500, muted, uppercase

Time input:
  Flex: 1
  Height: 40px
  Padding: 0 12px
  Border: 1px solid border
  Radius: 6px
  Font: mono small
  Text-align: center
  Focus: accent border

  Closed state:
    bg surface-raised, color muted, cursor pointer

Separator:
  Mono xs, muted
```

### MenuItemEditor

Editor de items de menú u ofertas.

```
Row:
  Display: flex, gap 12px, align-items flex-start
  Padding: 8px 0
  Border-bottom: 1px solid border

Image slot:
  64x64, radius, 2px dashed border
  Hover: accent border

Fields:
  Flex 1, display flex column, gap 8px

  Name input:    height 36px, body small 600
  Desc input:    height 36px, meta muted
  Bottom row:    flex row, gap 8px

Price input:
  Width: 80px, height 36px
  Mono small, border 1px

Currency select:
  Height: 36px
  Mono xs, border 1px

Tag pill:
  Mono 10px, radius-full
  Popular:  warning/0.12 bg
  Nuevo:    accent/0.10 bg
  Oferta:   danger/0.10 bg

Remove btn:
  36x36, radius-full, border 1px, muted
  Hover: danger border + bg
```

### PaymentChips

Selector de métodos de pago con chips toggle.

```
Layout: flex, flex-wrap, gap 8px

Chip:
  Display: flex, align-items center, gap 6px
  Padding: 6px 14px
  Radius: 999px (radius-full)
  Border: 1px solid border
  Font: mono xs, 500
  Cursor: pointer
  User-select: none

  Active:
    Border: accent
    Background: accent-soft
    Color: accent

Dot indicators:
  MLC: accent
  CUP: info
  USD: success
  EUR: warning
```

### PreviewPanel (Mobile Phone Mockup)

Vista previa de cómo se ve la ficha en la app La Verde.

```
Container:
  Mobile:  bg surface-raised, radius-lg, padding 8px
  Desktop: flex row, gap 32px, padding 32px, align-items flex-start

Phone mockup:
  Width: 100%, max-width 375px (340px desktop)
  Background: surface
  Border-radius: 32px
  Border: 3px solid fg/0.15
  Shadow: shadow-lg
  Overflow: hidden
  Position: relative

Dynamic Island:
  Position: absolute, top 10px, centered
  Width: 120px, height: 32px
  Background: fg, radius 20px

Status bar:
  Height: 44px
  Padding: 0 24px
  Font: mono xs, 600

Content:
  Max-height: 500px (movil), scroll
  Renders: photo + place info + actions + AI reco + menu
```

- **Live info panel (desktop):** flex 1, field rows con label 120px + value mono xs

### SaveBar / Toast

Barra de guardado sticky y notificación toast.

```
Save bar:
  Position: sticky, bottom 0
  Padding: 16px 0
  Background: gradient transparent → bg 20%
  Display: flex, gap 12px

  Status:
    Mono meta, muted
    Saved state: success color, check icon

  Buttons: flex 1, secondary + primary

Toast:
  Position: fixed, bottom 80px, centered
  Background: fg, color surface
  Font: display small 600
  Padding: 12px 24px
  Radius: radius-full
  Shadow: shadow-lg
  Z-index: 200

  Show: opacity 1, translateY(0)
  Hide: opacity 0, translateY(20px)
  Duration: 400ms ease-out
  Auto-hide: 3 seconds
```

---

## 7e. Componentes de Onboarding y Preferencias

### OnboardingShell

Layout del flujo de onboarding con barra de progreso, navegación por slides y skip.

```
Mobile:
  App shell: max-width 480px, centrado, surface bg
  Altura: 100vh (no scroll de pagina)
  Border-radius: 0 (full bleed mobile), radius-xl en tablet+

Elementos fijos:
  [Status bar]    — hora + iconos, mono xs, padding 8px 20px 4px
  [Progress bar]  — 4 segmentos, 4px height, gap 6px, accent bg en active/done
  [Skip button]   — top-right, muted text, "Saltar", hidden en ultimo paso
  [Slide track]   — flex row, translateX(-100% * step), 400ms ease-out
  [Step dots]     — 4 dots, active dot = pill 24x4px accent, done = accent circle
  [Bottom actions]— gradient fade-up bg, "Atrás" ghost + "Continuar" primary

Scroll:
  Slides tienen overflow-y: auto internamente
  Bottom actions y progress bar siempre visibles
```

### OnboardingSlide

Cada slide del onboarding sigue esta estructura:

```
Padding: 0 20px movil, 0 32px desktop
Layout: flex column, gap 16px (entre elementos)
Overflow-y: auto

Elementos opcionales:
  [Icon]    — 64x64, radius-lg, accent-soft bg, svg 32px accent
  [Title]   — font-display h2, 700, -0.02em letter-spacing
  [Subtitle]— body size, muted color, max-width 380px
  [Content] — depende del paso (ver componentes especificos abajo)
```

- **Animación de entrada:** fadeSlideUp 400ms ease-out, elementos escalonados con delay 50-400ms
- **Chip grid:** stagger animation con chipPop 350ms, scale(0.85→1)

### LocationPicker

Selector de ubicación con opciones de ciudad + detección automática.

```
Layout: flex column, gap 8px

Location option:
  Display: flex row, gap 16px, align-items center
  Padding: 16px
  Border: 1.5px solid border
  Radius: 14px (radius-lg)
  Cursor: pointer
  Transition: border-color + bg 200ms ease-out

  Selected state:
    Border: accent
    Background: accent-soft

  Elements:
    [Dot indicator]  — 12x12 circle, border 2px border
      Selected:  accent bg, accent border, 3px accent-soft box-shadow
    [Label]          — font-display body, 600
    [Sub label]      — mono meta, muted

Use location button:
  Display: flex row, gap 8px, center
  Width: 100%
  Padding: 14px
  Border: 1.5px dashed border
  Radius: 14px (radius-lg)
  Font: body small, 600
  Color: muted
  Cursor: pointer
  Transition: all 200ms
  Hover: accent border + text color

  Activated state:
    border-style: solid
    border-color: accent
    color: accent
```

### PreferenceChip

Chip seleccionable para intereses, ambientes, categorías.

```
Layout: inline-flex row, gap 8px, center
Padding: 10px 18px
Border: 1.5px solid border
Radius: 999px (radius-full)
Background: surface
Font: font-display small, 500
Cursor: pointer
User-select: none
Transition: all 200ms ease-out

States:
  Default:    border border, fg text
  Hover:      accent border, accent-soft bg, accent text
  Selected:   accent bg, white text

  Selected icon: white color

Icon:
  Size: 18x18
  Color: fg (inherits from parent)
```

### CurrencyToggle

Selector de monedas con toggle visual y badges informativos.

```
Layout: flex column, gap 12px

Currency option:
  Display: flex row, gap 16px, align-items center
  Padding: 16px 20px
  Border: 1.5px solid border
  Radius: 14px (radius-lg)
  Cursor: pointer
  Transition: all 200ms

  Active state:
    Border: accent
    Background: accent-soft

  Elements:
    [Toggle dot] — 24x24, border 2px border, radius 50%
      Active: accent bg, white checkmark via pseudo-element
    [Currency code] — mono body, 600, width 48px
    [Currency name] — body small, muted, flex 1
    [Badge] — mono xs, radius-sm, font 500

Badge colors:
  MLC: accent-soft bg, accent text
  CUP: info/0.10 bg, info text
  USD: success/0.10 bg, success text
  EUR: warning/0.10 bg, warning text
```

### StepIndicator

Indicador de progreso en dos variantes: barra segmentada y dots.

```
Progress bar segmentada (top):
  Layout: flex row, gap 6px
  Bar height: 4px
  Radius: 2px
  
  States por segmento:
    Inactive: gray-300 bg
    Active:   accent bg
    Done:     accent bg
  Transition: background 300ms

Step dots (bottom):
  Layout: flex row, gap 8px, center
  Dot size: 8x8, radius 50%
  
  States:
    Inactive: gray-300 bg
    Active:   pill 24x8px, accent bg, radius 4px
    Done:     accent bg, 8x8 circle
  Transition: all 300ms
```

### PreferencesScreen

Pantalla de preferencias editable después del onboarding.

```
Layout:
  Status bar → Header (back + title + edit button) → Scroll body
  Height: 100% flex column

Header:
  Min-height: 56px
  Border-bottom: 1px solid border
  Display: flex, align-items center, gap 12px
  Padding: 16px 20px

  Title: font-display h3, 700, flex 1

Body:
  Flex: 1, overflow-y: auto
  Padding: 20px movil, 24px 32px desktop

Preference section:
  Margin-bottom: 32px (gap-2xl)

  Section title:
    font-display small, 600, muted
    uppercase, letter-spacing 0.05em
    margin-bottom: 12px

  Preference row:
    Display: flex, align-items center, justify-content space-between
    Padding: 12px 0
    Border-bottom: 1px solid border
    Last: border none

    Label:
      font-size body, weight 500
    
    Value:
      mono small, muted
      display: flex, align-items center, gap 6px
      
      Pill value:
        padding 2px 10px, radius-full
        accent-soft bg, accent text
        mono xs, 500
```

### ToggleSwitch

Toggle switch para preferencias binarias.

```
Width: 44px
Height: 26px
Radius: 13px (pill)
Background: gray-300 (off), accent (on)
Cursor: pointer
Transition: background 200ms
Position: relative

Thumb:
  Width: 22px
  Height: 22px
  Radius: 50%
  Background: white
  Position: absolute, top 2px, left 2px
  Box-shadow: 0 1px 4px rgb(0 0 0 / 0.15)
  Transition: transform 200ms ease-out

  Active state: translateX(18px)
```

### WelcomeSplash

Pantalla de bienvenida inicial con animación de entrada.

```
Position: absolute inset 0
Z-index: 20
Background: linear-gradient(160deg, accent → green-700)
Display: flex column, center, center, text center
Color: white
Transition: transform 500ms ease-out + opacity 500ms

Hidden state:
  transform: scale(1.1)
  opacity: 0
  pointer-events: none

Elementos:
  [Pulse icon] — 72x72, white/0.15 bg, radius 50%, pulse animation 2s
  [Logo]       — font-display clamp(36px, 10vw, 56px), 700, -0.03em
  [Subtitle]   — body, 0.8 opacity
  [Loading]    — "Comenzando..." small, 0.6 opacity

Animación pulse:
  0%, 100%: scale(1)
  50%:      scale(1.08)
```

### AI Learning Notice

Nota contextual sobre cómo la IA usa los datos del usuario.

```
Placement: ultima fila de PreferencesScreen
Style: meta size, muted color, line-height 1.4
Max-width: 320px

Danger zone:
  Reset button: border 1px danger, danger text, radius
  Confirmation dialog antes de resetear
```

### Estados del Onboarding

| Paso | Componente | Contenido |
|------|-----------|-----------|
| 0 - Ubicación | LocationPicker | 4 ciudades cubanas (La Habana, Santiago, Varadero, Otra) + botón ubicación actual |
| 1 - Intereses | PreferenceChip grid | 8 categorías (Cafeterías, Restaurantes, Discotecas, Mercados, Bares, Playas, Cultura, Deporte) |
| 2 - Monedas | CurrencyToggle | 4 monedas (MLC, CUP, USD, EUR) con badges de contexto |
| 3 - Ambiente | PreferenceChip grid | 8 ambientes (Tranquilo, Fiesta, Romántico, Familiar, Cultural, Aventura, Trabajo, Salud) |

### Flujo de onboarding

```
Welcome splash (1.8s)
  → Slide 0: Location (selección única, por defecto La Habana)
  → Slide 1: Interests (multi-select, 2 por defecto)
  → Slide 2: Currencies (multi-select, MLC+CUP por defecto)
  → Slide 3: Moods (multi-select, Tranquilo+Romántico por defecto)
  → Preferences screen (editable)
  → (Usuario puede saltar onboarding en cualquier momento)
```

---

## 8. Tokens para Next.js + Tailwind + shadcn/ui

### tailwind.config.js

```js
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        lv: {
          green: {
            50:  'oklch(97% 0.02 145)',
            100: 'oklch(94% 0.04 145)',
            200: 'oklch(88% 0.07 145)',
            300: 'oklch(80% 0.10 145)',
            400: 'oklch(72% 0.14 145)',
            500: 'oklch(62% 0.16 145)',
            600: 'oklch(54% 0.15 145)',
            700: 'oklch(45% 0.13 145)',
            800: 'oklch(35% 0.10 145)',
            900: 'oklch(25% 0.07 145)',
          },
          sand: {
            50:  'oklch(98% 0.005 85)',
            100: 'oklch(96% 0.008 85)',
            200: 'oklch(92% 0.010 85)',
            300: 'oklch(85% 0.012 85)',
          },
          amber:   'oklch(75% 0.15 75)',
          red:     'oklch(60% 0.20 25)',
          blue:    'oklch(62% 0.14 250)',
          teal:    'oklch(70% 0.12 175)',
        },
        border:      'oklch(90% 0.004 250)',
        input:       'oklch(90% 0.004 250)',
        ring:        'oklch(62% 0.16 145)',
        background:  'oklch(98% 0.005 85)',
        foreground:  'oklch(18% 0.01 250)',
        primary: {
          DEFAULT: 'oklch(62% 0.16 145)',
          foreground: 'oklch(100% 0 0)',
        },
        secondary: {
          DEFAULT: 'oklch(96% 0.008 85)',
          foreground: 'oklch(18% 0.01 250)',
        },
        muted: {
          DEFAULT: 'oklch(96% 0.008 85)',
          foreground: 'oklch(52% 0.01 250)',
        },
        accent: {
          DEFAULT: 'oklch(62% 0.16 145)',
          foreground: 'oklch(100% 0 0)',
        },
        destructive: {
          DEFAULT: 'oklch(60% 0.20 25)',
          foreground: 'oklch(100% 0 0)',
        },
        card: {
          DEFAULT: 'oklch(100% 0 0)',
          foreground: 'oklch(18% 0.01 250)',
        },
      },
      fontFamily: {
        display: ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
        body:    ['Source Sans 3', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'SF Mono', 'ui-monospace', 'Menlo', 'monospace'],
      },
      borderRadius: {
        'lv':    '10px',
        'lv-lg': '14px',
        'lv-xl': '20px',
      },
      boxShadow: {
        'lv-xs':  '0 1px 2px oklch(18% 0.01 250 / 0.04)',
        'lv-sm':  '0 2px 8px oklch(18% 0.01 250 / 0.06)',
        'lv-md':  '0 4px 16px oklch(18% 0.01 250 / 0.08)',
        'lv-lg':  '0 8px 32px oklch(18% 0.01 250 / 0.10)',
        'lv-xl':  '0 16px 48px oklch(18% 0.01 250 / 0.12)',
      },
    },
  },
}
```

### globals.css (shadcn base)

```css
@layer base {
  :root {
    --background: 98% 0.005 85;
    --foreground: 18% 0.01 250;
    --primary: 62% 0.16 145;
    --primary-foreground: 100% 0 0;
    --secondary: 96% 0.008 85;
    --secondary-foreground: 18% 0.01 250;
    --muted: 96% 0.008 85;
    --muted-foreground: 52% 0.01 250;
    --accent: 62% 0.16 145;
    --accent-foreground: 100% 0 0;
    --destructive: 60% 0.20 25;
    --destructive-foreground: 100% 0 0;
    --border: 90% 0.004 250;
    --input: 90% 0.004 250;
    --ring: 62% 0.16 145;
    --radius: 10px;
  }

  .dark {
    --background: 15% 0.01 250;
    --foreground: 95% 0.005 85;
    --primary: 70% 0.16 145;
    --primary-foreground: 15% 0.01 250;
    --secondary: 24% 0.01 250;
    --secondary-foreground: 95% 0.005 85;
    --muted: 24% 0.01 250;
    --muted-foreground: 60% 0.01 250;
    --accent: 70% 0.16 145;
    --accent-foreground: 15% 0.01 250;
    --destructive: 65% 0.20 25;
    --destructive-foreground: 100% 0 0;
    --border: 28% 0.01 250;
    --input: 28% 0.01 250;
    --ring: 70% 0.16 145;
  }
}
```

---

## 9. Notas de implementacion

### Stack

- **Framework:** Next.js 14+ (App Router)
- **Estilos:** Tailwind CSS 3.4+
- **Componentes:** shadcn/ui (Button, Input, Card, Sheet, Dialog, Badge, Avatar)
- **Mapa:** Leaflet + react-leaflet (OpenStreetMap tiles, gratis, sin API key)
- **IA backend:** API route que procesa queries en lenguaje natural
- **State:** Zustand o React Context para filtros y estado de busqueda
- **conexion:** offline-first con service worker, cache de tiles del mapa

### Estructura de archivos recomendada

```
src/
├── app/
│   ├── layout.tsx          # Root layout, font loading, theme provider
│   ├── page.tsx            # Landing (no logueado)
│   ├── home/page.tsx       # Home autenticada (mapa + busqueda)
│   └── globals.css         # Tokens + base styles
├── components/
│   ├── ui/                 # shadcn/ui overrides
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   ├── sheet.tsx
│   │   └── badge.tsx
│   ├── layout/
│   │   ├── header.tsx      # Topbar sticky
│   │   ├── footer.tsx      # Footer minimalista
│   │   └── bottom-sheet.tsx # Bottom sheet movil
│   ├── map/
│   │   ├── map-view.tsx    # Contenedor Leaflet
│   │   ├── map-marker.tsx  # Marker custom
│   │   └── map-controls.tsx # Zoom, geolocation
│   ├── search/
│   │   ├── ai-search.tsx   # Input de busqueda IA
│   │   ├── search-suggestions.tsx
│   │   └── search-results.tsx
│   ├── place/
│   │   ├── place-card.tsx       # Card de lugar
│   │   ├── place-detail.tsx     # Detail view (mobile)
│   │   ├── place-detail-desktop.tsx # 2-column desktop layout
│   │   ├── photo-carousel.tsx   # Carrusel de fotos
│   │   ├── info-bar.tsx         # Horario, distancia, pagos
│   │   ├── action-buttons.tsx   # Cómo llegar, Guardar, etc.
│   │   ├── menu-item.tsx        # Item de menú / oferta
│   │   ├── offer-banner.tsx     # Banner de oferta especial
│   │   └── place-filters.tsx    # Chips de filtro
│   ├── business/
│   │   ├── panel-shell.tsx      # Layout sidebar + bottom nav
│   │   ├── dashboard-stats.tsx   # Stat cards grid
│   │   ├── mini-chart.tsx        # Bar chart de visitas
│   │   ├── ai-insight-card.tsx   # Recomendación IA para el dueño
│   │   ├── activity-item.tsx     # Fila de actividad reciente
│   │   ├── form-section.tsx      # Sección colapsable del editor
│   │   ├── photo-grid.tsx        # Grid de fotos del editor
│   │   ├── hours-editor.tsx      # Editor de horarios
│   │   ├── menu-item-editor.tsx  # Editor de items de menú
│   │   ├── payment-chips.tsx     # Selector de métodos de pago
│   │   ├── preview-panel.tsx     # Vista previa con phone mockup
│   │   └── save-bar.tsx          # Barra de guardado + toast
│   └── landing/
│       ├── hero.tsx
│       ├── how-it-works.tsx
│       ├── search-examples.tsx
│       └── cta-section.tsx
├── lib/
│   ├── utils.ts            # cn() helper, formatters
│   ├── types.ts            # Place, SearchQuery, Category types
│   └── constants.ts        # Categories, map config
└── hooks/
    ├── use-geolocation.ts
    ├── use-search.ts
    └── use-bottom-sheet.ts
```

### Performance

- **Lazy load del mapa:** dynamic import con `{ ssr: false }`
- **Skeleton loading:** siempre mostrar skeletons, nunca spinner solo
- **Image optimization:** next/image para fotos de lugares
- **Font loading:** `next/font` para DM Sans y Source Sans 3
- **Bundle:** separar chunk del mapa (~150KB leaflet)
- **Cache:** ISR para paginas de lugares, cache de tiles 24h

### Variables de conexion (Cuba)

- **2G/3G:** mapa con tiles rasterizados, baja resolucion
- **Offline:** ultima busqueda guardada, mapa en cache
- ** Datos moviles:** compress imagenes, lazy load agresivo
- **Skeleton states:** criticos — el usuario necesita ver progreso inmediato

---

## 10. Paleta rapida para prototipos

Para prototipos HTML rapidos, usar estas variables directamente:

```css
:root {
  --bg:      oklch(98% 0.005 85);
  --surface: oklch(100% 0 0);
  --fg:      oklch(18% 0.01 250);
  --muted:   oklch(52% 0.01 250);
  --border:  oklch(90% 0.004 250);
  --accent:  oklch(62% 0.16 145);
  --accent-soft: oklch(62% 0.16 145 / 0.10);

  --font-display: 'DM Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --font-body:    'Source Sans 3', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', ui-monospace, Menlo, monospace;
}
```

---

*Documento generado para La Verde. Version 1.0 — Julio 2026.*
