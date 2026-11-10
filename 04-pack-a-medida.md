# Funcionalidad 4: Pack a medida con pago y 2x1

## Contexto

Con la funcionalidad 3, el negocio ve los servicios de su tipo y pide su pack a medida. Esta funcionalidad cierra el ciclo:

1. La solicitud llega a administración.
2. El administrador arma el pack para ese negocio: elige los servicios y fija el precio.
3. El negocio lo recibe en su panel, ve exactamente qué incluye y cuánto cuesta, y lo paga con QvaPay.
4. **En el primer contrato, paga un mes y se lleva dos (2x1).**
5. Después se renueva cada mes al mismo precio, con los recordatorios de pago que ya existen.

El cliente sabe el precio desde el principio, y el servicio queda contratado y pagado antes de empezar a trabajar en él.

**Requisito:** las funcionalidades 1, 2 y 3 ya están implementadas.

## Reglas del proyecto

- **Permisos:** se resuelven en servidor con `funcionesDeNegocio` → `Set<Funcion>`. El pack a medida es **una fuente más de funciones**, igual que el pack estándar, los módulos sueltos y el trial.
- **El servidor decide el precio.** El cliente solo dice «acepto el pack con este id». Nunca manda un precio.
- **Pagos:** se usa el flujo de QvaPay que ya existe:
  - el servidor crea la factura y guarda el intento en `pagos`,
  - el webhook marca el pago y aplica el derecho en una sola transacción.

  No crees un flujo de pago paralelo.
- **Un plan no borra datos:** si el pack vence o se cancela, se pierde el acceso, pero no se borra nada.
- **Solo se vende lo que existe.** Un pack a medida solo puede incluir servicios en estado `disponible`. Los «Próximamente» y los externos no se pueden incluir hasta que estén disponibles.
- **Catálogo vivo:** `cargarCatalogo()`. Los precios en CUP con `cupDe` y la tasa de `/admin/planes`.
- **Migraciones:** `db:generate` y `db:migrate`, nunca `db:push`.
- **`business-panel.tsx`:** no le añadas lógica. Componentes nuevos montados con el mínimo cambio.
- **Generales:** sin dependencias nuevas. UI, código y comentarios en español.

## Antes de empezar: revisa lo que ya existe

Lee el código y cuéntame:

1. **Columnas de `suscripciones`:** cómo se guardan el pack, los módulos sueltos, el trial y el vencimiento, y cómo los lee `aSuscripcion` / `funcionesDe`.
2. **El flujo completo de QvaPay:**
   - archivo que crea la factura,
   - archivo del webhook,
   - cómo se aplica el derecho en la transacción,
   - qué se guarda en `pagos`,
   - cómo se calcula hoy el precio.
3. **Recordatorios de pago:** cómo funcionan (`recordatorios_pago` y el cron) y de qué fuente sacan el vencimiento.
4. **Descuento manual por negocio (0–100 %):** dónde se guarda y dónde se aplica.
5. **La sección «Solicitudes» de administración:** qué tabla usa y qué tipos de solicitud admite.
6. **Correo con Resend y notificaciones internas y push:** qué helpers hay para avisar a un dueño.
7. **El trial de 30 días de Pro para negocios nuevos:** dónde se crea.

Con eso, propón cómo encaja el pack a medida y espera mi visto bueno.

## Qué hay que hacer

### 1. Datos (migración Drizzle)

**Tabla nueva `packs_medida`** (`src/lib/db/schema/packs_medida.ts`):

| Columna | Tipo | Para qué |
| --- | --- | --- |
| `id` | texto, PK | Identificador |
| `negocio_id` | FK a `places` | El negocio del pack |
| `estado` | enum: `borrador`, `enviado`, `pagado`, `vencido`, `cancelado`, `rechazado` | Ciclo de vida del pack |
| `servicios` | text[] | Claves de `SERVICIOS` incluidas |
| `funciones` | text[] | Funciones resultantes, calculadas en el servidor al guardar |
| `precio_usd` | numérico | Precio mensual final |
| `precio_sugerido_usd` | numérico | Lo que costarían los módulos por separado, como referencia |
| `oferta_2x1` | booleano | Si el primer pago cubre 2 meses |
| `nota_cliente` | texto, opcional | Explicación para el dueño, una o dos líneas |
| `nota_interna` | texto, opcional | Solo para administración |
| `creado_por` | FK a `users` | Quién lo armó |
| `enviado_en` | timestamp | Cuándo se envió al negocio |
| `pagado_en` | timestamp | Cuándo se pagó |
| `vence_en` | timestamp | Hasta cuándo es vigente |
| `creado_en`, `actualizado_en` | timestamp | Fechas de control |

