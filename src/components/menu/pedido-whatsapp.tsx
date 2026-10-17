"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
 * El pedido sigue siendo un mensaje: el carrito vive en el navegador
 * —`localStorage`, para que recargar la carta no borre lo que ya se eligió— y
 * lo que abre WhatsApp es la URL de `wa.me` con el pedido escrito dentro. La
 * Verde no lo cobra ni lo sirve.
 *
 * Lo que cambió es que **también deja una copia**: al confirmar se manda el
 * mismo carrito a `/api/pedidos`, y el negocio lo ve en el historial de su
 * panel. Es una copia best-effort y no bloquea el gesto de WhatsApp: si la red
 * falla, el pedido sale igual y solo se pierde el registro. Ver `guardarPedido`.
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
  vaciar: () => void;
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
        typeof (linea as LineaPedido).qty === "number" &&
        (linea as LineaPedido).qty > 0,
    );
  } catch {
    /* Sin `localStorage` —o con algo ilegible dentro— el carrito funciona
       igual durante esta visita; solo no sobrevive a recargar. */
    return [];
  }
}

/**
 * El carrito guardado, puesto al día con la carta de hoy.
 *
 * Lo que vive en `localStorage` es una foto del día que se llenó, y el precio
 * de un producto puede haber cambiado desde entonces. La foto viaja entera al
 * mensaje de WhatsApp, así que sin esto el negocio recibiría un precio viejo y
 * el cliente creería que le cobran de más: se refresca nombre y precio con lo
 * que hay ahora, y la cantidad se respeta.
 *
 * Una línea que ya no esté en la carta se deja como está, no se borra. Las
 * entradas viejas del menú no tienen `id` y su clave sale del nombre con su
 * posición, así que reordenar la carta la cambiaría: borrar por «no lo
 * encuentro» vaciaría el carrito de quien solo había movido una entrada de
 * sitio. Lo que falta es detectar el producto retirado; hará falta un `id`
 * estable en las entradas viejas, y hasta entonces es preferible dejar pasar
 * una línea que ya no existe a borrar las que sí.
 */
function alDia(
  lineas: LineaPedido[],
  productos: readonly ProductoPedible[],
): LineaPedido[] {
  if (lineas.length === 0 || productos.length === 0) return lineas;
  const hoy = new Map(productos.map((p) => [p.id, p]));
  return lineas.map((linea) => {
    const actual = hoy.get(linea.id);
    if (!actual) return linea;
    if (
      actual.name === linea.name &&
      actual.price === linea.price &&
      actual.currency === linea.currency
    ) {
      return linea;
    }
    return {
      ...linea,
      name: actual.name,
      price: actual.price,
      currency: actual.currency,
    };
  });
}

/**
 * El id del intento de pedido.
 *
 * Lo manda el navegador para que un reintento del mismo clic —o un `keepalive`
 * que se repite— no deje dos filas en el historial. `randomUUID` existe en
 * todos los navegadores modernos, pero solo en contexto seguro (HTTPS o
 * localhost); el respaldo mantiene el pedido funcionando en una IP por HTTP.
 */
