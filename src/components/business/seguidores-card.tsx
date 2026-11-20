"use client";

import { useEffect, useState } from "react";
import { Lock, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { CopyLink } from "@/components/profile/copy-link";
import { bloqueoDe, type Funcion } from "@/lib/plans";
import { useCatalogo } from "@/providers/catalogo-provider";
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
  funciones,
  onVerPlanes,
}: {
  place: UserPlace;
  /** Todo lo que puede hacer el negocio, resuelto en el servidor. */
  funciones: Funcion[];
  /** Lleva a la sección «Planes» cuando la función no entra. */
  onVerPlanes: () => void;
}) {
  const cat = useCatalogo();
  const bloqueo = bloqueoDe(funciones, "seguidores", cat);

  const [enlace, setEnlace] = useState<string | null>(
    place.enlaceSeguidores ?? null,
  );
  const [total, setTotal] = useState<number | null>(null);
  const [enApp, setEnApp] = useState(0);
  const [enviadosSemana, setEnviadosSemana] = useState<number | null>(null);

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
          enApp: number;
          avisos: { usados: number };
        };
        if (!vivo) return;
        setEnlace(data.enlace);
        setTotal(data.seguidores);
        setEnApp(data.enApp);
        setEnviadosSemana(data.avisos.usados);
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
      className="rounded-2xl border border-ink/5 bg-white p-gap-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-gap-sm">
        <h2 className="flex items-center gap-gap-xs font-lv-display text-body font-semibold text-ink">
          <Users size={18} strokeWidth={1.8} className="text-verde-600" />
          Avisos a seguidores
        </h2>
        <span
          className={cn(
            /* 12 px y sin mayúsculas espaciadas, como las chapitas del resto
               de Ajustes (`readable-font-size` de ui-ux-pro-max). */
            "inline-flex items-center rounded-full px-[10px] py-[3px] font-lv-display text-meta font-semibold",
            bloqueo
              ? "border border-ink/10 bg-sand text-ink-soft/75"
              : "border border-verde-200 bg-verde-50 text-verde-700",
          )}
        >
          {bloqueo ?? (total === null ? "Activo" : `${total + enApp} seguidores`)}
        </span>
      </div>

      <p className="mt-gap-xs max-w-[62ch] text-small text-ink-soft/75">
        Quien te sigue recibe un aviso corto cuando publicas algo nuevo.
      </p>

      {bloqueo ? (
        <div className="mt-gap-md flex flex-wrap items-center gap-gap-sm">
          <button
            type="button"
            onClick={onVerPlanes}
            className="inline-flex h-11 cursor-pointer items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98]"
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
          {/* Sin tope semanal. Lo que se explica es el ritmo: los cambios
              seguidos salen juntos, para no llenar el chat de tus seguidores. */}
          {enviadosSemana !== null && (
            <p className="text-small text-ink-soft">
              Avisos enviados esta semana:{" "}
              <span className="font-semibold tabular-nums text-ink">
                {enviadosSemana}
              </span>
              . Sin límite; los cambios que hagas seguidos les llegan juntos en un
              solo mensaje, como mucho uno cada media hora.
            </p>
          )}

          {enlace ? (
            <>
              <p className="text-small text-ink-soft/75">
                {total === null || total > 0
                  ? "Compártelo para que se suscriban sin pasar por la ficha."
                  : "Todavía no te sigue nadie. Compártelo donde quieras."}
              </p>
              <CopyLink url={enlace} />
            </>
          ) : (
            <p className="rounded-xl border border-lv-amber/40 bg-lv-amber/10 px-3 py-[7px] text-meta font-medium text-ink">
              Tus avisos ya llegan por la app (bandeja y móvil). El bot de
              Telegram todavía no está listo: cuando lo esté, será una segunda
              vía en el mismo botón.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
