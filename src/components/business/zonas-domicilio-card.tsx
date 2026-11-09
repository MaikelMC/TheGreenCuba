"use client";

import { useState } from "react";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { bloqueoDe, type Funcion } from "@/lib/plans";
import { useCatalogo } from "@/providers/catalogo-provider";
import { FormSection } from "@/components/business/form-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { EntregaConfig, ParcheEntrega, ZonaEntrega } from "@/lib/ficha/entrega";

interface ZonasDomicilioCardProps {
  placeId: string;
  funciones: Funcion[];
  entregaInicial?: EntregaConfig | null;
}

const MONEDAS = ["CUP", "USD", "MLC"] as const;
const MAX_ZONAS = 40;

/** Genera un id corto para una zona nueva. */
function nuevoId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function fmtMonto(monto: number, moneda: string): string {
  return `${monto % 1 === 0 ? monto.toFixed(0) : monto.toFixed(2)} ${moneda}`;
}

/** Interruptor de fila, igual que el del panel. */
function Switch({
  checked,
  onToggle,
  label,
  disabled,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-300 ease-outquint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40 disabled:pointer-events-none disabled:opacity-50",
        checked ? "bg-verde-400" : "bg-ink/15",
      )}
    >
      <span
        className={cn(
          "zonas-switch-thumb pointer-events-none block size-5 rounded-full bg-white shadow-sm transition-transform duration-300 ease-outquint",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}

export function ZonasDomicilioCard({
  placeId,
  funciones,
  entregaInicial,
}: ZonasDomicilioCardProps) {
  const cat = useCatalogo();
  const bloqueo = bloqueoDe(funciones, "zonas_domicilio", cat);

  /* ── Estado ──────────────────────────────────────────────────────────── */
  const zonasModo = entregaInicial?.costo.modo === "zonas" ? entregaInicial.costo.zonas : [];

  const [recogida, setRecogida] = useState(entregaInicial?.recogida ?? false);
  const [domicilio, setDomicilio] = useState(entregaInicial?.domicilio ?? false);
  const [zonas, setZonas] = useState<ZonaEntrega[]>(zonasModo);
  const [notaEntrega, setNotaEntrega] = useState(entregaInicial?.notaEntrega ?? "");
  const [pedidoMinStr, setPedidoMinStr] = useState(
    entregaInicial?.pedidoMinimo ? String(entregaInicial.pedidoMinimo.monto) : "",
  );
  const [pedidoMinMoneda, setPedidoMinMoneda] = useState(
    entregaInicial?.pedidoMinimo?.moneda ?? "CUP",
  );
  const [guardando, setGuardando] = useState(false);

  /* ── Sheet de edición de zona ────────────────────────────────────────── */
  const [sheetAbierto, setSheetAbierto] = useState(false);
  const [zonaEditando, setZonaEditando] = useState<ZonaEntrega | null>(null);
  /* Campos del formulario de zona */
  const [znNombre, setZnNombre] = useState("");
  const [znMonto, setZnMonto] = useState("");
  const [znMoneda, setZnMoneda] = useState<string>("CUP");
  const [znActiva, setZnActiva] = useState(true);

  function abrirNuevaZona() {
    setZonaEditando(null);
    setZnNombre("");
    setZnMonto("");
    setZnMoneda("CUP");
    setZnActiva(true);
    setSheetAbierto(true);
  }

  function abrirEditarZona(zona: ZonaEntrega) {
    setZonaEditando(zona);
    setZnNombre(zona.nombre);
    setZnMonto(String(zona.monto));
    setZnMoneda(zona.moneda);
    setZnActiva(zona.activa);
    setSheetAbierto(true);
  }

  function guardarZona() {
    const nombre = znNombre.trim().slice(0, 60);
    const monto = parseFloat(znMonto.replace(",", "."));
    if (!nombre || !Number.isFinite(monto) || monto < 0) {
      toast.error("El nombre y el costo son obligatorios.");
      return;
    }
    if (zonaEditando) {
      setZonas((prev) =>
        prev.map((z) =>
          z.id === zonaEditando.id
            ? { ...z, nombre, monto, moneda: znMoneda, activa: znActiva }
            : z,
        ),
      );
    } else {
      if (zonas.length >= MAX_ZONAS) {
        toast.error(`El máximo es ${MAX_ZONAS} zonas.`);
        return;
      }
      setZonas((prev) => [...prev, { id: nuevoId(), nombre, monto, moneda: znMoneda, activa: znActiva }]);
    }
    setSheetAbierto(false);
  }

  function borrarZona(id: string) {
    setZonas((prev) => prev.filter((z) => z.id !== id));
  }

  /* ── Guardar ─────────────────────────────────────────────────────────── */
  async function guardar() {
    if (guardando) return;
    setGuardando(true);
    const pedidoMinimo =
      pedidoMinStr.trim()
        ? (() => {
            const v = parseFloat(pedidoMinStr.replace(",", "."));
            return Number.isFinite(v) && v >= 0
              ? { monto: v, moneda: pedidoMinMoneda }
              : null;
          })()
        : null;

    /* `null` explícito en lo opcional: con el merge del servidor, una clave
       ausente se conserva, así que vaciar el mínimo o la nota tiene que viajar
       como "borra esto" y no como "no lo toques". */
    const payload: ParcheEntrega = {
      costo:
        domicilio && zonas.length > 0
          ? { modo: "zonas", zonas, moneda: zonas[0]!.moneda }
          : { modo: "consultar" },
      tiempo: entregaInicial?.tiempo ?? { min: 0, max: 0 },
      recogida,
      domicilio,
      pedidoMinimo,
      notaEntrega: notaEntrega.trim() ? notaEntrega.trim().slice(0, 300) : null,
    };

    try {
      const res = await fetch(`/api/places/${placeId}/entrega`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "No se pudo guardar.");
        return;
      }
      toast.success("Zonas guardadas.");
    } catch {
      toast.error("No se pudo guardar. Revisa la conexión.");
    } finally {
      setGuardando(false);
    }
  }

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <>
      <FormSection
        title="Domicilio y zonas"
        icon={<MapPin size={16} />}
      >
      {bloqueo ? (
        <div className="flex items-center gap-gap-sm rounded-lv bg-muted/50 px-gap-md py-gap-sm">
          <span className="text-small text-muted-foreground">🔒 {bloqueo}</span>
        </div>
      ) : (
        <>
        <div className="flex flex-col gap-gap-sm">
          <div className="flex items-center justify-between gap-gap-sm">
            <span className="text-small text-ink">Pueden pasar a recoger</span>
            <Switch
              checked={recogida}
              onToggle={() => setRecogida((v) => !v)}
              label="Pueden pasar a recoger"
            />
          </div>
          <div className="flex items-center justify-between gap-gap-sm">
            <span className="text-small text-ink">Hago entregas a domicilio</span>
            <Switch
              checked={domicilio}
              onToggle={() => setDomicilio((v) => !v)}
              label="Hago entregas a domicilio"
            />
          </div>
        </div>

        {/* ── Zonas ─────────────────────────────────────────────────────── */}
        {domicilio && (
          <div className="mt-gap-md flex flex-col gap-gap-sm">
            {zonas.length === 0 ? (
              <p className="text-small text-ink-soft/75">
                Todavía no tienes zonas. Añade los barrios a los que entregas y cuánto cobras.
              </p>
            ) : (
              <ul className="flex flex-col gap-[6px]">
                {zonas.map((zona) => (
                  <li
                    key={zona.id}
                    className="flex items-center gap-gap-sm rounded-xl border border-ink/5 bg-sand-deep px-gap-sm py-[10px]"
                  >
                    <MapPin size={15} strokeWidth={1.8} className="shrink-0 text-verde-600" />
                    <div className="min-w-0 flex-1">
                      <span className={cn("text-small font-semibold", !zona.activa && "text-ink-soft/60")}>
                        {zona.nombre}
                      </span>
                      <span className="ml-gap-xs text-meta text-ink-soft/75">
                        {zona.monto === 0 ? "Gratis" : fmtMonto(zona.monto, zona.moneda)}
                      </span>
                      {!zona.activa && (
                        <span className="ml-gap-xs text-meta text-ink-soft/50">· inactiva</span>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label={`Editar ${zona.nombre}`}
                      onClick={() => abrirEditarZona(zona)}
                      className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-ink-soft/60 transition-colors duration-300 ease-outquint hover:bg-white hover:text-ink"
                    >
                      <Pencil size={14} strokeWidth={1.8} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Borrar ${zona.nombre}`}
                      onClick={() => borrarZona(zona.id)}
                      className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-ink-soft/60 transition-colors duration-300 ease-outquint hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={14} strokeWidth={1.8} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {zonas.length < MAX_ZONAS && (
              <button
                type="button"
                onClick={abrirNuevaZona}
                className="zonas-add-btn inline-flex h-10 w-fit cursor-pointer items-center gap-gap-xs rounded-full border border-dashed border-verde-300 px-gap-sm font-lv-display text-meta font-semibold text-verde-700 transition-colors duration-300 ease-outquint hover:border-verde-400 hover:bg-verde-50"
              >
                <Plus size={15} strokeWidth={2} />
                Añadir zona
              </button>
            )}
          </div>
        )}

        {/* ── Opcionales ────────────────────────────────────────────────── */}
        <div className="mt-gap-md flex flex-col gap-gap-md">
          <div className="flex items-end gap-gap-sm">
            <div className="flex-1">
              <Label htmlFor="pedidoMinimo">Pedido mínimo (opcional)</Label>
              <Input
                id="pedidoMinimo"
                type="text"
                inputMode="decimal"
                placeholder="p. ej. 500"
                value={pedidoMinStr}
                onChange={(e) => setPedidoMinStr(e.target.value)}
                className="mt-[4px]"
              />
            </div>
            <select
              value={pedidoMinMoneda}
              onChange={(e) => setPedidoMinMoneda(e.target.value)}
              aria-label="Moneda del pedido mínimo"
              className="zonas-select h-10 rounded-xl border border-ink/10 bg-white px-gap-sm text-small text-ink focus:border-verde-400 focus:outline-none sm:w-24"
            >
              {MONEDAS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="notaEntrega">Nota de entrega (opcional)</Label>
            <Input
              id="notaEntrega"
              type="text"
              placeholder="Entregamos de 10 a. m. a 6 p. m."
              value={notaEntrega}
              onChange={(e) => setNotaEntrega(e.target.value)}
              maxLength={300}
              className="mt-[4px]"
            />
          </div>
        </div>

        {/* ── Guardar ───────────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={guardando}
          className="mt-gap-sm inline-flex h-10 w-fit cursor-pointer items-center gap-gap-xs rounded-full bg-verde-400 px-gap-md font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-colors duration-300 ease-outquint hover:bg-verde-300 disabled:pointer-events-none disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar zonas"}
        </button>
        </>
      )}
      </FormSection>

      {/* ── Sheet: añadir / editar zona ──────────────────────────────────── */}
      <Sheet open={sheetAbierto} onOpenChange={setSheetAbierto}>
        <SheetContent
          side="bottom"
          className="zonas-sheet mx-auto flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-3xl border-ink/5 p-gap-md"
        >
          <SheetHeader>
            <SheetTitle className="text-left">
              {zonaEditando ? "Editar zona" : "Nueva zona"}
            </SheetTitle>
            <SheetDescription className="text-left">
              El nombre que ven los clientes y cuánto cobras por llevar el pedido allí.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-gap-md flex flex-col gap-gap-md overflow-y-auto pb-safe">
            <div>
              <Label htmlFor="zn-nombre">Nombre del barrio o reparto</Label>
              <Input
                id="zn-nombre"
                type="text"
                placeholder="Vista Alegre, Reparto Sueño…"
                value={znNombre}
                onChange={(e) => setZnNombre(e.target.value)}
                maxLength={60}
                className="mt-[4px]"
                autoFocus
              />
            </div>

            <div className="flex items-end gap-gap-sm">
              <div className="flex-1">
                <Label htmlFor="zn-monto">Costo de envío (0 = gratis)</Label>
                <Input
                  id="zn-monto"
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={znMonto}
                  onChange={(e) => setZnMonto(e.target.value)}
                  className="mt-[4px]"
                />
              </div>
              <select
                value={znMoneda}
                onChange={(e) => setZnMoneda(e.target.value)}
                aria-label="Moneda del costo"
                className="zonas-select h-10 rounded-xl border border-ink/10 bg-white px-gap-sm text-small text-ink focus:border-verde-400 focus:outline-none sm:w-24"
              >
                {MONEDAS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-gap-sm">
              <span className="text-small text-ink">Zona activa</span>
              <Switch
                checked={znActiva}
                onToggle={() => setZnActiva((v) => !v)}
                label="Zona activa"
              />
            </div>

            <button
              type="button"
              onClick={guardarZona}
              className="inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-full bg-verde-400 font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-colors duration-300 ease-outquint hover:bg-verde-300"
            >
              {zonaEditando ? "Guardar cambios" : "Añadir zona"}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
