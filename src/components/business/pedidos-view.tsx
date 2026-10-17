"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  ClipboardList,
  Loader2,
  MapPin,
  RefreshCw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn, currencyLabel, formatMenuPrice } from "@/lib/utils";
import { totalDePedido, type LineaPedido } from "@/lib/pedido";
import { bloqueoDe, type Funcion } from "@/lib/plans";
import { useCatalogo } from "@/providers/catalogo-provider";

/**
 * La sección «Pedidos» del panel del negocio.
 *
 * Es el historial de lo que entró por el catálogo online. El pedido sigue
 * llegando por WhatsApp —aquí no se cobra ni se responde—; esto es la copia
 * que queda cuando el chat ya se perdió, con lo que se pidió, a qué precio y
 * dónde se entrega.
 *
 * Se lee aunque el plan se haya caído: los pedidos que ya entraron son del
 * negocio. El candado solo aparece para explicar por qué no entran nuevos.
 */

type EstadoPedido = "nuevo" | "completado" | "cancelado";

interface Pedido {
  id: string;
  lineas: LineaPedido[];
  direccion: string | null;
  estado: EstadoPedido;
  createdAt: string;
}

const ESTADO: Record<EstadoPedido, { label: string; clase: string }> = {
  nuevo: {
    label: "Nuevo",
    clase: "border-verde-200 bg-verde-50 text-verde-700",
  },
  completado: {
    label: "Completado",
    clase: "border-ink/10 bg-sand text-ink-soft",
  },
  cancelado: {
    label: "Cancelado",
    clase: "border-destructive/30 bg-destructive/10 text-ink",
  },
};

/* Una sola instancia: se formatea una fecha por pedido y `Intl` no es barato. */
const FECHA = new Intl.DateTimeFormat("es-CU", {
  dateStyle: "medium",
  timeStyle: "short",
});

const BOTON_SECUNDARIO =
  "inline-flex h-10 cursor-pointer items-center gap-[6px] rounded-full border border-ink/10 bg-white px-gap-sm font-lv-display text-meta font-semibold text-ink-soft/75 transition-colors duration-500 ease-outquint hover:border-verde-300 hover:text-verde-600 disabled:pointer-events-none disabled:opacity-50";

