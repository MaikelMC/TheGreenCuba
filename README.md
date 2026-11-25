# La Verde 🌿

> Plataforma de descubrimiento de lugares en Cuba con inteligencia artificial.

La Verde ayuda a residentes y viajeros a encontrar los mejores lugares en Cuba usando lenguaje natural. Describe lo que buscas y la IA encuentra los lugares perfectos para ti.

## Stack

| Capa | Tecnología |
|------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **Lenguaje** | TypeScript (strict) |
| **Estilos** | Tailwind CSS 3.4 + shadcn/ui |
| **Base de datos** | PostgreSQL propio (VPS) + Drizzle ORM (`node-postgres`) |
| **Autenticación** | Better Auth autoalojado |
| **Mapas** | Leaflet + React-Leaflet (OpenStreetMap) |
| **IA** | OpenAI gpt-4o-mini + pgvector |
| **Storage** | Almacén de objetos compatible con S3 (hoy, Neon Object Storage) |
| **Deploy** | Docker en VPS |

## Estructura del proyecto

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth routes (login, register)
│   ├── (main)/            # App routes (home, place, business)
│   ├── api/               # API routes (search, places, ai, auth, upload)
│   ├── layout.tsx         # Root layout con fonts + providers
│   ├── page.tsx           # Landing page
│   └── globals.css        # Design tokens + Tailwind base
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── layout/            # Header, Footer, BottomSheet
│   ├── map/               # MapView, MapMarker, MapControls
│   ├── search/            # AISearch, SearchSuggestions, SearchResults
│   ├── place/             # PlaceCard, PlaceDetail, PhotoCarousel, etc.
│   ├── business/          # PanelShell, DashboardStats, FormSection, etc.
│   ├── landing/           # Hero, HowItWorks, CTASection
│   └── onboarding/        # OnboardingShell, PreferenceChip, LocationPicker
├── config/
│   └── site.ts            # Site config + AI config
├── hooks/                 # Custom React hooks
├── lib/
│   ├── ai/                # OpenAI integration, embeddings, NL parser
│   ├── db/
│   │   ├── schema/        # Drizzle schema definitions
│   │   ├── migrations/    # Auto-generated migrations
│   │   └── index.ts       # DB client
│   ├── storage/            # Cloudflare R2 client
│   ├── auth.ts            # Clerk auth helpers
│   ├── constants.ts       # Categories, cities, currencies, moods
│   └── utils.ts           # cn(), formatters, slugify, generateId
├── providers/              # React context providers (ThemeProvider)
├── types/                  # TypeScript types + Zod schemas
└── middleware.ts           # Clerk middleware
```

## Setup rápido

### 1. Clonar e instalar

```bash
git clone <repo-url> la-verde
cd la-verde
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus credenciales:

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Cadena de conexión del Postgres del VPS |
| `BETTER_AUTH_SECRET` | Firma las cookies de sesión. Mínimo 32 caracteres |
| `BETTER_AUTH_URL` | Origen público de la app |
| `OPENAI_API_KEY` | OpenAI API key |
| `AWS_ENDPOINT_URL_S3` | Endpoint de la rama, en Branch → Storage de la consola de Neon |
| `AWS_ACCESS_KEY_ID` | `token_id` de una credencial de Neon con `storage:read` y `storage:write` |
| `AWS_SECRET_ACCESS_KEY` | `s3_secret_access_key`, que solo se devuelve al crear la credencial |
| `AWS_REGION` | Región real de la rama. `auto` no vale |
| `S3_BUCKET_NAME` | Bucket de las fotos. Por defecto `la-verde-images` |

El bucket tiene que estar en `public_read`. Se cambia en la consola o en la API
de Neon, no por S3: `PutBucketAcl` devuelve `501 Not Implemented`. Con un bucket
privado, las fotos se suben pero la ficha pública no las puede leer.

### 3. Base de datos

```bash
# Generar migraciones desde el schema
npm run db:generate

# Aplicar migraciones a la base
npm run db:migrate

# (Opcional) Hacer push directo del schema
npm run db:push

# Abrir Drizzle Studio para inspeccionar datos
npm run db:studio
```

### 4. Sembrar datos de prueba

```bash
npm run db:seed
```

### 5. Desarrollo

