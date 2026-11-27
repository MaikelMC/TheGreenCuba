"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Download, Loader2, Play, Printer, Receipt } from "lucide-react";
import { toast } from "sonner";
import {
  FACTURA_ESTADO,
  formatoUsd,
  type FacturaResumen,
} from "@/lib/facturas";
import { cn } from "@/lib/utils";

const FECHA = new Intl.DateTimeFormat("es-CU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Havana",
});

const ESTADO_CLASE: Record<FacturaResumen["estado"], string> = {
  pendiente: "border-amber-200 bg-amber-50 text-amber-800",
  aceptada: "border-blue-200 bg-blue-50 text-blue-800",
  en_revision: "border-amber-200 bg-amber-50 text-amber-800",
  pagada: "border-verde-200 bg-verde-50 text-verde-700",
  caducada: "border-ink/10 bg-sand text-ink-soft/75",
  cancelada: "border-ink/10 bg-sand text-ink-soft/75",
};

function escapar(texto: string): string {
  return texto
    .replaceAll("&", "&")
    .replaceAll("<", "<")
    .replaceAll(">", ">")
    .replaceAll('"', '"');
}

function htmlFactura(factura: FacturaResumen): string {
  const conceptos = factura.conceptos
    .map(
      (concepto) => `
        <section>
          <h3>${escapar(concepto.nombre)}</h3>
          <ul>${concepto.detalle.map((linea) => `<li>${escapar(linea)}</li>`).join("")}</ul>
        </section>`,
    )
    .join("");

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Factura ${escapar(factura.id)} — La Verde</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; background: #f4f1e9; color: #14231a; font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  main { max-width: 760px; margin: 32px auto; background: #fff; border-radius: 24px; padding: 36px; }
  header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 1px solid #dce7df; padding-bottom: 24px; }
  .marca { font-size: 24px; font-weight: 800; letter-spacing: -0.03em; }
  .verde { color: #1d7a45; }
  .meta { text-align: right; color: #5f7266; font-size: 13px; }
  .id { font-family: ui-monospace, monospace; color: #14231a; }
  h1 { font-size: 26px; margin: 28px 0 4px; letter-spacing: -0.02em; }
  h2 { font-size: 16px; margin: 28px 0 10px; }
  h3 { font-size: 14px; margin: 16px 0 4px; }
  ul { margin: 0; padding-left: 20px; color: #45564b; }
  .total { display: flex; justify-content: space-between; align-items: baseline; border-top: 1px solid #dce7df; margin-top: 28px; padding-top: 18px; }
  .total strong { font-size: 28px; }
  .nota { background: #f4f1e9; border-radius: 14px; padding: 14px 16px; color: #45564b; margin-top: 20px; }
  footer { margin-top: 30px; font-size: 12px; color: #6b7c70; }
  @media print { body { background: #fff; } main { margin: 0; padding: 0; } }
</style>
</head>
<body>
<main>
  <header>
    <div>
      <div class="marca">La Verde <span class="verde">·</span> Factura</div>
      <div>Servicios para negocios en Cuba</div>
    </div>
    <div class="meta">
      <div class="id">${escapar(factura.id)}</div>
      <div>${escapar(FECHA.format(new Date(factura.creadoEn)))}</div>
      <div>${escapar(FACTURA_ESTADO[factura.estado].etiqueta)}</div>
    </div>
  </header>
  <h1>${escapar(factura.titulo)}</h1>
  <p>Cliente: <strong>${escapar(factura.negocioNombre)}</strong></p>
  <h2>Detalle</h2>
  ${conceptos}
  ${factura.nota ? `<div class="nota">${escapar(factura.nota)}</div>` : ""}
  <div class="total">
    <div>
      <div>Total</div>
      ${factura.precioOriginalUsd !== null ? `<div style="font-size:12px;color:#6b7c70">Antes: ${formatoUsd(factura.precioOriginalUsd)} USD</div>` : ""}
    </div>
    <strong>${formatoUsd(factura.precioUsd)} USD</strong>
  </div>
  <footer>
    Documento emitido por La Verde. Este comprobante refleja el estado de la
    factura al momento de descargarlo. Para cualquier duda, responde al enlace
    por el que recibiste esta factura.
  </footer>
</main>
</body>
</html>`;
}

function descargar(factura: FacturaResumen) {
  const blob = new Blob([htmlFactura(factura)], {
    type: "text/html;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `factura-${factura.id}.html`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * La cara pública de una factura.
 *
 * Se abre sin sesión desde el enlace que administración comparte. El botón
 * «Empezar» registra la aceptación; el pago y la activación los confirma
 * administración. Después de aceptar, el cliente puede descargar su copia.
 */
export function FacturaPublica({
  factura: inicial,
}: {
  factura: FacturaResumen;
}) {
  const [factura, setFactura] = useState(inicial);
  const [aceptando, setAceptando] = useState(false);

  const estado = FACTURA_ESTADO[factura.estado];
  const puedeDescargar =
    factura.estado === "aceptada" || factura.estado === "pagada";

  async function empezar() {
    if (aceptando || factura.estado !== "pendiente") return;
    setAceptando(true);
    try {
      const res = await fetch(`/api/facturas/${encodeURIComponent(factura.id)}/aceptar`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => null)) as {
        factura?: FacturaResumen;
        error?: string;
      } | null;
      if (!res.ok || !data?.factura) {
        toast.error(data?.error ?? "No se pudo confirmar la factura.");
        return;
      }
      setFactura(data.factura);
      toast.success("Propuesta aceptada. Ahora elige cómo pagar.");
    } catch {
      toast.error("No hubo respuesta del servidor.");
    } finally {
      setAceptando(false);
    }
  }

  function getAccionesEstado(): React.ReactNode {
    // Renderiza la barra inferior con acciones según el estado actual
    switch (factura.estado) {
      case "pendiente": {
        return (
          <>
            <p className="mt-gap-sm text-meta text-ink-soft/70" aria-live="polite">
              Al pulsar "Empezar" confirmas la compra de este plan. El acceso
              se activa cuando administración confirme el pago.
            </p>
            <button
              type="button"
              onClick={() => void empezar()}
              disabled={aceptando}
              aria-label={
                aceptando ? "Confirmando..." : "Empezar propuesta"
              }
              className="mt-gap-sm flex h-12 w-full items-center justify-center gap-gap-xs rounded-full bg-verde-400 font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition hover:bg-verde-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {aceptando ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Play size={17} />
              )}
              {aceptando ? "Confirmando…" : "Empezar"}
            </button>
          </>
        );
      }

      case "aceptada":
      case "en_revision": {
        return (
          <>
            <p className="mt-gap-sm text-meta text-ink-soft/70" aria-live="polite">
              La propuesta ha sido aceptada. Elige un método de pago para continuar.
            </p>
            <div className="mt-gap-sm flex flex-col gap-gap-sm">
              <button
                type="button"
                onClick={() => window.location.href = `/api/facturas/${factura.id}/metodo`}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-verde-400 px-gap-sm font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition hover:bg-verde-300"
                aria-label="Elegir método de pago"
              >
                <CheckCircle2 size={16} className="mr-2" /> Elegir método de pago
              </button>
              <button
                type="button"
                onClick={() => window.location.href = `/api/facturas/${factura.id}/pago`}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-ink/10 bg-white px-gap-sm font-lv-display text-small font-semibold text-ink transition hover:border-verde-300 hover:text-verde-700"
                aria-label="Avisar paso a revisión"
              >
                <Loader2 size={16} className="mr-2" /> Avisar paso a revisión
              </button>
            </div>
          </>
        );
      }

      case "pagada": {
        return (
          <>
            <p className="mt-gap-xs text-meta text-verde-700" aria-live="polite">
              Pagada el {factura.pagadaEn && FECHA.format(new Date(factura.pagadaEn))}.
            </p>
            <div className="mt-gap-sm flex flex-col gap-gap-sm">
              <button
                type="button"
                onClick={() => descargar(factura)}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-verde-400 px-gap-sm font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition hover:bg-verde-300"
                aria-label="Descargar copia de la factura"
              >
                <Download size={16} /> Descargar copia
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-ink/10 bg-white px-gap-sm font-lv-display text-small font-semibold text-ink transition:hover:border-verde-300 hover:text-verde-700"
                aria-label="Imprimir factura"
              >
                <Printer size={16} /> Imprimir
              </button>
            </div>
            <p className="mt-gap-xs text-meta text-verde-700">
              Pagada el {factura.pagadaEn && FECHA.format(new Date(factura.pagadaEn))}.
            </p>
          </>
        );
      }

      case "caducada": {
        return (
          <>
            <p className="mt-gap-sm text-meta text-ink-soft/70" aria-live="polite">
              Esta propuesta ha caducado. Solicita una nueva propuesta.
            </p>
            <button
              type="button"
              onClick={() => window.location.href = "/admin/facturas"}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-verde-400 px-gap-sm font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition hover:bg-verde-300"
              aria-label="Solicitar nueva propuesta"
            >
              <Play size={17} /> Solicitar nueva propuesta
            </button>
          </>
        );
      }

      case "cancelada": {
        return (
          <>
            <p className="mt-gap-sm text-meta text-ink-soft/70" aria-live="polite">
              Esta propuesta ha sido cancelada.
            </p>
          </>
        );
      }

      default:
        return null;
    }
  }

  return (
    <article
      className="mx-auto w-full max-w-2xl overflow-hidden rounded-[28px] border border-ink/5 bg-white shadow-card"
      aria-label={`Factura de servicios para ${factura.negocioNombre}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-gap-sm border-b border-ink/5 bg-verde-50/60 p-gap-lg">
        <div>
          <p className="font-lv-display text-meta font-semibold uppercase tracking-[0.14em] text-verde-700">
            La Verde
          </p>
          <h1 className="mt-gap-2xs font-lv-display text-h3 font-bold tracking-[-0.02em] text-ink">
            Factura de servicios
          </h1>
          <p className="mt-1 text-small text-ink-soft/75">
            {FECHA.format(new Date(factura.creadoEn))}
          </p>
        </div>
        <div className="text-right">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-[10px] py-[4px] font-lv-display text-[10px] font-extrabold uppercase tracking-[0.09em]",
              ESTADO_CLASE[factura.estado],
            )}
          >
            {estado.etiqueta}
          </span>
          <p className="mt-gap-xs break-all font-mono text-meta text-ink-soft/70">
            {factura.id}
          </p>
        </div>
      </header>

      <div className="p-gap-lg">
        <p className="text-small text-ink-soft/70">Preparada para</p>
        <p className="font-lv-display text-body font-bold text-ink">
          {factura.negocioNombre}
        </p>
        <h2 className="mt-gap-md font-lv-display text-h3 font-bold text-ink">
          {factura.titulo}
        </h2>

        <div className="mt-gap-md flex flex-col gap-gap-sm">
          {factura.conceptos.map((concepto, indice) => (
            <section
              key={`${concepto.nombre}-${indice}`}
              className="rounded-2xl border border-ink/5 bg-sand/35 p-gap-sm"
            >
              <h3 className="font-lv-display text-small font-semibold text-ink">
                {concepto.nombre}
              </h3>
              {concepto.detalle.length > 0 && (
                <ul className="mt-gap-xs flex flex-col gap-[6px] text-small text-ink-soft/80">
                  {concepto.detalle.map((linea) => (
                    <li key={linea} className="flex items-start gap-gap-xs">
                      <CheckCircle2
                        size={14}
                        className="mt-[3px] shrink-0 text-verde-600"
                      />
                      <span>{linea}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {factura.nota && (
          <p className="mt-gap-md rounded-2xl border border-lv-amber/30 bg-lv-amber/10 p-gap-sm text-small text-ink">
            {factura.nota}
          </p>
        )}

        <div className="mt-gap-lg flex items-end justify-between gap-gap-sm border-t border-ink/5 pt-gap-md">
          <div>
            <p className="text-meta text-ink-soft/60">Total</p>
            {factura.precioOriginalUsd !== null && (
              <p className="text-meta text-ink-soft/50 line-through">
                {formatoUsd(factura.precioOriginalUsd)} USD
              </p>
            )}
            {factura.oferta2x1 && (
              <p className="text-meta font-semibold text-verde-700">
                Primer pago 2×1
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="font-lv-display text-h2 font-bold tabular-nums text-ink">
              {formatoUsd(factura.precioUsd)} USD
            </p>
            {factura.tasaCup !== null && (
              <p className="text-meta text-ink-soft/65">
                ≈ {(factura.precioUsd * factura.tasaCup).toLocaleString("es-CU")} CUP
              </p>
            )}
          </div>
        </div>

        <div className="mt-gap-lg rounded-2xl bg-sand/50 p-gap-md">
          <p className="flex items-center gap-gap-xs font-lv-display text-small font-semibold text-ink">
            <Receipt size={16} className="text-verde-600" />
            {estado.etiqueta}
          </p>
          <p className="mt-gap-2xs text-small text-ink-soft/75">
            {estado.descripcion}
          </p>

          {getAccionesEstado()}

          {factura.estado === "pagada" && factura.pagadaEn && (
            <p className="mt-gap-xs text-meta text-verde-700">
              Pagada el {FECHA.format(new Date(factura.pagadaEn))}.
            </p>
          )}
        </div>

        <p className="mt-gap-md text-center text-meta text-ink-soft/55">
          La Verde · Servicios para negocios ·{" "}
          <Link href="/home" className="underline underline-offset-2">
            laverde
          </Link>
        </p>
      </div>
    </article>
  );
}