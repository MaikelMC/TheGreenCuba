"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, MessageCircle, Sparkles, Wallet } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { whatsappHref } from "@/lib/contact-links";
import { SUPPORT_WHATSAPP } from "@/lib/legal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
 * —Gratis—, luego los **servicios por separado** —uno a uno, sin dependencias—
 * y al final los **packs**, que son sus funciones juntas con descuento. Así se
 * lee de arriba abajo: lo básico, lo que puedes añadir suelto y lo que sale
 * mejor en paquete.
 *
 * Las funciones con `disponible: false` se siguen enseñando, con la etiqueta
 * «Próximamente»: se venden desde ya, pero el candado no se abre hasta que
 * existan de verdad. Se dice en la tarjeta, no en letra pequeña.
 *
 * Se destaca el **pack siguiente** al del negocio, no una fija. Un cartel de «el
 * más popular» clava el mismo plan para todo el mundo y, cuando alguien ya lo
 * tiene, le pone la insignia a lo que ya paga.
 *
 * El botón abre una factura de QvaPay para un mes del pack o del módulo. El
 * importe y el derecho contratado los resuelve el servidor; la activación llega
 * por webhook, así que al volver de QvaPay hay que recargar para verlo.
 *
 * La excepción es el **negocio de prueba**: `puedeElegirPlan` enciende un
 * selector que guarda el pack sin más, porque su único propósito es poder ver
 * las funciones de cada plan sin pagar ni esperar a que administración lo
 * cambie.
 */
