# Funcionalidad 1: Precios con tasa del día

## Contexto

En Cuba los precios cambian con la tasa del USD, y hoy cada negocio recalcula a mano los precios en CUP de su carta. Con esta funcionalidad el dueño fija **su** tasa del día, y la app muestra el precio en CUP calculado en toda la carta, en las ofertas, en el carrito y en el mensaje de WhatsApp. Cambia la tasa una vez y se actualiza todo.

**No la confundas con la tasa de `/admin/planes`** (`cupDe`, `textoCup`), que convierte los precios de los planes de La Verde. Esta es la tasa propia de cada negocio y se guarda en `places`.

## Reglas del proyecto (del informe de reconocimiento)

- **Permisos:** se resuelven en servidor con `puede()` / `tieneFuncion()` de `src/lib/plans-server.ts`, trabajando con `Set<Funcion>`. Nunca por nombre de plan.
- **Catálogo vivo:** en servidor, `cargarCatalogo()` de `src/lib/catalogo-server.ts`. Nunca `CATALOGO` directo.
- **La carta:** vive en `places.menu` (jsonb). **No uses `place_menu_items`.**
- **El precio:** `price` es texto libre. Nunca se castea a número sin pasar por el helper que ya existe (`precioDeLinea()` o equivalente en `src/lib/`).
- **Migraciones:** `npm run db:generate` y `npm run db:migrate`. **No uses `db:push` ni `db:studio`**, que no funcionan en esta red.
- **Formularios:** rutas de API con `fetch`, validación a mano (sin Zod) y toasts con `sonner`.
- **`business-panel.tsx`:** es monolítico. No le añadas lógica. Crea componentes nuevos en `src/components/business/` y solo móntalos ahí, con el mínimo cambio.
- **Un plan no borra datos:** al bajar de plan, la tasa se guarda pero se deja de aplicar.
- **Generales:** sin dependencias nuevas. UI, código y comentarios en español.

## Qué hay que hacer

### 1. Permiso en `src/lib/plans.ts`

- Añade la clave de función `tasa_del_dia`, con `disponible: true` y el nombre visible «Precios con tasa del día».
- Inclúyela en el módulo `menu_pro`, en los packs que traen Menú Pro (`esencial` y `pro`) y, por tanto, en el trial de Pro.
- **Comprueba `normalizarCatalogo`:** si la fila de `catalogo_planes` en base de datos tiene listas de funciones guardadas, la clave nueva tiene que aparecer igual en `menu_pro`, `esencial` y `pro`. Mezcla con los valores de fábrica si hace falta. Explícame cómo lo resolviste.
- Que aparezca en `/admin/planes` y en `PlanCard` como el resto de funciones.

### 2. Base de datos (migración Drizzle)

En `places` (`src/lib/db/schema/places.ts`):

| Columna | Tipo | Por defecto |
| --- | --- | --- |
| `tasa_usd_cup` | numérico, opcional | — |
| `tasa_actualizada_en` | timestamp, opcional | — |
| `tasa_redondeo` | entero | 5 |
| `tasa_activa` | booleano | falso |

`tasa_redondeo` admite 1, 5, 10, 50 o 100.

En `pedidos` (`src/lib/db/schema/pedidos.ts`):

| Columna | Tipo | Para qué |
| --- | --- | --- |
| `tasa_usada` | numérico, opcional | Guardar con qué tasa se hizo cada pedido, para el historial |

**No hay campo nuevo en los productos.** Un producto se puede convertir cuando su `price` es una cifra pura (lo que ya detecta el helper existente) y su `currency` es USD. Los precios como «3–5 USD» o «A convenir» se muestran como siempre.

### 3. Lógica de cálculo

**Helper puro:** créalo en `src/lib/precios.ts`, importable en cliente y servidor, reutilizando la detección de cifra pura que ya existe:

- `aplicarTasa(valorUsd, tasa, redondeo)` multiplica y redondea **hacia arriba** al múltiplo de `redondeo`.
- `preciosDeItem(item, configTasa)` devuelve `{ principal, cup? }`, con estas reglas:

