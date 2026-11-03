# Plan de implementación — Fichas de negocio por tipo (La Verde)

Este documento es la **Fase 2** de `prompt-fichas-la-verde.md`: el plan completo, contrastado con el código real del repositorio. No se ha escrito código de producto todavía. Al final están las preguntas abiertas, cada una con el valor por defecto que propongo para no bloquear la implementación.

Línea base verificada antes de planificar: `npm run typecheck` termina con código 0 (árbol limpio).

---

## 0. Resumen de la propuesta

1. Se modela **tipo principal + módulos activables** (`domicilio`, `local`, `tienda`, `servicios`). El tipo solo siembra valores por defecto; los módulos se encienden y apagan uno a uno, así un negocio mixto (cafetería con domicilio) no necesita dos fichas ni un tipo compuesto.
2. **Todo lo visible sale de columnas nuevas o existentes**. Desaparecen los rellenos inventados de la ficha (`FALLBACK_SLIDES`, la descripción «Negocio agregado por su dueño…», los mensajes de cierre escritos a mano) y los textos de interfaz se centralizan en un único archivo de copys.
3. El modelo se añade **como columnas nuevas en `places`**, no como tabla 1:1. Motivo: el driver HTTP de Neon no ofrece transacciones (el propio código lo documenta en `src/app/api/places/[id]/route.ts`) y el panel guarda la ficha con un solo `PATCH`; una tabla aparte obligaría a dos escrituras no atómicas. Las columnas nuevas son nullable o con `default`, así que la migración no toca ninguna fila existente.
4. El catálogo **sigue viviendo en `places.menu` (jsonb)**, que es lo que la app lee de verdad. `place_menu_items` existe pero pierde el precio en texto libre («3–5 USD») y no se usa; no se toca. Se amplía el tipo del jsonb, sin DDL para los ítems.
5. El horario estructurado va en `places.horario` (jsonb) y **no** en `place_hours`, que está sin escritores y con una sola franja por día. `places.schedule` (texto libre) se conserva como respaldo y para fichas antiguas.
6. El estado abierto/cerrado se calcula con un módulo puro en `America/Havana`, en servidor para el HTML inicial y **recalculado en el cliente cada minuto** para que no lo congele la caché de `/m/[slug]` (`revalidate = 300`).
7. La valoración se calcula desde `reviews` (promedio + número) y se oculta por debajo de un mínimo configurable. Hoy `places.rating` no lo actualiza nadie al escribir una reseña: se corrige de paso.
8. Los módulos nuevos **no cambian los planes**: el carrito sigue exigiendo `whatsapp_pedido`, las reservas `reservas_whatsapp` y el sello `verificado`. Los módulos solo deciden qué bloques se pintan; las funciones de pago siguen mandando.

---

## 1. Estado actual relevante (lo que condiciona el plan)

| Pieza | Dónde | Qué hay hoy | Consecuencia para el plan |
| --- | --- | --- | --- |
| Ficha pública | `src/app/(main)/place/[id]/page.tsx` → `place-view.tsx` → `src/components/place/place-detail.tsx` | Página de servidor con metadata/JSON-LD; vista de cliente; `place-detail.tsx` tiene 1.346 líneas y **dos maquetas duplicadas** (escritorio y móvil) | El esqueleto se compone ahí; hay que tocar las dos maquetas o extraer secciones compartidas. Los proyectos (`isProject`) usan el mismo componente: su rama no se toca. |
| Mapeo ficha | `src/lib/db/mappers.ts` (`toUserPlace`, `toPlaceValues`) | `toPlaceValues` es lista blanca: lo que no se nombre se pierde en cada `PATCH`. `toUserPlace` reconstruye campo a campo | Cada campo nuevo hay que añadirlo en **los cuatro sitios**: schema, `toUserPlace`, `toPlaceValues`, `UserPlace` (`places-store.ts`). |
| Reconstrucción cliente | `src/app/(main)/place/[id]/place-view.tsx` | `userPlaceToPlaceData` reconstruye `PlaceData` explícitamente | Todo campo nuevo que la ficha pinte debe nombrarse aquí o se cae en silencio (el propio archivo lo advierte). Se extraerá a un módulo puro reutilizable por la vista previa. |
| Caché | `src/lib/db/queries.ts` | `getPlaceById` cacheada en producción (TTL 300 s, tag `catalog`); `invalidarCatalogo()` obligatorio tras escribir | Las columnas nuevas entran solas por `getTableColumns(places)`. Fotos/ofertas/valoración van en segundas consultas, como ya se hace. |
| Catálogo | `places.menu` jsonb | Precio **texto libre**, moneda, categoría, tag, imagen, disponibilidad, `agotadoHasta`, `importacionId` | Se amplía el tipo: `oculto`, `destacado`, `stock`, `duracionMin`, `tipoPrecio`, `externalId`. Sin migración (jsonb). |
| Tabla de menú | `place_menu_items` | Existe, sin escritores; precio numérico | No se usa. Se documenta como legado. |
| Horario | `places.schedule` texto; `places.hoursJson` jsonb; `place_hours` tabla | Solo se usa el texto. `hoursJson` y `place_hours` no los escribe nadie. `place-filters.ts` documenta que «abierto ahora» es una aproximación por franjas («De día», «De noche») | Se añade `places.horario` estructurado; el heurístico queda como respaldo para fichas sin horario. `place_hours`/`hoursJson` no se tocan. |
| Estado | `places.status` (`active/closed/temporary_closed`) | Ya existe el interruptor; el mensaje de cierre está **escrito a mano** en `place-view.tsx` | Se añade `places.cerrado_mensaje`; el texto por defecto pasa a copys del sistema. |
| Valoración | `places.rating` + `reviews` | `reviews` tiene 1–5, una por usuario/lugar; `/api/reviews` calcula media y total; **nadie actualiza `places.rating`** | La ficha usará media y total vivos; se backfillea y se actualiza al escribir reseña. |
| Reseñas | `src/app/api/reviews/route.ts`, `src/components/place/reviews-section.tsx` | Sin respuesta del negocio ni reseña destacada | `reviews.respuesta` + `places.resena_destacada_id`. |
| Imágenes | `place_images` + `/api/places/[id]/images` | `isCover`, `sortOrder`, `alt`, medidas; solo GET/POST/DELETE; `PhotoGrid` **no reordena ni elige portada** | Añadir `seccion` (`local`/`trabajos`) y un `PATCH` para portada/orden/alt/sección. |
| Logo | `places.logo_url` + `/logo` | Ya existe y lo sube el dueño | Se usa tal cual; si falta, iniciales sobre color de marca (hoy se pinta el icono de categoría). |
| Resumen corto | `places.short_description` | Existe; solo la usa el embedding y un respaldo del mapeo | Se reutiliza como «resumen corto». Sin migración. |
| Métodos de pago | `places.payment_methods` text[] + `PaymentChips` | Lista fija en el componente (MLC, CUP, USD, EUR, Tarjeta, Transferencia), sin «otro» | Pasa a catálogo en `src/lib/ficha/pagos.ts`; se añaden Zelle y «otro» (texto libre por negocio). |
| Atributos | `places.features` jsonb | Solo lo lee `src/lib/ai/embedding.ts`; no se pinta | Nuevo `places.atributos` (catálogo validado). `features` se conserva para la IA y se alimenta desde los atributos. |
| Energía | `places.energia_respaldo`, `EnergiaBadge` | Ya modela planta/inversor/ambas y se pinta | El distintivo «Tiene planta eléctrica» se **deriva** de aquí; no se duplica. |
| Reservas | `acepta_reservas`, `tipo_reserva`, aforos, `plantillaReserva`, `reservas_dias` | Flujo WhatsApp, sin agenda de turnos | Se reutiliza; «Pedir cita» ya existe como tipo. No se construye agenda en v1 (pregunta 7). |
| Pedidos | `pedidos_whatsapp`, `whatsapp_pedido`, `src/lib/pedido.ts` | Carrito y mensaje **solo en `/m/[slug]`**; plantilla escrita en código | Se lleva el carrito a la ficha para el módulo domicilio y se añade `plantilla_pedido` editable. |
| Planes | `src/lib/plans.ts`, `plans-server.ts` | `funciones` decide lo de pago; el cliente solo pinta candados | Los módulos nuevos no abren funciones de pago. Se respeta `puede()`/`tieneFuncion`. |
| Permisos | `src/lib/permisos-negocio.ts`, `canManagePlace` | `catalogo`, `ficha`, `pedidos`, `telegram`; el dueño manda | Las claves nuevas del `PATCH` se clasifican como `ficha` o `catalogo` (ver §7). |
| Copy | Repartido por componentes | «Ver más», «Pagos», «Cerrado temporalmente», etiquetas de `InfoBar`, etc. | Nuevo `src/config/ficha.ts` con `COPY`, defaults por tipo y sugerencias. |

