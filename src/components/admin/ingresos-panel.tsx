"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Receipt,
  RefreshCw,
  Users,
  Wallet,
} from "lucide-react";
import { BarraProgreso } from "@/components/admin/ui/progreso";
import { BotonAdmin } from "@/components/admin/ui/botones";
import { ChapitaEstado } from "@/components/admin/ui/chapita";
import {
  EstadoVacioAdmin,
  TarjetaAdmin,
  TarjetaKpi,
} from "@/components/admin/ui/tarjeta";
import {
  BOTON_ADMIN_BASE,
  BOTON_ADMIN_VARIANTE,
  TAMANO_BOTON_ADMIN,
} from "@/components/admin/ui/clases";
import type {
  CobroPendiente,
  DatosIngresosAdmin,
  GrupoCobro,
} from "@/lib/admin-ingresos";

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const GRUPOS: Record<
  GrupoCobro,
  { titulo: string; descripcion: string; tono: "error" | "aviso" | "info" }
> = {
  vencido: {
    titulo: "Vencidos",
    descripcion: "Planes que pasaron su fecha de pago.",
    tono: "error",
  },
  por_confirmar: {
    titulo: "Por confirmar",
    descripcion: "Pagos registrados que todavía no se aplicaron.",
    tono: "aviso",
  },
  prueba: {
    titulo: "Pruebas por vencer",
    descripcion: "Negocios que salen de Pro en los próximos siete días.",
    tono: "info",
  },
};

const BOTON_ENLACE = clsx(
  BOTON_ADMIN_BASE,
  BOTON_ADMIN_VARIANTE.secundario,
  TAMANO_BOTON_ADMIN.pequeno,
);

function formatoUsd(centavos: number): string {
  const valor = centavos / 100;
  const numero = Math.abs(valor).toLocaleString("es-CU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${valor < 0 ? "−" : ""}$${numero}`;
}

function formatoCup(cup: number): string {
  const valor = Math.round(cup);
  return `${valor < 0 ? "−" : ""}${Math.abs(valor).toLocaleString("es-CU")} CUP`;
}

function mesLegible(mes: string): string {
  const [anio, numero] = mes.split("-").map(Number);
  const nombre = MESES[(numero ?? 1) - 1] ?? "";
  return `${nombre} ${anio ?? ""}`.trim();
}

function fechaTasa(iso: string | null): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  return new Intl.DateTimeFormat("es-CU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Havana",
  }).format(fecha);
}

function AccionCobro({
  cobro,
  confirmando,
  onConfirmar,
}: {
  cobro: CobroPendiente;
  confirmando: string | null;
  onConfirmar: (pagoId: string) => void;
}) {
  if (cobro.accion.tipo === "confirmar") {
    const pagoId = cobro.accion.pagoId;
    return (
      <BotonAdmin
        variante="primario"
        tamano="pequeno"
        onClick={() => onConfirmar(pagoId)}
        disabled={confirmando === pagoId}
        aria-label={`Confirmar el pago de ${cobro.negocio}`}
      >
        {confirmando === pagoId ? (
          <Loader2 size={14} strokeWidth={2} className="animate-spin" />
        ) : (
          <CheckCircle2 size={14} strokeWidth={2} />
        )}
        {confirmando === pagoId ? "Confirmando…" : "Confirmar"}
      </BotonAdmin>
    );
  }

  if (cobro.accion.tipo === "whatsapp") {
    return (
      <a
        href={cobro.accion.href}
        target="_blank"
        rel="noopener noreferrer"
        className={BOTON_ENLACE}
      >
        <MessageCircle size={14} strokeWidth={1.8} />
        Recordar
      </a>
    );
  }

  return (
    <Link href={cobro.accion.href} className={BOTON_ENLACE}>
      Ofrecer plan
      <ArrowUpRight size={14} strokeWidth={1.8} />
    </Link>
  );
}