**Reglas:**
- Un negocio puede tener varios packs en su historial, pero **solo uno vigente** (`pagado` y no vencido) y **solo uno pendiente** (`enviado`) a la vez.
- `servicios` y `funciones` son una foto del momento: si mañana cambia el catálogo, el pack ya pagado no cambia.

**En `pagos`:** añade lo necesario para enlazar un pago con un pack (por ejemplo, `pack_medida_id` opcional, o el campo de concepto que ya use el flujo), siguiendo el patrón actual.

### 2. Permisos (`src/lib/plans-server.ts`)

`funcionesDe` suma una fuente más: las `funciones` del pack a medida vigente del negocio. Mantén la regla de siempre: basta con que una sola vía dé la función.

Ajusta `aSuscripcion` (o el punto donde se carga la suscripción) para leer el pack vigente **sin añadir una consulta por cada petición** si ya hay caché o una carga conjunta.

### 3. Precio sugerido

Función pura `precioSugeridoPack(servicios, catalogo)` en `src/lib/pack-medida.ts`:

- Calcula qué módulos sueltos hacen falta para cubrir las funciones de los servicios elegidos, sin contar dos veces el mismo módulo.
- Suma sus precios del catálogo vivo.
- Si una función solo se vende dentro de un pack estándar, usa la parte proporcional del pack más barato que la incluye y dímelo en el informe final.

El administrador ve el precio sugerido y el ahorro, y fija el precio final a mano.

### 4. Solicitud del negocio

- **Botón «Quiero mi pack» de `para-tu-negocio.tsx`:** además de abrir WhatsApp, crea una solicitud en el sistema de «Solicitudes» que ya existe, de un tipo nuevo `pack_medida`, con el negocio, su tipo y los servicios marcados.
- **Si el sistema de solicitudes no sirve para esto,** propón la alternativa más pequeña.
- **Mientras haya una solicitud abierta,** el botón muestra «Solicitud enviada, te escribimos pronto» y no permite duplicarla.

### 5. Administración

**En la ficha del negocio en `/admin`, sección nueva «Pack a medida»:**

- **Historial:** los packs del negocio con su estado.
- **Botón «Armar pack»** (o «Editar» si hay uno en borrador):
  - La lista de servicios del tipo del negocio. Solo se pueden marcar los `disponible`. Los demás se ven atenuados con «Próximamente».
  - Una lista desplegable con el resto de servicios disponibles de otros tipos.
  - Lo que el negocio **ya tiene** por otra vía (pack estándar, módulos o trial), marcado, para no cobrarle dos veces.
  - El precio sugerido, el campo del precio final en USD con su equivalente en CUP y el ahorro.
  - El interruptor «Oferta 2x1 del primer contrato». Viene encendido si el negocio nunca ha pagado nada en La Verde (sin pagos en estado pagado). Si ya pagó antes, viene apagado y se puede encender a mano.
  - La nota para el cliente y la nota interna.
  - Los botones «Guardar borrador» y «Enviar al negocio».
- **«Enviar al negocio»:**
  - pasa el pack a `enviado` y guarda `enviado_en`,
  - cierra la solicitud de pack si había una,
  - avisa al dueño (ver punto 7).
- **«Cancelar pack»:** para uno vigente, pasa a `cancelado`, el acceso se corta en el acto y no se borra nada.
- **En `/admin` solicitudes:** las de tipo `pack_medida` enlazan directo a «Armar pack» de ese negocio.

### 6. Panel del negocio

**En `para-tu-negocio.tsx` y en la vista `planes`:**

