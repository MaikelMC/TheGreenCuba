"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ChevronDown, MessageCircle, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  hrefPedido,
  mensajePedido,
  totalDePedido,
  type LineaPedido,
} from "@/lib/pedido";

/**
 * El carrito del menú público, y el enlace que lo convierte en un pedido.
 *
 * **Sin backend a propósito.** Un pedido por WhatsApp es un mensaje: el
 * carrito vive en el navegador —`localStorage`, para que recargar la carta no
 * borre lo que ya se eligió— y lo que sale de aquí es la URL de `wa.me` con el
 * pedido escrito dentro. La Verde no guarda el pedido, no lo cobra y no lo
 * sirve; solo pone el mensaje en orden.
 *
 * Por eso el carrito **solo existe si el plan lo incluye** (`whatsapp_pedido`,
 * Básico+). La decisión se toma en el servidor, en la página del menú, y aquí
 * solo se pinta lo que llega: el candado del cliente no cierra nada.
 */

/** Lo que hace falta de un producto de la carta para poder pedirlo. */
export interface ProductoPedible {
  id: string;
  name: string;
  price: string;
  currency: string;
}

interface Carrito {
  lineas: LineaPedido[];
  agregar: (producto: ProductoPedible) => void;
  sumar: (id: string, delta: number) => void;
  quitar: (id: string) => void;
}

const CarritoCtx = createContext<Carrito | null>(null);

/** Lo guardado en `localStorage`, o `[]` si no hay nada legible. */
function leerGuardado(clave: string): LineaPedido[] {
  try {
    const crudo = window.localStorage.getItem(clave);
    if (!crudo) return [];
    const datos: unknown = JSON.parse(crudo);
    if (!Array.isArray(datos)) return [];
    return datos.filter(
      (linea): linea is LineaPedido =>
        typeof linea === "object" &&
        linea !== null &&
        typeof (linea as LineaPedido).id === "string" &&
        typeof (linea as LineaPedido).qty === "number",
    );
  } catch {
    /* Sin `localStorage` —o con algo ilegible dentro— el carrito funciona
       igual durante esta visita; solo no sobrevive a recargar. */
    return [];
  }
}

