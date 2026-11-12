# DESIGN.md — Sistema de Diseño de La Verde

Auditoría completa del estado actual (2026-11-11). No es especulación: cada
entrada viene de leer el código.

---

## 1. Tokens de color

### Escala verde (token canónico, hex)

| Token | Valor | Uso |
|---|---|---|
| `verde-50` | `#EAF7EF` | fondos tenues, chips vacíos |
| `verde-100` | `#CEEEDB` | chip Abierto, fondos hover |
| `verde-200` | `#9FDDB9` | bordes de acento suave |
| `verde-300` | `#67C792` | bordes hover, barras de progreso |
| `verde-400` | `#35AF6D` | **acción principal**, spinner, botón primario |
| `verde-500` | `#18954F` | bordes de sección activa |
| `verde-600` | `#0F7A41` | texto de acento, iconos de acción |
| `verde-700` | `#0C6136` | nav activo, labels primarios |
| `verde-800` | `#0A4B2C` | — |
| `verde-950` | `#052017` | texto sobre fondo verde |

### Escala de tinta (texto, bordes)

| Token | Valor | Uso |
|---|---|---|
| `ink` | `#08130D` | texto principal |
| `ink-soft` | `#1B2A21` | texto secundario; con opacidad: `/75` cuerpo, `/60` meta, `/55` deshabilitado |

Bordes de UI: `border-ink/5` (muy sutil), `border-ink/10` (control), `border-ink/15` (ghosted).

### Arenas (fondos de superficie)

| Token | Valor | Uso |
|---|---|---|
| `sand` | `#F6F3EC` | fondo de tarjeta en paneles, panel shell |
| `sand-warm` | `#FBF9F4` | fondo de header |
| `sand-deep` | `#EAE4D6` | chips secundarios, fondos de control, skeletons |

### Tokens semánticos de shadcn — NO usar en UI nueva

Estos tokens son variables CSS (`--primary`, `--surface`, `--border`, etc.) que
**solo se actualizan con la clase `.dark`**. Next-themes aplica
`data-theme="dark"`, no `.dark`: las variables se quedan en sus valores claros
en modo oscuro. El dark mode del sistema usa `!important` en `globals.css`.

**Regla**: usa tokens reales (`verde-*`, `ink`, `sand-*`), nunca los semánticos
(`bg-surface`, `border-input`, `text-foreground`) en componentes nuevos.

### Dark mode

Activado por `data-theme="dark"` en `<html>`. Tailwind compila las variantes
`dark:` correctamente (el `tailwind.config.ts` incluye el selector). Los overrides
globales viven en `globals.css` bajo `html[data-theme="dark"]`.

Paleta oscura de referencia:
- Fondo de página: `#08130d`
- Superficie (tarjeta): `#0e1720`
- Superficie elevada: `#16212b`
- Verde-50 oscuro: `#173522`
- Verde-100 oscuro: `#21442e`
- Texto claro: `#edf7f0`
- Verde de acento oscuro: `#9be3b4`

---

## 2. Tipografía

| Token Tailwind | Familia | Uso |
|---|---|---|
| `font-lv-display` | DM Sans / var(--font-lv-display) | **Principal en la app**: títulos, labels, botones, chips, nombres |
| `font-body` / `font-lv` | Source Sans 3 | Cuerpo de texto largo |
| `.lv-mono` (clase CSS) | ui-monospace | Micro-labels en uppercase, categorías |

### Escala de tamaños

| Token | Valor | Uso típico |
|---|---|---|
| `text-hero` | clamp(40–72px), lh 1.05 | Hero de portada |
| `text-h1` | clamp(32–52px), lh 1.1 | Título de página |
| `text-h2` | clamp(26–40px), lh 1.15 | Sección grande |
| `text-h3` | 22px, lh 1.3 | Título de tarjeta/modal |
| `text-lead` | 18px, lh 1.6 | Párrafo de entrada |
| `text-body` | 16px, lh 1.55 | Cuerpo estándar |
| `text-small` | 14px, lh 1.5 | Texto de soporte, labels de formulario |
| `text-meta` | 12px, lh 1.4 | Chips, fechas, metadata |
| `text-xs` | 11px, lh 1.3 | Etiquetas en uppercase muy pequeñas |

