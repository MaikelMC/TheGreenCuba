"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Copy,
  Eye,
  Minus,
  MousePointerClick,
  RefreshCw,
  Search,
  Share2,
  Trophy,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import type {
  MetricaRanking,
  PeriodoRanking,
  RankingDatos,
  RankingFila,
} from "@/lib/admin-ranking";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "./category-icon";
import { EnlaceNegocio } from "./enlace-negocio";
import { ChapitaEstado } from "./ui/chapita";
import {
  EstadoVacioAdmin,
  TarjetaAdmin,
  TarjetaKpi,
} from "./ui/tarjeta";
import { StateView } from "@/components/ui/state-view";

const PERIODOS: { valor: PeriodoRanking; label: string }[] = [
  { valor: 7, label: "7 días" },
  { valor: 30, label: "30 días" },
  { valor: 90, label: "90 días" },
];

const METRICAS: { valor: MetricaRanking; label: string }[] = [
  { valor: "total", label: "Total" },
  { valor: "ficha", label: "Ficha" },
  { valor: "menu", label: "Menú" },
];

const SELECT =
  "h-11 w-full rounded-xl border border-ink/10 bg-white px-3 font-lv-display text-small text-ink outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";

const BOTON_ICONO =
  "grid size-11 shrink-0 place-items-center rounded-full border border-ink/10 text-ink-soft/70 transition-colors duration-500 ease-outquint hover:border-verde-200 hover:bg-verde-50 hover:text-verde-700 disabled:cursor-not-allowed disabled:opacity-50";

function numero(valor: number): string {
  return valor.toLocaleString("es-CU");
}

function porcentaje(valor: number): string {
  return `${valor > 0 ? "+" : "−"}${Math.abs(valor).toLocaleString("es-CU", {
    maximumFractionDigits: 1,
  })} %`;
}

function textoVariacion(fila: RankingFila): string {
  if (fila.cambioPct !== null) return porcentaje(fila.cambioPct);
  return fila.total > 0 ? "nuevo en el periodo" : "sin cambio";
}

function textoInforme(
  fila: RankingFila,
  dias: PeriodoRanking,
  totalNegocios: number,
): string {
  return [
    `La Verde · Ranking de ${fila.name}`,
    `Últimos ${dias} días`,
    "",
    `Clics en la ficha: ${numero(fila.ficha)}`,
    `Clics en el menú: ${numero(fila.menu)}`,
    `Total: ${numero(fila.total)}`,
    `Puesto: #${fila.posicion} de ${totalNegocios}`,
    `Variación: ${textoVariacion(fila)}`,
    "",
    "Cifras de clics reales de La Verde.",
  ].join("\n");
}

function Posicion({ fila }: { fila: RankingFila }) {
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full font-lv-display text-meta font-bold",
        fila.posicion === 1
          ? "bg-verde-400 text-verde-950"
          : fila.posicion === 2
            ? "bg-verde-100 text-verde-700"
            : fila.posicion === 3
              ? "bg-verde-50 text-verde-600"
              : "bg-sand text-ink-soft/70",
      )}
      aria-label={`Puesto ${fila.posicion}`}
    >
      {fila.posicion}
    </span>
  );
}

function Tendencia({ fila }: { fila: RankingFila }) {
  if (fila.cambioPct === null) {
    return (
      <ChapitaEstado tono="info" punto={false}>
        Nuevo
      </ChapitaEstado>
    );
  }
  if (fila.cambioPct === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-meta text-ink-soft/60">
        <Minus size={13} strokeWidth={1.8} aria-hidden />
        Sin cambio
      </span>
    );
  }
  const sube = fila.cambioPct > 0;
  const Icono = sube ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-lv-display text-meta font-semibold tabular-nums",
        sube ? "text-verde-700" : "text-red-700",
      )}
      title="Variación frente al periodo anterior"
    >
      <Icono size={13} strokeWidth={2} aria-hidden />
      {porcentaje(fila.cambioPct)}
    </span>
  );
}

