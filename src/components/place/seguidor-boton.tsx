"use client";

import { useState } from "react";
import { Bell, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvento } from "@/lib/eventos-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SeguidorConfig } from "@/lib/seguidores";

/**
 * «Avísame de ofertas»: lo que convierte a quien mira una ficha en un seguidor.
 *
 * **Aquí no se guarda nada.** El botón abre el diálogo, el diálogo pide el
 * consentimiento con una casilla y el enlace lleva al bot de Telegram con el
 * negocio detrás (`?start=seg_<negocioId>`). La fila nace cuando la persona
 * pulsa «Iniciar» en Telegram —ese gesto es el consentimiento, y su fecha es la
 * que se guarda—, así que sin pasar por Telegram no hay suscripción posible ni
 * fila que borrar.
 *
 * Por eso la casilla no es decorativa pero tampoco es lo que firma: es lo que
 * hace que abrir Telegram sea una decisión y no un clic de más. Sin marcarla, el
 * botón no lleva a ningún sitio.
 *
 * Lo que se pinta lo decide el servidor: `seguidores` solo llega cuando el plan
 * incluye la función (Pro) y hay bot configurado. Aquí no se comprueba nada.
 */
export function SeguidorBoton({
  seguidores,
  negocioId,
  variant = "primary",
  className,
}: {
  seguidores: SeguidorConfig;
  /** Para contar el gesto contra el negocio correcto. */
  negocioId: string;
  variant?: "primary" | "outline";
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [acepta, setAcepta] = useState(false);

  const BTN =
    variant === "primary"
      ? "bg-verde-400 text-verde-950 shadow-primary-halo hover:bg-verde-300"
      : "border border-ink/10 bg-white text-ink hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600";

  function abrir() {
    /* La casilla se limpia cada vez que se abre: el consentimiento es de este
       gesto, no algo que quede marcado de la visita anterior. */
    setAcepta(false);
    setAbierto(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className={cn(
          "inline-flex h-11 cursor-pointer items-center justify-center gap-gap-xs rounded-full px-gap-md font-lv-display text-small font-semibold transition-colors duration-500 ease-outquint active:scale-[0.98]",
          BTN,
          className,
        )}
      >
        <Bell size={16} strokeWidth={1.8} />
        Avísame de ofertas
      </button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogTitle>Avisos de {seguidores.negocio}</DialogTitle>
          <DialogDescription>
            Te avisamos por Telegram cuando este negocio publique una oferta o
            algo nuevo en su carta. Son avisos cortos y pocos: como mucho tres
            por semana.
          </DialogDescription>

          <label className="mt-gap-md flex cursor-pointer items-start gap-gap-sm rounded-2xl border border-ink/10 bg-sand-warm px-4 py-3">
            <input
              type="checkbox"
              checked={acepta}
              onChange={(e) => setAcepta(e.target.checked)}
              className="mt-[3px] size-4 shrink-0 accent-verde-600"
            />
            <span className="text-small leading-relaxed text-ink-soft">
              Acepto recibir estos avisos de {seguidores.negocio}. Sé que puedo
              darme de baja cuando quiera contestando{" "}
              <span className="font-semibold text-ink">/baja</span> al bot.
            </span>
          </label>

          <div className="mt-gap-md flex flex-wrap items-center gap-gap-sm">
            <a
              href={acepta ? seguidores.enlace : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!acepta}
              onClick={(e) => {
                /* Sin la casilla el enlace no existe. `preventDefault` es la red
                   de seguridad de un navegador que no respete `aria-disabled`:
                   no hay que abrir nada que no se haya aceptado. */
                if (!acepta) {
                  e.preventDefault();
                  return;
                }
                trackEvento({ tipo: "click_seguidor", negocioId });
                setAbierto(false);
              }}
              className={cn(
                "inline-flex h-11 items-center justify-center gap-gap-xs rounded-full px-gap-lg font-lv-display text-small font-semibold transition-colors duration-500 ease-outquint",
                acepta
                  ? "bg-verde-400 text-verde-950 shadow-primary-halo hover:bg-verde-300"
                  : "pointer-events-none border border-ink/10 bg-sand text-ink-soft/75",
              )}
            >
              <Send size={16} strokeWidth={1.8} />
              Abrir Telegram
            </a>

            {!acepta && (
              <p className="text-meta text-ink-soft/75">
                Marca la casilla para continuar.
              </p>
            )}
          </div>

          <p className="mt-gap-md text-meta leading-relaxed text-ink-soft/75">
            Se abre la conversación del bot en Telegram: allí pulsa «Iniciar» y
            quedas suscrito. No hace falta cuenta en La Verde y no te pedimos
            ningún dato.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
