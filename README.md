# La Verde 🌿

> Plataforma de descubrimiento de lugares en Cuba con inteligencia artificial.

La Verde ayuda a residentes y viajeros a encontrar los mejores lugares en Cuba usando lenguaje natural. Describe lo que buscas y la IA encuentra los lugares perfectos para ti.

## Stack

| Capa | Tecnología |
|------|-----------|
| **Framework** | Next.js 15 (App Router) |
| **Lenguaje** | TypeScript (strict) |
| **Estilos** | Tailwind CSS 3.4 + shadcn/ui |
| **Base de datos** | PostgreSQL (Neon) + Drizzle ORM |
| **Autenticación** | Clerk |
| **Mapas** | Leaflet + React-Leaflet (OpenStreetMap) |
| **IA** | OpenAI gpt-4o-mini + pgvector |
| **Storage** | Cloudflare R2 |
| **Deploy** | Vercel + Neon |

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
| `DATABASE_URL` | Connection string de Neon PostgreSQL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `OPENAI_API_KEY` | OpenAI API key |
| `R2_*` | Cloudflare R2 credentials (opcional en desarrollo) |

### 3. Base de datos

```bash
# Generar migraciones desde el schema
npm run db:generate

# Aplicar migraciones a Neon
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

## Convenciones

- **Rutas:** Next.js App Router con route groups `(auth)`, `(main)`
- **Importaciones:** `@/` alias apunta a `src/`
- **Componentes:** shadcn/ui en `components/ui/`, componentes de negocio en `components/*/`
- **Estilos:** Tailwind CSS con tokens personalizados `lv-*`
- **BD:** Drizzle ORM con schema en `lib/db/schema/`
- **Tipos:** TypeScript estricto con `noUncheckedIndexedAccess`
- **IA:** Integración OpenAI en `lib/ai/`, streaming via `ai` SDK
