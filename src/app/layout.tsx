import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { lvFontVars } from "@/lib/fonts";
import { siteConfig } from "@/config/site";
import { ThemeProvider } from "@/providers/theme-provider";
import { PostHogAnalytics } from "@/providers/posthog-provider";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { Toaster } from "sonner";
/* Sin el CSS de `@neondatabase/auth-ui`: no hay ningún componente de ese
   paquete montado. Las pantallas de acceso usan las clases propias de
   `auth-card.tsx`, y cargar la hoja del paquete solo engordaba el primer
   pintado. */
import "./globals.css";

/* Las tres de la app, desde el repo, no desde Google. El motivo entero está en
   `src/lib/fonts.ts`: `next/font/google` convierte cada arranque en frío y cada
   build en una apuesta a que `fonts.googleapis.com` conteste, y en esta red no
   siempre contesta. Los `.woff2` son las variables de Google recortadas al
   subconjunto `latin`. */
const fontDisplay = localFont({
  src: "../fonts/dm-sans.woff2",
  variable: "--font-display",
  weight: "100 1000",
});

const fontBody = localFont({
  src: "../fonts/source-sans-3.woff2",
  variable: "--font-body",
  weight: "200 900",
});

const fontMono = localFont({
  src: "../fonts/jetbrains-mono.woff2",
  variable: "--font-mono",
  weight: "100 800",
  // El mono no es crítico para el LCP; evita precargarlo en cada ruta.
  preload: false,
});

const devChunkScript = `(function(){window.webpackChunkLoadTimeout=300000;if(window.__laVerdeChunkReloaded)return;window.addEventListener("error",function(e){if(window.__laVerdeChunkReloaded)return;var m=(e&&e.message)||"";if(m.indexOf("ChunkLoadError")!==-1||m.indexOf("Loading chunk")!==-1||m.indexOf("webpack")!==-1){window.__laVerdeChunkReloaded=true;window.location.reload();}},true);})();`;

const prodChunkScript = `(function(){if(window.__laVerdeChunkReloaded)return;window.addEventListener("error",function(e){if(window.__laVerdeChunkReloaded)return;var m=(e&&e.message)||"";if(m.indexOf("ChunkLoadError")!==-1||m.indexOf("Loading chunk")!==-1){window.__laVerdeChunkReloaded=true;window.location.reload();}},true);})();`;

/**
 * `viewportFit: "cover"` es lo que hace que `env(safe-area-inset-*)` devuelva
 * algo distinto de 0 en iOS. Sin él, las utilidades `.pb-safe-bottom` del sitio
 * (bottom sheet, nav del panel, ficha de lugar) no reservan hueco y el contenido
 * queda debajo del indicador de inicio. El sitio está pensado para móvil, así que
 * esto es requisito, no adorno.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No se bloquea el zoom: hacerlo rompe la accesibilidad (WCAG 1.4.4).
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    /* #0e1720 y no #1a1a1a: la superficie oscura real de la app. Con el gris
       neutro la barra del navegador destonzaba contra el fondo verdoso del
       modo oscuro (globals.css). */
    { media: "(prefers-color-scheme: dark)", color: "#0e1720" },
  ],
};

const TITLE = "La Verde | Encuentra tu lugar en Cuba";
const DESCRIPTION =
  "Encuentra los mejores lugares en Cuba con inteligencia artificial. Restaurantes, cafeterías, playas y más.";

/* Pantallas de arranque de iOS. Sin `apple-touch-startup-image`, la app
   instalada abre en blanco hasta que React pinta; Android ya usa el icono y
   `background_color` del manifest, pero Safari no.
 *
 * Las imágenes salen de `public/logo.png` sobre el verde del manifest, las
 * genera `sharp` y viven en `public/splash/`. Hay una por tamaño de pantalla
 * porque iOS elige por `media`; si no coincide ninguna, vuelve al blanco. Solo
 * se descarga la del dispositivo, entre 15 y 79 KB. */
const IOS_STARTUP_IMAGES = [
  {
    url: "/splash/iphone-16-pro-max.png",
    media: "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3)",
  },
  {
    url: "/splash/iphone-16-pro.png",
    media: "(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3)",
  },
  {
    url: "/splash/iphone-plus.png",
    media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)",
  },
  {
    url: "/splash/iphone-16.png",
    media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)",
  },
  {
    url: "/splash/iphone-14.png",
    media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
  },
  {
    url: "/splash/iphone-12-mini.png",
    media: "(device-width: 360px) and (device-height: 780px) and (-webkit-device-pixel-ratio: 3)",
  },
  {
    url: "/splash/iphone-8-plus.png",
    media: "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)",
  },
  {
    url: "/splash/iphone-13-pro-max.png",
    media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)",
  },
  {
    url: "/splash/iphone-11-pro-max.png",
    media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)",
  },
  {
    url: "/splash/iphone-11.png",
    media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)",
  },
  {
    url: "/splash/iphone-13-mini.png",
    media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)",
  },
  {
    url: "/splash/iphone-se.png",
    media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)",
  },
  {
    url: "/splash/ipad-pro-12.png",
    media: "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)",
  },
  {
    url: "/splash/ipad-pro-11.png",
    media: "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)",
  },
  {
    url: "/splash/ipad-pro-10.png",
    media: "(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2)",
  },
  {
    url: "/splash/ipad-air.png",
    media: "(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2)",
  },
  {
    url: "/splash/ipad-mini.png",
    media: "(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)",
  },
];