- **Si hay un pack `enviado`:** una tarjeta destacada arriba del todo, «Tu pack a medida está listo», con:
  - la lista de servicios incluidos, con su icono y su `porQue`,
  - la nota del administrador,
  - el precio mensual en USD y en CUP,
  - si `oferta_2x1` está activa, un bloque «Primer contrato: pagas 1 mes y te llevas 2»,
  - el resumen «Hoy pagas {precio}. Tu pack queda activo hasta el {fecha}». La fecha es dentro de 2 meses con la oferta o de 1 mes sin ella,
  - el botón «Aceptar y pagar», que lanza el flujo de QvaPay que ya existe,
  - un enlace secundario, «Tengo una duda», que abre WhatsApp con La Verde con un mensaje ya escrito sobre ese pack,
  - un enlace pequeño, «No me interesa», que pasa el pack a `rechazado` tras una confirmación.
- **Si hay un pack vigente:** una tarjeta «Tu pack a medida», con los servicios, el precio, la próxima fecha de pago y el estado.

**En «Ya lo tienes»:** los servicios que vienen del pack a medida aparecen con una etiqueta pequeña, «En tu pack».

### 7. Pago, activación y renovación

**Crear la factura:** el servidor recibe solo el `id` del pack y comprueba:
- que pertenece al negocio,
- que el usuario tiene acceso a Planes,
- que el pack está en `enviado`, o en `pagado` si es una renovación.

El precio sale de `packs_medida.precio_usd`. El descuento manual por negocio **no** se aplica encima, porque el precio del pack ya es el final. Déjalo explicado en un comentario.

**En el webhook**, dentro de la misma transacción que ya existe:

| Caso | Qué pasa |
| --- | --- |
| Primer pago con `oferta_2x1` | Estado `pagado`, `pagado_en` = ahora, `vence_en` = ahora + 2 meses |
| Primer pago sin oferta | `vence_en` = ahora + 1 mes |
| Renovación | `vence_en` = el `vence_en` actual + 1 mes, o desde ahora si ya había vencido |

Si el negocio está en trial cuando paga, el trial se termina en ese momento.

**Recordatorios:** los que ya existen (5 días antes, el día anterior y vencido ayer con 3 días de gracia) también leen `packs_medida.vence_en` y mandan al negocio a pagar su renovación.

**Vencimiento:** pasados los días de gracia, el pack pasa a `vencido` con el mecanismo de vencimiento que ya existe.

**Avisos al dueño**, con los helpers que ya existen:

| Momento | Avisos |
| --- | --- |
| Al enviar el pack | Notificación interna, push y correo: «Tu pack a medida está listo. Míralo y actívalo desde tu panel» |
| Al pagar | Notificación interna y correo de confirmación, con el resumen del pack y la fecha de vencimiento |

### 8. Trial de 30 días (decisión pendiente)

Todavía no está decidido si se mantiene el trial de Pro para negocios nuevos. **No lo quites.** Añade en el catálogo vivo un ajuste `trialNegociosNuevos` (booleano, por defecto el comportamiento actual), editable desde `/admin/planes`, y haz que la creación del trial lo respete. Así se decide más adelante sin tocar código.

### 9. Analítica

Registra estos eventos:
- `pack_medida_solicitado`,
- `pack_medida_enviado`,
- `pack_medida_visto` (cuando el dueño abre la tarjeta),
- `pack_medida_pagado` (con el precio y si llevó 2x1),
- `pack_medida_rechazado`,
- `pack_medida_renovado`.

En `/admin` analítica, añade un bloque pequeño con los packs enviados, pagados y rechazados en el periodo, y el ingreso mensual de packs a medida.

### 10. Diseño e integración visual

Igual que en las funcionalidades anteriores:

- **Skills:** `ui-ux-pro-max` al planificar, `design-taste-frontend` al construir e `impeccable` para revisar. Si chocan con el diseño actual, manda el diseño actual.
- **Tokens y componentes:** los del proyecto (`verde-*`, `ink`, `muted-foreground`, `bg-card`, radios `lv`, espacios semánticos, `PlanCard` como referencia, `Badge`, `Sheet`, `Dialog` para confirmar, y `sonner`).

**Tarjeta «Tu pack a medida está listo»:**
- Es la más destacada de la vista `planes`, con el estilo del plan recomendado o `primary-halo`.
- Dentro, la jerarquía de arriba abajo es: título, servicios, precio y, al final, el botón principal.

