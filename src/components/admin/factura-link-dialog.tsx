"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { whatsappHref } from "@/lib/contact-links";
import { formatoUsd, type FacturaResumen } from "@/lib/facturas";

/**
 * La ventana que aparece al emitir una factura.
 *
 * El enlace se puede copiar, abrir o mandar por WhatsApp. Es el mismo enlace
 * público que ve el cliente: no hay una URL interna distinta que se pueda
 * compartir por error.
 */
export function FacturaLinkDialog({
  factura,
  url,
  telefono,
  open,
  onOpenChange,
}: {
  factura: FacturaResumen | null;
  url: string;
  telefono: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [copiado, setCopiado] = useState(false);

  if (!factura) return null;

  const datos = factura;
  const mensaje = `Hola, te comparto la factura de La Verde para «${datos.negocioNombre}»: ${url}`;
  const whatsapp = telefono
    ? `${whatsappHref(telefono)}?text=${encodeURIComponent(mensaje)}`
    : `https://wa.me/?text=${encodeURIComponent(mensaje)}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      toast.success("Enlace copiado.");
      window.setTimeout(() => setCopiado(false), 1800);
    } catch {
      toast.error("No se pudo copiar. Selecciona el enlace y cópialo a mano.");
    }
  }

  async function compartir() {
    if (!("share" in navigator)) {
      toast.error("Este navegador no permite compartir. Copia el enlace.");
      return;
    }
    try {
      await navigator.share({
        title: `Factura de ${datos.negocioNombre}`,
        text: mensaje,
        url,
      });
    } catch {
      /* El usuario cerró el diálogo del sistema: no es un error que avisar. */
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Factura lista para compartir</DialogTitle>
          <DialogDescription>
            {datos.negocioNombre} · {formatoUsd(datos.precioUsd)} USD ·{" "}
            {datos.id}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-verde-200 bg-verde-50/60 p-gap-sm">
          <p className="text-meta font-semibold text-ink">
            Enlace público de la factura
          </p>
          <p className="mt-gap-2xs break-all rounded-xl bg-white/80 px-gap-sm py-2 font-mono text-meta text-ink-soft">
            {url}
          </p>
          <p className="mt-gap-xs text-meta text-ink-soft/70">
            El cliente verá el detalle, podrá aceptar la compra y descargar su
            copia. El servicio se activa cuando administración confirme el pago.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-gap-xs sm:grid-cols-3">
          <button
            type="button"
            onClick={() => void copiar()}
            className="inline-flex h-11 items-center justify-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-sm font-lv-display text-small font-semibold text-ink transition hover:border-verde-300 hover:text-verde-700"
          >
            {copiado ? <Check size={15} /> : <Copy size={15} />}
            {copiado ? "Copiado" : "Copiar enlace"}
          </button>
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-sm font-lv-display text-small font-semibold text-ink transition hover:border-verde-300 hover:text-verde-700"
          >
            <MessageCircle size={15} />
            WhatsApp
          </a>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center gap-gap-xs rounded-full bg-verde-400 px-gap-sm font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition hover:bg-verde-300"
          >
            <ExternalLink size={15} />
            Abrir factura
          </a>
        </div>

        <button
          type="button"
          onClick={() => void compartir()}
          className="inline-flex h-11 items-center justify-center gap-gap-xs self-start rounded-full px-gap-sm font-lv-display text-small font-semibold text-verde-700 transition hover:bg-verde-50"
        >
          <Share2 size={15} />
          Compartir por otra vía
        </button>
      </DialogContent>
    </Dialog>
  );
}
