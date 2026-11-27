"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  Loader2,
  MessageCircle,
  Minus,
  Plus,
  Receipt,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { siteConfig } from "@/config/site";
import { SUPPORT_WHATSAPP } from "@/lib/legal";
import {
  FACTURA_ESTADO,
  METODO_PAGO,
  fechaCorta,
  formatoCup,
  formatoUsd,
  lineaTasa,
  mensajeTransferenciaCup,
  periodoDePago,
  periodoProyectado,
  usdACup,
  type FacturaMetodoPago,
  type FacturaResumen,
} from "@/lib/facturas";
import { cn } from "@/lib/utils";

const FECHA_HORA = new Intl.DateTimeFormat("es-CU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Havana",
});

const FECHA_DIA = new Intl.DateTimeFormat("es-CU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Havana",
});

const CHIP_TONO: Record<FacturaResumen["estado"], string> = {
  pendiente:
    "border-[#E3A23B]/50 bg-[#E3A23B]/15 text-[#F3C27A]",
  aceptada:
    "border-[#E3A23B]/50 bg-[#E3A23B]/15 text-[#F3C27A]",
  en_revision:
    "border-[#E3A23B]/50 bg-[#E3A23B]/15 text-[#F3C27A]",
  pagada:
    "border-[#35AF6D]/60 bg-[#173522] text-[#9BE3B4]",
  caducada:
    "border-[#EDF7F0]/20 bg-[#EDF7F0]/10 text-[#EDF7F0]/80",
  cancelada:
    "border-[#EDF7F0]/20 bg-[#EDF7F0]/10 text-[#EDF7F0]/80",
};

const TITULO_ESTADO: Record<FacturaResumen["estado"], string> = {
  pendiente: "Tu pack a medida",
  aceptada: "Pack aceptado: solo falta pagar",
  en_revision: "Estamos revisando tu pago",
  pagada: "Factura de servicios",
  caducada: "Tu pack a medida",
  cancelada: "Tu pack a medida",
};

const NIVEL_ESTADO: Record<FacturaResumen["estado"], number> = {
  pendiente: 0,
  caducada: 0,
  cancelada: 0,
  aceptada: 1,
  en_revision: 1,
  pagada: 3,
};

const PASOS = ["1 · Aceptas", "2 · Pagas", "3 · Activo"];

