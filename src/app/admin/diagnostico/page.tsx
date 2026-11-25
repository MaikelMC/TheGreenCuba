"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ChapitaEstado } from "@/components/admin/ui/chapita";
import { TarjetaAdmin } from "@/components/admin/ui/tarjeta";
import { cn } from "@/lib/utils";

type Nivel = "grave" | "aviso";
type Severidad = "alta" | "media" | "baja";
type EstadoServicio = "ok" | "revisar" | "caido";

interface Aviso {
  nivel: Nivel;
  texto: string;
}

interface GrupoError {
  clave: string;
  titulo: string;
  severidad: Severidad;
  causa: string;
  casos: number;
  sesiones: number;
  plataformas: Record<string, number>;
  navegadores: Record<string, number>;
  rutas: string[];
  versionesApp: string[];
  versionesSw: string[];
  primera: string | null;
  ultima: string | null;
  ejemplos: string[];
}

interface DatosDiagnostico {
  ok: boolean;
  periodo: string;
  actualizadoEn: string;
  total: number;
  plataformas: { android: number; ios: number; escritorio: number; otros: number };
  mapa: {
    tasaExito: number | null;
    tiempoMedioMs: number | null;
    total: number;
    inicios: number;
    cargados: number;
    lentos: number;
    errores: number;
    abandonados: number;
  };
  sinWebgl: number;
  webglPorSoftware: number;
  android: number;
  topVersionesChrome: { version: string; total: number; pct: number }[];
  topVersionesSw: { version: string; total: number; pct: number }[];
  swPublicada: string | null;
  swRegistrado: number;
  swDesactualizado: number;
  errores: GrupoError[];
  resumen: Aviso[];
  comparacion: {
    total: number;
    cargasMapa: number;
    erroresMapa: number;
    sinWebgl: number;
    erroresAltos: number;
  };
}

interface Servicio {
  id: string;
  nombre: string;
  detalle: string;
  estado: EstadoServicio;
  latenciaMs: number | null;
}

type Pestana = "dispositivos" | "servicios";

const ETIQUETA_PLATAFORMA: Record<string, string> = {
  android: "Android",
  ios: "iOS",
  escritorio: "Escritorio",
  otros: "Otros",
};

function delta(valor: number): string {
  if (valor === 0) return "sin cambio";
  return valor > 0 ? `+${valor}` : `−${Math.abs(valor)}`;
}

function pct(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 1000) / 10 : 0;
}

function tonoError(severidad: Severidad) {
  return severidad === "alta" ? "error" : severidad === "media" ? "aviso" : "info";
}

function tonoServicio(estado: EstadoServicio) {
  return estado === "ok" ? "ok" : estado === "caido" ? "error" : "aviso";
}

function Barra({
  etiqueta,
  total,
  porcentaje,
  detalle,
}: {
  etiqueta: string;
  total: number;
  porcentaje: number;
  detalle?: string;
}) {
  return (
    <div className="py-gap-xs">
      <div className="flex items-baseline justify-between gap-gap-sm">
        <span className="min-w-0 truncate text-small text-ink">{etiqueta}</span>
        <span className="shrink-0 font-lv-display text-small font-semibold text-ink">
          {total}
          <span className="ml-1 text-meta font-normal text-ink-soft/70">
            · {porcentaje} %
          </span>
        </span>
      </div>
      <div className="mt-[6px] h-2 overflow-hidden rounded-full bg-sand-deep">
        <div
          className="h-full rounded-full bg-verde-400"
          style={{ width: `${Math.min(100, Math.max(0, porcentaje))}%` }}
        />
      </div>
      {detalle && <p className="mt-[3px] text-meta text-ink-soft/70">{detalle}</p>}
    </div>
  );
}

