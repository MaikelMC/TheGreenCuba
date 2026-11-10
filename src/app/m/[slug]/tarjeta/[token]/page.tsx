import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tarjetaPublica } from "@/lib/fidelidad-server";
import { aTarjetaVista } from "@/lib/tarjeta-vista";
import { TarjetaCliente } from "@/components/menu/tarjeta-cliente";

type Params = { params: Promise<{ slug: string; token: string }> };

/**
 * La tarjeta que abre el cliente desde el enlace de WhatsApp.
 *
 * Sin cuenta y sin sesión: el token es la llave. Nunca se busca por teléfono
 * desde fuera, y el número se enseña enmascarado. La página no se indexa y no
 * entra en la caché de páginas; el service worker le da su propia caché
 * (`lv-tarjetas-`) para que el cliente la vea sin red, con el aviso de que
 * puede estar desactualizada.
 *
 * Si el token no existe, el cliente se borró o el negocio ya no tiene la
 * tarjeta, se responde un 404 de verdad: es lo que le dice al service worker
 * que borre la copia guardada.
 *
 * `React.cache` deduplica la consulta DB entre `generateMetadata` y el render:
 * con `force-dynamic` Next no cachea entre los dos, pero sí dentro del mismo
 * request cuando el token es el mismo.
 */
export const dynamic = "force-dynamic";

const getTarjeta = cache(tarjetaPublica);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params;
  const data = await getTarjeta(token);

  const nombre = data?.negocio.nombre ?? "La Verde";
  const startUrl = data
    ? `/m/${data.negocio.slug}/tarjeta/${token}`
    : undefined;

  return {
    title: `Sellos · ${nombre}`,
    robots: { index: false, follow: false },
    /* Sobreescribe el manifest global (/manifest.webmanifest) por el específico
       de esta tarjeta: así «Agregar a pantalla de inicio» guarda el start_url
       correcto (la tarjeta, no /home) y el icono del negocio. Safari lee el
       link al parsear el HTML, antes de que corra cualquier JS, por lo que el
       swap client-side no funciona: hay que hacerlo aquí. */
    ...(startUrl && { manifest: `/api/tarjeta/${token}/manifest` }),
    /* iOS Safari usa <link rel="apple-touch-icon"> para el icono de pantalla
       de inicio, no los icons del manifest. Con esto el icono instalado muestra
       el logo del negocio en vez del de La Verde. */
    ...(data?.negocio.logoUrl && {
      icons: { apple: data.negocio.logoUrl },
    }),
    appleWebApp: {
      capable: true,
      title: `Sellos · ${nombre}`,
      statusBarStyle: "default",
    },
  };
}

export default async function TarjetaPage({ params }: Params) {
  const { slug, token } = await params;
  const data = await getTarjeta(token);

  if (!data || data.negocio.slug !== slug) notFound();

  return <TarjetaCliente token={token} inicial={aTarjetaVista(data)} />;
}