| Caso | Qué devuelve |
| --- | --- |
| Sin config, `tasa_activa` falso o precio no numérico | Solo el precio de siempre (`formatMenuPrice`) |
| `currency` USD y precio numérico | El precio en USD y su equivalente en CUP |
| `currency` CUP | Solo el CUP, sin conversión |
| EUR o MLC | Tal cual, sin conversión por ahora |

- Formatea el CUP con el **mismo formato de miles que ya usa el proyecto** (el de `textoCup`) y la etiqueta «CUP».

**Lado del servidor:** créalo en `src/lib/tasa-server.ts`:

- `configTasaDe(negocioId)` devuelve la config solo si `puede(negocioId, 'tasa_del_dia')` y `tasa_activa` es verdadero. Si no, devuelve `null`.
- `actualizarTasa(negocioId, { tasa?, redondeo?, activa? })`:
  - comprueba el permiso,
  - valida a mano (tasa numérica mayor que 0 y menor que 100 000, redondeo dentro de los valores permitidos),
  - guarda y pone `tasa_actualizada_en`,
  - registra el evento de analítica `tasa_actualizada`.

  La usan la ruta de API y el bot de Telegram.

**Ruta de API:** `PATCH /api/places/[id]/tasa`, siguiendo el patrón de las rutas existentes. Comprueba `accesoNegocio` y el permiso del miembro del equipo sobre Ajustes, y llama a `actualizarTasa`.

### 4. Panel del negocio

- **Componente nuevo `src/components/business/tasa-del-dia-card.tsx`:** se monta en la vista `settings` de `business-panel.tsx`, junto a las secciones de pedidos y reservas.
  - Usa el mismo patrón visual que las demás secciones de Ajustes (`FormSection`).
  - Recibe `funciones` del servidor y usa `bloqueoDe()` para el candado.
  - Se guarda en el acto con su propio botón «Guardar tasa» y un toast de `sonner`, sin depender del `SaveBar`, como los toggles de guardado inmediato.
  - El interruptor de activar se guarda al cambiarlo.
- **Formulario de producto (`menu-item-editor.tsx`):**
  - Si la tasa está activa, el producto está en USD y el precio no es una cifra pura, muestra debajo del campo de precio una ayuda de una línea: «Escribe solo el número para que se calcule en CUP».
  - Si es numérico, muestra la conversión en vivo: «= 1.750 CUP».
- **Aviso en el Dashboard:** un componente pequeño nuevo que, si la tasa está activa y `tasa_actualizada_en` tiene más de 24 horas, muestra «Tu tasa es de ayer» con un botón «Actualizar» que lleva a la tarjeta de Ajustes.

### 5. Carta pública, ficha y carrito

- **En `src/app/m/[slug]/page.tsx`:** resuelve `configTasaDe(id)` en servidor y pásala a los componentes de la carta, igual que se hace con `configReserva`.
- **En `CartaMenu`:** cada producto muestra su precio con `preciosDeItem`. El CUP va debajo o al lado del precio principal.
- **En `OfertasHero`:** aplica la misma conversión al precio rebajado y al precio tachado.
- **En la ficha pública (`src/components/place/`):** donde se muestren precios de la carta, usa el mismo helper.
- **Pie de la carta:** «Precios en CUP según la tasa del negocio: 350 CUP por USD, actualizada hoy». Usa «hoy», «ayer» o la fecha, según toque.
- **Carrito (`PedidoProvider` y la hoja del carrito):** cuando hay tasa, el total se muestra en USD y en CUP. Si el carrito mezcla productos en USD y en CUP, con tasa **ahora sí** se puede calcular un total único en CUP. Muéstralo.

### 6. Pedido por WhatsApp (`src/lib/pedido.ts`)

- **Firma:** `mensajePedido` recibe la config de la tasa (opcional) y usa `preciosDeItem`. Sin tasa, el mensaje queda **exactamente igual que ahora**.
- **Con tasa, el formato es:**

