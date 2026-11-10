# Funcionalidad 3: Servicios por tipo de negocio

## Contexto

La Verde deja de ofrecer un único conjunto de servicios igual para todos. Cada negocio tiene un **tipo** (cafetería, barbería, mipyme…) y, según su tipo, ve los servicios que de verdad le sirven:

- los que ya tiene,
- los que puede activar ahora,
- los que vienen pronto,
- los que se arman en un pack a medida.

Esta funcionalidad crea:
1. El catálogo de servicios.
2. Los 15 tipos de negocio con sus servicios recomendados.
3. La sección «Para tu negocio» en el panel.
4. La edición desde administración.

El pago del pack a medida es la funcionalidad 4. **No la implementes aquí.**

## Reglas del proyecto

- **Fuente de verdad:** `src/lib/plans.ts` sigue siendo la única. Las funciones (`Funcion`) siguen siendo lo que abre o cierra permisos. Un servicio es una **agrupación visible para el usuario** de una o más funciones, o un módulo externo. No sustituye a las funciones.
- **Catálogo vivo:** `cargarCatalogo()` y `normalizarCatalogo`. Desde `/admin/planes` se editan textos, orden y recomendaciones, pero nunca las claves.
- **Permisos:** con `puede()` / `funcionesDeNegocio` en el servidor.
- **«Próximamente se vende, pero no se abre»:** las funciones con `disponible: false` se muestran con candado.
- **Migraciones:** `db:generate` y `db:migrate`, nunca `db:push`.
- **`business-panel.tsx`:** no le añadas lógica. Componentes nuevos, montados con el mínimo cambio.
- **Generales:** sin dependencias nuevas. UI, código y comentarios en español.

## Antes de empezar: revisa lo que ya existe

1. **`places.tipo_negocio`:** qué valores tiene hoy, dónde se escribe y dónde se usa.
2. **`places.modulos_activos`:** qué guarda y quién lo usa.
3. **`places.especial_dia`, `como_comprar` y `como_atiende`:** qué son, por si alguno ya cubre un servicio de la lista (por ejemplo, el menú del día).
4. **Relación entre `categories` y el tipo de negocio:** cuántas categorías hay y si se pueden mapear a los 15 tipos.
5. **Recuento por tipo:** cuántos negocios hay hoy por cada valor de `tipo_negocio` y de categoría.

Cuéntame lo que encuentres y propón cómo encajar los 15 tipos **reutilizando `tipo_negocio`** si es posible. Espera mi visto bueno antes de seguir.

## Qué hay que hacer

### 1. Tipos de negocio

Define en `src/lib/plans.ts` (o en `src/lib/tipos-negocio.ts` si `plans.ts` crece demasiado, exportado desde `plans.ts`) los 15 tipos, con clave fija, nombre, icono de Lucide y las categorías que les corresponden por defecto:

| Clave | Nombre | Icono |
| --- | --- | --- |
| `mipyme` | Mipyme de alimentos y productos varios | `Store` |
| `cafeteria` | Cafetería | `Coffee` |
| `restaurante` | Restaurante o paladar | `UtensilsCrossed` |
| `comida_domicilio` | Comida a domicilio | `Bike` |
| `dulceria` | Dulcería, panadería o repostería | `CakeSlice` |
| `bar` | Bar o club | `Wine` |
| `belleza` | Barbería, peluquería o salón de belleza | `Scissors` |
| `hospedaje` | Renta de habitaciones u hostal | `BedDouble` |
| `servicio_tecnico` | Servicios técnicos | `Wrench` |
| `taller` | Taller mecánico o ponchera | `Car` |
| `ropa` | Tienda de ropa, calzado o accesorios | `Shirt` |
| `ferreteria` | Ferretería o materiales | `Hammer` |
| `clases` | Gimnasio, academia o clases | `Dumbbell` |
| `transporte` | Transporte, mensajería o taxis | `Truck` |
| `eventos` | Fotografía, eventos y decoración | `Camera` |

Cada negocio tiene **un** tipo:
- Si `tipo_negocio` ya existe y sirve, migra sus valores a estas claves con una migración de datos.
- Si un negocio no tiene tipo, se le sugiere uno a partir de su categoría, y el dueño lo confirma o lo cambia.

### 2. Catálogo de servicios

En `src/lib/plans.ts`, define `SERVICIOS`. Cada servicio tiene:

