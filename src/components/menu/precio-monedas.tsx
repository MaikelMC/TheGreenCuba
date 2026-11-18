import type { ReactNode } from "react";
import { convertirPrecio, type ConfigTasa, type MonedaVista } from "@/lib/precios";
import { formatMenuPrice } from "@/lib/utils";

/**
 * Un precio de la carta online con sus versiones en las otras monedas.
 *
 * La carta es ISR y se pinta en el servidor, así que no hay estado que cambie
 * los precios: se pintan aquí todas las versiones y el CSS de `globals.css`
 * enseña la que pide `html[data-moneda]`, que escribe `SelectorMonedas`. Así
 * no hay JS por producto y nada se pierde si React vuelve a montar la fila.
 *
 * `children` es el precio original. Se esconde solo en las monedas a las que
 * sí se pudo convertir: un rango o «A convenir» se queda como está.
 */
export function PrecioMonedas({
  price,
  currency,
  config,
  monedas,
  className,
  children,
}: {
  price: string;
  currency: string;
  config: ConfigTasa | null;
  monedas: MonedaVista[];
  /** Clases del precio convertido; las mismas que el original. */
  className?: string;
  children: ReactNode;
}) {
  const conv = config
    ? monedas.flatMap((m) => {
        const v = convertirPrecio(price, currency, m, config);
        return v ? [[m, v] as const] : [];
      })
    : [];
  if (conv.length === 0) return <>{children}</>;

  return (
    <>
      <span data-oculta={conv.map(([m]) => m).join(" ")} className="contents">
        {children}
      </span>
      {conv.map(([m, v]) => (
        <span key={m} data-ver={m} className={className}>
          {formatMenuPrice(v, m)}
        </span>
      ))}
    </>
  );
}