export function IngresosPanel({ datos }: { datos: DatosIngresosAdmin }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const actualizada = fechaTasa(datos.tasaActualizadaEn);
  const fuente = datos.tasaFuente === "cambiocup" ? "Cambiocup" : "manual";

  async function confirmar(pagoId: string) {
    setConfirmando(pagoId);
    try {
      const res = await fetch(
        `/api/admin/pagos/${encodeURIComponent(pagoId)}/confirmar`,
        { method: "POST" },
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        yaEstaba?: boolean;
      };
      if (!res.ok) {
        toast.error(body.error ?? "No se pudo confirmar el pago.");
        return;
      }
      toast.success(
        body.yaEstaba ? "Ese pago ya estaba confirmado." : "Pago confirmado.",
      );
      router.refresh();
    } catch {
      toast.error("No hubo respuesta del servidor. No se cambió nada.");
    } finally {
      setConfirmando(null);
    }
  }

  return (
    <div className="flex flex-col gap-gap-lg">
      <header className="flex flex-wrap items-end justify-between gap-gap-sm">
        <div>
          <span className="font-lv-display text-meta font-semibold uppercase tracking-[0.12em] text-ink-soft/60">
            Dinero
          </span>
          <h1 className="font-lv-display text-h2 font-bold text-ink">
            Ingresos y pagos
          </h1>
          <p className="mt-1 text-small capitalize text-ink-soft/75">
            {mesLegible(datos.mes)}
          </p>
        </div>
        <div className="text-right text-meta text-ink-soft/70">
          <p>
            Tasa {datos.tasaCup.toLocaleString("es-CU")} CUP/USD · {fuente}
            {actualizada ? ` · ${actualizada}` : ""}
          </p>
          <Link
            href="/admin/planes"
            className="font-semibold text-verde-700 underline underline-offset-2"
          >
            Ver planes y precios
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-gap-sm sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaKpi
          etiqueta="Facturado este mes"
          valor={formatoUsd(datos.facturadoCentavos)}
          detalle={
            datos.reembolsosCentavos > 0
              ? `${formatoCup(datos.facturadoCup)} · bruto ${formatoUsd(datos.facturadoBrutoCentavos)} − reembolsos ${formatoUsd(datos.reembolsosCentavos)}`
              : `${formatoCup(datos.facturadoCup)} · pagos confirmados`
          }
          icono={Receipt}
        />
        <TarjetaKpi
          etiqueta="Recurrente esperado"
          valor={formatoUsd(datos.recurrenteCentavos)}
          detalle={`${formatoCup(datos.recurrenteCup)} · ${datos.negociosPagando} negocios`}
          icono={RefreshCw}
        />
        <TarjetaKpi
          etiqueta="Neto tras comisiones"
          valor={formatoUsd(datos.netoCentavos)}
          detalle={`${formatoCup(datos.netoCup)} · comisiones ${formatoUsd(datos.comisionesCentavos)}`}
          icono={Wallet}
          className={clsx(datos.netoCentavos < 0 && "border-destructive/20 bg-destructive/5")}
        />
        <TarjetaKpi
          etiqueta="Negocios pagando"
          valor={String(datos.negociosPagando)}
          detalle={
            datos.porPlan.length > 0
              ? datos.porPlan
                  .map((plan) => `${plan.nombre}: ${plan.negocios}`)
                  .join(" · ")
              : "Ninguno con plan o módulo vigente"
          }
          icono={Users}
        />
      </div>

      <div className="grid grid-cols-1 gap-gap-lg xl:grid-cols-3">
        <TarjetaAdmin className="xl:col-span-2">
          <div className="mb-gap-md flex flex-wrap items-end justify-between gap-gap-xs">
            <div>
              <h2 className="font-lv-display text-body font-semibold text-ink">
                De dónde viene el dinero
              </h2>
              <p className="text-meta text-ink-soft/70">
                Pagos confirmados de {mesLegible(datos.mes)} por concepto,
                antes de reembolsos.
              </p>
            </div>
            <span className="font-lv-display text-small font-semibold text-ink">
              {formatoUsd(datos.facturadoBrutoCentavos)}
            </span>
          </div>

          {datos.origenes.length === 0 ? (
            <EstadoVacioAdmin
              icono={Receipt}
              titulo="Todavía no hay pagos este mes"
              descripcion="Cuando se confirme un pago, aparecerá aquí separado por plan, módulo o pack."
            />
          ) : (
            <div className="flex flex-col gap-gap-sm">
              {datos.origenes.map((origen) => (
                <div
                  key={`${origen.tipo}:${origen.clave}`}
                  className="rounded-xl border border-ink/5 bg-sand/40 p-gap-sm"
                >
                  <div className="flex items-baseline justify-between gap-gap-sm">
                    <div className="min-w-0">
                      <p className="truncate font-lv-display text-small font-semibold text-ink">
                        {origen.nombre}
                      </p>
                      <p className="text-meta text-ink-soft/65">
                        {origen.tipo === "plan"
                          ? "Plan"
                          : origen.tipo === "modulo"
                            ? "Módulo suelto"
                            : "Pack a medida"}{" "}
                        · {Math.round(origen.porcentaje)} %
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-lv-display text-small font-semibold tabular-nums text-ink">
                        {formatoUsd(origen.montoCentavos)}
                      </p>
                      <p className="text-meta tabular-nums text-ink-soft/65">
                        {formatoCup(
                          Math.round((origen.montoCentavos / 100) * datos.tasaCup),
                        )}
                      </p>
                    </div>
                  </div>
                  <BarraProgreso
                    pct={origen.porcentaje}
                    etiqueta={`${origen.nombre}: ${Math.round(origen.porcentaje)} % del facturado`}
                    className="mt-gap-xs"
                  />
                </div>
              ))}
            </div>
          )}

          {datos.reembolsosCentavos > 0 && (
            <div className="mt-gap-md flex flex-col gap-gap-xs border-t border-ink/10 pt-gap-sm">
              <div className="flex items-baseline justify-between gap-gap-sm">
                <span className="text-small text-ink-soft/75">
                  Reembolsos del mes
                </span>
                <span className="font-lv-display text-small font-semibold tabular-nums text-destructive">
                  −{formatoUsd(datos.reembolsosCentavos)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-gap-sm">
                <span className="text-small font-semibold text-ink">
                  Facturado neto
                </span>
                <span className="font-lv-display text-body font-bold tabular-nums text-ink">
                  {formatoUsd(datos.facturadoCentavos)}
                </span>
              </div>
              <p className="text-meta text-ink-soft/60">
                {formatoCup(datos.reembolsosCup)} CUP devueltos · ya descontados
                del total del mes.
              </p>
            </div>
          )}
        </TarjetaAdmin>

        <TarjetaAdmin>
          <div className="mb-gap-md">
            <h2 className="font-lv-display text-body font-semibold text-ink">
              Negocios por plan
            </h2>
            <p className="text-meta text-ink-soft/70">
              Suscripciones activas y su ingreso recurrente.
            </p>
          </div>

          {datos.porPlan.length === 0 ? (
            <EstadoVacioAdmin
              icono={Users}
              titulo="Nadie está pagando ahora"
              descripcion="No hay packs ni módulos sueltos vigentes."
            />
          ) : (
            <div className="flex flex-col gap-gap-sm">
              {datos.porPlan.map((plan) => (
                <div key={plan.clave} className="rounded-xl border border-ink/5 p-gap-sm">
                  <div className="flex items-baseline justify-between gap-gap-sm">
                    <p className="font-lv-display text-small font-semibold text-ink">
                      {plan.nombre}
                    </p>
                    <span className="shrink-0 text-meta text-ink-soft/70">
                      {plan.negocios} {plan.negocios === 1 ? "negocio" : "negocios"}
                    </span>
                  </div>
                  <p className="mt-1 font-lv-display text-small font-semibold tabular-nums text-ink">
                    {formatoUsd(plan.montoCentavos)}
                    <span className="ml-1 font-sans text-meta font-normal text-ink-soft/60">
                      / mes
                    </span>
                  </p>
                  <BarraProgreso
                    pct={
                      datos.recurrenteCentavos > 0
                        ? (plan.montoCentavos / datos.recurrenteCentavos) * 100
                        : 0
                    }
                    etiqueta={`${plan.nombre}: ${formatoUsd(plan.montoCentavos)} al mes`}
                    className="mt-gap-xs"
                  />
                </div>
              ))}
            </div>
          )}
        </TarjetaAdmin>
      </div>

      <TarjetaAdmin>
        <div className="mb-gap-md flex flex-wrap items-end justify-between gap-gap-xs">
          <div>
            <h2 className="font-lv-display text-body font-semibold text-ink">
              Cobros pendientes
            </h2>
            <p className="text-meta text-ink-soft/70">
              Lo que hay que reclamar o confirmar para que el mes cuadre.
            </p>
          </div>
          <span className="font-lv-display text-small font-semibold text-ink">
            {datos.cobros.length} {datos.cobros.length === 1 ? "pendiente" : "pendientes"}
          </span>
        </div>

        {datos.cobros.length === 0 ? (
          <EstadoVacioAdmin
            icono={CheckCircle2}
            titulo="No hay cobros pendientes"
            descripcion="No hay vencimientos, pagos por confirmar ni pruebas que terminen esta semana."
          />
        ) : (
          <div className="flex flex-col gap-gap-md">
            {(Object.keys(GRUPOS) as GrupoCobro[]).map((grupo) => {
              const items = datos.cobros.filter((cobro) => cobro.grupo === grupo);
              if (items.length === 0) return null;
              const meta = GRUPOS[grupo];

              return (
                <section key={grupo} className="flex flex-col gap-gap-xs">
                  <div className="flex flex-wrap items-center gap-gap-xs">
                    <ChapitaEstado tono={meta.tono}>{meta.titulo}</ChapitaEstado>
                    <span className="text-meta text-ink-soft/60">
                      {meta.descripcion}
                    </span>
                  </div>

                  <div className="flex flex-col gap-gap-xs">
                    {items.map((cobro) => (
                      <div
                        key={cobro.id}
                        className="flex flex-col gap-gap-sm rounded-xl border border-ink/5 bg-white p-gap-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-lv-display text-small font-semibold text-ink">
                            {cobro.negocio}
                          </p>
                          <p className="text-meta text-ink-soft/70">
                            {cobro.detalle}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center justify-between gap-gap-sm sm:justify-end">
                          {cobro.montoCentavos !== null && (
                            <span className="font-lv-display text-small font-semibold tabular-nums text-ink">
                              {formatoUsd(cobro.montoCentavos)}
                            </span>
                          )}
                          <AccionCobro
                            cobro={cobro}
                            confirmando={confirmando}
                            onConfirmar={(pagoId) => void confirmar(pagoId)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </TarjetaAdmin>

      <div className="grid grid-cols-1 gap-gap-lg xl:grid-cols-3">
        <TarjetaAdmin
          className={clsx(
            "xl:col-span-2",
            datos.afiliados.descuadre && "border-lv-amber/40 bg-lv-amber/5",
          )}
        >
          <div className="mb-gap-md flex flex-wrap items-end justify-between gap-gap-xs">
            <div>
              <h2 className="font-lv-display text-body font-semibold text-ink">
                Conciliación de afiliados
              </h2>
              <p className="text-meta text-ink-soft/70">
                Lo que pagaron los negocios referidos frente a la comisión
                calculada.
              </p>
            </div>
            <Link
              href="/admin/afiliados"
              className="text-meta font-semibold text-verde-700 underline underline-offset-2"
            >
              Ver Afiliados
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-gap-sm sm:grid-cols-2">
            <div className="rounded-xl border border-ink/5 p-gap-sm">
              <p className="text-meta text-ink-soft/65">
                Pagos de negocios referidos
              </p>
              <p className="mt-1 font-lv-display text-h3 font-bold tabular-nums text-ink">
                {formatoUsd(datos.afiliados.pagosReferidosCentavos)}
              </p>
            </div>
            <div className="rounded-xl border border-ink/5 p-gap-sm">
              <p className="text-meta text-ink-soft/65">Comisiones calculadas</p>
              <p className="mt-1 font-lv-display text-h3 font-bold tabular-nums text-ink">
                {formatoUsd(datos.afiliados.comisionesCentavos)}
              </p>
            </div>
          </div>

          {datos.afiliados.descuadre ? (
            <p
              role="alert"
              className="mt-gap-sm flex items-start gap-gap-xs rounded-xl border border-lv-amber/40 bg-lv-amber/10 px-gap-sm py-2 text-meta text-ink"
            >
              <AlertTriangle
                size={16}
                strokeWidth={1.9}
                className="mt-[1px] shrink-0 text-lv-amber"
              />
              <span>
                Las comisiones no cuadran con los pagos referidos del mes.
                Revisa el detalle en{" "}
                <Link
                  href="/admin/afiliados"
                  className="font-semibold underline underline-offset-2"
                >
                  Afiliados
                </Link>
                .
              </span>
            </p>
          ) : (
            <p className="mt-gap-sm flex items-center gap-gap-xs text-meta text-verde-700">
              <CheckCircle2 size={16} strokeWidth={1.9} />
              Cuadra con la regla de comisión de Afiliados.
            </p>
          )}
        </TarjetaAdmin>

        <TarjetaAdmin>
          <h2 className="font-lv-display text-body font-semibold text-ink">
            Qué no se puede calcular
          </h2>
          <p className="mt-gap-xs text-small text-ink-soft/75">
            La conversión de prueba a pago y las bajas del mes necesitan
            historial de estados. El esquema actual solo guarda la suscripción
            de hoy, así que no se pintan cifras inventadas.
          </p>
          <p className="mt-gap-sm text-meta text-ink-soft/60">
            Facturado = pagos confirmados. Recurrente = suscripciones activas
            por precio del catálogo.
          </p>
        </TarjetaAdmin>
      </div>
    </div>
  );
}
