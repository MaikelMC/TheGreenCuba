"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

import { pwaActiva } from "@/lib/pwa/flag";

const CLAVE_DESCARTADO = "la-verde:pwa-install-dismissed";

/** Chrome no lo declara en `lib.dom`; solo existe en navegadores Chromium. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** iPhone/iPad, incluido el iPad moderno que se identifica como Mac. */
function esIOS(): boolean {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function estaInstalada(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  /* Safari en iOS no soporta `display-mode` en todas las versiones: expone la
     bandera `standalone` en `navigator`. */
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * Aviso de instalación.
 *
 * Android lanza `beforeinstallprompt` y aquí se guarda para disparar el diálogo
 * nativo desde un botón propio. Safari no lo implementa: en iPhone la única vía
 * es explicar «Compartir → Añadir a pantalla de inicio», que es lo que se
 * muestra en su lugar.
 *
 * Cuando ya está instalada no se pinta nada. El descarte se recuerda en
 * `localStorage` para no repetir el aviso en cada visita.
 */
export function InstallPrompt() {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (!pwaActiva()) return;
    if (estaInstalada()) return;

    try {
      if (window.localStorage.getItem(CLAVE_DESCARTADO) === "1") return;
    } catch {
      // localStorage bloqueado: se muestra igual, sin memoria del descarte.
    }

    const enIOS = esIOS();
    setIos(enIOS);
    /* En iPhone el aviso no depende de ningún evento: se ofrece directamente. */
    if (enIOS) setVisible(true);

    const alPoderInstalar = (event: Event) => {
      event.preventDefault();
      setEvento(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const alInstalar = () => {
      setVisible(false);
      setEvento(null);
    };

    window.addEventListener("beforeinstallprompt", alPoderInstalar);
    window.addEventListener("appinstalled", alInstalar);

    return () => {
      window.removeEventListener("beforeinstallprompt", alPoderInstalar);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  const descartar = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(CLAVE_DESCARTADO, "1");
    } catch {
      // Sin localStorage el descarte dura lo que dure la pestaña.
    }
  };

  const instalar = async () => {
    if (!evento) return;
    await evento.prompt();
    const eleccion = await evento.userChoice.catch(() => null);
    if (eleccion?.outcome === "dismissed") descartar();
    setEvento(null);
    setVisible(false);
  };

  if (!pwaActiva() || !visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Instalar La Verde"
      className="fixed inset-x-0 z-[60] flex justify-center px-gutter"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="flex w-full max-w-sm items-start gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-ink shadow-soft">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-verde-950 text-white">
          {ios ? (
            <Share size={17} strokeWidth={1.8} aria-hidden="true" />
          ) : (
            <Download size={17} strokeWidth={1.8} aria-hidden="true" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-lv-display text-small font-semibold leading-snug">
            Ten La Verde a mano
          </p>
          {ios ? (
            <p className="mt-1 text-meta leading-snug text-ink-soft">
              Toca <span className="font-semibold text-ink">Compartir</span> y luego{" "}
              <span className="font-semibold text-ink">Añadir a pantalla de inicio</span>.
            </p>
          ) : (
            <p className="mt-1 text-meta leading-snug text-ink-soft">
              Se abre como una app, sin barra del navegador, y funciona sin conexión.
            </p>
          )}

          {!ios && evento && (
            <button
              type="button"
              onClick={() => void instalar()}
              className="mt-2 inline-flex items-center gap-2 rounded-full bg-verde-400 px-3 py-1.5 text-meta font-semibold text-verde-950 transition-colors duration-300 hover:bg-verde-300"
            >
              Instalar
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={descartar}
          aria-label="Descartar aviso de instalación"
          className="-mr-1 -mt-1 grid size-7 shrink-0 place-items-center rounded-full text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <X size={15} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
