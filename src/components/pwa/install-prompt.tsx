"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

import { pwaActiva } from "@/lib/pwa/flag";
import { instalarPwa, useInstalacionPwa } from "@/lib/pwa/install-client";

const CLAVE_DESCARTADO = "la-verde:pwa-install-dismissed";

/**
 * Aviso de instalación, una vez.
 *
 * Chromium ofrece el diálogo nativo a través de `beforeinstallprompt`; aquí se
 * usa para abrirlo desde un botón propio. Safari no lo implementa: en iPhone la
 * única vía es explicar «Compartir → Añadir a pantalla de inicio», que es lo que
 * se muestra en su lugar.
 *
 * El evento nativo vive en `install-client`, compartido con el botón del mapa:
 * solo se puede consumir una vez, así que no puede estar capturado en dos
 * sitios. Aquí queda la parte de aviso —una tarjeta que se descarta para
 * siempre—; el botón del mapa es la vía permanente.
 */
export function InstallPrompt() {
  const { puede, ios, instalada } = useInstalacionPwa();
  /* Arranca descartado para no parpadear antes de leer el almacenamiento. */
  const [descartado, setDescartado] = useState(true);

  useEffect(() => {
    try {
      setDescartado(window.localStorage.getItem(CLAVE_DESCARTADO) === "1");
    } catch {
      // localStorage bloqueado: se muestra igual, sin memoria del descarte.
      setDescartado(false);
    }
  }, []);

  const descartar = () => {
    setDescartado(true);
    try {
      window.localStorage.setItem(CLAVE_DESCARTADO, "1");
    } catch {
      // Sin localStorage el descarte dura lo que dure la pestaña.
    }
  };

  const instalar = async () => {
    await instalarPwa();
    /* Concedida o descartada, la tarjeta ya cumplió: no se repite. */
    descartar();
  };

  if (!pwaActiva() || instalada || descartado || (!ios && !puede)) return null;

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
              Se abre como una app, sin barra del navegador, funciona sin conexión
              y puede recibir notificaciones.
            </p>
          )}

          {!ios && puede && (
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
