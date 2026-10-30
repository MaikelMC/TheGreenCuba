import { Fragment, type ReactNode } from "react";

/**
 * La carta: los grupos de productos, ya pintados en el servidor.
 *
 * Los chips de categoría y el buscador viven ahora en `MenuHeader`, que es
 * quien queda pegado arriba; aquí solo se apilan los grupos y el aviso de «sin
 * resultados», que enciende ese mismo buscador.
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

export function CartaMenu({ groups }: { groups: CartaGrupo[] }) {
  return (
    <div>
      {/* La clave va por nombre y no por `id`: el nombre es lo que agrupa, así
          que es único; el `id` sale de `slugify` y dos nombres distintos pueden
          caer en el mismo. El grupo sin categoría también es uno solo. */}
      {groups.map((group) => (
        <Fragment key={group.name ?? "__sin_categoria__"}>{group.node}</Fragment>
      ))}

      {/* Lo enciende `MenuHeader` solo cuando hay un término y ninguna tarjeta
          coincide. `role="status"` lo anuncia quien usa lector. */}
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
