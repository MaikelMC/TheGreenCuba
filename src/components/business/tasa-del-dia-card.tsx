"use client";

import { useRef, useState } from "react";
import { DollarSign } from "lucide-react";
import { AvisoGuardado, useEstadoGuardado } from "@/components/business/ui/estado-guardado";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { aplicarTasa, formatCup, type ConfigTasa } from "@/lib/precios";
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
  onBlur,
  invalido,
}: {
  id: string;
  label: string;
  sufijo: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
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
          onBlur={onBlur}
          aria-invalid={invalido || undefined}
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
  plegable = true,
}: TasaDelDiaPorps & {
  /** Dentro de una hoja (Hoy) va abierta y sin la cabecera plegable. */
  plegable?: boolean;
}) {
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
  const [actualizadaEn, setActualizadaEn] = useState(actualizadaEnInicial);
  const { estado, guardar } = useEstadoGuardado();

  /* Lo último que confirmó el servidor: decide si hay algo que mandar al salir
     de un campo y a qué se vuelve si el guardado falla. */
  const guardado = useRef({ tasa, tasaEur, tasaMlc, pct });

  const tasaNum = parseFloat(tasa.replace(",", "."));
  const tasaValida = Number.isFinite(tasaNum) && tasaNum > 0;
  const previewCup = tasaValida ? aplicarTasa(10, tasaNum, redondeoInicial) : null;
  const vieja = tasaVieja(actualizadaEn);
  const etiqueta = etiquetaActualizacion(actualizadaEn);

  /**
   * Se guarda al salir de un campo, nunca mientras se escribe: el cliente no
   * puede ver una tasa a medias. Un valor inválido se marca y no se envía.
   * Si falla, los campos vuelven a lo último guardado y un aviso lo dice.
   */
  async function guardarSiCambio() {
    if (!tasaValida || extrasMal) return;
    const previo = guardado.current;
    if (
      previo.tasa === tasa &&
      previo.tasaEur === tasaEur &&
      previo.tasaMlc === tasaMlc &&
      previo.pct === pct
    ) {
      return;
    }
    const ok = await guardar(async () => {
      try {
        const res = await fetch(`/api/places/${placeId}/tasa`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          /* Solo se mandan las monedas que el negocio acepta: una tasa oculta
             no se toca. Sin redondeo: el servidor conserva el que tenía. */
          body: JSON.stringify({
            tasa: tasaNum,
            ...(conEur && { tasaEur: eurNum }),
            ...(conMlc && { tasaMlc: mlcNum }),
            ...(conTransfer && { transferenciaPct: pctNum }),
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          toast.error(data?.error ?? "No se pudo guardar la tasa: no se cambió nada.");
          return false;
        }
        return true;
      } catch {
        toast.error("No se pudo guardar la tasa. Revisa la conexión: no se cambió nada.");
        return false;
      }
    });
    if (!ok) {
      setTasa(previo.tasa);
      setTasaEur(previo.tasaEur);
      setTasaMlc(previo.tasaMlc);
      setPct(previo.pct);
      return;
    }
    guardado.current = { tasa, tasaEur, tasaMlc, pct };
    setActualizadaEn(Date.now());
  }

  const contenido = (
    <div className="space-y-gap-md">
      <div className="flex flex-wrap items-center justify-between gap-gap-sm">
        <p className="text-small text-muted-foreground">
          Tus clientes tocan una moneda en tu ficha y ven la carta con tu tasa.
        </p>
        <AvisoGuardado estado={estado} />
      </div>

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

      <div className="space-y-gap-xs">
        <Label htmlFor={`tasa-${placeId}`} className="text-small font-medium text-muted-foreground">
          ¿A cómo está el USD hoy?
        </Label>
        <div className="relative">
          <Input
            id={`tasa-${placeId}`}
            type="text"
            inputMode="decimal"
            placeholder="Ej: 350"
            value={tasa}
            onChange={(e) => setTasa(e.target.value)}
            onBlur={() => void guardarSiCambio()}
            aria-invalid={tasa && !tasaValida ? true : undefined}
            className={INPUT_TASA}
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-small text-muted-foreground">
            CUP
          </span>
        </div>
        {previewCup !== null && (
          <p className="text-meta text-muted-foreground tabular-nums">
            10 USD = {formatCup(previewCup)}
          </p>
        )}
        {tasa && !tasaValida && (
          <p className="text-meta text-destructive">Escribe un número válido (ej: 350).</p>
        )}
      </div>

      {/* Tasas extra: solo las de las monedas que el negocio acepta. */}
      {conEur && (
        <CampoTasa
          id={`tasa-eur-${placeId}`}
          label="¿A cómo está el EUR hoy?"
          sufijo="CUP"
          placeholder="Ej: 380"
          value={tasaEur}
          onChange={setTasaEur}
          onBlur={() => void guardarSiCambio()}
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
          onBlur={() => void guardarSiCambio()}
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
          onBlur={() => void guardarSiCambio()}
          invalido={pctMal}
        />
      )}

      <p className="text-meta text-muted-foreground">Se guarda al salir de cada campo.</p>
    </div>
  );

  if (!plegable) return contenido;

  /* Sin interruptor aquí: los precios mixtos se encienden en «Precios y tasa»
     y esta tarjeta solo se monta cuando están encendidos. */
  return (
    <FormSection title="Precios mixtos: tus tasas" icon={<DollarSign size={16} />}>
      {contenido}
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
