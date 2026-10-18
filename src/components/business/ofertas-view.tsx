"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Loader2, Save, Sparkles, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { OfertasEditor } from "@/components/business/ofertas-editor";
import { limiteDe, textoBloqueo, type Funcion } from "@/lib/plans";
import { registrarGuarda } from "@/lib/unsaved-guard";
import { useCatalogo } from "@/providers/catalogo-provider";
import { usePlaces } from "@/providers/places-provider";
import type { UserPlace, UserPlaceOferta } from "@/lib/places-store";

/**
 * Ofertas flash, con sección propia.
 *
 * Antes vivían al final de «Editar ficha», donde se enterraban entre horarios y
 * energía y se guardaban de paso con toda la ficha. Aquí tienen su pantalla, su
 * barra de guardado y su propia guardia de salida: se cambian todas las semanas,
 * como la carta, no una vez como la ficha.
 */
export function OfertasView({
  place,
  funciones,
  onVerPlanes,
}: {
  place: UserPlace;
  funciones: Funcion[];
  onVerPlanes: () => void;
}) {
  const router = useRouter();
  const cat = useCatalogo();
  const { updatePlace } = usePlaces();

  const puedeOfertas = funciones.includes("ofertas_flash");
  const maxOfertas = limiteDe(new Set(funciones), "ofertas_vigentes_max", cat);

  /* Se siembra del negocio y manda a partir de aquí, como el editor y el
     catálogo: resincronizar en cada `router.refresh()` borraría lo que se está
     escribiendo. `guardado` es la última versión que la base confirmó. */
  const [ofertas, setOfertas] = useState<UserPlaceOferta[]>(
    place.ofertas ?? [],
  );
  const guardado = useRef(JSON.stringify(place.ofertas ?? []));
  const sucio = JSON.stringify(ofertas) !== guardado.current;

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ahora = Date.now();
  const enCurso = ofertas.filter(
    (o) => o.inicia <= ahora && o.termina > ahora,
  ).length;
  const programadas = ofertas.filter((o) => o.inicia > ahora).length;
  const terminadas = ofertas.filter((o) => o.termina <= ahora).length;

  const save = useCallback(async () => {
    setError(null);
    setSaving(true);
    const saved = await updatePlace(place.id, { ofertas });
    setSaving(false);

    if (!saved) {
      setError(
        "No se pudo guardar. Revisa la conexión e inténtalo otra vez: no se cambió nada.",
      );
      return;
    }

    guardado.current = JSON.stringify(ofertas);
    toast.success("Ofertas guardadas");
    /* La ficha pública es de servidor: sin esto sigue enseñando las ofertas
       viejas hasta que caduque la caché. */
    router.refresh();
  }, [ofertas, place.id, updatePlace, router]);

  /* Misma red que el catálogo y la ficha: el armazón pregunta antes de cambiar
     de sección y el navegador antes de cerrar la pestaña. */
  useEffect(() => {
    if (!sucio) return;
    registrarGuarda(() =>
      window.confirm(
        "Tienes ofertas sin guardar. Si sales ahora se descartan. ¿Salir igual?",
      ),
    );
    const alCerrar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", alCerrar);
    return () => {
      registrarGuarda(null);
      window.removeEventListener("beforeunload", alCerrar);
    };
  }, [sucio]);

  return (
    <div className={cn("flex flex-col", sucio && "pb-[92px]")}>
      <h1 className="sr-only">Ofertas</h1>

      {/* La cabecera reutiliza `ficha-preview` a propósito: es el degradado
          claro→arena que ya tiene su pareja oscura en `globals.css`. Un
          degradado nuevo aquí se quedaría blanco con el tema oscuro. */}
      <section className="ficha-preview relative overflow-hidden rounded-3xl border border-verde-200 bg-gradient-to-br from-verde-50 via-white to-sand-warm p-gap-md shadow-soft sm:p-gap-lg">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-verde-200/40 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-12 size-52 rounded-full bg-sand-deep/60 blur-3xl"
        />
        <Sparkles
          aria-hidden
          size={72}
          strokeWidth={1}
          className="pointer-events-none absolute right-4 top-6 text-verde-600 opacity-15"
        />

        <div className="relative">
          <p className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.18em] text-verde-700">
            Marketing
          </p>
          <div className="mt-gap-xs flex items-center gap-gap-sm">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-verde-400 text-verde-950 shadow-soft">
              <Tag size={24} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <h2 className="font-lv-display text-h3 font-bold tracking-[-0.02em] text-ink">
                Ofertas flash
              </h2>
              <p className="text-small text-ink-soft/75">
                Rebaja un producto por tiempo limitado y sale en tu ficha con el
                precio tachado.
              </p>
            </div>
          </div>

          <dl className="mt-gap-md grid grid-cols-3 gap-gap-xs">
            <DatoOferta label="En curso" value={enCurso} tono="verde" />
            <DatoOferta label="Programadas" value={programadas} tono="neutro" />
            <DatoOferta label="Terminadas" value={terminadas} tono="neutro" />
          </dl>
        </div>
      </section>

      <section className="mt-gap-md rounded-2xl border border-ink/5 bg-white p-gap-md">
        {puedeOfertas ? (
          <OfertasEditor
            ofertas={ofertas}
            onChange={setOfertas}
            menu={(place.menu ?? []).map((m, i) => ({
              ...m,
              id: m.id ?? String(i),
            }))}
            max={maxOfertas}
          />
        ) : (
          /* Sin la función no hay tope ni formulario que enseñar, pero sí una
             frase que dice cómo se abre. El servidor lo comprueba igual. */
          <div className="flex flex-col items-start gap-gap-sm">
            <div className="flex items-start gap-gap-sm">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-verde-50 text-verde-600">
                <Sparkles size={20} strokeWidth={1.8} />
              </span>
              <p className="max-w-[52ch] text-small text-ink-soft/75">
                {textoBloqueo("ofertas_flash", cat)}: rebaja un producto de tu
                carta por tiempo limitado y sale con el precio tachado en tu
                ficha, además de la chapita «Oferta» en la tarjeta y en el pin
                del mapa.
              </p>
            </div>
            <button
              type="button"
              onClick={onVerPlanes}
              className="inline-flex h-11 cursor-pointer items-center rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-colors duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98]"
            >
              Ver planes
            </button>
          </div>
        )}

        <AnimatePresence>
          {error && (
            <motion.p
              key="ofertas-error"
              role="alert"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="mt-gap-sm rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-[7px] text-meta font-medium text-ink"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </section>

      {/* La barra solo aparece con cambios pendientes: un botón que guarda lo
          mismo que ya está en la base es ruido. */}
      {sucio && (
        <div className="sticky bottom-4 z-40 mt-gap-lg flex justify-end">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex h-12 cursor-pointer items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-colors duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
          >
            {saving ? (
              <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
            ) : (
              <Save size={16} strokeWidth={1.8} />
            )}
            {saving ? "Guardando…" : "Guardar ofertas"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Una cifra de la cabecera. */
function DatoOferta({
  label,
  value,
  tono,
}: {
  label: string;
  value: number;
  tono: "verde" | "neutro";
}) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white/70 p-gap-sm backdrop-blur-[2px]">
      <dt className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.16em] text-verde-700">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-[3px] font-lv-display text-h3 font-bold tabular-nums",
          tono === "verde" ? "text-verde-600" : "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
