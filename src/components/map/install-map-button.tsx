"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Download, Share } from "lucide-react";

import { pwaActiva } from "@/lib/pwa/flag";
import { instalarPwa, useInstalacionPwa } from "@/lib/pwa/install-client";

/**
 * El botón de instalar la PWA sobre el mapa.
 *
 * Disco blanco como la campana y el interruptor de tema —es la misma columna—,
 * con el icono de descarga en verde para que se distinga sin gritar. Aparece
 * solo cuando hay algo que ofrecer: el navegador ya disparó
 * `beforeinstallprompt`, o es un iPhone, donde el diálogo nativo no existe y lo
 * que se puede dar son las instrucciones de Safari.
 *
 * Después de instalar, o cuando el usuario descarta el diálogo del sistema,
 * desaparece: el aviso de bienvenida ya cubre el primer ofrecimiento y este
 * botón es la vía para quien lo cerró.
 */
export function InstallMapButton() {
  const { puede, ios, instalada } = useInstalacionPwa();
  const [ayuda, setAyuda] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ayuda) return;

    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setAyuda(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setAyuda(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [ayuda]);

  async function alPulsar() {
    if (puede) {
      const resultado = await instalarPwa();
      /* Si el navegador no llegó a abrir el diálogo, se explica igual: es mejor
         que un toque sin respuesta. */
      if (resultado === "no-disponible") setAyuda(true);
      return;
    }
    setAyuda(true);
  }

  if (!pwaActiva() || instalada || (!puede && !ios)) return null;

  return (
    <div ref={ref} className="relative">
      <motion.button
        type="button"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 24 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => void alPulsar()}
        aria-expanded={ayuda}
        aria-haspopup="dialog"
        aria-label="Instalar La Verde en este dispositivo"
        title="Instalar La Verde"
        className="grid size-11 place-items-center rounded-full border border-verde-300/50 bg-white text-verde-700 shadow-soft ring-1 ring-verde-300/25 transition-colors duration-500 ease-outquint hover:border-verde-400 hover:text-verde-800"
      >
        <Download size={18} strokeWidth={1.8} />
      </motion.button>

      <AnimatePresence>
        {ayuda && (
          <motion.div
            role="dialog"
            aria-label="Cómo instalar La Verde"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-[calc(100%+8px)] w-[min(280px,calc(100vw-40px))] rounded-2xl border border-ink/5 bg-white p-gap-md shadow-card"
          >
            <p className="font-lv-display text-small font-semibold text-ink">
              Ten La Verde a mano
            </p>
            <p className="mt-1 text-meta leading-relaxed text-ink-soft/80">
              Se abre como una app, sin barra del navegador, funciona sin
              conexión y puede recibir notificaciones.
            </p>

            {ios && (
              <p className="mt-2 inline-flex items-start gap-2 rounded-xl bg-verde-50 px-gap-xs py-2 text-meta leading-relaxed text-verde-800">
                <Share size={14} strokeWidth={1.8} className="mt-[2px] shrink-0" />
                <span>
                  Toca <span className="font-semibold">Compartir</span> y luego{" "}
                  <span className="font-semibold">Añadir a pantalla de inicio</span>.
                </span>
              </p>
            )}

            <button
              type="button"
              onClick={() => setAyuda(false)}
              className="mt-gap-sm inline-flex h-9 items-center justify-center rounded-full bg-verde-950 px-4 font-lv-display text-meta font-semibold text-white transition-colors duration-500 ease-outquint hover:bg-verde-800"
            >
              Entendido
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
