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
 *
 * `start_url` apunta a `/home` y no a `/`: la portada es marketing y la app
 * vive en `/home`. `id` se queda en `/` porque cambiarlo crea una instalación
 * distinta y ya puede haber usuarios con el icono puesto.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${siteConfig.name} — ${siteConfig.slogan}`,
    short_name: siteConfig.name,
    description: siteConfig.description,
    id: "/",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    /* La app se diseñó en vertical —mapa arriba, hoja de recomendaciones
       abajo— y las pantallas de arranque de iOS son verticales. Cambiar esto
       exige generar también las variantes horizontales; no se toca sin esa
       tanda. */
    orientation: "portrait",
    lang: "es",
    /* El cielo del hero (`.lv-grid-glow`): es el color que tiñe la pantalla de
       arranque de la app instalada, detrás del icono — que ya lleva el mismo
       degradado. Antes iba arena y el icono verde oscuro flotaba sobre claro
       en cada lanzamiento. */
    background_color: "#06211a",
    theme_color: "#06211a",
    categories: ["travel", "food", "lifestyle"],
    /* Una app ya abierta se reutiliza en vez de abrir otra ventana: en Android
       pulsar el icono con la PWA en segundo plano no debe acumular instancias. */
    launch_handler: { client_mode: "navigate-existing" },
    /* Accesos directos del icono instalado. Las URLs son rutas reales; no hay
       iconos propios para ellos, así que el sistema usa el de la app. */
    shortcuts: [
      {
        name: "Buscar lugares",
        short_name: "Buscar",
        description: "Explora el catálogo y el mapa de La Verde.",
        url: "/home",
      },
      {
        name: "Mi negocio",
        short_name: "Mi negocio",
        description: "Ficha, métricas y catálogo de tu negocio.",
        url: "/business",
      },
      {
        name: "Mi perfil",
        short_name: "Mi perfil",
        description: "Tus datos, preferencias y lugares guardados.",
        url: "/profile",
      },
    ],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
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