**Contenido escrito a mano que debe desaparecer de la ficha** (regla 1 del prompt):

- `FALLBACK_SLIDES` en `place-view.tsx` (degradados y etiquetas «El lugar»/«Ambiente»).
- `longDescription` de respaldo: «Negocio agregado por su dueño en La Verde. Pronto tendrá más información…».
- `closedMessage`: «Cerrado temporalmente.» / «Temporalmente cerrado.» (pasa a columna + copys).
- Acciones fijas de `ActionButtons` (4 botones siempre) y la fila de acciones sin orden configurable.
- Títulos de sección fijos («Menú», «Lo que ofrece», «Pagos», «Reseñas», «Sobre este lugar»): los títulos de sección editables por el negocio van a columna; el resto a copys.

Los datos de `src/lib/dev-place.ts` son un fixture de pruebas para cuentas autorizadas; se ampliará para que la vista previa y los tests manuales cubran los módulos, pero no se trata como contenido público.

---

## 2. Decisiones de arquitectura (y por qué)

### 2.1 Tipo + módulos, no tipos cerrados

```
Tipo principal (uno):     comida_domicilio | cafeteria_restaurante | tienda_mipyme | servicios
Módulos (0..4):           domicilio | local | tienda | servicios
```

- El tipo **solo** aporta: módulos recomendados, título por defecto del catálogo, acciones por defecto y atributos sugeridos.
- Los módulos son ortogonales: una cafetería puede tener `local` + `domicilio`.
- Un negocio sin tipo (`null`) funciona con el esqueleto común y sin módulos. No se le inventa un tipo.
- Los módulos **no** sustituyen los interruptores que ya existen (`pedidosWhatsapp`, `aceptaReservas`): el módulo dice «esta ficha tiene bloque de domicilio»; el interruptor y el plan dicen «se puede pedir ahora».

### 2.2 Columnas en `places`, no tabla 1:1

- Una sola escritura atómica por `PATCH` (sin transacciones en Neon HTTP).
- Cero joins nuevos en `getPlaceById` y en el catálogo cacheado.
- Migración aditiva: todo nullable o con `default`, sin reescribir filas.

### 2.3 JSONB para configuración, columnas para lo que se filtra

- JSONB: `horario`, `acciones`, `entrega`, `como_comprar`, `como_atiende`, `especial_dia`, `menu_categorias`. No se consultan por SQL; se leen enteros con la ficha.
- Columnas: `tipo_negocio`, `modulos_activos`, `atributos`, `color_marca`, `existencias_modo`, `catalogo_actualizado_en`, `catalogo_fuente`, `resena_destacada_id`, `plantilla_pedido`, `cerrado_mensaje`, `catalogo_titulo`, `portada_encuadre`.
- Validación en el servidor con módulos puros reutilizables (`src/lib/ficha/*`), igual que `energia.ts`, `reserva.ts` o `disponibilidad.ts`.

### 2.4 El catálogo no se migra a tabla

`places.menu` es la verdad que leen ficha, carta, pedidos, ofertas y novedades. Moverlo a `place_menu_items` rompería precio libre, ofertas por `productoId` y el guardado atómico. Se amplía el tipo del jsonb con campos opcionales:

```ts
type Disponibilidad = "disponible" | "agotado" | "oculto"; // se añade "oculto"
interface UserPlaceMenuItem {
  // existentes…
  destacado?: boolean;
  duracionMin?: number;               // servicios
  tipoPrecio?: "fijo" | "desde" | "consultar";
  stock?: number;                     // tienda, modo "exacta"
  externalId?: string;                // preparado para ERP
}
```

Compatibilidad: `disponibilidad` ausente = `disponible`; `estaAgotado` ignora `oculto` (se filtra antes); los ítems antiguos no cambian.

### 2.5 Horario propio y estado calculado

`places.horario`:

```ts
type Franja = { abre: string; cierra: string }; // "HH:MM"; cierra <= abre = cruza medianoche
type Horario = {
  semana: Partial<Record<"lun"|"mar"|"mie"|"jue"|"vie"|"sab"|"dom", Franja[]>>; // []/ausente = cerrado
  excepciones: { fecha: string; cerrado: boolean; mensaje?: string; franjas?: Franja[] }[];
};
```

