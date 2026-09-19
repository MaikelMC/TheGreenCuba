import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/* El cliente de Neon Auth (`src/lib/auth/client.ts`) llama a su propio origen
   desde el navegador, y ese origen no es el nuestro. Con `connect-src 'self'` a
   secas, el CSP de producción bloquea el inicio de sesión y el error que se ve
   en pantalla es un "no se pudo conectar" que no dice por qué. Se lee de la
   misma variable `NEXT_PUBLIC_` que usa el cliente, para que no puedan
   desincronizarse. */
const NEON_AUTH_ORIGIN = process.env.NEXT_PUBLIC_NEON_AUTH_URL ?? "";

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  ["connect-src 'self'", NEON_AUTH_ORIGIN].filter(Boolean).join(" "),
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
