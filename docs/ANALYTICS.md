# Analítica interna de La Verde

Sistema de analítica de producto que vive **en la misma base Neon** que La Verde.
Sin Supabase, sin warehouse, sin Redis, sin otro Postgres (`§3`). La prioridad no
es tener muchas métricas, sino tener **datos reales, baratos de leer y seguros**.

---

## 1. Arquitectura

```
                    LA VERDE
                       │
             ┌─────────┴─────────┐
             │                   │
          PRODUCTO           ANALYTICS
             │                   │
             └─────────┬─────────┘
                       │
                      NEON
```

- **Producto**: las tablas de siempre (`places`, `users`, `business_owners`…).
- **Analytics**: dos tablas propias (`analytics_events`, `analytics_daily`) en la
  misma base.

No hay infraestructura paralela. La analítica comparte conexión, credenciales y
despliegue con el producto.

### Piezas

| Pieza | Ruta | Qué hace |
|---|---|---|
| Tipos y emisión | `src/lib/analytics/events.ts` | `trackEvent()` y el catálogo de eventos |
| Helper de SQL | `src/lib/analytics/sql.ts` | ejecuta SQL crudo y devuelve filas |
| Consultas del panel | `src/lib/analytics/queries.ts` | todas las métricas del dashboard |
| Agregación y limpieza | `src/lib/analytics/aggregate.ts` | `aggregateRange()`, `cleanupEvents()` |
| Cliente | `src/lib/analytics/client.ts` | eventos que solo existen en el navegador |
| API del panel | `src/app/api/admin/analytics/route.ts` | datos por sección, protegido |
| Export CSV | `src/app/api/admin/analytics/export/route.ts` | CSV agregado y de eventos |
| Cron | `src/app/api/cron/analytics/route.ts` | agrega y limpia |
| Panel | `src/app/admin/analytics/page.tsx` | pantalla de administración |

---

## 2. Eventos

Cada evento guarda **solo lo necesario**. Campos:

`id`, `event_type`, `created_at`, `user_id`, `session_id`, `business_id`,
`search_query`, `category_id`, `province`, `municipality`, `result_count`,
`source`, `medium`, `campaign`, `referrer`, `metadata`, `dedupe_key`.

Nunca se guardan contraseñas, tokens, correos, teléfonos ni contenido privado. La
identidad es `user_id` + `event_type`; no hay más.

### Catálogo

| Grupo | Eventos |
|---|---|
| Usuarios | `user_registered`, `user_login` |
| Búsqueda | `search_performed`, `search_results_shown`, `search_no_results` |
| Negocios (descubrimiento) | `business_viewed`, `business_impression`, `business_contact_clicked`, `business_whatsapp_clicked`, `business_phone_clicked`, `business_map_clicked`, `business_website_clicked`, `business_social_clicked` |
| Alta de negocios | `business_registration_started`, `business_registration_completed`, `business_approved`, `business_rejected` |
| Otras funciones existentes | `place_saved`, `review_created` |

No se rastrea scroll, hover, movimientos del mapa ni interacciones triviales.

### Dónde se emiten

- **En el servidor** (sin petición extra): búsqueda IA (`/api/ai/search`), alta de
  negocio (`/api/business`), aprobación y rechazo (`/api/places/[id]`), alta de
  cuenta (`getAppUser`), vistas y clics de ficha (`/api/metrics/place`).
- **Desde el navegador** (solo lo que no pasa por ninguna ruta propia): clics en
  los contactos de una ficha y el primer paso del alta (`/api/analytics/event`,
  con lista blanca de tipos).

### No bloquear el producto

`trackEvent()` registra **después** de responder, con `after()` de Next, y traga
cualquier error. Si analytics falla, la búsqueda, la ficha y el alta siguen
funcionando.

### Duplicados

`dedupe_key` es única y nullable. Cuando el emisor puede construir una clave
estable, repetir la escritura no suma. Con `null` (lo normal) Postgres no ve
conflicto.

---

## 3. Tablas e índices

