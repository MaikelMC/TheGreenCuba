"use client";

import { useState } from "react";
import { ChefHat, Clock, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { estadoCocina } from "@/lib/ficha/cocina";
import { HorarioEditor } from "@/components/business/horario-editor";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { EntregaConfig } from "@/lib/ficha/entrega";
import type { Horario } from "@/lib/ficha/horario";

const MOTIVOS = [
  { id: "luz", label: "Sin luz" },
  { id: "inventario", label: "Sin inventario" },
  { id: "personal", label: "Sin personal" },
  { id: "otro", label: "Otro motivo" },
];

/** Medianoche del próximo día en Havana (aprox: UTC-5). */
function mananaHavana(ahora: number): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Havana",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date(ahora));
  const y = Number(partes.find((p) => p.type === "year")?.value);
  const m = Number(partes.find((p) => p.type === "month")?.value);
  const d = Number(partes.find((p) => p.type === "day")?.value);
  /* Medianoche Havana ≈ 05:00 UTC (zona UTC-5). */
  return Date.UTC(y, m - 1, d + 1, 5, 0, 0);
}

export function CocinaPanel({
  placeId,
  entrega,
  placeHorario,
  puedeAtender,
  puedeEditarFicha,
}: {
  placeId: string;
  entrega: EntregaConfig | null | undefined;
  placeHorario: Horario | null | undefined;
  puedeAtender: boolean;
  puedeEditarFicha: boolean;
}) {
  const [entregaLocal, setEntregaLocal] = useState<EntregaConfig | null>(
    entrega ?? null,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  /* Horario editor — estado local separado con botón explícito de guardar. */
  const [horarioLocal, setHorarioLocal] = useState<Horario | null>(
    entregaLocal?.horario ?? null,
  );
  const [horarioSuciо, setHorarioSucio] = useState(false);
  const [guardandoHorario, setGuardandoHorario] = useState(false);

  const estadoActual = estadoCocina(entregaLocal, placeHorario);
  const abierta = estadoActual.abierta;

  async function abrir() {
    if (guardando) return;
    setGuardando(true);
    try {
      const res = await fetch(`/api/places/${placeId}/cocina`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pausa: null }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "No se pudo abrir la cocina.");
        return;
      }
      setEntregaLocal((prev) => {
        if (!prev) return prev;
        const { pausa: _, ...resto } = prev;
        return resto;
      });
      toast.success("Cocina abierta.");
    } catch {
      toast.error("No se pudo abrir la cocina. Revisa la conexión.");
    } finally {
      setGuardando(false);
    }
  }

  async function cerrar(duracion: "1h" | "2h" | "manana" | "indefinido") {
    if (guardando) return;
    setGuardando(true);
    setSheetOpen(false);

    const ahora = Date.now();
    const hasta: number | null =
      duracion === "1h"
        ? ahora + 60 * 60_000
        : duracion === "2h"
          ? ahora + 2 * 60 * 60_000
          : duracion === "manana"
            ? mananaHavana(ahora)
            : null;

    const pausa = {
      desde: ahora,
      hasta,
      ...(motivo ? { motivo } : {}),
    };

    try {
      const res = await fetch(`/api/places/${placeId}/cocina`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pausa }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "No se pudo pausar la cocina.");
        setSheetOpen(true);
        return;
      }
      setEntregaLocal((prev) => {
        const base: EntregaConfig = prev ?? {
          costo: { modo: "consultar" },
          tiempo: { min: 0, max: 0 },
        };
        return { ...base, pausa };
      });
      setMotivo("");
      toast.success("Cocina pausada.");
    } catch {
      toast.error("No se pudo pausar la cocina. Revisa la conexión.");
      setSheetOpen(true);
    } finally {
      setGuardando(false);
    }
  }

  async function guardarHorario() {
    if (guardandoHorario) return;
    setGuardandoHorario(true);
    try {
      const res = await fetch(`/api/places/${placeId}/cocina`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horario: horarioLocal }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "No se pudo guardar el horario.");
        return;
      }
      setEntregaLocal((prev) => {
        const base: EntregaConfig = prev ?? {
          costo: { modo: "consultar" },
          tiempo: { min: 0, max: 0 },
        };
        return horarioLocal
          ? { ...base, horario: horarioLocal }
          : (({ horario: _, ...r }) => r)(base);
      });
      setHorarioSucio(false);
      toast.success("Horario de cocina guardado.");
    } catch {
      toast.error("No se pudo guardar. Revisa la conexión.");
    } finally {
      setGuardandoHorario(false);
    }
  }

  return (
    <section className="rounded-2xl border border-ink/5 bg-white p-gap-md">
      {/* Estado y botón principal */}
      <div className="flex flex-wrap items-center justify-between gap-gap-sm">
        <div className="flex items-center gap-gap-sm">
          <ChefHat
            size={18}
            strokeWidth={1.8}
            className={abierta ? "text-verde-600" : "text-amber-500"}
          />
          <div>
            <h2 className="font-lv-display text-body font-semibold text-ink">
              {abierta ? "Cocina abierta" : "Cocina cerrada"}
            </h2>
            <p className="text-meta text-ink-soft/75">{estadoActual.texto}</p>
          </div>
        </div>

        {puedeAtender &&
          (abierta ? (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              disabled={guardando}
              className="inline-flex h-10 cursor-pointer items-center gap-[6px] rounded-full border border-amber-200 bg-amber-50 px-gap-sm font-lv-display text-meta font-semibold text-amber-700 transition-colors duration-500 ease-outquint hover:bg-amber-100 disabled:pointer-events-none disabled:opacity-50"
            >
              {guardando ? (
                <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />
              ) : (
                <Clock size={14} strokeWidth={1.8} />
              )}
              Pausar cocina
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void abrir()}
              disabled={guardando}
              className="inline-flex h-10 cursor-pointer items-center gap-[6px] rounded-full bg-verde-400 px-gap-sm font-lv-display text-meta font-semibold text-verde-950 shadow-primary-halo transition-colors duration-500 ease-outquint hover:bg-verde-300 disabled:pointer-events-none disabled:opacity-50"
            >
              {guardando ? (
                <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />
              ) : (
                <ChefHat size={14} strokeWidth={1.8} />
              )}
              Abrir cocina
            </button>
          ))}
      </div>

      {/* Horario recurrente — solo con permiso de ficha */}
      {puedeEditarFicha && (
        <div className="mt-gap-md border-t border-ink/5 pt-gap-md">
          <div className="mb-gap-sm flex items-center justify-between gap-gap-sm">
            <div>
              <p className="font-lv-display text-small font-semibold text-ink">
                Horario de cocina
              </p>
              <p className="text-meta text-ink-soft/75">
                Sin horario, acepta pedidos siempre.
              </p>
            </div>
            {horarioSuciо && (
              <button
                type="button"
                onClick={() => void guardarHorario()}
                disabled={guardandoHorario}
                className="inline-flex h-9 cursor-pointer items-center gap-[6px] rounded-full bg-verde-400 px-gap-sm font-lv-display text-meta font-semibold text-verde-950 shadow-primary-halo transition-colors duration-500 ease-outquint hover:bg-verde-300 disabled:pointer-events-none disabled:opacity-50"
              >
                {guardandoHorario ? (
                  <Loader2 size={13} strokeWidth={1.8} className="animate-spin" />
                ) : (
                  <Save size={13} strokeWidth={1.8} />
                )}
                Guardar
              </button>
            )}
          </div>
          <HorarioEditor
            value={horarioLocal}
            onChange={(next) => {
              setHorarioLocal(next);
              setHorarioSucio(true);
            }}
          />
        </div>
      )}

      {/* Sheet de pausa */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Pausar la cocina</SheetTitle>
            <SheetDescription>
              Los clientes ven que no hay pedidos ahora. El carrito sigue
              visible.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-gap-md space-y-gap-sm">
            {/* Motivo chips */}
            <div className="flex flex-wrap gap-gap-xs">
              {MOTIVOS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMotivo(motivo === m.label ? "" : m.label)}
                  className={cn(
                    "rounded-full border px-gap-sm py-[6px] font-lv-display text-meta font-semibold transition-colors duration-300 ease-outquint",
                    motivo === m.label
                      ? "border-amber-300 bg-amber-100 text-amber-800"
                      : "border-ink/10 bg-white text-ink-soft hover:border-ink/20",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Opciones de duración */}
            <div className="grid grid-cols-2 gap-gap-sm">
              {(
                [
                  { id: "1h", label: "1 hora" },
                  { id: "2h", label: "2 horas" },
                  { id: "manana", label: "Hasta mañana" },
                  { id: "indefinido", label: "Sin límite" },
                ] as const
              ).map((op) => (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => void cerrar(op.id)}
                  disabled={guardando}
                  className="flex h-14 cursor-pointer flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 font-lv-display text-small font-semibold text-amber-800 transition-colors duration-300 ease-outquint hover:bg-amber-100 disabled:pointer-events-none disabled:opacity-50"
                >
                  {op.label}
                </button>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
