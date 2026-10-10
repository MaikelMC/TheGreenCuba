"use client";

import { useEffect, useState } from "react";
import { Lock, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { CopyLink } from "@/components/profile/copy-link";
import { textoBloqueo, type Plan } from "@/lib/plans";
import { AVISOS_POR_SEMANA } from "@/lib/seguidores";
import type { UserPlace } from "@/lib/places-store";

/**
 * La tarjeta de seguidores del panel: cuántos hay, cuántos avisos quedan esta
 * semana y el enlace del bot para repartirlo.
 *
 * **La Verde no deja escribir a los seguidores a mano.** Los avisos los dispara
 * el propio producto —una oferta flash, un producto nuevo, una reapertura—, y
 * eso es deliberado: una lista de difusión con un botón de «mandar» acaba siendo
 * spam y quema a los seguidores. Aquí el dueño ve el estado y el enlace; lo que
 * se manda lo decide lo que publique.
 *
 * Casi todo lo que se enseña viene de `/api/seguidores`, que es quien cuenta los
 * seguidores y el gasto de la semana —el mismo contador que corta el envío—. El
 * enlace cae a `place.enlaceSeguidores` si la lectura falla: es un dato que la
 * ficha ya trae resuelto, así que sin red al dueño no se le queda la tarjeta en
 * blanco.
 */
export function SeguidoresCard({
  place,
  plan,
  onVerPlanes,
}: {
  place: UserPlace;
  plan: Plan;
  /** Lleva a la sección «Planes» cuando la función no entra en el plan. */
  onVerPlanes: () => void;
}) {
  const bloqueo = textoBloqueo("seguidores", plan);

  const [enlace, setEnlace] = useState<string | null>(
    place.enlaceSeguidores ?? null,
  );
  const [total, setTotal] = useState<number | null>(null);
  const [restantes, setRestantes] = useState<number | null>(null);

  /* Sin la función no se pide nada: el candado ya lo dice todo y la lectura solo
     gastaría un viaje para el mismo «no». */
  useEffect(() => {
    if (bloqueo) return;
    let vivo = true;

    void (async () => {
      try {
        const res = await fetch(
          `/api/seguidores?negocioId=${encodeURIComponent(place.id)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          enlace: string | null;
          seguidores: number;
          avisos: { restantes: number };
        };
        if (!vivo) return;
        setEnlace(data.enlace);
        setTotal(data.seguidores);
        setRestantes(data.avisos.restantes);
      } catch {
        /* Sin red se queda con lo que traía la ficha: el enlace. */
      }
    })();

    return () => {
      vivo = false;
    };
  }, [bloqueo, place.id]);

  return (
    <section
      id="ajustes-seguidores"
      className="rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft"
    >
      <div className="flex flex-wrap items-center justify-between gap-gap-sm">
        <h2 className="flex items-center gap-gap-xs font-lv-display text-body font-semibold text-ink">
          <Users size={18} strokeWidth={1.8} className="text-verde-600" />
          Avisos a seguidores
        </h2>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-[10px] py-[3px] font-lv-display text-[11px] font-semibold uppercase tracking-[0.12em]",
            bloqueo
              ? "border border-ink/10 bg-sand text-ink-soft/75"
              : "border border-verde-200 bg-verde-50 text-verde-700",
          )}
        >
          {bloqueo ?? (total === null ? "Activo" : `${total} seguidores`)}
        </span>
      </div>

      <p className="mt-gap-xs max-w-[62ch] text-small text-ink-soft/75">
        Quien abre tu ficha puede pulsar «Avísame de ofertas» y seguirte por
        Telegram. Cuando publiques una oferta flash, un producto nuevo o vuelvas
        a abrir, les llega un mensaje corto —como mucho{" "}
        {AVISOS_POR_SEMANA} por semana— con el enlace a tu ficha. Cada mensaje
        lleva dentro el «/baja» para quien quiera irse.
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
            Tu ficha se comparte igual; solo le falta el botón de avisarte.
          </p>
        </div>
      ) : (
        <div className="mt-gap-md flex flex-col gap-gap-md border-t border-ink/5 pt-gap-sm">
          {restantes !== null && (
            <p className="text-small text-ink-soft">
              Avisos esta semana:{" "}
              <span className="font-semibold tabular-nums text-ink">
                {restantes} de {AVISOS_POR_SEMANA}
              </span>
              {restantes === 0 && " — el lunes vuelves a tenerlos."}
            </p>
          )}

          {enlace ? (
            <>
              <p className="text-small text-ink-soft/75">
                {total === null || total > 0
                  ? "Comparte este enlace donde quieras para que se suscriban sin pasar por la ficha."
                  : "Todavía no te sigue nadie. Comparte este enlace donde quieras para que se suscriban sin pasar por la ficha."}
              </p>
              <CopyLink url={enlace} />
            </>
          ) : (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-[7px] text-meta font-medium text-amber-800">
              El bot de avisos todavía no está listo. En cuanto lo esté, el botón
              aparecerá en tu ficha sin que tengas que hacer nada.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
