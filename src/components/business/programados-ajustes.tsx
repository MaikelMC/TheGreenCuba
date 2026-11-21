"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarClock, Loader2, Lock } from "lucide-react";
import { AvisoGuardado, useEstadoGuardado } from "@/components/business/ui/estado-guardado";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/business/ui/switch";
import { INPUT_NATIVO_HOLGADO as INPUT } from "@/components/business/ui/clases";
import { PROGRAMADOS_DEFAULT, type ProgramadosConfig } from "@/lib/ficha/entrega";

const LABEL = "font-lv-display text-meta font-semibold text-ink-soft/75";

/**
 * Ajustes de pedidos programados en el panel de cocina.
 *
 * Solo aparece si el negocio tiene la función `pedidos_programados`. El
 * candado lo enseña quien pasa `tieneFuncion={false}`.
 */
export function ProgramadosAjustes({
  placeId,
  tieneFuncion,
  onVerPlanes,
}: {
  placeId: string;
  tieneFuncion: boolean;
  onVerPlanes: () => void;
}) {
  const [config, setConfig] = useState<ProgramadosConfig>(PROGRAMADOS_DEFAULT);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!tieneFuncion) {
      setCargando(false);
      return;
    }
    let alive = true;
    fetch(`/api/places/${placeId}/programados`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (!alive) return;
        if (data && typeof data === "object") {
          setConfig(data as ProgramadosConfig);
        }
      })
      .catch(() => {/* usar defaults */})
      .finally(() => { if (alive) setCargando(false); });
    return () => { alive = false; };
  }, [placeId, tieneFuncion]);

  /* Guardado automático: el interruptor y la duración guardan al cambiar; los
     números, al salir del campo. Si el servidor falla, todo vuelve a lo último
     guardado (`guardadoRef`) y un aviso lo dice. */
  const { estado, guardar: guardarConEstado } = useEstadoGuardado();
  const guardadoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!cargando && guardadoRef.current === null) guardadoRef.current = JSON.stringify(config);
  }, [cargando, config]);

  const guardar = useCallback(
    async (siguiente: ProgramadosConfig = config) => {
      const previo = guardadoRef.current;
      if (previo === JSON.stringify(siguiente)) return;
      const ok = await guardarConEstado(async () => {
        try {
          const res = await fetch(`/api/places/${placeId}/programados`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(siguiente),
          });
          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            toast.error(data.error ?? "No se pudo guardar: no se cambió nada.");
            return false;
          }
          return true;
        } catch {
          toast.error("No se pudo guardar. Revisa la conexión: no se cambió nada.");
          return false;
        }
      });
      if (!ok) {
        if (previo) setConfig(JSON.parse(previo) as ProgramadosConfig);
        return;
      }
      guardadoRef.current = JSON.stringify(siguiente);
    },
    [placeId, config, guardarConEstado],
  );

  return (
    <div>
      <div className="mb-gap-sm flex items-center justify-between gap-gap-xs">
        <div className="flex items-center gap-gap-xs">
          <CalendarClock size={16} strokeWidth={1.8} className="text-verde-600 shrink-0" />
          <p className="font-lv-display text-small font-semibold text-ink">
            Pedidos programados
          </p>
        </div>
        {tieneFuncion && !cargando && (
          <label className="flex cursor-pointer items-center gap-[6px]">
            <span className="font-lv-display text-meta font-semibold text-ink-soft/75">
              {config.activo ? "Activo" : "Inactivo"}
            </span>
            <Switch
              tamano="sm"
              checked={config.activo}
              onToggle={() => {
                const siguiente = { ...config, activo: !config.activo };
                setConfig(siguiente);
                void guardar(siguiente);
              }}
              label="Pedidos programados"
            />
          </label>
        )}
      </div>

      {!tieneFuncion ? (
        <div className="rounded-xl border border-ink/5 bg-sand p-gap-sm">
          <p className="flex items-center gap-gap-xs text-meta text-ink-soft/75">
            <Lock size={13} strokeWidth={1.8} className="shrink-0" />
            Disponible en el módulo <strong className="text-ink">Pedidos programados</strong>.
          </p>
          <button
            type="button"
            onClick={onVerPlanes}
            className="mt-gap-xs inline-flex h-9 cursor-pointer items-center rounded-full bg-verde-400 px-gap-sm font-lv-display text-meta font-semibold text-verde-950 shadow-primary-halo transition duration-500 ease-outquint hover:bg-verde-300"
          >
            Ver planes
          </button>
        </div>
      ) : cargando ? (
        <div className="flex items-center gap-gap-xs text-meta text-ink-soft/75">
          <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />
          Cargando…
        </div>
      ) : (
        <div className="flex flex-col gap-gap-sm">
          <div className="grid grid-cols-2 gap-gap-sm">
            {/* Días por adelantado */}
            <div className="flex flex-col gap-gap-xs">
              <label htmlFor="pg-diasMax" className={LABEL}>
                Días por adelantado (1–7)
              </label>
              <input
                id="pg-diasMax"
                type="number"
                min={1}
                max={7}
                value={config.diasMax}
                onChange={(e) => setConfig((c) => ({ ...c, diasMax: Math.min(7, Math.max(1, Number(e.target.value))) }))}
                onBlur={() => void guardar()}
                className={INPUT}
              />
            </div>

            {/* Antelación mínima */}
            <div className="flex flex-col gap-gap-xs">
              <label htmlFor="pg-antelacion" className={LABEL}>
                Antelación mínima (min)
              </label>
              <input
                id="pg-antelacion"
                type="number"
                min={0}
                value={config.antelacionMin}
                onChange={(e) => setConfig((c) => ({ ...c, antelacionMin: Math.max(0, Number(e.target.value)) }))}
                onBlur={() => void guardar()}
                className={INPUT}
              />
            </div>

            {/* Duración de franja */}
            <div className="flex flex-col gap-gap-xs">
              <label htmlFor="pg-franjaMin" className={LABEL}>
                Duración de franja
              </label>
              <select
                id="pg-franjaMin"
                value={config.franjaMin}
                onChange={(e) => {
                  const siguiente = { ...config, franjaMin: Number(e.target.value) as 30 | 60 };
                  setConfig(siguiente);
                  void guardar(siguiente);
                }}
                className={cn(INPUT, "cursor-pointer")}
              >
                <option value={30}>30 minutos</option>
                <option value={60}>1 hora</option>
              </select>
            </div>

            {/* Cupo por franja */}
            <div className="flex flex-col gap-gap-xs">
              <label htmlFor="pg-cupo" className={LABEL}>
                Límite por horario
              </label>
              <input
                id="pg-cupo"
                type="number"
                min={1}
                value={config.cupoPorFranja ?? ""}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    cupoPorFranja: e.target.value === "" ? null : Math.max(1, Number(e.target.value)),
                  }))
                }
                placeholder="Sin límite"
                onBlur={() => void guardar()}
                className={INPUT}
              />
            </div>

            {/* Aviso Telegram + estado del guardado */}
            <div className="flex items-end justify-between gap-gap-sm col-span-2">
              <div className="flex w-36 flex-col gap-gap-xs">
                <label htmlFor="pg-aviso" className={LABEL}>
                  Aviso por Telegram (min antes)
                </label>
                <input
                  id="pg-aviso"
                  type="number"
                  min={0}
                  value={config.avisoMin}
                  onChange={(e) => setConfig((c) => ({ ...c, avisoMin: Math.max(0, Number(e.target.value)) }))}
                  onBlur={() => void guardar()}
                  className={INPUT}
                />
              </div>
              <div className="flex flex-col items-end gap-gap-xs pb-gap-xs text-right">
                <AvisoGuardado estado={estado} />
                <p className="text-meta text-ink-soft/75">Se guarda al salir de cada campo.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