function nuevoIdPedido(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* Sin `crypto` se cae al respaldo, que no necesita nada. */
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function PedidoProvider({
  placeId,
  negocio,
  whatsapp,
  productos,
  children,
}: {
  placeId: string;
  negocio: string;
  /** El número del negocio, ya resuelto. Sin él no se pinta el carrito. */
  whatsapp: string;
  /** La carta de hoy, para refrescar lo que el navegador guardó. Ver `alDia`. */
  productos: readonly ProductoPedible[];
  children: React.ReactNode;
}) {
  const clave = `la-verde:pedido:${placeId}`;
  const claveDir = `la-verde:pedido-direccion:${placeId}`;
  const [lineas, setLineas] = useState<LineaPedido[]>([]);
  const [direccion, setDireccion] = useState("");
  const [hidratado, setHidratado] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);
  /* El id de este intento. Se renueva al abrir la ventana de confirmación, no
     en cada clic: dos clics seguidos son el mismo pedido y no dos. */
  const idPedido = useRef<string | null>(null);
  /* Lo que se acaba de quitar, junto con la foto del carrito de antes de
     quitarlo. Una sola a la vez: cualquier gesto nuevo la reemplaza, y a los
     ocho segundos se va sola. */
  const [deshacer, setDeshacer] = useState<{
    lineas: LineaPedido[];
    texto: string;
  } | null>(null);
  /* La barra se aparta sola al bajar por la carta y vuelve al subir. Antes se
     quedaba fija desde el primer producto y se comía el pie de la pantalla
     justo mientras se está leyendo el menú, que es cuando molesta. */
  const [visible, setVisible] = useState(true);
  /** Si hay barra que apartar. Sin nada pedido no se escucha el desplazamiento. */
  const hay = lineas.length > 0;

  /* Se lee después de montar y no en el `useState` inicial: el HTML llega
     cacheado del servidor y el primer render tiene que coincidir con él.

     El `alDia` va aquí, una sola vez al cargar: es el momento en que el carrito
     guardado se cruza con la carta que acaba de llegar del servidor. */
  useEffect(() => {
    setLineas(alDia(leerGuardado(clave), productos));
    try {
      setDireccion(window.localStorage.getItem(claveDir) ?? "");
    } catch {
      /* Sin `localStorage` la dirección se escribe igual, solo no persiste. */
    }
    setHidratado(true);
    /* `productos` a propósito fuera: es un array nuevo en cada render del
       servidor, así que tenerlo aquí volvería a leer `localStorage` y a pisar
       el carrito que el cliente lleva a medias cada vez que la carta se
       refresca. Al montar ya se cruzó con la carta de ese momento, que es lo
       que hace falta. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    /* Añadir también mueve el carrito: el «volver atrás» pendiente apuntaría a
       uno sin lo que se acaba de añadir. */
    setDeshacer(null);
    /* Y trae la barra de vuelta: acaba de cambiar lo que cuenta, así que el
       gesto de comprobarlo tiene que estar a un toque. */
    setVisible(true);
  }, []);

  /* Bajar la esconde, subir la trae, y cerca del final vuelve sola: quien ha
     llegado al fondo de la carta ya no está leyendo, está decidiendo, y ahí el
     botón de pedir tiene que estar. Con `rAF` porque el `scroll` dispara mucho
     más de lo que la pantalla puede repintar, y con un umbral de 8 px porque
     sin él el rebote del dedo la haría parpadear. */
  useEffect(() => {
    if (!hay) return;
    let ultimo = window.scrollY;
    let pedido = false;
    const mirar = () => {
      pedido = false;
      const y = window.scrollY;
      const fondo = document.documentElement.scrollHeight - window.innerHeight;
      if (Math.abs(y - ultimo) >= 8) {
        setVisible(y < ultimo || y >= fondo - 120);
        ultimo = y;
      }
    };
    const alScroll = () => {
      if (pedido) return;
      pedido = true;
      requestAnimationFrame(mirar);
    };
    window.addEventListener("scroll", alScroll, { passive: true });
    return () => window.removeEventListener("scroll", alScroll);
  }, [hay]);

  /* A los ocho segundos la oferta de volver atrás se retira sola: el carrito
     cambia mucho en poco rato y una tira de «Deshacer» que se queda pegada
     acaba pareciendo parte del pedido. */
  useEffect(() => {
    if (!deshacer) return;
    const t = setTimeout(() => setDeshacer(null), 8000);
    return () => clearTimeout(t);
  }, [deshacer]);

  const volverAtras = useCallback(() => {
    if (!deshacer) return;
    setLineas(deshacer.lineas);
    setDeshacer(null);
  }, [deshacer]);

  /* Cada gesto que quita algo del carrito deja la foto de antes. Va fuera del
     actualizador de estado y no dentro: ahí React puede ejecutarlo dos veces
     —modo estricto— y quedarse con la foto equivocada. */
  const sumar = useCallback(
    (id: string, delta: number) => {
      const linea = lineas.find((l) => l.id === id);
      setLineas((prev) =>
        prev
          .map((l) => (l.id === id ? { ...l, qty: l.qty + delta } : l))
          .filter((l) => l.qty > 0),
      );
      if (linea && linea.qty + delta <= 0) {
        setDeshacer({ lineas, texto: `«${linea.name}» fuera del pedido` });
      } else {
        /* Bajar o subir cantidades no deshace nada, pero invalida el «volver
           atrás» pendiente: apuntaría a un carrito que ya no es este. */
        setDeshacer(null);
      }
    },
    [lineas],
  );

  const quitar = useCallback(
    (id: string) => {
      const linea = lineas.find((l) => l.id === id);
      if (!linea) return;
      setLineas((prev) => prev.filter((l) => l.id !== id));
      setDeshacer({ lineas, texto: `«${linea.name}» fuera del pedido` });
    },
    [lineas],
  );

  const vaciar = useCallback(() => {
    if (lineas.length === 0) return;
    setLineas([]);
    setDeshacer({ lineas, texto: "Pedido vaciado" });
  }, [lineas]);

  const valor = useMemo<Carrito>(
    () => ({ lineas, agregar, sumar, quitar, vaciar }),
    [lineas, agregar, sumar, quitar, vaciar],
  );

  /** Abre la confirmación con un id nuevo: es el intento que se va a guardar. */
  const abrirPedido = useCallback(() => {
    idPedido.current = nuevoIdPedido();
    setPidiendo(true);
  }, []);

  /**
   * Guarda una copia del pedido en el panel del negocio.
   *
   * **No se espera la respuesta**: el clic tiene que abrir WhatsApp en el mismo
   * gesto o el navegador lo bloquea como ventana emergente. `keepalive` deja que
   * la petición siga viva aunque la pestaña se vaya a WhatsApp; si falla —sin
   * datos, servidor caído— el pedido sale igual y lo único que no queda es la
   * copia. Por eso aquí no hay aviso de error: no hay nada que el cliente pueda
   * hacer, y decirle que «no se guardó» cuando el pedido sí salió sería peor.
   */
  const guardarPedido = useCallback(() => {
    if (lineas.length === 0) return;
    const id = idPedido.current ?? nuevoIdPedido();
    idPedido.current = id;

    try {
      void fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          negocioId: placeId,
          lineas,
          direccion: direccion.trim(),
        }),
        keepalive: true,
      }).catch(() => {
        /* Sin red no hay copia; el mensaje de WhatsApp ya salió. */
      });
    } catch {
      /* `fetch` puede fallar de forma síncrona en entornos muy viejos. */
    }
  }, [lineas, direccion, placeId]);

  /* Desplegada manda ella: el desplazamiento no decide mientras se mira el
     pedido. */
  const barraVisible = visible || abierto;
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

          <div
            /* Con el pedido desplegado no se aparta nunca: quien está mirando
               lo que lleva no quiere que se le vaya. Y apartada va `inert`,
               que si no seguiría en el orden del tabulador y el foco podía
               saltar a un botón fuera de la pantalla. */
            inert={!barraVisible}
            className={cn(
              "fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/95 backdrop-blur transition-transform duration-300 ease-outquint motion-reduce:transition-none",
              barraVisible ? "translate-y-0" : "translate-y-full",
            )}
          >
            {/* `px-gap-xs` en el teléfono y no `px-gutter`: la barra va pegada al
                borde de la pantalla y cada píxel que se le quita al margen es
                ancho que se le da a los dos botones, que tienen que caber en la
                misma fila. De `sm` en adelante vuelve a alinearse con la carta. */}
            <div className="mx-auto w-full max-w-[680px] px-gap-xs pb-gap-sm pt-gap-xs sm:px-gutter">
              {abierto && (
                <div className="mb-gap-xs border-b border-ink/5 pb-gap-xs">
                  {/* Vaciar sin preguntar: el aviso con «Deshacer» sale al
                      pulsarlo, así que el gesto se puede permitir suelto. Va
                      fuera del `ul` y por encima para que no se lo lleve por
                      delante el desplazamiento de una lista larga. */}
                  <div className="flex justify-end pb-gap-xs">
                    <button
                      type="button"
                      onClick={vaciar}
                      className="inline-flex h-10 cursor-pointer items-center gap-[5px] rounded-full px-gap-xs font-lv-display text-meta font-semibold text-ink-soft/75 transition-colors duration-500 ease-outquint hover:bg-sand-deep hover:text-ink"
                    >
                      <Trash2
                        size={14}
                        strokeWidth={1.8}
                        className="shrink-0"
                      />
                      Vaciar el pedido
                    </button>
                  </div>

                  {/* Volver atrás en el sitio donde se hizo el gesto y no en un
                      aviso flotante: el flotante del proyecto se posa a 80 px
                      del borde inferior y la barra del carrito abierta pasa de
                      ahí, así que taparía justo lo que se acaba de tocar. */}
                  {deshacer && (
                    <div className="mb-gap-xs flex items-center justify-between gap-gap-sm rounded-full bg-sand-deep py-[2px] pl-gap-sm pr-[2px]">
                      <span className="min-w-0 truncate text-meta text-ink-soft">
                        {deshacer.texto}
                      </span>
                      <button
                        type="button"
                        onClick={volverAtras}
                        className="inline-flex h-10 shrink-0 cursor-pointer items-center rounded-full px-gap-sm font-lv-display text-meta font-semibold text-verde-700 transition-colors duration-500 ease-outquint hover:bg-white hover:text-verde-600"
                      >
                        Deshacer
                      </button>
                    </div>
                  )}

                  <ul className="max-h-[45vh] overflow-y-auto">
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

                        {/* 40 px por botón y 6 px entre ellos. El hueco es lo que
                            separa «quitar uno» de «añadir uno», que son gestos
                            opuestos con el mismo aspecto: pegados, un toque que
                            resbala al lado contrario no se nota hasta mirar el
                            total. */}
                        <div className="flex items-center gap-[6px]">
                          <BotonCantidad
                            etiqueta={`Quitar uno de ${linea.name}`}
                            onClick={() => sumar(linea.id, -1)}
                          >
                            <Minus size={16} strokeWidth={2} />
                          </BotonCantidad>
                          <span className="w-[24px] text-center font-lv-display text-small font-semibold text-ink">
                            {linea.qty}
                          </span>
                          <BotonCantidad
                            etiqueta={`Añadir uno de ${linea.name}`}
                            onClick={() => sumar(linea.id, 1)}
                          >
                            <Plus size={16} strokeWidth={2} />
                          </BotonCantidad>
                        </div>

                        <button
                          type="button"
                          aria-label={`Quitar ${linea.name} del pedido`}
                          onClick={() => quitar(linea.id)}
                          className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-ink-soft/75 transition-colors duration-500 ease-outquint hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 size={16} strokeWidth={1.8} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
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
                  onClick={abrirPedido}
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
                  en blanco. El pedido también queda en el historial del negocio.
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
                  onClick={() => {
                    guardarPedido();
                    setPidiendo(false);
                  }}
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

/**
 * El botón «añadir» que va en cada entrada de la carta.
 *
 * Es también donde el carrito se ve desde la carta: en cuanto el producto lleva
 * una unidad encima, el botón se rellena en verde y enseña cuántas van. Antes
 * solo estaba en la barra de abajo, así que para saber si algo ya estaba pedido
 * había que desplegar el pedido entero —o volver a añadirlo, y quedaban dos—.
 *
 * Sigue añadiendo de uno en uno; lo que cambia es que ahora el número dice
 * cuántos llevas. El `data-en-pedido` no pinta nada aquí: lo lee la tarjeta que
 * envuelve al botón desde `page.tsx`, con `:has()`, para marcarse el borde. El
 * carrito vive en el cliente y la tarjeta se sirve desde el servidor, así que
 * ese atributo es el único hilo entre los dos.
 */
export function BotonAgregar({ producto }: { producto: ProductoPedible }) {
  const carrito = useContext(CarritoCtx);
  if (!carrito) return null;

  const qty = carrito.lineas.find((linea) => linea.id === producto.id)?.qty ?? 0;

  return (
    <button
      type="button"
      data-en-pedido={qty > 0 ? "" : undefined}
      aria-label={
        qty > 0
          ? `Añadir otro ${producto.name} al pedido: llevas ${qty}`
          : `Añadir ${producto.name} al pedido`
      }
      onClick={() => carrito.agregar(producto)}
      className={cn(
        "grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border font-lv-display transition-colors duration-500 ease-outquint active:scale-95",
        qty > 0
          ? "border-verde-400 bg-verde-400 text-small font-bold text-verde-950 hover:bg-verde-300"
          : "border-verde-300 bg-verde-50 text-verde-700 hover:bg-verde-400 hover:text-verde-950",
      )}
    >
      {qty > 0 ? qty : <Plus size={18} strokeWidth={2} />}
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
      className="grid size-10 cursor-pointer place-items-center rounded-full border border-ink/10 bg-white text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:text-verde-700"
    >
      {children}
    </button>
  );
}
