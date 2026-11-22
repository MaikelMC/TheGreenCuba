"use client";

import { useEffect, useRef, useState } from "react";
import { HardDrive, RefreshCw, WifiOff } from "lucide-react";

import { pwaActiva } from "@/lib/pwa/flag";
import { sincronizarPushDispositivo } from "@/lib/pwa/push-client";
import { asegurarPersistencia, estadoAlmacenamiento } from "@/lib/offline/storage-status";
import { procesarCola } from "@/lib/offline/cola";

/**
 * Registro del service worker, aviso de versión nueva y banner de sin conexión.
 *
 * Tres responsabilidades porque las tres dependen del mismo registro y separarlas
 * obligaría a compartir estado entre componentes:
 *
 *  - **Registro.** Salvo que `NEXT_PUBLIC_PWA_ENABLED === "false"` y nunca en
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
  const [alertaCuota, setAlertaCuota] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const recargaPedida = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (!pwaActiva()) {
      /* Sin bandera no se muestra nada y se limpia lo que hubiera. */
      void limpiarPwa();
      return;
    }

    setOffline(!window.navigator.onLine);

    /* Persistencia y cuota solo cuando abre instalada. */
    if (window.matchMedia("(display-mode: standalone)").matches) {
      void asegurarPersistencia();
      void estadoAlmacenamiento().then((estado) => {
        if (
          estado.usageBytes !== null &&
          estado.quotaBytes !== null &&
          estado.quotaBytes > 0 &&
          estado.usageBytes / estado.quotaBytes > 0.9
        ) {
          setAlertaCuota(true);
        }
      });
    }

    let cancelado = false;
    let registro: ServiceWorkerRegistration | null = null;
    let vigilancia: ReturnType<typeof setInterval> | null = null;

    /**
     * Lo único que decide si se enseña el aviso: que haya versión nueva,
     * instalada o **instalándose**. La instalación precachea páginas, catálogo
     * y mapa, y con red lenta tarda minutos: esperar a `waiting` retrasaba el
     * aviso todo ese rato. Sin `controller` es la primera instalación y no hay
     * nada que actualizar.
     */
    const revisarEsperando = () => {
      if (cancelado || recargaPedida.current || !registro) return;
      if (!navigator.serviceWorker.controller) return;
      const nueva = registro.waiting ?? registro.installing;
      if (nueva) setEsperando(nueva);
    };

    const pararVigilancia = () => {
      if (vigilancia) clearInterval(vigilancia);
      vigilancia = null;
    };

    /**
     * Sondea `waiting` durante 30 s tras cada comprobación.
     *
     * No basta con `updatefound` + `statechange`: el navegador dispara
     * `updatefound` en cuanto empieza a instalar, casi siempre antes de que
     * `register()` resuelva, y un SW que instala rápido llega a `installed`
     * antes de que el listener esté enganchado. Cuando eso pasaba el aviso no
     * aparecía nunca: al cerrar la app el SW en `waiting` se activa solo, y la
     * siguiente apertura ya no tenía nada que anunciar. El sondeo cubre las dos
     * carreras sin depender del orden de los eventos.
     */
    const vigilarEsperando = () => {
      revisarEsperando();
      pararVigilancia();
      let intentos = 0;
      vigilancia = setInterval(() => {
        revisarEsperando();
        intentos += 1;
        if (intentos >= 20 || cancelado) pararVigilancia();
      }, 1500);
    };

    const registrar = async () => {
      try {
        /* La solicitud suele existir antes de registrar: se engancha ahí para no
           perder un `updatefound` que llegue mientras `register()` resuelve. */
        const previo = await navigator.serviceWorker.getRegistration();
        if (cancelado) return;
        if (previo) previo.addEventListener("updatefound", vigilarEsperando);

        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          /* `none`: la comprobación de versión no usa la caché HTTP ni para
             `sw.js` ni para `sw-version.js`. Con el valor por defecto
             (`imports`), un proxy que sirva el import con caché larga deja los
             bytes idénticos y el navegador no instala nada. */
          updateViaCache: "none",
        });
        if (cancelado) return;

        registro = reg;
        if (reg !== previo) reg.addEventListener("updatefound", vigilarEsperando);
        vigilarEsperando();

        /* El servidor tiene que conocer el endpoint de este dispositivo. Se
           reenvía en cada apertura y de forma idempotente: si la tabla de
           suscripciones se perdió en una migración de la base, o el servicio
           push renovó el endpoint sin la app abierta, esto lo repara sin que
           el usuario toque nada. */
        void sincronizarPushDispositivo();

        /* Detección de despliegue. Antes era `update()` con un tope de 30 min:
           cada llamada baja los 60 KB de `sw.js`, así que no se podía hacer a
           menudo y el aviso llegaba tarde. Ahora se pide `/sw-version.js`
           (40 bytes) y se compara con la versión del SW activo; `update()`
           solo corre cuando difieren. Un SW de antes de este cambio no sabe
           contestar la versión: se trata como distinta, una sola vez. */
        let versionVista: string | null = null;
        let comprobando = false;
        const comprobar = async () => {
          if (comprobando || cancelado || !navigator.onLine) return;
          if (registro?.waiting || registro?.installing) return vigilarEsperando();
          comprobando = true;
          try {
            const res = await fetch(`/sw-version.js?t=${Date.now()}`, { cache: "no-store" });
            const servidor = res.ok ? /"([^"]+)"/.exec(await res.text())?.[1] : undefined;
            if (!servidor || servidor === versionVista) return;
            if ((await versionActiva(registro)) !== servidor) await registro?.update();
            versionVista = servidor;
            vigilarEsperando();
          } catch {
            /* Sin red: se reintenta en el siguiente aviso. */
          } finally {
            comprobando = false;
          }
        };

        /* Al abrir, al volver a la app, al recuperar red y cada minuto con la
           pestaña visible. Un minuto de sondeo son ~0,3 KB: cabe en cualquier
           plan de datos y deja el aviso, como mucho, un minuto tarde. */
        const alVolver = () => {
          if (document.visibilityState === "visible") void comprobar();
        };
        const alRecuperarRed = () => void comprobar();
        document.addEventListener("visibilitychange", alVolver);
        window.addEventListener("online", alRecuperarRed);
        const sondeo = setInterval(alVolver, 60_000);
        void comprobar();

        window.addEventListener("beforeunload", () => {
          clearInterval(sondeo);
          document.removeEventListener("visibilitychange", alVolver);
          window.removeEventListener("online", alRecuperarRed);
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
      pararVigilancia();
      window.removeEventListener("load", registrar);
      window.removeEventListener("online", alIrOnline);
      window.removeEventListener("offline", alIrOffline);
      document.removeEventListener("click", alPulsarEnlace, true);
      navigator.serviceWorker.removeEventListener("controllerchange", alCambiarControlador);
    };
  }, []);

  if (!pwaActiva()) return null;

  const actualizar = async () => {
    if (!esperando) return;
    /* Vaciar la cola antes de recargar: un pedido a mitad de envío no debe
       perderse porque el SW nuevo cambia el bundle bajo los pies del fetch. */
    await procesarCola().catch(() => {});
    recargaPedida.current = true;
    const sw = esperando;
    if (sw.state === "installed") {
      sw.postMessage({ type: "SKIP_WAITING" });
      setEsperando(null);
      return;
    }
    /* Aún instalándose: el aviso sale en cuanto se detecta el despliegue, y
       el botón espera a que termine de bajar lo que necesita sin conexión. */
    setActualizando(true);
    const alCambiar = () => {
      if (sw.state === "installed") {
        sw.removeEventListener("statechange", alCambiar);
        sw.postMessage({ type: "SKIP_WAITING" });
      } else if (sw.state === "redundant") {
        // La instalación falló (red caída): se retira el aviso y se reintentará.
        sw.removeEventListener("statechange", alCambiar);
        recargaPedida.current = false;
        setActualizando(false);
        setEsperando(null);
      }
    };
    sw.addEventListener("statechange", alCambiar);
    alCambiar();
  };

  return (
    <>
      {alertaCuota && (
        <div
          role="alert"
          className="fixed inset-x-0 top-0 z-[69] flex justify-center px-gutter"
          style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))" }}
        >
          <div className="flex items-center gap-3 rounded-full border border-ink/10 bg-amber-900 px-4 py-2 text-small text-white shadow-soft">
            <HardDrive size={15} strokeWidth={1.8} aria-hidden="true" />
            <span>Almacenamiento al 90% · considera liberar espacio en el dispositivo</span>
          </div>
        </div>
      )}

      {esperando && (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-[70] flex justify-center px-gutter"
          style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))" }}
        >
          <div className="flex items-center gap-3 rounded-full border border-ink/10 bg-verde-950 px-4 py-2 text-small text-white shadow-soft">
            <RefreshCw
              size={15}
              strokeWidth={1.8}
              aria-hidden="true"
              className={actualizando ? "animate-spin" : undefined}
            />
            <span>{actualizando ? "Actualizando…" : "Hay una versión nueva"}</span>
            {!actualizando && (
              <button
                type="button"
                onClick={actualizar}
                className="rounded-full bg-verde-400 px-3 py-1 text-meta font-semibold text-verde-950 transition-colors duration-300 hover:bg-verde-300"
              >
                Actualizar
              </button>
            )}
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

/** La versión que lleva el SW activo, o `null` si no contesta (SW antiguo). */
function versionActiva(registro: ServiceWorkerRegistration | null): Promise<string | null> {
  const sw = navigator.serviceWorker.controller ?? registro?.active;
  if (!sw) return Promise.resolve(null);
  return new Promise((resolver) => {
    const canal = new MessageChannel();
    const tope = setTimeout(() => resolver(null), 1500);
    canal.port1.onmessage = (e) => {
      clearTimeout(tope);
      resolver(typeof e.data === "string" ? e.data : null);
    };
    sw.postMessage({ type: "GET_VERSION" }, [canal.port2]);
  });
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