```ts
{
  clave: string,                 // fija, no editable
  nombre: string,                // editable desde admin
  linea: string,                 // una sola línea de «para qué te sirve», editable
  icono: string,                 // nombre del icono de Lucide
  tipo: 'interno' | 'externo',   // 'externo' = módulo en el VPS
  funciones: Funcion[],          // las funciones que abre (vacío en los externos)
  modulo?: ClaveModulo           // el módulo suelto que lo vende, si existe
}
```

**El estado no se guarda en el servicio:** se calcula.

| Estado | Cuándo |
| --- | --- |
| `disponible` | Todas sus funciones tienen `disponible: true` |
| `proximamente` | Alguna está en `disponible: false` |
| `externo` | `tipo: 'externo'`. Por ahora todos `proximamente`, hasta que la conexión con el VPS exista |

**Servicios que ya existen** (agrúpalos sobre las funciones actuales):

| Servicio | Funciones |
| --- | --- |
| Pin en el mapa y búsqueda con IA | `pin`, `busqueda_ia`, `prioridad_ia` |
| Catálogo online con «Hoy hay» | `menu_qr`, `hoy_hay`, `fotos_ilimitadas`, `qr_sin_marca` |
| Ofertas y novedades | `ofertas_flash` |
| Pedidos por WhatsApp | `whatsapp_pedido` |
| Reservas de mesa / Citas / Apartados | `reservas_whatsapp` (un servicio visible por tipo de reserva, con la misma función) |
| Tasa del día | `tasa_del_dia` |
| Zonas y costo de domicilio | `zonas_domicilio` |
| Publicaciones en Facebook | `publicaciones_fb`, `publicaciones_fb_3` |
| Avisos a tus seguidores | `seguidores` |
| Asistente de Telegram | `telegram_menu`, `asistente_ia` |
| Estadísticas | `stats_basicas`, `stats_completas` |
| Ranking mensual | `ranking` |
| Eventos y pin destacado | `eventos`, `destacado_semana` (ya en Próximamente) |
| Flyers | `flyers` (ya en Próximamente) |
| Cupones por WhatsApp | `cupones_whatsapp` (ya en Próximamente) |

**Servicios nuevos:** añade su función en `plans.ts` con `disponible: false`, para que salgan como «Próximamente»:

| Clave de función | Servicio visible |
| --- | --- |
| `avisame_cuando_haya` | Avísame cuando haya |
| `kit_estados` | Kit para estados de WhatsApp |
| `cliente_frecuente` | Cliente frecuente (sellos) |
| `recordatorio_cita` | Recordatorio de cita |
| `agenda_profesional` | Agenda por profesional |
| `presupuesto_whatsapp` | Presupuesto rápido por WhatsApp |
| `estado_reparacion` | Estado de reparación con código |
| `calendario_disponibilidad` | Calendario de disponibilidad |
| `anticipo` | Anticipo en reservas y encargos |
| `encargos` | Pedidos por encargo |
| `precios_mayor` | Lista de precios por mayor |
| `horario_cocina` | Horario de cocina y pedidos programados |
| `menu_del_dia` | Menú del día (si `especial_dia` ya lo cubre, úsalo y márcalo como disponible) |
| `variantes_producto` | Tallas, colores y variantes |
| `cartelera` | Cartelera semanal |
| `horario_clases` | Horario de clases con cupos |
| `tarifas_zona` | Tarifas por zona o recorrido |
| `paquetes_eventos` | Paquetes y fechas ocupadas |

**Servicios externos** (`tipo: 'externo'`, sin funciones por ahora):

| Clave | Servicio visible |
| --- | --- |
| `sistema_gestion` | Sistema de gestión: inventario, caja y ventas |
| `comandas` | Comandas por mesa |
| `membresias` | Membresías y asistencia |
| `gestion_reparaciones` | Órdenes de reparación |
| `gestion_huespedes` | Gestión de huéspedes |

### 3. Recomendaciones por tipo

En `plans.ts`, define `RECOMENDACIONES: Record<TipoNegocio, Array<{ servicio, prioridad, porQue }>>` con lo que ya está decidido en el documento de servicios por categoría (te lo paso aparte, o cópialo de `SERVICIOS-POR-CATEGORIA.md` si está en el repo).

