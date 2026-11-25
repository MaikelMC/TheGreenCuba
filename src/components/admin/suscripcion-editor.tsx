"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormSection } from "@/components/business/form-section";
import { Skeleton } from "@/components/ui/loading";
import { PLAN_ORDER, MODULOS, nombreDe, usdDe, type ClaveModulo, type Plan } from "@/lib/plans";
import { useCatalogo } from "@/providers/catalogo-provider";
import { usePlaces } from "@/providers/places-provider";
import { relojEn } from "@/lib/ficha/horario";

/**
 * El plan de un negocio, para administración.
 *
 * Es el único sitio donde se cambia un plan a mano, y lo es a propósito: aquí
 * lo que se apunta son las fechas y, si los hay, los módulos sueltos. El resto
 * sale solo — `planEfectivo` decide con las fechas si el negocio está en un pack
 * o en gratis, y `funcionesDe` junta el pack con los módulos—.
 *
 * **Bajar de plan no borra nada.** Aquí solo se escribe esta fila; los
 * productos, las fotos y el resto de la ficha se quedan donde están, y lo que
 * el plan nuevo no incluye deja de permitirse, no de existir.
 */

interface Suscripcion {
  plan: Plan;
  estado: "activa" | "cancelada";
  trialHasta: string | null;
  venceEn: string | null;
  descuentoPct: number | null;
  /** Los módulos sueltos contratados. Llegan del `jsonb`, con sus fechas. */
  modulos: { clave: string; desde: string; hasta: string | null }[] | null;
  /** Ya resuelto por el servidor: es el que manda de verdad ahora mismo. */
  planEfectivo: Plan;
  /** La versión de la fila. Ausente si el negocio aún no tiene ninguna. */
  updatedAt?: string;
}

/** Lo que enseña el formulario. Se compara contra la carga para mandar solo lo cambiado. */
interface Formulario {
  plan: Plan;
  estado: "activa" | "cancelada";
  trial: string;
  vence: string;
  descuento: string;
  modulos: ClaveModulo[];
}

function aFormulario(row: Suscripcion): Formulario {
  const ahora = Date.now();
  return {
    plan: row.plan,
    estado: row.estado,
    trial: paraInput(row.trialHasta),
    vence: paraInput(row.venceEn),
    descuento: row.descuentoPct === null ? "" : String(row.descuentoPct),
    /* Solo los vigentes: un módulo vencido sigue en el `jsonb`, y marcarlo
       aquí lo reactivaba al guardar cualquier otro campo. */
    modulos: (row.modulos ?? [])
      .filter((m) => !m.hasta || new Date(m.hasta).getTime() > ahora)
      .map((m) => m.clave as ClaveModulo),
  };
}

const mismosModulos = (a: ClaveModulo[], b: ClaveModulo[]) =>
  [...a].sort().join() === [...b].sort().join();

/* Las mismas clases del resto de formularios del proyecto, copiadas como en los
   demás sitios: dos usos no justifican un archivo compartido. */
const INPUT =
  "h-11 w-full rounded-xl border border-ink/10 bg-white px-4 text-body text-ink placeholder:text-ink-soft/75 outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";
const LABEL = "font-lv-display text-meta font-semibold text-ink-soft/75";

/**
 * Un instante → el día `YYYY-MM-DD` **en Cuba**, que es lo que come un
 * `<input type="date">`. El servidor guarda el último milisegundo de ese día en
 * `America/Havana`; cortar el ISO en UTC enseñaba el día siguiente.
 */
function paraInput(iso: string | null): string {
  return iso ? relojEn(new Date(iso), "America/Havana").fecha : "";
}

function DescuentoPreview({ plan, descuento }: { plan: Plan; descuento: string }) {
  const cat = useCatalogo();
  if (descuento === "" || plan === "gratis") return null;
  const pct = Number(descuento);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return null;
  const base = usdDe(plan, cat);
  const final = Math.round(base * (1 - pct / 100) * 100) / 100;
  return (
    <p className="text-meta text-ink-soft/75">
      {base} USD → <span className="font-semibold text-ink">{final} USD</span> con el descuento
    </p>
  );
}

