"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Smartphone,
  Clock,
  AlertTriangle,
  Wifi,
  RefreshCw,
} from "lucide-react";

interface ResumenDiagnostico {
  ok: boolean;
  periodo: string;
  total: number;
  plataformas: { android: number; ios: number; escritorio: number; otro: number };
  mapa: {
    tasaExito: number | null;
    tiempoMedioMs: number | null;
    total: number;
    cargados: number;
    lentos: number;
    errores: number;
    abandonados: number;
  };
  sinWebgl: number;
  webglPorSoftware: number;
  topVersionesChrome: { version: string; total: number }[];
  topErrores: { mensaje: string; total: number }[];
  topVersionesSw: { version: string; total: number }[];
}

function Tarjeta({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-ink/5 rounded-2xl p-gap-md">
      <h3 className="font-lv-display text-body font-semibold text-ink mb-gap-sm">
        {titulo}
      </h3>
      {children}
    </div>
  );
}

function FilaMetrica({
  etiqueta,
  valor,
  acento,
}: {
  etiqueta: string;
  valor: string | number;
  acento?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-gap-xs border-b border-ink/5 last:border-b-0">
      <span className="text-small text-ink-soft/75">{etiqueta}</span>
      <span
        className={`font-lv-display text-small font-semibold ${acento ? "text-verde-600" : "text-ink"}`}
      >
        {valor}
      </span>
    </div>
  );
}

