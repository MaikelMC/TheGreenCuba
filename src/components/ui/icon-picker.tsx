"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_ICONS, CATEGORY_ICON_KEYS, resolveCategoryIcon } from "@/lib/category-icons";

/**
 * Rejilla de iconos para elegir. El mismo control en los tres sitios que
 * necesitan uno: la categoría en `/admin/categorias`, el negocio en el
 * formulario del admin y el negocio en el panel del dueño.
 *
 * Va dentro de un `<details>` nativo y no abierto siempre: 81 casillas son
 * catorce filas, más de 600 px, y en un formulario eso empujaba el botón de
 * guardar fuera de la pantalla antes de que nadie hubiera elegido nada. Plegado
 * mide una fila; al abrirse la rejilla se desplaza dentro de una caja de altura
 * fija en vez de alargar la página. El pliegue, el teclado y el foco los lleva
 * el navegador.
 *
 * La fila plegada hace de vista previa —icono y nombre—, así que ya no hace
 * falta la línea de «Vista previa» que iba debajo.
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
  /** Qué se pinta al lado del icono en la fila plegada. */
  preview?: string;
}) {
  const Selected = resolveCategoryIcon(value);

  return (
    <details className="group rounded-xl border border-ink/10 bg-white open:border-verde-300">
      <summary
        className={cn(
          "flex h-11 cursor-pointer list-none items-center gap-gap-xs rounded-xl px-3 text-small text-ink",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/30",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-sand text-verde-600">
          <Selected size={16} strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1 truncate">{preview || value}</span>
        <span className="shrink-0 text-meta font-semibold text-ink-soft/75">
          Elegir
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.8}
          className="shrink-0 text-ink-soft/75 transition-transform duration-300 ease-outquint group-open:rotate-180"
          aria-hidden
        />
      </summary>

      {/* Seis columnas en móvil: seis casillas de 40 px más los huecos piden
          260 px y en una pantalla de 320 quedan 296. Cabe holgado.
          40 px sigue por encima del mínimo táctil de WCAG 2.2 (24 px) y deja
          la caja en 160 px de alto frente a los 224 que ocupaba antes. */}
      <div className="max-h-40 overflow-y-auto overscroll-contain border-t border-ink/5 p-[6px]">
        <div className="grid grid-cols-6 gap-[4px] sm:grid-cols-8">
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
                  "grid size-10 place-items-center rounded-xl border transition-colors duration-500 ease-outquint",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40",
                  active
                    ? "border-verde-400 bg-verde-400 text-verde-950"
                    : "border-ink/10 text-ink-soft/75 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600",
                )}
              >
                <Icon size={16} strokeWidth={1.8} />
              </button>
            );
          })}
        </div>
      </div>
    </details>
  );
}
