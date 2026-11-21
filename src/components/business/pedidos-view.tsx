"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarClock,
  Check,
  ChevronRight,
  ClipboardList,
  Clock,
  Ellipsis,
  Gift,
  Loader2,
  MapPin,
  MessageCircle,
  RefreshCw,
  Search,
  ShoppingBag,
  Stamp,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn, currencyLabel, formatMenuPrice } from "@/lib/utils";
import { totalDePedido, type LineaPedido } from "@/lib/pedido";
import { bloqueoDe, type Funcion } from "@/lib/plans";
import { useCatalogo } from "@/providers/catalogo-provider";
import { BotonPrimario, BotonSecundario } from "@/components/business/ui/botones";
import { HojaPanel } from "@/components/business/ui/hoja-panel";
import { DarSello } from "@/components/business/dar-sello";
import { usePanelNav } from "@/components/business/panel-shell";
import { usePedidosPendientes } from "@/components/business/pedidos-pendientes";

type EstadoPedido = "nuevo" | "completado" | "cancelado";
type Pestana = "pendientes" | "todos" | "programados";

interface Pedido {
  id: string;
  codigo?: string | null;
  lineas: LineaPedido[];
  direccion: string | null;
  estado: EstadoPedido;
  tasaUsada?: number | null;
  modoEntrega?: "recogida" | "domicilio" | null;
  zonaNombre?: string | null;
  costoEnvio?: number | null;
  costoEnvioMoneda?: string | null;
  fueraDeHorario?: boolean | null;
  revisarHora?: boolean | null;
  revisarMotivo?: string | null;
  /** Todos los motivos para revisar (los pedidos nuevos solo escriben este). */
  revisarMotivos?: string[] | null;
  programadoPara?: string | null;
  createdAt: string;
  telefonoCliente?: string | null;
  /** La tarjeta de sellos de quien hizo el pedido, si la tiene. */
  tarjeta?: TarjetaResumen | null;
}

/** Lo que dice cada motivo de revisión, para el dueño. */
const MOTIVO_TEXTO: Record<string, string> = {
  no_existe: "Un producto ya no está en la carta",
  oculto: "Un producto está oculto",
  agotado: "Un producto está agotado",
  precio_cambio: "El precio no era el de la carta: se guardó el de la carta",
  sin_precio: "Un producto no tiene precio en cifra: el total no se puede comprobar",
  sin_funcion: "Los pedidos programados están apagados",
  sin_antelacion: "Sin la antelación mínima",
  fuera_de_dias: "Fuera de los días que aceptas",
  fuera_de_horario: "Fuera del horario de cocina",
};
const MOTIVOS_HORA = new Set(["sin_funcion", "sin_antelacion", "fuera_de_dias", "fuera_de_horario"]);

/** La unión de los motivos nuevos (array) y los de los pedidos anteriores. */
function motivosDe(pedido: Pedido): string[] {
  const todos = new Set(pedido.revisarMotivos ?? []);
  if (pedido.revisarHora && pedido.revisarMotivo) todos.add(pedido.revisarMotivo);
  return [...todos];
}

interface TarjetaResumen {
  clienteId: string;
  token: string;
  telefono: string;
  telefonoEnmascarado: string;
  nombre: string | null;
  sellos: number;
  ciclo: number;
  metaSellos: number;
  premio: string | null;
  premios: { indice: number; premio: string }[];
  premioListo: string | null;
}

/** Lo que devuelve el PATCH con la tarjeta, para el aviso. */
interface ResultadoSello {
  estado:
    | "sumado"
    | "sin_funcion"
    | "inactiva"
    | "sin_telefono"
    | "sin_comprobar"
    | "bajo_minimo"
    | "duplicado"
    | "no_encontrado";
  telefonoEnmascarado?: string;
  token?: string;
  tarjeta?: {
    sellos: number;
    ciclo: number;
    metas: { sellos: number; premio: string; alcanzada: boolean; canjeada: boolean; faltan: number }[];
    siguiente: { sellos: number; premio: string; faltan: number } | null;
    listas: { sellos: number; premio: string }[];
    metaFinal: { sellos: number; premio: string };
  };
  total?: number;
  currency?: string;
  minimo?: { monto: number; moneda: string };
}

/* ── formateadores ──────────────────────────────────────────────────────── */

