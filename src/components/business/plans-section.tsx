"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SUPPORT_EMAIL } from "@/lib/legal";
import {
  FEATURES_QUE_ANADE,
  FEATURE_TEXTO,
  PLAN_LABEL,
  PLAN_LEMA,
  PLAN_ORDER,
  PRECIO_MENSUAL,
  type Feature,
  type Plan,
} from "@/lib/plans";

/**
 * Los planes, explicados.
 *
 * Tres tarjetas, no una tabla: la tabla no cabe en un móvil sin scroll
 * horizontal, y aquí se entra desde el móvil casi siempre. Cada tarjeta enseña
 * **lo que ese plan añade** sobre el anterior —no la lista entera otra vez— y el
 * encabezado dice de dónde viene, así que las tres se comparan de un vistazo.
 *
 * Se destaca la tarjeta **siguiente** a la del negocio, no una fija. Un cartel
 * de «el más popular» clava el mismo plan para todo el mundo y, cuando alguien lo
 * tiene ya contratado, le pone la insignia a lo que ya paga. El plan que hay que
 * vender es el que aún no tiene.
 *
 * No hay pasarela todavía, y no se finge una: el botón abre el correo con el
 * asunto ya puesto, que es lo que de verdad funciona hoy.
 *
 * La excepción es el **negocio de prueba**: `puedeElegirPlan` enciende un
 * selector que guarda el plan sin más, porque su único propósito es poder ver las
 * funciones de cada plan sin pagar ni esperar a que administración lo cambie.
 */
