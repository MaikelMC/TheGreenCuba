"use client";

import { useState } from "react";
import { DollarSign, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { bloqueoDe, type Funcion } from "@/lib/plans";
import { aplicarTasa, formatCup, REDONDEOS_PERMITIDOS, type ConfigTasa } from "@/lib/precios";
import { useCatalogo } from "@/providers/catalogo-provider";
import { FormSection } from "@/components/business/form-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TasaDelDiaPorps {
  placeId: string;
  funciones: Funcion[];
  /** Valores iniciales del servidor. */
  tasaInicial?: number | null;
  redondeoInicial?: number;
  activaInicial?: boolean;
  actualizadaEnInicial?: number | null;
}

/** Cuántos ms son 24 horas. */
const UN_DIA = 86_400_000;

function tasaVieja(actualizadaEn?: number | null): boolean {
  if (!actualizadaEn) return false;
  return Date.now() - actualizadaEn > UN_DIA;
}

function etiquetaActualizacion(actualizadaEn?: number | null): string {
  if (!actualizadaEn) return "";
  const ms = Date.now() - actualizadaEn;
  if (ms < UN_DIA) return "Actualizada hoy";
  const dias = Math.floor(ms / UN_DIA);
  return dias === 1 ? "Actualizada ayer" : `Actualizada hace ${dias} días`;
}

export function TasaDelDiaCard({
  placeId,
  funciones,
  tasaInicial,
  redondeoInicial = 5,
  activaInicial = false,
  actualizadaEnInicial,
}: TasaDelDiaPorps) {
  const cat = useCatalogo();
  const bloqueo = bloqueoDe(funciones, "tasa_del_dia", cat);

  const [tasa, setTasa] = useState(tasaInicial ? String(tasaInicial) : "");
  const [redondeo, setRedondeo] = useState(redondeoInicial);
  const [activa, setActiva] = useState(activaInicial);
  const [actualizadaEn, setActualizadaEn] = useState(actualizadaEnInicial);
  const [guardando, setGuardando] = useState(false);
  const [cambiandoActiva, setCambiandoActiva] = useState(false);

  const tasaNum = parseFloat(tasa.replace(",", "."));
  const tasaValida = Number.isFinite(tasaNum) && tasaNum > 0;
  const previewCup = tasaValida ? aplicarTasa(10, tasaNum, redondeo) : null;
  const vieja = tasaVieja(actualizadaEn);
  const etiqueta = etiquetaActualizacion(actualizadaEn);

  async function guardarTasa() {
    if (!tasaValida || guardando) return;
    setGuardando(true);
    try {
      const res = await fetch(`/api/places/${placeId}/tasa`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasa: tasaNum, redondeo }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "No se pudo guardar la tasa.");
        return;
      }
      setActualizadaEn(Date.now());
      toast.success("Tasa guardada. Tu carta ya muestra el precio en CUP.");
    } catch {
      toast.error("No se pudo guardar. Revisa la conexión.");
    } finally {
      setGuardando(false);
    }
  }

  async function alternarActiva() {
    if (bloqueo || cambiandoActiva) return;
    const siguiente = !activa;
    setCambiandoActiva(true);
    setActiva(siguiente);
    try {
      const res = await fetch(`/api/places/${placeId}/tasa`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activa: siguiente }),
      });
      if (!res.ok) {
        setActiva(!siguiente);
        toast.error("No se pudo cambiar. Revisa la conexión.");
        return;
      }
      toast.success(
        siguiente
          ? "Tasa activa. Tu carta ya muestra los precios en CUP."
          : "Tasa desactivada. Tu carta vuelve a los precios de siempre.",
      );
    } catch {
      setActiva(!siguiente);
      toast.error("No se pudo cambiar. Revisa la conexión.");
    } finally {
      setCambiandoActiva(false);
    }
  }

  return (
    <FormSection
      title="Tasa del día"
      icon={<DollarSign size={16} />}
    >
      {bloqueo ? (
        /* Candado: mismo patrón visual que el resto de funciones bloqueadas. */
        <div className="flex items-center gap-gap-sm rounded-lv bg-muted/50 px-gap-md py-gap-sm">
          <span className="text-small text-muted-foreground">
            🔒 {bloqueo}
          </span>
        </div>
      ) : (
        <div className="space-y-gap-md">
          {/* Línea de apoyo */}
          <p className="text-small text-muted-foreground">
            Pon tus precios en USD y te los mostramos en CUP con tu tasa.
          </p>

          {/* Toggle activo/inactivo */}
          <div className="flex items-center justify-between gap-gap-md rounded-lv border border-border bg-card px-gap-md py-gap-sm">
            <div>
              <p className="text-small font-medium text-foreground">
                Mostrar precios en CUP en tu carta
              </p>
              {activa && etiqueta && (
                <p
                  className={cn(
                    "text-meta tabular-nums",
                    vieja ? "text-lv-amber" : "text-muted-foreground",
                  )}
                >
                  {etiqueta}
                </p>
              )}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={activa}
              aria-label="Activar conversión a CUP"
              disabled={cambiandoActiva}
              onClick={alternarActiva}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50",
                activa ? "bg-verde-500" : "bg-muted",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-soft transition-transform duration-200",
                  activa ? "translate-x-5" : "translate-x-0",
                )}
              />
            </button>
          </div>

          {/* Campo de tasa */}
          <div className="space-y-gap-xs">
            <Label htmlFor={`tasa-${placeId}`} className="text-small font-medium">
              ¿A cómo está el USD hoy?
            </Label>
            <div className="flex items-center gap-gap-sm">
              <div className="relative flex-1">
                <Input
                  id={`tasa-${placeId}`}
                  type="text"
                  inputMode="decimal"
                  placeholder="Ej: 350"
                  value={tasa}
                  onChange={(e) => setTasa(e.target.value)}
                  className="pr-12 tabular-nums"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-small text-muted-foreground">
                  CUP
                </span>
              </div>
            </div>
            {/* Vista previa en vivo */}
            {previewCup !== null && (
              <p className="text-meta text-muted-foreground tabular-nums">
                10 USD = {formatCup(previewCup)}
              </p>
            )}
            {tasa && !tasaValida && (
              <p className="text-meta text-destructive">
                Escribe un número válido (ej: 350).
              </p>
            )}
          </div>

          {/* Redondeo */}
          <div className="space-y-gap-xs">
            <Label className="text-small font-medium">
              Redondear el precio en CUP a
            </Label>
            <div className="flex flex-wrap gap-gap-xs">
              {REDONDEOS_PERMITIDOS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRedondeo(r)}
                  className={cn(
                    "rounded-lv px-gap-sm py-gap-2xs text-small font-medium tabular-nums transition-colors",
                    redondeo === r
                      ? "bg-verde-500 text-white"
                      : "bg-muted text-muted-foreground hover:bg-verde-100 hover:text-verde-800",
                  )}
                >
                  {r === 1 ? "Sin redondear" : `× ${r}`}
                </button>
              ))}
            </div>
          </div>

          {/* Botón guardar */}
          <button
            type="button"
            onClick={guardarTasa}
            disabled={!tasaValida || guardando}
            className={cn(
              "flex items-center gap-gap-xs rounded-lv px-gap-md py-gap-sm text-small font-medium transition-colors",
              "bg-verde-500 text-white hover:bg-verde-600",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {guardando ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : null}
            {guardando ? "Guardando…" : "Guardar tasa"}
          </button>
        </div>
      )}
    </FormSection>
  );
}

