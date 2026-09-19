"use client";

import { cn } from "@/lib/utils";
import { CATEGORY_ICONS, CATEGORY_ICON_KEYS, resolveCategoryIcon } from "@/lib/category-icons";

/**
 * Rejilla de iconos para elegir. El mismo control en los tres sitios que
 * necesitan uno: la categoría en `/admin/categorias`, el negocio en el
 * formulario del admin y el negocio en el panel del dueño.
 *
 * Antes esto estaba escrito a mano dentro de `/admin/categorias`; con un solo
 * uso no valía la pena sacarlo, con tres sí.
 *
 * Sin `initial`/`animate` escalonado: con 30 iconos la cascada era un detalle,
 * con 81 es una fila de dos segundos y medio. La rejilla aparece entera.
 */
export function IconPicker({
  value,
  onChange,
  label = "Icono",
  preview,
}: {
  value: string;
  onChange: (icon: string) => void;
  /** Rótulo accesible de cada botón: «Icono Utensils». */
  label?: string;
  /** Qué se pinta al lado del icono en la vista previa. Sin él no hay fila. */
  preview?: string;
}) {
  const Selected = resolveCategoryIcon(value);

  return (
    <div className="flex flex-col gap-gap-sm">
      {/* Seis columnas en móvil: seis casillas de 44 px más los huecos piden
          294 px y en una pantalla de 320 quedan 296. Ya no cabe una más.
          44 px es el mínimo táctil, y esto se elige con el dedo. */}
      <div className="grid grid-cols-6 gap-[6px] sm:grid-cols-8 lg:grid-cols-10">
        {CATEGORY_ICON_KEYS.map((key) => {
          const Icon = CATEGORY_ICONS[key]!;
          const active = value === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              title={key}
              aria-label={`${label} ${key}`}
              aria-pressed={active}
              className={cn(
                "grid size-11 place-items-center rounded-2xl border transition-colors duration-500 ease-outquint",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40",
                active
                  ? "border-verde-400 bg-verde-400 text-verde-950"
                  : "border-ink/10 text-ink-soft/75 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600",
              )}
            >
              <Icon size={18} strokeWidth={1.8} />
            </button>
          );
        })}
      </div>

      {preview !== undefined && (
        <div className="flex items-center gap-gap-xs">
          <span className="text-meta text-ink-soft/75">Vista previa:</span>
          <span className="inline-flex items-center gap-2 text-small font-medium text-ink">
            <Selected size={18} strokeWidth={1.8} />
            {preview}
          </span>
        </div>
      )}
    </div>
  );
}