export function PlansSection({
  plan,
  negocio,
  placeId,
  puedeElegirPlan = false,
}: {
  /** El plan efectivo del negocio, resuelto en el servidor. */
  plan: Plan;
  /** Para que el correo diga de qué negocio se trata sin preguntarlo. */
  negocio: string;
  /** El id del negocio, para saber a qué ruta pedir el cambio de plan. */
  placeId: string;
  /** Solo el negocio de prueba cambia de plan a voluntad. */
  puedeElegirPlan?: boolean;
}) {
  const router = useRouter();
  const [pendiente, setPendiente] = useState<Plan | null>(null);

  const indice = PLAN_ORDER.indexOf(plan);
  const siguiente = PLAN_ORDER[indice + 1] ?? null;

  /* El cambio de plan es un POST a la ruta del fixture y luego un `refresh`:
     el plan llega resuelto del servidor a todo el panel —el candado de «Hoy
     hay», la tarjeta del dashboard—, así que refrescar es lo que hace que el
     resto de la vista se entere de que hay plan nuevo. */
  async function elegir(p: Plan) {
    if (pendiente) return;
    setPendiente(p);
    try {
      const res = await fetch(`/api/places/${placeId}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: p }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo cambiar el plan.");
        return;
      }
      toast.success(`Plan ${PLAN_LABEL[p]} activado.`);
      router.refresh();
    } catch {
      toast.error("No se pudo cambiar el plan.");
    } finally {
      setPendiente(null);
    }
  }

  return (
    <section>
      <div className="mb-gap-lg">
        <h1 className="sr-only">Planes y precios</h1>
        <p className="max-w-[60ch] text-lead text-ink-soft">
          Tu negocio ya está en La Verde. Esto es lo que hay, con lo que suma
          cada plan — y se sube desde aquí mismo.
        </p>
      </div>

      {puedeElegirPlan && (
        <p className="mb-gap-md rounded-2xl border border-verde-200 bg-verde-50/60 px-gap-md py-gap-sm text-small text-verde-900">
          <span className="font-semibold">Negocio de prueba.</span> Elige
          cualquier plan y se aplica al momento, para ver sus funciones sin
          pasar por la pasarela.
        </p>
      )}

      <div className="grid grid-cols-1 gap-gap-md lg:grid-cols-3">
        {PLAN_ORDER.map((p) => (
          <PlanTile
            key={p}
            plan={p}
            actual={plan}
            destacado={p === siguiente}
            negocio={negocio}
            puedeElegirPlan={puedeElegirPlan}
            cargando={pendiente === p}
            bloqueado={pendiente !== null && pendiente !== p}
            onElegir={() => elegir(p)}
          />
        ))}
      </div>

      {/* Las dos dudas que salen siempre, contestadas antes de que las
          pregunten por correo. */}
      <ul className="mt-gap-lg grid grid-cols-1 gap-gap-sm text-small text-ink-soft/75 lg:grid-cols-2">
        <li>
          <span className="font-semibold text-ink">Bajar de plan no borra nada.</span>{" "}
          Tus productos, fotos y carta se quedan; solo dejas de poder añadir más.
        </li>
        <li>
          <span className="font-semibold text-ink">Negocio nuevo, 30 días de Pro.</span>{" "}
          La prueba entra sola al registrarte y no hay que pagar nada por ella.
        </li>
      </ul>
    </section>
  );
}

/** El cero se dice «Gratis» y no «0 USD», que es lo único que cambia. */
function precioDe(plan: Plan): { valor: string; unidad: string | null } {
  const cifra = PRECIO_MENSUAL[plan];
  if (cifra === 0) return { valor: "Gratis", unidad: "para siempre" };
  return { valor: `${cifra} USD`, unidad: "al mes" };
}

function PlanTile({
  plan,
  actual,
  destacado,
  negocio,
  puedeElegirPlan,
  cargando,
  bloqueado,
  onElegir,
}: {
  plan: Plan;
  actual: Plan;
  destacado: boolean;
  negocio: string;
  puedeElegirPlan: boolean;
  cargando: boolean;
  bloqueado: boolean;
  onElegir: () => void;
}) {
  const esActual = plan === actual;
  const indice = PLAN_ORDER.indexOf(plan);
  const anterior: Plan | null = indice > 0 ? (PLAN_ORDER[indice - 1] ?? null) : null;
  const anade = FEATURES_QUE_ANADE[plan] as readonly Feature[];
  const { valor, unidad } = precioDe(plan);

  /* Subir o bajar no cambian el correo, solo el asunto: quien atiende necesita
     saber qué se pide antes de abrir el mensaje. */
  const asunto = encodeURIComponent(
    `Quiero ${esActual ? "información sobre" : "el plan"} ${PLAN_LABEL[plan]} — ${negocio}`,
  );

  return (
    <article
      className={cn(
        "relative flex flex-col rounded-4xl border bg-white p-gap-lg",
        destacado ? "border-verde-300 shadow-card" : "border-ink/5 shadow-soft",
        esActual && "ring-2 ring-verde-400/35",
      )}
    >
      {destacado && !esActual && (
        <span className="absolute -top-[11px] left-gap-lg inline-flex items-center gap-[4px] rounded-full bg-verde-400 px-gap-sm py-[3px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em] text-verde-950">
          <Sparkles size={11} strokeWidth={2.2} />
          Recomendado
        </span>
      )}

      <div className="flex items-center gap-gap-xs">
        <h2 className="font-lv-display text-h3 font-bold tracking-[-0.01em] text-ink">
          {PLAN_LABEL[plan]}
        </h2>
        {esActual && (
          <span className="inline-flex items-center rounded-full border border-verde-200 bg-verde-50 px-[10px] py-[3px] font-lv-display text-[11px] font-semibold uppercase tracking-[0.12em] text-verde-700">
            Tu plan
          </span>
        )}
      </div>

      <p className="mt-gap-sm flex flex-wrap items-baseline gap-gap-2xs">
        <span className="font-lv-display text-h3 font-bold text-ink">{valor}</span>
        {unidad && <span className="text-meta text-ink-soft/75">{unidad}</span>}
      </p>

      <p className="mt-gap-2xs text-small text-ink-soft/75">{PLAN_LEMA[plan]}</p>

      <div className="my-gap-md h-px bg-ink/5" />

      <p className="font-lv-display text-meta font-semibold uppercase tracking-[0.1em] text-ink-soft/75">
        {anterior ? `Todo lo de ${PLAN_LABEL[anterior]}, y además` : "Empiezas por aquí"}
      </p>
      <ul className="mt-gap-sm flex flex-col gap-gap-xs">
        {anade.map((feature) => (
          <li key={feature} className="flex items-start gap-gap-xs text-small text-ink">
            <Check
              size={15}
              strokeWidth={2}
              className="mt-[3px] shrink-0 text-verde-600"
            />
            <span className="text-pretty">{FEATURE_TEXTO[feature]}</span>
          </li>
        ))}
      </ul>

      {/* `mt-auto` para que los tres botones caigan a la misma altura aunque las
          listas midan distinto. */}
      <div className="mt-auto pt-gap-lg">
        {esActual ? (
          <p className="flex h-11 items-center justify-center rounded-full border border-verde-200 bg-verde-50 font-lv-display text-small font-semibold text-verde-700">
            Es el que tienes
          </p>
        ) : puedeElegirPlan ? (
          <button
            type="button"
            onClick={onElegir}
            disabled={cargando || bloqueado}
            className={cn(
              "flex h-11 w-full items-center justify-center gap-gap-xs rounded-full font-lv-display text-small font-semibold transition-all duration-500 ease-outquint disabled:cursor-not-allowed disabled:opacity-60",
              destacado
                ? "bg-verde-400 text-verde-950 shadow-primary-halo hover:bg-verde-300 active:scale-[0.98]"
                : "border border-ink/10 bg-white text-ink hover:border-verde-300 hover:text-verde-700",
            )}
          >
            {cargando ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Activando…
              </>
            ) : (
              `Usar ${PLAN_LABEL[plan]}`
            )}
          </button>
        ) : (
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${asunto}`}
            className={cn(
              "flex h-11 items-center justify-center rounded-full font-lv-display text-small font-semibold transition-all duration-500 ease-outquint",
              destacado
                ? "bg-verde-400 text-verde-950 shadow-primary-halo hover:bg-verde-300 active:scale-[0.98]"
                : "border border-ink/10 bg-white text-ink hover:border-verde-300 hover:text-verde-700",
            )}
          >
            Quiero {PLAN_LABEL[plan]}
          </a>
        )}
      </div>
    </article>
  );
}