- `src/lib/ficha/horario.ts` (puro): `estadoApertura({ horario, status, now, tz: "America/Havana" })` → `{ abierto, texto, cierraA?, abreA? }`.
- Usa `Intl.DateTimeFormat` con `timeZone: "America/Havana"` (sin dependencias nuevas). Maneja franjas que cruzan medianoche y excepciones por fecha.
- Si `horario` es `null`, se cae al heurístico actual sobre `schedule` (`isOpenNow`), para no romper fichas viejas.
- En la ficha, un componente de cliente recalcula cada 60 s con el mismo módulo: el HTML inicial sale correcto y la caché de 5 minutos no congela el «Abierto»/«Cerrado».

### 2.6 Marca: paleta cerrada

`color_marca` solo acepta valores de una paleta de 8 colores con contraste ≥ 4.5:1 sobre blanco y sobre el texto claro. Se valida en el servidor contra `PALETA_MARCA`; un valor fuera se rechaza con 400 (no se guarda en silencio). La portada de respaldo usa ese color de fondo y el nombre como marca de agua; el logo de respaldo son las iniciales.

> Nota de diseño: los hex del prompt (`#F6F4EE`, `#2E7D3F`, `#E4E1D8`) no son los tokens instalados (`sand #F6F3EC`, `verde-600 #0F7A41`, `ink/5`). Propongo **mapear a los tokens existentes** (pregunta 15) para no introducir un segundo sistema de color.

### 2.7 Copy centralizado

`src/config/ficha.ts`:

```ts
COPY = {
  verMas, verTodas, pagos, abierto, cerrado, cierraA, abreManana,
  comoLlegar, guardar, llamar, whatsapp, compartir, ofertas,
  pedir, reservar, apartar, pedirCita, anadir, quitar,
  actualizadoHace, sinResenas, …
}
```

Además: `TITULO_CATALOGO_POR_TIPO`, `MODULOS_RECOMENDADOS_POR_TIPO`, `ACCIONES_POR_DEFECTO`, `ATRIBUTOS_POR_TIPO`, `MIN_RESENAS_PARA_NOTA`. Ningún componente escribe una etiqueta de interfaz nueva a mano.

---

## 3. Modelo de datos propuesto

### 3.1 Columnas nuevas en `places` (`src/lib/db/schema/places.ts`)

| Columna | Tipo | Default / nulabilidad | Validación | Lo consume |
| --- | --- | --- | --- | --- |
| `tipo_negocio` | text enum | `null` | uno de los 4 | Panel, defaults, módulos |
| `modulos_activos` | text[] | `{}` not null | claves de `MODULOS_FICHA` | Ficha y panel |
| `atributos` | text[] | `{}` not null | claves de `ATRIBUTOS` | Distintivos y tarjetas de módulo |
| `color_marca` | text | `null` | miembro de `PALETA_MARCA` | Portada/logo de respaldo |
| `portada_encuadre` | text enum `centro/arriba/abajo` | `null` | enum | Carrusel (`object-position`) |
| `acciones` | jsonb `{ fila: Accion[]; barra: AccionBarra[] }` | `null` | claves + máx. 4 en fila, 2 en barra | Fila de acciones y barra fija |
| `horario` | jsonb `Horario` | `null` | forma + horas válidas | Estado, horario, SEO |
| `cerrado_mensaje` | text | `null` | ≤ 140 | Aviso de cierre |
| `entrega` | jsonb `EntregaConfig` | `null` | montos ≥ 0, min ≤ max | Tarjeta de domicilio + carrito |
| `como_comprar` | jsonb `{ recoger, apartar }` | `null` | booleanos | Tarjeta tienda |
| `como_atiende` | jsonb `{ conCita, sinCita, aDomicilio }` | `null` | booleanos | Tarjeta servicios |
| `especial_dia` | jsonb `{ titulo, descripcion?, precio, moneda, hasta }` | `null` | fecha ISO, precio texto ≤ 40 | Tarjeta cafetería |
| `catalogo_titulo` | text | `null` | ≤ 40 | Título de la sección de catálogo |
| `menu_categorias` | jsonb `{ nombre, orden }[]` | `null` | nombres únicos, orden entero | Pestañas/orden del catálogo |
| `existencias_modo` | text enum `ninguna/disponible/pocas/exacta` | `disponible` not null | enum | Tienda |
| `catalogo_actualizado_en` | timestamp | `null` | se escribe en servidor | «Actualizado hace X» |
| `catalogo_fuente` | text enum `manual/erp` | `manual` not null | enum | Preparación ERP |
| `resena_destacada_id` | text | `null` | debe pertenecer al negocio | Bloque de reseñas |
| `plantilla_pedido` | text | `null` | ≤ 500 | Mensaje de WhatsApp del pedido |

Notas:

- `modulos_activos` nace vacío **también en negocios nuevos**, salvo que el alta escriba los recomendados. Así ninguna ficha existente empieza a enseñar bloques que su dueño no eligió.
- `atributos` no incluye `planta_electrica`: se deriva de `energia_respaldo` (planta/ambas) para no tener dos verdades.
- `catalogo_actualizado_en` se escribe cuando cambia `menu` (no en cualquier guardado de la ficha), para que «hace X» signifique lo que dice.

### 3.2 Cambios en tablas existentes

| Tabla | Cambio | Motivo |
| --- | --- | --- |
| `place_images` | `seccion text` default `'local'` (`local`/`trabajos`) | Galería del local vs portafolio de servicios |
| `reviews` | `respuesta text` nullable, `respondida_en timestamp` nullable | Respuesta del negocio (pregunta 12) |

No se tocan: `place_hours`, `places.hours_json`, `place_menu_items`, `features`, `schedule`, `payment_methods`, `logo_url`, `short_description`, `energia_respaldo`, `status`.

### 3.3 Contratos JSONB

```ts
type Monto = { monto: number; moneda: string };
type EntregaConfig = {
  costo:
    | { modo: "gratis" }
    | { modo: "consultar" }
    | ({ modo: "fijo" } & Monto)
    | ({ modo: "gratis_desde"; desde: number } & Monto)
    | { modo: "zonas"; zonas: { nombre: string; monto: number }[]; moneda: string };
  tiempo: { min: number; max: number };
  pedidoMinimo?: Monto;
  horario?: Horario; // ausente = el del local
};
type AccionFicha = "como_llegar" | "guardar" | "llamar" | "whatsapp" | "compartir" | "ofertas";
type AccionBarra = "pedir" | "reservar" | "apartar" | "cita" | "como_llegar" | "llamar" | "whatsapp";
type Acciones = { fila: AccionFicha[]; barra: AccionBarra[] };
```

Reglas de visibilidad (servidor y cliente, una sola función en `src/lib/ficha/acciones.ts`):

