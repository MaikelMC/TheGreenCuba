# Funcionalidad 2: Zonas y costo de domicilio

## Contexto

Hoy el cliente escribe su dirección en texto libre y el dueño tiene que responder por WhatsApp cuánto cuesta el envío, o si llega a esa zona. Con esta funcionalidad el dueño define sus zonas de entrega (barrios o repartos) con su costo. El cliente elige si recoge o pide a domicilio, escoge su zona, ve el costo del envío y el total final, y el mensaje de WhatsApp llega con todo calculado.

Sirve a mipymes, cafeterías, restaurantes, comida a domicilio, dulcerías, tiendas de ropa y ferreterías.

**Requisito:** la funcionalidad 1 (tasa del día) ya está implementada. Usa `src/lib/precios.ts` y `configTasaDe()` para convertir el costo del envío.

## Reglas del proyecto (del informe de reconocimiento)

- **Permisos:** se resuelven en servidor con `puede()` / `tieneFuncion()` de `src/lib/plans-server.ts`, trabajando con `Set<Funcion>`.
- **Catálogo vivo:** `cargarCatalogo()`. Revisa `normalizarCatalogo` para que la clave nueva aparezca aunque el catálogo de la base esté editado, igual que en la funcionalidad 1.
- **Migraciones:** `npm run db:generate` y `npm run db:migrate`. **No uses `db:push`.**
- **Formularios:** rutas de API con `fetch`, validación a mano y toasts con `sonner`.
- **`business-panel.tsx`:** no le añadas lógica. Crea componentes nuevos y solo móntalos ahí.
- **Un plan no borra datos:** al bajar de plan, las zonas se guardan pero se dejan de aplicar.
- **Generales:** sin dependencias nuevas. UI, código y comentarios en español.

## Antes de empezar: revisa lo que ya existe

`places` ya tiene una columna `entrega` (jsonb) y existe `src/lib/ficha/entrega.ts`. Léelos primero y dime qué guardan hoy: si ya hay modos de entrega, costos, notas o zonas, y dónde se muestran en la ficha.

**Extiende lo que ya existe en `entrega`. No crees una estructura paralela.** Si algo de lo que propongo abajo choca con lo que ya hay, dímelo antes de seguir.

## Qué hay que hacer

### 1. Permiso en `src/lib/plans.ts`

- Añade la función `zonas_domicilio`, con `disponible: true` y el nombre visible «Zonas y costo de domicilio».
- Inclúyela en el módulo `pedidos_reservas` y en los packs que traen pedidos (`esencial` y `pro`), y por tanto en el trial de Pro.
- Que aparezca en `/admin/planes` y en `PlanCard`.

### 2. Datos

**En `places.entrega` (jsonb):** extiende el tipo en `src/lib/ficha/entrega.ts` con:

```ts
{
  recogida: boolean,              // el cliente puede pasar a recoger
  domicilio: boolean,             // hace entregas a domicilio
  zonas: Array<{
    id: string,
    nombre: string,               // «Vista Alegre», «Reparto Sueño»
    costo: number,                // 0 = envío gratis en esa zona
    moneda: 'CUP' | 'USD',
    tiempoMin?: number,           // tiempo aproximado de entrega
    activa: boolean
  }>,
  pedidoMinimo?: { valor: number, moneda: 'CUP' | 'USD' },
  gratisDesde?: { valor: number, moneda: 'CUP' | 'USD' },
  notaEntrega?: string            // «Entregamos de 10 a. m. a 6 p. m.»
}
```

Como es jsonb, no hace falta migración para `places`. Valida a mano en el servidor:

- nombres de zona no vacíos, de 60 caracteres como máximo,
- costos de 0 o más,
- 40 zonas como máximo,
- ids únicos.

**En `pedidos` (migración Drizzle):**

| Columna | Tipo | Para qué |
| --- | --- | --- |
| `modo_entrega` | enum `recogida` / `domicilio`, opcional | Cómo se entrega el pedido |
| `zona_nombre` | texto, opcional | Copia del nombre de la zona en el momento del pedido |
| `costo_envio` | numérico, opcional | Costo del envío aplicado |
| `costo_envio_moneda` | texto, opcional | Moneda de ese costo |

Se guarda una copia y no una referencia, para que el historial no cambie si el dueño edita o borra la zona.

### 3. Lógica

**Helper puro en `src/lib/entrega-calculo.ts`** (o dentro de `src/lib/ficha/entrega.ts` si encaja mejor). La función `calcularEntrega({ subtotal, modo, zonaId, entrega, configTasa })` devuelve:

- el costo del envío, en la moneda de la zona y convertido con la tasa si aplica,
- si se cumple el pedido mínimo,
- si el envío sale gratis por superar `gratisDesde`,
- el total final.

Reutiliza `aplicarTasa` de `src/lib/precios.ts` para cualquier conversión.

**Servidor:**
- Funciones en `src/lib/entrega-server.ts` para leer y guardar la configuración, con comprobación de `puede(negocioId, 'zonas_domicilio')`.
- Ruta `PATCH /api/places/[id]/entrega` que compruebe `accesoNegocio` y el permiso del miembro del equipo sobre Ajustes.

### 4. Panel del negocio

**Componente nuevo `src/components/business/zonas-domicilio-card.tsx`:** se monta en la vista `settings`, junto a la tasa del día y a los pedidos.

- **Interruptores:** «Pueden pasar a recoger» y «Hago entregas a domicilio».
- **Lista de zonas:** cada fila tiene nombre, costo con moneda y un interruptor de activa. Se edita en una hoja inferior (`Sheet`) en móvil.
- **Botón «Añadir zona»:** el campo de nombre sugiere los barrios de la ciudad del negocio usando `src/lib/map/cuba-areas` (si sirve para eso), pero permite escribir cualquier nombre.
- **Campos opcionales:** pedido mínimo, envío gratis desde y nota de entrega.
- **Guardado:** con su propio botón «Guardar zonas» y un toast de `sonner`.

**Estado vacío:** «Todavía no tienes zonas. Añade los barrios a los que entregas y cuánto cobras».

**En `pedidos-view.tsx`:** muestra en cada pedido el modo de entrega, la zona y el costo del envío.

### 5. Carta pública y carrito

**En `src/app/m/[slug]/page.tsx`:** resuelve en servidor la configuración de entrega (solo si tiene el permiso) y pásala a la carta, como `configReserva` y `configTasaDe`.

**En `MenuHeader` o justo debajo:** un chip pequeño con un resumen, por ejemplo «Domicilio desde 100 CUP · Gratis desde 3.000 CUP». Al tocarlo se abre la lista de zonas con sus costos en una hoja inferior.

**En la hoja del carrito:**

1. Un selector segmentado «Recoger» / «A domicilio», solo con los modos que el negocio tiene activos.
2. Si elige domicilio, un selector de zona obligatorio. Debajo, el campo de dirección que ya existe, para la calle y el número.
3. Debajo del subtotal: «Envío ({zona}): 150 CUP» o «Envío: gratis». Luego, el total final en las monedas que correspondan según la tasa.
4. Si no llega al pedido mínimo: un aviso de una línea, «El pedido mínimo es 1.000 CUP. Te faltan 250 CUP», y el botón de pedir desactivado.
5. Si falta una zona que el cliente necesita: un enlace pequeño, «¿Tu zona no está? Pregunta por WhatsApp», que abre el chat sin pedido.

**Sin el permiso o sin zonas configuradas:** el carrito queda **exactamente igual que ahora**, con la dirección libre.

### 6. Pedido por WhatsApp (`src/lib/pedido.ts`)

- **Firma:** `mensajePedido` recibe la entrega calculada (opcional). Sin ella, el mensaje queda igual que ahora.
- **Con entrega, el formato es:**

```
*Pedido — {nombre negocio}*

• {producto} x{qty} — {precio}

*Entrega:* A domicilio — {zona}
*Dirección:* {dirección}

Subtotal: {subtotal}
Envío: {costo envío o «gratis»}
*Total: {total}*
_Tasa usada: {tasa} CUP por USD_   (solo si hay tasa)

Pedido desde La Verde
```

- **Si es recogida:** la línea de entrega dice `*Entrega:* Paso a recoger` y no hay línea de envío.
- **Al guardar en `pedidos`:** rellena `modo_entrega`, `zona_nombre`, `costo_envio` y `costo_envio_moneda`.
- **En el servidor:** el costo del envío y el pedido mínimo se recalculan antes de guardar el pedido. No te fíes de lo que mande el cliente.

### 7. Ficha pública, Telegram, offline y analítica

- **Ficha pública (`src/components/place/`):** donde se muestre la información de entrega, añade las zonas con su costo, reutilizando lo que ya muestre `entrega.ts`.
- **Telegram:** el comando `/zonas` responde la lista de zonas activas con sus costos. Solo lectura por ahora.
- **Offline:** incluye la configuración de entrega en el `place` reducido del snapshot.
- **Analítica:** registra los eventos `zonas_actualizadas` (desde el panel) y `pedido_con_envio` (con la zona como dato extra), para saber qué zonas piden más.