**Bloque del 2x1:**
- Visible pero sobrio: una franja con un icono `Gift`, el texto «Primer contrato: pagas 1 mes y te llevas 2» y la fecha de vencimiento resultante.
- Nada de colores chillones.

**Precio:** en USD grande y en CUP debajo, en `muted-foreground`, con `tabular-nums`, igual que en `PlanCard`.

**Formulario de administración:** el patrón de formularios del admin que ya existe, con el precio sugerido y el ahorro calculados en vivo.

**Estados que hay que resolver:**
- sin pack,
- solicitud enviada,
- pack enviado,
- pagando (redirigido a QvaPay),
- pago confirmado,
- pack vigente,
- a punto de vencer,
- vencido,
- cancelado,
- rechazado.

**Móvil:** pruébalo a 360 px, con áreas táctiles de 44 px. El botón «Aceptar y pagar» queda visible sin hacer scroll en la tarjeta, o fijo abajo como en `SaveBar`.

**Textos:**

| Dónde | Texto |
| --- | --- |
| Tarjeta enviada | «Tu pack a medida está listo» |
| Oferta | «Primer contrato: pagas 1 mes y te llevas 2» |
| Resumen | «Hoy pagas {precio}. Tu pack queda activo hasta el {fecha}» |
| Botón principal | «Aceptar y pagar» |
| Enlaces secundarios | «Tengo una duda» · «No me interesa» |
| Solicitud enviada | «Solicitud enviada, te escribimos pronto» |
| Pack vigente | «Tu pack a medida» y «Próximo pago: {fecha}» |

## Cómo trabajar

1. Haz primero la revisión de lo que ya existe y espera mi visto bueno.
2. Luego dime qué archivos vas a crear y modificar, dónde va cada elemento de la UI y con qué componentes. Espera mi visto bueno otra vez.
3. Implementa en este orden:
   1. Migración
   2. `pack-medida.ts` y el precio sugerido
   3. `funcionesDe`
   4. Solicitud
   5. Administración
   6. Panel
   7. Factura, webhook y renovación
   8. Recordatorios y avisos
   9. Ajuste del trial
   10. Analítica
4. Enséñame el SQL de la migración antes de ejecutar `db:migrate`.
5. Haz la revisión de diseño con `impeccable`, si está instalada.
6. Ejecuta el typecheck, el lint, el build y los tests, y corrige lo que falle.

## Comprobación final

Dame esta lista marcada:

- [ ] Un negocio sin pack a medida tiene exactamente las mismas funciones que antes.
- [ ] Un pack a medida pagado abre sus funciones, sumadas a las del pack estándar, los módulos y el trial, sin quitar ninguna.
- [ ] No se puede incluir en un pack un servicio en «Próximamente» ni uno externo, ni desde la UI ni llamando a la API.
- [ ] El precio de la factura sale siempre del servidor (`packs_medida.precio_usd`). Manipular la petición no cambia el precio.
- [ ] Primer pago con 2x1: vence a los 2 meses. Sin oferta: al mes. Renovación: suma un mes.
- [ ] El 2x1 viene encendido solo para negocios que nunca pagaron, y no se puede aplicar dos veces sin que el administrador lo active a mano.
- [ ] Los recordatorios de pago funcionan con los packs a medida.
- [ ] Al vencer o cancelar, se corta el acceso y no se borra ningún dato.
- [ ] Solo un pack vigente y uno enviado por negocio a la vez.
- [ ] Un trabajador sin permiso sobre Planes no puede aceptar ni pagar el pack.
- [ ] Los avisos de pack enviado y pagado llegan por notificación interna, push y correo.
- [ ] El ajuste `trialNegociosNuevos` funciona desde `/admin/planes` y por defecto todo queda como antes.
- [ ] Coherente con el resto de la app a 360 px, con todos los estados resueltos.
- [ ] Contraste AA y etiquetas correctas.
- [ ] Typecheck, lint, build y tests sin errores.

Termina con un resumen de los archivos tocados, cómo calculaste el precio sugerido y cualquier decisión que hayas tomado por tu cuenta.
