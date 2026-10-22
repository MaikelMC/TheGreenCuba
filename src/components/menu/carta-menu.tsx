import { Fragment, type ReactNode } from "react";
import { BuscadorMenu } from "@/components/menu/buscador-menu";

/**
 * El filtro por categoría y el buscador de productos de la carta.
 *
 * **Los chips no filtran: saltan.** La carta entera está siempre en la página y
 * un chip lleva hasta el grupo que nombra. Al ser anclas el navegador se
 * encarga: funcionan sin JavaScript, el gesto de atrás devuelve a donde estabas
 * y el enlace de una categoría se puede copiar.
 *
 * El buscador sí es isla de cliente, pero solo para ocultar tarjetas que ya
 * están servidas: no pide nada ni repinta la carta. Ver `BuscadorMenu`.
 */

export interface CartaGrupo {
  /** `null` para las entradas sin categoría, que no tienen chip propio. */
  name: string | null;
  /**
   * El `id` del grupo en el DOM. Lo trae puesto quien lo pinta, que es también
   * quien escribe ese `id` en la sección: así el ancla y su destino no pueden
   * discrepar, que es lo que pasaría con el cálculo copiado en los dos sitios.
   */
  id: string;
  /** El grupo ya renderizado en el servidor. */
  node: ReactNode;
}

/* La pastilla de las anclas de antes: el gesto ya se conocía. Sin estado, todas
   se pintan igual —ya no hay una «puesta»—, así que la clase es una sola.
   `shrink-0` + `whitespace-nowrap`: en el teléfono las pastillas no caben y sin
   eso el navegador las encoge y parte el nombre del grupo en dos líneas.

   El alto lo pone el token y no el relleno: `--carta-filtros-h`, que es lo que
   reserva el salto de ancla, se calcula a partir de él, así que la pastilla y
   la reserva no pueden discrepar. */
const CHIP =
  "inline-flex h-[var(--carta-chip-alto)] shrink-0 items-center whitespace-nowrap rounded-full border border-ink/10 bg-white px-3 font-lv-display text-meta font-medium text-ink-soft/75 cursor-pointer transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600";

export function CartaMenu({ groups }: { groups: CartaGrupo[] }) {
  /* Solo hay chip para lo que tiene nombre: las entradas sueltas salen al final
     de la carta y no hay categoría que las aisle. */
  const conNombre = groups.filter((group) => group.name !== null);

  return (
    <div data-carta>
      {/* `sticky` con fondo opaco: el buscador y los chips siguen a mano al
          bajar por la carta —si no, hay que volver arriba para buscar o cambiar
          de categoría— y el fondo tapa las tarjetas que pasan por debajo.
          `carta-filtros` es quien fija el color en oscuro: ahí el fondo de la
          página es el del `body` (`#08130d`), no el de una superficie, y
          `bg-background` solo caía en el `#0e1720` de las tarjetas. Ver
          `globals.css`.

          La fila de chips, cuando existe, se desliza en horizontal: `flex-wrap`
          las apilaba en tres o cuatro líneas en el teléfono y empujaba la carta
          hacia abajo. El degradado del borde va en el div del scroll y no en la
          barra: una máscara sobre la barra apagaría también su fondo, que es lo
          que tapa las tarjetas al pasar por debajo. */}
      <BuscadorMenu>
        {conNombre.length > 1 && (
          <nav aria-label="Categorías del menú">
            <div className="carta-filtros-scroll scrollbar-hide flex items-center gap-[6px] overflow-x-auto">
              {conNombre.map((group) => (
                <a key={group.name} href={`#${group.id}`} className={CHIP}>
                  {group.name}
                </a>
              ))}
            </div>
          </nav>
        )}
      </BuscadorMenu>

      {/* La clave va por nombre y no por `id`: el nombre es lo que agrupa, así
          que es único; el `id` sale de `slugify` y dos nombres distintos pueden
          caer en el mismo. El grupo sin categoría también es uno solo. */}
      {groups.map((group) => (
        <Fragment key={group.name ?? "__sin_categoria__"}>
          {group.node}
        </Fragment>
      ))}

      {/* Lo enciende `BuscadorMenu` solo cuando hay un término y ninguna
          tarjeta coincide. `role="status"` lo anuncia quien usa lector. */}
      <p
        data-sin-resultados
        role="status"
        hidden
        className="rounded-3xl border border-ink/5 bg-white p-gap-md text-center text-small text-ink-soft/75 shadow-soft"
      >
        No hay productos que coincidan con la búsqueda.
      </p>
    </div>
  );
}