### `analytics_events`

Crudo y de vida corta. Índices, elegidos por las consultas reales:

- `(event_type, created_at)` — el que trabaja en casi todas las métricas.
- `(created_at)` — rangos sin tipo y limpieza.
- `(business_id, created_at)` — analítica por negocio.
- `(user_id, created_at)` — DAU, cohorts y retención.
- único en `dedupe_key`.

Sin claves foráneas a `users` ni `places`: un evento sobrevive al borrado de la
cuenta o del negocio.

### `analytics_daily`

Agregados por día y dimensiones (`day`, `province`, `municipality`,
`category_id`). Las dimensiones vacías son `""`, no `null`, para que el
`ON CONFLICT` sea idempotente. Contadores: búsquedas, con resultados, sin
resultados, vistas, impresiones, acciones, usuarios nuevos, usuarios activos y
negocios nuevos.

---

## 4. Agregaciones y retención de eventos

- **Agregación** (`aggregateDay` / `aggregateRange`): recalcula en vez de sumar,
  así que es idempotente. Rango acotado a 120 días.
- **Retención de crudo**: configurable con `ANALYTICS_RETENTION_DAYS` (por
  defecto **90**; mínimo 7, máximo 365).
- **Limpieza** (`cleanupEvents`): por lotes de 5000, con tope de lotes por
  ejecución. Nunca borra `analytics_daily`.

---

## 5. Definición de KPIs

| KPI | Definición |
|---|---|
| Usuarios totales | filas de `users` |
| Nuevos usuarios | `user_registered` distintos en el periodo |
| DAU / WAU / MAU | usuarios distintos con **actividad** en las últimas 24 h / 7 / 30 días |
| Recurrentes | usuarios con actividad en más de un día del periodo |
| Búsquedas | `search_performed` |
| Con resultados | `search_results_shown` |
| Sin resultados | `search_no_results` |
| Tasa de éxito | con resultados ÷ búsquedas |
| Vistas | `business_viewed` |
| Impresiones | `business_impression` (la búsqueda lo eligió) |
| Acciones | clics de contacto, WhatsApp, teléfono, mapa, web y redes |
| Conversión búsqueda → negocio | vistas ÷ búsquedas |

**Actividad** (base de DAU y retención): `search_performed`, `business_viewed`,
`business_impression`, todos los clics de acción y `place_saved`. El login **no**
cuenta.

### Retención

La cohorte de un usuario es el día de su primera **actividad** dentro del
periodo. Está retenido a D*n* si vuelve a tener actividad en `cohorte + n` días.
Se calculan D1, D7, D14 y D30.

### Demanda vs oferta

```
demanda = búsquedas del periodo (por categoría / provincia)
oferta  = negocios aprobados, activos y abiertos
ratio   = demanda / max(oferta, 1)
score   = min(100, ratio / 50 * 100)
```

Oportunidad **alta** por encima de 20 búsquedas por negocio; media por encima de 5.

---

## 6. Filtros, paginación, cache y exportación

- Los filtros (periodo, provincia, municipio, categoría, negocio, fuente, medio,
  campaña) se aplican **en SQL**, nunca en el navegador. Provincia y categoría
  se eligen de una lista, no se escriben: los eventos guardan etiquetas y una
  errata devolvía el panel vacío sin decir por qué.
- **La categoría tiene un alcance limitado, y el panel lo dice.** Solo los
  eventos con resultado (`search_results_shown`, `search_no_results`) llevan
  `metadata->>'category'`; `search_performed` se registra antes de saber la
  categoría. Por eso el filtro compara contra `metadata->>'category'` —lo mismo
  que ya enseña «Por categoría»— y acota las secciones de búsqueda, dejando
  fuera vistas, clics y altas. Filtrar por `category_id` no servía: ninguna
  llamada a `trackEvent()` escribe esa columna, así que estaba siempre a NULL.
- **Cache** (`§33`): la API devuelve `Cache-Control: private, max-age=300,
  stale-while-revalidate=600` solo cuando el periodo **ya terminó**; el periodo
  en curso (que incluye hoy) va con `no-store`. Sin Redis.
