"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SUPPORT_EMAIL } from "@/lib/legal";
import {
  PACKS_ORDER,
  PLAN_ORDER,
  nombreDe,
  textoCup,
  type ClaveModulo,
  type Funcion,
  type Pack,
  type Plan,
} from "@/lib/plans";
import { useCatalogo } from "@/providers/catalogo-provider";

/**
 * Los planes, los módulos y los packs, explicados.
 *
 * Tres bloques, no una tabla: la tabla no cabe en un móvil sin scroll horizontal
 * y aquí se entra desde el móvil casi siempre. Primero **lo que ya tienes**
 * —Gratis—, luego los **módulos sueltos** —uno a uno, sin dependencias— y al
 * final los **packs**, que son módulos juntos con descuento. Así se lee de
 * arriba abajo: lo básico, lo que puedes añadir suelto y lo que sale mejor en
 * paquete.
 *
 * Las funciones con `disponible: false` se siguen enseñando, con la etiqueta
 * «Próximamente»: se venden desde ya, pero el candado no se abre hasta que
 * existan de verdad. Se dice en la tarjeta, no en letra pequeña.
 *
 * Se destaca el **pack siguiente** al del negocio, no una fija. Un cartel de «el
 * más popular» clava el mismo plan para todo el mundo y, cuando alguien ya lo
 * tiene, le pone la insignia a lo que ya paga.
 *
 * No hay pasarela todavía, y no se finge una: el botón abre el correo con el
 * asunto ya puesto, que es lo que de verdad funciona hoy.
 *
 * La excepción es el **negocio de prueba**: `puedeElegirPlan` enciende un
 * selector que guarda el pack sin más, porque su único propósito es poder ver
 * las funciones de cada plan sin pagar ni esperar a que administración lo
 * cambie.
 */
