import { notFound } from "next/navigation";
import { FacturaPublica } from "@/components/facturas/factura-publica";
import {
  contextoPagoFactura,
  obtenerFactura,
} from "@/lib/facturas-server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Factura · La Verde",
  robots: { index: false, follow: false },
};

export default async function FacturaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const factura = await obtenerFactura(id);
  if (!factura) notFound();

  const pago = await contextoPagoFactura(factura);

  return (
    <main className="min-h-dvh bg-[#08130D] sm:px-gutter sm:py-gap-lg">
      <FacturaPublica factura={factura} pago={pago} />
    </main>
  );
}
