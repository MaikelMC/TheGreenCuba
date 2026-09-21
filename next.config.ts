import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/* `connect-src 'self'` se queda como estaba, y conviene dejar dicho por qué,
   porque es contraintuitivo.

   Aquí hubo un añadido que abría el connect-src al origen de Neon Auth. Estaba
   mal y se quitó: el cliente del navegador (`src/lib/auth/client.ts`) no habla
   con Neon. `createAuthClient()` se construye sin URL, el adaptador acaba
   pasando `baseURL: undefined` a Better Auth, y Better Auth, sin baseURL, usa
   el **origen actual**. Todas sus llamadas van a `/api/auth/*` en este mismo
   dominio, y quien habla con Neon es nuestro catch-all `[...path]`, en el
   servidor, que es justo lo que significa "proxy them to the Neon Auth" en su
   documentación.

   Si algún día alguien añade algo que sí llame a Neon desde el navegador —los
   componentes de `@neondatabase/auth-ui`, por ejemplo, que aquí no se usan—,
   esto es lo primero que hay que tocar, o el navegador lo bloqueará en
   producción con un error que no menciona el CSP por ninguna parte.

   Los dos geocoders sí van aparte, y aquí está el motivo. `src/lib/map/geocode.ts`
   se escribió para llamarse desde el navegador —lo dice su cabecera— y así lo
   usa el buscador del header en cada tecla. El CSP se quedó en `'self'` y el
   navegador los bloqueaba en producción con exactamente el error que avisa el
   párrafo de arriba. Van por `connect-src` y no por un proxy propio porque el
   código ya estaba escrito así y son best-effort: si fallan o están bloqueados
   por la red, el pin manual del mapa sigue funcionando.

   Consecuencia que conviene tener presente: la consulta del usuario —incluida
   la que va al buscador de IA— sale del navegador a Photon en cada pulsación.
   Si algún día eso importa, el arreglo es mover `searchAddress` a una ruta
   propia y quitar estos dos orígenes de aquí.

   El router de OSRM es el caso contrario y sirve de ejemplo de cuándo NO
   abrir esto. También bloqueaba la ruta del mapa en producción —mismo síntoma
   exacto: el código caía a su respaldo de línea recta y nadie relacionaba una
   cosa con la otra—, pero aquí sí se puso proxy propio (`/api/route`). La
   diferencia es que las rutas no son best-effort de verdad: el respaldo es una
   recta que no sirve para nada, así que más vale que la llamada funcione. Con
   el proxy el navegador solo habla con este origen, este `connect-src` sigue
   cerrado, y el día que se cambie de proveedor de rutas —el servidor demo de
   OSRM limita a ~1 req/s— se cambia una URL en el servidor. */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://photon.komoot.io https://nominatim.openstreetmap.org",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

// Headers aplicados en todas las respuestas.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), payment=(), geolocation=(self)",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

// HSTS y CSP solo en producción (en dev romperían localhost/HTTP).
if (isProd) {
  securityHeaders.push(
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    { key: "Content-Security-Policy", value: CSP },
  );
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      /* De aquí salen las fotos de los negocios: Neon sirve los objetos de un
         bucket `public_read` desde el endpoint de la rama. Sin esta línea
         `next/image` se niega a optimizarlas y la ficha pública se queda sin
         fotos.

         El comodín es ancho a propósito. Antes había dos entradas —el endpoint
         de la API y el de lectura— y con Neon son el mismo servidor, así que
         sobra una. Y el nombre lleva dentro el id de la rama, la celda y la
         región, que cambian entre entornos: fijarlo obligaría a tocar esto cada
         vez que se mueve una rama, y no compra nada, porque las URL no las
         elige nadie de fuera — las escribe `publicUrl()` en el servidor. */
      {
        protocol: "https",
        hostname: "**.neon.tech",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  /* Aquí vivían dos cosas que se fueron con la autenticación propia:
     `img.clerk.com` en `remotePatterns` (Clerk nunca llegó a ser dependencia) y
     `experimental.serverActions.bodySizeLimit`. El límite se quitó al subir a
     Next 16 porque no recortaba nada: el proyecto no tiene ni una Server Action
     (ningún archivo lleva `use server`). Si algún día se añade una que suba
     imágenes, vuelve como `serverActions.bodySizeLimit`. */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