const BOTON =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[#EDF7F0]/20 px-5 font-lv-display text-[15px] font-semibold text-[#EDF7F0] transition-colors duration-300 hover:border-[#EDF7F0]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#35AF6D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1720] disabled:cursor-not-allowed disabled:opacity-45";

const BOTON_PRIMARIO =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[#35AF6D] bg-[#35AF6D] px-5 font-lv-display text-[15px] font-semibold text-[#052017] shadow-[0_12px_28px_-16px_rgba(53,175,109,.9)] transition-colors duration-300 hover:bg-[#3EC47D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#35AF6D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1720] disabled:cursor-not-allowed disabled:opacity-45";

function whatsapp(mensaje: string): string {
  return `https://wa.me/${SUPPORT_WHATSAPP.replace(/\D/g, "")}?text=${encodeURIComponent(mensaje)}`;
}

function fechaHora(iso: string): string {
  return FECHA_HORA.format(new Date(iso)).replace(/\./g, "");
}

function fechaDia(iso: string): string {
  return FECHA_DIA.format(new Date(iso)).replace(/\./g, "");
}

function fechaDiaDePeriodo(iso: string): string {
  const [anio, mes, dia] = iso.split("-").map(Number);
  if (!anio || !mes || !dia) return iso;
  return fechaDia(new Date(Date.UTC(anio, mes - 1, dia, 12)).toISOString());
}

function escapar(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export interface PagoFactura {
  metodos: FacturaMetodoPago[];
}

/**
 * La cara pública de una factura.
 *
 * Se abre sin sesión desde el enlace que administración comparte. El diseño es
 * el de la propuesta del pack a medida: oscuro, móvil primero y con la barra de
 * acciones pegada abajo. El botón «Acepto el pack» registra la aceptación;
 * después el negocio elige un método entre los que el servidor permite para su
 * provincia y avisa cuando paga. Administración confirma y solo entonces se
 * activa el servicio.
 */
export function FacturaPublica({
  factura: inicial,
  pago,
}: {
  factura: FacturaResumen;
  pago: PagoFactura;
}) {
  const [factura, setFactura] = useState(inicial);
  const [aceptando, setAceptando] = useState(false);
  const [guardandoMetodo, setGuardandoMetodo] = useState(false);
  const [pagandoQvapay, setPagandoQvapay] = useState(false);
  const [transferenciaAbierta, setTransferenciaAbierta] = useState(false);
  const [avisando, setAvisando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [abiertos, setAbiertos] = useState<Set<number>>(new Set());

  const estado = factura.estado;
  const tasa = factura.tasaCup;
  const cup = tasa !== null ? usdACup(factura.precioUsd, tasa) : null;
  const fechaTasa = new Date(
    factura.pagadaEn ?? factura.avisoPagoEn ?? factura.creadoEn,
  );
  const nivel = NIVEL_ESTADO[estado];
  const esPagada = estado === "pagada";
  const esPendiente = estado === "pendiente";
  const esAceptada = estado === "aceptada";
  const esRevision = estado === "en_revision";
  const esCaducada = estado === "caducada";
  const esCancelada = estado === "cancelada";
  const titulo = factura.tipo === "pack_medida" ? TITULO_ESTADO[estado] : factura.titulo;

  const periodo = esPagada && factura.pagadaEn
    ? periodoDePago(new Date(factura.pagadaEn), factura.oferta2x1)
    : periodoProyectado(new Date(), factura.oferta2x1);

  const totalServicios = factura.conceptos.length;

  const enlaceFactura = `${siteConfig.url.replace(/\/+$/, "")}/factura/${factura.id}`;
  const mensajeTransferencia = mensajeTransferenciaCup({
    id: factura.id,
    negocioNombre: factura.negocioNombre,
    precioUsd: factura.precioUsd,
    cup,
    enlace: enlaceFactura,
    fecha: fechaHora(factura.creadoEn),
  });

  async function empezar(): Promise<boolean> {
    if (aceptando || estado !== "pendiente") return false;
    setAceptando(true);
    try {
      const res = await fetch(
        `/api/facturas/${encodeURIComponent(factura.id)}/aceptar`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => null)) as {
        factura?: FacturaResumen;
        error?: string;
      } | null;
      if (!res.ok || !data?.factura) {
        toast.error(data?.error ?? "No se pudo confirmar la factura.");
        return false;
      }
      setFactura(data.factura);
      toast.success("Propuesta aceptada. Ahora elige cómo pagar.");
      return true;
    } catch {
      toast.error("No hubo respuesta del servidor.");
      return false;
    } finally {
      setAceptando(false);
    }
  }

  async function elegirMetodo(metodo: FacturaMetodoPago): Promise<boolean> {
    if (guardandoMetodo || factura.estado !== "aceptada") return false;
    if (factura.metodoPago === metodo) return true;
    setGuardandoMetodo(true);
    try {
      const res = await fetch(
        `/api/facturas/${encodeURIComponent(factura.id)}/metodo`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metodo }),
        },
      );
      const data = (await res.json().catch(() => null)) as {
        factura?: FacturaResumen;
        error?: string;
      } | null;
      if (!res.ok || !data?.factura) {
        toast.error(data?.error ?? "No se pudo guardar el método de pago.");
        return false;
      }
      setFactura(data.factura);
      return true;
    } catch {
      toast.error("No hubo respuesta del servidor.");
      return false;
    } finally {
      setGuardandoMetodo(false);
    }
  }

  /**
   * Abre el checkout real de QvaPay. La factura se activa sola cuando su
   * webhook confirma el cobro, sin que nadie tenga que revisarlo a mano.
   */
  async function pagarConQvapay() {
    if (pagandoQvapay || factura.estado !== "aceptada") return;
    setPagandoQvapay(true);
    try {
      const res = await fetch(
        `/api/facturas/${encodeURIComponent(factura.id)}/qvapay`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.url) {
        toast.error(data?.error ?? "No se pudo abrir QvaPay.");
        return;
      }
      window.location.href = data.url;
    } catch {
      toast.error("No hubo respuesta del servidor.");
    } finally {
      setPagandoQvapay(false);
    }
  }

  /**
   * La transferencia no tiene pasarela: se acuerda por WhatsApp. Se guarda el
   * método y se abre la confirmación con el detalle de la factura delante para
   * que soporte compruebe que es real antes de dictar la tarjeta.
   */
  async function abrirTransferencia() {
    if (guardandoMetodo) return;
    if (factura.metodoPago !== "transferencia") {
      const guardado = await elegirMetodo("transferencia");
      if (!guardado) return;
    }
    setTransferenciaAbierta(true);
  }

  async function avisarPago() {
    if (avisando || factura.estado !== "aceptada") return;
    if (!factura.metodoPago) {
      toast.error("Elige primero cómo vas a pagar.");
      return;
    }
    setAvisando(true);
    try {
      const res = await fetch(
        `/api/facturas/${encodeURIComponent(factura.id)}/pago`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => null)) as {
        factura?: FacturaResumen;
        error?: string;
      } | null;
      if (!res.ok || !data?.factura) {
        toast.error(data?.error ?? "No se pudo registrar el aviso de pago.");
        return;
      }
      setFactura(data.factura);
      toast.success("Aviso enviado. Administración revisará el pago.");
    } catch {
      toast.error("No hubo respuesta del servidor.");
    } finally {
      setAvisando(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(factura.id);
      toast.success("Referencia copiada.");
    } catch {
      toast.error("No se pudo copiar la referencia.");
    }
  }

  function alternarConcepto(indice: number) {
    setAbiertos((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(indice)) siguiente.delete(indice);
      else siguiente.add(indice);
      return siguiente;
    });
  }

  function instrucciones(metodo: FacturaMetodoPago): string {
    if (metodo === "qvapay") {
      return `Paga ${formatoUsd(factura.precioUsd)} USD con QvaPay desde el botón de abajo. La factura se activa sola cuando QvaPay confirma el cobro; guarda el comprobante. Pon la referencia ${factura.id} para que lo encontremos rápido.`;
    }
    if (metodo === "transferencia") {
      return `Confirma por WhatsApp que esta factura es real y te damos los datos de la tarjeta. Al transferir, avísanos con el comprobante y lo confirmamos en menos de 24 h. Ten a mano la referencia ${factura.id}.`;
    }
    if (metodo === "efectivo") {
      return `Te escribimos por WhatsApp para coordinar el pago en efectivo en Santiago de Cuba. Ten a mano la referencia ${factura.id}.`;
    }
    return "Los datos de este método no están configurados. Escríbenos para coordinar el pago.";
  }

  function filasDePrecio(): { k: string; v: string; tono?: string }[] {
    const filas: { k: string; v: string; tono?: string }[] = [];

    if (esPagada) {
      filas.push({
        k: "Periodo",
        v: `${fechaDiaDePeriodo(periodo.inicio)} – ${fechaDiaDePeriodo(periodo.fin)}`,
      });
      filas.push({
        k: "Incluye",
        v: factura.oferta2x1 ? "2 meses (2×1 del primer pago)" : "1 mes",
        tono: factura.oferta2x1 ? "text-[#9BE3B4]" : undefined,
      });
      filas.push({
        k: "Próximo cobro",
        v: `${fechaDiaDePeriodo(periodo.proximoCobro)} · ${formatoUsd(factura.precioUsd)} USD`,
      });
      if (factura.metodoPago) {
        filas.push({ k: "Método", v: METODO_PAGO[factura.metodoPago].etiqueta });
      }
    } else {
      filas.push({
        k: "Te llevas",
        v: factura.oferta2x1
          ? "2 meses gracias al 2×1"
          : "1 mes de servicio",
        tono: factura.oferta2x1 ? "text-[#9BE3B4]" : undefined,
      });
      filas.push({
        k: "Después",
        v: `${formatoUsd(factura.precioUsd)} USD/mes desde ${fechaDiaDePeriodo(periodo.proximoCobro)}`,
      });
      if (factura.precioSeparadoUsd !== null) {
        filas.push({
          k: "Por separado costaría",
          v: `${formatoUsd(factura.precioSeparadoUsd)} USD/mes`,
        });
      }
      if (factura.descuentoPct !== null && factura.descuentoPct > 0) {
        filas.push({ k: "Descuento", v: `${factura.descuentoPct} %` });
      }
      filas.push({ k: "Permanencia", v: "Ninguna" });
    }

    return filas;
  }

  const filas = filasDePrecio();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-[#08130D] font-lv text-[#EDF7F0] sm:my-gap-lg sm:rounded-[28px] sm:border sm:border-[#EDF7F0]/10">
      <header className="flex flex-col gap-2 border-b border-[#EDF7F0]/10 bg-[#0F2418] px-5 pb-[18px] pt-[22px]">
        <div className="flex items-center justify-between gap-3">
          <span className="font-lv-display text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9BE3B4]">
            La Verde
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-1 font-lv-display text-[12px] font-semibold",
              CHIP_TONO[estado],
            )}
          >
            {FACTURA_ESTADO[estado].etiqueta}
          </span>
        </div>
        <h1 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.02em]">
          {titulo}
        </h1>
        <p className="text-[14px] text-[#EDF7F0]/80">
          Para{" "}
          <strong className="font-semibold text-[#EDF7F0]">
            {factura.negocioNombre}
          </strong>{" "}
          · {fechaHora(factura.creadoEn)}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#EDF7F0]/70">
          <span>Ref. {factura.id}</span>
          <button
            type="button"
            onClick={() => void copiar()}
            className="inline-flex h-[30px] items-center gap-1 rounded-full border border-[#EDF7F0]/20 px-2.5 font-lv-display text-[12px] font-semibold text-[#EDF7F0] transition hover:border-[#EDF7F0]/40"
          >
            <Copy size={12} /> Copiar
          </button>
          {esPendiente && factura.expiraEn && (
            <span className="text-[#F3C27A]">
              · válida hasta el {fechaCorta(new Date(factura.expiraEn))}
            </span>
          )}
          {esPagada && factura.numeroFactura !== null && (
            <span>· Factura n.º {String(factura.numeroFactura).padStart(4, "0")}</span>
          )}
          {esCancelada && <span>· cancelada</span>}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3.5 px-4 pb-8 pt-4">
        <ol className="grid grid-cols-3 gap-1.5" aria-label="Estado del pack">
          {PASOS.map((etiqueta, indice) => {
            const hecho = indice < nivel;
            const ahora = indice === nivel && !esCaducada && !esCancelada;
            return (
              <li key={etiqueta} className="flex flex-col gap-1.5">
                <span
                  className="h-1 rounded-full"
                  style={{
                    background: hecho
                      ? "#35AF6D"
                      : ahora
                        ? "#E3A23B"
                        : "rgba(237,247,240,.14)",
                  }}
                />
                <span
                  className="font-lv-display text-[12px] font-semibold"
                  style={{
                    color: hecho
                      ? "#9BE3B4"
                      : ahora
                        ? "#F3C27A"
                        : "rgba(237,247,240,.6)",
                  }}
                >
                  {etiqueta}
                </span>
              </li>
            );
          })}
        </ol>

        {esCaducada && (
          <div className="flex flex-col gap-1 rounded-2xl border border-[#E3A23B]/50 bg-[#E3A23B]/15 p-3.5">
            <p className="font-lv-display text-[15px] font-semibold text-[#F3C27A]">
              Esta propuesta caducó
              {factura.expiraEn ? ` el ${fechaDia(factura.expiraEn)}` : ""}.
            </p>
            <p className="text-[14px] leading-relaxed text-[#F5DDB5]">
              Los precios o la tasa pueden haber cambiado. Pide una nueva y te la
              preparamos al momento.
            </p>
          </div>
        )}

        {esRevision && (
          <div className="flex flex-col gap-1.5 rounded-2xl border border-[#E3A23B]/50 bg-[#0E1720] p-4">
            <p className="font-lv-display text-[16px] font-semibold">
              Recibimos tu aviso de pago
            </p>
            <p className="text-[14px] leading-relaxed text-[#EDF7F0]/80">
              Lo confirmamos en menos de 24 h. No tienes que hacer nada más.
            </p>
          </div>
        )}

        {esPagada && (
          <div className="flex flex-col gap-1.5 rounded-2xl border border-[#35AF6D]/50 bg-[#0E1720] p-4">
            <p className="font-lv-display text-[16px] font-semibold text-[#9BE3B4]">
              Tu pack está activo
            </p>
            <p className="text-[14px] leading-relaxed text-[#EDF7F0]/80">
              Ya puedes usar los servicios desde tu panel. Esta es tu factura.
            </p>
          </div>
        )}

        {(esPendiente || esCaducada) && factura.nota && (
          <div className="flex flex-col gap-2.5 rounded-2xl border border-[#EDF7F0]/10 bg-[#0E1720] p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#35AF6D] font-lv-display text-[15px] font-bold text-[#052017]">
                {(factura.notaAutor?.trim().charAt(0) || "LV").toUpperCase()}
              </span>
              <span className="flex min-w-0 flex-col">
                <strong className="font-lv-display text-[15px] font-semibold">
                  {factura.notaAutor?.trim() || "La Verde"}
                </strong>
                <span className="text-[12px] text-[#EDF7F0]/70">
                  La Verde · te armó este pack
                </span>
              </span>
            </div>
            <p className="whitespace-pre-line text-[15px] leading-relaxed">
              {factura.nota}
            </p>
            <a
              href={whatsapp(
                `Hola, sobre la propuesta ${factura.id} de ${factura.negocioNombre} quiero cambiar algo.`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center font-lv-display text-[14px] font-semibold text-[#9BE3B4] underline-offset-4 hover:underline"
            >
              Escribir por WhatsApp
            </a>
          </div>
        )}

        <section className="flex flex-col gap-1 rounded-2xl border border-[#EDF7F0]/10 bg-[#0E1720] p-4">
          <span className="font-lv-display text-[11px] font-semibold uppercase tracking-[0.1em] text-[#EDF7F0]/70">
            {esPagada && factura.pagadaEn
              ? `Pagado el ${fechaDia(factura.pagadaEn)}`
              : "Pagas hoy"}
          </span>
          <div className="flex flex-wrap items-baseline gap-2">
            <strong className="font-lv-display text-[38px] font-bold leading-[1.1] tracking-[-0.03em]">
              {formatoUsd(factura.precioUsd)} USD
            </strong>
            {cup !== null && (
              <span className="text-[15px] text-[#EDF7F0]/80">
                ≈ {formatoCup(cup)} CUP
              </span>
            )}
          </div>
          {tasa !== null && (
            <span className="mb-1.5 text-[12px] text-[#EDF7F0]/70">
              {lineaTasa(tasa, fechaTasa, esPagada)}
            </span>
          )}
          {filas.map((fila) => (
            <div
              key={fila.k}
              className="flex justify-between gap-3 border-t border-[#EDF7F0]/10 py-2.5 text-[14px]"
            >
              <span className="text-[#EDF7F0]/80">{fila.k}</span>
              <span
                className={cn(
                  "text-right font-semibold text-[#EDF7F0]",
                  fila.tono,
                )}
              >
                {fila.v}
              </span>
            </div>
          ))}
          {factura.precioOriginalUsd !== null && (
            <div className="flex justify-between gap-3 border-t border-[#EDF7F0]/10 py-2.5 text-[14px]">
              <span className="text-[#EDF7F0]/80">Antes</span>
              <span className="text-right text-[#EDF7F0]/60 line-through">
                {formatoUsd(factura.precioOriginalUsd)} USD
              </span>
            </div>
          )}
        </section>

        {esAceptada && (
          <section className="flex flex-col gap-2.5 rounded-2xl border border-[#EDF7F0]/10 bg-[#0E1720] p-4">
            <h2 className="text-[18px] font-semibold">¿Cómo quieres pagar?</h2>
            {pago.metodos.length === 0 ? (
              <p className="text-[14px] leading-relaxed text-[#EDF7F0]/80">
                No hay métodos de pago configurados ahora mismo. Escríbenos para
                coordinar el pago.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {pago.metodos.map((metodo) => {
                  const info = METODO_PAGO[metodo];
                  const elegido = factura.metodoPago === metodo;
                  const ocupado =
                    metodo === "qvapay" ? pagandoQvapay : guardandoMetodo;
                  return (
                    <button
                      key={metodo}
                      type="button"
                      onClick={() => {
                        if (metodo === "qvapay") {
                          void pagarConQvapay();
                        } else if (metodo === "transferencia") {
                          void abrirTransferencia();
                        } else {
                          void elegirMetodo(metodo);
                        }
                      }}
                      disabled={guardandoMetodo || pagandoQvapay}
                      aria-pressed={elegido}
                      className={cn(
                        "flex min-h-14 items-center gap-3 rounded-[14px] border-[1.5px] px-3.5 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
                        elegido
                          ? "border-[#35AF6D] bg-[#35AF6D]/10"
                          : "border-[#EDF7F0]/15 bg-transparent hover:border-[#EDF7F0]/30",
                      )}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#173522] text-[#9BE3B4]">
                        {metodo === "qvapay" ? (
                          <Wallet size={18} strokeWidth={1.8} />
                        ) : metodo === "transferencia" ? (
                          <MessageCircle size={18} strokeWidth={1.8} />
                        ) : (
                          <Receipt size={18} strokeWidth={1.8} />
                        )}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <strong className="font-lv-display text-[15px] font-semibold">
                          {info.etiqueta}
                        </strong>
                        <span className="text-[13px] text-[#EDF7F0]/80">
                          {info.descripcion}
                        </span>
                      </span>
                      {ocupado ? (
                        <Loader2
                          size={15}
                          className="shrink-0 animate-spin text-[#9BE3B4]"
                        />
                      ) : (
                        <ArrowRight
                          size={15}
                          className="shrink-0 text-[#EDF7F0]/50"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {factura.metodoPago && (
              <div className="flex flex-col gap-2 rounded-[14px] bg-[#16212B] px-3.5 py-3 text-[14px] leading-relaxed">
                <strong className="font-lv-display text-[14px] font-semibold">
                  {METODO_PAGO[factura.metodoPago].etiqueta}
                </strong>
                <span>{instrucciones(factura.metodoPago)}</span>
                {factura.metodoPago === "qvapay" && (
                  <button
                    type="button"
                    onClick={() => void pagarConQvapay()}
                    disabled={pagandoQvapay}
                    className={cn(BOTON_PRIMARIO, "mt-1 min-h-11")}
                  >
                    {pagandoQvapay ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Wallet size={16} />
                    )}
                    {pagandoQvapay ? "Abriendo QvaPay…" : "Pagar con QvaPay"}
                  </button>
                )}
                {factura.metodoPago === "transferencia" && (
                  <a
                    href={whatsapp(mensajeTransferencia)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(BOTON_PRIMARIO, "mt-1 min-h-11")}
                  >
                    <MessageCircle size={16} />
                    Confirmar por WhatsApp
                  </a>
                )}
              </div>
            )}
          </section>
        )}

        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[18px] font-semibold">
              {esPagada ? "Tienes activo" : "Qué incluye tu pack"}
            </h2>
            <span className="text-[13px] text-[#EDF7F0]/80">
              {totalServicios} {totalServicios === 1 ? "servicio" : "servicios"}
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#EDF7F0]/10 bg-[#0E1720]">
            {factura.conceptos.map((concepto, indice) => {
              const abierto = abiertos.has(indice);
              return (
                <div
                  key={`${concepto.nombre}-${indice}`}
                  className={cn(indice > 0 && "border-t border-[#EDF7F0]/10")}
                >
                  <button
                    type="button"
                    onClick={() => alternarConcepto(indice)}
                    aria-expanded={abierto}
                    className="flex w-full items-center gap-3 px-3.5 py-3.5 text-left transition hover:bg-[#EDF7F0]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#35AF6D]"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#173522] text-[#9BE3B4]">
                      <Check size={18} strokeWidth={2} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <strong className="font-lv-display text-[15px] font-semibold">
                        {concepto.nombre}
                      </strong>
                      {concepto.beneficio && (
                        <span className="text-[13px] leading-snug text-[#EDF7F0]/80">
                          {concepto.beneficio}
                        </span>
                      )}
                    </span>
                    <span className="w-5 shrink-0 text-center text-[#EDF7F0]/70">
                      {abierto ? <Minus size={16} /> : <Plus size={16} />}
                    </span>
                  </button>

                  {abierto && (
                    <div className="flex flex-col gap-1.5 px-3.5 pb-3.5 pl-[62px] text-[14px]">
                      {concepto.detalle.map((linea) => (
                        <div key={linea} className="flex gap-2">
                          <span className="text-[#9BE3B4]">·</span>
                          <span>{linea}</span>
                        </div>
                      ))}
                      {concepto.nota && (
                        <div className="mt-0.5 text-[12px] text-[#EDF7F0]/70">
                          {concepto.nota}
                        </div>
                      )}
                      {concepto.proximamente && concepto.proximamente.length > 0 && (
                        <div className="mt-1 rounded-lg border border-dashed border-[#EDF7F0]/20 px-2.5 py-2 text-[12px] text-[#EDF7F0]/70">
                          Próximamente, sin coste extra:{" "}
                          {concepto.proximamente.join(" · ")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {esPendiente && (
          <section className="flex flex-col gap-2.5 rounded-2xl border border-[#EDF7F0]/10 bg-[#0E1720] p-4">
            <h2 className="text-[18px] font-semibold">Cómo empezar</h2>
            {[
              ["1", "Aceptas el pack.", "Con un toque, aquí abajo."],
              [
                "2",
                "Pagas como prefieras.",
                "QvaPay, transferencia en CUP o efectivo en Santiago.",
              ],
              [
                "3",
                "Lo activamos en menos de 24 h.",
                "Te avisamos y lo ves en tu panel.",
              ],
            ].map(([numero, tituloPaso, detalle]) => (
              <div key={numero} className="flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#173522] font-lv-display text-[13px] font-bold text-[#9BE3B4]">
                  {numero}
                </span>
                <p className="pt-1 text-[14px] leading-snug">
                  <strong className="font-semibold">{tituloPaso}</strong>{" "}
                  <span className="text-[#EDF7F0]/80">{detalle}</span>
                </p>
              </div>
            ))}
            <a
              href={whatsapp(
                `Hola, tengo una duda sobre la propuesta ${factura.id} de ${factura.negocioNombre}.`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center font-lv-display text-[14px] font-semibold text-[#9BE3B4] underline-offset-4 hover:underline"
            >
              ¿Tienes una duda? Pregúntanos
            </a>
          </section>
        )}

        <p className="px-2 pt-1 text-center text-[12px] leading-relaxed text-[#EDF7F0]/70">
          Sin permanencia: cancelas cuando quieras.
          {factura.oferta2x1 ? " El 2×1 aplica solo al primer pago." : ""} El
          importe en CUP sigue la tasa del día en que pagas.
          <br />
          La Verde · Servicios para negocios
        </p>
      </div>

      <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-[#EDF7F0]/10 bg-[#0E1720] px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
        {esPendiente && (
          <div className="grid grid-cols-[1fr_1.3fr] gap-2">
            <a
              href={whatsapp(
                `Hola, sobre la propuesta ${factura.id} de ${factura.negocioNombre} quiero cambiar algo.`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className={BOTON}
            >
              Quiero cambiar algo
            </a>
            <button
              type="button"
              onClick={() => setConfirmar(true)}
              disabled={aceptando}
              className={BOTON_PRIMARIO}
            >
              {aceptando ? (
                <Loader2 size={17} className="animate-spin" />
              ) : null}
              {aceptando ? "Confirmando…" : "Acepto el pack"}
            </button>
          </div>
        )}

        {esAceptada && (
          <button
            type="button"
            onClick={() => void avisarPago()}
            aria-disabled={!factura.metodoPago || avisando}
            className={cn(
              factura.metodoPago ? BOTON_PRIMARIO : BOTON,
              !factura.metodoPago && "opacity-45",
            )}
          >
            {avisando ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <Receipt size={17} />
            )}
            {avisando
              ? "Enviando…"
              : factura.metodoPago
                ? factura.metodoPago === "transferencia"
                  ? "Ya transferí"
                  : "Ya pagué"
                : "Elige cómo pagar"}
          </button>
        )}

        {esRevision && (
          <a
            href={whatsapp(
              `Hola, sobre la propuesta ${factura.id} de ${factura.negocioNombre}: ya avisé el pago.`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className={BOTON}
          >
            Escribir por WhatsApp
          </a>
        )}

        {esPagada && (
          <div className="grid grid-cols-[1fr_1.2fr] gap-2">
            <button
              type="button"
              onClick={() => descargar(factura)}
              className={BOTON}
            >
              <Download size={16} /> Descargar copia
            </button>
            <Link href="/business" className={BOTON_PRIMARIO}>
              Ir a mi panel <ArrowRight size={16} />
            </Link>
          </div>
        )}

        {esCaducada && (
          <a
            href={whatsapp(
              `Hola, la propuesta ${factura.id} de ${factura.negocioNombre} caducó. ¿Me preparan una nueva?`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className={BOTON_PRIMARIO}
          >
            Pedir una propuesta nueva
          </a>
        )}

        {esCancelada && (
          <a
            href={whatsapp(
              `Hola, quiero retomar la propuesta ${factura.id} de ${factura.negocioNombre}.`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className={BOTON}
          >
            Escribir por WhatsApp
          </a>
        )}
      </div>

      <Dialog open={confirmar} onOpenChange={setConfirmar}>
        <DialogContent className="bottom-0 left-1/2 top-auto w-full max-w-[430px] translate-x-[-50%] translate-y-0 gap-3 rounded-b-none rounded-t-3xl border-[#EDF7F0]/10 bg-[#0E1720] p-4 pb-[max(24px,env(safe-area-inset-bottom))] text-[#EDF7F0] ">
          <div className="mx-auto h-[5px] w-11 rounded-full bg-[#EDF7F0]/25" />
          <DialogTitle className="text-[20px] font-semibold text-[#EDF7F0]">
            ¿Aceptas tu pack a medida?
          </DialogTitle>
          <DialogDescription className="flex flex-col gap-2 text-[15px] leading-relaxed text-[#EDF7F0]/80">
            <span>
              Pagas hoy{" "}
              <strong className="font-semibold text-[#EDF7F0]">
                {formatoUsd(factura.precioUsd)} USD
                {cup !== null ? ` (≈ ${formatoCup(cup)} CUP)` : ""}
              </strong>{" "}
              y eliges cómo pagar en el siguiente paso.
            </span>
            <span>
              {factura.oferta2x1
                ? "El 2×1 aplica solo al primer pago. "
                : ""}
              Sin permanencia: cancelas cuando quieras.
            </span>
          </DialogDescription>
          <button
            type="button"
            onClick={async () => {
              const ok = await empezar();
              if (ok) setConfirmar(false);
            }}
            disabled={aceptando}
            className={BOTON_PRIMARIO}
          >
            {aceptando ? (
              <Loader2 size={17} className="animate-spin" />
            ) : null}
            {aceptando ? "Confirmando…" : "Sí, acepto"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmar(false)}
            className={BOTON}
          >
            Ahora no
          </button>
        </DialogContent>
      </Dialog>

      {/* La transferencia en CUP no tiene pasarela: se cierra en el chat. El
          detalle va delante para que soporte compruebe que la factura es real
          antes de dictar la tarjeta. */}
      <Dialog
        open={transferenciaAbierta}
        onOpenChange={setTransferenciaAbierta}
      >
        <DialogContent className="bottom-0 left-1/2 top-auto max-h-[calc(100dvh-32px)] w-full max-w-[430px] translate-x-[-50%] translate-y-0 gap-3 overflow-y-auto rounded-b-none rounded-t-3xl border-[#EDF7F0]/10 bg-[#0E1720] p-4 pb-[max(24px,env(safe-area-inset-bottom))] text-[#EDF7F0]">
          <div className="mx-auto h-[5px] w-11 rounded-full bg-[#EDF7F0]/25" />
          <DialogTitle className="text-[20px] font-semibold text-[#EDF7F0]">
            Pagar por transferencia en CUP
          </DialogTitle>
          <DialogDescription className="flex flex-col gap-2 text-[15px] leading-relaxed text-[#EDF7F0]/80">
            <span>
              Te llevamos al WhatsApp de La Verde con este mensaje ya escrito.
              Allí confirmamos que la factura es real y te damos los datos de
              la tarjeta para transferir.
            </span>
          </DialogDescription>

          <div className="flex flex-col gap-1 rounded-[14px] border border-[#EDF7F0]/10 bg-[#16212B] px-3.5 py-3 text-[14px]">
            <div className="flex justify-between gap-3">
              <span className="text-[#EDF7F0]/70">Referencia</span>
              <span className="text-right font-semibold">{factura.id}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[#EDF7F0]/70">Negocio</span>
              <span className="text-right font-semibold">
                {factura.negocioNombre}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[#EDF7F0]/70">Importe</span>
              <span className="text-right font-semibold">
                {formatoUsd(factura.precioUsd)} USD
                {cup !== null ? ` · ≈ ${formatoCup(cup)} CUP` : ""}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[#EDF7F0]/70">Enlace</span>
              <span className="truncate text-right text-[#9BE3B4]">
                {enlaceFactura}
              </span>
            </div>
          </div>

          <a
            href={whatsapp(mensajeTransferencia)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setTransferenciaAbierta(false)}
            className={BOTON_PRIMARIO}
          >
            <MessageCircle size={17} />
            Abrir WhatsApp
          </a>
          <button
            type="button"
            onClick={() => setTransferenciaAbierta(false)}
            className={BOTON}
          >
            Ahora no
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Copia descargable ──────────────────────────────────────────────────────
   El enlace público es la pantalla; esto es el comprobante que queda. Se
   escribe a mano y sin imágenes para que se abra en cualquier equipo y se
   imprima igual. */

function htmlFactura(factura: FacturaResumen): string {
  const tasa = factura.tasaCup;
  const cup = tasa !== null ? usdACup(factura.precioUsd, tasa) : null;
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
  :root { color-scheme: dark; }
  body { margin: 0; background: #08130D; color: #EDF7F0; font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  main { max-width: 760px; margin: 32px auto; background: #0E1720; border: 1px solid rgba(237,247,240,.12); border-radius: 24px; padding: 36px; }
  header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 1px solid rgba(237,247,240,.1); padding-bottom: 24px; }
  .marca { font-size: 24px; font-weight: 800; letter-spacing: -0.03em; }
  .verde { color: #9BE3B4; }
  .meta { text-align: right; color: rgba(237,247,240,.78); font-size: 13px; }
  .id { font-family: ui-monospace, monospace; color: #EDF7F0; }
  h1 { font-size: 26px; margin: 28px 0 4px; letter-spacing: -0.02em; }
  h2 { font-size: 16px; margin: 28px 0 10px; }
  h3 { font-size: 14px; margin: 16px 0 4px; }
  ul { margin: 0; padding-left: 20px; color: rgba(237,247,240,.78); }
  .total { display: flex; justify-content: space-between; align-items: baseline; border-top: 1px solid rgba(237,247,240,.1); margin-top: 28px; padding-top: 18px; }
  .total strong { font-size: 28px; }
  .nota { background: #16212B; border-radius: 14px; padding: 14px 16px; color: rgba(237,247,240,.78); margin-top: 20px; }
  footer { margin-top: 30px; font-size: 12px; color: rgba(237,247,240,.6); }
  @media print { body { background: #fff; color: #14231a; } main { border: 0; background: #fff; } .meta, ul, footer { color: #45564b; } .nota { background: #f4f1e9; } }
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
      <div>${escapar(FECHA_HORA.format(new Date(factura.creadoEn)))}</div>
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
      ${factura.precioOriginalUsd !== null ? `<div style="font-size:12px;color:rgba(237,247,240,.6)">Antes: ${formatoUsd(factura.precioOriginalUsd)} USD</div>` : ""}
    </div>
    <div style="text-align:right">
      <strong>${formatoUsd(factura.precioUsd)} USD</strong>
      ${cup !== null ? `<div style="font-size:13px;color:rgba(237,247,240,.78)">≈ ${formatoCup(cup)} CUP</div>` : ""}
    </div>
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