```
*Pedido — {nombre negocio}*

• {producto} x{qty} — {precio USD} ({precio CUP})
• {producto} x{qty} — {precio CUP}

*Dirección:* {dirección}

*Total: {total USD} USD · {total CUP} CUP*
_Tasa usada: {tasa} CUP por USD_

Pedido desde La Verde
```

- **Total en USD:** solo aparece si todas las líneas están en USD. Si hay mezcla, solo el total en CUP.
- **Al guardar en la tabla `pedidos`:** rellena `tasa_usada`. En `pedidos-view.tsx`, muestra la tasa usada en el detalle del pedido, en texto secundario.

### 7. Telegram (`src/lib/asistente.ts` y `src/lib/asistente-server.ts`)

- **Comando `/tasa 350`:** llama a `actualizarTasa`. Si la tasa estaba desactivada, la activa. Responde: «Listo, tu tasa ahora es 350 CUP por USD. Tu carta ya está actualizada».
- **Comando `/tasa` sin número:** responde la tasa actual y cuándo se actualizó.
- **Regla pura en `asistente.ts`:** que reconozca frases como «el dólar está a 350», «la tasa está a 350» o «tasa 350», antes de pasar por la IA, para no gastar del tope diario.
- **Sin permiso:** responde con el plan que la incluye, usando el mismo texto de `bloqueoDe`.

### 8. Offline y analítica

- **En `NegocioSnapshotData` (`src/lib/offline/snapshots.ts`):** añade `tasaUsdCup`, `tasaRedondeo`, `tasaActiva` y `tasaActualizadaEn` al `place` reducido. Si `public/offline.html` muestra precios, que use los mismos campos.
- **Analítica:** el evento `tasa_actualizada` se registra con el sistema de analítica que ya existe, con el origen como dato extra: `panel` o `telegram`.

### 9. Diseño e integración visual

La funcionalidad tiene que parecer que siempre estuvo ahí. Se integra con el sistema de diseño actual, sin inventar un estilo nuevo.

**Skills de diseño.** Si están instaladas, úsalas así, sin que cambien la identidad de La Verde:

| Skill | Para qué |
| --- | --- |
| `ui-ux-pro-max` | Al planificar: ubicación de cada elemento, jerarquía, estados, accesibilidad y patrones de móvil |
| `design-taste-frontend` | Al construir: que el resultado se vea cuidado y no genérico, dentro del estilo existente |
| `impeccable` | Al terminar: revisión final de detalles y pulido |

Si alguna skill propone algo que choca con el sistema de diseño actual, manda el sistema actual.

**Tokens y componentes que hay que usar (los del proyecto):**

| Elemento | Qué usar |
| --- | --- |
| Colores | La escala `verde-*`, `ink`, `ink-soft`, `muted-foreground` y `destructive` |
| Fondos | `bg-card` o `bg-surface` en los componentes nuevos, **no `bg-white`**, para no sumar deuda con el modo oscuro |
| Tipografía | `font-display` (DM Sans) en títulos de tarjeta y `font-body` (Source Sans 3) en el resto, con la escala existente (h3, body, small, meta) |
| Radios | Los del sistema (`lv`, `lv-lg`, `lv-xl`), no `rounded-xl` ni `rounded-2xl` sueltos |
| Espacios | Los semánticos (`gap-xs`, `gap-sm`, `gap-md`…) |
| Componentes | `FormSection`, `Input`, `Label`, `Select`, `Badge`, el interruptor que ya usen los toggles de Ajustes, `toast` de `sonner` y `Sheet` |
| Animaciones | `motion/react` con las curvas ya tokenizadas |

**Jerarquía del precio en la carta:**

- El precio principal mantiene exactamente su estilo actual.
- El CUP va en tamaño `small` o `meta` y color `muted-foreground`. No compite con el principal.
- Los números usan `tabular-nums`.
- Los colores por moneda (`currencyStyles`) se mantienen.

**Estados de la tarjeta:**

