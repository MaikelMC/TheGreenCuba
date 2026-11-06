"use client";

import { cn } from "@/lib/utils";
import { ATRIBUTOS, type AtributoClave } from "@/lib/ficha/atributos";
import { familiaDe, type TipoNegocio } from "@/lib/ficha/tipos";
import { resolveCategoryIcon } from "@/lib/category-icons";

/**
 * Chips de atributos del negocio.
 *
 * El catálogo completo está en `@/lib/ficha/atributos`. Los atributos se
 * sugieren por tipo pero no están restringidos: una tienda puede tener WiFi.
 * Se muestran en el orden del catálogo, agrupados por los que ya tiene el
 * negocio. Sin tipo se enseñan todos.
 */
export function AtributosChips({
  value,
  onChange,
  tipoNegocio,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  tipoNegocio?: TipoNegocio | null;
}) {
  const activos = new Set(value);

  function toggle(clave: AtributoClave) {
    if (activos.has(clave)) {
      onChange(value.filter((c) => c !== clave));
    } else {
      onChange([...value, clave]);
    }
  }

  /* Orden: atributos sugeridos para este tipo primero, el resto después. */
  const sugeridos = tipoNegocio
    ? ATRIBUTOS.filter((a) => (a.tipos as readonly string[]).includes(familiaDe(tipoNegocio))).map((a) => a.clave)
    : [];
  const ordenados = [
    ...ATRIBUTOS.filter((a) => sugeridos.includes(a.clave)),
    ...ATRIBUTOS.filter((a) => !sugeridos.includes(a.clave)),
  ];

  return (
    <div className="flex flex-wrap gap-[6px]">
      {ordenados.map((atributo) => {
        const activo = activos.has(atributo.clave);
        const Icono = resolveCategoryIcon(atributo.icono);
        return (
          <button
            key={atributo.clave}
            type="button"
            onClick={() => toggle(atributo.clave)}
            aria-pressed={activo}
            className={cn(
              "inline-flex h-8 cursor-pointer items-center gap-[5px] rounded-full border px-[10px] font-lv-display text-meta font-semibold transition-colors duration-300 ease-outquint active:scale-[0.98]",
              activo
                ? "border-verde-400 bg-verde-400 text-verde-950"
                : "border-ink/10 bg-white text-ink-soft/75 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600",
            )}
          >
            <Icono size={13} strokeWidth={1.8} />
            {atributo.label}
          </button>
        );
      })}
    </div>
  );
}