const FMT_CORTO = new Intl.DateTimeFormat("es-CU", {
  timeZone: "America/Havana",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const FMT_PROGRAMADO = new Intl.DateTimeFormat("es-CU", {
  timeZone: "America/Havana",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/* ── estilos compartidos ────────────────────────────────────────────────── */

const BTN_GHOST =
  "inline-flex h-11 cursor-pointer items-center gap-[5px] rounded-full border border-ink/10 bg-white px-gap-sm font-lv-display text-meta font-semibold text-ink-soft/75 transition-colors duration-300 ease-outquint hover:border-verde-300 hover:text-verde-700 disabled:pointer-events-none disabled:opacity-40";

const ESTADO_BADGE: Record<EstadoPedido, string> = {
  nuevo:
    "border-verde-200 bg-verde-50 text-verde-700",
  completado:
    "border-ink/10 bg-sand text-ink-soft",
  cancelado:
    "border-destructive/30 bg-destructive/5 text-destructive/80",
};

const ESTADO_LABEL: Record<EstadoPedido, string> = {
  nuevo: "Nuevo",
  completado: "Completado",
  cancelado: "Cancelado",
};

const BORDE_ESTADO: Record<EstadoPedido, string> = {
  nuevo: "border-l-verde-400",
  completado: "border-l-ink/10",
  cancelado: "border-l-destructive/40",
};

/* ── métrica individual ─────────────────────────────────────────────────── */

function Metrica({
  icon: Icon,
  valor,
  label,
  color,
}: {
  icon: React.ElementType;
  valor: number;
  label: string;
  color: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-gap-sm rounded-2xl border border-ink/5 bg-white p-gap-sm shadow-soft">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", color)}>
        <Icon size={16} strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <p className="font-lv-display text-h3 font-bold leading-none text-ink tabular-nums">
          {valor}
        </p>
        <p className="mt-[3px] truncate text-meta text-ink-soft/75">{label}</p>
      </div>
    </div>
  );
}

/* ── tarjeta de pedido ──────────────────────────────────────────────────── */

/**
 * Un pedido. Una acción principal —«Marcar entregado», a todo el ancho, que
 * pasa a `completado` y con eso suma el sello solo (`alCompletarPedido`)—, una
 * secundaria —«Avisar» por WhatsApp— y el resto en «⋯»: sello a mano, canjear
 * y cancelar (con confirmación; cancelar descuenta el sello).
 */
function TarjetaPedido({
  pedido,
  actualizando,
  resaltado,
  onEntregado,
  onAvisar,
  onMas,
}: {
  pedido: Pedido;
  actualizando: boolean;
  /** El pedido que pidió la URL (`&pedido=`): se marca un momento. */
  resaltado: boolean;
  onEntregado: () => void;
  onAvisar: () => void;
  onMas: () => void;
}) {
  const total = totalDePedido(pedido.lineas);
  const esProgramado = Boolean(pedido.programadoPara);
  const esPendiente = pedido.estado === "nuevo";

  return (
    <li
      id={`pedido-${pedido.id}`}
      className={cn(
        "overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-soft transition-opacity duration-300",
        "border-l-[3px]",
        BORDE_ESTADO[pedido.estado],
        actualizando && "opacity-60",
        resaltado && "ring-2 ring-verde-400",
      )}
    >
      {/* Banner de programado */}
      {esProgramado && (
        <div className="flex items-center gap-gap-xs border-b border-amber-100 bg-amber-50 px-gap-sm py-[8px]">
          <CalendarClock size={13} strokeWidth={2} className="shrink-0 text-amber-600" />
          <span className="font-lv-display text-meta font-semibold text-amber-700">
            Programado para el{" "}
            {FMT_PROGRAMADO.format(new Date(pedido.programadoPara!))}
          </span>
          {motivosDe(pedido).some((m) => MOTIVOS_HORA.has(m)) && (
            <span
              title={`Revisar hora: ${motivosDe(pedido)
                .filter((m) => MOTIVOS_HORA.has(m))
                .map((m) => MOTIVO_TEXTO[m] ?? m)
                .join(", ")}`}
              className="ml-auto inline-flex items-center gap-[3px] rounded-full border border-orange-200 bg-orange-50 px-[8px] py-[2px] font-lv-display text-meta font-semibold text-orange-700"
            >
              <TriangleAlert size={9} strokeWidth={2} />
              Revisar
            </span>
          )}
        </div>
      )}

      <div className="p-gap-sm">
        {/* Lo que hay que revisar de las líneas: producto que ya no existe,
            oculto, agotado, precio distinto o sin cifra. El pedido entró igual
            —ya había salido por WhatsApp— y aquí se dice qué mirar. */}
        {motivosDe(pedido).some((m) => !MOTIVOS_HORA.has(m)) && (
          <div
            role="status"
            className="mb-gap-xs flex items-start gap-[6px] rounded-xl border border-lv-amber/40 bg-lv-amber/10 px-gap-xs py-[6px] text-meta font-medium text-ink"
          >
            <TriangleAlert size={13} strokeWidth={2} className="mt-[2px] shrink-0" />
            <span>
              Revisar:{" "}
              {motivosDe(pedido)
                .filter((m) => !MOTIVOS_HORA.has(m))
                .map((m) => MOTIVO_TEXTO[m] ?? m)
                .join(" · ")}
            </span>
          </div>
        )}
        {/* Cabecera: fecha + código + badge de estado */}
        <div className="flex flex-wrap items-start justify-between gap-gap-xs">
          <div className="flex flex-col gap-[2px]">
            <time
              dateTime={pedido.createdAt}
              className="font-lv-display text-small font-semibold text-ink"
            >
              {FMT_CORTO.format(new Date(pedido.createdAt))}
            </time>
            {pedido.codigo && (
              <span className="font-lv-display text-meta font-semibold tracking-wide text-ink-soft/75">
                #{pedido.codigo}
              </span>
            )}
            {pedido.tarjeta && (
              <span className="inline-flex items-center gap-[3px] font-lv-display text-meta text-verde-700/80">
                <Stamp size={10} strokeWidth={2} />
                {pedido.tarjeta.sellos} de {pedido.tarjeta.metaSellos} sellos
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-gap-xs">
            {pedido.fueraDeHorario && !esProgramado && (
              <span className="inline-flex items-center gap-[3px] rounded-full border border-amber-200 bg-amber-50 px-[8px] py-[2px] font-lv-display text-meta font-semibold text-amber-700">
                <Clock size={9} strokeWidth={2} />
                Fuera de horario
              </span>
            )}
            {esPendiente && pedido.tarjeta?.premio && (
              <span className="inline-flex items-center gap-[3px] rounded-full border border-verde-300 bg-verde-50 px-[8px] py-[2px] font-lv-display text-meta font-semibold text-verde-700">
                <Gift size={9} strokeWidth={2} />
                Tiene premio: {pedido.tarjeta.premio}
              </span>
            )}
            <span
              className={cn(
                /* 12 px y sin mayúsculas espaciadas: a 10 px no se leían en el
                   móvil (`readable-font-size` de ui-ux-pro-max). */
                "inline-flex items-center rounded-full border px-[10px] py-[3px] font-lv-display text-meta font-semibold",
                ESTADO_BADGE[pedido.estado],
              )}
            >
              {ESTADO_LABEL[pedido.estado]}
            </span>
          </div>
        </div>

        {/* Líneas del pedido */}
        <ul className="mt-gap-sm space-y-[5px] border-t border-ink/5 pt-gap-sm">
          {pedido.lineas.map((linea) => (
            <li
              key={linea.id}
              className="flex flex-wrap items-baseline justify-between gap-x-gap-sm"
            >
              <span className="min-w-0 text-small text-ink">
                <span className="font-semibold tabular-nums text-ink-soft/75">
                  {linea.qty}×
                </span>{" "}
                {linea.name}
              </span>
              <span className="shrink-0 tabular-nums text-meta text-ink-soft/75">
                {formatMenuPrice(linea.price, linea.currency) || "—"}
              </span>
              {/* El precio cambió entre que el cliente vio la carta y pidió: se
                  enseñan los dos y quien atiende decide qué cobrar. */}
              {linea.precioCliente !== undefined && (
                <span className="basis-full text-meta font-medium text-ink">
                  El cliente vio{" "}
                  {formatMenuPrice(linea.precioCliente, linea.monedaCliente ?? linea.currency) || "—"}
                  {" · "}precio actual {formatMenuPrice(linea.price, linea.currency) || "—"}
                </span>
              )}
            </li>
          ))}
        </ul>

        {/* Entrega */}
        {(pedido.modoEntrega || pedido.direccion) && (
          <div className="mt-gap-sm flex items-start gap-[6px] border-t border-ink/5 pt-gap-sm text-meta text-ink-soft">
            <MapPin size={13} strokeWidth={1.8} className="mt-[1px] shrink-0 text-verde-500" />
            <span>
              {pedido.modoEntrega === "recogida"
                ? "Recogida en local"
                : pedido.zonaNombre
                  ? `Domicilio — ${pedido.zonaNombre}`
                  : "A domicilio"}
              {pedido.direccion ? ` · ${pedido.direccion}` : ""}
            </span>
          </div>
        )}

        {/* Footer: total + acciones */}
        <div className="mt-gap-sm flex flex-wrap items-center justify-between gap-gap-xs border-t border-ink/5 pt-gap-sm">
          <div className="flex flex-col">
            <span className="font-lv-display text-small font-semibold text-ink">
              {total
                ? `${total.total.toFixed(2)} ${currencyLabel(total.currency)}`
                : "Total a convenir"}
            </span>
            {pedido.costoEnvio != null && pedido.modoEntrega === "domicilio" && (
              <span className="text-meta tabular-nums text-ink-soft/75">
                Envío:{" "}
                {pedido.costoEnvio === 0
                  ? "gratis"
                  : `${pedido.costoEnvio.toFixed(2)} ${pedido.costoEnvioMoneda ?? ""}`}
              </span>
            )}
            {pedido.tasaUsada ? (
              <span className="text-meta tabular-nums text-ink-soft/75">
                Tasa: {new Intl.NumberFormat("en-US").format(pedido.tasaUsada)} CUP/USD
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-[6px]">
            {pedido.telefonoCliente && (
              <button
                type="button"
                onClick={onAvisar}
                disabled={actualizando}
                className={BTN_GHOST}
              >
                <MessageCircle size={13} strokeWidth={1.8} />
                Avisar
              </button>
            )}
            <button
              type="button"
              onClick={onMas}
              disabled={actualizando}
              aria-label={`Más acciones del pedido${pedido.codigo ? ` #${pedido.codigo}` : ""}`}
              className={cn(BTN_GHOST, "w-11 justify-center px-0")}
            >
              <Ellipsis size={16} strokeWidth={1.8} />
            </button>
          </div>
        </div>

        {esPendiente && (
          <BotonPrimario
            onClick={onEntregado}
            disabled={actualizando}
            className="mt-gap-sm w-full"
          >
            {actualizando ? (
              <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
            ) : (
              <Check size={16} strokeWidth={2.5} />
            )}
            Marcar entregado
          </BotonPrimario>
        )}
      </div>
    </li>
  );
}

/* ── vista principal ────────────────────────────────────────────────────── */

export function PedidosView({
  placeId,
  funciones,
  onVerPlanes,
}: {
  placeId: string;
  funciones: Funcion[];
  onVerPlanes: () => void;
}) {
  const cat = useCatalogo();
  const nav = usePanelNav();
  const { pendientes: pendientesArmazon, ultimoId } = usePedidosPendientes();
  const bloqueo = bloqueoDe(funciones, "whatsapp_pedido", cat);
  const tieneSellos = funciones.includes("cliente_frecuente");

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [fidelidad, setFidelidad] = useState<{
    activa: boolean;
    nombre?: string;
    negocioNombre?: string;
    slug?: string;
  }>({ activa: false });
  const [puede, setPuede] = useState(!bloqueo);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hayMas, setHayMas] = useState(false);
  /* La lista tal como está en pantalla, para el refresco de fondo. */
  const pedidosRef = useRef(pedidos);
  pedidosRef.current = pedidos;
  const [cargandoMas, setCargandoMas] = useState(false);
  const [actualizando, setActualizando] = useState<string | null>(null);
  const [tab, setTab] = useState<Pestana>("todos");
  /* La pestaña se decide una vez, con la primera carga: Pendientes si hay
     alguno (es lo que viene a atender quien abre Pedidos), Todos si no. */
  const pestanaElegida = useRef(false);
  const [busqueda, setBusqueda] = useState("");
  /* El pedido del menú «⋯» y el teléfono para «Sello a mano». */
  const [seleccionado, setSeleccionado] = useState<Pedido | null>(null);
  const [telefonoSello, setTelefonoSello] = useState("");
  /* El pedido que pide la URL (`&pedido=`, desde el push): se abre y se
     resalta un momento. */
  const [resaltado, setResaltado] = useState<string | null>(null);

  /**
   * Carga la primera página. `silencioso` es el refresco de fondo: no pinta el
   * esqueleto ni borra un error a medias y conserva las páginas anteriores que
   * el dueño ya abrió. El aviso de «pedido nuevo» ya no sale de aquí: lo da el
   * armazón, en cualquier pantalla (`pedidos-pendientes.tsx`).
   */
  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) {
      setCargando(true);
      setError(null);
    }
    try {
      const res = await fetch(`/api/pedidos?placeId=${encodeURIComponent(placeId)}`);
      if (!res.ok) {
        if (!silencioso) setError("No se pudo cargar el historial.");
        return;
      }
      const data = (await res.json()) as {
        pedidos?: Pedido[];
        puede?: boolean;
        hayMas?: boolean;
        fidelidad?: { activa: boolean; nombre?: string; negocioNombre?: string; slug?: string };
      };
      const pagina = data.pedidos ?? [];
      if (!silencioso) {
        setPedidos(pagina);
      } else {
        /* La página fresca manda; detrás, lo más antiguo que ya estaba
           cargado y que esta página no cubre. */
        const prev = pedidosRef.current;
        const ultima = pagina.at(-1)?.createdAt;
        const antiguos = ultima ? prev.filter((p) => p.createdAt < ultima) : [];
        setPedidos([...pagina, ...antiguos]);
      }
      if (!pestanaElegida.current) {
        pestanaElegida.current = true;
        if (pagina.some((p) => p.estado === "nuevo")) setTab("pendientes");
      }
      if (!silencioso) setHayMas(data.hayMas ?? false);
      setPuede(data.puede ?? false);
      setFidelidad(data.fidelidad ?? { activa: false });
    } catch {
      if (!silencioso) setError("No se pudo cargar el historial. Revisa la conexión.");
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, [placeId]);

  /* Los anteriores al último que hay en pantalla. Antes el historial se
     cortaba en 100 sin forma de ver más. */
  const cargarMas = useCallback(async () => {
    const ultima = pedidos.at(-1)?.createdAt;
    if (!ultima || cargandoMas) return;
    setCargandoMas(true);
    try {
      const res = await fetch(
        `/api/pedidos?placeId=${encodeURIComponent(placeId)}&antes=${encodeURIComponent(ultima)}`,
      );
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { pedidos?: Pedido[]; hayMas?: boolean };
      setPedidos((prev) => {
        const conocidos = new Set(prev.map((p) => p.id));
        return [...prev, ...(data.pedidos ?? []).filter((p) => !conocidos.has(p.id))];
      });
      setHayMas(data.hayMas ?? false);
    } catch {
      toast.error("No se pudieron cargar los pedidos anteriores. Revisa la conexión.");
    } finally {
      setCargandoMas(false);
    }
  }, [pedidos, placeId, cargandoMas]);

  useEffect(() => { void cargar(); }, [cargar]);

  /* La lista se recarga en silencio cuando el armazón ve que algo cambió (un
     pedido nuevo, o uno atendido desde otro teléfono). El armazón pregunta
     cada minuto y al volver a la pestaña con unos pocos bytes; la lista entera
     solo se baja cuando hace falta. La primera lectura no recarga: la lista ya
     se acaba de pedir. */
  const vistoArmazon = useRef(false);
  useEffect(() => {
    if (pendientesArmazon === null) return;
    if (!vistoArmazon.current) {
      vistoArmazon.current = true;
      return;
    }
    void cargar(true);
  }, [pendientesArmazon, ultimoId, cargar]);

  /* `&pedido=` en la URL (el push de «pedido nuevo» lleva ahí): en cuanto el
     pedido está en la lista, se enseña en Todos, se lleva a la vista y se
     resalta. El parámetro se quita para que no vuelva a saltar al navegar. */
  useEffect(() => {
    if (cargando) return;
    const url = new URL(window.location.href);
    const id = url.searchParams.get("pedido");
    if (!id) return;
    url.searchParams.delete("pedido");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    if (!pedidosRef.current.some((p) => p.id === id)) return;
    setTab("todos");
    setResaltado(id);
    window.setTimeout(() => {
      document.getElementById(`pedido-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    const t = window.setTimeout(() => setResaltado(null), 4000);
    return () => window.clearTimeout(t);
  }, [cargando]);

  function abrirAcciones(pedido: Pedido) {
    setSeleccionado(pedido);
    nav.abrirHoja("acciones");
  }

  function abrirSello(pedido: Pedido) {
    setTelefonoSello(pedido.telefonoCliente ?? "");
    nav.abrirHoja("sello");
  }

  /* Un enlace directo a `&hoja=acciones` no trae pedido: no hay nada que enseñar. */
  useEffect(() => {
    if (nav.hoja === "acciones" && !seleccionado) nav.cerrarHoja();
  }, [nav, seleccionado]);

  /** WhatsApp al cliente, con el código del pedido ya escrito. */
  function avisarPorWhatsapp(pedido: Pedido) {
    const telefono = pedido.telefonoCliente?.replace(/\D/g, "");
    if (!telefono) return;
    const negocio = fidelidad.negocioNombre;
    const texto = `Hola, te escribimos${negocio ? ` de ${negocio}` : ""} por tu pedido${pedido.codigo ? ` #${pedido.codigo}` : ""}. `;
    window.open(
      `https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  /**
   * El mensaje para avisar al cliente de su sello.
   *
   * Va con el enlace de su tarjeta y con el premio que le toca, si ya lo tiene:
   * el aviso sirve para que vuelva, no solo para contarle un número.
   */
  function avisarCliente(pedido: Pedido, sello: ResultadoSello) {
    const tarjeta = sello.tarjeta;
    const telefono = pedido.telefonoCliente?.replace(/\D/g, "");
    if (!tarjeta || !telefono || !fidelidad.slug) return;

    /* El token viene del sello y no del pedido: en el primer pedido de un
       cliente la tarjeta acaba de nacer y la fila que se pintó no la tenía. */
    const enlace = `${window.location.origin}/m/${fidelidad.slug}/tarjeta/${sello.token ?? ""}`;
    const negocio = fidelidad.negocioNombre ?? "el negocio";
    const listo = tarjeta.listas[0];

    const texto = listo
      ? `Hola, sumaste un sello en ${negocio}. ¡Ya tienes tu premio: ${listo.premio}! Pídelo en tu próximo pedido. Mira tu tarjeta: ${enlace}`
      : tarjeta.siguiente
        ? `Hola, sumaste un sello en ${negocio}. Llevas ${tarjeta.sellos} de ${tarjeta.siguiente.sellos}: te ${tarjeta.siguiente.faltan === 1 ? "falta 1" : `faltan ${tarjeta.siguiente.faltan}`} para ${tarjeta.siguiente.premio}. Mira tu tarjeta: ${enlace}`
        : `Hola, sumaste un sello en ${negocio}. Mira tu tarjeta: ${enlace}`;

    window.open(
      `https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function cambiarEstado(id: string, estado: EstadoPedido) {
    if (actualizando) return;
    setActualizando(id);
    const pedido = pedidos.find((p) => p.id === id) ?? null;
    try {
      const res = await fetch("/api/pedidos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId, id, estado }),
      });
      if (!res.ok) {
        toast.error("No se pudo cambiar. Revisa la conexión.");
        return;
      }

      const data = (await res.json().catch(() => null)) as {
        sello?: ResultadoSello;
        revertido?: boolean;
      } | null;

      setPedidos((prev) => prev.map((p) => p.id === id ? { ...p, estado } : p));

      const sello = data?.sello;
      if (sello?.estado === "sumado" && sello.tarjeta) {
        const meta = sello.tarjeta.siguiente ?? sello.tarjeta.metaFinal;
        const quien = pedido?.tarjeta?.nombre?.trim() || sello.telefonoEnmascarado || "el cliente";
        const texto = `Entregado · +1 sello para ${quien} · ${sello.tarjeta.sellos} de ${meta.sellos}`;
        const puedeAvisar = Boolean(pedido?.telefonoCliente && fidelidad.slug);
        toast.success(texto, {
          action:
            pedido && puedeAvisar
              ? {
                  label: "Avisar al cliente",
                  onClick: () => avisarCliente(pedido, sello),
                }
              : undefined,
        });
        /* El pedido se vuelve a leer para que la etiqueta de la tarjeta y el
           «X de Y sellos» de la ficha enseñen el saldo de ahora. */
        void cargar();
      } else if (sello?.estado === "sin_comprobar") {
        toast.info("Entregado. No sumó sello: no se pudo comprobar la compra mínima", {
          action:
            pedido && tieneSellos
              ? { label: "Dar sello a mano", onClick: () => abrirSello(pedido) }
              : undefined,
        });
      } else if (sello?.estado === "bajo_minimo") {
        const minimo = sello.minimo;
        toast.info(
          `Entregado. Bajo la compra mínima (${minimo?.monto ?? ""} ${currencyLabel(minimo?.moneda ?? "")}): no suma sello`,
        );
      } else if (sello?.estado === "sin_telefono") {
        toast.info("Entregado. Sin teléfono: no suma sello");
      } else if (sello?.estado === "duplicado") {
        toast.success("Pedido marcado como entregado. Ese pedido ya tenía su sello.");
        void cargar();
      } else if (estado === "completado") {
        toast.success("Pedido marcado como entregado.");
      } else if (data?.revertido) {
        toast.success("Pedido cancelado. Se descontó su sello.");
        void cargar();
      } else {
        toast.success("Pedido cancelado.");
      }
    } catch {
      toast.error("No se pudo cambiar. Revisa la conexión.");
    } finally {
      setActualizando(null);
    }
  }

  async function canjearPremio(pedido: Pedido) {
    const tarjeta = pedido.tarjeta;
    const premio = tarjeta?.premios[0];
    if (!tarjeta || !premio) {
      toast.info("Ese premio no está disponible.");
      return;
    }
    /* El canje no tiene inversa: se pregunta antes. */
    const quien = tarjeta.nombre?.trim() || tarjeta.telefonoEnmascarado;
    if (!window.confirm(`¿Canjear «${premio.premio}» para ${quien}?`)) return;
    try {
      const res = await fetch(
        `/api/places/${placeId}/clientes-frecuentes/${tarjeta.clienteId}/canje`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metaIndice: premio.indice }),
        },
      );
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo canjear el premio.");
        return;
      }
      toast.success(`Premio canjeado: ${premio.premio}`);
      void cargar();
    } catch {
      toast.error("No se pudo canjear. Revisa la conexión.");
    }
  }

  /* ── métricas ─────────────────────────────────────────────────────────── */

  const nuevos = pedidos.filter((p) => p.estado === "nuevo");
  const programadosPendientes = nuevos.filter((p) => Boolean(p.programadoPara));
  const hayProgramados = pedidos.some((p) => p.programadoPara);

  /* ── lista filtrada ───────────────────────────────────────────────────── */

  const lista = pedidos
    .filter((p) =>
      tab === "pendientes"
        ? p.estado === "nuevo"
        : tab === "programados"
          ? Boolean(p.programadoPara)
          : true,
    )
    .filter((p) => !busqueda || Boolean(p.codigo?.includes(busqueda)));

  const pestanas: { id: Pestana; label: string; n: number }[] = [
    { id: "pendientes", label: "Pendientes", n: nuevos.length },
    { id: "todos", label: "Todos", n: pedidos.length },
    ...(hayProgramados
      ? [{ id: "programados" as const, label: "Programados", n: pedidos.filter((p) => p.programadoPara).length }]
      : []),
  ];

  /* ── render ───────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-1 flex-col gap-gap-md">
      {/* ── Métricas ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-gap-sm sm:grid-cols-4">
        <Metrica
          icon={ShoppingBag}
          valor={nuevos.length}
          label="Pendientes"
          color="bg-verde-50 text-verde-600"
        />
        <Metrica
          icon={CalendarClock}
          valor={programadosPendientes.length}
          label="Programados"
          color="bg-amber-50 text-amber-600"
        />
        <Metrica
          icon={Check}
          valor={pedidos.filter((p) => p.estado === "completado").length}
          label="Entregados"
          color="bg-sand-deep text-ink-soft"
        />
        <Metrica
          icon={X}
          valor={pedidos.filter((p) => p.estado === "cancelado").length}
          label="Cancelados"
          color="bg-destructive/10 text-destructive/70"
        />
      </div>

      {/* ── Aviso sin plan ────────────────────────────────────────────── */}
      {bloqueo && !puede && (
        <div className="rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft">
          <div className="flex items-center gap-gap-sm">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sand-deep text-verde-600">
              <ClipboardList size={18} strokeWidth={1.8} />
            </span>
            <div>
              <p className="font-lv-display text-small font-semibold text-ink">
                Activa el módulo de pedidos
              </p>
              <p className="text-meta text-ink-soft/75">{bloqueo}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onVerPlanes}
            className="mt-gap-md inline-flex h-11 cursor-pointer items-center gap-gap-xs rounded-full bg-verde-400 px-gap-md font-lv-display text-meta font-semibold text-verde-950 shadow-primary-halo transition-colors duration-300 ease-outquint hover:bg-verde-300"
          >
            Ver planes
            <ChevronRight size={14} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* ── Controles: tabs + búsqueda + actualizar ──────────────────── */}
      <div className="flex flex-wrap items-center gap-gap-sm">
        {/* Fila que se desliza en horizontal en el móvil, sin barra visible y
            hasta el borde, para que se note que hay más. */}
        <div
          role="tablist"
          aria-label="Qué pedidos ver"
          className="scrollbar-hide -mx-gap-sm flex max-w-full gap-[6px] overflow-x-auto px-gap-sm sm:mx-0 sm:px-0"
        >
          {pestanas.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex h-11 shrink-0 cursor-pointer items-center gap-[6px] rounded-full border px-gap-sm font-lv-display text-meta font-semibold transition-colors duration-300 ease-outquint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40",
                tab === t.id
                  ? "border-verde-400 bg-verde-400 text-verde-950"
                  : "border-ink/10 bg-white text-ink hover:border-verde-300",
              )}
            >
              {t.label}
              <span className="tabular-nums opacity-75">{t.n}</span>
            </button>
          ))}
        </div>

        <div className="relative ml-auto">
          <Search
            size={13}
            strokeWidth={2}
            className="pointer-events-none absolute left-gap-sm top-1/2 -translate-y-1/2 text-ink-soft/50"
          />
          <input
            type="search"
            placeholder="Código #XXXXX…"
            value={busqueda}
            onChange={(e) =>
              setBusqueda(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
            }
            className="h-11 w-[180px] rounded-full border border-ink/10 bg-white pl-8 pr-gap-sm font-lv-display text-meta text-ink outline-none placeholder:text-ink-soft/75 focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20"
          />
        </div>

        <button
          type="button"
          onClick={() => void cargar()}
          disabled={cargando}
          className={BTN_GHOST}
        >
          <RefreshCw
            size={13}
            strokeWidth={1.8}
            className={cn(cargando && "animate-spin")}
          />
          Actualizar
        </button>
      </div>

      {/* ── Estados: cargando / error / vacío / lista ─────────────────── */}
      {cargando ? (
        <div className="flex items-center gap-gap-sm rounded-2xl border border-ink/5 bg-white p-gap-md text-small text-ink-soft/75 shadow-soft">
          <Loader2 size={16} strokeWidth={1.8} className="animate-spin text-verde-500" />
          Cargando pedidos…
        </div>
      ) : error ? (
        <p
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/5 p-gap-md text-small font-medium text-ink"
        >
          {error}
        </p>
      ) : lista.length === 0 ? (
        <div className="rounded-2xl border border-ink/5 bg-white p-gap-lg text-center shadow-soft">
          <span className="mx-auto mb-gap-sm grid size-12 place-items-center rounded-2xl bg-sand-deep text-verde-600">
            <ClipboardList size={22} strokeWidth={1.5} />
          </span>
          <p className="font-lv-display text-small font-semibold text-ink">
            {busqueda
              ? "Ningún pedido coincide con esa búsqueda"
              : tab === "programados"
                ? "No hay pedidos programados aún"
                : tab === "pendientes"
                  ? "No hay pedidos pendientes"
                  : puede
                  ? "Todavía no hay pedidos"
                  : "Sin pedidos registrados"}
          </p>
          {!busqueda && tab === "todos" && puede && (
            <p className="mt-[6px] text-meta text-ink-soft/75">
              Cuando un cliente toque «Realizar pedido» en tu carta, aparece aquí.
            </p>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-gap-sm">
          {lista.map((pedido) => (
            <TarjetaPedido
              key={pedido.id}
              pedido={pedido}
              actualizando={actualizando === pedido.id}
              resaltado={resaltado === pedido.id}
              onEntregado={() => void cambiarEstado(pedido.id, "completado")}
              onAvisar={() => avisarPorWhatsapp(pedido)}
              onMas={() => abrirAcciones(pedido)}
            />
          ))}
        </ul>
      )}

      {/* El historial va por páginas de 100. Botón y no scroll infinito: con
          datos móviles caros, cargar más tiene que ser una decisión, y con
          estado de carga mientras llega (`Submit Feedback`, ui-ux-pro-max). */}
      {hayMas && !cargando && (
        <button
          type="button"
          onClick={() => void cargarMas()}
          disabled={cargandoMas}
          className="mx-auto mt-gap-md inline-flex h-11 cursor-pointer items-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-lg font-lv-display text-meta font-semibold text-ink transition-colors duration-300 ease-outquint hover:border-verde-300 hover:text-verde-700 disabled:pointer-events-none disabled:opacity-60"
        >
          {cargandoMas && <Loader2 size={15} strokeWidth={1.8} className="animate-spin" aria-hidden />}
          {cargandoMas ? "Cargando…" : "Ver pedidos anteriores"}
        </button>
      )}

      {/* «⋯» de un pedido: lo que no es lo de todos los días. */}
      <HojaPanel
        open={nav.hoja === "acciones" && seleccionado !== null}
        onOpenChange={(open) => {
          if (!open) nav.cerrarHoja();
        }}
        titulo={seleccionado?.codigo ? `Pedido #${seleccionado.codigo}` : "Pedido"}
      >
        {seleccionado && (
          <div className="flex flex-col gap-gap-xs">
            {tieneSellos && seleccionado.telefonoCliente && (
              <BotonSecundario
                className="w-full !justify-start"
                onClick={() => abrirSello(seleccionado)}
              >
                <Stamp size={16} strokeWidth={1.8} />
                Sello a mano
              </BotonSecundario>
            )}
            {seleccionado.tarjeta?.premio && seleccionado.estado === "nuevo" && (
              <BotonSecundario
                className="w-full !justify-start"
                onClick={() => {
                  nav.cerrarHoja();
                  void canjearPremio(seleccionado);
                }}
              >
                <Gift size={16} strokeWidth={1.8} />
                Canjear «{seleccionado.tarjeta.premio}»
              </BotonSecundario>
            )}
            {seleccionado.estado === "nuevo" && (
              <BotonSecundario
                className="w-full !justify-start !text-destructive"
                onClick={() => {
                  if (
                    !window.confirm(
                      seleccionado.tarjeta
                        ? "¿Cancelar este pedido? Si sumó sello, se le descuenta."
                        : "¿Cancelar este pedido?",
                    )
                  ) {
                    return;
                  }
                  nav.cerrarHoja();
                  void cambiarEstado(seleccionado.id, "cancelado");
                }}
              >
                <X size={16} strokeWidth={2} />
                Cancelar pedido
              </BotonSecundario>
            )}
            {seleccionado.estado !== "nuevo" && !(tieneSellos && seleccionado.telefonoCliente) && (
              <p className="text-meta text-ink-soft/75">
                Este pedido ya está {seleccionado.estado === "completado" ? "entregado" : "cancelado"}.
              </p>
            )}
          </div>
        )}
      </HojaPanel>

      {tieneSellos && (
        <HojaPanel
          open={nav.hoja === "sello"}
          onOpenChange={(open) => {
            if (!open) nav.cerrarHoja();
          }}
          titulo="Sello a mano"
          descripcion="Para cuando el pedido ya estaba entregado y no sumó sello."
        >
          <DarSello
            key={telefonoSello}
            placeId={placeId}
            telefonoInicial={telefonoSello}
            onHecho={() => {
              nav.cerrarHoja();
              void cargar(true);
            }}
          />
        </HojaPanel>
      )}
    </div>
  );
}