export function PlansSection({
  plan,
  placeId,
  puedeElegirPlan = false,
  planElegido = null,
  modulosElegidos = [],
}: {
  /** El pack efectivo del negocio, resuelto en el servidor. */
  plan: Plan;
  /** El id del negocio, para saber a qué ruta pedir el cambio de plan. */
  placeId: string;
  /** Solo el negocio de prueba cambia de plan a voluntad. */
  puedeElegirPlan?: boolean;
  /**
   * El pack que se pulsó en la portada y viaja hasta aquí. Se marca para que
   * se pague ese y no haya que volver a buscarlo entre las tres tarjetas.
   */
  planElegido?: Pack | null;
  /**
   * Los servicios sueltos marcados en la portada. Mismo papel que el pack: se
   * señalan para pagarlos sin volver a buscarlos.
   */
  modulosElegidos?: readonly ClaveModulo[];
}) {
  const router = useRouter();
  const cat = useCatalogo();
  const [pendiente, setPendiente] = useState<Plan | null>(null);
  /** «plan:pro» o «modulo:menu_pro» mientras se abre la factura. */
  const [pagando, setPagando] = useState<string | null>(null);
  /** Lo que se va a cobrar, mientras se elige QvaPay o transferencia. */
  const [cobro, setCobro] = useState<{
    tipo: "plan" | "modulo";
    clave: string;
    nombre: string;
    usd: number;
  } | null>(null);

  const indice = PLAN_ORDER.indexOf(plan);
  const siguiente = PLAN_ORDER[indice + 1] ?? null;
  /* Para nombrar el servicio en singular; con varios solo se cuenta. */
  const primerModulo = modulosElegidos[0];

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

  /* Abre la factura de QvaPay en la misma pestaña. `window.open` después de un
     `await` lo bloquea el navegador; navegar no. El plan se activa por webhook,
     así que al volver basta recargar para verlo. */
  async function pagar(tipo: "plan" | "modulo", clave: string) {
    const objetivo = `${tipo}:${clave}`;
    if (pagando) return;
    setPagando(objetivo);
    try {
      const res = await fetch("/api/pagos/qvapay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId, tipo, clave }),
      });
      const data = (await res.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;
      if (!res.ok || !data?.url) {
        toast.error(data?.error ?? "No se pudo abrir el pago.");
        return;
      }
      window.location.href = data.url;
    } catch {
      toast.error("No se pudo abrir el pago.");
    } finally {
      setPagando(null);
    }
  }

  /* Antes de abrir nada se pregunta el método: QvaPay cobra al momento y la
     transferencia en CUP se acuerda por WhatsApp, que es lo único que hay
     mientras el cobro automático de transferencias no exista. */
  function pedirMetodo(
    tipo: "plan" | "modulo",
    clave: string,
    nombre: string,
    usd: number,
  ) {
    if (pagando) return;
    setCobro({ tipo, clave, nombre, usd });
  }

  const mensajeCup = cobro
    ? `Hola, quiero pagar ${cobro.nombre} de La Verde (${cobro.usd} USD al mes, ${textoCup(cobro.usd, cat)}) por transferencia en CUP.`
    : "";

  return (
    <section>
      {/* El nombre de la sección no se repite: ya está en el navbar. */}
      <h1 className="sr-only">Planes</h1>

      {puedeElegirPlan && (
        <p className="mb-gap-md rounded-2xl border border-verde-200 bg-verde-50/60 px-gap-md py-gap-sm text-small text-verde-900">
          <span className="font-semibold">Negocio de prueba.</span> Elige
          cualquier pack y se aplica al momento, para ver sus funciones sin
          pasar por la pasarela.
        </p>
      )}

      {(planElegido || modulosElegidos.length > 0) && (
        <p className="mb-gap-md rounded-2xl border border-verde-200 bg-verde-50/60 px-gap-md py-gap-sm text-small text-verde-900">
          <span className="font-semibold">
            {planElegido
              ? `Elegiste ${nombreDe(planElegido, cat)}.`
              : modulosElegidos.length === 1 && primerModulo
                ? `Elegiste ${cat.modulos[primerModulo].nombre}.`
                : `Elegiste ${modulosElegidos.length} servicios.`}
          </span>{" "}
          Paga el mes en su tarjeta y la suscripción se activa al confirmarse
          el pago.
        </p>
      )}

      <Bloque
        titulo="Lo que ya tienes"
        detalle="Incluido en cualquier negocio de La Verde, con o sin plan."
      >
        <article className="rounded-4xl border border-ink/5 bg-white p-gap-lg">
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
        titulo="Servicios por separado"
        detalle="Se contrata el que haga falta, al mes."
      >
        <div className="grid grid-cols-1 gap-gap-md lg:grid-cols-2">
          {(Object.keys(cat.modulos) as ClaveModulo[]).map((clave) => (
            <ModuloTile
              key={clave}
              clave={clave}
              elegido={modulosElegidos.includes(clave)}
              pagando={pagando === `modulo:${clave}`}
              bloqueado={pagando !== null}
              onPagar={() =>
                pedirMetodo(
                  "modulo",
                  clave,
                  cat.modulos[clave].nombre,
                  cat.modulos[clave].usd,
                )
              }
            />
          ))}
        </div>
      </Bloque>

      <Bloque titulo="Packs" detalle="Las funciones de siempre, juntas y con descuento.">
        <div className="grid grid-cols-1 gap-gap-md lg:grid-cols-3">
          {PACKS_ORDER.map((p) => (
            <PackTile
              key={p}
              pack={p}
              actual={plan}
              elegido={p === planElegido}
              destacado={p === siguiente}
              puedeElegirPlan={puedeElegirPlan}
              cargando={pendiente === p}
              bloqueado={pendiente !== null && pendiente !== p}
              pagando={pagando === `plan:${p}`}
              pagandoAlgo={pagando !== null}
              onElegir={() => elegir(p)}
              onPagar={() =>
                pedirMetodo("plan", p, nombreDe(p, cat), cat.packs[p].usd)
              }
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

      {/* QvaPay sigue siendo el camino automático; la transferencia en CUP
          acaba en el WhatsApp de soporte hasta que exista su API. */}
      <Dialog
        open={cobro !== null}
        onOpenChange={(abierto) => {
          if (!abierto && !pagando) setCobro(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cómo quieres pagar?</DialogTitle>
            <DialogDescription>
              {cobro && (
                <>
                  {cobro.nombre} · {cobro.usd} USD al mes (
                  {textoCup(cobro.usd, cat)})
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-gap-sm">
            <button
              type="button"
              onClick={() => {
                if (!cobro) return;
                const { tipo, clave } = cobro;
                setCobro(null);
                void pagar(tipo, clave);
              }}
              disabled={pagando !== null}
              className="flex h-11 w-full items-center justify-center gap-gap-xs rounded-full bg-verde-400 font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Wallet size={16} strokeWidth={2} />
              Pagar con QvaPay
            </button>

            <a
              href={`${whatsappHref(SUPPORT_WHATSAPP)}?text=${encodeURIComponent(mensajeCup)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setCobro(null)}
              className="flex h-11 w-full items-center justify-center gap-gap-xs rounded-full border border-ink/10 bg-white font-lv-display text-small font-semibold text-ink transition duration-500 ease-outquint hover:border-verde-300 hover:text-verde-700"
            >
              <MessageCircle size={16} strokeWidth={2} />
              Transferir en CUP por WhatsApp
            </a>
          </div>

          <p className="text-meta text-ink-soft/75">
            La transferencia se acuerda en el chat. El plan se activa cuando se
            confirme el pago.
          </p>
        </DialogContent>
      </Dialog>
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

/**
 * Lo que vende un módulo o un pack, tal cual lo escribió administración: una
 * línea por punto, sacadas de su `texto`.
 *
 * No es la lista de funciones. `funciones` decide los permisos; esto cuenta lo
 * que se compra. Antes la tarjeta pintaba las funciones una a una y salía un
 * volcado técnico —«publicaciones_fb», «fotos_ilimitadas»— en vez de la oferta.
 */
function ListaLineas({ texto }: { texto: string }) {
  return (
    <ul className="flex flex-col gap-gap-xs">
      {texto
        .split("\n")
        .map((linea) => linea.trim())
        .filter(Boolean)
        .map((linea) => (
          <li key={linea} className="flex items-start gap-gap-xs text-small text-ink">
            <Check
              size={15}
              strokeWidth={2}
              className="mt-[3px] shrink-0 text-verde-600"
            />
            <span className="text-pretty">{linea}</span>
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
  elegido,
  pagando,
  bloqueado,
  onPagar,
}: {
  clave: ClaveModulo;
  /** Marcado en la portada: se paga este, no hace falta buscarlo. */
  elegido: boolean;
  pagando: boolean;
  bloqueado: boolean;
  onPagar: () => void;
}) {
  const cat = useCatalogo();
  const modulo = cat.modulos[clave];

  return (
    <article
      className={cn(
        "flex flex-col rounded-4xl border bg-white p-gap-lg",
        elegido
          ? "border-verde-300 shadow-card ring-2 ring-verde-500"
          : "border-ink/5",
      )}
    >
      <div className="flex items-center gap-gap-xs">
        <h3 className="font-lv-display text-body font-bold tracking-[-0.01em] text-ink">
          {modulo.nombre}
        </h3>
        {elegido && (
          <span className="inline-flex items-center rounded-full bg-verde-400 px-[10px] py-[3px] font-lv-display text-[11px] font-semibold uppercase tracking-[0.12em] text-verde-950">
            Elegido
          </span>
        )}
      </div>
      <Precio usd={modulo.usd} />
      <p className="mt-gap-2xs text-small text-ink-soft/75">{modulo.lema}</p>

      <div className="my-gap-md h-px bg-ink/5" />

      <ListaLineas texto={modulo.texto} />

      {/* `mt-auto` para que los botones caigan a la misma altura aunque las
          listas midan distinto. */}
      <div className="mt-auto pt-gap-lg">
        <button
          type="button"
          onClick={onPagar}
          disabled={pagando || bloqueado}
          className={cn(
            "flex h-11 w-full items-center justify-center gap-gap-xs rounded-full font-lv-display text-small font-semibold transition duration-500 ease-outquint disabled:cursor-not-allowed disabled:opacity-60",
            elegido
              ? "bg-verde-400 text-verde-950 shadow-primary-halo hover:bg-verde-300 active:scale-[0.98]"
              : "border border-ink/10 bg-white text-ink hover:border-verde-300 hover:text-verde-700",
          )}
        >
          {pagando ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Abriendo…
            </>
          ) : elegido ? (
            "Pagar 1 mes"
          ) : (
            "Contratar por 1 mes"
          )}
        </button>
      </div>
    </article>
  );
}

/** Un pack: su precio, y lo que trae por encima de los módulos sueltos. */
function PackTile({
  pack,
  actual,
  elegido,
  destacado,
  puedeElegirPlan,
  cargando,
  bloqueado,
  pagando,
  pagandoAlgo,
  onElegir,
  onPagar,
}: {
  pack: Pack;
  actual: Plan;
  /** El pack pulsado en la portada: manda sobre «Tu plan» mientras se cobra. */
  elegido: boolean;
  destacado: boolean;
  puedeElegirPlan: boolean;
  cargando: boolean;
  bloqueado: boolean;
  pagando: boolean;
  pagandoAlgo: boolean;
  onElegir: () => void;
  onPagar: () => void;
}) {
  const cat = useCatalogo();
  const datos = cat.packs[pack];
  /* Con un pack elegido, «Tu plan» se aparta: lo útil ahora es señalar el que
     se va a pagar, no el que corre durante la prueba. */
  const esActual = pack === actual && !elegido;

  return (
    <article
      className={cn(
        "relative flex flex-col rounded-4xl border bg-white p-gap-lg",
        destacado || elegido
          ? "border-verde-300 shadow-card"
          : "border-ink/5",
        esActual && "ring-2 ring-verde-400/35",
        elegido && "ring-2 ring-verde-500",
      )}
    >
      {destacado && !esActual && !elegido && (
        <span className="absolute -top-[11px] left-gap-lg inline-flex items-center gap-[4px] rounded-full bg-verde-400 px-gap-sm py-[3px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em] text-verde-950">
          <Sparkles size={11} strokeWidth={2.2} />
          Recomendado
        </span>
      )}

      <div className="flex items-center gap-gap-xs">
        <h3 className="font-lv-display text-h3 font-bold tracking-[-0.01em] text-ink">
          {nombreDe(pack, cat)}
        </h3>
        {elegido ? (
          <span className="inline-flex items-center rounded-full bg-verde-400 px-[10px] py-[3px] font-lv-display text-[11px] font-semibold uppercase tracking-[0.12em] text-verde-950">
            Elegido
          </span>
        ) : esActual ? (
          <span className="inline-flex items-center rounded-full border border-verde-200 bg-verde-50 px-[10px] py-[3px] font-lv-display text-[11px] font-semibold uppercase tracking-[0.12em] text-verde-700">
            Tu plan
          </span>
        ) : null}
      </div>

      <Precio usd={datos.usd} />
      <p className="mt-gap-2xs text-small text-ink-soft/75">{datos.lema}</p>

      <div className="my-gap-md h-px bg-ink/5" />

      <ListaLineas texto={datos.texto} />

      {/* `mt-auto` para que los tres botones caigan a la misma altura aunque las
          listas midan distinto. */}
      <div className="mt-auto pt-gap-lg">
        {esActual && puedeElegirPlan ? (
          <p className="flex h-11 items-center justify-center rounded-full border border-verde-200 bg-verde-50 font-lv-display text-small font-semibold text-verde-700">
            Es el que tienes
          </p>
        ) : puedeElegirPlan ? (
          <button
            type="button"
            onClick={onElegir}
            disabled={cargando || bloqueado}
            className={cn(
              "flex h-11 w-full items-center justify-center gap-gap-xs rounded-full font-lv-display text-small font-semibold transition duration-500 ease-outquint disabled:cursor-not-allowed disabled:opacity-60",
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
          <button
            type="button"
            onClick={onPagar}
            disabled={pagando || pagandoAlgo}
            className={cn(
              "flex h-11 w-full items-center justify-center gap-gap-xs rounded-full font-lv-display text-small font-semibold transition duration-500 ease-outquint disabled:cursor-not-allowed disabled:opacity-60",
              destacado || elegido
                ? "bg-verde-400 text-verde-950 shadow-primary-halo hover:bg-verde-300 active:scale-[0.98]"
                : "border border-ink/10 bg-white text-ink hover:border-verde-300 hover:text-verde-700",
            )}
          >
            {pagando ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Abriendo…
              </>
            ) : elegido ? (
              "Pagar 1 mes"
            ) : esActual ? (
              "Renovar 1 mes"
            ) : (
              "Contratar por 1 mes"
            )}
          </button>
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
