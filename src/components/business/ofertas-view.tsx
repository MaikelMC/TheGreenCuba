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
import { BotonPrimario } from "@/components/business/ui/botones";

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

  /* La hora se fija tras montar: `Date.now()` en el render no coincide entre
     servidor y cliente y los tres contadores se pintaban distintos. */
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    setAhora(Date.now());
  }, []);

  const enCurso =
    ahora === null
      ? 0
      : ofertas.filter((o) => o.inicia <= ahora && o.termina > ahora).length;
  const programadas =
    ahora === null ? 0 : ofertas.filter((o) => o.inicia > ahora).length;
  const terminadas =
    ahora === null ? 0 : ofertas.filter((o) => o.termina <= ahora).length;

  /* Guarda la lista que se le da (no la del estado, que aún no se ha
     actualizado cuando se llama desde `cambiar`). Devuelve si se guardó. */
  const save = useCallback(
    async (lista: UserPlaceOferta[], aviso: string | null = "Ofertas guardadas") => {
      setError(null);
      setSaving(true);
      const saved = await updatePlace(place.id, { ofertas: lista });
      setSaving(false);

      if (!saved) {
        setError(
          "No se pudo guardar. Revisa la conexión y pulsa «Guardar ofertas» para reintentar.",
        );
        return false;
      }

      guardado.current = JSON.stringify(lista);
      if (aviso) toast.success(aviso);
      /* La ficha pública es de servidor: sin esto sigue enseñando las ofertas
         viejas hasta que caduque la caché. */
      router.refresh();
      return true;
    },
    [place.id, updatePlace, router],
  );

  /**
   * Cada cambio del editor se guarda en el acto. Antes el botón del formulario
   * decía «Añadir a la lista» y la oferta solo quedaba en pantalla hasta pulsar
   * otro botón abajo: un dueño con prisa salía creyendo que ya estaba
   * publicada. Quitar una oferta también guarda, con «Deshacer» en el aviso,
   * que es lo que evita el borrado sin querer sin meter un diálogo más.
   */
  const cambiar = useCallback(
    (siguiente: UserPlaceOferta[]) => {
      const anterior = ofertas;
      setOfertas(siguiente);
      const quitada = siguiente.length < anterior.length;
      /* Al quitar, el aviso es el de «Deshacer» de abajo, no uno de éxito más. */
      void save(siguiente, quitada ? null : "Oferta guardada").then((ok) => {
        if (!ok || !quitada) return;
        toast("Oferta quitada", {
          action: {
            label: "Deshacer",
            onClick: () => {
              setOfertas(anterior);
              void save(anterior, "Oferta recuperada");
            },
          },
        });
      });
    },
    [ofertas, save],
  );

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

      {/* Cabecera plana, como la sección de debajo: icono, título y una línea
          de estado. Antes era un degradado con dos halos, un destello de 72 px
          y tres tarjetas de cifras con rótulos en mayúsculas sobre vidrio: el
          patrón de «cifra grande en tarjeta» del SaaS genérico, para contar
          tres números que caben en una frase. */}
      <section className="rounded-2xl border border-ink/5 bg-white p-gap-md sm:p-gap-lg">
        <div className="flex items-center gap-gap-sm">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-50 text-verde-700">
            <Tag size={22} strokeWidth={1.9} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="font-lv-display text-h3 font-bold tracking-[-0.02em] text-ink text-balance">
              Ofertas flash
            </h2>
            <p className="text-small text-ink-soft/75 text-pretty">
              Rebaja un producto por tiempo limitado y sale en tu ficha con el
              precio tachado.
            </p>
          </div>
        </div>

        {/* El estado en una línea. El color nunca va solo: cada punto lleva
            su palabra (`color-not-decorative-only`). */}
        <ul className="mt-gap-sm flex flex-wrap items-center gap-x-gap-md gap-y-gap-2xs text-small text-ink-soft/75">
          <EstadoOfertas valor={enCurso} singular="en curso" plural="en curso" punto="bg-verde-500" />
          <EstadoOfertas valor={programadas} singular="programada" plural="programadas" punto="bg-amber-500" />
          <EstadoOfertas valor={terminadas} singular="terminada" plural="terminadas" punto="bg-sand-deep ring-1 ring-inset ring-ink/15" />
        </ul>
      </section>

      <section className="mt-gap-md rounded-2xl border border-ink/5 bg-white p-gap-md">
        {puedeOfertas ? (
          <OfertasEditor
            ofertas={ofertas}
            onChange={cambiar}
            etiquetaGuardar="Guardar oferta"
            guardando={saving}
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
            <BotonPrimario onClick={onVerPlanes}>Ver planes</BotonPrimario>
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
          <BotonPrimario
            alto="lg"
            onClick={() => void save(ofertas)}
            disabled={saving}
          >
            {saving ? (
              <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
            ) : (
              <Save size={16} strokeWidth={1.8} />
            )}
            {saving ? "Guardando…" : "Guardar ofertas"}
          </BotonPrimario>
        </div>
      )}
    </div>
  );
}

/** Un estado de la línea de la cabecera: «2 programadas», con su punto. */
function EstadoOfertas({
  valor,
  singular,
  plural,
  punto,
}: {
  valor: number;
  singular: string;
  plural: string;
  punto: string;
}) {
  return (
    <li className="inline-flex items-center gap-[6px]">
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", punto)} />
      <span>
        <strong className="font-semibold tabular-nums text-ink">{valor}</strong>{" "}
        {valor === 1 ? singular : plural}
      </span>
    </li>
  );
}
