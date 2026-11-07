"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, MessageCircle, Package, Sparkles, Wallet } from "lucide-react";
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
  MODULOS,
  PACKS_ORDER,
  nombreDe,
  textoCup,
  type ClaveModulo,
  type Funcion,
  type Pack,
  type Plan,
} from "@/lib/plans";

/** Aplica descuento: misma lógica que `precioConDescuento` en plans.ts. */
function aplicarDescuento(usd: number, pct: number | null | undefined) {
  const p =
    typeof pct === "number" && Number.isFinite(pct) && pct > 0 && pct <= 100
      ? pct
      : 0;
  return { original: usd, final: p === 0 ? usd : Math.round(usd * (1 - p / 100) * 100) / 100 };
}
import type { PackMedidaResumen } from "@/lib/pack-medida";
import { useCatalogo } from "@/providers/catalogo-provider";
import { PackMedidaCard } from "@/components/business/pack-medida-card";

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
 * Se destaca **Esencial** como el pack más popular, igual que la portada tiene
 * su tarjeta destacada. La insignia no se mueve con el plan del negocio: dice
 * qué contrata casi todo el mundo, no cuál es el siguiente escalón. Si ya lo
 * tiene, la tarjeta muestra «Tu plan» y no repite la insignia.
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
  packMedida = null,
  esDueno = false,
  descuentoPct = null,
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
  /** El pack a medida activo o en tramitación del negocio, si lo hay. */
  packMedida?: PackMedidaResumen | null;
  /** Si quien mira es el dueño: solo él puede solicitar y cancelar packs. */
  esDueno?: boolean;
  /** Descuento acordado para este negocio, 0–100. `null` = sin descuento. */
  descuentoPct?: number | null;
}) {
  const router = useRouter();
  const cat = useCatalogo();
  const [pendiente, setPendiente] = useState<Plan | null>(null);
  const [packActual, setPackActual] = useState<PackMedidaResumen | null>(packMedida ?? null);
  const [solicitandoPack, setSolicitandoPack] = useState(false);
  const [serviciosPack, setServiciosPack] = useState<string[]>([]);
  const [dialogPack, setDialogPack] = useState(false);
  /** «plan:pro» o «modulo:menu_pro» mientras se abre la factura. */
  const [pagando, setPagando] = useState<string | null>(null);
  /** Lo que se va a cobrar, mientras se elige QvaPay o transferencia. */
  const [cobro, setCobro] = useState<{
    tipo: "plan" | "modulo";
    clave: string;
    nombre: string;
    usd: number;
  } | null>(null);

  /* Para nombrar el servicio en singular; con varios solo se cuenta. */
  const primerModulo = modulosElegidos[0];

  async function solicitarPack() {
    if (solicitandoPack || serviciosPack.length === 0) return;
    setSolicitandoPack(true);
    try {
      const res = await fetch("/api/business/packs-medida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId, serviciosSolicitados: serviciosPack }),
      });
      const data = (await res.json().catch(() => null)) as {
        pack?: PackMedidaResumen;
        error?: string;
      } | null;
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo enviar la solicitud.");
        return;
      }
      if (data?.pack) setPackActual(data.pack);
      setDialogPack(false);
      toast.success("Solicitud enviada. Te avisaremos en menos de 24 horas.");
    } catch {
      toast.error("No se pudo enviar la solicitud.");
    } finally {
      setSolicitandoPack(false);
    }
  }

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
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
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
      const data = (await res.json().catch(() => null)) as {
        url?: string;
        activado?: boolean;
        error?: string;
      } | null;
      if (data?.activado) {
        toast.success("¡Plan activado!");
        router.refresh();
        return;
      }
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
    usdOriginal: number,
  ) {
    if (pagando) return;
    const { final } = aplicarDescuento(usdOriginal, descuentoPct);
    /* 100 % de descuento: sin factura, se activa directo. */
    if (final === 0) {
      void pagar(tipo, clave);
      return;
    }
    setCobro({ tipo, clave, nombre, usd: final });
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
          Paga el mes en su tarjeta y la suscripción se activa al confirmarse el
          pago.
        </p>
      )}

      <Bloque
        titulo="Lo que ya tienes"
        detalle="Incluido en cualquier negocio de La Verde, con o sin plan."
      >
        <article className={cn(TARJETA, TARJETA_NORMAL, "shadow-soft")}>
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
              descuentoPct={descuentoPct}
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

      <Bloque
        titulo="Packs"
        detalle="Las funciones de siempre, juntas y con descuento."
      >
        <div className="grid grid-cols-1 gap-gap-md lg:grid-cols-3">
          {PACKS_ORDER.map((p) => (
            <PackTile
              key={p}
              pack={p}
              actual={plan}
              elegido={p === planElegido}
              destacado={p === "esencial"}
              puedeElegirPlan={puedeElegirPlan}
              cargando={pendiente === p}
              bloqueado={pendiente !== null && pendiente !== p}
              pagando={pagando === `plan:${p}`}
              pagandoAlgo={pagando !== null}
              descuentoPct={descuentoPct}
              onElegir={() => elegir(p)}
              onPagar={() =>
                pedirMetodo("plan", p, nombreDe(p, cat), cat.packs[p].usd)
              }
            />
          ))}
        </div>
      </Bloque>

      <Bloque
        titulo="Pack a medida"
        detalle="Servicios combinados al precio que cuadre con tu negocio."
      >
        {packActual ? (
          <PackMedidaCard
            pack={packActual}
            placeId={placeId}
            esDueno={esDueno}
            onCancelado={() => setPackActual(null)}
          />
        ) : esDueno ? (
          <article className="flex flex-col items-start gap-gap-sm rounded-[26px] border border-ink/5 bg-white p-gap-lg shadow-soft">
            <div className="flex items-center gap-gap-xs">
              <Package size={18} className="text-verde-600" strokeWidth={1.8} />
              <h3 className="font-lv-display text-body font-bold tracking-[-0.01em] text-ink">
                ¿Ningún pack te encaja?
              </h3>
            </div>
            <p className="text-small text-ink-soft/75">
              Dinos qué necesitas y el equipo de La Verde te arma un precio justo
              con solo lo que uses.
            </p>
            <button
              type="button"
              onClick={() => setDialogPack(true)}
              className="inline-flex h-11 items-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-lg font-lv-display text-small font-semibold text-ink transition duration-500 ease-outquint hover:border-verde-300 hover:text-verde-700"
            >
              <Package size={15} strokeWidth={1.8} />
              Solicitar pack a medida
            </button>
          </article>
        ) : (
          <p className="text-small text-ink-soft/60">
            El dueño del negocio puede solicitar un pack a medida desde aquí.
          </p>
        )}
      </Bloque>

      {/* Diálogo de solicitud de pack a medida. */}
      <Dialog open={dialogPack} onOpenChange={(o) => { if (!solicitandoPack) setDialogPack(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Qué servicios necesitas?</DialogTitle>
            <DialogDescription>
              Marca los que te interesan y el equipo te manda un precio en menos de 24 horas.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-gap-sm">
            <p className="font-lv-display text-meta font-semibold text-ink-soft/75">Módulos</p>
            <div className="grid grid-cols-1 gap-gap-xs sm:grid-cols-2">
              {(Object.keys(MODULOS) as (keyof typeof MODULOS)[]).map((clave) => (
                <label key={clave} className="flex cursor-pointer items-center gap-gap-xs text-small text-ink">
                  <input
                    type="checkbox"
                    checked={serviciosPack.includes(clave)}
                    onChange={(e) =>
                      setServiciosPack((prev) =>
                        e.target.checked ? [...prev, clave] : prev.filter((s) => s !== clave),
                      )
                    }
                    className="size-4 shrink-0 accent-verde-500"
                  />
                  {cat.modulos[clave].nombre}
                </label>
              ))}
            </div>

            <p className="font-lv-display text-meta font-semibold text-ink-soft/75">Packs</p>
            <div className="grid grid-cols-1 gap-gap-xs sm:grid-cols-2">
              {PACKS_ORDER.map((clave) => (
                <label key={clave} className="flex cursor-pointer items-center gap-gap-xs text-small text-ink">
                  <input
                    type="checkbox"
                    checked={serviciosPack.includes(clave)}
                    onChange={(e) =>
                      setServiciosPack((prev) =>
                        e.target.checked ? [...prev, clave] : prev.filter((s) => s !== clave),
                      )
                    }
                    className="size-4 shrink-0 accent-verde-500"
                  />
                  {nombreDe(clave, cat)}
                </label>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={solicitarPack}
            disabled={solicitandoPack || serviciosPack.length === 0}
            className="flex h-11 w-full items-center justify-center gap-gap-xs rounded-full bg-verde-400 font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {solicitandoPack ? (
              <><Loader2 size={16} className="animate-spin" /> Enviando…</>
            ) : (
              "Enviar solicitud"
            )}
          </button>
        </DialogContent>
      </Dialog>

      {/* Las dudas que salen siempre, contestadas antes de que las pregunten por
          correo. */}
      <ul className="mt-gap-lg grid grid-cols-1 gap-gap-sm text-small text-ink-soft/75 lg:grid-cols-2">
        <li>
          <span className="font-semibold text-ink">
            Bajar de plan no borra nada.
          </span>{" "}
          Tus productos, fotos y carta se quedan; solo dejas de poder añadir
          más.
        </li>
        <li>
          <span className="font-semibold text-ink">
            Negocio nuevo, 30 días de Pro.
          </span>{" "}
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

/* Las tarjetas del rediseño: el mismo degradado verde claro, el halo de la
   esquina y las píldoras suaves del plan del dashboard. Las que no están
   destacadas se quedan en blanco para que el resalte signifique algo. */
const TARJETA = "relative isolate flex flex-col rounded-[26px] border p-gap-lg";
const TARJETA_DESTACADA =
  "plan-tint border-verde-200/60 bg-[linear-gradient(120deg,#edf7ef,#f7fbf7)]";
const TARJETA_NORMAL = "border-ink/5 bg-white";
const PILDORA =
  "inline-flex items-center rounded-full px-[11px] py-[6px] font-lv-display text-[10px] font-extrabold uppercase tracking-[0.09em]";
const PILDORA_VERDE = `${PILDORA} border border-verde-300/70 bg-white/90 text-verde-700`;

/** El halo de la esquina. Recortado a la tarjeta, y por debajo del contenido. */
function Halo() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[26px]"
    >
      <span className="absolute -right-[110px] -top-[160px] size-[250px] rounded-full bg-verde-400/10" />
    </span>
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
      <h2 className="font-lv-display text-body font-semibold text-ink">
        {titulo}
      </h2>
      <p className="mt-[3px] max-w-[60ch] text-small text-ink-soft/70">
        {detalle}
      </p>
      <div className="mt-gap-sm">{children}</div>
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
          <CheckCircle />
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
          <li
            key={linea}
            className="flex items-start gap-gap-xs text-small text-ink"
          >
            <CheckCircle />
            <span className="text-pretty">{linea}</span>
          </li>
        ))}
    </ul>
  );
}