### 8. Diseño e integración visual

Igual que en la funcionalidad 1:

- **Skills:** `ui-ux-pro-max` al planificar, `design-taste-frontend` al construir e `impeccable` para revisar. Si chocan con el diseño actual, manda el diseño actual.
- **Tokens y componentes:** los del proyecto (`verde-*`, `ink`, `muted-foreground`, `bg-card`, radios `lv`, espacios semánticos, `FormSection`, `Sheet`, `Input`, `Select`, `Badge` y `sonner`). Nada de `bg-white` en componentes nuevos.
- **Selector «Recoger / A domicilio»:** con el mismo estilo de controles segmentados o chips que ya tenga la app. Si no hay ninguno, usa chips con los tokens del sistema.
- **En el carrito:** las líneas de subtotal, envío y total alineadas a la derecha con `tabular-nums`. El total final destaca igual que hoy.

**Estados que hay que resolver:**

| Dónde | Estados |
| --- | --- |
| Tarjeta del panel | Sin zonas · con zonas · guardando · error · sin permiso (candado con `textoBloqueo`) |
| Carrito | Sin elegir zona · zona elegida · envío gratis · por debajo del mínimo · zona no listada |

**Móvil:**
- Pruébalo a 360 px.
- Áreas táctiles de al menos 44 px.
- El selector de zona funciona bien con el teclado abierto.
- Los costos usan `inputMode="decimal"`.

**Accesibilidad:** contraste AA, etiquetas visibles, el selector segmentado navegable con teclado y avisos que no dependen solo del color.

**Textos:**

| Dónde | Texto |
| --- | --- |
| Título de la tarjeta | «Domicilio y zonas» |
| Línea de apoyo | «Di a qué barrios llegas y cuánto cobras por el envío» |
| Selector del carrito | «Recoger» / «A domicilio» |
| Etiqueta de la zona | «¿En qué zona estás?» |
| Pedido mínimo | «Te faltan {x} para el pedido mínimo» |
| Zona no listada | «¿Tu zona no está? Pregunta por WhatsApp» |

## Cómo trabajar

1. Lee primero `entrega.ts` y la columna `entrega`, y cuéntame qué hay. Luego dime qué archivos vas a crear y modificar, dónde va cada elemento de la UI y con qué componentes. Espera mi visto bueno.
2. Implementa en este orden:
   1. `plans.ts` y la normalización del catálogo
   2. Tipos de `entrega`
   3. Migración de `pedidos`
   4. `calcularEntrega` y `entrega-server.ts`
   5. Ruta de API
   6. Panel
   7. Carta y carrito
   8. `pedido.ts`
   9. Ficha, Telegram, offline y analítica
3. Haz la revisión de diseño con `impeccable`, si está instalada.
4. Ejecuta el typecheck, el lint y el build, y corrige lo que falle.

## Comprobación final

Dame esta lista marcada:

- [ ] `zonas_domicilio` aparece en `pedidos_reservas`, `esencial` y `pro` aunque el catálogo vivo esté editado.
- [ ] Los datos actuales de `entrega` siguen funcionando y se ven igual en la ficha.
- [ ] Sin permiso o sin zonas, el carrito y el mensaje de WhatsApp quedan exactamente igual que antes.
- [ ] Con zonas, el carrito, el mensaje de WhatsApp y el registro en `pedidos` dan el mismo envío y el mismo total.
- [ ] El costo de una zona en USD se convierte con la tasa del día.
- [ ] Envío gratis desde cierto monto y pedido mínimo funcionan, también recalculados en el servidor.
- [ ] Editar o borrar una zona no cambia los pedidos ya guardados.
- [ ] «Recoger» no pide zona ni suma envío.
- [ ] Un trabajador sin permiso sobre Ajustes no puede editar las zonas, ni desde la UI ni llamando a la API.
- [ ] `/zonas` funciona en Telegram.
- [ ] El snapshot offline incluye las zonas.
- [ ] Coherente con el resto de la app a 360 px, con todos los estados resueltos.
- [ ] Contraste AA y etiquetas correctas.
- [ ] Typecheck, lint y build sin errores.

Termina con un resumen de los archivos tocados y cualquier decisión que hayas tomado por tu cuenta.
