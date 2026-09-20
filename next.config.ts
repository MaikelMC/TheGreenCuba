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
   producción con un error que no menciona el CSP por ninguna parte. */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
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
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
      /* Es el dominio desde el que se sirven las fotos de los negocios:
         `R2_PUBLIC_URL` apunta a un `pub-<hash>.r2.dev`. Sin esta línea
         `next/image` se niega a optimizarlas y la ficha pública se queda sin
         fotos. El endpoint de la API (`*.r2.cloudflarestorage.com`, arriba) no
         sirve para esto: no es público. */
      {
        protocol: "https",
        hostname: "**.r2.dev",
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