```bash
npm run dev
# → http://localhost:3000
```

## Schema de base de datos

| Tabla | Propósito |
|-------|-----------|
| `users` | Usuarios sincronizados con Clerk |
| `categories` | Categorías de lugares (Cafetería, Restaurante, etc.) |
| `places` | Lugares con coordenadas, horarios, monedas, ambiente |
| `place_images` | Fotos de cada lugar (una cover + galería) |
| `place_hours` | Horarios por día de la semana |
| `place_menu_items` | Items de menú con precio y moneda |
| `reviews` | Reseñas de usuarios (rating 1-5) |
| `saved_places` | Lugares guardados/favoritos por usuario |
| `business_owners` | Relación dueño/manager → lugar |
| `user_search_history` | Historial de búsquedas del usuario |

## Comandos disponibles

```bash
npm run dev          # Desarrollo
npm run build        # Build producción
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm run db:generate  # Generar migraciones Drizzle
npm run db:migrate   # Aplicar migraciones
npm run db:push      # Push schema directo
npm run db:studio    # Drizzle Studio UI
npm run db:seed      # Sembrar datos de prueba
```

## Tareas programadas (crons)

Los crons viven en el **crontab del VPS**, no en `vercel.json`: el sitio ya no
se sirve desde Vercel y los crons de ese archivo no corren en ningún sitio.
`vercel.json` solo conserva `git.deploymentEnabled: false`.

Cada endpoint exige `Authorization: Bearer $CRON_SECRET` (o `x-admin-key` /
sesión de administrador para lanzarlo a mano). El secreto **nunca** va en la
URL: el crontab lo lee de un archivo de cabecera con permisos `600`.

| Endpoint | Método | Frecuencia (UTC) | Qué hace |
|---|---|---|---|
| `/api/cron/recordatorios-pedidos` | `POST` | cada minuto | Avisa por Telegram de los pedidos programados |
| `/api/cron/analytics` | `GET` | diario, 03:00 | Recalcula los agregados de 3 días y limpia eventos viejos |
| `/api/cron/recordatorios` | `GET` | diario, 14:00 | Recordatorios de pago de suscripciones y packs a medida |
| `/api/cron/ranking` | `GET` | día 1 de cada mes, 04:15 | Cierra el «Top del mes» del mes anterior |

Todos son idempotentes: relanzarlos no duplica avisos ni datos.

Preparación en el VPS (una vez):

```bash
sudo install -d -m 700 /etc/laverde
# Una sola línea, con el mismo valor que CRON_SECRET en el .env del VPS:
#   Authorization: Bearer <CRON_SECRET>
sudoedit /etc/laverde/cron.header
sudo chmod 600 /etc/laverde/cron.header
sudo chown "$USER" /etc/laverde/cron.header
```

Crontab (`crontab -e` con el usuario dueño del archivo de cabecera). Las horas
asumen el VPS en UTC; compruébalo con `timedatectl`:

```cron
LV=https://laverde.kynari.dev
H=/etc/laverde/cron.header

* * * * *  curl -fsS -m 55  -X POST -H @"$H" "$LV/api/cron/recordatorios-pedidos" -o /dev/null 2>>/var/log/laverde-cron.log
0 3 * * *  curl -fsS -m 120 -H @"$H" "$LV/api/cron/analytics"     >>/var/log/laverde-cron.log 2>&1
0 14 * * * curl -fsS -m 120 -H @"$H" "$LV/api/cron/recordatorios" >>/var/log/laverde-cron.log 2>&1
15 4 1 * * curl -fsS -m 120 -H @"$H" "$LV/api/cron/ranking"       >>/var/log/laverde-cron.log 2>&1
```

## Convenciones

- **Rutas:** Next.js App Router con route groups `(auth)`, `(main)`
- **Importaciones:** `@/` alias apunta a `src/`
- **Componentes:** shadcn/ui en `components/ui/`, componentes de negocio en `components/*/`
- **Estilos:** Tailwind CSS con tokens personalizados `lv-*`
- **BD:** Drizzle ORM con schema en `lib/db/schema/`
- **Tipos:** TypeScript estricto con `noUncheckedIndexedAccess`
- **IA:** Integración OpenAI en `lib/ai/`, streaming via `ai` SDK
