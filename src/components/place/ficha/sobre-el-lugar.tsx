"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { COPY } from "@/config/ficha";
import { cn } from "@/lib/utils";

const LINE_HEIGHT = 1.625;
const COLAPSADO = `${LINE_HEIGHT * 4}em`;
const EXPANDIDO = "48em";
const MIN_PARA_BOTON = 180;

const BTN_OUTLINE =
  "inline-flex h-10 items-center justify-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-md font-lv-display text-meta font-semibold text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600";

/**
 * «Sobre este lugar»: el resumen corto y la descripción.
 *
 * El resumen va delante porque es lo que el dueño decidió que se leyera primero;
 * la descripción larga se recorta a cuatro renglones y se abre con el botón.
 * Antes, cuando no había descripción, esta sección inventaba «Negocio agregado
 * por su dueño…»: ahora, si no hay nada que contar, no se pinta.
 */
export function SobreElLugar({
  shortDescription,
  description,
  className,
}: {
  shortDescription?: string;
  description?: string;
  className?: string;
}) {
  const [expandido, setExpandido] = useState(false);

  const corto = shortDescription?.trim() ?? "";
  const largo = description?.trim() ?? "";
  const mismoTexto = corto && largo && corto === largo;
  const principal = corto || largo;
  const secundario = mismoTexto ? "" : largo;

  if (!principal) return null;

  const puedeDesplegar = secundario.length > MIN_PARA_BOTON;

  return (
    <section className={cn("min-w-0", className)}>
      <h2 className="mb-gap-sm font-lv-display text-h3 font-bold text-ink">
        {COPY.sobreElLugar}
      </h2>

      {corto && (
        <p className="text-pretty text-lead leading-relaxed text-ink">
          {corto}
        </p>
      )}

      {secundario && (
        <>
          <p
            className="mt-gap-sm overflow-hidden whitespace-pre-wrap text-body leading-relaxed text-ink-soft/90 transition-[max-height] duration-500 ease-outquint"
            style={{
              maxHeight: expandido || !puedeDesplegar ? EXPANDIDO : COLAPSADO,
              lineHeight: LINE_HEIGHT,
            }}
          >
            {secundario}
          </p>

          {puedeDesplegar && (
            <button
              type="button"
              onClick={() => setExpandido((prev) => !prev)}
              aria-expanded={expandido}
              className={cn(BTN_OUTLINE, "mt-gap-sm")}
            >
              {expandido ? COPY.verMenos : COPY.verMas}
              <ChevronDown
                size={15}
                strokeWidth={1.8}
                className={cn(
                  "transition-transform duration-500 ease-outquint",
                  expandido && "rotate-180",
                )}
              />
            </button>
          )}
        </>
      )}
    </section>
  );
}
