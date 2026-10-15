"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ChevronDown,
  MessageCircle,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
 * Por eso el carrito **solo existe si el plan lo incluye** (`whatsapp_pedido`:
 * módulo Pedidos y reservas, o un pack). La decisión se toma en el servidor, en
 * la página del menú, y aquí
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
  const claveDir = `la-verde:pedido-direccion:${placeId}`;
  const [lineas, setLineas] = useState<LineaPedido[]>([]);
  const [direccion, setDireccion] = useState("");
  const [hidratado, setHidratado] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);

  /* Se lee después de montar y no en el `useState` inicial: el HTML llega
     cacheado del servidor y el primer render tiene que coincidir con él. */
  useEffect(() => {
    setLineas(leerGuardado(clave));
    try {
      setDireccion(window.localStorage.getItem(claveDir) ?? "");
    } catch {
      /* Sin `localStorage` la dirección se escribe igual, solo no persiste. */
    }
    setHidratado(true);
  }, [clave, claveDir]);

  useEffect(() => {
    if (!hidratado) return;
    try {
      window.localStorage.setItem(clave, JSON.stringify(lineas));
      window.localStorage.setItem(claveDir, direccion);
    } catch {
      /* Cuota llena o modo privado: el carrito sigue, solo no persiste. */
    }
  }, [clave, claveDir, lineas, direccion, hidratado]);

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
  const href = hrefPedido(
    whatsapp,
    mensajePedido({ negocio, lineas, direccion }),
  );

  return (
    <CarritoCtx.Provider value={valor}>
      {children}

      {unidades > 0 && (
        <>
          {/* Deja hueco para la barra fija, que si no tapa el final de la carta. */}
          <div aria-hidden className="h-[104px]" />

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/95 backdrop-blur">
            {/* `px-gap-xs` en el teléfono y no `px-gutter`: la barra va pegada al
                borde de la pantalla y cada píxel que se le quita al margen es
                ancho que se le da a los dos botones, que tienen que caber en la
                misma fila. De `sm` en adelante vuelve a alinearse con la carta. */}
            <div className="mx-auto w-full max-w-[680px] px-gap-xs pb-gap-sm pt-gap-xs sm:px-gutter">
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
                          {[linea.price, linea.currency]
                            .filter(Boolean)
                            .join(" ")}
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

              {/* Mismo nivel: el resumen y la acción en una fila. El ancho
                  sobrante que hacía falta para que entre «Realizar pedido» sale
                  del relleno —el resumen y la acción van a `px-gap-xs` en el
                  teléfono, y la barra también—, no de quitar nada de dentro: el
                  resumen conserva icono, «productos», total y flecha.
                  El texto va sin partir: `h-11` / `h-12` son altos fijos, así
                  que una etiqueta de dos líneas no estira la pastilla, se sale
                  por abajo. */}
              <div className="flex items-center justify-between gap-gap-xs">
                <button
                  type="button"
                  aria-expanded={abierto}
                  onClick={() => setAbierto((prev) => !prev)}
                  className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-gap-xs whitespace-nowrap rounded-full border border-ink/10 bg-white px-gap-xs font-lv-display text-meta font-semibold text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600 sm:px-gap-sm sm:text-small"
                >
                  <ShoppingBag
                    size={16}
                    strokeWidth={1.8}
                    className="shrink-0"
                  />
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
                      "shrink-0 transition-transform duration-500 ease-outquint",
                      abierto && "rotate-180",
                    )}
                  />
                </button>

                <button
                  type="button"
                  onClick={() => setPidiendo(true)}
                  className="inline-flex h-12 flex-1 cursor-pointer items-center justify-center gap-gap-xs whitespace-nowrap rounded-full bg-verde-400 px-gap-xs font-lv-display text-body font-semibold text-verde-950 shadow-primary-halo transition-colors duration-500 ease-outquint hover:bg-verde-300 sm:h-11 sm:px-gap-md sm:text-small"
                >
                  <MessageCircle
                    size={17}
                    strokeWidth={1.8}
                    className="shrink-0"
                  />
                  Realizar pedido
                </button>
              </div>
            </div>
          </div>

          {/* La dirección se pide aquí, al confirmar el pedido, y no dentro del
              carrito: el carrito es elegir productos y esta es la última
              decisión antes de salir. La ventana sale **siempre**, también con
              la dirección ya escrita, para poder corregirla o dejarla en blanco
              —el negocio que sirve para recoger no necesita ninguna—. */}
          <Dialog open={pidiendo} onOpenChange={setPidiendo}>
            {/* `flex flex-col` enciende el `gap-gap-md` que la ventana ya trae
                escrito: sin una disposición de flex, ese hueco no se aplica a
                nada —una caja de bloque no reparte `gap`— y el título, el campo
                y los botones salían pegados unos a otros. */}
            <DialogContent className="flex flex-col">
              <DialogHeader>
                <DialogTitle>¿Dónde te lo llevamos?</DialogTitle>
                <DialogDescription>
                  La dirección va dentro del mensaje. Si vas a recogerlo, déjala
                  en blanco.
                </DialogDescription>
              </DialogHeader>

              {/* El color del texto y del marcador van con los tokens que el
                  modo oscuro reescribe —`text-ink`, `bg-white`,
                  `border-ink/10`— y no con los del sistema viejo
                  (`bg-surface`, `text-foreground`), que solo cambian con la
                  clase `.dark` y esta app usa el atributo `data-theme`. */}
              <label className="block">
                <span className="mb-[6px] block text-meta font-semibold text-ink">
                  Dirección de entrega
                </span>
                <input
                  type="text"
                  value={direccion}
                  onChange={(evento) => setDireccion(evento.target.value)}
                  placeholder="Calle, número, entre calles…"
                  maxLength={200}
                  className="h-12 w-full rounded-2xl border border-ink/10 bg-white px-gap-sm text-body text-ink outline-none placeholder:text-ink-soft focus:border-verde-400 focus:ring-2 focus:ring-verde-400/30"
                />
              </label>

              {/* Los dos botones en una fila también en el teléfono, y a la
                  misma altura.

                  El pie nace como columna en móvil —así lo trae `DialogFooter`—
                  y con dos pastillas apiladas la ventana crecía de alto por lo
                  que no valía: mirar la carta desde un QR es un gesto de una
                  vez y la ventana se comía la pantalla. En fila se resuelve en
                  una franja.

                  `grid-cols-[auto_1fr]` y no dos mitades iguales: «Volver» mide
                  lo que mide su palabra y «Enviar el pedido» se queda con el
                  resto, que es el reparto que dice cuál de los dos importa.
                  Repartir al 50 % obligaba a recortar el texto del principal.
                  El `sm:flex` devuelve la fila de escritorio que ya traía el
                  componente; `sm:space-x-0` quita el margen suelto de la base
                  para que el hueco lo ponga solo `gap-gap-xs` en los dos
                  anchos. */}
              <DialogFooter className="grid grid-cols-[auto_1fr] gap-gap-xs sm:flex sm:justify-end sm:space-x-0">
                <DialogClose asChild>
                  <button
                    type="button"
                    className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-ink/10 bg-white px-gap-sm font-lv-display text-meta font-semibold text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600 sm:px-gap-md sm:text-small"
                  >
                    Volver
                  </button>
                </DialogClose>

                {/* Un enlace y no un `router.push`: quien habla con WhatsApp es
                    el navegador. Se cierra la ventana al pulsarlo para no
                    dejarla abierta encima de la pestaña que acaba de abrirse.

                    Sin `flex-1`: mientras el pie fue una columna en el
                    teléfono, ese `flex-1` repartía por el eje vertical y el
                    botón dejaba de medir su alto. Ahora el ancho lo da la
                    columna de la rejilla y el alto, `h-10`. */}
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setPidiendo(false)}
                  className="inline-flex h-10 min-w-0 items-center justify-center gap-gap-xs whitespace-nowrap rounded-full bg-verde-400 px-gap-sm font-lv-display text-meta font-semibold text-verde-950 shadow-primary-halo transition-colors duration-500 ease-outquint hover:bg-verde-300 sm:px-gap-md sm:text-small"
                >
                  <MessageCircle
                    size={15}
                    strokeWidth={1.8}
                    className="shrink-0"
                  />
                  Enviar el pedido
                </a>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
