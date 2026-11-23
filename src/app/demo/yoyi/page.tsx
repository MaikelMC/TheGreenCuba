import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema/places";
import { getPlaceBySlug } from "@/lib/db/queries";
import { estaAgotado } from "@/lib/disponibilidad";
import { FichaDemo, type FichaDemoData } from "@/components/demo/ficha-demo";

/**
 * Ficha demo de Yoyi Sabor con el diseño nuevo (estilo Facebook, modo oscuro).
 *
 * Es una ruta real para enseñarle al negocio cómo quedaría su ficha. Toda la
 * información sale de la base (VPS): nombre, logo, fotos, menú con precios,
 * agotados, horario, pagos y tarjeta de fidelidad. Nada escrito a mano.
 *
 * `noindex`: es una demo para compartir por enlace, no una página que deba
 * aparecer en Google.
 */

const SLUG = "yoyi-sabor";

/* Dinámica, no estática: la demo lee la base en cada visita (menú y agotados al
   día) y así el build no la prerenderiza —lo que exigiría la base en tiempo de
   compilación y rompía el export cuando no está a mano—. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Yoyi Sabor · ficha demo",
  description:
    "Cómo se vería la ficha de Yoyi Sabor en La Verde: menú, fotos, pedidos y tarjeta de fidelidad.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Yoyi Sabor · ficha demo",
    description: "Menú, fotos, pedidos y tarjeta de fidelidad.",
    images: [`/api/og?slug=${SLUG}`],
  },
};

const ETIQUETA_PAGO: Record<string, string> = {
  CUP: "CUP",
  USD: "USD (efectivo)",
  transfer: "Transferencia",
  transferencia: "Transferencia",
};

export default async function DemoYoyiPage() {
  const place = await getPlaceBySlug(SLUG);
  if (!place) notFound();

  /* `fidelidad` y `paymentMethods` no viajan en `UserPlace`; se leen directo de
     la fila para completar la ficha. */
  const [extra] = await db
    .select({
      fidelidad: places.fidelidad,
      paymentMethods: places.paymentMethods,
    })
    .from(places)
    .where(eq(places.slug, SLUG))
    .limit(1);

  const ahora = Date.now();
  const visibles = place.menu.filter((m) => !m.oculto);
  const disponibles = visibles.filter((m) => !estaAgotado(m, ahora));
  const agotados = visibles.filter((m) => estaAgotado(m, ahora));

  const productos = disponibles.map((m, i) => ({
    id: m.id ?? `p${i}`,
    name: m.name,
    desc: (m.description || "").replace(/\s+/g, " ").trim(),
    cat: m.category || "Otros",
    precio: Math.round(Number(m.price) || 0),
  }));
  const categorias = [...new Set(productos.map((p) => p.cat))];

  const fotos = (place.photos ?? [])
    .slice()
    .sort((a, b) => (a.isCover ? -1 : b.isCover ? 1 : 0))
    .map((f) => f.url);

  const pagos = (extra?.paymentMethods ?? [])
    .map((p) => ETIQUETA_PAGO[p] ?? p)
    .filter(Boolean);

  const tienePlanta = place.energiaRespaldo === "planta";
  const fid =
    extra?.fidelidad && extra.fidelidad.activo ? extra.fidelidad : null;

  const servicios: string[] = [
    "A domicilio",
    "Pedidos por WhatsApp",
    "Apartar por WhatsApp",
    ...(fid ? ["Tarjeta de fidelidad"] : []),
    ...(tienePlanta ? ["Funciona sin corriente"] : []),
  ];

  const data: FichaDemoData = {
    name: place.name,
    city: place.city || "",
    address: (place.address || "").replace(/^Direcci[oó]n\s+/i, "").trim(),
    schedule: place.schedule || "",
    whatsapp: (place.whatsapp || place.phone || "").replace(/\D/g, ""),
    logoUrl: place.logoUrl || "",
    fotos,
    intro: place.description || "",
    tiempo: place.entrega?.tiempo
      ? `${place.entrega.tiempo.min}–${place.entrega.tiempo.max} min`
      : "20–45 min",
    productos,
    agotados: agotados.map((m) => m.name),
    categorias,
    pagos,
    tienePlanta,
    servicios,
    fidelidad: fid
      ? {
          nombre: fid.nombre,
          metas: fid.metas.map((x) => ({ sellos: x.sellos, premio: x.premio })),
          compraMinima: fid.compraMinima
            ? { monto: fid.compraMinima.monto, moneda: fid.compraMinima.moneda }
            : null,
        }
      : null,
  };

  return <FichaDemo data={data} />;
}
