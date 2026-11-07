"use client";

import { useEffect, useRef, useState } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";
import { procesarCola, pendientes } from "@/lib/offline/cola";

/**
 * Indicador de estado de conexión.
 *
 * - Sin conexión: franja fina debajo de la barra de estado con «Sin conexión
 *   · Viendo datos guardados».
 * - Al volver: toast «De nuevo en línea» (desaparece a los 2 s). Si había
 *   pedidos en cola, «Enviando N pedido/s pendiente/s…».
 * - Accesibilidad: `role="status"` para que los lectores de pantalla lo anuncien.
 *   El aviso no depende solo del color (texto + icono).
 *
 * También procesa la cola de acciones pendientes:
 * - Al montar (abre la app).
 * - Cada vez que vuelve la red.
 */
export function EstadoConexion() {
  const [offline, setOffline] = useState(false);
  const montado = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setOffline(!navigator.onLine);

    async function alOnline() {
      setOffline(false);

      /* Cuántos pedidos hay antes de enviar, para el aviso. */
      const cola = await pendientes();
      const nPendientes = cola.length;

      if (nPendientes > 0) {
        toast(
          nPendientes === 1
            ? "Enviando 1 pedido pendiente…"
            : `Enviando ${nPendientes} pedidos pendientes…`,
          { duration: 3000 },
        );
        await procesarCola();
      } else {
        toast("De nuevo en línea.", { duration: 2000 });
      }
    }

    function alOffline() {
      setOffline(true);
    }

    window.addEventListener("online", alOnline);
    window.addEventListener("offline", alOffline);

    /* Procesar la cola al abrir la app, si hay red. */
    if (!montado.current) {
      montado.current = true;
      if (navigator.onLine) {
        void procesarCola();
      }
    }

    return () => {
      window.removeEventListener("online", alOnline);
      window.removeEventListener("offline", alOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      /* Debajo de la barra de estado del SO (safe-area-inset-top), por encima
         del resto del contenido. z-200 coincide con el header; aquí no hay
         header visible cuando aparece este aviso. */
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex justify-center px-gutter"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="pointer-events-none flex w-full items-center justify-center gap-2 bg-ink/90 px-4 py-2 text-[13px] font-medium text-white backdrop-blur-sm">
        <WifiOff size={13} strokeWidth={2} aria-hidden="true" />
        <span>Sin conexión · Viendo datos guardados</span>
      </div>
    </div>
  );
}