/**
 * Aviso compacto del dashboard: aparece si la tasa está activa y tiene
 * más de 24 horas. No es un componente nuevo — se exporta desde aquí y
 * se monta inline en el dashboard.
 */
export function AvisoTasaVieja({
  activa,
  actualizadaEn,
  onIrAjustes,
}: {
  activa?: boolean;
  actualizadaEn?: number | null;
  onIrAjustes: () => void;
}) {
  if (!activa || !tasaVieja(actualizadaEn)) return null;

  return (
    <div className="flex items-center justify-between gap-gap-sm rounded-lv border border-lv-amber/40 bg-lv-amber/8 px-gap-md py-gap-sm">
      <p className="text-small text-foreground">
        Tu tasa es de ayer.
      </p>
      <button
        type="button"
        onClick={onIrAjustes}
        className="shrink-0 rounded-lv bg-lv-amber/15 px-gap-sm py-gap-2xs text-small font-medium text-foreground transition-colors hover:bg-lv-amber/25"
      >
        Actualizar
      </button>
    </div>
  );
}

/** Pie de carta: texto con la tasa activa y cuándo se actualizó. */
export function PieTasa({ config }: { config: ConfigTasa }) {
  const etiqueta = etiquetaActualizacion(config.tasaActualizadaEn?.getTime());
  return (
    <p className="text-meta text-muted-foreground">
      Precios en CUP según la tasa del negocio:{" "}
      <span className="tabular-nums">
        {new Intl.NumberFormat("en-US").format(config.tasaUsdCup)} CUP por USD
      </span>
      {etiqueta ? `, ${etiqueta.toLowerCase()}` : ""}.
    </p>
  );
}
