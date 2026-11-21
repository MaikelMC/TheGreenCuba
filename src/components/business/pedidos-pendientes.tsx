"use client";

/**
 * Los pedidos que esperan, vigilados desde el armazón del panel.
 *
 * Antes solo se sabía de un pedido nuevo con la pantalla Pedidos abierta: el
 * sondeo vivía dentro de `PedidosView`. Ahora se pregunta desde aquí, esté donde
 * esté el dueño, al endpoint ligero `GET /api/pedidos/pendientes` (dos números y
 * un id), cada minuto y al volver a la pestaña. Con eso:
 * - el contador del dock, de la barra lateral y del título de la pestaña;
 * - el sonido corto y la vibración al entrar uno (se apagan en Ajustes de
 *   pedidos; la preferencia es del teléfono, en `localStorage`);
 * - el aviso «Ha entrado un pedido nuevo» con su «Ver».
 *
 * La lista entera se sigue pidiendo solo dentro de Pedidos, que escucha
 * `ultimoId` para recargarse cuando algo cambia.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

const INTERVALO_MS = 60_000;
const CLAVE_SONIDO = "la-verde:panel-sonido-pedidos";
const SONIDO = "/sounds/pedido-nuevo.wav";
const TITULO_PEDIDOS = "Pedidos · La Verde";

/** Si este teléfono suena al entrar un pedido. Activado por defecto. */
export function sonidoPedidosActivo(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_SONIDO) !== "0";
  } catch {
    return true;
  }
}

export function guardarSonidoPedidos(activo: boolean): void {
  try {
    window.localStorage.setItem(CLAVE_SONIDO, activo ? "1" : "0");
  } catch {
    /* Sin almacén, sigue sonando: es lo seguro para no perder un pedido. */
  }
}

/** El sonido y la vibración de «pedido nuevo». También lo usa el botón de prueba. */
export function sonarPedidoNuevo(): void {
  if (!sonidoPedidosActivo()) return;
  try {
    void new Audio(SONIDO).play().catch(() => {
      /* El navegador no deja sonar sin un toque previo en la página: se calla. */
    });
  } catch {
    /* Sin `Audio`: nada que hacer. */
  }
  try {
    navigator.vibrate?.([180, 80, 180]);
  } catch {
    /* Sin vibración en este dispositivo. */
  }
}

interface Pendientes {
  /** `null` mientras no se sabe (o sin permiso de pedidos). */
  pendientes: number | null;
  /** El id del último pedido que entró. Cambia con cada pedido nuevo. */
  ultimoId: string | null;
}

const Ctx = createContext<Pendientes>({ pendientes: null, ultimoId: null });

export function usePedidosPendientes(): Pendientes {
  return useContext(Ctx);
}

export function PendientesProvider({
  placeId,
  activo,
  onVerPedidos,
  enPedidos,
  children,
}: {
  placeId: string;
  /** Permiso `pedidos` y función `whatsapp_pedido`: sin ellos no se pregunta. */
  activo: boolean;
  onVerPedidos: () => void;
  /** Si la pantalla de Pedidos está abierta: el aviso no ofrece «Ver». */
  enPedidos: boolean;
  children: ReactNode;
}) {
  const [estado, setEstado] = useState<Pendientes>({ pendientes: null, ultimoId: null });
  const ultimoConocido = useRef<string | null | undefined>(undefined);
  const verRef = useRef(onVerPedidos);
  const enPedidosRef = useRef(enPedidos);
  verRef.current = onVerPedidos;
  enPedidosRef.current = enPedidos;

  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    ultimoConocido.current = undefined;

    async function consultar() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/pedidos/pendientes?placeId=${encodeURIComponent(placeId)}`);
        if (!res.ok || !vivo) return;
        const data = (await res.json()) as { pendientes?: number; ultimoId?: string | null };
        const ultimoId = data.ultimoId ?? null;
        /* Pedido nuevo: el último cambió respecto a uno que ya se conocía. La
           primera lectura solo fija el punto de partida, no avisa. */
        const previo = ultimoConocido.current;
        if (previo !== undefined && ultimoId && ultimoId !== previo) {
          sonarPedidoNuevo();
          toast.success("Ha entrado un pedido nuevo", {
            action: enPedidosRef.current
              ? undefined
              : { label: "Ver", onClick: () => verRef.current() },
          });
        }
        ultimoConocido.current = ultimoId;
        setEstado({ pendientes: data.pendientes ?? 0, ultimoId });
      } catch {
        /* Sin red no se sabe más: se reintenta en el próximo minuto. */
      }
    }

    void consultar();
    const intervalo = window.setInterval(() => void consultar(), INTERVALO_MS);
    document.addEventListener("visibilitychange", consultar);
    return () => {
      vivo = false;
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", consultar);
    };
  }, [placeId, activo]);

  /* El título de la pestaña: «(2) Pedidos · La Verde» con pedidos esperando;
     el de la página cuando no hay ninguno. */
  const tituloBase = useRef<string | null>(null);
  useEffect(() => {
    if (tituloBase.current === null) tituloBase.current = document.title;
    const n = estado.pendientes ?? 0;
    document.title = n > 0 ? `(${n}) ${TITULO_PEDIDOS}` : tituloBase.current;
  }, [estado.pendientes]);
  useEffect(
    () => () => {
      if (tituloBase.current !== null) document.title = tituloBase.current;
    },
    [],
  );

  return <Ctx.Provider value={activo ? estado : { pendientes: null, ultimoId: null }}>{children}</Ctx.Provider>;
}
