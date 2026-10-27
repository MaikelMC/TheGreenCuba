import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

/**
 * Qué puede rastrear un buscador.
 *
 * Antes no había `robots.txt` y el rastreo quedaba a criterio del buscador: sin
 * prohibiciones, Google llega a `/admin` y a `/api` y las indexa si alguna vez
 * las alcanza por un enlace. Lo que se cierra aquí es lo que o bien es privado
 * —el panel, el perfil, las preferencias del onboarding— o bien no es una
 * página: las rutas de API devuelven JSON y no tienen nada que hacer en un
 * índice.
 *
 * `/home` también va fuera, y conviene decir por qué: es el mapa con las
 * recomendaciones calculadas a partir de la ubicación de quien entró, así que no
 * hay una versión «de todos» que indexar. Su contenido depende de la sesión.
 *
 * Lo que sí queda abierto es la portada y las fichas de lugar, que son las
 * puertas de entrada orgánicas.
 *
 * `Disallow` es una petición, no un candado: quien decide no rastrear es el
 * buscador. La protección de verdad de esas rutas es el proxy, que exige sesión.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api",
          "/business",
          "/profile",
          "/projects",
          "/notifications",
          "/enlaces",
          "/onboarding",
          "/login",
          "/register",
          "/verify-email",
          "/forgot-password",
          "/reset-password",
          "/restablecer-contrasena",
          /* Fichas de desarrollo: la ruta devuelve 404 en producción, pero no
             hay razón para ofrecérsela a un rastreador. */
          "/dev-login",
          /* El mapa depende de la sesión y no tiene una versión «de todos». */
          "/home",
        ],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    /* `Host` espera el nombre del host, no la URL entera. */
    host: new URL(siteConfig.url).host,
  };
}