- `como_llegar` requiere coordenadas (hoy `lat/lng` son `notNull`, así que siempre; si en el futuro se permiten nulas, se oculta).
- `llamar` requiere `phone`; `whatsapp` requiere `whatsapp`; `ofertas` requiere `enlaceSeguidores` (plan + bot).
- `guardar` y `compartir` son de plataforma y siempre están disponibles, pero el dueño puede ocultarlos.
- La fila se recorta a **4** tras filtrar por disponibilidad y respetar el orden.
- La barra fija nunca pinta una acción sin datos: pedir exige `pedidosHabilitado` (plan + interruptor + WhatsApp + carta), reservar exige `reservaHabilitada`, etc.

### 3.4 Valoración

- Nueva lectura `reviewsStatsByPlace(ids)` en `queries.ts`: `count(*)`, `avg(rating)`, y la reseña destacada (join o segunda consulta).
- `PlaceData.rating` deja de venir de `places.rating` y pasa a ser `{ promedio, total }`; se oculta si `total < MIN_RESENAS_PARA_NOTA`.
- Al publicar una reseña (`POST /api/reviews`) se recalcula `places.rating` (para ordenar el directorio) y se invalida el catálogo.
- Script de backfill `scripts/backfill-rating.ts`.

### 3.5 Preparación para el ERP de inventario (sin implementarlo)

- `catalogo_fuente` (`manual`/`erp`) evita que un guardado manual pise una sincronización.
- Cada ítem acepta `externalId`; el sincronizador futuro hará `PATCH /api/places/[id]` con `menu`, `catalogo_fuente: "erp"` y `catalogo_actualizado_en`, autenticado como administración (`x-admin-key`).
- El campo `stock` es el único dato de existencias; los modos de visualización (`disponible`, `pocas`, `exacta`) se derivan de él.
- El webhook/sync se documenta como contrato en `docs/erp-catalogo.md`, pero **no se crea ruta ni tabla** en esta entrega.

---

## 4. Migración de los negocios existentes

### 4.1 Migración de esquema

1. `npm run db:generate` → `0047_ficha_por_tipo.sql` (aditiva).
2. Revisar el SQL: solo `ALTER TABLE … ADD COLUMN` con `default` o nullable, más `place_images.seccion` y `reviews.respuesta`.
3. `npm run db:migrate`.
4. Verificación:
   - `select count(*) from places where tipo_negocio is null;`
   - `select count(*) from place_images where seccion is null;` (debe ser 0)
   - ficha antigua abierta sin errores.

### 4.2 Asignación del tipo principal

Propuesta: **automática para lo inequívoco + revisión humana de lo demás** (pregunta 10).

| `categories.slug` | `tipo_negocio` |
| --- | --- |
| `restaurante`, `cafeteria`, `bar` | `cafeteria_restaurante` |
| `mercado`, `tienda` | `tienda_mipyme` |
| `servicio` | `servicios` |
| resto (`discoteca`, `hospedaje`, `cultura`, `naturaleza`, `playa`, `otro`) | `null` |

- Script `scripts/backfill-tipo-negocio.ts`, idempotente (`where tipo_negocio is null`), con `--dry-run`.
- El script **no enciende módulos** ni escribe atributos: solo el tipo.
- En `/admin/negocios` se añade un filtro «Sin tipo» y un selector rápido para asignarlo. Es la lista de revisión.
- `null` no es un error: la ficha funciona con el esqueleto común.

### 4.3 Datos mezclados en descripciones

No se automatiza la extracción de «tiene planta», «aceptamos Zelle» o «hacemos domicilio» desde texto libre: un parser heurístico escribiría afirmaciones falsas. En su lugar:

- Los campos estructurados ya existen o se crean aquí.
- Se entrega un **reporte** (`scripts/reporte-campos-faltantes.ts`, solo lectura) que marca fichas cuya descripción menciona pagos/planta/domicilio/efectivo y no tienen el campo relleno.
- El dueño (o administración) lo completa desde el panel; el reporte no escribe nada.

### 4.4 Compatibilidad

- `UserPlace` gana **todos los campos nuevos como opcionales** (`?`), para no romper `devPlace()`, `NewUserPlace`, formularios de proyecto, snapshots offline ni búsquedas.
- `toPlaceValues` solo escribe lo que llega (`!== undefined`), como hoy.
- Fichas sin `horario`, `acciones`, módulos o atributos se pintan exactamente como hoy, salvo por la retirada de los rellenos inventados (que es el objetivo).
- Rollback manual documentado: `ALTER TABLE … DROP COLUMN` de las columnas nuevas; no hay datos existentes que se pierdan.

---

## 5. Ficha pública: esqueleto y componentes

### 5.1 Orden final

`portada → cabecera → estado y distintivos → acciones → tarjeta clave → dirección/contacto → sobre el lugar → catálogo → galería → reseñas → barra fija`.

Se respeta en escritorio y móvil (hoy están duplicados en `place-detail.tsx`).

### 5.2 Componentes (nuevos en `src/components/place/ficha/`)

| Componente | Qué pinta | De dónde sale | Si está vacío |
| --- | --- | --- | --- |
| `PortadaMarca` | Foto de portada con encuadre, o fondo `color_marca` + nombre en marca de agua | `place_images.isCover`, `color_marca`, `portada_encuadre` | Fondo de marca; sin marca si tampoco hay color (arena actual) |
| `CabeceraFicha` | Logo o iniciales, nombre, subtítulo, valoración | `logo_url`, `name`, `short_description`, stats de `reviews` | Iniciales; sin subtítulo; sin nota si `< MIN_RESENAS` |
| `EstadoApertura` | «Abierto · cierra a las 6:00 p. m.» / «Cerrado · abre mañana…» | `horario` + `status` + copys | Si no hay horario ni schedule, no se pinta el texto de horas; solo el estado si aplica |
| `Distintivos` | Atributos + planta + sello + top | `atributos`, `energia_respaldo`, `selloVerificado`, `topDelMes` | Se oculta la fila entera |
| `FilaAcciones` | Botones con icono y etiqueta, máximo 4 | `acciones.fila` filtrado | Se oculta |
| `TarjetaClave` | Cambia por módulo; pagos siempre | `entrega` / `como_comprar` / `como_atiende` / `especial_dia` + `payment_methods` | Se ocultan filas vacías; la tarjeta desaparece si no queda nada |
| `DireccionContacto` | Dirección, mapa y enlaces | `address`, `lat/lng`, `phone`, `whatsapp`, `instagram`, `facebook`, `website` | Se oculta cada enlace vacío; la sección desaparece sin dirección ni contactos |
| `SobreElLugar` | Resumen corto + «Ver más» + descripción | `short_description` o recorte de `description` | No aparece |
| `Catalogo` | Título, categorías ordenadas, ítems; variantes menú/servicios/tienda; carrito si domicilio | `menu`, `menu_categorias`, `catalogo_titulo`, `existencias_modo` | No aparece |
| `Galeria` | Fotos del local y portafolio | `place_images` por `seccion` | No aparece |
| `ResenasResumen` | Media, total, destacada y enlace | `reviews` + `resena_destacada_id` | Sin reseñas: bloque mínimo con el botón de opinar, sin cifras |
| `BarraFija` | Acción principal y secundaria | `acciones.barra` + disponibilidad | Si no hay ninguna acción válida, no se pinta |

