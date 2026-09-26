import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

/**
 * Manifiesto web de La Verde.
 *
 * Es lo que leen los navegadores al «Agregar a la pantalla de inicio»: sin
 * esto Android e iOS inventaban un icono —una captura de la página o un
 * recorte del favicon 16×16, según el día—. Los iconos que nombra salen de
 * `public/icons/`, generados desde el logo real del sitio por
 * `scripts/generate-icons.mjs` (correr de nuevo si cambia el logo).
 *
 * Next sirve este archivo en `/manifest.webmanifest` y añade la etiqueta
 * `<link rel="manifest">` a todas las páginas por su cuenta.
 *
 * `display: "standalone"` abre sin barra de navegador, como una app — el sitio
 * ya está pensado para móvil: `viewportFit: "cover"` y las utilidades
 * `.pb-safe-bottom` reservan el hueco del indicador de inicio de iOS.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${siteConfig.name} — ${siteConfig.slogan}`,
    short_name: siteConfig.name,
    description: siteConfig.description,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "es",
    /* El mismo tono que la superficie clara del sitio; es el color que tiñe la
       barra de estado y la pantalla de arranque de la app instalada. */
    background_color: "#F6F3EC",
    theme_color: "#F6F3EC",
    categories: ["travel", "food", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        /* Android recorta un círculo para los iconos adaptativos: esta
           variante trae el logo al 66% sobre fondo lleno para que el recorte
           no se lo coma. */
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
