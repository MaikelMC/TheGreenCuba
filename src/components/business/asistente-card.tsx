"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Check, Copy, Lock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { textoBloqueo, type Plan } from "@/lib/plans";
import type { UserPlace } from "@/lib/places-store";

/**
 * La tarjeta del asistente de Telegram: vincula el chat del dueño con su ficha.
 *
 * El gesto es corto —pulsar el botón, tocar el enlace, listo— y por eso se enseña
 * el enlace además del código: el dueño puede abrir Telegram de un toque sin
 * teclear nada, y el código queda a la vista para quien lo prefiera escribir a
 * mano o para pegarlo desde otro teléfono.
 *
 * El estado sale de `/api/business/asistente`, que es quien comprueba el permiso
 * y genera el código. La tarjeta no decide nada: pide y pinta.
 */
interface Estado {
  vinculado: boolean;
  codigo: string | null;
  expiraEn: string | null;
  enlace: string | null;
  bot: string;
  minutosValidez: number;
}

export function AsistenteCard({
  place,
  plan,
  onVerPlanes,
}: {
  place: UserPlace;
  plan: Plan;
  onVerPlanes: () => void;
}) {
  const bloqueo = textoBloqueo("asistente_ia", plan);

  const [estado, setEstado] = useState<Estado | null>(null);
  const [generando, setGenerando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Sin la función no se pide nada: el candado ya lo dice todo. */
  useEffect(() => {
    if (bloqueo) return;
    let vivo = true;

    void (async () => {
      try {
        const res = await fetch(
          `/api/business/asistente?negocioId=${encodeURIComponent(place.id)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as Estado;
        if (vivo) setEstado(data);
      } catch {
        /* Sin red la tarjeta se queda en «Generar código», que es un estado
           válido: el botón lo vuelve a intentar. */
      }
    })();

    return () => {
      vivo = false;
    };
  }, [bloqueo, place.id]);

  /* Copiar puede fallar —sin HTTPS, o si el navegador no da el permiso— y por
     eso hay acuse: el botón se queda en «Copiado» dos segundos y, si no lo
     consiguió, lo dice en vez de fingir que sí. */
  const copiar = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(estado?.codigo ?? "");
      setCopiado(true);
    } catch {
      setError("No pude copiar el código. Apúntalo a mano.");
    }
  }, [estado?.codigo]);

  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(t);
  }, [copiado]);

  /* El código nuevo estrena botón: si quedaba un «Copiado» de antes, mentiría. */
  useEffect(() => {
    setCopiado(false);
  }, [estado?.codigo]);

  const generar = useCallback(async () => {
    setGenerando(true);
    setError(null);
    try {
      const res = await fetch("/api/business/asistente", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ negocioId: place.id }),
      });
      const data = (await res.json().catch(() => ({}))) as Estado & {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "No pude generar el código. Prueba otra vez.");
        return;
      }
      setEstado(data);
    } catch {
      setError("No pude generar el código. Prueba otra vez.");
    } finally {
      setGenerando(false);
    }
  }, [place.id]);

  return (
    <section
      id="ajustes-asistente"
      className="rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft"
    >
      <div className="flex flex-wrap items-center justify-between gap-gap-sm">
        <h2 className="flex items-center gap-gap-xs font-lv-display text-body font-semibold text-ink">
          <Bot size={18} strokeWidth={1.8} className="text-verde-600" />
          Asistente de Telegram
        </h2>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-[10px] py-[3px] font-lv-display text-[11px] font-semibold uppercase tracking-[0.12em]",
            bloqueo
              ? "border border-ink/10 bg-sand text-ink-soft/75"
              : estado?.vinculado
                ? "border border-verde-200 bg-verde-50 text-verde-700"
                : "border border-ink/10 bg-sand text-ink-soft/75",
          )}
        >
          {bloqueo ?? (estado?.vinculado ? "Vinculado" : "Sin vincular")}
        </span>
      </div>

      <p className="mt-gap-xs max-w-[62ch] text-small text-ink-soft/75">
        Háblale al bot para marcar agotados, abrir el día o cambiar precios.
      </p>

      {bloqueo ? (
        <div className="mt-gap-md flex flex-wrap items-center gap-gap-sm">
          <button
            type="button"
            onClick={onVerPlanes}
            className="inline-flex h-11 cursor-pointer items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-all duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98]"
          >
            <Lock size={15} strokeWidth={1.8} />
            Ver los planes
          </button>
          <p className="text-meta text-ink-soft/75">
            Tu ficha se ve igual; solo te falta poder gestionarla desde el
            móvil.
          </p>
        </div>
      ) : (
        <div className="mt-gap-md flex flex-col gap-gap-md border-t border-ink/5 pt-gap-sm">
          {error && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-[7px] text-meta font-medium text-amber-800">
              {error}
            </p>
          )}

          {estado && !estado.bot && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-[7px] text-meta font-medium text-amber-800">
              El bot todavía no está listo en el servidor. En cuanto lo esté,
              podrás vincularte sin que tengas que hacer nada.
            </p>
          )}

          {estado?.vinculado && (
            <p className="text-small text-ink">
              Ya hay un chat vinculado. Genera otro código para vincular un
              móvil distinto.
            </p>
          )}

          {estado?.codigo ? (
            <>
              <div className="flex flex-col gap-gap-xs">
                <p className="text-small text-ink-soft/75">
                  Mándale el código al bot con{" "}
                  <span className="font-semibold text-ink">/start</span>, o toca
                  el botón para abrirlo ya puesto.
                </p>
                <div className="flex flex-wrap items-center gap-gap-sm">
                  <span className="rounded-xl border border-verde-200 bg-verde-50 px-gap-md py-[7px] font-mono text-body font-bold tracking-[0.3em] text-verde-800">
                    {estado.codigo}
                  </span>
                  {/* El código se teclea en el móvil, donde copiar y pegar es
                      lo único que sale bien: el botón vive pegado a él. */}
                  <button
                    type="button"
                    onClick={() => void copiar()}
                    aria-label="Copiar el código"
                    className={cn(
                      "inline-flex h-9 cursor-pointer items-center gap-gap-xs rounded-full border px-gap-sm font-lv-display text-meta font-semibold transition-colors",
                      copiado
                        ? "border-verde-200 bg-verde-50 text-verde-700"
                        : "border-ink/10 bg-white text-ink-soft/75 hover:bg-sand",
                    )}
                  >
                    {copiado ? (
                      <Check size={14} strokeWidth={2} />
                    ) : (
                      <Copy size={14} strokeWidth={1.8} />
                    )}
                    {copiado ? "Copiado" : "Copiar"}
                  </button>
                  <span className="text-meta text-ink-soft/75">
                    Vale {estado.minutosValidez} minutos y una sola vez.
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-gap-sm">
                {estado.enlace && (
                  <a
                    href={estado.enlace}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 cursor-pointer items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-all duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98]"
                  >
                    <Bot size={15} strokeWidth={1.8} />
                    Abrir en Telegram
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => void generar()}
                  disabled={generando}
                  className="inline-flex h-11 cursor-pointer items-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-lg font-lv-display text-small font-semibold text-ink transition-colors hover:bg-sand disabled:pointer-events-none disabled:opacity-60"
                >
                  <RefreshCw
                    size={15}
                    strokeWidth={1.8}
                    className={cn(generando && "animate-spin")}
                  />
                  {generando ? "Generando…" : "Generar otro"}
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void generar()}
              disabled={generando || !estado}
              className="inline-flex h-11 w-fit cursor-pointer items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-all duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
            >
              <Bot size={15} strokeWidth={1.8} />
              {generando ? "Generando…" : "Generar código"}
            </button>
          )}

          {!estado?.codigo && estado?.bot && (
            <p className="text-meta text-ink-soft/75">
              Caduca a los {estado.minutosValidez} minutos.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
