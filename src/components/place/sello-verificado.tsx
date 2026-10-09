import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * El sello de negocio verificado.
 *
 * Un componente porque se pinta en dos sitios de la ficha —la franja de datos de
 * escritorio y el bloque de móvil— y con dos copias el día que cambie el icono o
 * el color cambiará en una sola.
 *
 * **La decisión no vive aquí.** El componente no comprueba nada: recibe el sí o
 * el no ya resuelto y se limita a pintar. Quien decide es el servidor al mapear
 * la fila —la administración verificó **y** el plan incluye la función—, porque
 * hacerlo aquí obligaría a que el plan de cada negocio viajara por ficha hasta
 * el navegador.
 */
export function SelloVerificado({ className }: { className?: string }) {
  return (
    <span
      title="La administración de La Verde comprobó este negocio"
      className={cn(
        "inline-flex items-center gap-[4px] rounded-full border border-verde-200 bg-verde-50 px-[10px] py-[3px] font-lv-display text-xs font-semibold uppercase tracking-[0.06em] text-verde-700",
        className,
      )}
    >
      <BadgeCheck size={12} strokeWidth={2.4} className="shrink-0" />
      Verificado
    </span>
  );
}
