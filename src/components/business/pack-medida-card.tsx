"use client";

import { useState } from "react";
import { Clock, Loader2, Package, Wallet } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { textoCup } from "@/lib/plans";
import { useCatalogo } from "@/providers/catalogo-provider";
import type { PackMedidaResumen } from "@/lib/pack-medida";

const PILDORA = "inline-flex items-center rounded-full border px-[10px] py-[3px] font-lv-display text-[10px] font-extrabold uppercase tracking-[0.09em]";

function EstadoChip({ estado }: { estado: PackMedidaResumen["estado"] }) {
  const cfg = {
    solicitado: { label: "En revisión", cls: "border-amber-200 bg-amber-50 text-amber-700" },
    borrador:   { label: "Preparando",  cls: "border-blue-200 bg-blue-50 text-blue-700" },
    enviado:    { label: "Listo para pagar", cls: "border-verde-200 bg-verde-50 text-verde-700" },
    pagado:     { label: "Activo",      cls: "border-verde-200 bg-verde-50 text-verde-700" },
    vencido:    { label: "Vencido",     cls: "border-ink/10 bg-sand text-ink-soft/75" },
    cancelado:  { label: "Cancelado",   cls: "border-ink/10 bg-sand text-ink-soft/75" },
    rechazado:  { label: "Rechazado",   cls: "border-red-200 bg-red-50 text-red-700" },
  }[estado];
  return <span className={cn(PILDORA, cfg.cls)}>{cfg.label}</span>;
}

/**
 * Tarjeta del pack a medida en el panel del negocio.
 *
 * Para `enviado` muestra el precio y el botón de pago con QvaPay.
 * Para el resto de estados activos muestra el contexto sin acción.
 * El dueño puede cancelar un pack pendiente.
 */
export function PackMedidaCard({
  pack,
  placeId,
  esDueno,
  onCancelado,
}: {
  pack: PackMedidaResumen;
  placeId: string;
  esDueno: boolean;
  onCancelado?: () => void;
}) {
  const cat = useCatalogo();
  const [pagando, setPagando] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const usd = pack.precioUsd;

  async function pagar() {
    if (pagando || pack.estado !== "enviado" || !usd) return;
    setPagando(true);
    try {
      const res = await fetch("/api/pagos/qvapay/pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId, packId: pack.id }),
      });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !data?.url) {
        toast.error(data?.error ?? "No se pudo abrir el pago.");
        return;
      }
      window.location.href = data.url;
    } catch {
      toast.error("No se pudo abrir el pago.");
    } finally {
      setPagando(false);
    }
  }

  async function cancelar() {
    if (cancelando) return;
    setCancelando(true);
    try {
      const res = await fetch(`/api/business/packs-medida/${pack.id}`, { method: "PATCH" });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo cancelar.");
        return;
      }
      toast.success("Pack cancelado.");
      onCancelado?.();
    } catch {
      toast.error("No se pudo cancelar.");
    } finally {
      setCancelando(false);
    }
  }

  return (
    <article className="relative isolate flex flex-col rounded-[26px] border border-verde-200/60 bg-[linear-gradient(120deg,#edf7ef,#f7fbf7)] p-gap-lg shadow-soft">
      <div className="flex flex-wrap items-center gap-gap-xs">
        <Package size={16} className="shrink-0 text-verde-600" strokeWidth={1.8} />
        <h3 className="font-lv-display text-body font-bold tracking-[-0.01em] text-ink">
          Pack a medida
        </h3>
        <EstadoChip estado={pack.estado} />
      </div>

      {pack.estado === "solicitado" && (
        <p className="mt-gap-sm text-small text-ink-soft/75">
          Hemos recibido tu solicitud. El equipo la revisará y te enviará una propuesta
          en menos de 24 horas.
        </p>
      )}

      {pack.estado === "borrador" && (
        <p className="mt-gap-sm text-small text-ink-soft/75">
          El equipo de La Verde está preparando tu pack. Te avisaremos cuando esté listo para pagarlo.
        </p>
      )}

      {pack.estado === "enviado" && usd !== null && (
        <>
          <p className="mt-gap-sm flex flex-wrap items-baseline gap-gap-2xs">
            <span className="font-lv-display text-h3 font-bold text-ink">{usd} USD</span>
            <span className="text-meta text-ink-soft/75">
              al mes · {textoCup(usd, cat)}
            </span>
            {pack.oferta2x1 && (
              <span className="rounded-full border border-verde-300 bg-verde-50 px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.09em] text-verde-700">
                2×1 primer mes
              </span>
            )}
          </p>

          {pack.notaCliente && (
            <p className="mt-gap-sm text-small text-ink-soft/75">{pack.notaCliente}</p>
          )}

          {pack.servicios.length > 0 && (
            <p className="mt-gap-xs text-meta text-ink-soft/60">
              Incluye: {pack.servicios.join(" · ")}
            </p>
          )}

          <div className="mt-auto pt-gap-lg">
            <button
              type="button"
              onClick={pagar}
              disabled={pagando}
              className="flex h-11 w-full items-center justify-center gap-gap-xs rounded-full bg-verde-400 font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pagando ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Abriendo…
                </>
              ) : (
                <>
                  <Wallet size={16} strokeWidth={2} />
                  Pagar con QvaPay
                </>
              )}
            </button>
          </div>
        </>
      )}

      {pack.estado === "pagado" && pack.venceEn && (
        <p className="mt-gap-sm flex items-center gap-gap-xs text-small text-ink-soft/75">
          <Clock size={14} className="shrink-0" strokeWidth={1.8} />
          Activo hasta el{" "}
          {new Date(pack.venceEn).toLocaleDateString("es-CU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      )}

      {/* Solo el dueño puede cancelar; trabajadores solo ven. */}
      {esDueno && ["solicitado", "borrador", "enviado"].includes(pack.estado) && (
        <button
          type="button"
          onClick={cancelar}
          disabled={cancelando}
          className="mt-gap-md self-start text-meta text-ink-soft/60 underline underline-offset-2 hover:text-ink-soft disabled:cursor-not-allowed"
        >
          {cancelando ? "Cancelando…" : "Cancelar solicitud"}
        </button>
      )}
    </article>
  );
}
