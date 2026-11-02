"use client";

import { useEffect, useState } from "react";
import { Bell, Loader2, Send } from "lucide-react";
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
        <Bell size={16} strokeWidth={1.8} className="shrink-0" />
        {/* En móvil el botón va en una columna de ~140 px: «de ofertas» sobra
            ahí y el icono de campana ya lo dice. El diálogo, que sí tiene
            ancho, conserva el texto largo como título. */}
        <span className="sm:hidden">Avísame</span>
        <span className="hidden sm:inline">Avísame de ofertas</span>
      </button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogTitle>Avisos de {seguidores.negocio}</DialogTitle>
          <DialogDescription>
            Te avisamos cuando este negocio publique una oferta o algo nuevo en
            su carta. Son avisos cortos y pocos: como mucho tres por semana.
          </DialogDescription>

          <AvisosApp negocioId={negocioId} nombre={seguidores.negocio} />

          <p className="mt-gap-md font-lv-display text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft/60">
            O por Telegram
          </p>

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

/**
 * El interruptor de «Avísame en la app».
 *
 * Es la alternativa con sesión al bot de Telegram: la fila vive en
 * `seguimientos` y el aviso llega a la bandeja y, si el usuario activó los
 * avisos del dispositivo, como push. No sustituye al botón de Telegram —quien
 * no tenga cuenta puede seguir usándolo—, lo complementa.
 *
 * El estado se pide al montar, que es al abrir el diálogo (Radix desmonta el
 * contenido al cerrarlo). Sin sesión no se ofrece el interruptor: se explica qué
 * hace y se enlaza al acceso, para no pedir un clic que va a devolver un 401.
 */
type EstadoApp =
  "cargando" | "sin-sesion" | "error" | "inactivo" | "activo" | "guardando";

function AvisosApp({
  negocioId,
  nombre,
}: {
  negocioId: string;
  nombre: string;
}) {
  const [estado, setEstado] = useState<EstadoApp>("cargando");
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/seguimientos?placeId=${encodeURIComponent(negocioId)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { autenticado?: boolean; siguiendo?: boolean } | null) => {
        if (!vivo) return;
        if (!data?.autenticado) setEstado("sin-sesion");
        else setEstado(data.siguiendo ? "activo" : "inactivo");
      })
      .catch(() => {
        /* Un corte de red no es «no has iniciado sesión»: se dice aparte para
           no mandar a nadie a la pantalla de acceso por un problema de datos. */
        if (vivo) setEstado("error");
      });
    return () => {
      vivo = false;
    };
  }, [negocioId]);

  async function alternar() {
    const seguir = estado !== "activo";
    setAviso(null);
    setEstado("guardando");

    try {
      const response = await fetch("/api/seguimientos", {
        method: seguir ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: negocioId }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setEstado(seguir ? "inactivo" : "activo");
        setAviso(data?.error ?? "No se pudo guardar. Inténtalo otra vez.");
        return;
      }

      setEstado(seguir ? "activo" : "inactivo");
    } catch {
      setEstado(seguir ? "inactivo" : "activo");
      setAviso("Sin conexión. Inténtalo otra vez.");
    }
  }

  if (estado === "error") {
    return (
      <div className="mt-gap-md rounded-2xl border border-ink/10 bg-sand-warm px-4 py-3">
        <p className="text-small leading-relaxed text-ink-soft">
          No se pudo comprobar si sigues a este negocio. Revisa tu conexión y
          vuelve a abrir la ficha.
        </p>
      </div>
    );
  }

  if (estado === "sin-sesion") {
    return (
      <div className="mt-gap-md rounded-2xl border border-ink/10 bg-sand-warm px-4 py-3">
        <p className="text-small leading-relaxed text-ink-soft">
          Para recibir estos avisos en la app, inicia sesión. Son los mismos
          avisos que llegan por Telegram, pero sin salir de La Verde.
        </p>
        <a
          href="/login"
          className="mt-2 inline-flex text-small font-semibold text-verde-700 underline-offset-4 hover:underline"
        >
          Iniciar sesión
        </a>
      </div>
    );
  }

  const activo = estado === "activo";
  const cargando = estado === "cargando";

  return (
    <div className="mt-gap-md rounded-2xl border border-ink/10 bg-sand-warm px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-lv-display text-small font-semibold text-ink">
            Avisarme en la app
          </p>
          <p className="mt-1 text-meta leading-relaxed text-ink-soft/75">
            {activo
              ? `Te avisaremos de las novedades de ${nombre} en tu bandeja y en el móvil, si tienes los avisos activados.`
              : `Recibe en La Verde las novedades de ${nombre}, sin depender de Telegram.`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void alternar()}
          disabled={cargando || estado === "guardando"}
          aria-pressed={activo}
          aria-busy={cargando || estado === "guardando"}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-[6px] rounded-full px-4 font-lv-display text-meta font-semibold transition-colors duration-500 ease-outquint disabled:cursor-wait disabled:opacity-60",
            activo
              ? "border border-ink/10 bg-white text-ink hover:border-verde-300 hover:text-verde-700"
              : "bg-verde-950 text-white hover:bg-verde-800",
          )}
        >
          {cargando || estado === "guardando" ? (
            <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />
          ) : (
            <Bell size={14} strokeWidth={1.8} />
          )}
          {activo ? "Desactivar" : "Activar"}
        </button>
      </div>

      {aviso && (
        <p role="alert" className="mt-2 text-meta font-medium text-destructive">
          {aviso}
        </p>
      )}
    </div>
  );
}
