"use client";

import { cn } from "@/lib/utils";
import {
  TIPOS_NEGOCIO,
  TIPO_NEGOCIO_LABEL,
  MODULOS_FICHA,
  MODULO_FICHA_LABEL,
  type ModuloFicha,
  type TipoNegocio,
  type ComoComprar,
  type ComoAtiende,
  type EspecialDelDia,
} from "@/lib/ficha/tipos";
import type { EntregaConfig } from "@/lib/ficha/entrega";
import { COPY } from "@/config/ficha";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const INPUT =
  "rounded-xl border-ink/10 bg-white text-ink placeholder:text-ink-soft/75 focus-visible:border-verde-400 focus-visible:ring-offset-0 focus-visible:ring-verde-400/30";

const MODULO_ICONS: Record<ModuloFicha, string> = {
  domicilio: "🛵",
  local: "🏠",
  tienda: "🏪",
  servicios: "✂️",
};

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-gap-sm">
      <span
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => e.key === " " && onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400",
          checked ? "bg-verde-500" : "bg-ink/15",
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block size-5 rounded-full bg-white shadow-md transition-transform duration-300",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </span>
      <span className="text-small text-ink">{label}</span>
    </label>
  );
}

/** Config mínima de domicilio: solo costo simple y tiempo. */
function EntregaSimpleEditor({
  value,
  onChange,
}: {
  value: EntregaConfig | null;
  onChange: (next: EntregaConfig) => void;
}) {
  const modo = value?.costo.modo ?? "gratis";
  const tiempo = value?.tiempo ?? { min: 20, max: 45 };

  function update(partial: Partial<EntregaConfig>) {
    onChange({
      costo: value?.costo ?? { modo: "gratis" },
      tiempo,
      ...partial,
    });
  }

  return (
    <div className="mt-gap-sm flex flex-col gap-gap-sm rounded-xl border border-verde-100 bg-verde-50/40 p-gap-md">
      <p className="font-lv-display text-meta font-semibold uppercase tracking-[0.06em] text-verde-700">
        Configuración de domicilio
      </p>

      <div className="grid grid-cols-1 gap-gap-sm lg:grid-cols-2">
        <div className="flex flex-col gap-gap-xs">
          <Label>Costo de envío</Label>
          <Select
            value={modo}
            onValueChange={(v) => {
              const nuevoCosto =
                v === "gratis"
                  ? { modo: "gratis" as const }
                  : v === "consultar"
                    ? { modo: "consultar" as const }
                    : { modo: "fijo" as const, monto: 5, moneda: "USD" };
              update({ costo: nuevoCosto });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gratis">Gratis</SelectItem>
              <SelectItem value="fijo">Precio fijo</SelectItem>
              <SelectItem value="consultar">A consultar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {modo === "fijo" && (
          <>
            <div className="flex flex-col gap-gap-xs">
              <Label>Monto</Label>
              <Input
                type="number"
                min={0}
                step={0.5}
                className={INPUT}
                value={
                  value?.costo.modo === "fijo" ? value.costo.monto : ""
                }
                onChange={(e) =>
                  update({
                    costo: {
                      modo: "fijo",
                      monto: Number(e.target.value),
                      moneda:
                        value?.costo.modo === "fijo"
                          ? value.costo.moneda
                          : "USD",
                    },
                  })
                }
                placeholder="0"
              />
            </div>
            <div className="flex flex-col gap-gap-xs">
              <Label>Moneda</Label>
              <Select
                value={
                  value?.costo.modo === "fijo" ? value.costo.moneda : "USD"
                }
                onValueChange={(moneda) =>
                  update({
                    costo: {
                      modo: "fijo",
                      monto:
                        value?.costo.modo === "fijo" ? value.costo.monto : 0,
                      moneda,
                    },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["USD", "MLC", "CUP", "EUR"].map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        <div className="flex flex-col gap-gap-xs">
          <Label>Tiempo estimado (min)</Label>
          <div className="flex items-center gap-gap-xs">
            <Input
              type="number"
              min={1}
              className={INPUT}
              value={tiempo.min}
              onChange={(e) =>
                update({ tiempo: { ...tiempo, min: Number(e.target.value) } })
              }
              placeholder="20"
            />
            <span className="shrink-0 text-meta text-ink-soft/60">–</span>
            <Input
              type="number"
              min={1}
              className={INPUT}
              value={tiempo.max}
              onChange={(e) =>
                update({ tiempo: { ...tiempo, max: Number(e.target.value) } })
              }
              placeholder="45"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ComoComprarEditor({
  value,
  onChange,
}: {
  value: ComoComprar | null;
  onChange: (next: ComoComprar) => void;
}) {
  const v = value ?? { recoger: true, apartar: false };
  return (
    <div className="mt-gap-sm flex flex-col gap-gap-sm rounded-xl border border-verde-100 bg-verde-50/40 p-gap-md">
      <p className="font-lv-display text-meta font-semibold uppercase tracking-[0.06em] text-verde-700">
        Configuración de tienda
      </p>
      <Toggle
        checked={v.recoger}
        onChange={(r) => onChange({ ...v, recoger: r })}
        label={COPY.recoger}
      />
      <Toggle
        checked={v.apartar}
        onChange={(a) => onChange({ ...v, apartar: a })}
        label={COPY.apartarWhatsapp}
      />
    </div>
  );
}

function ComoAtiendeEditor({
  value,
  onChange,
}: {
  value: ComoAtiende | null;
  onChange: (next: ComoAtiende) => void;
}) {
  const v = value ?? { conCita: true, sinCita: false, aDomicilio: false };
  return (
    <div className="mt-gap-sm flex flex-col gap-gap-sm rounded-xl border border-verde-100 bg-verde-50/40 p-gap-md">
      <p className="font-lv-display text-meta font-semibold uppercase tracking-[0.06em] text-verde-700">
        Configuración de servicios
      </p>
      <Toggle
        checked={v.conCita}
        onChange={(c) => onChange({ ...v, conCita: c })}
        label={COPY.conCita}
      />
      <Toggle
        checked={v.sinCita}
        onChange={(c) => onChange({ ...v, sinCita: c })}
        label={COPY.sinCita}
      />
      <Toggle
        checked={v.aDomicilio}
        onChange={(c) => onChange({ ...v, aDomicilio: c })}
        label={COPY.aDomicilio}
      />
    </div>
  );
}

function EspecialDiaEditor({
  value,
  onChange,
}: {
  value: EspecialDelDia | null;
  onChange: (next: EspecialDelDia | null) => void;
}) {
  const activo = value !== null;
  const v = value ?? { titulo: "", precio: "", moneda: "CUP", hasta: "" };

  function update(partial: Partial<EspecialDelDia>) {
    onChange({ ...v, ...partial });
  }

  return (
    <div className="mt-gap-sm flex flex-col gap-gap-sm rounded-xl border border-verde-100 bg-verde-50/40 p-gap-md">
      <div className="flex items-center justify-between">
        <p className="font-lv-display text-meta font-semibold uppercase tracking-[0.06em] text-verde-700">
          {COPY.especialDelDia}
        </p>
        <Toggle
          checked={activo}
          onChange={(on) => onChange(on ? v : null)}
          label={activo ? "Activo" : "Inactivo"}
        />
      </div>
      {activo && (
        <div className="flex flex-col gap-gap-sm">
          <div className="flex flex-col gap-gap-xs">
            <Label htmlFor="especial-titulo">Título</Label>
            <Input
              id="especial-titulo"
              className={INPUT}
              value={v.titulo}
              onChange={(e) => update({ titulo: e.target.value })}
              placeholder="Ej: Combo del día"
              maxLength={60}
            />
          </div>
          <div className="grid grid-cols-2 gap-gap-sm">
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="especial-precio">Precio (texto)</Label>
              <Input
                id="especial-precio"
                className={INPUT}
                value={v.precio}
                onChange={(e) => update({ precio: e.target.value })}
                placeholder="Ej: 350 CUP"
                maxLength={40}
              />
            </div>
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="especial-hasta">Válido hasta</Label>
              <Input
                id="especial-hasta"
                type="date"
                className={INPUT}
                value={v.hasta}
                onChange={(e) => update({ hasta: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-col gap-gap-xs">
            <Label htmlFor="especial-desc">Descripción (opcional)</Label>
            <Input
              id="especial-desc"
              className={INPUT}
              value={v.descripcion ?? ""}
              onChange={(e) =>
                update({ descripcion: e.target.value || undefined })
              }
              placeholder="Breve descripción del especial"
              maxLength={120}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Selector de tipo de negocio + módulos activos + configuración por módulo.
 *
 * El tipo siembra los módulos recomendados cuando no hay ninguno activo y
 * el dueño elige por primera vez. Los módulos son independientes del tipo:
 * una cafetería puede activar domicilio aunque su tipo diga «local».
 */
export function ModulosEditor({
  tipoNegocio,
  onTipoChange,
  modulosActivos,
  onModulosChange,
  entrega,
  onEntregaChange,
  comoComprar,
  onComoComprarChange,
  comoAtiende,
  onComoAtiendeChange,
  especialDia,
  onEspecialDiaChange,
}: {
  tipoNegocio: TipoNegocio | null;
  onTipoChange: (v: TipoNegocio | null) => void;
  modulosActivos: ModuloFicha[];
  onModulosChange: (v: ModuloFicha[]) => void;
  entrega: EntregaConfig | null;
  onEntregaChange: (v: EntregaConfig | null) => void;
  comoComprar: ComoComprar | null;
  onComoComprarChange: (v: ComoComprar | null) => void;
  comoAtiende: ComoAtiende | null;
  onComoAtiendeChange: (v: ComoAtiende | null) => void;
  especialDia: EspecialDelDia | null;
  onEspecialDiaChange: (v: EspecialDelDia | null) => void;
}) {
  const activos = new Set(modulosActivos);

  function toggleModulo(m: ModuloFicha) {
    if (activos.has(m)) {
      onModulosChange(modulosActivos.filter((x) => x !== m));
    } else {
      onModulosChange([...modulosActivos, m]);
    }
  }

  return (
    <div className="flex flex-col gap-gap-lg">
      {/* Tipo principal */}
      <div className="flex flex-col gap-gap-xs">
        <Label htmlFor="tipo-negocio">Tipo de negocio</Label>
        <p className="text-meta text-ink-soft/70">
          Define los valores por defecto del catálogo y las acciones sugeridas.
          Puedes cambiarlo sin perder nada.
        </p>
        <div className="mt-gap-xs grid grid-cols-2 gap-[6px] lg:grid-cols-4">
          {TIPOS_NEGOCIO.map((tipo) => (
            <button
              key={tipo}
              type="button"
              aria-pressed={tipoNegocio === tipo}
              onClick={() => onTipoChange(tipoNegocio === tipo ? null : tipo)}
              className={cn(
                "flex flex-col rounded-xl border p-gap-sm text-left transition-colors duration-300 ease-outquint active:scale-[0.98]",
                tipoNegocio === tipo
                  ? "border-verde-400 bg-verde-50 text-verde-800"
                  : "border-ink/10 bg-white text-ink hover:border-verde-200 hover:bg-verde-50/50",
              )}
            >
              <span className="font-lv-display text-small font-bold">
                {TIPO_NEGOCIO_LABEL[tipo]}
              </span>
            </button>
          ))}
        </div>
        {tipoNegocio && (
          <button
            type="button"
            onClick={() => onTipoChange(null)}
            className="self-start font-lv-display text-meta text-ink-soft/60 hover:text-ink"
          >
            Quitar tipo
          </button>
        )}
      </div>

      {/* Módulos activos */}
      <div className="flex flex-col gap-gap-xs">
        <Label>Bloques de la ficha</Label>
        <p className="text-meta text-ink-soft/70">
          Cada bloque añade una sección a tu ficha. Puedes tener varios a la
          vez: una cafetería puede tener local y domicilio.
        </p>
        <div className="mt-gap-xs flex flex-col gap-gap-sm">
          {MODULOS_FICHA.map((m) => {
            const encendido = activos.has(m);
            return (
              <div key={m}>
                <button
                  type="button"
                  aria-pressed={encendido}
                  onClick={() => toggleModulo(m)}
                  className={cn(
                    "flex w-full items-center gap-gap-sm rounded-xl border p-gap-sm text-left transition-colors duration-300 ease-outquint",
                    encendido
                      ? "border-verde-400 bg-verde-50"
                      : "border-ink/10 bg-white hover:border-verde-200",
                  )}
                >
                  <span className="text-xl">{MODULO_ICONS[m]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-lv-display text-small font-bold text-ink">
                      {MODULO_FICHA_LABEL[m]}
                    </p>
                    <p className="text-meta text-ink-soft/60">
                      {m === "domicilio" && "Pedidos y envío a domicilio"}
                      {m === "local" && "Atención en el local, especial del día"}
                      {m === "tienda" && "Catálogo de productos, existencias"}
                      {m === "servicios" && "Servicios con o sin cita"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border-2 transition-colors",
                      encendido
                        ? "border-verde-500 bg-verde-500"
                        : "border-ink/20 bg-white",
                      "grid size-5 place-items-center",
                    )}
                  >
                    {encendido && (
                      <svg viewBox="0 0 12 12" fill="none" className="size-3">
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="white"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                </button>

                {/* Config inline del módulo cuando está encendido */}
                {encendido && m === "domicilio" && (
                  <EntregaSimpleEditor
                    value={entrega}
                    onChange={onEntregaChange}
                  />
                )}
                {encendido && m === "tienda" && (
                  <ComoComprarEditor
                    value={comoComprar}
                    onChange={onComoComprarChange}
                  />
                )}
                {encendido && m === "servicios" && (
                  <ComoAtiendeEditor
                    value={comoAtiende}
                    onChange={onComoAtiendeChange}
                  />
                )}
                {encendido && m === "local" && (
                  <EspecialDiaEditor
                    value={especialDia}
                    onChange={onEspecialDiaChange}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