---

## 3. Espaciado

| Token | Valor |
|---|---|
| `gap-2xs` | 4 px |
| `gap-xs` | 8 px |
| `gap-sm` | 12 px |
| `gap-md` | 16 px |
| `gap-lg` | 24 px |
| `gap-xl` | 32 px |
| `gap-2xl` | 48 px |
| `gap-3xl` | 64 px |
| `gap-4xl` | 96 px |
| `gutter` | 20 px — padding horizontal de páginas en móvil |
| `gutter-lg` | 32 px — padding horizontal en escritorio |
| `pb-dock-clear` | 6.5rem + safe-area — hueco bajo el dock flotante |

---

## 4. Radios

| Token | Valor | Uso |
|---|---|---|
| `rounded-lv` | 10 px | Botones por defecto |
| `rounded-lv-lg` | 14 px | Thumb de logo en tarjeta (64×64) |
| `rounded-lv-xl` | 20 px | Tarjetas medianas |
| `rounded-2xl` | ~16 px | **Estándar de tarjetas**, chips, controles de formulario |
| `rounded-3xl` | ~24 px | Tarjetas anchas, secciones CTA |
| `rounded-4xl` | 2 rem | Diálogos modales |
| `rounded-full` | 9999 px | Botones icono, chips redondeados, nav pills |

---

## 5. Sombras

| Token | Uso |
|---|---|
| `shadow-soft` | Tarjeta en reposo (home, servicios) |
| `shadow-card` | Tarjeta hover, diálogos, popups, sheet |
| `shadow-card-hover` | Tarjeta al levantar con translate |
| `shadow-primary-halo` | Único en botón CTA verde principal |
| `shadow-lv-xs` → `lv-xl` | Escala secundaria para tarjetas del panel admin |

---

## 6. Curvas y duración

| Token | Valor | Uso |
|---|---|---|
| `ease-outquint` | `cubic-bezier(0.22, 1, 0.36, 1)` | **Estándar**: hover, focus, transiciones de UI |
| `ease-spring` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entradas, chips animados, `motion` |
| `duration-300` | 300 ms | Transiciones cortas (colores de borde, fondo) |
| `duration-500` | 500 ms | Transiciones largas (nav, dropdowns) |
| `.lv-view-in` | CSS keyframe 180 ms | Entrada de vistas en paneles (`translateY 6px → 0`) |

---

## 7. Componentes existentes

### Botón
**Archivo**: `src/components/ui/button.tsx`
Variantes: `default` (verde), `destructive`, `outline`, `secondary`, `ghost`, `link`.
Tamaños: `default` h-11, `sm` h-9, `lg` h-12, `icon` size-10 redondeado.
Focus: `ring-ring ring-offset-2`.

> **Inconsistencia**: usa `font-body` en vez de `font-lv-display`. Los botones
> CTA inline creados en páginas lo corrigen con `font-lv-display` directo.
> Al crear botones inline, usa `font-lv-display`.

### Input de texto
**Archivo**: `src/components/ui/input.tsx`
Altura 48 px, `rounded-lv`, `text-body`.

> **Inconsistencia CRÍTICA**: usa `bg-surface border-input` (vars CSS que no
> se actualizan en dark). En modo oscuro el campo queda blanco sin el
> `!important` del sistema global.

**Patrón correcto** (igual que `SelectTrigger`):
```tsx
"h-12 w-full rounded-lv border border-ink/10 bg-white px-4
 font-lv-display text-body text-ink placeholder:text-ink-soft/60
 transition-colors duration-500 ease-outquint outline-none
 focus:border-verde-400 focus:ring-2 focus:ring-verde-400/30
 disabled:opacity-50"
```

### Select
**Archivo**: `src/components/ui/select.tsx`
Este SÍ usa tokens reales. **Es la referencia correcta** para todos los controles
de formulario. Altura 48 px, `bg-white border-ink/10`, focus `border-verde-400 ring-verde-400/30`.

### Label
**Archivo**: `src/components/ui/label.tsx`

