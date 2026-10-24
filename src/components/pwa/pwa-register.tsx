"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, WifiOff } from "lucide-react";

import { pwaActiva } from "@/lib/pwa/flag";

/**
 * Registro del service worker, aviso de versión nueva y banner de sin conexión.
 *
 * Tres responsabilidades porque las tres dependen del mismo registro y separarlas
 * obligaría a compartir estado entre componentes:
 *
 *  - **Registro.** Solo si `NEXT_PUBLIC_PWA_ENABLED === "true"` y nunca en
 *    desarrollo. Si la bandera está apagada, además se desregistra cualquier
 *    service worker que haya quedado de una prueba anterior y se borran las
 *    cachés `lv-*`: un preview apagado no debe seguir sirviendo HTML viejo.
 *  - **Actualización.** Un SW nuevo se queda en `waiting` hasta que el usuario
 *    pulsa «Actualizar». El `controllerchange` recarga una sola vez —con bandera,
 *    para no entrar en bucle— y solo si la recarga la pidió el usuario.
 *  - **Modo offline.** Banner cuando `navigator.onLine` es falso y guarda de
 *    navegación: sin red, los enlaces internos se abren con una carga de
 *    documento completa. Una navegación de cliente pediría un payload RSC que el
 *    service worker no puede servir.
 */
export function PwaRegister() {
  const [offline, setOffline] = useState(false);
  const [esperando, setEsperando] = useState<ServiceWorker | null>(null);
  const recargaPedida = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (!pwaActiva()) {
      /* Sin bandera no se muestra nada y se limpia lo que hubiera. */
      void limpiarPwa();
      return;
    }

    setOffline(!window.navigator.onLine);

    let cancelado = false;

    const registrar = async () => {
      try {
        const registro = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        if (cancelado) return;

        if (registro.waiting) setEsperando(registro.waiting);

        registro.addEventListener("updatefound", () => {
          const instalando = registro.installing;
          if (!instalando) return;
          instalando.addEventListener("statechange", () => {
            /* Hay controlador = ya había una versión activa; si no, es la
               primera instalación y no hay nada que «actualizar». */
            if (instalando.state === "installed" && navigator.serviceWorker.controller) {
              setEsperando(instalando);
            }
          });
        });

        const comprobar = () => {
          void registro.update().catch(() => {});
        };

        /* Busca versión nueva al volver a la pestaña y al recuperar red. Un
           teléfono puede pasar días con la app en segundo plano. */
        const alVolver = () => {
          if (document.visibilityState === "visible") comprobar();
        };
        document.addEventListener("visibilitychange", alVolver);
        window.addEventListener("online", comprobar);

        window.addEventListener("beforeunload", () => {
          document.removeEventListener("visibilitychange", alVolver);
          window.removeEventListener("online", comprobar);
        });
      } catch {
        /* Sin registro no hay offline. No se avisa: la app sigue funcionando
           como web normal. */
      }
    };

    const alCambiarControlador = () => {
      if (!recargaPedida.current) return;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", alCambiarControlador);

    const alIrOnline = () => setOffline(false);
    const alIrOffline = () => setOffline(true);
    window.addEventListener("online", alIrOnline);
    window.addEventListener("offline", alIrOffline);

    /* Guarda de navegación. En captura para adelantarse al router de Next. */
    const alPulsarEnlace = (event: MouseEvent) => {
      if (window.navigator.onLine) return;
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const objetivo = event.target;
      if (!(objetivo instanceof Element)) return;

      const enlace = objetivo.closest("a");
      if (!enlace) return;
      if (enlace.target && enlace.target !== "_self") return;
      if (enlace.hasAttribute("download")) return;

      const href = enlace.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (href.startsWith("mailto:") || href.startsWith("tel:")) return;

      let destino: URL;
      try {
        destino = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (destino.origin !== window.location.origin) return;

      event.preventDefault();
      window.location.assign(destino.href);
    };
    document.addEventListener("click", alPulsarEnlace, true);

    if (document.readyState === "complete") void registrar();
    else window.addEventListener("load", registrar, { once: true });

    return () => {
      cancelado = true;
      window.removeEventListener("load", registrar);
      window.removeEventListener("online", alIrOnline);
      window.removeEventListener("offline", alIrOffline);
      document.removeEventListener("click", alPulsarEnlace, true);
      navigator.serviceWorker.removeEventListener("controllerchange", alCambiarControlador);
    };
  }, []);

  if (!pwaActiva()) return null;

  const actualizar = () => {
    if (!esperando) return;
    recargaPedida.current = true;
    esperando.postMessage({ type: "SKIP_WAITING" });
    setEsperando(null);
  };

  return (
    <>
      {esperando && (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-[70] flex justify-center px-gutter"
          style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))" }}
        >
          <div className="flex items-center gap-3 rounded-full border border-ink/10 bg-verde-950 px-4 py-2 text-small text-white shadow-soft">
            <RefreshCw size={15} strokeWidth={1.8} aria-hidden="true" />
            <span>Hay una versión nueva</span>
            <button
              type="button"
              onClick={actualizar}
              className="rounded-full bg-verde-400 px-3 py-1 text-meta font-semibold text-verde-950 transition-colors duration-300 hover:bg-verde-300"
            >
              Actualizar
            </button>
          </div>
        </div>
      )}

      {offline && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 z-[65] flex justify-center px-gutter"
          /* Por encima de la barra inferior y del toaster (que vive a 5rem):
             con el hueco del indicador de inicio de iOS, el banner no tapa
             ninguna de las dos. */
          style={{ bottom: "calc(7.5rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-ink/10 bg-ink px-4 py-2 text-small font-medium text-white shadow-soft">
            <WifiOff size={15} strokeWidth={1.8} aria-hidden="true" />
            <span>Sin conexión · viendo la última copia guardada</span>
          </div>
        </div>
      )}
    </>
  );
}

/** Desregistra el service worker y borra todo lo que haya cacheado la PWA. */
async function limpiarPwa(): Promise<void> {
  try {
    const registros = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registros.map((registro) => registro.unregister()));
  } catch {
    // Sin permiso o modo privado: no hay nada que limpiar.
  }

  try {
    const nombres = await caches.keys();
    await Promise.all(
      nombres.filter((nombre) => nombre.startsWith("lv-")).map((nombre) => caches.delete(nombre)),
    );
  } catch {
    // `caches` puede no existir fuera de un contexto seguro.
  }
}