Se reutilizan los existentes: `PhotoCarousel`, `MenuPages`/`menu-item`, `PaymentsSection`, `EnergiaBadge`, `SelloVerificado`, `TopDelMes`, `ReviewsSection`, `ReviewDialog`, `SeguidorBoton`, `ReservaWhatsApp`, `Dialog`, `Reveal`.

### 5.3 Extracción clave para no romper

- `userPlaceToPlaceData` sale de `place-view.tsx` a `src/lib/ficha/place-data.ts` (puro, sin React). Lo usan la ficha pública y la vista previa del panel. Es el único sitio que traduce `UserPlace → PlaceData`, y se le añade una prueba de que los campos nuevos sobreviven.
- `place-detail.tsx` se parte por secciones, pero **se conserva la estructura de dos maquetas** en esta entrega para reducir riesgo; las secciones nuevas se montan en ambas.
- La rama `isProject` (`ProjectOfferList`, diálogo de fotos, `InfoBar` de fechas) no se modifica: los módulos solo aplican a `!isProject`.

### 5.4 SEO / JSON-LD

`src/lib/structured-data.ts` hoy no emite `aggregateRating` ni `openingHours` (documentado). Con los datos nuevos:

- `aggregateRating` solo si `total >= MIN_RESENAS_PARA_NOTA`.
- `openingHoursSpecification` desde `horario.semana` (excluyendo excepciones).
- `paymentAccepted` ya existe; se mantiene.
- Nada de datos inventados: si falta, no se emite la propiedad.

---

## 6. Módulos por tipo (comportamiento)

### 6.1 Defaults (solo punto de partida)

| Tipo | Módulo recomendado | Título catálogo por defecto | Acciones por defecto |
| --- | --- | --- | --- |
| `comida_domicilio` | `domicilio` | «Lo que ofrece» | cómo llegar, WhatsApp, llamar, compartir |
| `cafeteria_restaurante` | `local` | «Menú» | cómo llegar, llamar, compartir, guardar |
| `tienda_mipyme` | `tienda` | «Productos» | cómo llegar, WhatsApp, compartir, guardar |
| `servicios` | `servicios` | «Servicios y precios» | cómo llegar, WhatsApp, llamar, compartir |

Todos los módulos son activables en cualquier tipo. `acciones.barra` por defecto: la acción del módulo (`pedir`, `reservar`, `apartar`, `cita`) + `como_llegar`.

### 6.2 Domicilio

- **Tarjeta**: costo (gratis / fijo / zonas / gratis desde / a consultar), tiempo estimado (rango), pedido mínimo y zonas. Filas vacías se ocultan; si no hay nada, la tarjeta no se pinta.
- **Carrito**: botón «+» y selector de cantidad en cada ítem disponible; la barra fija dice «Pedir N productos · TOTAL» y abre WhatsApp con `mensajePedido`.
- **Monedas**: se mantiene la regla actual de `totalDePedido`: si hay más de una moneda o un precio sin cifra, **no se muestra total** y el mensaje va con líneas y cantidades. (Pregunta 8: alternativa, totales por moneda.)
- Requiere `pedidosHabilitado` (plan `whatsapp_pedido` + `pedidosWhatsapp` + WhatsApp + carta). Sin eso, el módulo se puede configurar pero la ficha no pinta carrito.
- Plantilla editable `plantilla_pedido` con `{productos}`, `{total}`, `{direccion}`, `{nombre_cliente}`, `{negocio}`; por defecto la actual de `mensajePedido`.

### 6.3 Cafetería / restaurante

- **Especial del día**: `especial_dia`; se oculta cuando `hasta` < hoy (Havana).
- **En el local**: atributos del catálogo marcados como `local.*` (`servicio_en_mesa`, `para_llevar`, `climatizado`, `wifi`, `terraza`, `reservas_grupos`…).
- **Reservas**: se reutiliza `aceptaReservas` + `tipoReserva` + `plantillaReserva`; sin sistema propio.
- **Menú**: sin carrito salvo que `domicilio` esté activo.
- **Portada**: la completitud sube si hay portada (insistencia en el panel, no bloqueo).

### 6.4 Tienda / mipyme

- **Cómo comprar**: `como_comprar` (recoger / apartar) y domicilio si el módulo `domicilio` está activo y configurado.
- **Catálogo**: buscador y cuadrícula si `modulos_activos` incluye `tienda`.
- **Existencias**: `existencias_modo` (`ninguna` no muestra nada; `disponible` disponible/agotado; `pocas` «quedan pocas»; `exacta` «Quedan N» con `stock`).
- **«Actualizado hace X»**: desde `catalogo_actualizado_en`, escrito al guardar el catálogo, no al guardar la ficha.
- **ERP**: ver §3.5.

### 6.5 Servicios

- **Cómo atiende**: `como_atiende` (con cita / sin cita / a domicilio).
- **Turno**: sin agenda en v1; se muestra «Atiende hoy» derivado del horario. Si más adelante hay agenda, el dato ya tiene sitio natural en `reservas` (pregunta 7).
- **Lista de servicios**: `duracionMin`, `tipoPrecio` (`fijo`/`desde`/`consultar`), botón «Reservar» que abre WhatsApp con `{servicio}` usando `plantillaReserva` (se añade la variable `{servicio}`; `{producto}` se mantiene).
- **Trabajos realizados**: `place_images.seccion = 'trabajos'`.

---

## 7. Panel del negocio

### 7.1 Navegación

Se mantienen las vistas actuales (`dashboard`, `catalogo`, `pedidos`, `editor`, `ofertas`, `publicaciones`, `telegram`, `equipo`, `planes`, `settings`) y se añaden dos:

- `modulos`: tipo + módulos + configuración de cada módulo (entrega, cómo comprar, cómo atiende, especial).
- `mensajes`: plantillas de pedido y reserva con vista del mensaje resultante.
- `resenas`: destacar y responder.

`editor` (Editar ficha) se reorganiza en secciones plegables:

1. Portada y marca (portada, encuadre, color, logo).
2. Información (nombre, tipo, categoría, subtítulo, descripción, resumen + generar con IA).
3. Ubicación (existente).
4. Contacto (existente).
5. Horario y cierre (editor estructurado + excepciones + mensaje de cierre).
6. Atributos (catálogo por tipo).
7. Acciones (orden de la fila, máximo 4; principal y secundaria de la barra).
8. Galería (local/trabajos, portada, orden).