export const metadata: Metadata = {
  /* Sin `metadataBase`, Next resuelve las URL relativas de Open Graph y de
     canonical contra `localhost:3000`: las previews al compartir salían con una
     imagen que no carga para nadie más. Aquí manda la URL canónica del sitio. */
  metadataBase: new URL(siteConfig.url),
  title: {
    default: TITLE,
    template: "%s | La Verde",
  },
  description: DESCRIPTION,
  keywords: ["Cuba", "lugares", "recomendaciones", "IA", "turismo"],
  applicationName: siteConfig.name,
  /* Se hereda en todas las páginas: lo que cada una cambie encima (título, OG,
     canonical) se fusiona con esto. Las zonas privadas ponen su propio
     `robots: { index: false }` en su layout. */
  openGraph: {
    type: "website",
    locale: "es_CU",
    siteName: siteConfig.name,
    url: siteConfig.url,
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/api/og", width: 1200, height: 630, alt: "La Verde — descubre lugares en Cuba" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/api/og"],
  },
  /* Al «Agregar a la pantalla de inicio» en iOS: sin `capable` la app abre
     dentro de una pestaña de Safari con barra de direcciones, y sin `title`
     el icono se nombra con el dominio. El icono que iOS enseña no se declara
     aquí: lo resuelve `src/app/apple-icon.png` por la convención de Next.
     Android usa el manifest (`src/app/manifest.ts`). */
  /* Next 16 emite `mobile-web-app-capable` (el nombre estándar) y ya no la
     variante con prefijo `apple-`; Safari sigue leyendo esta última para abrir
     la app instalada sin barra. Se declaran las dos. */
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  appleWebApp: {
    capable: true,
    title: siteConfig.name,
    /* `default` mantiene la barra del sistema opaca y legible sobre la app
       clara. `black-translucent` la vuelve transparente con texto blanco: se
       pierde sobre el fondo arena del modo claro, y cambiarla a `black`
       arregla el oscuro rompiendo el claro. iOS no admite un estilo por tema. */
    statusBarStyle: "default",
    startupImage: IOS_STARTUP_IMAGES,
  },
  /* No se declara `robots` aquí: lo decide `robots.ts`, que además puede excluir
     rutas enteras del rastreo, cosa que una meta etiqueta no hace. */
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning data-scroll-behavior="smooth">
      {/* `lvFontVars` solo declara las variables del design system: las
          consume `font-lv` / `font-lv-display`, no son las de la app. `body`
          sigue fijando Source Sans 3. */}
      <body
        className={`${fontDisplay.variable} ${fontBody.variable} ${fontMono.variable} ${lvFontVars} font-body`}
      >
        <script
          dangerouslySetInnerHTML={{
            __html:
              process.env.NODE_ENV === "development"
                ? devChunkScript
                : prodChunkScript,
          }}
        />
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <PostHogAnalytics />
          {children}
          {/* PWA. Los dos devuelven `null` si la bandera está apagada, así
              que en producción hasta que se apruebe no se pinta nada. */}
          <PwaRegister />
          <InstallPrompt />
          {/* Avisos flotantes. La pastilla va en `ink` con texto blanco, como
              la del panel de negocio: es el mismo aviso y tiene que leerse
              igual. Los tokens `--foreground` / `--background` eran el
              sistema viejo.
              `mobileOffset` sube el aviso por encima de la barra inferior:
              en móvil el panel de negocio y el de admin la tienen fija, y el
              aviso se posaba justo encima de las pestañas. */}
          <Toaster
            /* La clase lo distingue del toaster interno de
               `NeonAuthUIProvider` si ese proveedor vuelve a montarse. Hoy no
               está en el árbol (no hay pantalla que use sus componentes), así
               que este es el único. */
            className="lv-toaster"
            position="bottom-center"
            toastOptions={{
              style: {
                background: "#08130D",
                color: "#FFFFFF",
                borderRadius: "999px",
                padding: "12px 24px",
                fontSize: "14px",
                fontWeight: 600,
                fontFamily:
                  "var(--font-lv-display), var(--font-lv-sans), system-ui, sans-serif",
                boxShadow:
                  "0 1px 2px rgba(8,19,13,0.04), 0 16px 40px -16px rgba(8,19,13,0.18)",
              },
            }}
            mobileOffset={{
              bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))",
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
