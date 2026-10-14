"use client";

import { Fragment, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * El filtro por categoría de la carta.
 *
 * Es una isla de cliente porque filtrar es **enseñar y esconder** grupos, y eso
 * necesita estado. Pero no pinta ni una fila: los grupos le llegan ya
 * resueltos desde el servidor y su trabajo es solo elegir cuáles van. Así las
 * filas siguen montándose en el servidor —con la oferta ya emparejada y sin
 * mandar JavaScript para pintarlas— y al navegador solo baja la decisión.
 *
 * Antes las categorías eran anclas y no filtraban: bajaban hasta el grupo.
 * Ahora filtran, y «Todos» devuelve la carta entera.
 */

export interface CartaGrupo {
  /** `null` para las entradas sin categoría, que no tienen chip propio. */
  name: string | null;
  /** El grupo ya renderizado en el servidor. */
  node: ReactNode;
}

/* La pastilla de las anclas de antes: el gesto ya se conocía, solo cambia lo
   que hace al tocarlo.
   `shrink-0` + `whitespace-nowrap`: en el teléfono las pastillas no caben y sin
   eso el navegador las encoge y parte el nombre del grupo en dos líneas. */
const CHIP =
  "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-3 py-1.5 font-lv-display text-meta font-medium cursor-pointer transition-colors duration-500 ease-outquint";
const CHIP_ON = "border-verde-400 bg-verde-400 text-verde-950";
const CHIP_OFF =
  "border-ink/10 bg-white text-ink-soft/75 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600";

export function CartaMenu({ groups }: { groups: CartaGrupo[] }) {
  const [categoria, setCategoria] = useState<string | null>(null);

  /* Solo se puede filtrar por lo que tiene nombre: las entradas sueltas salen
     con «Todos» y no hay chip que las aísle, porque el chip se llama como el
     grupo y estas no tienen. */
  const conNombre = groups.filter((group) => group.name !== null);
  const visibles = categoria
    ? groups.filter((group) => group.name === categoria)
    : groups;

  return (
    <>
      {conNombre.length > 1 && (
        <nav
          aria-label="Categorías del menú"
          /* Una sola fila que se desliza en horizontal. `flex-wrap` las apilaba
             en tres o cuatro líneas en el teléfono y empujaba la carta hacia
             abajo; `pb-1` deja aire para la barra de desplazamiento. */
          className="mb-gap-sm scrollbar-hide flex gap-[6px] overflow-x-auto pb-1"
        >
          <button
            type="button"
            onClick={() => setCategoria(null)}
            aria-pressed={categoria === null}
            className={cn(CHIP, categoria === null ? CHIP_ON : CHIP_OFF)}
          >
            Todos
          </button>
          {conNombre.map((group) => (
            <button
              key={group.name}
              type="button"
              onClick={() => setCategoria(group.name)}
              aria-pressed={categoria === group.name}
              className={cn(CHIP, categoria === group.name ? CHIP_ON : CHIP_OFF)}
            >
              {group.name}
            </button>
          ))}
        </nav>
      )}

      {visibles.map((group, i) => (
        <Fragment key={group.name ?? `__sin_categoria_${i}`}>
          {group.node}
        </Fragment>
      ))}
    </>
  );
}
