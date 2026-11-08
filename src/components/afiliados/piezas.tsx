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

const ESTADOS: Record<EstadoNegocio, [string, string]> = {
  registrado: ["Registrado, sin pagar", "bg-sand-deep text-ink-soft"],
  activo: ["Activo", "bg-verde-50 text-verde-700"],
  vence: ["Vence pronto", "bg-amber-100 text-amber-800"],
  baja: ["Dejó de pagar", "bg-red-50 text-red-700"],
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
    <div className={`flex min-w-0 flex-col gap-0.5 rounded-xl p-3 ${destacado ? "bg-verde-700 text-white" : "bg-sand"}`}>
      <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${destacado ? "text-verde-100" : "text-ink-soft/70"}`}>{etiqueta}</span>
      <b className="font-lv-display text-[20px] leading-tight tabular-nums">{formatoCup(aCup(usd, tasa))}</b>
      {nota && <span className={`text-meta ${destacado ? "text-verde-100" : "text-ink-soft/70"}`}>{nota}</span>}
    </div>
  );
}

export function TablaNegocios({ negocios, tasa, conPagos }: { negocios: NegocioAfiliado[]; tasa: number; conPagos?: boolean }) {
  if (!negocios.length) {
    return <p className="text-small text-ink-soft/75">Todavía no hay negocios registrados con este enlace.</p>;
  }
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full border-collapse text-small">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-ink-soft/70">
            <th className="px-1 py-2">Negocio</th>
            <th className="px-1 py-2">Estado</th>
            {conPagos && <th className="px-1 py-2">Primer pago</th>}
            {conPagos && <th className="px-1 py-2 text-right">Pagos</th>}
            <th className="px-1 py-2 text-right">Generó</th>
            <th className="px-1 py-2 text-right">Al mes</th>
          </tr>
        </thead>
        <tbody>
          {negocios.map((n) => (
            <tr key={n.id} className="border-t border-ink/5 align-top">
              <td className="px-1 py-2.5">
                <b className="font-semibold text-ink">{n.nombre}</b>
                {n.plan && n.plan !== "gratis" && <span className="block text-meta capitalize text-ink-soft/70">{n.plan.replace("_", " ")}</span>}
              </td>
              <td className="px-1 py-2.5"><EstadoPill estado={n.estado} /></td>
              {conPagos && <td className="px-1 py-2.5 tabular-nums">{fecha(n.primerPago)}</td>}
              {conPagos && <td className="px-1 py-2.5 text-right tabular-nums">{n.pagos}</td>}
              <td className="px-1 py-2.5 text-right tabular-nums">{n.comisionUsdCentavos ? formatoCup(aCup(n.comisionUsdCentavos, tasa)) : "—"}</td>
              <td className="px-1 py-2.5 text-right tabular-nums">{n.porMesUsdCentavos ? formatoCup(aCup(n.porMesUsdCentavos, tasa)) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function textoMeta(nuevos: number, bono: number, recarga: number): string {
  if (nuevos >= recarga) return "Ganó la recarga internacional de este mes.";
  if (nuevos >= bono) return `Bono ganado. Faltan ${recarga - nuevos} para la recarga internacional.`;
  return `Faltan ${bono - nuevos} para el bono y ${recarga - nuevos} para la recarga internacional.`;
}