export default function AdminDiagnosticoPage() {
  const [datos, setDatos] = useState<ResumenDiagnostico | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = () => {
    setCargando(true);
    setError(null);
    fetch("/api/admin/diagnostico")
      .then((r) => (r.ok ? (r.json() as Promise<ResumenDiagnostico>) : Promise.reject(r.status)))
      .then((d) => {
        setDatos(d);
        setCargando(false);
      })
      .catch(() => {
        setError("No se pudieron cargar los diagnósticos.");
        setCargando(false);
      });
  };

  useEffect(() => {
    cargar();
  }, []);

  return (
    <>
      <div className="flex items-center justify-between gap-gap-sm mb-gap-md">
        <div>
          <h1 className="font-lv-display text-h3 font-bold text-ink">
            Diagnóstico
          </h1>
          <p className="text-small text-ink-soft/75 mt-1">
            Últimos 7 días · sin datos personales
          </p>
        </div>
        <button
          type="button"
          onClick={cargar}
          disabled={cargando}
          className="inline-flex items-center gap-gap-xs h-11 px-gap-lg rounded-full border border-ink/10 text-ink-soft/75 text-small font-semibold hover:bg-sand transition-colors duration-300 disabled:opacity-50"
        >
          <RefreshCw size={15} strokeWidth={1.8} className={cargando ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-gap-md text-small text-red-700 mb-gap-md">
          {error}
        </div>
      )}

      {cargando && !datos && (
        <div className="text-small text-ink-soft/75 py-gap-xl text-center">
          Cargando…
        </div>
      )}

      {datos && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gap-md">
          {/* Mapa */}
          <Tarjeta titulo="Mapa">
            <div className="flex items-center gap-3 mb-gap-sm">
              <Activity size={28} strokeWidth={1.5} className="text-verde-600" />
              <div>
                <div className="font-lv-display text-h3 font-bold text-ink">
                  {datos.mapa.tasaExito !== null ? `${datos.mapa.tasaExito} %` : "—"}
                </div>
                <div className="text-meta text-ink-soft/75">cargas con éxito</div>
              </div>
            </div>
            <FilaMetrica etiqueta="Tiempo medio de carga" valor={datos.mapa.tiempoMedioMs !== null ? `${(datos.mapa.tiempoMedioMs / 1000).toFixed(1)} s` : "—"} />
            <FilaMetrica etiqueta="Cargas totales con mapa" valor={datos.mapa.total} />
            <FilaMetrica etiqueta="Éxito" valor={datos.mapa.cargados} acento />
            <FilaMetrica etiqueta="Lentos (> 8 s)" valor={datos.mapa.lentos} />
            <FilaMetrica etiqueta="Con error" valor={datos.mapa.errores} />
            <FilaMetrica etiqueta="Abandonados" valor={datos.mapa.abandonados} />
          </Tarjeta>

          {/* Plataformas */}
          <Tarjeta titulo="Plataformas">
            <div className="flex items-center gap-3 mb-gap-sm">
              <Smartphone size={28} strokeWidth={1.5} className="text-verde-600" />
              <div>
                <div className="font-lv-display text-h3 font-bold text-ink">
                  {datos.total}
                </div>
                <div className="text-meta text-ink-soft/75">sesiones registradas</div>
              </div>
            </div>
            <FilaMetrica etiqueta="Android" valor={datos.plataformas.android} />
            <FilaMetrica etiqueta="iOS" valor={datos.plataformas.ios} />
            <FilaMetrica etiqueta="Escritorio" valor={datos.plataformas.escritorio} />
            {datos.plataformas.otro > 0 && (
              <FilaMetrica etiqueta="Otro" valor={datos.plataformas.otro} />
            )}
          </Tarjeta>

          {/* WebGL */}
          <Tarjeta titulo="WebGL">
            <div className="flex items-center gap-3 mb-gap-sm">
              <Wifi size={28} strokeWidth={1.5} className="text-verde-600" />
              <div>
                <div className="font-lv-display text-h3 font-bold text-ink">
                  {datos.sinWebgl + datos.webglPorSoftware}
                </div>
                <div className="text-meta text-ink-soft/75">Android sin WebGL real</div>
              </div>
            </div>
            <FilaMetrica etiqueta="Sin WebGL" valor={datos.sinWebgl} />
            <FilaMetrica etiqueta="WebGL por software" valor={datos.webglPorSoftware} />
          </Tarjeta>

          {/* Versiones de Chrome */}
          <Tarjeta titulo="Versiones de Chrome">
            <div className="flex items-center gap-3 mb-gap-sm">
              <Clock size={28} strokeWidth={1.5} className="text-verde-600" />
              <div className="text-meta text-ink-soft/75">Top 5 más comunes</div>
            </div>
            {datos.topVersionesChrome.length === 0 ? (
              <p className="text-meta text-ink-soft/75">Sin datos aún.</p>
            ) : (
              datos.topVersionesChrome.map((v) => (
                <FilaMetrica
                  key={v.version}
                  etiqueta={`Chrome ${v.version}`}
                  valor={v.total}
                />
              ))
            )}
          </Tarjeta>

          {/* Errores */}
          <Tarjeta titulo="Errores más frecuentes">
            <div className="flex items-center gap-3 mb-gap-sm">
              <AlertTriangle size={28} strokeWidth={1.5} className="text-verde-600" />
              <div className="text-meta text-ink-soft/75">Top 5 mensajes</div>
            </div>
            {datos.topErrores.length === 0 ? (
              <p className="text-meta text-ink-soft/75">Sin errores registrados.</p>
            ) : (
              datos.topErrores.map((e, i) => (
                <div
                  key={i}
                  className="py-gap-xs border-b border-ink/5 last:border-b-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-meta text-ink-soft/75 truncate flex-1">
                      {e.mensaje.length > 80 ? e.mensaje.slice(0, 80) + "…" : e.mensaje}
                    </span>
                    <span className="font-lv-display text-meta font-semibold text-ink shrink-0">
                      {e.total}
                    </span>
                  </div>
                </div>
              ))
            )}
          </Tarjeta>

          {/* Service Worker */}
          <Tarjeta titulo="Versiones del SW">
            {datos.topVersionesSw.length === 0 ? (
              <p className="text-meta text-ink-soft/75">Sin datos aún.</p>
            ) : (
              datos.topVersionesSw.map((v) => (
                <FilaMetrica
                  key={v.version}
                  etiqueta={`SW ${v.version}`}
                  valor={v.total}
                  acento={v === datos.topVersionesSw[0]}
                />
              ))
            )}
          </Tarjeta>
        </div>
      )}
    </>
  );
}