- **`porQue`:** una línea específica del tipo. Por ejemplo, para cafetería: «Que te pidan sin llamarte».
- **La base común** (mapa, ficha, reseñas, Facebook, Telegram, avisos y equipo) se define una sola vez y se añade a todos los tipos.
- **Edición:** las recomendaciones van en el catálogo vivo, así que desde `/admin/planes` se puede cambiar el orden, quitar o añadir servicios a un tipo y editar el `porQue`. Ajusta `normalizarCatalogo` para que mezcle con los valores de fábrica.

### 4. Lógica de servidor

En `src/lib/servicios-server.ts`, la función `serviciosParaNegocio(negocioId)`:

1. Lee el tipo del negocio, el catálogo vivo y `funcionesDeNegocio`.
2. Devuelve los servicios recomendados para su tipo, ordenados por prioridad y agrupados así:

| Grupo | Cuándo |
| --- | --- |
| `lo_tienes` | El negocio ya tiene todas sus funciones |
| `activalo` | Está disponible y se vende como módulo suelto o en un pack. Incluye el precio en USD y en CUP, con `cupDe` y la tasa de `/admin/planes` |
| `proximamente` | Está en Próximamente o es externo |

Cada servicio lleva su `porQue`, su icono y, si aplica, el texto de bloqueo de `bloqueoDe`.

### 5. Panel del negocio

**Elegir o confirmar el tipo:**

- **Si el negocio no tiene tipo:** al entrar al panel, una tarjeta en el Dashboard: «¿Qué tipo de negocio tienes?». Muestra una cuadrícula con los 15 tipos (icono y nombre), con el sugerido según su categoría ya marcado.
- **Para cambiarlo después:** en el Editor de ficha, como un campo más. El componente va aparte y se monta ahí.
- **Al guardar:** ruta `PATCH /api/places/[id]/tipo`, con `accesoNegocio`, validación de que la clave existe y un evento de analítica `tipo_negocio_elegido`.

**Componente nuevo `src/components/business/para-tu-negocio.tsx`:** se monta arriba del todo en la vista `planes`, encima de `PlansSection`.

- **Cabecera:**
  - Título: «Para tu {nombre del tipo}».
  - Línea de apoyo: «Esto es lo que más le sirve a un negocio como el tuyo».
  - Un enlace pequeño «Cambiar tipo».
- **Tres bloques**, en este orden:
  1. **«Ya lo tienes»:** tarjetas compactas con un check.
  2. **«Actívalo ahora»:** tarjetas con el icono, el nombre, el `porQue`, el precio y un botón que lleva al módulo correspondiente en `modulos-editor.tsx` o al pack que lo incluye. Usa el flujo de contratación que ya existe, no crees otro.
  3. **«Muy pronto»:** tarjetas atenuadas con candado y el texto «Próximamente».
- **Al final:** una tarjeta destacada, «Arma tu pack a medida». Línea: «Estudiamos tu negocio y te armamos solo lo que vas a usar». Por ahora, el botón abre WhatsApp con La Verde, con un mensaje ya escrito:

```
Hola, quiero mi pack a medida.
Negocio: {nombre}
Tipo: {tipo}
Me interesan: {servicios que marcó}
```

  - **Selección:** el dueño puede marcar servicios de los tres bloques con un check antes de pulsar el botón.
  - **El número de WhatsApp de La Verde:** sale de `src/config/site.ts`. Si no existe, crea la constante y avísame para ponerle el número.

### 6. Alta de negocio (onboarding)

Donde se da de alta un negocio nuevo (componentes de `onboarding/` o el flujo que use el dueño), añade el paso de elegir el tipo con la misma cuadrícula. Después, una vista previa de solo lectura: «Esto es lo que te puede ayudar», con sus 4 a 6 servicios principales.

### 7. Administración

- **En `/admin/planes`, una pestaña nueva «Tipos de negocio»:**
  - lista de tipos,
  - al abrir uno, sus servicios recomendados, que se pueden reordenar, quitar o añadir de `SERVICIOS`,
  - el `porQue` editable.
- **En la misma página, una lista de servicios:** nombre y línea editables, y el estado calculado (disponible, próximamente o externo), de solo lectura.
- **En `/admin` negocios:** una columna con el tipo y un filtro por tipo.
- **En `/admin` analítica:** un recuento de negocios por tipo.

### 8. Offline y analítica

- **Offline:** añade el tipo de negocio al `place` reducido del snapshot.
- **Analítica:** registra estos eventos:
  - `tipo_negocio_elegido`,
  - `servicio_recomendado_click` (con la clave del servicio y el grupo),
  - `pack_a_medida_solicitado` (con los servicios marcados).

