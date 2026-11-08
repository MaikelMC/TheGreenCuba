"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { procesarCola, pendientes } from "@/lib/offline/cola";
import { setSinRed } from "@/lib/offline/estado-red";

/**
 * Gestión del estado de conexión. No renderiza nada visible.
 *
 * - Sin conexión: toast «Sin conexión · Viendo datos guardados» (5 s).
 * - Al volver: toast «De nuevo en línea» + procesa la cola de pedidos pendientes.
 * - Mantiene `sinRed()` sincronizado para NavOffline y navegar.ts.
 * - Procesa la cola al abrir la app si ya hay red.
 *
 * El indicador visual persistente de «sin red» lo gestiona cada página por
 * su cuenta (StateView variant="offline", desdeOffline en /home, etc.) para
 * que aparezca en contexto en vez de cubrir la barra del sistema.
 */
export function EstadoConexion() {
  const montado = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const estaOffline = !navigator.onLine;
    setSinRed(estaOffline);
    if (estaOffline) {
      toast("Sin conexión · Viendo datos guardados", { duration: 5000 });
    }

    async function alOnline() {
      setSinRed(false);

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
      setSinRed(true);
      toast("Sin conexión · Viendo datos guardados", { duration: 5000 });
    }

    window.addEventListener("online", alOnline);
    window.addEventListener("offline", alOffline);

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

  return null;
}