- **Analítica por negocio** (`§23`): la sección «Negocio» del panel muestra
  vistas, impresiones (búsquedas que lo eligieron), acciones y desglose de
  contactos por canal, siempre acotado por `business_id` y periodo.
- Las tablas potencialmente grandes van con `LIMIT` (consultas frecuentes: 50;
  listados geográficos: 30).
- **CSV** (`/api/admin/analytics/export`): UTF-8 con BOM, encabezados claros,
  respeta periodo y filtros, y el nombre lleva tipo y rango
  (`laverde_busquedas_2026-10-01_2026-10-04.csv`). Los eventos crudos se
  transmiten por lotes de 1000 sin cargar la tabla entera en memoria.

---

## 7. Cron

`vercel.json` programa `/api/cron/analytics` a las 03:00 UTC. Autorizado por
`Authorization: Bearer $CRON_SECRET` (lo pone Vercel) o por `x-admin-key` /
sesión admin. Recalcula los últimos 3 días y limpia eventos fuera de retención.

Alternativa manual desde la UI: `?aggregate=1` en la API del panel.

---

## 8. Seguridad y privacidad

- Las páginas, la API y las exportaciones exigen rol `admin` (`isAdminRequest`).
  El frontend nunca decide permisos.
- No se guardan datos personales: solo `user_id` y `session_id`.
- La ruta pública de eventos del cliente tiene **lista blanca** de tipos y límite
  de peticiones.

---

## 9. Integraciones preparadas

| Módulo | Variables | Estado |
|---|---|---|
| Google Analytics 4 | `GA4_PROPERTY_ID` | Preparado; sin credenciales muestra «no conectado» |
| Google Search Console | `GSC_SITE_URL` | Preparado; idem |
| Meta | `META_ACCESS_TOKEN` | Preparado; idem |

Las métricas internas de producto siguen teniendo como fuente principal
`analytics_events`. Los módulos externos **no inventan cifras**.

---

## 10. Variables de entorno

```
ANALYTICS_RETENTION_DAYS=90   # días de evento crudo (7-365)
CRON_SECRET=                  # lo usa Vercel Cron para autorizar el job
GA4_PROPERTY_ID=              # opcional
GSC_SITE_URL=                 # opcional
META_ACCESS_TOKEN=            # opcional
```

---

## 11. Escalabilidad

**Hoy**: Neon + `analytics_events` + `analytics_daily`, con retención de 90 días
y agregados sin caducidad.

**Cuando el volumen lo exija** (no antes):

1. Servir los periodos largos solo desde `analytics_daily`, dejando el crudo para
   rangos cortos.
2. Añadir una caché en la capa de lectura del panel.
3. Migrar la capa de eventos a un almacén columnar (ClickHouse/BigQuery) **si y
   solo si** los agregados ya no bastan. La tabla de eventos está desacoplada del
   producto para poder hacerlo sin tocar las fichas.

---

## 12. Lo que NO está implementado (y por qué)

- **Tests automáticos** (`§48`): el repositorio no tiene framework de pruebas y
  añadir uno exige una instalación de npm que, en esta red, puede tumbar
  `node_modules` entero. Queda como pendiente explícito.
- **Historial de exportaciones** (`§38`): es opcional y «si es sencillo»; no se
  guarda constancia de cada CSV generado.
- **Consumo real de Neon/Vercel** (`§41`, `§53`): no hay API accesible para
  medirlo desde la app, así que la salud enseña conteos internos y una
  **estimación** de tamaño, rotulada como tal.

---

## 13. Cómo comprobar que funciona

1. Busca algo en `/home` y abre una ficha.
2. `select event_type, count(*) from analytics_events group by 1 order by 2 desc;`
3. Abre `/admin/analytics` con una cuenta admin: Resumen debe reflejar actividad.
4. Fuerza la agregación con `?aggregate=1` (o espera al cron) y revisa
   `analytics_daily`.