### 7.2 Campo ↔ editor ↔ columna

| Sección del prompt | Control | Columna |
| --- | --- | --- |
| Portada, recorte | Subida existente + selector de encuadre | `place_images.isCover`, `places.portada_encuadre` |
| Logo | `LogoUpload` (existente) | `places.logo_url` |
| Color de marca | Paleta de 8 | `places.color_marca` |
| Nombre | Input (existente) | `places.name` |
| Tipo | Select de 4 | `places.tipo_negocio` |
| Subtítulo | Input 80 car. | `places.short_description` |
| Valoración | Solo lectura | `reviews` |
| Horario | Editor de franjas por día + excepciones | `places.horario` |
| Cierre temporal | Select de estado + mensaje | `places.status`, `places.cerrado_mensaje` |
| Distintivos | Chips por tipo | `places.atributos` |
| Planta | Select de energía (existente) | `places.energia_respaldo` |
| Fila de acciones | Orden drag/check, máx. 4 | `places.acciones.fila` |
| Barra fija | Principal + secundaria | `places.acciones.barra` |
| Métodos de pago | Chips + «otro» | `places.payment_methods` |
| Dirección / mapa | Existentes | `places.address`, `lat/lng` |
| Contactos | Existentes | `phone`, `whatsapp`, `instagram`, `facebook`, `website` |
| Descripción | Textarea (existente) | `places.description` |
| Resumen | Textarea 240 car. + «Generar con IA» | `places.short_description` |
| Categorías del catálogo | Lista ordenable | `places.menu_categorias` |
| Título del catálogo | Input 40 car. | `places.catalogo_titulo` |
| Ítems | Editor existente + nuevos campos | `places.menu` |
| Galería | Subida + orden + portada + sección | `place_images` |
| Reseña destacada | Selector | `places.resena_destacada_id` |
| Respuesta a reseña | Textarea | `reviews.respuesta` |
| Plantilla de pedido | Textarea + variables | `places.plantilla_pedido` |
| Plantilla de reserva | Existente | `places.plantilla_reserva` |

### 7.3 Vista previa

- Botón «Vista previa» en el editor: monta `PlaceDetail` con `PlaceData` construido desde el **estado del borrador** (sin guardar), dentro de un `Dialog` a pantalla completa en móvil.
- Requiere extraer `place-data.ts` (§5.3) y que `PlaceDetail` acepte `PlaceData` ya resuelto.
- Si el borrador tiene datos incompletos, se aplican las mismas reglas de ocultación: la vista previa enseña exactamente lo que verá el público.
- No se escribe en la base hasta guardar.

### 7.4 Completitud

`src/lib/ficha/completitud.ts` (puro):

- Calcula un porcentaje ponderado por secciones (portada, logo, color, descripción, resumen, horario, contacto, pagos, catálogo, fotos, módulos configurados).
- Devuelve sugerencias concretas, ordenadas por impacto: «Añade 3 fotos de tus productos», «Tu horario no está configurado».
- Se muestra en el dashboard y en la cabecera del editor.
- No puntúa la valoración ni nada que el negocio no controle.

### 7.5 Validaciones (servidor, no solo cliente)

- WhatsApp/teléfono cubano: `normalizarWhatsappCubano` (existente).
- Precios: texto permitido, pero si `tipoPrecio` es `fijo`/`desde` debe contener una cifra positiva.
- Límites de caracteres: nombre 80, subtítulo 80, resumen 240, descripción 2000, título catálogo 40, mensaje de cierre 140, plantilla 500.
- Color de marca: miembro de la paleta.
- Atributos/módulos/acciones: claves del catálogo; desconocidas → 400 con la lista.
- Montos de entrega: ≥ 0; `min <= max`; zonas con nombre no vacío.
- Imágenes: las comprobaciones existentes de `storage/upload.ts` (tamaño/tipo real).
- Errores con el mismo formato `{ error: string }` que el resto de rutas.

### 7.6 Permisos

- `ficha`: portada, marca, información, horario, atributos, acciones, contacto, ubicación, módulos y configuración, reseñas (destacar/responder), mensajes.
- `catalogo`: `menu`, `menu_categorias`, `catalogo_titulo`, `existencias_modo`.
- El `PATCH` clasifica las claves nuevas en `tocaFicha`/`tocaCatalogo` (hoy solo separa `menu`/`ofertas`).
- La administración sigue pudiendo todo (`canManagePlace`) y `isActive`/`verificado` siguen vetados al dueño.

---

## 8. API y servidor

### 8.1 Rutas modificadas

| Ruta | Cambio |
| --- | --- |
| `PATCH /api/places/[id]` | Lista blanca ampliada en `toPlaceValues`; validación de todos los campos nuevos; `catalogo_actualizado_en` cuando cambia `menu`; clasificación de permisos; `invalidarCatalogo()` |
| `GET /api/places/[id]` | Devuelve los campos nuevos automáticamente (mapper) |
| `POST /api/reviews` | Recalcula `places.rating` y `resenas`; invalida catálogo |
| `POST /api/places/[id]/images` | Acepta `seccion` (`local`/`trabajos`) |
| `PATCH /api/places/[id]/images` (nuevo) | `{ imageId, isCover?, sortOrder?, seccion?, alt? }`; solo `ficha`; una portada; invalida catálogo |
| `POST /api/business` | Nuevo negocio: acepta `tipo_negocio` y escribe módulos recomendados si el formulario los confirma |

### 8.2 Rutas nuevas

| Ruta | Función |
| --- | --- |
| `PATCH /api/reviews/[id]` | Respuesta del negocio (`canManagePlace(id, "ficha")`), límite 500, una respuesta por reseña |
| `POST /api/places/[id]/resumen` | Genera resumen corto desde la descripción con el proveedor de IA configurado; rate limit; devuelve texto, **no guarda** (el dueño lo edita y guarda) |
| `POST /api/places/[id]/resena-destacada` | Valida que la reseña pertenece al negocio y guarda `resena_destacada_id` (o `null` para quitarla) |

### 8.3 IA del resumen

- Reutiliza el patrón de `src/lib/ai/publicaciones.ts` (proveedores configurables, sin clave en el cliente).
- Si no hay proveedor configurado, el botón no se pinta (no se muestra una acción que fallará).
- Límite de longitud y saneado del texto devuelto; el dueño siempre puede editarlo.

### 8.4 Integraciones que hay que mantener