export function SuscripcionEditor({ placeId }: { placeId: string }) {
  const cat = useCatalogo();
  const [data, setData] = useState<Suscripcion | null>(null);
  const [plan, setPlan] = useState<Plan>("gratis");
  const [estado, setEstado] = useState<"activa" | "cancelada">("activa");
  const [trial, setTrial] = useState("");
  const [vence, setVence] = useState("");
  const [descuento, setDescuento] = useState("");
  const [modulos, setModulos] = useState<ClaveModulo[]>([]);
  const [saving, setSaving] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [inicial, setInicial] = useState<Formulario | null>(null);
  const { refreshPlaces } = usePlaces();

  /* Pone la fila en el formulario y la toma como punto de partida: lo que se
     guarde después se compara contra esto. */
  const aplicar = useCallback((row: Suscripcion) => {
    const f = aFormulario(row);
    setData(row);
    setInicial(f);
    setPlan(f.plan);
    setEstado(f.estado);
    setTrial(f.trial);
    setVence(f.vence);
    setDescuento(f.descuento);
    setModulos(f.modulos);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/suscripciones?negocioId=${encodeURIComponent(placeId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((row: Suscripcion) => {
        if (alive) aplicar(row);
      })
      /* Sin respuesta **no** se deja guardar: el formulario está en sus valores
         por defecto —gratis, sin fechas, sin módulos— y guardarlo bajaba a
         gratis a un negocio que pagaba. Un negocio sin fila no llega aquí: el
         GET le devuelve el estado por defecto con 200. */
      .catch(() => {
        if (alive) setFallo(true);
      });
    return () => {
      alive = false;
    };
  }, [placeId, aplicar]);

  const save = useCallback(async () => {
    if (!inicial) return;

    /* Solo lo que cambió. Mandar el formulario entero reescribía las fechas
       aunque nadie las tocara —y una fecha que puso un pago, con su hora, se
       recortaba al día—. Lo que no viaja, el servidor no lo toca. */
    const cambios: Record<string, unknown> = {};
    if (plan !== inicial.plan) cambios.plan = plan;
    if (estado !== inicial.estado) cambios.estado = estado;
    /* Cadena vacía = «quítala». El servidor la lee como nulo, que es distinto
       de no mandar el campo (eso sería «no lo toques»). */
    const pruebaSigue =
      trial !== "" &&
      new Date(`${trial}T23:59:59`).getTime() > Date.now();
    /* Asignar un plan de pago desde administración tiene que entrar en vigor:
       si la prueba siguiera viva, el plan guardado no se aplicaría hasta que
       venciera. Se cierra la prueba en ese mismo guardado. */
    if (plan !== inicial.plan && plan !== "gratis" && pruebaSigue) {
      cambios.trialHasta = "";
    } else if (trial !== inicial.trial) {
      cambios.trialHasta = trial;
    }
    if (vence !== inicial.vence) cambios.venceEn = vence;
    if (descuento !== inicial.descuento) {
      cambios.descuentoPct = descuento === "" ? null : Number(descuento);
    }
    /* La lista entera, no un parche: el servidor conserva los vigentes tal
       cual y pone la fecha de hoy a los nuevos. */
    if (!mismosModulos(modulos, inicial.modulos)) cambios.modulos = modulos;

    if (Object.keys(cambios).length === 0) {
      toast("No hay cambios que guardar.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/suscripciones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negocioId: placeId,
          /* La versión que se vio al cargar: si la fila cambió desde entonces,
             el servidor contesta 409 en vez de pisar el cambio. */
          ...(data?.updatedAt ? { esperado: data.updatedAt } : {}),
          ...cambios,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "No se pudo guardar el plan.");
        return;
      }

      const row = (await res.json()) as Suscripcion;
      aplicar(row);
      toast.success(`Plan guardado: ${nombreDe(row.planEfectivo, cat)}`);
      /* La lista de negocios enseña el plan: que lo vea sin recargar. */
      void refreshPlaces();
    } catch {
      toast.error("No hubo respuesta del servidor. No se cambió nada.");
    } finally {
      setSaving(false);
    }
  }, [placeId, inicial, data, plan, estado, trial, vence, descuento, modulos, aplicar, cat, refreshPlaces]);

  /* Mientras la prueba sigue viva, es lo que el negocio tiene de verdad: el
     plan contratado no entra hasta que vence. Se calcula con las fechas que ya
     trae esta pantalla, sin otra consulta. */
  /* Hay cambios sin guardar: lo lee la página antes de navegar fuera. */
  const sinGuardar = Boolean(
    inicial &&
      (plan !== inicial.plan ||
        estado !== inicial.estado ||
        trial !== inicial.trial ||
        vence !== inicial.vence ||
        descuento !== inicial.descuento ||
        !mismosModulos(modulos, inicial.modulos)),
  );

  const enPrueba = Boolean(
    data &&
      data.estado === "activa" &&
      data.trialHasta &&
      new Date(data.trialHasta).getTime() > Date.now(),
  );

  /* Prueba viva en el formulario, no en la fila guardada: sirve para avisar
     antes de guardar que el plan nuevo cerrará la prueba. */
  const pruebaSigue =
    trial !== "" && new Date(`${trial}T23:59:59`).getTime() > Date.now();

  /* Hasta tener la fila no se pinta el formulario: con sus valores por defecto
     —Gratis, sin fechas— parecía el estado real del negocio. Esqueleto con la
     misma forma (cuatro campos), sin salto al llegar los datos. */
  if (!data) {
    return (
      <FormSection title="Plan estándar y vigencia" icon={<BadgeCheck size={18} strokeWidth={1.8} />}>
        {fallo ? (
          <p role="alert" className="text-meta font-semibold text-destructive-ink">
            No se pudo cargar el plan actual. Recarga la página antes de guardar.
          </p>
        ) : (
          <div
            className="grid grid-cols-1 gap-gap-md lg:grid-cols-2"
            aria-busy="true"
            aria-label="Cargando el plan"
          >
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-11 rounded-xl" />
            ))}
          </div>
        )}
      </FormSection>
    );
  }

  return (
    <FormSection title="Plan estándar y vigencia" icon={<BadgeCheck size={18} strokeWidth={1.8} />}>
      {sinGuardar && <span data-sin-guardar="plan" hidden />}
      <p className="text-meta text-ink-soft/75">
        El plan estándar y el pack a medida se suman: no se sustituyen. Mientras
        dure la prueba de Pro, manda sobre el plan contratado.
      </p>

      {data && (
        <p className="flex flex-wrap items-center gap-gap-xs text-meta text-ink-soft/75">
          Plan estándar efectivo
          <span className="inline-flex items-center rounded-full border border-verde-200 bg-verde-50 px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em] text-verde-700">
            {enPrueba ? "Prueba gratis" : nombreDe(data.planEfectivo, cat)}
          </span>
          {data.planEfectivo === "gratis" && (
            <span className="text-ink-soft/60">
              El pack a medida de abajo suma aparte.
            </span>
          )}
        </p>
      )}

      <div className="grid grid-cols-1 gap-gap-md lg:grid-cols-2">
        <div className="flex flex-col gap-gap-xs">
          <label htmlFor="scPlan" className={LABEL}>
            Plan estándar
          </label>
          <select
            id="scPlan"
            value={plan}
            onChange={(e) => setPlan(e.target.value as Plan)}
            className={cn(INPUT, "cursor-pointer")}
          >
            {PLAN_ORDER.map((p) => (
              <option key={p} value={p}>
                {nombreDe(p, cat)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-gap-xs">
          <label htmlFor="scEstado" className={LABEL}>
            Estado
          </label>
          <select
            id="scEstado"
            value={estado}
            onChange={(e) => setEstado(e.target.value as "activa" | "cancelada")}
            className={cn(INPUT, "cursor-pointer")}
          >
            <option value="activa">Activa</option>
            <option value="cancelada">Cancelada</option>
          </select>
          <p className="text-meta text-ink-soft/75">
            Cancelar deja el negocio en gratis al instante y no borra nada.
          </p>
        </div>

        {plan !== "gratis" && pruebaSigue && (
          <p className="rounded-xl border border-lv-amber/40 bg-lv-amber/10 px-gap-sm py-2 text-meta text-ink sm:col-span-2">
            La prueba sigue viva hasta el {trial}. Al cambiar el plan a uno de
            pago se cierra la prueba para que el plan nuevo entre en vigor ahora
            mismo.
          </p>
        )}

        <div className="flex flex-col gap-gap-xs">
          <label htmlFor="scTrial" className={LABEL}>
            Prueba de Pro hasta
          </label>
          <input
            id="scTrial"
            type="date"
            value={trial}
            onChange={(e) => setTrial(e.target.value)}
            className={cn(INPUT, "cursor-text")}
          />
        </div>

        <div className="flex flex-col gap-gap-xs">
          <label htmlFor="scVence" className={LABEL}>
            Pagado hasta (plan estándar)
          </label>
          <input
            id="scVence"
            type="date"
            value={vence}
            onChange={(e) => setVence(e.target.value)}
            className={cn(INPUT, "cursor-text")}
          />
          <p className="text-meta text-ink-soft/75">
            Vacío = sin vencimiento. Vale hasta el final de ese día (hora de Cuba).
          </p>
        </div>

        <div className="flex flex-col gap-gap-xs">
          <label htmlFor="scDescuento" className={LABEL}>
            Descuento (%) <span className="font-normal">(opcional)</span>
          </label>
          <input
            id="scDescuento"
            type="number"
            min={0}
            max={100}
            value={descuento}
            onChange={(e) => setDescuento(e.target.value)}
            placeholder="Sin descuento"
            className={cn(INPUT, "cursor-text")}
          />
          <DescuentoPreview plan={plan} descuento={descuento} />
          <p className="text-meta text-ink-soft/60">
            No se aplica al pack a medida: su precio ya es el negociado.
          </p>
        </div>
      </div>

      {/* Los módulos sueltos se suman al pack, no lo sustituyen: un negocio con
          Esencial y el asistente contratado los tiene los dos. */}
      <fieldset className="flex flex-col gap-gap-xs">
        <legend className={LABEL}>
          Módulos sueltos <span className="font-normal">(opcional)</span>
        </legend>
        <div className="grid grid-cols-1 gap-gap-xs sm:grid-cols-2">
          {(Object.keys(cat.modulos) as ClaveModulo[]).map((clave) => (
            <label
              key={clave}
              className="flex min-h-11 cursor-pointer items-start gap-gap-xs text-small text-ink"
            >
              <input
                type="checkbox"
                checked={modulos.includes(clave)}
                onChange={(e) =>
                  setModulos((prev) =>
                    e.target.checked
                      ? [...prev, clave]
                      : prev.filter((c) => c !== clave),
                  )
                }
                className="mt-[3px] size-4 shrink-0 accent-verde-500"
              />
              <span className="flex flex-col">
                <span className="font-semibold">{cat.modulos[clave].nombre}</span>
                <span className="text-meta text-ink-soft/60">
                  {MODULOS[clave].funciones.map((f) => cat.funciones[f].texto).join(" · ")}
                </span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-meta text-ink-soft/75">
          Se suman al plan. Al desmarcar uno deja de permitirse al instante y no
          borra nada.
        </p>
      </fieldset>

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="inline-flex h-11 cursor-pointer items-center gap-gap-xs self-start rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
      >
        {saving ? (
          <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
        ) : (
          <Save size={16} strokeWidth={1.8} />
        )}
        {saving ? "Guardando…" : "Guardar plan"}
      </button>
    </FormSection>
  );
}