> **Inconsistencia**: usa `font-display` en vez de `font-lv-display`.
> Al crear labels inline, usa `font-lv-display text-small font-medium text-ink`.

### Badge
**Archivo**: `src/components/ui/badge.tsx`
Usa `font-mono text-xs rounded-full`. Tiene variantes semánticas de color.

> **Inconsistencia**: los chips reales de la app (`PlaceCard`, paneles) usan un
> patrón diferente. El Badge se usa solo en contextos admin puntuales.

**Patrón de chip real** (definido en `PlaceCard` como `chipBase`):
```tsx
"inline-flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap
 rounded-full px-2 font-lv-display text-[12px] font-medium leading-none"
```
Colores por variante:
- Abierto: `bg-verde-100 text-verde-700`
- Cerrado / neutro: `bg-sand-deep text-ink-soft/75`
- Oferta: `bg-[#fdf1d6] text-[#8a5a00]` (amber)
- Top del mes: `border border-[#c9963a] text-[#8a5a00]` (outline amber)

### Card (contenedor genérico)
**Archivo**: `src/components/ui/card.tsx`
Exporta `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.

> **Inconsistencia**: usa `border-border bg-card` (vars rotas en dark). Las tarjetas
> reales de la app se construyen inline con tokens reales.

**Patrón de tarjeta real**:
```tsx
"rounded-2xl border border-ink/5 bg-white shadow-soft
 transition duration-300 ease-outquint
 hover:-translate-y-[2px] hover:border-verde-300 hover:shadow-card"
```

### Dialog / Modal
**Archivo**: `src/components/ui/dialog.tsx`
Tokens correctos: `bg-white border-ink/5 shadow-card rounded-4xl`.
Overlay: `bg-ink/40 backdrop-blur-sm`.
Botón cierre: `size-9 rounded-full hover:bg-sand-deep`.
Focus: `ring-verde-400/30`.

**Mejor ejemplo**: `src/components/ui/image-crop-dialog.tsx`.

### Sheet (panel lateral / inferior)
**Archivo**: `src/components/ui/sheet.tsx`
Panel: `bg-white border-ink/5 shadow-card ease-outquint duration-500`.
Botón cierre: igual que Dialog.

**Mejor ejemplo**: `src/components/business/panel-shell.tsx` (cajón de nav móvil).

### Estado vacío / error
**Archivo**: `src/components/ui/state-view.tsx`
Variantes: `empty` (`bg-verde-50 text-verde-600`), `error`/`offline` (`bg-destructive/10`).
Tamaños: `lg` (pantalla completa) y `sm` (dentro de tarjeta).
Props: `icon` (Lucide), `title`, `description`, `actions`.

**Siempre usar este componente**. No inventar estados vacíos inline.

### Spinner / Skeleton / LoadingState
**Archivo**: `src/components/ui/loading.tsx`
- `<Spinner>`: `border-verde-400 border-t-transparent animate-spin`. Tamaños `sm/md/lg`.
- `<Skeleton>`: `animate-pulse rounded-2xl bg-sand-deep`. Forma libre con `className`.
- `<LoadingState>`: spinner + label centrado. `label={null}` deja solo el spinner.

### PlaceCard
**Archivo**: `src/components/layout/place-card.tsx`
Tarjeta de lista canónica. Layout: logo 64×64 (`rounded-lv-lg`) + columna info.
Entrada animada con `motion` (stagger, máximo 8 tarjetas).
Hover: `y: -2`, `border-verde-300`, `shadow-soft`.

> **Inconsistencias**: `metaText` usa hex `#5b6b7a` / `#9fb0c0` sin token.
> El corazón usa `#ff6b81` hardcodeado. El bg dark usa `#121e2a` sin token.

### FormSection (acordeón de formulario)
**Archivo**: `src/components/business/form-section.tsx`
Tarjeta plegable. Abierta: `border-verde-500 ring-verde-200/70`. Cerrada: `border-ink/5`.
Inválida: `border-destructive/40 ring-destructive/15`. Contenido animado con `motion` height.

**Mejor ejemplo**: editor de ficha en `/business`.

