"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { MenuItem } from "./menu-item";

/**
 * La carta con navegación por categorías.
 *
 * Es de cliente y la carta no: la carta entera se resuelve en el servidor y este
 * es el único trozo que necesita estado —la categoría elegida—. Los productos
 * llegan ya resueltos por props, así que filtrar aquí no cuesta ninguna
 * petición.
 *
 * Con cero o una categoría no se pinta ninguna barra: un chip «Todo» solo, o un
 * chip que no filtra nada, es mobiliario. La carta se lee igual que antes.
 */

/* La forma de una entrada, sacada del propio `MenuItem` en vez de repetida: si
   el ítem gana un campo, esto lo gana solo. */
type Entry = React.ComponentProps<typeof MenuItem>;

/** El valor del chip «Todo». */
const ALL = "__all__";

export function CartaMenu({ items }: { items: Entry[] }) {
  /* El orden es el de la carta y no alfabético: el dueño escribe «Entrantes»
     antes que «Postres» porque así se come, y ordenar aquí lo desharía. */
  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const item of items) {
      const name = item.category?.trim();
      if (name && !seen.includes(name)) seen.push(name);
    }
    return seen;
  }, [items]);

  const [selected, setSelected] = useState(ALL);
  /* Quien filtra por una categoría que ya no está —el dueño la renombró y este
     enlace es de antes— vería la carta vacía sin saber por qué. Se cae a «Todo»
     al leer y no con un `setState` durante el render. */
  const active =
    selected !== ALL && !categories.includes(selected) ? ALL : selected;
  const shown =
    active === ALL
      ? items
      : items.filter((item) => item.category?.trim() === active);

  return (
    <>
      {categories.length > 1 && (
        <div className="mb-gap-sm flex flex-wrap gap-[6px]">
          {[ALL, ...categories].map((value) => {
            const isActive = value === active;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setSelected(value)}
                aria-pressed={isActive}
                className={cn(
                  "inline-flex items-center rounded-full border px-3 py-1.5 font-lv-display text-meta font-medium transition-all duration-500 ease-outquint",
                  isActive
                    ? "border-verde-400 bg-verde-400 text-verde-950 shadow-soft"
                    : "border-ink/10 bg-white text-ink-soft/75 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600",
                )}
              >
                {value === ALL ? "Todo" : value}
              </button>
            );
          })}
        </div>
      )}

      <div className="rounded-3xl border border-ink/5 bg-white px-gap-md shadow-soft">
        {shown.map((item, index) => (
          <MenuItem key={`${item.name}-${index}`} index={index} {...item} />
        ))}
      </div>
    </>
  );
}
