"use client";

import { useState } from "react";
import { DollarSign, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { aplicarTasa, formatCup, REDONDEOS_PERMITIDOS, type ConfigTasa } from "@/lib/precios";
import { FormSection } from "@/components/business/form-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TasaDelDiaPorps {
  placeId: string;
  /** Valores iniciales del servidor. */
  tasaInicial?: number | null;
  redondeoInicial?: number;
  actualizadaEnInicial?: number | null;
  /** Métodos de pago del negocio: decide qué tasas extra se piden. */
  monedas?: string[];
  tasaEurInicial?: number | null;
  tasaMlcInicial?: number | null;
  transferenciaPctInicial?: number | null;
}

const INPUT_TASA =
  "pr-12 tabular-nums bg-transparent border-verde-300/40 text-muted-foreground focus-visible:ring-verde-400/30 dark:bg-transparent dark:border-verde-700/50 dark:focus-visible:ring-verde-600/30";

/** Campo vacío → `null` (sin configurar); texto que no es número → `NaN`. */
function leerNumero(texto: string): number | null {
  const t = texto.trim();
  return t ? Number(t.replace(",", ".")) : null;
}

function CampoTasa({
  id,
  label,
  sufijo,
  placeholder,
  value,
  onChange,
  invalido,
}: {
  id: string;
  label: string;
  sufijo: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  invalido: boolean;
}) {
  return (
    <div className="space-y-gap-xs">
      <Label htmlFor={id} className="text-small font-medium text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT_TASA}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-small text-muted-foreground">
          {sufijo}
        </span>
      </div>
      {invalido && (
        <p className="text-meta text-destructive">Escribe un número válido o déjalo vacío.</p>
      )}
    </div>
  );
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
  tasaInicial,
  redondeoInicial = 5,
  actualizadaEnInicial,
  monedas = [],
  tasaEurInicial,
  tasaMlcInicial,
  transferenciaPctInicial,
}: TasaDelDiaPorps) {
  const [tasaEur, setTasaEur] = useState(tasaEurInicial ? String(tasaEurInicial) : "");
  const [tasaMlc, setTasaMlc] = useState(tasaMlcInicial ? String(tasaMlcInicial) : "");
  const [pct, setPct] = useState(
    transferenciaPctInicial != null ? String(transferenciaPctInicial) : "",
  );
  const conEur = monedas.includes("EUR");
  const conMlc = monedas.includes("MLC");
  const conTransfer = monedas.includes("transfer");
  const eurNum = leerNumero(tasaEur);
  const mlcNum = leerNumero(tasaMlc);
  const pctNum = leerNumero(pct);
  const eurMal = conEur && eurNum !== null && !(eurNum > 0 && eurNum < 100_000);
  const mlcMal = conMlc && mlcNum !== null && !(mlcNum > 0 && mlcNum < 100_000);
  const pctMal = conTransfer && pctNum !== null && !(pctNum >= 0 && pctNum <= 100);
  const extrasMal = eurMal || mlcMal || pctMal;

  const [tasa, setTasa] = useState(tasaInicial ? String(tasaInicial) : "");
  const [redondeo, setRedondeo] = useState(redondeoInicial);
  const [actualizadaEn, setActualizadaEn] = useState(actualizadaEnInicial);
  const [guardando, setGuardando] = useState(false);

  const tasaNum = parseFloat(tasa.replace(",", "."));
  const tasaValida = Number.isFinite(tasaNum) && tasaNum > 0;
  const previewCup = tasaValida ? aplicarTasa(10, tasaNum, redondeo) : null;
  const vieja = tasaVieja(actualizadaEn);
  const etiqueta = etiquetaActualizacion(actualizadaEn);

  async function guardarTasa() {
    if (!tasaValida || extrasMal || guardando) return;
    setGuardando(true);
    try {
      const res = await fetch(`/api/places/${placeId}/tasa`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        /* Solo se mandan las monedas que el negocio acepta: una tasa oculta
           no se toca. */
        body: JSON.stringify({
          tasa: tasaNum,
          redondeo,
          ...(conEur && { tasaEur: eurNum }),
          ...(conMlc && { tasaMlc: mlcNum }),
          ...(conTransfer && { transferenciaPct: pctNum }),
        }),
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

  /* Sin interruptor aquí: los precios mixtos se encienden en Ajustes y esta
     tarjeta solo se monta cuando están encendidos. */
  return (
    <FormSection
      title="Precios mixtos: tus tasas"
      icon={<DollarSign size={16} />}
    >
        <div className="space-y-gap-md">
          {/* Línea de apoyo */}
          <p className="text-small text-muted-foreground">
            Tus clientes tocan una moneda en tu ficha y ven la carta con tu tasa.
          </p>
          {etiqueta && (
            <p
              className={cn(
                "text-meta tabular-nums",
                vieja ? "text-lv-amber" : "text-muted-foreground",
              )}
            >
              {etiqueta}
            </p>
          )}

          {/* Campo de tasa */}
          <div className="space-y-gap-xs">
            <Label htmlFor={`tasa-${placeId}`} className="text-small font-medium text-muted-foreground">
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
                  className={INPUT_TASA}
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

          {/* Tasas extra: solo las de las monedas que el negocio acepta. Con
              ellas la ficha deja al cliente ver la carta en esa moneda. */}
          {conEur && (
            <CampoTasa
              id={`tasa-eur-${placeId}`}
              label="¿A cómo está el EUR hoy?"
              sufijo="CUP"
              placeholder="Ej: 380"
              value={tasaEur}
              onChange={setTasaEur}
              invalido={eurMal}
            />
          )}
          {conMlc && (
            <CampoTasa
              id={`tasa-mlc-${placeId}`}
              label="¿A cómo está la USD Clásica hoy?"
              sufijo="CUP"
              placeholder="Ej: 300"
              value={tasaMlc}
              onChange={setTasaMlc}
              invalido={mlcMal}
            />
          )}
          {conTransfer && (
            <CampoTasa
              id={`tasa-transfer-${placeId}`}
              label="Recargo por transferencia (sobre el precio en CUP)"
              sufijo="%"
              placeholder="Ej: 10"
              value={pct}
              onChange={setPct}
              invalido={pctMal}
            />
          )}

          {/* Redondeo */}
          <div className="space-y-gap-xs">
            <Label className="text-small font-medium text-muted-foreground">
              Redondear el precio en CUP a
            </Label>
            <div className="flex flex-wrap gap-gap-xs">
              {REDONDEOS_PERMITIDOS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRedondeo(r)}
                  className={cn(
                    "rounded-lv border px-gap-sm py-gap-2xs text-small font-medium tabular-nums transition-colors",
                    redondeo === r
                      ? "border-verde-500/60 bg-verde-500/10 text-muted-foreground dark:border-verde-400/50 dark:bg-verde-400/10"
                      : "border-verde-300/30 bg-transparent text-muted-foreground hover:border-verde-400/60 dark:border-verde-700/40 dark:hover:border-verde-500/60",
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
            disabled={!tasaValida || extrasMal || guardando}
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
    </FormSection>
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