- `src/lib/ai/embedding.ts`: añadir atributos e ítems nuevos (destacados, servicios) al texto que se vectoriza, y `planta` ya está.
- `src/lib/structured-data.ts`: `aggregateRating` y `openingHoursSpecification` (§5.4).
- `src/lib/seguidores.ts` y `avisarCambios`: sin cambios; las novedades ya cubren productos y ofertas.
- `src/lib/offline/snapshots.ts`: añadir `tipo`, módulos, `horario`, `entrega` solo si `public/offline.html` los usa; si no, dejarlo como está (los campos nuevos son opcionales).
- `src/lib/dev-place.ts`: ampliar el fixture con `tipo_negocio`, módulos, horario, entrega y atributos para que la vista previa y las pruebas manuales los cubran.

---

## 9. Orden de implementación (las 6 fases del prompt)

Cada fase termina con un aviso y una verificación. No se empieza la siguiente sin cerrar la anterior.

### Fase 1 — Modelo de datos y migraciones

1. Módulos puros: `src/lib/ficha/tipos.ts`, `atributos.ts`, `acciones.ts`, `horario.ts`, `pagos.ts`, `copys.ts` (`src/config/ficha.ts`).
2. Columnas nuevas en `places.ts` + `place_images.seccion` + `reviews.respuesta`.
3. `db:generate` y revisión del SQL; `db:migrate`.
4. `UserPlace` (todos opcionales) + `toUserPlace` + `toPlaceValues`.
5. Scripts: `backfill-tipo-negocio.ts`, `backfill-rating.ts`, `reporte-campos-faltantes.ts`.
6. Pruebas de los módulos puros.
7. Verificación: typecheck, tests, ficha antigua y negocio de prueba abren igual.

### Fase 2 — Esqueleto común de la ficha pública

1. Extraer `place-data.ts` y añadir sus campos.
2. `PortadaMarca`, `CabeceraFicha`, `EstadoApertura`, `Distintivos`, `FilaAcciones`, `DireccionContacto`, `SobreElLugar`, `Galeria`, `ResenasResumen`, `BarraFija`.
3. Retirar rellenos inventados; copy desde `src/config/ficha.ts`.
4. JSON-LD y metadata con los datos nuevos.
5. Verificación: ficha con todos los campos, ficha sin ninguno, proyecto intacto.

### Fase 3 — Módulos por tipo

1. `TarjetaClave` + tarjetas de domicilio, local, tienda y servicios.
2. `Catalogo` con variantes (menú, servicios, tienda), categorías ordenadas y estados (`disponible`/`agotado`/`oculto`).
3. Carrito en la ficha (domicilio) reutilizando `pedido.ts` y la plantilla.
4. Especial del día, portafolio, reservas y enlaces de WhatsApp por servicio.
5. Verificación: cada tipo por separado y uno mixto (cafetería + domicilio).

### Fase 4 — Panel de edición

1. Editor por secciones + vista previa + completitud.
2. Editor de horario estructurado (sustituye el `HoursEditor` actual, que no guardaba).
3. Editores de atributos, acciones, marca, módulos, entrega, cómo comprar/atiende, especial y mensajes.
4. Catálogo: título, categorías, destacado/oculto, stock, duración/tipo de precio.
5. Galería: secciones, orden y portada; `PATCH` de imágenes.
6. Reseñas: destacar y responder.
7. Perfil: tipo en el alta (`business-view.tsx`) y `curatedInput` de `/api/business`.
8. Verificación: cada campo se guarda, recarga y se ve en la ficha; permisos de trabajador.

### Fase 5 — Migración de datos y revisión de fichas reales

1. Ejecutar backfills en dry-run, revisar y aplicar.
2. Revisar la lista «Sin tipo» en `/admin/negocios`.
3. Recorrer 5 fichas reales de cada tipo y una sin tipo; comparar antes/después.
4. Reporte de campos que la descripción sugiere y no están rellenos.
5. Verificación: ninguna ficha pierde datos; ninguna muestra placeholders.

### Fase 6 — Pruebas y cierre

1. Unitarias de `horario`, `acciones`, `completitud`, `validacion`, `place-data`, `pedido`, `reserva`.
2. `node --import tsx --test` completo.
3. `npm run typecheck`, `npm run lint`, `npm run build`.
4. Manual: ficha pública (móvil/escritorio), `/m/[slug]`, panel, administración, negocio de prueba, proyecto.
5. Documento de cierre: qué se decidió, qué quedó pendiente y qué debe revisar el usuario.

---

## 10. Estrategia de pruebas y verificación

### 10.1 Automáticas

- `src/lib/ficha/horario.test.ts`: abierto/cerrado, varias franjas, cruce de medianoche, excepción que cierra, excepción que abre, cierre temporal, `America/Havana`, día siguiente.
- `src/lib/ficha/acciones.test.ts`: filtrado por datos, orden, máximo 4, barra sin datos.
- `src/lib/ficha/completitud.test.ts`: porcentajes y sugerencias.
- `src/lib/ficha/validacion.test.ts`: claves, montos, longitudes, paleta.
- `src/lib/ficha/place-data.test.ts`: los campos nuevos sobreviven a `UserPlace → PlaceData`; vacío se oculta.
- Actualizar `src/lib/pedido.test.ts` (plantilla) y `src/lib/reserva.test.ts` (`{servicio}`).
- Los tests existentes deben seguir pasando sin cambios de comportamiento.

### 10.2 Manuales mínimos por fase

- Ficha real con datos antiguos (sin columnas nuevas).
- Ficha con todos los campos y cada módulo encendido.
- Ficha con módulos apagados.
- Proyecto (`isProject`) sin cambios visuales.
- Negocio de prueba (fixture + override).
- Panel en 390 px de ancho.
- Trabajador con permiso solo de catálogo: no puede tocar la ficha.

### 10.3 Criterios de aceptación

- Ningún texto de negocio hardcodeado en componentes.
- Ningún hueco se pinta como placeholder público.
- Ningún dato visible sin editor en el panel.
- Las fichas existentes siguen abriendo y no pierden contenido.
- Los planes no cambian: las funciones de pago siguen bloqueadas igual.

---

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| `place-detail.tsx` es grande y duplica maquetas | Se extraen secciones una a una, conservando las dos maquetas; el proyecto no se toca; se verifica ficha real en cada paso |
| El `PATCH` es lista blanca y puede perder campos | Se añaden los campos a `toPlaceValues` antes que a la UI; prueba de que un `PATCH` parcial no borra el resto |
| La caché de 5 min congela el estado abierto/cerrado | Cálculo en cliente con el mismo módulo puro, cada 60 s |
| `places.rating` está desactualizado | Se deja de usar en la ficha (stats vivos) + backfill |
| Un módulo podría abrir funciones de pago | El carrito exige `pedidosHabilitado`; las reservas `reservaHabilitada`; el servidor vuelve a comprobarlo |
| `horario` en jsonb puede guardar basura | Validación estricta en `PATCH` + pruebas; se rechaza con 400, no se corrige en silencio |
| Fichas viejas sin tipo/módulos | Todo nullable/opcional; heurístico de `schedule` como respaldo; `null` es un estado válido |
| Escrituras de imágenes sin transacción | `PATCH` de una sola fila; una portada por negocio (se apaga la anterior en la misma sentencia) |
| Copys nuevos repartidos | Un solo `src/config/ficha.ts`; revisión de que ningún componente introduce etiquetas nuevas |