function TarjetaDato({
  titulo,
  valor,
  detalle,
  explicacion,
  tono,
  estado,
}: {
  titulo: string;
  valor: string | number;
  detalle: string;
  explicacion?: string;
  tono: "ok" | "aviso" | "error" | "info";
  estado: string;
}) {
  return (
    <TarjetaAdmin className="flex flex-col gap-gap-xs">
      <div className="flex items-start justify-between gap-gap-sm">
        <h2 className="font-lv-display text-body font-semibold text-ink">{titulo}</h2>
        <ChapitaEstado tono={tono} punto={false}>
          {estado}
        </ChapitaEstado>
      </div>
      <span className="font-lv-display text-h3 font-bold leading-none text-ink">
        {valor}
      </span>
      <span className="text-small text-ink-soft/75">{detalle}</span>
      {explicacion && (
        <span className="mt-auto border-t border-ink/5 pt-gap-xs text-meta text-ink-soft/70">
          {explicacion}
        </span>
      )}
    </TarjetaAdmin>
  );
}

export default function AdminDiagnosticoPage() {
  const [pestana, setPestana] = useState<Pestana>("dispositivos");
  const [datos, setDatos] = useState<DatosDiagnostico | null>(null);
  const [servicios, setServicios] = useState<Servicio[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoServicios, setCargandoServicios] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/diagnostico", { cache: "no-store" });
      if (!res.ok) throw new Error("diagnostico");
      setDatos((await res.json()) as DatosDiagnostico);
    } catch {
      setError("No se pudieron cargar los diagnósticos.");
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarServicios = useCallback(async () => {
    setCargandoServicios(true);
    try {
      const res = await fetch("/api/admin/servicios", { cache: "no-store" });
      if (!res.ok) throw new Error("servicios");
      const json = (await res.json()) as { ok: boolean; servicios: Servicio[] };
      setServicios(json.servicios);
    } catch {
      setServicios([]);
      setError("No se pudieron comprobar los servicios.");
    } finally {
      setCargandoServicios(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (pestana === "servicios" && servicios === null && !cargandoServicios) {
      void cargarServicios();
    }
  }, [pestana, servicios, cargandoServicios, cargarServicios]);

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Mensajes copiados");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const graves = datos?.resumen.filter((aviso) => aviso.nivel === "grave") ?? [];
  const avisos = datos?.resumen.filter((aviso) => aviso.nivel === "aviso") ?? [];
  const androidSinWebglPct = datos
    ? pct(datos.sinWebgl, Math.max(1, datos.android))
    : 0;

  return (
    <>
      <div className="mb-gap-md flex flex-wrap items-start justify-between gap-gap-sm">
        <div>
          <h1 className="font-lv-display text-h3 font-bold text-ink">Diagnóstico</h1>
          <p className="mt-1 text-small text-ink-soft/75">
            Últimos {datos?.periodo ?? "7 días"} · sin datos personales
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void cargar();
            if (pestana === "servicios") void cargarServicios();
          }}
          disabled={cargando || cargandoServicios}
          className="inline-flex h-11 items-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-lg text-small font-semibold text-ink-soft/75 transition-colors duration-300 hover:bg-sand disabled:opacity-50"
        >
          <RefreshCw
            size={15}
            strokeWidth={1.8}
            aria-hidden
            className={cargando || cargandoServicios ? "animate-spin" : ""}
          />
          Actualizar
        </button>
      </div>

      <div
        role="tablist"
        aria-label="Secciones de Diagnóstico"
        className="mb-gap-md grid grid-cols-2 gap-gap-xs rounded-full border border-ink/5 bg-white p-1"
      >
        {[
          { id: "dispositivos" as const, label: "Dispositivos y errores" },
          { id: "servicios" as const, label: "Servicios" },
        ].map((item) => (
          <button
            key={item.id}
            id={`tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={pestana === item.id}
            aria-controls={`panel-${item.id}`}
            onClick={() => setPestana(item.id)}
            className={cn(
              "min-h-11 rounded-full px-2 py-2 font-lv-display text-meta font-semibold transition-colors duration-300 sm:px-gap-sm sm:text-small",
              pestana === item.id
                ? "bg-ink text-white"
                : "text-ink-soft/75 hover:bg-sand",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-gap-md rounded-2xl border border-red-200 bg-red-50 p-gap-md text-small text-red-700">
          {error}
        </div>
      )}

      {cargando && !datos && (
        <div className="py-gap-xl text-center text-small text-ink-soft/75">
          Cargando…
        </div>
      )}

      {pestana === "dispositivos" && datos && (
        <section
          id="panel-dispositivos"
          role="tabpanel"
          aria-labelledby="tab-dispositivos"
          className="flex flex-col gap-gap-md"
        >
          <div
            role="status"
            className={cn(
              "rounded-2xl border p-gap-md",
              graves.length > 0
                ? "border-destructive/25 bg-destructive/10"
                : avisos.length > 0
                  ? "border-lv-amber/30 bg-lv-amber/10"
                  : "border-verde-200 bg-verde-50",
            )}
          >
            <p className="font-lv-display text-body font-semibold text-ink">
              {graves.length > 0
                ? `${graves.length} ${graves.length === 1 ? "problema grave" : "problemas graves"}`
                : avisos.length > 0
                  ? `${avisos.length} ${avisos.length === 1 ? "aviso" : "avisos"}`
                  : "Todo correcto esta semana"}
            </p>
            {datos.resumen.length === 0 ? (
              <p className="mt-gap-xs text-small text-ink-soft/75">
                No hay problemas graves ni avisos con los datos de los últimos 7 días.
              </p>
            ) : (
              <ul className="mt-gap-xs flex flex-col gap-1 text-small text-ink-soft/85">
                {datos.resumen.map((aviso) => (
                  <li key={aviso.texto} className="flex gap-2">
                    <span aria-hidden className="mt-[7px] size-[6px] shrink-0 rounded-full bg-current" />
                    <span>{aviso.texto}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-1 gap-gap-sm md:grid-cols-3">
            <TarjetaDato
              titulo="Mapa"
              valor={datos.mapa.tasaExito === null ? "Sin datos" : `${datos.mapa.tasaExito} %`}
              detalle={
                datos.mapa.total > 0
                  ? `${datos.mapa.cargados} de ${datos.mapa.total} cargas completas · ${delta(datos.comparacion.cargasMapa)}`
                  : "No llegan cargas del mapa"
              }
              explicacion={
                datos.mapa.total === 0
                  ? "Revisa la telemetría del mapa: no hay ningún evento de carga completo."
                  : `${datos.mapa.lentos} lentas · ${datos.mapa.errores} con error · ${datos.mapa.abandonados} abandonadas`
              }
              tono={datos.mapa.total === 0 ? "aviso" : (datos.mapa.tasaExito ?? 0) >= 90 ? "ok" : "aviso"}
              estado={datos.mapa.total === 0 ? "Revisar" : (datos.mapa.tasaExito ?? 0) >= 90 ? "OK" : "Revisar"}
            />

            <TarjetaDato
              titulo="WebGL"
              valor={datos.android === 0 ? "Sin Android" : `${datos.sinWebgl} de ${datos.android}`}
              detalle={
                datos.android === 0
                  ? "No hay sesiones Android que medir"
                  : `${androidSinWebglPct} % sin WebGL real · ${delta(datos.comparacion.sinWebgl)}`
              }
              explicacion={`${datos.webglPorSoftware} Android usan WebGL por software. Los dispositivos sin WebGL ven la lista de cercanos.`}
              tono={androidSinWebglPct > 5 ? "error" : "ok"}
              estado={androidSinWebglPct > 5 ? "Revisar" : "OK"}
            />

            <TarjetaDato
              titulo="Service worker"
              valor={datos.swPublicada ?? "Sin datos"}
              detalle={
                datos.swRegistrado > 0
                  ? `${datos.swRegistrado} sesiones con versión · ${datos.swDesactualizado} desactualizadas`
                  : "No se registra la versión del SW"
              }
              explicacion={
                datos.swPublicada
                  ? "La versión publicada se compara con la activa de cada sesión."
                  : "La telemetría no está recibiendo la versión activa del service worker."
              }
              tono={datos.swRegistrado === 0 ? "aviso" : datos.swDesactualizado / Math.max(1, datos.swRegistrado) > 0.2 ? "aviso" : "ok"}
              estado={datos.swRegistrado === 0 ? "Revisar" : "OK"}
            />
          </div>

          <div className="grid grid-cols-1 gap-gap-md lg:grid-cols-2">
            <TarjetaAdmin>
              <div className="mb-gap-xs flex items-baseline justify-between gap-gap-sm">
                <h2 className="font-lv-display text-body font-semibold text-ink">Plataformas</h2>
                <span className="text-meta text-ink-soft/70">{datos.total} sesiones · {delta(datos.comparacion.total)}</span>
              </div>
              {(["android", "ios", "escritorio", "otros"] as const).map((clave) => (
                <Barra
                  key={clave}
                  etiqueta={ETIQUETA_PLATAFORMA[clave] ?? clave}
                  total={datos.plataformas[clave]}
                  porcentaje={pct(datos.plataformas[clave], datos.total)}
                />
              ))}
            </TarjetaAdmin>

            <TarjetaAdmin>
              <div className="mb-gap-xs flex items-baseline justify-between gap-gap-sm">
                <h2 className="font-lv-display text-body font-semibold text-ink">Versiones de navegador</h2>
                <span className="text-meta text-ink-soft/70">Top 5</span>
              </div>
              {datos.topVersionesChrome.length === 0 ? (
                <p className="text-small text-ink-soft/75">Sin datos de navegador todavía.</p>
              ) : (
                datos.topVersionesChrome.map((version) => (
                  <Barra
                    key={version.version}
                    etiqueta={`Chrome ${version.version}`}
                    total={version.total}
                    porcentaje={version.pct}
                  />
                ))
              )}
            </TarjetaAdmin>
          </div>

          <TarjetaAdmin>
            <div className="mb-gap-xs flex items-baseline justify-between gap-gap-sm">
              <h2 className="font-lv-display text-body font-semibold text-ink">Versiones del service worker</h2>
              <span className="text-meta text-ink-soft/70">
                {datos.swPublicada ? `Publicada: ${datos.swPublicada}` : "Sin versión publicada"}
              </span>
            </div>
            {datos.topVersionesSw.length === 0 ? (
              <p className="text-small text-ink-soft/75">
                No hay versiones registradas. La telemetría no está recibiendo `swVersion`.
              </p>
            ) : (
              datos.topVersionesSw.map((version) => (
                <Barra
                  key={version.version}
                  etiqueta={version.version}
                  total={version.total}
                  porcentaje={version.pct}
                  detalle={version.version === datos.swPublicada ? "Versión publicada" : "Versión anterior"}
                />
              ))
            )}
          </TarjetaAdmin>

          <TarjetaAdmin>
            <div className="mb-gap-sm flex items-baseline justify-between gap-gap-sm">
              <h2 className="font-lv-display text-body font-semibold text-ink">Errores agrupados</h2>
              <span className="text-meta text-ink-soft/70">{datos.errores.length} grupos</span>
            </div>
            {datos.errores.length === 0 ? (
              <p className="text-small text-ink-soft/75">Sin errores registrados en los últimos 7 días.</p>
            ) : (
              <div className="flex flex-col gap-gap-xs">
                {datos.errores.map((grupo) => {
                  const texto = grupo.ejemplos.join("\n\n");
                  return (
                    <details key={grupo.clave} className="rounded-xl border border-ink/5 bg-sand/40">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-gap-sm px-gap-sm py-gap-xs [&::-webkit-details-marker]:hidden">
                        <ChevronDown size={16} strokeWidth={1.8} aria-hidden className="shrink-0 text-ink-soft/60" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-lv-display text-small font-semibold text-ink">{grupo.titulo}</span>
                          <span className="block truncate text-meta text-ink-soft/70">
                            {grupo.casos} {grupo.casos === 1 ? "caso" : "casos"} · {grupo.sesiones} sesiones · {grupo.ultima ? new Date(grupo.ultima).toLocaleDateString("es-CU", { timeZone: "America/Havana" }) : "sin fecha"}
                          </span>
                        </span>
                        <ChapitaEstado tono={tonoError(grupo.severidad)} punto={false}>
                          {grupo.severidad === "alta" ? "Alta" : grupo.severidad === "media" ? "Media" : "Baja"}
                        </ChapitaEstado>
                      </summary>
                      <div className="border-t border-ink/5 px-gap-sm py-gap-sm">
                        <p className="text-small text-ink-soft/85">{grupo.causa}</p>
                        <p className="mt-gap-xs text-meta text-ink-soft/70">
                          {Object.entries(grupo.plataformas).map(([clave, total]) => `${ETIQUETA_PLATAFORMA[clave] ?? clave}: ${total}`).join(" · ")}
                          {grupo.rutas.length > 0 ? ` · ${grupo.rutas.join(", ")}` : ""}
                        </p>
                        {grupo.ejemplos.length > 0 && (
                          <div className="mt-gap-sm">
                            <div className="mb-gap-xs flex items-center justify-between gap-gap-sm">
                              <span className="text-meta font-semibold uppercase tracking-[0.06em] text-ink-soft/60">Mensajes</span>
                              <button
                                type="button"
                                onClick={() => void copiar(texto)}
                                className="inline-flex h-11 items-center gap-1 rounded-full px-3 text-meta font-semibold text-ink-soft/75 hover:bg-white"
                              >
                                <Copy size={14} strokeWidth={1.8} aria-hidden />
                                Copiar
                              </button>
                            </div>
                            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-gap-sm font-mono text-meta leading-relaxed text-ink-soft">
                              {texto}
                            </pre>
                          </div>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </TarjetaAdmin>
        </section>
      )}

      {pestana === "servicios" && (
        <section id="panel-servicios" role="tabpanel" aria-labelledby="tab-servicios">
          <TarjetaAdmin>
            <div className="mb-gap-sm flex items-baseline justify-between gap-gap-sm">
              <h2 className="font-lv-display text-body font-semibold text-ink">Servicios</h2>
              <span className="text-meta text-ink-soft/70">Resultado cacheado 5 minutos</span>
            </div>
            {cargandoServicios && !servicios ? (
              <p className="text-small text-ink-soft/75">Comprobando servicios…</p>
            ) : servicios && servicios.length > 0 ? (
              <div className="flex flex-col divide-y divide-ink/5">
                {servicios.map((servicio) => (
                  <div key={servicio.id} className="flex min-h-11 items-center gap-gap-sm py-gap-sm">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sand text-ink-soft/70">
                      {servicio.estado === "ok" ? <Check size={16} strokeWidth={1.8} aria-hidden /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-lv-display text-small font-semibold text-ink">{servicio.nombre}</span>
                      <span className="block text-meta text-ink-soft/75">{servicio.detalle}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <ChapitaEstado tono={tonoServicio(servicio.estado)} punto={false}>
                        {servicio.estado === "ok" ? "OK" : servicio.estado === "caido" ? "Caído" : "Revisar"}
                      </ChapitaEstado>
                      {servicio.latenciaMs !== null && (
                        <span className="mt-1 block text-meta text-ink-soft/60">{servicio.latenciaMs} ms</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-small text-ink-soft/75">No hay servicios configurados que comprobar.</p>
            )}
          </TarjetaAdmin>
        </section>
      )}
    </>
  );
}
