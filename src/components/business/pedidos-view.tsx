"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  Check,
  ChevronRight,
  ClipboardList,
  Clock,
  Gift,
  Loader2,
  MapPin,
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

type EstadoPedido = "nuevo" | "completado" | "cancelado";

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
  programadoPara?: string | null;
  createdAt: string;
  telefonoCliente?: string | null;
  /** La tarjeta de sellos de quien hizo el pedido, si la tiene. */
  tarjeta?: TarjetaResumen | null;
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
  "inline-flex h-9 cursor-pointer items-center gap-[5px] rounded-full border border-ink/10 bg-white px-gap-sm font-lv-display text-meta font-semibold text-ink-soft/75 transition-colors duration-300 ease-outquint hover:border-verde-300 hover:text-verde-700 disabled:pointer-events-none disabled:opacity-40";

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

function TarjetaPedido({
  pedido,
  actualizando,
  onCambiar,
  onCanjear,
  onDarSello,
}: {
  pedido: Pedido;
  actualizando: boolean;
  onCambiar: (id: string, estado: EstadoPedido) => void;
  onCanjear: (pedido: Pedido) => void;
  onDarSello: () => void;
}) {
  const total = totalDePedido(pedido.lineas);
  const esProgramado = Boolean(pedido.programadoPara);
  const esPendiente = pedido.estado === "nuevo";

  return (
    <li
      className={cn(
        "overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-soft transition-opacity duration-300",
        "border-l-[3px]",
        BORDE_ESTADO[pedido.estado],
        actualizando && "opacity-60",
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
          {pedido.revisarHora && (
            <span
              title={`Revisar hora: ${pedido.revisarMotivo ?? ""}`}
              className="ml-auto inline-flex items-center gap-[3px] rounded-full border border-orange-200 bg-orange-50 px-[8px] py-[2px] font-lv-display text-[10px] font-semibold text-orange-700"
            >
              <TriangleAlert size={9} strokeWidth={2} />
              Revisar
            </span>
          )}
        </div>
      )}

      <div className="p-gap-sm">
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
              <span className="font-lv-display text-meta font-semibold tracking-wide text-ink-soft/60">
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
              <span className="inline-flex items-center gap-[3px] rounded-full border border-amber-200 bg-amber-50 px-[8px] py-[2px] font-lv-display text-[10px] font-semibold text-amber-700">
                <Clock size={9} strokeWidth={2} />
                Fuera de horario
              </span>
            )}
            {esPendiente && pedido.tarjeta?.premio && (
              <span className="inline-flex items-center gap-[3px] rounded-full border border-verde-300 bg-verde-50 px-[8px] py-[2px] font-lv-display text-[10px] font-semibold text-verde-700">
                <Gift size={9} strokeWidth={2} />
                Tiene premio: {pedido.tarjeta.premio}
              </span>
            )}
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-[10px] py-[3px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em]",
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
              className="flex items-baseline justify-between gap-gap-sm"
            >
              <span className="min-w-0 text-small text-ink">
                <span className="font-semibold tabular-nums text-ink-soft/60">
                  {linea.qty}×
                </span>{" "}
                {linea.name}
              </span>
              <span className="shrink-0 tabular-nums text-meta text-ink-soft/60">
                {formatMenuPrice(linea.price, linea.currency) || "—"}
              </span>
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
              <span className="text-meta tabular-nums text-ink-soft/60">
                Envío:{" "}
                {pedido.costoEnvio === 0
                  ? "gratis"
                  : `${pedido.costoEnvio.toFixed(2)} ${pedido.costoEnvioMoneda ?? ""}`}
              </span>
            )}
            {pedido.tasaUsada ? (
              <span className="text-meta tabular-nums text-ink-soft/60">
                Tasa: {new Intl.NumberFormat("en-US").format(pedido.tasaUsada)} CUP/USD
              </span>
            ) : null}
          </div>

          {esPendiente && (
            <div className="flex flex-wrap items-center gap-[6px]">
              {pedido.tarjeta?.premio && (
                <button
                  type="button"
                  onClick={() => onCanjear(pedido)}
                  disabled={actualizando}
                  className={BTN_GHOST}
                >
                  <Gift size={13} strokeWidth={1.8} />
                  Canjear
                </button>
              )}
              {pedido.telefonoCliente && (
                <button
                  type="button"
                  onClick={onDarSello}
                  disabled={actualizando}
                  className={BTN_GHOST}
                  title="Si el pedido ya estaba entregado y no sumó sello"
                >
                  <Stamp size={13} strokeWidth={1.8} />
                  Sello a mano
                </button>
              )}
              <button
                type="button"
                onClick={() => onCambiar(pedido.id, "completado")}
                disabled={actualizando}
                className="inline-flex h-9 cursor-pointer items-center gap-[5px] rounded-full bg-verde-400 px-gap-sm font-lv-display text-meta font-semibold text-verde-950 transition-colors duration-300 ease-outquint hover:bg-verde-300 disabled:pointer-events-none disabled:opacity-40"
              >
                {actualizando ? (
                  <Loader2 size={13} strokeWidth={1.8} className="animate-spin" />
                ) : (
                  <Check size={13} strokeWidth={2.5} />
                )}
                Entregado
              </button>
              <button
                type="button"
                onClick={() => onCambiar(pedido.id, "cancelado")}
                disabled={actualizando}
                className={BTN_GHOST}
              >
                <X size={13} strokeWidth={2} />
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/* ── vista principal ────────────────────────────────────────────────────── */

export function PedidosView({
  placeId,
  funciones,
  onVerPlanes,
  onVerClientes,
}: {
  placeId: string;
  funciones: Funcion[];
  onVerPlanes: () => void;
  /** Lleva a «Frecuentes» para dar un sello a mano o canjear. */
  onVerClientes?: () => void;
}) {
  const cat = useCatalogo();
  const bloqueo = bloqueoDe(funciones, "whatsapp_pedido", cat);

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
  const [actualizando, setActualizando] = useState<string | null>(null);
  const [tab, setTab] = useState<"todos" | "programados">("todos");
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/pedidos?placeId=${encodeURIComponent(placeId)}`);
      if (!res.ok) { setError("No se pudo cargar el historial."); return; }
      const data = (await res.json()) as {
        pedidos?: Pedido[];
        puede?: boolean;
        fidelidad?: { activa: boolean; nombre?: string; negocioNombre?: string; slug?: string };
      };
      setPedidos(data.pedidos ?? []);
      setPuede(data.puede ?? false);
      setFidelidad(data.fidelidad ?? { activa: false });
    } catch {
      setError("No se pudo cargar el historial. Revisa la conexión.");
    } finally {
      setCargando(false);
    }
  }, [placeId]);

  useEffect(() => { void cargar(); }, [cargar]);

  /* Al volver de WhatsApp (o de cualquier tab), refrescar. */
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void cargar();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [cargar]);

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
        const texto = `Sello sumado · ${sello.telefonoEnmascarado ?? ""} · ${sello.tarjeta.sellos} de ${meta.sellos}`;
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
        toast.info("No sumó sello: no se pudo comprobar la compra mínima", {
          action: onVerClientes
            ? { label: "Dar sello a mano", onClick: onVerClientes }
            : undefined,
        });
      } else if (sello?.estado === "bajo_minimo") {
        const minimo = sello.minimo;
        toast.info(
          `No llega a la compra mínima (${minimo?.monto ?? ""} ${currencyLabel(minimo?.moneda ?? "")})`,
        );
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
    .filter((p) => tab === "programados" ? Boolean(p.programadoPara) : true)
    .filter((p) => !busqueda || Boolean(p.codigo?.includes(busqueda)));

  /* ── render ───────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-1 flex-col gap-gap-md">
      <h1 className="sr-only">Pedidos</h1>

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
          color="bg-destructive/8 text-destructive/70"
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
            className="mt-gap-md inline-flex h-10 cursor-pointer items-center gap-gap-xs rounded-full bg-verde-400 px-gap-md font-lv-display text-meta font-semibold text-verde-950 shadow-primary-halo transition-colors duration-300 ease-outquint hover:bg-verde-300"
          >
            Ver planes
            <ChevronRight size={14} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* ── Controles: tabs + búsqueda + actualizar ──────────────────── */}
      <div className="flex flex-wrap items-center gap-gap-sm">
        {hayProgramados && (
          <div className="flex gap-[6px]">
            {(["todos", "programados"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "h-9 rounded-full border px-gap-sm font-lv-display text-meta font-semibold transition-colors duration-300 ease-outquint",
                  tab === t
                    ? "border-verde-400 bg-verde-400 text-verde-950"
                    : "border-ink/10 bg-white text-ink hover:border-verde-300",
                )}
              >
                {t === "todos" ? "Todos" : "Programados"}
              </button>
            ))}
          </div>
        )}

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
            className="h-9 w-[180px] rounded-full border border-ink/10 bg-white pl-8 pr-gap-sm font-lv-display text-meta text-ink outline-none placeholder:text-ink-soft/40 focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20"
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
                : puede
                  ? "Todavía no hay pedidos"
                  : "Sin pedidos registrados"}
          </p>
          {!busqueda && tab === "todos" && puede && (
            <p className="mt-[6px] text-meta text-ink-soft/60">
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
              onCambiar={(id, estado) => void cambiarEstado(id, estado)}
              onCanjear={(p) => void canjearPremio(p)}
              onDarSello={() => onVerClientes?.()}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
