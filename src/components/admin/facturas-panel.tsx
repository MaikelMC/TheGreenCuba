"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Receipt,
  RotateCcw,
  Search,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  EstadoVacioAdmin,
  TarjetaAdmin,
  TarjetaKpi,
} from "@/components/admin/ui/tarjeta";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FACTURA_ESTADO,
  formatoUsd,
  type FacturaResumen,
} from "@/lib/facturas";
import { cn } from "@/lib/utils";

const FECHA = new Intl.DateTimeFormat("es-CU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Havana",
});

const ESTADO_CLASE: Record<FacturaResumen["estado"], string> = {
  pendiente: "border-amber-200 bg-amber-50 text-amber-800",
  aceptada: "border-blue-200 bg-blue-50 text-blue-800",
  en_revision: "border-amber-200 bg-amber-50 text-amber-800",
  pagada: "border-verde-200 bg-verde-50 text-verde-700",
  reembolsada: "border-destructive/20 bg-destructive/5 text-destructive",
  caducada: "border-ink/10 bg-sand text-ink-soft/75",
  cancelada: "border-ink/10 bg-sand text-ink-soft/75",
};

/**
 * La sección de facturas del panel.
 *
 * Administración puede buscar por el ID que se compartió, abrir el enlace del
 * cliente, copiarlo y confirmar el pago. Confirmar es lo que aplica el plan o
 * el pack: la factura aceptada sola no da acceso.
 */
