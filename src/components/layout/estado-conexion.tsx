"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { procesarCola, pendientes } from "@/lib/offline/cola";
import { setSinRed } from "@/lib/offline/estado-red";

const INTERVALO_FLUSH_MS = 60_000;

/**
 * Gestión del estado de conexión. No renderiza nada visible.
 *
 * - Sin conexión: toast «Sin conexión · Viendo datos guardados» (5 s).
 * - Al volver: toast «De nuevo en línea» + procesa la cola de pedidos pendientes.
 * - Mantiene `sinRed()` sincronizado para NavOffline y navegar.ts.
 * - Procesa la cola al abrir la app si ya hay red.
 * - Reintenta cada 60 s si la pestaña está visible y online.
 * - Toast de aviso cuando algún pedido es rechazado (4xx) por el servidor.
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

    async function flush(mostrarToast = false) {
      if (!navigator.onLine) return;
      const cola = await pendientes();
      const nPendientes = cola.length;

      if (mostrarToast && nPendientes > 0) {
        toast(
          nPendientes === 1
            ? "Enviando 1 pedido pendiente…"
            : `Enviando ${nPendientes} pedidos pendientes…`,
          { duration: 3000 },
        );
      }

      const resultado = await procesarCola();

      if (resultado.rechazados > 0) {
        toast.error(
          resultado.rechazados === 1
            ? "1 pedido no pudo registrarse (sin cupo o negocio no disponible)."
            : `${resultado.rechazados} pedidos no pudieron registrarse.`,
          { duration: 8000 },
        );
      }
    }

    async function alOnline() {
      setSinRed(false);
      const cola = await pendientes();
      if (cola.length > 0) {
        await flush(true);
      } else {
        toast("De nuevo en línea.", { duration: 2000 });
      }
    }

    function alOffline() {
      setSinRed(true);
      toast("Sin conexión · Viendo datos guardados", { duration: 5000 });
    }

    function alCambiarVisibilidad() {
      if (document.visibilityState === "visible") void flush();
    }

    window.addEventListener("online", alOnline);
    window.addEventListener("offline", alOffline);
    document.addEventListener("visibilitychange", alCambiarVisibilidad);

    /* Intervalo de 60 s: pedidos encolados se reenvían aunque el usuario no
       cambie de pestaña ni pierda y recupere la red. */
    const intervalo = setInterval(() => void flush(), INTERVALO_FLUSH_MS);

    if (!montado.current) {
      montado.current = true;
      void flush();
    }

    return () => {
      window.removeEventListener("online", alOnline);
      window.removeEventListener("offline", alOffline);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      clearInterval(intervalo);
    };
  }, []);

  return null;
}
