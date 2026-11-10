import { NextResponse } from "next/server";
import { tarjetaPublica } from "@/lib/fidelidad-server";

type Params = { params: Promise<{ token: string }> };

/**
 * Manifiesto PWA específico de la tarjeta de sellos.
 *
 * Cuando el cliente añade la tarjeta a la pantalla de inicio, el navegador
 * usa este manifiesto en vez del global (/manifest.webmanifest): así la
 * app instalada abre en la tarjeta correcta y muestra el logo del negocio
 * como icono, no el de La Verde.
 *
 * El swap del <link rel="manifest"> lo hace tarjeta-cliente.tsx desde el
 * cliente: el App Router no permite sobreescribir el link global por página.
 *
 * Cache de 1 hora: el nombre y el logo del negocio no cambian a menudo, y
 * el token ya identifica la tarjeta de forma única.
 */
export async function GET(_req: Request, { params }: Params) {
  const { token } = await params;
  const data = await tarjetaPublica(token.slice(0, 64));

  if (!data) {
    return new NextResponse(null, { status: 404 });
  }

  const startUrl = `/m/${data.negocio.slug}/tarjeta/${token}`;
  const nombre = data.negocio.nombre;

  /* Icono: logo del negocio si existe, con los de La Verde como respaldo.
     El browser elige el mejor disponible según tamaño y propósito. */
  const iconos = data.negocio.logoUrl
    ? [
        { src: data.negocio.logoUrl, sizes: "any", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ]
    : [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ];

  const manifest = {
    name: `Sellos · ${nombre}`,
    short_name: "Mis sellos",
    description: `Tu tarjeta de fidelidad en ${nombre}`,
    id: startUrl,
    start_url: startUrl,
    scope: startUrl,
    display: "standalone",
    background_color: "#06211a",
    theme_color: "#06211a",
    lang: "es",
    icons: iconos,
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
