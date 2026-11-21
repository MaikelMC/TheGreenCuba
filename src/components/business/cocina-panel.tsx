"use client";

/**
 * El horario de cocina, en Pedidos › Ajustes de pedidos.
 *
 * Aquí vivía también el bloque «Pausar cocina / Abrir cocina» bajo la lista de
 * pedidos. Pasó a la hoja «Estado del negocio» (`estado-negocio.tsx`), que se
 * abre desde la píldora de la barra y desde la franja de Pedidos: el mismo
 * `PATCH /api/places/{id}/cocina`, con la misma `actualizarPausa`.
 *
 * El horario se guarda solo: abrir o cerrar un día, añadir o quitar una franja
 * guardan al tocar; las horas, al salir del campo (nunca mientras se escribe).
 * Si falla, vuelve a lo último guardado y un aviso lo dice.
 */

import { useRef, useState } from "react";
import { ChefHat } from "lucide-react";
import { toast } from "sonner";
import { HorarioEditor } from "@/components/business/horario-editor";
import type { EntregaConfig } from "@/lib/ficha/entrega";
import type { Horario } from "@/lib/ficha/horario";
import { TarjetaAjuste } from "./ui/tarjeta";
import { AvisoGuardado, useEstadoGuardado } from "./ui/estado-guardado";

export function HorarioCocinaCard({
  placeId,
  entrega,
}: {
  placeId: string;
  entrega: EntregaConfig | null | undefined;
}) {
  const [horario, setHorario] = useState<Horario | null>(entrega?.horario ?? null);
  const { estado, guardar } = useEstadoGuardado();
  /* `actual` va por delante del estado de React: el clic de un botón del
     editor llega aquí, por burbujeo, antes del siguiente render. */
  const actual = useRef(horario);
  const guardado = useRef(JSON.stringify(horario));

  async function guardarSiCambio() {
    const siguiente = actual.current;
    const previo = guardado.current;
    if (JSON.stringify(siguiente) === previo) return;
    const ok = await guardar(async () => {
      try {
        const res = await fetch(`/api/places/${placeId}/cocina`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ horario: siguiente }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          toast.error(data?.error ?? "No se pudo guardar el horario: no se cambió nada.");
          return false;
        }
        return true;
      } catch {
        toast.error("No se pudo guardar el horario. Revisa la conexión: no se cambió nada.");
        return false;
      }
    });
    if (!ok) {
      const vuelta = JSON.parse(previo) as Horario | null;
      actual.current = vuelta;
      setHorario(vuelta);
      return;
    }
    guardado.current = JSON.stringify(siguiente);
  }

  return (
    <TarjetaAjuste
      icono={ChefHat}
      titulo="Horario de cocina"
      apoyo="Cuándo aceptas pedidos a domicilio. Sin horario, los aceptas siempre."
    >
      {/* Los botones del editor guardan al tocar; las horas, al salir del campo. */}
      <div
        className="mt-gap-md border-t border-ink/5 pt-gap-md"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button")) void guardarSiCambio();
        }}
        onBlur={(e) => {
          if ((e.target as HTMLElement).matches("input")) void guardarSiCambio();
        }}
      >
        <HorarioEditor
          value={horario}
          onChange={(next) => {
            actual.current = next;
            setHorario(next);
          }}
        />
        <div className="mt-gap-sm flex items-center justify-between gap-gap-sm">
          <p className="text-meta text-ink-soft/75">Se guarda solo.</p>
          <AvisoGuardado estado={estado} />
        </div>
      </div>
    </TarjetaAjuste>
  );
}
