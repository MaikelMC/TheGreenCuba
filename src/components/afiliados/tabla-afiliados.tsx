"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, DollarSign, ExternalLink } from "lucide-react";
import { QuitarAfiliacion } from "@/components/afiliados/acciones-admin";
import { fecha as formatFecha } from "@/components/afiliados/piezas";
import { aCup, formatoCup } from "@/lib/afiliados";

export interface AfiliadoResumido {
  id: string;
  nombre: string | null;
  email: string;
  ciudad: string | null;
  creadoTs: number;
  dinero: { generado: number; disponible: number; pedido: number };
  negocios: number;
  pagando: number;
  nuevosEsteMes: number;
  cobrosPedidos: number;
  ultimoNegocioTs: number | null;
}

function formatUsd(centavos: number): string {
  return `$${(centavos / 100).toFixed(2)}`;
}

export function TablaAfiliados({
  afiliados,
  tasaInicial,
  totalGeneradoCentavos,
  totalPorPagarCentavos,
}: {
  afiliados: AfiliadoResumido[];
  tasaInicial: number;
  totalGeneradoCentavos: number;
  totalPorPagarCentavos: number;
}) {
  const [enUsd, setEnUsd] = useState(false);
  const [tasa, setTasa] = useState(tasaInicial);
  const sesenta = Date.now() - 60 * 86_400_000;

  function mostrar(centavos: number): string {
    if (centavos === 0) return "—";
    return enUsd ? formatUsd(centavos) : formatoCup(aCup(centavos, tasa));
  }

  return (
    <div className="flex flex-col gap-gap-sm">
      {/* Cabecera con toggle y tasa */}
      <div className="flex flex-wrap items-center justify-between gap-gap-sm">
        <h2 className="font-lv-display text-body font-bold text-ink">
          Afiliados registrados{" "}
          <span className="ml-1 inline-flex items-center rounded-full bg-verde-50 px-2 py-0.5 font-lv-display text-meta font-semibold text-verde-700 border border-verde-200">
            {afiliados.length}
          </span>
        </h2>

        {/* Controles de moneda */}
        <div className="flex items-center gap-gap-sm flex-wrap">
          {!enUsd && (
            <label className="flex items-center gap-1.5 text-meta text-ink-soft/70">
              <span className="whitespace-nowrap">Tasa CUP/USD</span>
              <input
                type="number"
                min={1}
                max={9999}
                step={1}
                value={tasa}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v > 0) setTasa(Math.round(v));
                }}
                className="w-20 rounded-lg border border-ink/10 bg-sand-warm px-2 py-1 text-meta tabular-nums text-ink focus:outline-none focus:ring-2 focus:ring-verde-400/30"
                aria-label="Tasa de cambio CUP por USD"
              />
            </label>
          )}
          <button
            type="button"
            onClick={() => setEnUsd((v) => !v)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-ink/10 bg-sand px-3 font-lv-display text-meta font-semibold text-ink hover:bg-sand-deep transition-colors duration-300"
            aria-pressed={enUsd}
          >
            <DollarSign size={13} strokeWidth={2} aria-hidden="true" />
            {enUsd ? "Ver en CUP" : "Ver en USD"}
          </button>
        </div>
      </div>

      {/* Resumen de comisiones */}
      <div className="grid grid-cols-2 gap-gap-sm sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        <div
          className="col-span-2 flex flex-col gap-0.5 rounded-xl border border-ink/5 bg-white p-3 cursor-pointer select-none hover:border-verde-200 transition-colors duration-300"
          onClick={() => setEnUsd((v) => !v)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && setEnUsd((v) => !v)}
          aria-label={`Total comisiones generadas, toca para ver en ${enUsd ? "CUP" : "USD"}`}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-soft/70">
            Comisiones generadas · toca para cambiar
          </span>
          <b className="font-lv-display text-[22px] tabular-nums text-ink leading-tight">
            {totalGeneradoCentavos > 0
              ? enUsd
                ? formatUsd(totalGeneradoCentavos)
                : formatoCup(aCup(totalGeneradoCentavos, tasa))
              : "—"}
          </b>
          <span className="text-meta text-ink-soft/70">
            {totalPorPagarCentavos > 0
              ? `${enUsd ? formatUsd(totalPorPagarCentavos) : formatoCup(aCup(totalPorPagarCentavos, tasa))} por pagar`
              : "Sin saldo pendiente"}
          </span>
        </div>
      </div>

      {/* Tabla */}
      {afiliados.length === 0 ? (
        <p className="text-small text-ink-soft/75">
          Todavía no hay afiliados.
        </p>
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full text-small">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-ink-soft/70 border-b border-ink/5">
                <th className="px-2 py-2.5">Afiliado</th>
                <th className="px-2 py-2.5 text-right">Traídos</th>
                <th className="px-2 py-2.5 text-right">Pagando</th>
                <th className="px-2 py-2.5 text-right">Nuevos/mes</th>
                <th className="px-2 py-2.5 text-right">
                  Comisiones
                  <span className="ml-1 normal-case tracking-normal font-normal text-verde-600">
                    {enUsd ? "(USD)" : "(CUP)"}
                  </span>
                </th>
                <th className="px-2 py-2.5 text-right">
                  Por cobrar
                  <span className="ml-1 normal-case tracking-normal font-normal text-verde-600">
                    {enUsd ? "(USD)" : "(CUP)"}
                  </span>
                </th>
                <th className="px-2 py-2.5 text-right">Retiros</th>
                <th className="px-2 py-2.5">Último neg.</th>
                <th className="px-2 py-2.5">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {afiliados.map((a) => {
                const viejo = (a.ultimoNegocioTs ?? a.creadoTs) < sesenta;
                const porCobrar = a.dinero.disponible + a.dinero.pedido;
                return (
                  <tr key={a.id} className="border-t border-ink/5 align-middle">
                    <td className="px-2 py-3">
                      <div className="flex flex-col gap-0.5">
                        <Link
                          href={`/admin/afiliados/${a.id}`}
                          className="font-semibold text-verde-700 hover:underline"
                        >
                          {a.nombre ?? a.email}
                        </Link>
                        {a.ciudad && (
                          <span className="text-meta text-ink-soft/70">{a.ciudad}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">{a.negocios}</td>
                    <td className="px-2 py-3 text-right tabular-nums">
                      <span className={a.pagando > 0 ? "font-semibold text-verde-700" : "text-ink-soft/60"}>
                        {a.pagando}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">
                      {a.nuevosEsteMes > 0 ? (
                        <span className="font-semibold text-verde-700">{a.nuevosEsteMes}</span>
                      ) : (
                        <span className="text-ink-soft/60">0</span>
                      )}
                    </td>
                    <td
                      className="px-2 py-3 text-right tabular-nums font-semibold cursor-pointer hover:text-verde-700 transition-colors duration-200"
                      onClick={() => setEnUsd((v) => !v)}
                      title={`Toca para ver en ${enUsd ? "CUP" : "USD"}`}
                    >
                      {a.dinero.generado > 0 ? mostrar(a.dinero.generado) : <span className="font-normal text-ink-soft/60">—</span>}
                    </td>
                    <td
                      className="px-2 py-3 text-right tabular-nums cursor-pointer hover:text-amber-700 transition-colors duration-200"
                      onClick={() => setEnUsd((v) => !v)}
                      title={`Toca para ver en ${enUsd ? "CUP" : "USD"}`}
                    >
                      {porCobrar > 0 ? (
                        <span className="font-semibold text-amber-700">{mostrar(porCobrar)}</span>
                      ) : (
                        <span className="text-ink-soft/60">—</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-right">
                      {a.cobrosPedidos > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                          <AlertCircle size={11} strokeWidth={2} aria-hidden="true" />
                          {a.cobrosPedidos}
                        </span>
                      ) : (
                        <span className="text-ink-soft/60">—</span>
                      )}
                    </td>
                    <td className={`px-2 py-3 tabular-nums ${viejo ? "font-bold text-red-700" : "text-ink-soft/70"}`}>
                      {a.ultimoNegocioTs ? formatFecha(new Date(a.ultimoNegocioTs)) : "—"}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                          href={`/admin/afiliados/${a.id}`}
                          className="inline-flex h-8 items-center gap-1 rounded-full border border-ink/10 bg-sand px-3 font-lv-display text-meta font-semibold text-ink hover:bg-sand-deep transition-colors duration-300"
                        >
                          <ExternalLink size={12} strokeWidth={2} aria-hidden="true" />
                          Ver
                        </Link>
                        <QuitarAfiliacion afiliadoId={a.id} nombre={a.nombre ?? a.email} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