export function FacturasPanel({
  facturas,
  q,
  baseUrl,
}: {
  facturas: FacturaResumen[];
  q: string;
  baseUrl: string;
}) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState(q);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [reembolsando, setReembolsando] = useState<FacturaResumen | null>(null);
  const [motivoReembolso, setMotivoReembolso] = useState("");
  const [entiendeReembolso, setEntiendeReembolso] = useState(false);

  const pendientes = facturas.filter((f) => f.estado === "pendiente").length;
  const aceptadas = facturas.filter(
    (f) => f.estado === "aceptada" || f.estado === "en_revision",
  ).length;
  const pagadas = facturas.filter((f) => f.estado === "pagada").length;

  function abrirReembolso(factura: FacturaResumen) {
    setMotivoReembolso("");
    setEntiendeReembolso(false);
    setReembolsando(factura);
  }

  function cerrarReembolso() {
    if (procesando !== null) return;
    setReembolsando(null);
    setMotivoReembolso("");
    setEntiendeReembolso(false);
  }

  async function reembolsar() {
    if (!reembolsando) return;
    const motivo = motivoReembolso.trim();
    if (motivo.length < 5) {
      toast.error("Escribe el motivo del reembolso (mínimo 5 caracteres).");
      return;
    }
    if (!entiendeReembolso) {
      toast.error("Confirma que entiendes cómo se descuenta del facturado.");
      return;
    }

    const id = reembolsando.id;
    setProcesando(`reembolsar:${id}`);
    try {
      const res = await fetch(
        `/api/admin/facturas/${encodeURIComponent(id)}/reembolsar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motivo }),
        },
      );
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo registrar el reembolso.");
        return;
      }
      setReembolsando(null);
      setMotivoReembolso("");
      setEntiendeReembolso(false);
      toast.success("Reembolso registrado y descontado del facturado del mes.");
      router.refresh();
    } catch {
      toast.error("No hubo respuesta del servidor.");
    } finally {
      setProcesando(null);
    }
  }

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const limpio = busqueda.trim();
    router.push(limpio ? `/admin/facturas?q=${encodeURIComponent(limpio)}` : "/admin/facturas");
  }

  async function copiar(id: string) {
    try {
      await navigator.clipboard.writeText(`${baseUrl}/factura/${id}`);
      toast.success("Enlace copiado.");
    } catch {
      toast.error("No se pudo copiar el enlace.");
    }
  }

  async function accion(id: string, tipo: "confirmar" | "cancelar") {
    const pregunta =
      tipo === "confirmar"
        ? "¿Confirmar el pago? Se activará el plan o pack y quedará registrado en Ingresos."
        : "¿Cancelar esta propuesta? El enlace dejará de servir.";
    if (!window.confirm(pregunta)) return;

    setProcesando(`${tipo}:${id}`);
    try {
      const res = await fetch(`/api/admin/facturas/${encodeURIComponent(id)}/${tipo}`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo completar la acción.");
        return;
      }
      toast.success(
        tipo === "confirmar" ? "Pago confirmado y servicio activado." : "Propuesta cancelada.",
      );
      router.refresh();
    } catch {
      toast.error("No hubo respuesta del servidor.");
    } finally {
      setProcesando(null);
    }
  }

  return (
    <div className="flex flex-col gap-gap-lg">
      <header className="flex flex-wrap items-end justify-between gap-gap-sm">
        <div>
          <span className="font-lv-display text-meta font-semibold uppercase tracking-[0.12em] text-ink-soft/60">
            Facturación
          </span>
          <h1 className="font-lv-display text-h2 font-bold text-ink">Facturas</h1>
          <p className="mt-1 max-w-[70ch] text-small text-ink-soft/75">
            Enlaces enviados a los negocios, con el ID que se compartió y el
            control de aceptación y pago.
          </p>
        </div>
        <form onSubmit={buscar} className="flex w-full max-w-md gap-gap-xs sm:w-auto">
          <label htmlFor="buscarFactura" className="sr-only">
            Buscar factura por ID o negocio
          </label>
          <div className="relative min-w-0 flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/50"
            />
            <input
              id="buscarFactura"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="ID o negocio"
              className="h-11 w-full rounded-full border border-ink/10 bg-white pl-9 pr-3 text-small text-ink outline-none focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-11 shrink-0 items-center rounded-full bg-verde-400 px-gap-md font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition hover:bg-verde-300"
          >
            Buscar
          </button>
        </form>
      </header>

      <div className="grid grid-cols-1 gap-gap-sm sm:grid-cols-3">
        <TarjetaKpi
          etiqueta="Pendientes"
          valor={String(pendientes)}
          detalle="Esperando aceptación"
          icono={Receipt}
        />
        <TarjetaKpi
          etiqueta="Aceptadas o en revisión"
          valor={String(aceptadas)}
          detalle="Esperando confirmar pago"
          icono={CheckCircle2}
        />
        <TarjetaKpi
          etiqueta="Pagadas"
          valor={String(pagadas)}
          detalle="Servicio activado"
          icono={CheckCircle2}
        />
      </div>

      <TarjetaAdmin>
        {facturas.length === 0 ? (
          <EstadoVacioAdmin
            icono={Receipt}
            titulo={q ? "No hay facturas con ese ID" : "Todavía no hay facturas"}
            descripcion={
              q
                ? "Prueba con el ID exacto o con el nombre del negocio."
                : "Emite una desde el pack a medida o desde el plan de un negocio."
            }
          />
        ) : (
          <ul className="flex flex-col divide-y divide-ink/5">
            {facturas.map((factura) => {
              const estado = FACTURA_ESTADO[factura.estado];
              const enlace = `${baseUrl}/factura/${factura.id}`;
              return (
                <li
                  key={factura.id}
                  className="flex flex-col gap-gap-sm py-gap-md first:pt-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-start justify-between gap-gap-sm">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-gap-xs">
                        <span className="font-lv-display text-body font-semibold text-ink">
                          {factura.negocioNombre}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-[9px] py-[3px] font-lv-display text-[10px] font-extrabold uppercase tracking-[0.09em]",
                            ESTADO_CLASE[factura.estado],
                          )}
                        >
                          {estado.etiqueta}
                        </span>
                      </div>
                      <p className="mt-1 text-small text-ink-soft/75">{factura.titulo}</p>
                      <p className="mt-[2px] text-meta text-ink-soft/60">
                        {FECHA.format(new Date(factura.creadoEn))} ·{" "}
                        <span className="font-mono">{factura.id}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-lv-display text-body font-bold tabular-nums text-ink">
                        {formatoUsd(factura.precioUsd)} USD
                      </p>
                      {factura.precioOriginalUsd !== null && (
                        <p className="text-meta text-ink-soft/55 line-through">
                          {formatoUsd(factura.precioOriginalUsd)} USD
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="text-meta text-ink-soft/65">{estado.descripcion}</p>

                  <div className="flex flex-wrap gap-gap-xs">
                    <a
                      href={enlace}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 items-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-sm font-lv-display text-meta font-semibold text-ink transition hover:border-verde-300 hover:text-verde-700"
                      aria-label="Abrir factura en nueva pestaña"
                    >
                      <ExternalLink size={14} /> Abrir
                    </a>
                    <button
                      type="button"
                      onClick={() => void copiar(factura.id)}
                      className="inline-flex h-10 items-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-sm font-lv-display text-meta font-semibold text-ink transition hover:border-verde-300 hover:text-verde-700"
                      aria-label="Copiar enlace de la factura"
                    >
                      <Copy size={14} /> Copiar enlace
                    </button>
                    {["aceptada", "en_revision"].includes(factura.estado) && (
                      <button
                        type="button"
                        onClick={() => void accion(factura.id, "confirmar")}
                        disabled={procesando !== null}
                        className="inline-flex h-10 items-center gap-gap-xs rounded-full bg-verde-400 px-gap-sm font-lv-display text-meta font-semibold text-verde-950 transition hover:bg-verde-300 disabled:opacity-60"
                        aria-label="Confirmar el pago y activar el servicio"
                      >
                        {procesando === `confirmar:${factura.id}` ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={14} />
                        )}
                        Confirmar pago
                      </button>
                    )}
                    {["pendiente", "aceptada", "en_revision"].includes(
                      factura.estado,
                    ) && (
                      <button
                        type="button"
                        onClick={() => void accion(factura.id, "cancelar")}
                        disabled={procesando !== null}
                        className="inline-flex h-10 items-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-sm font-lv-display text-meta font-semibold text-ink transition hover:border-destructive/30 hover:text-destructive disabled:opacity-60"
                        aria-label="Cancelar esta propuesta"
                      >
                        {procesando === `cancelar:${factura.id}` ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <XCircle size={14} />
                        )}
                        Cancelar
                      </button>
                    )}
                    {factura.estado === "pagada" && !factura.reembolso && (
                      <button
                        type="button"
                        onClick={() => abrirReembolso(factura)}
                        disabled={procesando !== null}
                        className="inline-flex h-10 items-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-sm font-lv-display text-meta font-semibold text-ink transition hover:border-destructive/30 hover:text-destructive disabled:opacity-60"
                        aria-label="Reembolsar esta factura"
                      >
                        <RotateCcw size={14} /> Reembolsar
                      </button>
                    )}
                  </div>

                  {factura.reembolso && (
                    <div className="rounded-xl border border-destructive/15 bg-destructive/5 p-gap-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-gap-xs">
                        <p className="font-lv-display text-small font-semibold text-destructive">
                          Reembolso de{" "}
                          {formatoUsd(factura.reembolso.montoCentavos / 100)} USD
                        </p>
                        <p className="text-meta text-ink-soft/65">
                          {FECHA.format(new Date(factura.reembolso.reembolsadoEn))}
                          {" · "}
                          {factura.reembolso.registradoPorNombre}
                        </p>
                      </div>
                      <p className="mt-1 text-small text-ink-soft/80">
                        Motivo: {factura.reembolso.motivo}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </TarjetaAdmin>

      <Dialog
        open={reembolsando !== null}
        onOpenChange={(open) => {
          if (!open) cerrarReembolso();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reembolsar factura</DialogTitle>
            <DialogDescription>
              {reembolsando
                ? `${reembolsando.negocioNombre} · ${formatoUsd(reembolsando.precioUsd)} USD`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-gap-sm">
            <div className="flex gap-gap-xs rounded-xl border border-amber-200 bg-amber-50 p-gap-sm text-small text-amber-900">
              <AlertTriangle size={18} className="mt-[1px] shrink-0" />
              <p>
                El importe se descontará del facturado del mes en Ingresos. La
                factura quedará marcada como reembolsada y el motivo se guarda
                en el registro de control.
              </p>
            </div>

            <label className="flex flex-col gap-gap-xs">
              <span className="font-lv-display text-small font-semibold text-ink">
                Motivo del reembolso
              </span>
              <textarea
                value={motivoReembolso}
                onChange={(e) => setMotivoReembolso(e.target.value)}
                rows={4}
                maxLength={500}
                placeholder="Explica por qué se devuelve el dinero…"
                className="w-full resize-none rounded-xl border border-ink/10 bg-white px-gap-sm py-gap-xs text-small text-ink outline-none focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20"
              />
              <span className="text-meta text-ink-soft/60">
                {motivoReembolso.trim().length}/500 · mínimo 5 caracteres
              </span>
            </label>

            <label className="flex items-start gap-gap-xs text-small text-ink-soft/80">
              <input
                type="checkbox"
                checked={entiendeReembolso}
                onChange={(e) => setEntiendeReembolso(e.target.checked)}
                className="mt-[3px] h-4 w-4 rounded border-ink/20 accent-verde-500"
              />
              <span>
                Confirmo que quiero reembolsar esta factura y que el importe se
                descuente del facturado del mes.
              </span>
            </label>

            <div className="flex flex-wrap justify-end gap-gap-xs">
              <button
                type="button"
                onClick={cerrarReembolso}
                disabled={procesando !== null}
                className="inline-flex h-10 items-center rounded-full border border-ink/10 bg-white px-gap-sm font-lv-display text-meta font-semibold text-ink transition hover:border-ink/20 disabled:opacity-60"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() => void reembolsar()}
                disabled={
                  procesando !== null ||
                  motivoReembolso.trim().length < 5 ||
                  !entiendeReembolso
                }
                className="inline-flex h-10 items-center gap-gap-xs rounded-full bg-destructive px-gap-sm font-lv-display text-meta font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {procesando?.startsWith("reembolsar:") ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RotateCcw size={14} />
                )}
                Confirmar reembolso
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}