export function PlansSection({
  plan,
  negocio,
  placeId,
  puedeElegirPlan = false,
}: {
  /** El pack efectivo del negocio, resuelto en el servidor. */
  plan: Plan;
  /** Para que el correo diga de qué negocio se trata sin preguntarlo. */
  negocio: string;
  /** El id del negocio, para saber a qué ruta pedir el cambio de plan. */
  placeId: string;
  /** Solo el negocio de prueba cambia de plan a voluntad. */
  puedeElegirPlan?: boolean;
}) {
  const router = useRouter();
  const cat = useCatalogo();
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
      toast.success(`Plan ${nombreDe(p, cat)} activado.`);
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
          Tu negocio ya está en La Verde. Esto es lo que hay: módulos sueltos
          para lo que necesites, o packs con todo junto y descuento.
        </p>
      </div>

      {puedeElegirPlan && (
        <p className="mb-gap-md rounded-2xl border border-verde-200 bg-verde-50/60 px-gap-md py-gap-sm text-small text-verde-900">
          <span className="font-semibold">Negocio de prueba.</span> Elige
          cualquier pack y se aplica al momento, para ver sus funciones sin
          pasar por la pasarela.
        </p>
      )}

      <Bloque
        titulo="Lo que ya tienes"
        detalle="Incluido en cualquier negocio de La Verde, con o sin plan."
      >
        <article className="rounded-4xl border border-ink/5 bg-white p-gap-lg shadow-soft">
          <h3 className="font-lv-display text-h3 font-bold tracking-[-0.01em] text-ink">
            {cat.gratisNombre}
          </h3>
          <p className="mt-gap-2xs text-small text-ink-soft/75">
            {cat.gratisLema}
          </p>
          <ListaFunciones funciones={cat.gratis} className="mt-gap-md" />
        </article>
      </Bloque>

      <Bloque
        titulo="Módulos sueltos"
        detalle="Se contrata el que haga falta, al mes. Ninguno depende de otro."
      >
        <div className="grid grid-cols-1 gap-gap-md lg:grid-cols-2">
          {(Object.keys(cat.modulos) as ClaveModulo[]).map((clave) => (
            <ModuloTile key={clave} clave={clave} negocio={negocio} />
          ))}
        </div>
      </Bloque>

      <Bloque
        titulo="Packs"
        detalle="Varios módulos juntos, con descuento. Nada excluye tener además un módulo suelto."
      >
        <div className="grid grid-cols-1 gap-gap-md lg:grid-cols-3">
          {PACKS_ORDER.map((p) => (
            <PackTile
              key={p}
              pack={p}
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
      </Bloque>

      {/* Las dudas que salen siempre, contestadas antes de que las pregunten por
          correo. */}
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

/** Un bloque con su titular, para separar Gratis, módulos y packs. */
function Bloque({
  titulo,
  detalle,
  children,
}: {
  titulo: string;
  detalle: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-gap-lg">
      <h2 className="font-lv-display text-h3 font-bold tracking-[-0.01em] text-ink">
        {titulo}
      </h2>
      <p className="mt-gap-2xs max-w-[60ch] text-small text-ink-soft/75">
        {detalle}
      </p>
      <div className="mt-gap-md">{children}</div>
    </div>
  );
}

/** La lista de funciones, cada una con su texto y su etiqueta si no existe aún. */
function ListaFunciones({
  funciones,
  className,
}: {
  funciones: readonly Funcion[];
  className?: string;
}) {
  const cat = useCatalogo();
  /* Facebook ×3 trae las dos funciones —tres a la semana incluye una—, y
     enseñar «publicaciones semanales» debajo de «tres veces por semana» es
     repetir lo mismo en dos renglones. Se queda la de más ritmo. */
  const lista = funciones.includes("publicaciones_fb_3")
    ? funciones.filter((f) => f !== "publicaciones_fb")
    : funciones;

  return (
    <ul className={cn("flex flex-col gap-gap-xs", className)}>
      {lista.map((f) => (
        <li key={f} className="flex items-start gap-gap-xs text-small text-ink">
          <Check
            size={15}
            strokeWidth={2}
            className="mt-[3px] shrink-0 text-verde-600"
          />
          <span className="text-pretty">{cat.funciones[f].texto}</span>
          {!cat.funciones[f].disponible && <Proximamente />}
        </li>
      ))}
    </ul>
  );
}

function Proximamente() {
  return (
    <span className="ml-gap-2xs shrink-0 rounded-full border border-ink/10 bg-sand px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-soft/75">
      Próximamente
    </span>
  );
}

/** Un módulo suelto: su precio, su lema y sus funciones. */
function ModuloTile({
  clave,
  negocio,
}: {
  clave: ClaveModulo;
  negocio: string;
}) {
  const cat = useCatalogo();
  const modulo = cat.modulos[clave];
  const asunto = encodeURIComponent(
    `Quiero el módulo ${modulo.nombre} — ${negocio}`,
  );

  return (
    <article className="flex flex-col rounded-4xl border border-ink/5 bg-white p-gap-lg shadow-soft">
      <h3 className="font-lv-display text-body font-bold tracking-[-0.01em] text-ink">
        {modulo.nombre}
      </h3>
      <Precio usd={modulo.usd} />
      <p className="mt-gap-2xs text-small text-ink-soft/75">{modulo.lema}</p>

      <div className="my-gap-md h-px bg-ink/5" />

      <ListaFunciones funciones={modulo.funciones} />

      {/* `mt-auto` para que los botones caigan a la misma altura aunque las
          listas midan distinto. */}
      <div className="mt-auto pt-gap-lg">
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=${asunto}`}
          className="flex h-11 items-center justify-center rounded-full border border-ink/10 bg-white font-lv-display text-small font-semibold text-ink transition-all duration-500 ease-outquint hover:border-verde-300 hover:text-verde-700"
        >
          Quiero {modulo.nombre}
        </a>
      </div>
    </article>
  );
}

/** Un pack: su precio, y lo que trae por encima de los módulos sueltos. */
function PackTile({
  pack,
  actual,
  destacado,
  negocio,
  puedeElegirPlan,
  cargando,
  bloqueado,
  onElegir,
}: {
  pack: Pack;
  actual: Plan;
  destacado: boolean;
  negocio: string;
  puedeElegirPlan: boolean;
  cargando: boolean;
  bloqueado: boolean;
  onElegir: () => void;
}) {
  const cat = useCatalogo();
  const datos = cat.packs[pack];
  const esActual = pack === actual;

  /* Subir o bajar no cambian el correo, solo el asunto: quien atiende necesita
     saber qué se pide antes de abrir el mensaje. */
  const asunto = encodeURIComponent(
    `Quiero ${esActual ? "información sobre" : "el pack"} ${nombreDe(pack, cat)} — ${negocio}`,
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
        <h3 className="font-lv-display text-h3 font-bold tracking-[-0.01em] text-ink">
          {nombreDe(pack, cat)}
        </h3>
        {esActual && (
          <span className="inline-flex items-center rounded-full border border-verde-200 bg-verde-50 px-[10px] py-[3px] font-lv-display text-[11px] font-semibold uppercase tracking-[0.12em] text-verde-700">
            Tu plan
          </span>
        )}
      </div>

      <Precio usd={datos.usd} />
      <p className="mt-gap-2xs text-small text-ink-soft/75">{datos.lema}</p>

      <div className="my-gap-md h-px bg-ink/5" />

      <p className="font-lv-display text-meta font-semibold uppercase tracking-[0.1em] text-ink-soft/75">
        {datos.incluye.map((c) => cat.modulos[c].nombre).join(" · ")}
      </p>
      <ListaFunciones funciones={datos.funciones} className="mt-gap-sm" />

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
              `Usar ${nombreDe(pack, cat)}`
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
            Quiero {nombreDe(pack, cat)}
          </a>
        )}
      </div>
    </article>
  );
}

/** El precio en dólares y, debajo, lo mismo en CUP al cambio de hoy. */
function Precio({ usd }: { usd: number }) {
  const cat = useCatalogo();
  return (
    <p className="mt-gap-sm flex flex-wrap items-baseline gap-gap-2xs">
      <span className="font-lv-display text-h3 font-bold text-ink">
        {usd} USD
      </span>
      <span className="text-meta text-ink-soft/75">
        al mes · {textoCup(usd, cat)}
      </span>
    </p>
  );
}