---

## 12. Preguntas abiertas (con el valor por defecto que propongo)

> Si no respondes, implemento con el valor por defecto y lo dejo anotado. Las que más cambian el resultado son la 2, la 4, la 5, la 10 y la 14.

**Confirmadas el 2026-11-02, con el valor por defecto:** 2 (mínimo 3 reseñas
para enseñar promedio), 4 (atributos solo del catálogo), 5 (reutilizar el bot
de Telegram actual para «Ofertas»), 10 (`null` + lista «Sin tipo» en
administración), 14 (módulos gratis; no cambian precios ni gating) y 15 (mapear
los colores del mockup a los tokens instalados). Las demás siguen con su valor
por defecto hasta que se diga lo contrario.

**Producto y modelado**

1. **Tipo + módulos**: ¿confirmas «tipo principal + módulos activables» (mi propuesta) o prefieres tipos cerrados? *Defecto: tipo + módulos.*
2. **N de reseñas** para enseñar el promedio: ¿3, 5 u otro? *Defecto: 3.*
3. **Color de marca**: ¿paleta limitada de 8 colores (mi propuesta) o color libre con validación de contraste? *Defecto: paleta limitada.*
4. **Atributos**: ¿solo catálogo predefinido por tipo, o los negocios pueden crear atributos propios? *Defecto: solo catálogo; propios quedan para v2.*
5. **«Ofertas» / avisos**: hoy el botón de suscripción es el bot de Telegram (`seguidores`, plan Pro) y además hay push de la app. ¿Reutilizo ese canal o quieres un sistema nuevo? *Defecto: reutilizar el actual.*
6. **Reservas**: ¿solo WhatsApp (lo que ya existe) o sistema de reservas propio con confirmación? *Defecto: solo WhatsApp en v1.*
7. **Agenda / turnos**: no existe. ¿Muestro «Atiende hoy» desde el horario (mi propuesta) o quieres campo manual de «próximo turno»? *Defecto: «Atiende hoy» desde el horario.*
8. **Pedidos con monedas mezcladas**: ¿no mostrar total (comportamiento actual) o totales separados por moneda? *Defecto: no mostrar total y mandar las líneas completas.*
9. **Existencias de tienda**: ¿modo por defecto «disponible/agotado» y los demás opcionales? *Defecto: sí.*

**Datos y migración**

10. **Negocios existentes sin tipo claro** (discoteca, hospedaje, cultura, naturaleza, playa): ¿los dejo en `null` para que los revises uno a uno, o les asigno un tipo por aproximación? *Defecto: `null` + lista «Sin tipo» en administración.*
11. **«Especial del día»**: ¿vigencia hasta una fecha (mi propuesta) o rango con hora? *Defecto: fecha de fin, se oculta al pasar.*
12. **Reseñas**: ¿el negocio puede responder y elegir la destacada (mi propuesta), solo una de las dos, o ninguna? *Defecto: las dos.*
13. **Vista previa**: ¿dentro del panel con el borrador (mi propuesta) o una URL pública con token? *Defecto: en el panel.*
14. **Planes**: ¿los módulos nuevos son gratis y solo las funciones que ya se pagan siguen atadas al plan? *Defecto: sí, no cambiar precios ni gating.*
15. **Colores de los mockups** (`#F6F4EE`, `#2E7D3F`, `#E4E1D8`) frente a los tokens instalados (`#F6F3EC`, `#0F7A41`, `sand-deep #EAE4D6`): ¿mapeo a los tokens existentes (mi propuesta) o quieres que ajuste los tokens del sistema? *Defecto: mapear a tokens.*

---

## Anexo A — Catálogo de atributos (propuesta inicial)

- **Comunes**: wifi, terraza, climatizado, música, estacionamiento, pet friendly, opciones vegetarianas, enchufes, accesible, área para fumadores.
- **Local**: servicio en mesa, para llevar, reservas para grupos, barra, vista.
- **Tienda**: recoger en tienda, apartar por WhatsApp, venta mayorista, entrega a domicilio (derivado del módulo).
- **Servicios**: con cita, sin cita, a domicilio, garantía.
- **Destacado**: planta eléctrica (derivado de `energia_respaldo`, no editable aquí).

Cada atributo tiene: `clave`, `label`, `icono` (Lucide), `tipos` donde se sugiere, `destacado` (planta).

## Anexo B — Paleta de marca (propuesta)

8 colores con contraste AA sobre blanco y sobre texto claro: verde La Verde, verde oscuro, azul, teal, ámbar oscuro, terracota, ciruela y gris carbón. Se guarda el hex; el panel solo permite elegir de la lista.

## Anexo C — Archivos nuevos previstos

```
src/lib/ficha/tipos.ts            tipo, módulos y defaults
src/lib/ficha/atributos.ts        catálogo de atributos
src/lib/ficha/acciones.ts         disponibilidad y orden de acciones
src/lib/ficha/horario.ts          horario + estado de apertura
src/lib/ficha/entrega.ts          validación/normalización de la tarjeta de domicilio
src/lib/ficha/completitud.ts      porcentaje y sugerencias
src/lib/ficha/validacion.ts       validadores compartidos
src/lib/ficha/place-data.ts       UserPlace → PlaceData (extraído de place-view)
src/lib/ficha/pagos.ts            catálogo de métodos de pago
src/config/ficha.ts               COPY y defaults por tipo
src/components/place/ficha/*      secciones nuevas de la ficha
src/components/business/ficha/*   editores nuevos del panel
src/app/api/places/[id]/resumen/route.ts
src/app/api/places/[id]/resena-destacada/route.ts
src/app/api/reviews/[id]/route.ts
scripts/backfill-tipo-negocio.ts
scripts/backfill-rating.ts
scripts/reporte-campos-faltantes.ts
docs/erp-catalogo.md
```

## Anexo D — Archivos que no se tocan (a propósito)

- `src/app/(main)/projects/**` y la rama `isProject` de `place-detail.tsx`.
- `place_hours`, `places.hours_json`, `place_menu_items` (legado sin escritores).
- `features` (sigue alimentando la IA; se rellena desde atributos sin cambiar su forma).
- `src/lib/plans.ts` y el gating de planes (salvo que la pregunta 14 diga lo contrario).
- `src/lib/seguridad`/analytics/push: sin cambios.
