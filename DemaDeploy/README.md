# La Verde — Preview Experience

Una preview premium, independiente y funcional de **La Verde**, el mapa con salud
verde de Cuba: un encuentro **geolocaliza y cura el mejor lugar del país**.

Proyecto **Next.js 15 (App Router) + TypeScript + Tailwind CSS**, orquestado con
**Framer Motion** para una experiencia de alto impacto y conversión. Está pensado
para correrse de forma autónoma (no depende del MVP padre) y desplegarse en el
plan gratuito de Vercel.

---

## ✨ Lo que encontrás en esta preview

| Sección            | Qué hace                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **Hero**           | Titular cinematográfico, orbes de luz, contadores sociales animados (lugares, provincias, guardados) y CTA de doble vía.  |
| **El Mapa**        | Demo en vivo con **Leaflet**: 14 lugares curados con pins premium, `flyTo` al seleccionar, búsqueda por la galería lateral. |
| **Búsqueda IA**    | Input natural + ejemplos clicables que responde con lugares (demo local, sin backend).                                    |
| **Cómo funciona**  | Proceso en 3 pasos que explica el modelo de curaduría.                                                                    |
| **Por qué La Verde** | Diseño bento asimétrico con el diferencial de la marca (precios en USD, salud verde, IA en el idioma del lugar).         |
| **Waitlist**       | Formulario de alta conversión con **API Route** real de almacenamiento (Vercel Blob free o archivo local en dev).          |
| **Footer**         | Mapa del sitio, confianza y toque de marca.                                                                               |

## 🎨 Dirección de diseño

- **Vibe**: *Ethereal Green Glass* — herodark esmeralda con glassmorphism y
  secciones claras cálidas.
- **Layout**: bento asimétrico + "double-bezel" (carcasa exterior + núcleo interior)
  para las tarjetas.
- **Tipografía**: Space Grotesk (display) + Plus Jakarta Sans (texto), servidas por
  `next/font/google`.
- **Motion**: curvas `cubic-bezier` personalizadas (sin `ease-in-out` genéricos),
  `whileInView`/`staggerChildren`, morph de hamburguesa y respeto total a
  `prefers-reduced-motion`.

## 🛠 Stack técnico

- **Framework**: Next.js 15 (App Router), React 19
- **Estilos**: Tailwind CSS v3 + CSS design tokens
- **Motion**: framer-motion 11
- **Mapa**: react-leaflet 5 / leaflet 1.9 (`preferCanvas`, carga diferida cliente)
- **Iconos**: lucide-react (trazo fino)
- **Utilidades**: clsx + tailwind-merge

## 🚀 Cómo correr el proyecto

Requiere **Node 18+**.

```bash
# 1. Instalar dependencias (dentro de esta carpeta)
npm install

# 2. (Opcional) Configurar variables de entorno
cp .env.example .env

# 3. Desarrollo
npm run dev
# → http://localhost:3000

# 4. Producción
npm run build && npm start
```

Otros comandos:

```bash
npm run typecheck   # chequeo de tipos
npm run lint        # lint (agregá tu config si querés)
```

## 🗄 Waitlist (almacenamiento)

El formulario hace `POST /api/waitlist`. El backend guarda de forma **gratuita** en
Vercel:

- **Opción A (recomendada)**: Vercel **Blob**. Creá un storage Blob en tu proyecto y
  seteá `VERCEL_BLOB_READ_WRITE_TOKEN` en `.env`. La ruta usa la API REST de Vercel.
- **Opción B (dev)**: fallback a un archivo JSON local en `.next/waitlist.json`.

> En producción, para tiempo real total, podés migrar a una BD serverless (Upstash
> Redis / Turso) cambiando las llamadas al store. El contrato de la API queda igual.

## 📦 Desplegar en Vercel (free)

1. Subí este proyecto a un repo de GitHub (solo la carpeta `DemaDeploy`).
2. En Vercel → **Add New Project** → importá el repo.
3. Framework preseleccionado: **Next.js**. Build command: `npm run build`.
4. Agregá la variable `NEXT_PUBLIC_SITE_URL` (tu dominio de Vercel).
5. (Opcional) Creá Blob Storage y cargá `VERCEL_BLOB_READ_WRITE_TOKEN`.
6. Deploy. Apuntando a `NEXT_PUBLIC_SITE_URL` por tu dominio custom.

El build es estático para la landing (ruta `/`) + una API Route dinámica; entra
cómodo en el plan Hobby/Vercel free.

## 🔍 SEO & Open Graph

- Metadata completa en `layout.tsx` (title template, description, keywords, robots).
- Open Graph y Twitter Card generados dinámicamente con `next/og`
  (`src/app/opengraph-image.tsx`) — sin dependencias extra.
- Favicon SVG de marca (`src/app/icon.svg`).

## 📁 Estructura principal

```
src/
  app/
    api/waitlist/route.ts   # API de la waitlist (Blob o archivo local)
    layout.tsx              # fuentes, SEO, OG
    page.tsx                # ensambla la landing
    globals.css             # design tokens + utilidades (glass, grain, leaflet)
    icon.svg                # favicon
    opengraph-image.tsx     # Open Graph PNG con next/og
  components/
    hero, navigation, map-demo, leaf-map, ai-demo,
    how-it-works, why-different, waitlist, waitlist-form, footer
    ui/reveal.tsx, ui/counter.tsx
  lib/
    utils.ts   # cn() y formateadores
    motion.ts  # variantes/curvas compartidas
    places.ts  # datos semilla: 14 lugares + coordenadas
```

## ♿ Accesibilidad

- Respeto a `prefers-reduced-motion` en todos los componentes animados (Reveal,
  Counter, Hero, Nav, WaitlistForm).
- `aria-label` en controles icon-only, `aria-live` en cambios de estado, landmarks
  semánticos y foco a teclado en inputs/botones.