function Identidad({ fila }: { fila: RankingFila }) {
  return (
    <div className="flex min-w-0 items-center gap-gap-sm">
      <span className="hidden size-9 shrink-0 place-items-center rounded-xl bg-verde-50 text-verde-600 sm:grid">
        <CategoryIcon
          icon={fila.categoryIcon ?? undefined}
          size={18}
          strokeWidth={1.8}
        />
      </span>
      <div className="min-w-0">
        <EnlaceNegocio
          id={fila.id}
          title={`Abrir la ficha de ${fila.name}`}
          className="block truncate font-lv-display text-small font-semibold text-ink transition-colors hover:text-verde-700"
        >
          {fila.name}
        </EnlaceNegocio>
        <p className="truncate text-meta text-ink-soft/70">
          {fila.category ?? "Sin categoría"} ·{" "}
          {fila.province || fila.city || "Cuba"}
        </p>
      </div>
    </div>
  );
}

export function RankingPanel() {
  const [datos, setDatos] = useState<RankingDatos | null>(null);
  const [dias, setDias] = useState<PeriodoRanking>(30);
  const [metrica, setMetrica] = useState<MetricaRanking>("total");
  const [provincia, setProvincia] = useState("");
  const [categoria, setCategoria] = useState("");
  const [q, setQ] = useState("");
  const [qAplicada, setQAplicada] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const solicitud = useRef(0);

  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      setQAplicada(q.trim());
    }, 250);
    return () => window.clearTimeout(temporizador);
  }, [q]);

  const cargar = useCallback(async () => {
    const id = ++solicitud.current;
    setCargando(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        dias: String(dias),
        metrica,
      });
      if (provincia) params.set("provincia", provincia);
      if (categoria) params.set("categoria", categoria);
      if (qAplicada) params.set("q", qAplicada);

      const res = await fetch(`/api/admin/ranking?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as RankingDatos & { ok: boolean };
      if (id !== solicitud.current) return;
      setDatos(json);
    } catch {
      if (id === solicitud.current) {
        setError("No se pudo cargar el ranking. Revisa la conexión.");
      }
    } finally {
      if (id === solicitud.current) setCargando(false);
    }
  }, [dias, metrica, provincia, categoria, qAplicada]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cambiarPeriodo = (valor: PeriodoRanking) => {
    setDias(valor);
    setDatos(null);
  };

  const cambiarMetrica = (valor: MetricaRanking) => {
    setMetrica(valor);
    setDatos(null);
  };

  const limpiarFiltros = () => {
    setProvincia("");
    setCategoria("");
    setQ("");
    setQAplicada("");
  };

  async function compartir(fila: RankingFila) {
    if (!datos) return;
    const texto = textoInforme(fila, dias, datos.filas.length);

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Ranking de ${fila.name}`,
          text: texto,
        });
        return;
      } catch (fallo) {
        if (fallo instanceof DOMException && fallo.name === "AbortError") {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Informe copiado. Ya puedes enviárselo al dueño.");
    } catch {
      toast.error("No se pudo copiar el informe.");
    }
  }

  async function copiarResumen() {
    if (!datos || datos.filas.length === 0) return;
    const lineas = datos.filas.slice(0, 10).map(
      (fila) =>
        `${fila.posicion}. ${fila.name} — ${numero(fila.total)} clics (${numero(fila.ficha)} ficha / ${numero(fila.menu)} menú)`,
    );
    const texto = [
      `La Verde · Ranking de los últimos ${dias} días`,
      `${numero(datos.resumen.total)} clics · ${numero(datos.resumen.ficha)} en ficha · ${numero(datos.resumen.menu)} en menú`,
      "",
      ...lineas,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Resumen del top 10 copiado.");
    } catch {
      toast.error("No se pudo copiar el resumen.");
    }
  }

  const resumen = datos?.resumen;
  const cambioResumen =
    resumen && resumen.totalAnterior === 0 && resumen.total > 0
      ? null
      : (resumen?.cambioPct ?? null);
  const iconoCambio =
    cambioResumen === null
      ? TrendingUp
      : cambioResumen >= 0
        ? TrendingUp
        : TrendingDown;
  const totalFicha = resumen?.ficha ?? 0;
  const totalMenu = resumen?.menu ?? 0;
  const pctFicha =
    resumen && resumen.total > 0
      ? Math.round((resumen.ficha / resumen.total) * 1000) / 10
      : 0;
  const pctMenu =
    resumen && resumen.total > 0
      ? Math.round((resumen.menu / resumen.total) * 1000) / 10
      : 0;

  return (
    <div className="flex flex-col gap-gap-md">
      <div className="flex flex-wrap items-start justify-between gap-gap-sm">
        <div>
          <h1 className="font-lv-display text-h3 font-bold text-ink">
            Ranking de negocios
          </h1>
          <p className="mt-1 max-w-[62ch] text-small text-ink-soft/75">
            Los negocios ordenados por clics en su ficha y en su menú. Sirve
            para analizar qué está funcionando y compartir el dato con cada
            dueño.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void cargar()}
          disabled={cargando}
          className="inline-flex h-11 items-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-lg text-small font-semibold text-ink-soft/75 transition-colors duration-300 hover:bg-sand disabled:opacity-50"
        >
          <RefreshCw
            size={15}
            strokeWidth={1.8}
            aria-hidden
            className={cargando ? "animate-spin" : ""}
          />
          Actualizar
        </button>
      </div>

      <TarjetaAdmin className="flex flex-col gap-gap-sm">
        <div className="flex flex-wrap items-center justify-between gap-gap-sm">
          <div
            role="group"
            aria-label="Periodo del ranking"
            className="inline-flex rounded-full border border-ink/5 bg-sand p-1"
          >
            {PERIODOS.map((periodo) => (
              <button
                key={periodo.valor}
                type="button"
                onClick={() => cambiarPeriodo(periodo.valor)}
                aria-pressed={dias === periodo.valor}
                className={cn(
                  "min-h-11 rounded-full px-3 font-lv-display text-meta font-semibold transition-colors sm:px-gap-sm",
                  dias === periodo.valor
                    ? "bg-ink text-white"
                    : "text-ink-soft/70 hover:text-ink",
                )}
              >
                {periodo.label}
              </button>
            ))}
          </div>

          <div
            role="group"
            aria-label="Métrica del ranking"
            className="inline-flex rounded-full border border-ink/5 bg-sand p-1"
          >
            {METRICAS.map((opcion) => (
              <button
                key={opcion.valor}
                type="button"
                onClick={() => cambiarMetrica(opcion.valor)}
                aria-pressed={metrica === opcion.valor}
                className={cn(
                  "min-h-11 rounded-full px-3 font-lv-display text-meta font-semibold transition-colors sm:px-gap-sm",
                  metrica === opcion.valor
                    ? "bg-verde-400 text-verde-950"
                    : "text-ink-soft/70 hover:text-ink",
                )}
              >
                {opcion.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-gap-xs sm:grid-cols-3">
          <select
            value={provincia}
            onChange={(event) => setProvincia(event.target.value)}
            aria-label="Filtrar por provincia"
            className={SELECT}
          >
            <option value="">Todas las provincias</option>
            {(datos?.provincias ?? []).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            value={categoria}
            onChange={(event) => setCategoria(event.target.value)}
            aria-label="Filtrar por categoría"
            className={SELECT}
          >
            <option value="">Todas las categorías</option>
            {(datos?.categorias ?? []).map((item) => (
              <option key={item.value} value={item.label}>
                {item.label}
              </option>
            ))}
          </select>
          <label className="relative block">
            <Search
              size={16}
              strokeWidth={1.8}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/45"
            />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Buscar negocio, ciudad o provincia"
              aria-label="Buscar negocio en el ranking"
              className={cn(SELECT, "pl-9")}
            />
          </label>
        </div>
      </TarjetaAdmin>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-gap-sm text-small text-red-700">
          {error}
        </div>
      )}

      {!datos && cargando ? (
        <div className="grid grid-cols-2 gap-gap-sm lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-[112px] rounded-2xl border border-ink/5 bg-white skeleton-shimmer"
            />
          ))}
        </div>
      ) : datos ? (
        <>
          <div className="grid grid-cols-2 gap-gap-sm lg:grid-cols-4">
            <TarjetaKpi
              etiqueta="Clics totales"
              valor={numero(resumen?.total ?? 0)}
              detalle={`${numero(totalFicha)} ficha · ${numero(totalMenu)} menú`}
              icono={MousePointerClick}
            />
            <TarjetaKpi
              etiqueta="Ficha"
              valor={numero(totalFicha)}
              detalle={`${pctFicha.toLocaleString("es-CU")} % del total`}
              icono={Eye}
            />
            <TarjetaKpi
              etiqueta="Menú"
              valor={numero(totalMenu)}
              detalle={`${pctMenu.toLocaleString("es-CU")} % del total`}
              icono={BookOpen}
            />
            <TarjetaKpi
              etiqueta="Variación"
              valor={
                cambioResumen === null ? "Nuevo" : porcentaje(cambioResumen)
              }
              detalle={`${numero(resumen?.totalAnterior ?? 0)} clics en el periodo anterior`}
              icono={iconoCambio}
            />
          </div>

          <TarjetaAdmin className="!p-0">
            <div className="flex flex-wrap items-center justify-between gap-gap-sm border-b border-ink/5 p-gap-md">
              <div>
                <h2 className="font-lv-display text-body font-semibold text-ink">
                  Top de clics
                </h2>
                <p className="mt-1 text-meta text-ink-soft/70">
                  {resumen?.negocios ?? 0}{" "}
                  {(resumen?.negocios ?? 0) === 1 ? "negocio" : "negocios"} ·{" "}
                  {resumen?.suben ?? 0} suben · {resumen?.bajan ?? 0} bajan
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copiarResumen()}
                disabled={!datos.filas.length}
                className="inline-flex h-11 items-center gap-gap-xs rounded-full border border-verde-200 bg-verde-50 px-gap-sm font-lv-display text-meta font-semibold text-verde-700 transition-colors hover:bg-verde-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Copy size={15} strokeWidth={1.8} aria-hidden />
                Copiar resumen
              </button>
            </div>

            {datos.filas.length === 0 ? (
              <EstadoVacioAdmin
                icono={Trophy}
                titulo="Sin clics en este periodo"
                descripcion="Prueba con otro periodo o quita los filtros. El ranking se llena con las aperturas reales de ficha y menú."
                accion={
                  <button
                    type="button"
                    onClick={limpiarFiltros}
                    className="inline-flex min-h-11 items-center rounded-full border border-verde-200 bg-verde-50 px-gap-sm font-lv-display text-meta font-semibold text-verde-700"
                  >
                    Quitar filtros
                  </button>
                }
              />
            ) : (
              <>
                <div
                  className={cn(
                    "hidden overflow-x-auto lg:block",
                    cargando && "opacity-60",
                  )}
                  aria-busy={cargando}
                >
                  <table className="w-full min-w-[760px] text-left">
                    <thead>
                      <tr className="border-b border-ink/5 text-meta font-semibold uppercase tracking-[0.06em] text-ink-soft/55">
                        <th className="w-14 px-gap-sm py-gap-xs">#</th>
                        <th className="px-gap-sm py-gap-xs">Negocio</th>
                        <th className="px-gap-sm py-gap-xs text-right">Ficha</th>
                        <th className="px-gap-sm py-gap-xs text-right">Menú</th>
                        <th className="px-gap-sm py-gap-xs text-right">Total</th>
                        <th className="px-gap-sm py-gap-xs">Vs. anterior</th>
                        <th className="w-16 px-gap-sm py-gap-xs">
                          <span className="sr-only">Compartir</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink/5">
                      {datos.filas.map((fila) => (
                        <tr
                          key={fila.id}
                          className="transition-colors hover:bg-sand/30"
                        >
                          <td className="px-gap-sm py-gap-sm">
                            <Posicion fila={fila} />
                          </td>
                          <td className="max-w-[360px] px-gap-sm py-gap-sm">
                            <Identidad fila={fila} />
                          </td>
                          <td className="px-gap-sm py-gap-sm text-right font-lv-display text-small font-semibold tabular-nums text-ink">
                            {numero(fila.ficha)}
                          </td>
                          <td className="px-gap-sm py-gap-sm text-right font-lv-display text-small font-semibold tabular-nums text-ink">
                            {numero(fila.menu)}
                          </td>
                          <td className="px-gap-sm py-gap-sm text-right font-lv-display text-small font-bold tabular-nums text-ink">
                            {numero(fila.total)}
                          </td>
                          <td className="px-gap-sm py-gap-sm">
                            <Tendencia fila={fila} />
                          </td>
                          <td className="px-gap-sm py-gap-sm text-right">
                            <button
                              type="button"
                              onClick={() => void compartir(fila)}
                              aria-label={`Compartir el informe de ${fila.name}`}
                              title="Compartir informe"
                              className={BOTON_ICONO}
                            >
                              <Share2 size={16} strokeWidth={1.8} aria-hidden />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div
                  className={cn(
                    "flex flex-col divide-y divide-ink/5 lg:hidden",
                    cargando && "opacity-60",
                  )}
                  aria-busy={cargando}
                >
                  {datos.filas.map((fila) => (
                    <article
                      key={fila.id}
                      className="flex flex-col gap-gap-sm p-gap-md"
                    >
                      <div className="flex items-start gap-gap-sm">
                        <Posicion fila={fila} />
                        <div className="min-w-0 flex-1">
                          <Identidad fila={fila} />
                        </div>
                        <button
                          type="button"
                          onClick={() => void compartir(fila)}
                          aria-label={`Compartir el informe de ${fila.name}`}
                          title="Compartir informe"
                          className={BOTON_ICONO}
                        >
                          <Share2 size={16} strokeWidth={1.8} aria-hidden />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-gap-xs rounded-xl bg-sand/60 p-gap-xs">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.08em] text-ink-soft/55">
                            Ficha
                          </p>
                          <p className="font-lv-display text-small font-semibold tabular-nums text-ink">
                            {numero(fila.ficha)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.08em] text-ink-soft/55">
                            Menú
                          </p>
                          <p className="font-lv-display text-small font-semibold tabular-nums text-ink">
                            {numero(fila.menu)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.08em] text-ink-soft/55">
                            Total
                          </p>
                          <p className="font-lv-display text-small font-bold tabular-nums text-ink">
                            {numero(fila.total)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-gap-sm">
                        <span className="text-meta text-ink-soft/65">
                          Puesto {fila.posicion} de {datos.filas.length}
                        </span>
                        <Tendencia fila={fila} />
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </TarjetaAdmin>

          <p className="px-1 text-meta text-ink-soft/60">
            Se cuentan aperturas reales de ficha (`vista_perfil`) y de menú
            (`vista_menu`), igual que en el panel del dueño. Los filtros se
            aplican sobre negocios activos.
          </p>
        </>
      ) : error ? (
        <TarjetaAdmin>
          <StateView
            variant="error"
            size="sm"
            icon={RefreshCw}
            title="No se pudo cargar el ranking"
            description="Comprueba la conexión y vuelve a intentarlo."
            actions={
              <button
                type="button"
                onClick={() => void cargar()}
                className="inline-flex min-h-11 items-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-sm font-lv-display text-meta font-semibold text-ink-soft/75"
              >
                <RefreshCw size={15} strokeWidth={1.8} aria-hidden />
                Reintentar
              </button>
            }
          />
        </TarjetaAdmin>
      ) : null}
    </div>
  );
}