### PanelShell
**Archivo**: `src/components/business/panel-shell.tsx`
Header: `bg-sand-warm/90 backdrop-blur-[16px] border-b border-ink/5 h-header`.
Sidebar: `bg-white border-r border-ink/5 w-[260px]`.
Nav activo: `bg-verde-50 text-verde-700 font-semibold` + highlight deslizante `motion`.
Nav inactivo: `text-ink-soft/75 hover:bg-sand`.

---

## 8. Patrones de página

### Header de sección
```tsx
<p className="lv-mono text-[11px] uppercase tracking-[0.2em] text-verde-700">
  Categoría
</p>
<h1 className="mt-3 font-lv-display text-h1 font-bold tracking-[-0.04em] text-ink text-balance">
  Título principal
</h1>
<p className="mt-4 max-w-2xl text-lead text-ink-soft/75 text-pretty">
  Descripción de apoyo.
</p>
```
**Referencia**: `src/app/(main)/servicios/comida-a-domicilio/page.tsx`

### Tarjeta de lista (hover interactiva)
```tsx
<div className="rounded-2xl border border-ink/5 bg-white shadow-soft
                transition duration-300 ease-outquint
                hover:-translate-y-[2px] hover:border-verde-300 hover:shadow-card">
```

### Tarjeta de panel (sin hover, borde sutil)
```tsx
<div className="rounded-2xl border border-ink/5 bg-white p-gap-md">
```

### Separador entre grupos
```tsx
<div className="h-px bg-ink/5 mx-gap-md" />
```

### Botón de retroceso
```tsx
<Link href="…" className="inline-flex items-center gap-1.5 text-meta font-semibold
                           text-ink-soft/70 transition-colors duration-300 hover:text-verde-700">
  <ArrowLeft size={13} aria-hidden />
  Volver
</Link>
```

---

## 9. Inconsistencias

| # | Elemento | Problema | Versión correcta |
|---|---|---|---|
| 1 | `ui/input.tsx` | `bg-surface border-input` (vars rotas en dark) | `bg-white border-ink/10 focus:border-verde-400 focus:ring-verde-400/30` |
| 2 | `ui/badge.tsx` | `font-mono text-xs` — no coincide con chips reales | `font-lv-display text-[12px] h-[22px] rounded-full px-2` |
| 3 | `ui/card.tsx` | `border-border bg-card` (vars rotas en dark) | `border-ink/5 bg-white shadow-soft rounded-2xl` |
| 4 | `ui/label.tsx` | `font-display` en vez de `font-lv-display` | `font-lv-display text-small font-medium` |
| 5 | `ui/button.tsx` | `font-body` en vez de `font-lv-display` | Botones CTA: añadir `font-lv-display` |
| 6 | `PlaceCard` meta | Hex suelto `#5b6b7a` / `#9fb0c0` | `text-ink-soft/60` + override dark en globals.css |
| 7 | `PlaceCard` liked | `#ff6b81` hardcodeado | No hay token rosa; documentar si se reutiliza |
| 8 | `PlaceCard` dark | `dark:bg-[#121e2a]` sin token | Valor real: equivale a superficie ligeramente más oscura que `#0e1720` |

---

## 10. Dónde mirar antes de crear UI nueva

| Qué quieres hacer | Archivo de referencia |
|---|---|
| Tarjeta en lista (hover) | `src/components/layout/place-card.tsx` |
| Tarjeta en panel | `src/components/business/dashboard-stats.tsx` |
| Formulario con acordeón | `src/components/business/form-section.tsx` |
| Modal / diálogo | `src/components/ui/dialog.tsx` |
| Panel deslizante | `src/components/ui/sheet.tsx` |
| Estado vacío | `src/components/ui/state-view.tsx` |
| Spinner / skeleton | `src/components/ui/loading.tsx` |
| Header de página | `src/app/(main)/servicios/comida-a-domicilio/page.tsx` |
| Nav activa con highlight | `src/components/business/panel-shell.tsx` |
| Chip de estado | `src/components/layout/place-card.tsx` (chipBase) |
| Tokens dark mode | `src/app/globals.css` → `html[data-theme="dark"]` |
| Input / Select correcto | `src/components/ui/select.tsx` |
