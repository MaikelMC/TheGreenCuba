"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormSection } from "@/components/business/form-section";
import { PLAN_LABEL, PLAN_ORDER, type Plan } from "@/lib/plans";

/**
 * El plan de un negocio, para administración.
 *
 * Es el único sitio donde se cambia un plan a mano, y lo es a propósito: aquí
 * lo que se apunta son las fechas, y el resto sale solo — `planEfectivo` decide
 * con ellas si el negocio está en Pro, en Básico o en gratis—.
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
  /** Ya resuelto por el servidor: es el que manda de verdad ahora mismo. */
  planEfectivo: Plan;
}

/* Las mismas clases del resto de formularios del proyecto, copiadas como en los
   demás sitios: dos usos no justifican un archivo compartido. */
const INPUT =
  "h-11 w-full rounded-xl border border-ink/10 bg-white px-4 text-body text-ink placeholder:text-ink-soft/75 outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";
const LABEL = "font-lv-display text-meta font-semibold text-ink-soft/75";

/** `2026-09-14T00:00:00.000Z` → `2026-09-14`, que es lo que come un `<input type="date">`. */
function paraInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export function SuscripcionEditor({ placeId }: { placeId: string }) {
  const [data, setData] = useState<Suscripcion | null>(null);
  const [plan, setPlan] = useState<Plan>("gratis");
  const [estado, setEstado] = useState<"activa" | "cancelada">("activa");
  const [trial, setTrial] = useState("");
  const [vence, setVence] = useState("");
  const [descuento, setDescuento] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/suscripciones?negocioId=${encodeURIComponent(placeId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((row: Suscripcion) => {
        if (!alive) return;
        setData(row);
        setPlan(row.plan);
        setEstado(row.estado);
        setTrial(paraInput(row.trialHasta));
        setVence(paraInput(row.venceEn));
        setDescuento(row.descuentoPct === null ? "" : String(row.descuentoPct));
      })
      /* Sin respuesta se deja el formulario con los valores por defecto
         —gratis— en vez de en blanco: guardar entonces crea la fila, que es
         justo lo que hace falta para un negocio que aún no tiene ninguna. */
      .catch(() => {
        if (alive) setData((prev) => prev ?? null);
      });
    return () => {
      alive = false;
    };
  }, [placeId]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/suscripciones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negocioId: placeId,
          plan,
          estado,
          /* Cadena vacía = «quítala». El servidor la lee como nulo, que es
             distinto de no mandar el campo (eso sería «no lo toques»). */
          trialHasta: trial,
          venceEn: vence,
          descuentoPct: descuento === "" ? null : Number(descuento),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "No se pudo guardar el plan.");
        return;
      }

      const row = (await res.json()) as Suscripcion;
      setData(row);
      toast.success(`Plan guardado: ${PLAN_LABEL[row.planEfectivo]}`);
    } catch {
      toast.error("No hubo respuesta del servidor. No se cambió nada.");
    } finally {
      setSaving(false);
    }
  }, [placeId, plan, estado, trial, vence, descuento]);

  return (
    <FormSection title="Plan y vigencia" icon={<BadgeCheck size={18} strokeWidth={1.8} />}>
      <p className="text-meta text-ink-soft/75">
        Aquí se apunta el plan y sus fechas, y el plan entra solo. La prueba de
        Pro manda sobre el plan contratado mientras siga viva.
      </p>

      {data && (
        <p className="flex items-center gap-gap-xs text-meta text-ink-soft/75">
          Ahora mismo cuenta como
          <span className="inline-flex items-center rounded-full border border-verde-200 bg-verde-50 px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em] text-verde-700">
            {PLAN_LABEL[data.planEfectivo]}
          </span>
        </p>
      )}

      <div className="grid grid-cols-1 gap-gap-md lg:grid-cols-2">
        <div className="flex flex-col gap-gap-xs">
          <label htmlFor="scPlan" className={LABEL}>
            Plan
          </label>
          <select
            id="scPlan"
            value={plan}
            onChange={(e) => setPlan(e.target.value as Plan)}
            className={cn(INPUT, "cursor-pointer")}
          >
            {PLAN_ORDER.map((p) => (
              <option key={p} value={p}>
                {PLAN_LABEL[p]}
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
            Pagado hasta
          </label>
          <input
            id="scVence"
            type="date"
            value={vence}
            onChange={(e) => setVence(e.target.value)}
            className={cn(INPUT, "cursor-text")}
          />
          <p className="text-meta text-ink-soft/75">
            Vacío = sin vencimiento. Al pasar la fecha, el negocio cae a gratis.
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
        </div>
      </div>

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="inline-flex h-11 cursor-pointer items-center gap-gap-xs self-start rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-all duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
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
