import type { Metadata, Viewport } from "next";
import { DM_Sans, Source_Sans_3, JetBrains_Mono } from "next/font/google";
import { lvFontVars } from "@/lib/fonts";
import { ThemeProvider } from "@/providers/theme-provider";
import { Toaster } from "sonner";
import "./globals.css";

const fontDisplay = DM_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const fontBody = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
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
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "La Verde | Encuentra tu lugar en Cuba",
    template: "%s | La Verde",
  },
  description:
    "Encuentra los mejores lugares en Cuba con inteligencia artificial. Restaurantes, cafeterías, playas y más.",
  keywords: ["Cuba", "lugares", "recomendaciones", "IA", "turismo"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
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
            {children}
            {/* Avisos flotantes. La pastilla va en `ink` con texto blanco, como
                la del panel de negocio: es el mismo aviso y tiene que leerse
                igual. Los tokens `--foreground` / `--background` eran el
                sistema viejo.
                `mobileOffset` sube el aviso por encima de la barra inferior:
                en móvil el panel de negocio y el de admin la tienen fija, y el
                aviso se posaba justo encima de las pestañas. */}
            <Toaster
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
              mobileOffset={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))" }}
            />
          </ThemeProvider>
      </body>
    </html>
  );
}
