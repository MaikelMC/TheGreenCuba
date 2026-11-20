"use client";

/**
 * El horario de cocina, en Pedidos › Ajustes de pedidos.
 *
 * Aquí vivía también el bloque «Pausar cocina / Abrir cocina» bajo la lista de
 * pedidos. Pasó a la hoja «Estado del negocio» (`estado-negocio.tsx`), que se
 * abre desde la píldora de la barra y desde la franja de Pedidos: el mismo
 * `PATCH /api/places/{id}/cocina`, con la misma `actualizarPausa`.
 *
 * El horario se guarda con su botón: una semana de franjas se escribe a
 * trozos. Mientras haya cambios sin guardar, la guardia de salida pregunta.
 */

import { useEffect, useState } from "react";
import { ChefHat, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { HorarioEditor } from "@/components/business/horario-editor";
import { registrarGuarda } from "@/lib/unsaved-guard";
import type { EntregaConfig } from "@/lib/ficha/entrega";
import type { Horario } from "@/lib/ficha/horario";
import { TarjetaAjuste } from "./ui/tarjeta";
import { BotonPrimario } from "./ui/botones";

export function HorarioCocinaCard({
  placeId,
  entrega,
}: {
  placeId: string;
  entrega: EntregaConfig | null | undefined;
}) {
  const [horario, setHorario] = useState<Horario | null>(entrega?.horario ?? null);
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!sucio) return;
    const bajaGuarda = registrarGuarda(() =>
      window.confirm(
        "Tienes el horario de cocina sin guardar. Si sales ahora se descarta. ¿Salir igual?",
      ),
    );
    return bajaGuarda;
  }, [sucio]);

  async function guardar() {
    if (guardando) return;
    setGuardando(true);
    try {
      const res = await fetch(`/api/places/${placeId}/cocina`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horario }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? "No se pudo guardar el horario.");
        return;
      }
      setSucio(false);
      toast.success("Horario de cocina guardado.");
    } catch {
      toast.error("No se pudo guardar. Revisa la conexión.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <TarjetaAjuste
      icono={ChefHat}
      titulo="Horario de cocina"
      apoyo="Cuándo aceptas pedidos a domicilio. Sin horario, los aceptas siempre."
    >
      <div className="mt-gap-md border-t border-ink/5 pt-gap-md">
        <HorarioEditor
          value={horario}
          onChange={(next) => {
            setHorario(next);
            setSucio(true);
          }}
        />
        {sucio && (
          <BotonPrimario
            onClick={() => void guardar()}
            disabled={guardando}
            className="mt-gap-md"
          >
            {guardando ? (
              <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
            ) : (
              <Save size={16} strokeWidth={1.8} />
            )}
            {guardando ? "Guardando…" : "Guardar horario"}
          </BotonPrimario>
        )}
      </div>
    </TarjetaAjuste>
  );
}