### 9. Diseño e integración visual

Igual que en las funcionalidades anteriores:

- **Skills:** `ui-ux-pro-max` al planificar, `design-taste-frontend` al construir e `impeccable` para revisar. Si chocan con el diseño actual, manda el diseño actual.
- **Tokens y componentes:** los del proyecto (`verde-*`, `ink`, `muted-foreground`, `bg-card`, radios `lv`, espacios semánticos, `PlanCard` como referencia visual, `Badge`, `Sheet` y `sonner`). Nada de `bg-white` en componentes nuevos.

**Cuadrícula de tipos:**
- 3 columnas en móvil y 5 en escritorio.
- Cada celda con un icono grande y un nombre corto. Muestra solo la primera parte del nombre si es largo, por ejemplo «Barbería o salón».
- La celda seleccionada con borde `verde-500` y un anillo suave, igual que `FormSection` abierta.

**Tarjetas de servicio:**
- Una sola línea de apoyo, el `porQue`.
- **«Ya lo tienes»:** compactas.
- **«Actívalo ahora»:** con precio y botón.
- **«Muy pronto»:** atenuadas y con candado, pero legibles con contraste AA.

**Tarjeta «Arma tu pack a medida»:** destacada, con el estilo del plan recomendado en `PlanCard` (o `primary-halo`), sin romper la sobriedad del panel.

**Estados que hay que resolver:**
- negocio sin tipo,
- tipo sin servicios en «Actívalo ahora»,
- todo contratado,
- sin conexión: muestra lo del snapshot y desactiva los botones.

**Móvil:** pruébalo a 360 px, con áreas táctiles de 44 px. Los checks de selección son fáciles de tocar.

**Textos:**

| Dónde | Texto |
| --- | --- |
| Elegir tipo | «¿Qué tipo de negocio tienes?» |
| Título de la sección | «Para tu {tipo}» |
| Bloques | «Ya lo tienes» · «Actívalo ahora» · «Muy pronto» |
| Pack a medida | «Arma tu pack a medida» y «Estudiamos tu negocio y te armamos solo lo que vas a usar» |
| Botón | «Quiero mi pack» |

## Cómo trabajar

1. Haz primero la revisión de lo que ya existe y espera mi visto bueno.
2. Luego dime qué archivos vas a crear y modificar, dónde va cada elemento de la UI y con qué componentes. Espera mi visto bueno otra vez.
3. Implementa en este orden:
   1. Tipos, servicios y recomendaciones en `plans.ts`, con la normalización del catálogo
   2. Migración de datos de `tipo_negocio`
   3. `servicios-server.ts`
   4. Rutas de API
   5. Elegir tipo en el panel y en el onboarding
   6. `para-tu-negocio.tsx`
   7. Administración
   8. Offline y analítica
4. Haz la revisión de diseño con `impeccable`, si está instalada.
5. Ejecuta el typecheck, el lint y el build, y corrige lo que falle.

## Comprobación final

Dame esta lista marcada:

- [ ] Las funciones nuevas están en `disponible: false` y salen como «Próximamente» en toda la app, incluido `PlanCard`.
- [ ] Ninguna función nueva abre nada que no exista: `puede()` sigue dando falso para ellas.
- [ ] Los negocios existentes tienen tipo, migrado o sugerido, y nadie perdió datos.
- [ ] «Para tu negocio» muestra los tres grupos correctos según el plan real del negocio, contando pack, módulos y trial.
- [ ] Los precios de «Actívalo ahora» salen del catálogo vivo, en USD y en CUP.
- [ ] El botón de activar usa el flujo de contratación que ya existe.
- [ ] El mensaje de «Quiero mi pack» llega a WhatsApp con el negocio, el tipo y los servicios marcados.
- [ ] Desde `/admin/planes` se pueden editar recomendaciones y textos, y los cambios se ven en el panel (teniendo en cuenta la caché de 300 s).
- [ ] Un trabajador sin permiso sobre Planes no ve la sección.
- [ ] El snapshot offline incluye el tipo de negocio.
- [ ] Coherente con el resto de la app a 360 px, con todos los estados resueltos.
- [ ] Contraste AA y etiquetas correctas.
- [ ] Typecheck, lint y build sin errores.

Termina con un resumen de los archivos tocados, cómo quedaron mapeados los tipos con las categorías y cualquier decisión que hayas tomado por tu cuenta.