/** La marca de la lista, en círculo: el mismo gesto que la tarjeta del plan en
    el dashboard, también en verde cuando la tarjeta va sobre el degradado. */
function CheckCircle() {
  return (
    <span className="mt-[1px] grid size-[19px] shrink-0 place-items-center rounded-full bg-verde-100 text-verde-700">
      <Check size={12} strokeWidth={2.6} />
    </span>
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
  descuentoPct,
  onPagar,
}: {
  clave: ClaveModulo;
  /** Marcado en la portada: se paga este, no hace falta buscarlo. */
  elegido: boolean;
  pagando: boolean;
  bloqueado: boolean;
  descuentoPct?: number | null;
  onPagar: () => void;
}) {
  const cat = useCatalogo();
  const modulo = cat.modulos[clave];
  const { original, final } = aplicarDescuento(modulo.usd, descuentoPct);

  return (
    <article
      className={cn(
        TARJETA,
        elegido ? TARJETA_DESTACADA : TARJETA_NORMAL,
        elegido && "ring-2 ring-verde-500 ring-offset-2 dark:ring-offset-[#08130d]",
      )}
    >
      {elegido && <Halo />}
      <div className="flex items-center gap-gap-xs">
        <h3 className="font-lv-display text-body font-bold tracking-[-0.01em] text-ink">
          {modulo.nombre}
        </h3>
        {elegido && <span className={PILDORA_VERDE}>Elegido</span>}
      </div>
      <Precio usd={final} original={final < original ? original : undefined} />
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
  descuentoPct,
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
  descuentoPct?: number | null;
  onElegir: () => void;
  onPagar: () => void;
}) {
  const cat = useCatalogo();
  const datos = cat.packs[pack];
  const { original, final } = aplicarDescuento(datos.usd, descuentoPct);
  /* Con un pack elegido, «Tu plan» se aparta: lo útil ahora es señalar el que
     se va a pagar, no el que corre durante la prueba. */
  const esActual = pack === actual && !elegido;

  return (
    <article
      className={cn(
        TARJETA,
        destacado || elegido || esActual ? TARJETA_DESTACADA : TARJETA_NORMAL,
        esActual && "ring-2 ring-verde-400/35",
        elegido && "ring-2 ring-verde-500",
      )}
    >
      {(destacado || elegido || esActual) && <Halo />}
      {destacado && !esActual && !elegido && (
        <span className="absolute -top-[11px] left-gap-lg inline-flex items-center gap-[4px] rounded-full bg-verde-400 px-gap-sm py-[3px] font-lv-display text-[10px] font-extrabold uppercase tracking-[0.09em] text-verde-950">
          <Sparkles size={11} strokeWidth={2.2} />
          Más popular
        </span>
      )}

      <div className="flex items-center gap-gap-xs">
        <h3 className="font-lv-display text-h3 font-bold tracking-[-0.01em] text-ink">
          {nombreDe(pack, cat)}
        </h3>
        {elegido ? (
          <span className={PILDORA_VERDE}>Elegido</span>
        ) : esActual ? (
          <span className={PILDORA_VERDE}>Tu plan</span>
        ) : null}
      </div>

      <Precio usd={final} original={final < original ? original : undefined} />
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

/** El precio en dólares y, debajo, lo mismo en CUP al cambio de hoy.
 *  Si hay descuento, muestra el original tachado y el final destacado. */
function Precio({ usd, original }: { usd: number; original?: number }) {
  const cat = useCatalogo();
  return (
    <div className="mt-gap-sm flex flex-wrap items-baseline gap-gap-2xs">
      {original !== undefined && (
        <span className="font-lv-display text-body text-ink-soft/50 line-through">
          {original} USD
        </span>
      )}
      <span className="font-lv-display text-h3 font-bold text-ink">
        {usd} USD
      </span>
      <span className="text-meta text-ink-soft/75">
        al mes · {textoCup(usd, cat)}
      </span>
      {original !== undefined && (
        <span className="ml-gap-2xs inline-flex items-center rounded-full bg-verde-100 px-[9px] py-[3px] font-lv-display text-[10px] font-extrabold uppercase tracking-[0.09em] text-verde-700">
          Tu descuento
        </span>
      )}
    </div>
  );
}