export function PedidoProvider({
  placeId,
  negocio,
  whatsapp,
  children,
}: {
  placeId: string;
  negocio: string;
  /** El número del negocio, ya resuelto. Sin él no se pinta el carrito. */
  whatsapp: string;
  children: React.ReactNode;
}) {
  const clave = `la-verde:pedido:${placeId}`;
  const [lineas, setLineas] = useState<LineaPedido[]>([]);
  const [hidratado, setHidratado] = useState(false);
  const [abierto, setAbierto] = useState(false);

  /* Se lee después de montar y no en el `useState` inicial: el HTML llega
     cacheado del servidor y el primer render tiene que coincidir con él. */
  useEffect(() => {
    setLineas(leerGuardado(clave));
    setHidratado(true);
  }, [clave]);

  useEffect(() => {
    if (!hidratado) return;
    try {
      window.localStorage.setItem(clave, JSON.stringify(lineas));
    } catch {
      /* Cuota llena o modo privado: el carrito sigue, solo no persiste. */
    }
  }, [clave, lineas, hidratado]);

  const agregar = useCallback((producto: ProductoPedible) => {
    setLineas((prev) => {
      const i = prev.findIndex((linea) => linea.id === producto.id);
      if (i === -1) return [...prev, { ...producto, qty: 1 }];
      const copia = [...prev];
      const actual = copia[i]!;
      copia[i] = { ...actual, qty: actual.qty + 1 };
      return copia;
    });
  }, []);

  const sumar = useCallback((id: string, delta: number) => {
    setLineas((prev) =>
      prev
        .map((linea) =>
          linea.id === id ? { ...linea, qty: linea.qty + delta } : linea,
        )
        .filter((linea) => linea.qty > 0),
    );
  }, []);

  const quitar = useCallback((id: string) => {
    setLineas((prev) => prev.filter((linea) => linea.id !== id));
  }, []);

  const valor = useMemo<Carrito>(
    () => ({ lineas, agregar, sumar, quitar }),
    [lineas, agregar, sumar, quitar],
  );

  const unidades = lineas.reduce((total, linea) => total + linea.qty, 0);
  const total = totalDePedido(lineas);
  const href = hrefPedido(whatsapp, mensajePedido({ negocio, lineas }));

  return (
    <CarritoCtx.Provider value={valor}>
      {children}

      {unidades > 0 && (
        <>
          {/* Deja hueco para la barra fija, que si no tapa el final de la carta. */}
          <div aria-hidden className="h-[104px]" />

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/95 backdrop-blur">
            <div className="mx-auto w-full max-w-[680px] px-gutter pb-gap-sm pt-gap-xs">
              {abierto && (
                <ul className="mb-gap-xs max-h-[45vh] overflow-y-auto border-b border-ink/5 pb-gap-xs">
                  {lineas.map((linea) => (
                    <li
                      key={linea.id}
                      className="flex items-center gap-gap-sm py-[6px]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-lv-display text-small font-semibold text-ink">
                          {linea.name}
                        </div>
                        <div className="text-meta text-ink-soft/75">
                          {[linea.price, linea.currency].filter(Boolean).join(" ")}
                        </div>
                      </div>

                      <div className="flex items-center gap-[2px]">
                        <BotonCantidad
                          etiqueta={`Quitar uno de ${linea.name}`}
                          onClick={() => sumar(linea.id, -1)}
                        >
                          <Minus size={15} strokeWidth={2} />
                        </BotonCantidad>
                        <span className="w-[24px] text-center font-lv-display text-small font-semibold text-ink">
                          {linea.qty}
                        </span>
                        <BotonCantidad
                          etiqueta={`Añadir uno de ${linea.name}`}
                          onClick={() => sumar(linea.id, 1)}
                        >
                          <Plus size={15} strokeWidth={2} />
                        </BotonCantidad>
                      </div>

                      <button
                        type="button"
                        aria-label={`Quitar ${linea.name} del pedido`}
                        onClick={() => quitar(linea.id)}
                        className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-ink-soft/75 transition-colors duration-500 ease-outquint hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 size={15} strokeWidth={1.8} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center gap-gap-xs">
                <button
                  type="button"
                  aria-expanded={abierto}
                  onClick={() => setAbierto((prev) => !prev)}
                  className="inline-flex h-11 cursor-pointer items-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-sm font-lv-display text-small font-semibold text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600"
                >
                  <ShoppingBag size={16} strokeWidth={1.8} />
                  {unidades} {unidades === 1 ? "producto" : "productos"}
                  {total && (
                    <span className="text-ink-soft/75">
                      {total.total.toFixed(2)} {total.currency}
                    </span>
                  )}
                  <ChevronDown
                    size={15}
                    strokeWidth={2}
                    className={cn(
                      "transition-transform duration-500 ease-outquint",
                      abierto && "rotate-180",
                    )}
                  />
                </button>

                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 flex-1 items-center justify-center gap-gap-xs rounded-full bg-verde-400 px-gap-md font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-colors duration-500 ease-outquint hover:bg-verde-300"
                >
                  <MessageCircle size={16} strokeWidth={1.8} />
                  Pedir por WhatsApp
                </a>
              </div>
            </div>
          </div>
        </>
      )}
    </CarritoCtx.Provider>
  );
}

/** El botón «añadir» que va en cada entrada de la carta. */
export function BotonAgregar({ producto }: { producto: ProductoPedible }) {
  const carrito = useContext(CarritoCtx);
  if (!carrito) return null;

  return (
    <button
      type="button"
      aria-label={`Añadir ${producto.name} al pedido`}
      onClick={() => carrito.agregar(producto)}
      className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border border-verde-300 bg-verde-50 text-verde-700 transition-colors duration-500 ease-outquint hover:bg-verde-400 hover:text-verde-950 active:scale-95"
    >
      <Plus size={17} strokeWidth={2} />
    </button>
  );
}

function BotonCantidad({
  etiqueta,
  onClick,
  children,
}: {
  etiqueta: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      onClick={onClick}
      className="grid size-8 cursor-pointer place-items-center rounded-full border border-ink/10 bg-white text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:text-verde-700"
    >
      {children}
    </button>
  );
}
