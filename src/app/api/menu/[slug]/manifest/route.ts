import { NextResponse } from "next/server";

import { getPlaceBrandBySlug } from "@/lib/db/queries";

type Params = { params: Promise<{ slug: string }> };

/**
 * Manifiesto PWA de la carta online de un negocio.
 *
 * Cuando el cliente añade la carta a la pantalla de inicio, el navegador usa
 * este manifiesto en vez del global (`/manifest.webmanifest`): la app instalada
 * abre en `/m/{slug}` —no en `/home`— y su icono es el logo del negocio con la
 * insignia de menú. Es el mismo mecanismo que la tarjeta de sellos, para que
 * quien tenga las dos instaladas no las confunda.
 *
 * El `id` es la URL de la carta y no un valor compartido: dos negocios distintos
 * son dos instalaciones distintas, y ninguna pisa la tarjeta de sellos del mismo
 * negocio (que tiene su propio `id` con el token).
 *
 * Cache de 1 hora: el nombre y el logo no cambian a menudo y el `slug` ya
 * identifica la carta de forma única.
 */
export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  const negocio = await getPlaceBrandBySlug(slug.slice(0, 120));

  if (!negocio) {
    return new NextResponse(null, { status: 404 });
  }

  const startUrl = `/m/${negocio.slug}`;
  const nombre = negocio.name;

  /* Los iconos los dibuja `/icono/{lado}`: el logo tal como está guardado es
     WebP y vive en el bucket, y Chrome pide los del manifiesto con CORS. Ahí se
     añade además la insignia de menú, que es lo que distingue este icono del de
     la tarjeta de sellos. El `maskable` también la lleva, colocada dentro del
     círculo que recorta Android. */
  const icono = (lado: number): string =>
    `/api/menu/${negocio.slug}/icono/${lado}`;

  const iconos = [
    { src: icono(192), sizes: "192x192", type: "image/png", purpose: "any" },
    { src: icono(512), sizes: "512x512", type: "image/png", purpose: "any" },
    {
      src: `${icono(512)}?maskable=1`,
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ];

  const manifest = {
    /* `name` es el nombre largo (diálogos de instalación y gestor de apps);
       `short_name` es la etiqueta bajo el icono. Se queda el nombre del negocio
       y no «Menú · …»: con la insignia en el icono, «La Bodeguita» frente a
       «Mis sellos» se distingue de un vistazo y no se corta en el lanzador. */
    name: `Menú de ${nombre}`,
    short_name: nombre.length > 24 ? `${nombre.slice(0, 23)}…` : nombre,
    description: `La carta de ${nombre}, con precios y fotos.`,
    id: startUrl,
    start_url: startUrl,
    /* Solo la carta: desde aquí, el enlace a la ficha (`/place/{id}`) se abre
       en el navegador y no roba la navegación a la app de La Verde. */
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
