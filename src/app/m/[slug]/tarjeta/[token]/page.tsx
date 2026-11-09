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
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tu tarjeta de sellos",
  robots: { index: false, follow: false },
};

export default async function TarjetaPage({ params }: Params) {
  const { slug, token } = await params;
  const data = await tarjetaPublica(token);

  if (!data || data.negocio.slug !== slug) notFound();

  return <TarjetaCliente token={token} inicial={aTarjetaVista(data)} />;
}
