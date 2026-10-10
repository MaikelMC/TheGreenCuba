import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * La insignia «Top del mes».
 *
 * Como `SelloVerificado`, es un componente —se pinta en la ficha de escritorio,
 * en el bloque de móvil y en cada tarjeta del catálogo— y **no decide nada**:
 * recibe ya resuelto si el negocio está en el podio y se limita a pintar. Quien
 * decide es el servidor al mapear la fila, contra `ranking_mensual`, para que el
 * ranking no tenga que viajar hasta el navegador.
 *
 * El dorado es el mismo tono cálido de la marca (`sand`), no un amarillo de
 * semáforo: premia sin gritar.
 */
export function TopDelMes({ className }: { className?: string }) {
  return (
    <span
      title="Uno de los negocios más visitados de su categoría el mes pasado"
      className={cn(
        "inline-flex items-center gap-[4px] rounded-full border border-sand-deep bg-sand px-[10px] py-[3px] font-lv-display text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft",
        className,
      )}
    >
      <Trophy size={12} strokeWidth={2.4} className="shrink-0 text-verde-600" />
      Top del mes
    </span>
  );
}
