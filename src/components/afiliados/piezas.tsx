import Link from "next/link";
import type { EstadoNegocio, NegocioAfiliado } from "@/lib/afiliados";
import { aCup, formatoCup } from "@/lib/afiliados";

/** Piezas del programa de afiliados que comparten el panel del afiliado y la administración. */

export const tarjeta = "rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft";
export const rotulo = "font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-600";

export function Barra({ valor, max }: { valor: number; max: number }) {
  return (
    <div className="h-3 overflow-hidden rounded-full bg-sand-deep" aria-hidden="true">
      <div className="h-full rounded-full bg-verde-500" style={{ width: `${Math.min(100, (valor / max) * 100)}%` }} />
    </div>
  );
}

const ESTADOS: Record<EstadoNegocio, [string, string, string]> = {
  registrado: ["Registrado, sin pagar", "bg-sand-deep text-ink-soft", "border-l-ink/20"],
  activo:     ["Activo",               "bg-verde-50 text-verde-700",  "border-l-verde-400"],
  vence:      ["Vence pronto",         "bg-amber-100 text-amber-800", "border-l-amber-400"],
  baja:       ["Dejó de pagar",        "bg-red-50 text-red-700",      "border-l-red-400"],
};

export function EstadoPill({ estado }: { estado: EstadoNegocio }) {
  const [texto, clase] = ESTADOS[estado];
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ${clase}`}>{texto}</span>;
}

export function fecha(d: Date | null): string {
  return d ? d.toLocaleDateString("es-CU", { day: "2-digit", month: "short" }) : "—";
}

export function Dinero({ etiqueta, usd, tasa, destacado, nota }: { etiqueta: string; usd: number; tasa: number; destacado?: boolean; nota?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 rounded-xl border p-3 ${destacado ? "border-verde-600 bg-verde-700 text-white" : "border-ink/8 bg-sand"}`}>
      <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${destacado ? "text-verde-100" : "text-ink-soft/70"}`}>{etiqueta}</span>
      <b className="font-lv-display text-[20px] leading-tight tabular-nums">{formatoCup(aCup(usd, tasa))}</b>
      {nota && <span className={`text-meta ${destacado ? "text-verde-100" : "text-ink-soft/70"}`}>{nota}</span>}
    </div>
  );
}

export function TablaNegocios({
  negocios,
  tasa,
  conPagos,
  conAcciones,
}: {
  negocios: NegocioAfiliado[];
  tasa: number;
  conPagos?: boolean;
  /** Muestra enlace a editar negocio/plan. Solo en la vista de admin. */
  conAcciones?: boolean;
}) {
  if (!negocios.length) {
    return <p className="text-small text-ink-soft/75">Todavía no hay negocios registrados con este enlace.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {negocios.map((n) => {
        const [, , bordeClase] = ESTADOS[n.estado];
        return (
          <div
            key={n.id}
            className={`rounded-xl border border-ink/8 border-l-4 bg-white p-3 ${bordeClase}`}
          >
            {/* Cabecera: nombre + estado */}
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-lv-display font-semibold text-ink leading-snug">{n.nombre}</p>
              <EstadoPill estado={n.estado} />
            </div>

            {/* Plan */}
            {n.plan && n.plan !== "gratis" && (
              <span className="mt-1 inline-block rounded-full border border-verde-200 bg-verde-50 px-2 py-0.5 text-[11px] font-semibold capitalize text-verde-700">
                {n.plan.replace(/_/g, " ")}
              </span>
            )}

            {/* Métricas */}
            <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-ink/5 pt-2.5">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-soft/60">Comisión</span>
                <span className="font-lv-display text-[15px] font-semibold tabular-nums text-ink">
                  {n.comisionUsdCentavos ? formatoCup(aCup(n.comisionUsdCentavos, tasa)) : <span className="font-normal text-ink-soft/40">—</span>}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-soft/60">Al mes</span>
                <span className="font-lv-display text-[15px] tabular-nums text-ink">
                  {n.porMesUsdCentavos ? formatoCup(aCup(n.porMesUsdCentavos, tasa)) : <span className="text-ink-soft/40">—</span>}
                </span>
              </div>
              {conPagos && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-soft/60">Pagos</span>
                  <span className="font-lv-display text-[15px] tabular-nums text-ink">
                    {n.pagos > 0 ? (
                      <>{n.pagos}<span className="text-[12px] text-ink-soft/60 font-normal"> · {fecha(n.primerPago)}</span></>
                    ) : (
                      <span className="text-ink-soft/40">—</span>
                    )}
                  </span>
                </div>
              )}
            </div>

            {conAcciones && (
              <div className="mt-2.5 border-t border-ink/5 pt-2.5">
                <Link
                  href={`/admin/negocios/${n.id}/editar`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-ink/10 bg-sand px-3 font-lv-display text-meta font-semibold text-ink hover:bg-sand-deep transition-colors duration-300"
                >
                  Ver negocio / plan
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function textoMeta(nuevos: number, bono: number, recarga: number): string {
  if (nuevos >= recarga) return "Ganó la recarga internacional de este mes.";
  if (nuevos >= bono) return `Bono ganado. Faltan ${recarga - nuevos} para la recarga internacional.`;
  return `Faltan ${bono - nuevos} para el bono y ${recarga - nuevos} para la recarga internacional.`;
}