| Estado | Cómo se ve |
| --- | --- |
| Sin tasa todavía | Campo vacío con un ejemplo de valor y el interruptor desactivado |
| Activa y al día | Vista previa «10 USD = 3.500 CUP» y «Actualizada hoy» |
| Tasa vieja (más de 24 horas) | Fecha en tono de aviso suave, con texto además del color, y el aviso del Dashboard |
| Guardando o error | El mismo patrón de carga y de toast que el resto del panel |
| Sin permiso | El mismo candado de las demás funciones (`textoBloqueo`) |

**Móvil primero:**

- Pruébalo a 360 px de ancho.
- Áreas táctiles de al menos 44 px.
- El campo de tasa usa `inputMode="decimal"`.
- Nada se desborda en horizontal.
- La vista previa se actualiza mientras se escribe.

**Accesibilidad:** contraste AA, también en el CUP secundario sobre `sand-warm`, etiquetas visibles, interruptor con nombre accesible y avisos que no dependen solo del color.

**Textos (español cubano natural, cortos):**

| Dónde | Texto |
| --- | --- |
| Título de la tarjeta | «Tasa del día» |
| Línea de apoyo | «Pon tus precios en USD y te los mostramos en CUP con tu tasa» |
| Etiqueta del campo | «¿A cómo está el USD hoy?» |
| Etiqueta del redondeo | «Redondear el precio en CUP a» |
| Aviso del Dashboard | «Tu tasa es de ayer» y botón «Actualizar» |
| Pie de la carta | «Precios en CUP según la tasa del negocio: 350 CUP por USD, actualizada hoy» |

## Cómo trabajar

1. Antes de escribir código, dime qué archivos vas a crear y cuáles vas a modificar. Describe también dónde va cada elemento nuevo en la UI y con qué componentes existentes lo construyes. Espera mi visto bueno.
2. Implementa en este orden:
   1. `plans.ts` y la normalización del catálogo
   2. Migración
   3. `precios.ts` y `tasa-server.ts`
   4. Ruta de API
   5. Panel
   6. Carta, ofertas y carrito
   7. `pedido.ts`
   8. Telegram
   9. Offline y analítica
3. Al terminar, haz la revisión de diseño con `impeccable`, si está instalada, y corrige lo que encuentres.
4. Ejecuta el typecheck, el lint y el build, y corrige lo que falle.

## Comprobación final

Dame esta lista marcada:

- [ ] La migración se genera con `db:generate` y se aplica con `db:migrate` sobre la base con datos.
- [ ] `tasa_del_dia` aparece en `menu_pro`, `esencial` y `pro` aunque el catálogo vivo de la base esté editado.
- [ ] Con la tasa desactivada, la carta, el carrito y el mensaje de WhatsApp quedan exactamente igual que antes.
- [ ] Con la tasa activa, la carta, las ofertas, el carrito y el mensaje de WhatsApp muestran los mismos números.
- [ ] Los precios no numéricos («3–5 USD», «A convenir») se ven igual que siempre.
- [ ] Un carrito con productos en USD y en CUP da un total único en CUP.
- [ ] El redondeo funciona con 1, 5, 10, 50 y 100, siempre hacia arriba.
- [ ] Sin permiso, la tarjeta sale con candado y no se aplica la tasa en ningún sitio.
- [ ] Al bajar de plan, la tasa sigue guardada en `places` y la carta vuelve a los precios de siempre.
- [ ] `pedidos.tasa_usada` se rellena y se ve en `pedidos-view.tsx`.
- [ ] `/tasa 350`, `/tasa` y «el dólar está a 350» funcionan en Telegram sin gastar del tope de IA.
- [ ] Un trabajador sin permiso sobre Ajustes no puede cambiar la tasa, ni desde la UI ni llamando a la API.
- [ ] El snapshot offline incluye los campos de la tasa.
- [ ] La tarjeta, el formulario de producto y la carta se ven coherentes con el resto de la app a 360 px, y los cinco estados están resueltos.
- [ ] Contraste AA y etiquetas correctas.
- [ ] Typecheck, lint y build sin errores.

Termina con un resumen de los archivos tocados y cualquier decisión que hayas tenido que tomar por tu cuenta.