export function PedidosView({
  placeId,
  funciones,
  onVerPlanes,
}: {
  placeId: string;
  /** Todo lo que puede hacer el negocio, resuelto en el servidor. */
  funciones: Funcion[];
  /** Lleva a la sección «Planes» cuando la función no entra. */
  onVerPlanes: () => void;
}) {
  const cat = useCatalogo();
  const bloqueo = bloqueoDe(funciones, "whatsapp_pedido", cat);

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [puede, setPuede] = useState(!bloqueo);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actualizando, setActualizando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/pedidos?placeId=${encodeURIComponent(placeId)}`,
      );
      if (!res.ok) {
        setError("No se pudo cargar el historial. Revisa la conexión.");
        return;
      }
      const data = (await res.json()) as {
        pedidos?: Pedido[];
        puede?: boolean;
      };
      setPedidos(data.pedidos ?? []);
      setPuede(data.puede ?? false);
    } catch {
      setError("No se pudo cargar el historial. Revisa la conexión.");
    } finally {
      setCargando(false);
    }
  }, [placeId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function cambiarEstado(id: string, estado: EstadoPedido) {
    if (actualizando) return;
    setActualizando(id);
    try {
      const res = await fetch("/api/pedidos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId, id, estado }),
      });
      if (!res.ok) {
        toast.error("No se pudo cambiar. Revisa la conexión: no se cambió nada.");
        return;
      }
      setPedidos((prev) =>
        prev.map((pedido) =>
          pedido.id === id ? { ...pedido, estado } : pedido,
        ),
      );
      toast.success(
        estado === "completado"
          ? "Pedido marcado como completado."
          : "Pedido cancelado.",
      );
    } catch {
      toast.error("No se pudo cambiar. Revisa la conexión: no se cambió nada.");
    } finally {
      setActualizando(null);
    }
  }

  return (
    <>
      <h1 className="sr-only">Pedidos</h1>

      <div className="flex flex-1 flex-col gap-gap-md">
        <div className="flex flex-wrap items-center justify-between gap-gap-sm">
          <p className="max-w-[62ch] text-small text-ink-soft/75">
            Lo que entra por tu catálogo, con lo que se pidió y dónde se
            entrega. La conversación y el cobro siguen en WhatsApp.
          </p>
          <button
            type="button"
            onClick={() => void cargar()}
            disabled={cargando}
            className={BOTON_SECUNDARIO}
          >
            <RefreshCw
              size={14}
              strokeWidth={1.8}
              className={cn(cargando && "animate-spin")}
            />
            Actualizar
          </button>
        </div>

        {/* Sin la función no entran pedidos nuevos. Se dice con su texto de
            candado y el botón a planes; el historial, si lo hay, se enseña
            debajo. */}
        {bloqueo && !puede && (
          <section className="rounded-2xl border border-ink/5 bg-white p-gap-md">
            <h2 className="flex items-center gap-gap-xs font-lv-display text-body font-semibold text-ink">
              <ClipboardList
                size={18}
                strokeWidth={1.8}
                className="text-verde-600"
              />
              Historial de pedidos
            </h2>
            <p className="mt-gap-xs max-w-[62ch] text-small text-ink-soft/75">
              {bloqueo}: con los pedidos activos, cada carrito enviado desde tu
              carta queda aquí.
            </p>
            <button
              type="button"
              onClick={onVerPlanes}
              className="mt-gap-md inline-flex h-11 cursor-pointer items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-all duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98]"
            >
              Ver los planes
            </button>
          </section>
        )}

        {cargando ? (
          <div className="flex items-center gap-gap-xs rounded-2xl border border-ink/5 bg-white p-gap-md text-small text-ink-soft/75">
            <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
            Cargando pedidos…
          </div>
        ) : error ? (
          <p
            role="alert"
            className="rounded-2xl border border-destructive/40 bg-destructive/10 p-gap-md text-small font-medium text-ink"
          >
            {error}
          </p>
        ) : pedidos.length === 0 ? (
          puede && (
            <section className="rounded-2xl border border-ink/5 bg-white p-gap-md">
              <h2 className="flex items-center gap-gap-xs font-lv-display text-body font-semibold text-ink">
                <ClipboardList
                  size={18}
                  strokeWidth={1.8}
                  className="text-verde-600"
                />
                Todavía no hay pedidos
              </h2>
              <p className="mt-gap-xs max-w-[62ch] text-small text-ink-soft/75">
                Cuando alguien mande un pedido desde tu carta, aparece aquí con
                sus productos, el total y la dirección de entrega.
              </p>
            </section>
          )
        ) : (
          <ul className="flex flex-col gap-gap-sm">
            {pedidos.map((pedido) => {
              const total = totalDePedido(pedido.lineas);
              const estado = ESTADO[pedido.estado];
              const ocupado = actualizando === pedido.id;

              return (
                <li
                  key={pedido.id}
                  className="rounded-2xl border border-ink/5 bg-white p-gap-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-gap-xs">
                    <time
                      dateTime={pedido.createdAt}
                      className="font-lv-display text-small font-semibold text-ink"
                    >
                      {FECHA.format(new Date(pedido.createdAt))}
                    </time>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-[10px] py-[3px] font-lv-display text-[11px] font-semibold uppercase tracking-[0.12em]",
                        estado.clase,
                      )}
                    >
                      {estado.label}
                    </span>
                  </div>

                  <ul className="mt-gap-sm flex flex-col gap-[6px] border-t border-ink/5 pt-gap-sm">
                    {pedido.lineas.map((linea) => (
                      <li
                        key={linea.id}
                        className="flex items-baseline justify-between gap-gap-sm text-small"
                      >
                        <span className="min-w-0 text-ink">
                          <span className="font-semibold tabular-nums">
                            {linea.qty}×
                          </span>{" "}
                          {linea.name}
                        </span>
                        <span className="shrink-0 tabular-nums text-ink-soft/75">
                          {formatMenuPrice(linea.price, linea.currency) || "—"}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {pedido.direccion && (
                    <p className="mt-gap-sm flex items-start gap-gap-xs text-small text-ink-soft">
                      <MapPin
                        size={15}
                        strokeWidth={1.8}
                        className="mt-[2px] shrink-0 text-verde-600"
                      />
                      {pedido.direccion}
                    </p>
                  )}

                  <div className="mt-gap-sm flex flex-wrap items-center justify-between gap-gap-xs border-t border-ink/5 pt-gap-sm">
                    <span className="font-lv-display text-small font-semibold text-ink">
                      {total
                        ? `${total.total.toFixed(2)} ${currencyLabel(total.currency)}`
                        : "Total a convenir"}
                    </span>

                    {pedido.estado === "nuevo" && (
                      <span className="flex flex-wrap items-center gap-gap-xs">
                        <button
                          type="button"
                          onClick={() =>
                            void cambiarEstado(pedido.id, "completado")
                          }
                          disabled={ocupado}
                          className="inline-flex h-10 cursor-pointer items-center gap-[6px] rounded-full bg-verde-400 px-gap-sm font-lv-display text-meta font-semibold text-verde-950 transition-colors duration-500 ease-outquint hover:bg-verde-300 disabled:pointer-events-none disabled:opacity-50"
                        >
                          {ocupado ? (
                            <Loader2
                              size={14}
                              strokeWidth={1.8}
                              className="animate-spin"
                            />
                          ) : (
                            <Check size={14} strokeWidth={2} />
                          )}
                          Completado
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void cambiarEstado(pedido.id, "cancelado")
                          }
                          disabled={ocupado}
                          className={BOTON_SECUNDARIO}
                        >
                          <X size={14} strokeWidth={2} />
                          Cancelar
                        </button>
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
