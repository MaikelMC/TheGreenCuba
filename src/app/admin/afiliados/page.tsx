import Link from "next/link";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { pagos, places } from "@/lib/db/schema";
import { aCup, formatoCup, listarAfiliados, METODOS_COBRO, REGLAS_AFILIADOS as R, tasaUsdCup } from "@/lib/afiliados";
import { EntregarPremio, ResolverCobro } from "@/components/afiliados/acciones-admin";
import { fecha, rotulo, tarjeta } from "@/components/afiliados/piezas";

export const dynamic = "force-dynamic";

/**
 * Administración del programa de afiliados. El layout de `/admin` ya comprueba
 * el rol. Para hacer a alguien afiliado se sigue usando el interruptor de
 * `/admin/usuarios`, que le da su código y su enlace.
 */
export default async function AdminAfiliadosPage() {
  const tasa = tasaUsdCup();
  const inicioMes = new Date(`${new Date().toISOString().slice(0, 7)}-01T00:00:00Z`);
  const [afiliados, pagosMes] = await Promise.all([
    listarAfiliados(),
    db
      .select({ id: pagos.id, negocio: places.name, monto: pagos.montoCentavos, tipo: pagos.tipo, clave: pagos.clave, pagadoEn: pagos.pagadoEn })
      .from(pagos)
      .innerJoin(places, eq(places.id, pagos.negocioId))
      .where(and(eq(pagos.estado, "pagado"), eq(pagos.metodo, "qvapay"), gte(pagos.pagadoEn, inicioMes)))
      .orderBy(desc(pagos.pagadoEn))
      .limit(30),
  ]);

  const cobrosPedidos = afiliados.flatMap((a) => a.resumen.cobros.filter((c) => c.estado === "pedido").map((c) => ({ ...c, afiliado: a })));
  const premios = afiliados.flatMap((a) => a.resumen.premiosGanados.filter((p) => !p.entregado).map((p) => ({ ...p, afiliado: a })));
  const sesenta = Date.now() - 60 * 86_400_000;
  const inactivos = afiliados.filter((a) => (a.resumen.ultimoNegocio?.getTime() ?? a.creado.getTime()) < sesenta);
  const suma = (f: (a: (typeof afiliados)[number]) => number) => afiliados.reduce((s, a) => s + f(a), 0);
  const ingresoMes = pagosMes.reduce((s, p) => s + p.monto, 0);

  const kpis: [string, string][] = [
    ["Afiliados", String(afiliados.length)],
    ["Negocios suyos pagando", String(suma((a) => a.resumen.pagando))],
    ["Nuevos este mes", String(suma((a) => a.resumen.nuevosEsteMes))],
    ["Entró este mes (todos)", formatoCup(aCup(ingresoMes, tasa))],
    ["Comisiones generadas", formatoCup(aCup(suma((a) => a.resumen.dinero.generado), tasa))],
    ["Por pagar a afiliados", formatoCup(aCup(suma((a) => a.resumen.dinero.disponible + a.resumen.dinero.pedido), tasa))],
    ["Ya pagado a afiliados", formatoCup(aCup(suma((a) => a.resumen.dinero.cobrado), tasa))],
  ];
  const hoy: [number, string][] = [
    [cobrosPedidos.length, "cobros pedidos"],
    [premios.length, "premios por entregar"],
    [inactivos.length, "afiliados sin negocios en 60 días"],
  ];

  return (
    <div className="flex flex-col gap-gap-lg p-gap-md font-lv text-ink">
      <header className="flex flex-wrap items-end justify-between gap-gap-sm">
        <div>
          <span className={rotulo}>Programa de afiliados</span>
          <h1 className="font-lv-display text-h2 font-bold">Afiliados</h1>
        </div>
        <p className="text-meta text-ink-soft/70">
          Importes en CUP a {tasa} CUP/USD · para hacer afiliado a alguien: <Link href="/admin/usuarios" className="font-semibold text-verde-700 underline">Usuarios</Link>
        </p>
      </header>

      <section className="grid gap-2 sm:grid-cols-3">
        {hoy.map(([n, t]) => (
          <div key={t} className={`flex items-center gap-3 rounded-2xl border p-3 ${n ? "border-amber-300 bg-amber-50 text-amber-900" : "border-ink/5 bg-white"}`}>
            <b className="font-lv-display text-[22px] tabular-nums">{n}</b>
            <span className="text-small">{t}</span>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {kpis.map(([t, v]) => (
          <div key={t} className="rounded-xl border border-ink/5 bg-white p-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-soft/70">{t}</span>
            <b className="block font-lv-display text-[18px] tabular-nums">{v}</b>
          </div>
        ))}
      </section>

      <section className={`${tarjeta} flex flex-col gap-gap-sm`}>
        <h2 className="font-lv-display text-[18px] font-bold">Afiliados</h2>
        {afiliados.length === 0 ? (
          <p className="text-small text-ink-soft/75">Todavía no hay afiliados. Actívalos desde Usuarios.</p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full text-small">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-ink-soft/70">
                  <th className="px-1 py-2">Afiliado</th><th className="px-1 py-2">Ciudad</th>
                  <th className="px-1 py-2 text-right">Registrados</th><th className="px-1 py-2 text-right">Pagando</th>
                  <th className="px-1 py-2 text-right">Nuevos mes</th><th className="px-1 py-2 text-right">Por cobrar</th><th className="px-1 py-2">Último negocio</th>
                </tr>
              </thead>
              <tbody>
                {afiliados.map((a) => {
                  const viejo = (a.resumen.ultimoNegocio?.getTime() ?? a.creado.getTime()) < sesenta;
                  return (
                    <tr key={a.id} className="border-t border-ink/5">
                      <td className="px-1 py-2.5"><Link href={`/admin/afiliados/${a.id}`} className="font-semibold text-verde-700 underline">{a.nombre ?? a.email}</Link></td>
                      <td className="px-1 py-2.5">{a.ciudad ?? "—"}</td>
                      <td className="px-1 py-2.5 text-right tabular-nums">{a.resumen.negocios.length}</td>
                      <td className="px-1 py-2.5 text-right tabular-nums">{a.resumen.pagando}</td>
                      <td className="px-1 py-2.5 text-right tabular-nums">{a.resumen.nuevosEsteMes}</td>
                      <td className="px-1 py-2.5 text-right tabular-nums">{formatoCup(aCup(a.resumen.dinero.disponible + a.resumen.dinero.pedido, tasa))}</td>
                      <td className={`px-1 py-2.5 ${viejo ? "font-bold text-red-700" : ""}`}>{fecha(a.resumen.ultimoNegocio)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-gap-md lg:grid-cols-2">
        <section className={`${tarjeta} flex flex-col gap-gap-sm`}>
          <h2 className="font-lv-display text-[18px] font-bold">Cobros pedidos</h2>
          {cobrosPedidos.length === 0 && <p className="text-small text-ink-soft/75">No hay cobros pendientes.</p>}
          {cobrosPedidos.map((c) => (
            <div key={c.id} className="flex flex-col gap-2 border-t border-ink/5 pt-2 first:border-none first:pt-0">
              <p className="text-small">
                <b>{c.afiliado.nombre ?? c.afiliado.email}</b> · {formatoCup(c.montoCupCentavos / 100)} · {METODOS_COBRO[c.metodo]} al <span className="tabular-nums">{c.destino}</span>
                <span className="block text-meta text-ink-soft/70">Pedido el {fecha(c.createdAt)} · tasa {c.tasaUsdCup}</span>
              </p>
              <ResolverCobro id={c.id} />
            </div>
          ))}
        </section>
        <section className={`${tarjeta} flex flex-col gap-gap-sm`}>
          <h2 className="font-lv-display text-[18px] font-bold">Premios por entregar</h2>
          {premios.length === 0 && <p className="text-small text-ink-soft/75">No hay premios por entregar.</p>}
          {premios.map((p) => (
            <div key={`${p.afiliado.id}-${p.tipo}`} className="flex items-center justify-between gap-2 border-t border-ink/5 pt-2 first:border-none first:pt-0">
              <span className="text-small"><b>{p.afiliado.nombre ?? p.afiliado.email}</b> · {p.tipo === "bono" ? `Bono (${R.metaBono} en el mes)` : `Recarga internacional (${R.metaRecarga} en el mes)`}</span>
              <EntregarPremio afiliadoId={p.afiliado.id} tipo={p.tipo} />
            </div>
          ))}
        </section>
      </div>

      <section className={`${tarjeta} flex flex-col gap-gap-sm`}>
        <h2 className="font-lv-display text-[18px] font-bold">Pagos de negocios este mes</h2>
        <p className="text-meta text-ink-soft/70">Todos los pagos confirmados por QvaPay, traigan afiliado o no.</p>
        {pagosMes.length === 0 ? (
          <p className="text-small text-ink-soft/75">Todavía no hay pagos este mes.</p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full text-small">
              <thead><tr className="text-left text-[10px] uppercase tracking-[0.12em] text-ink-soft/70"><th className="px-1 py-2">Fecha</th><th className="px-1 py-2">Negocio</th><th className="px-1 py-2">Qué pagó</th><th className="px-1 py-2 text-right">Monto</th></tr></thead>
              <tbody>
                {pagosMes.map((p) => (
                  <tr key={p.id} className="border-t border-ink/5">
                    <td className="px-1 py-2 tabular-nums">{fecha(p.pagadoEn)}</td>
                    <td className="px-1 py-2">{p.negocio}</td>
                    <td className="px-1 py-2">{p.tipo === "plan" ? `Plan ${p.clave}` : p.tipo === "modulo" ? `Módulo ${p.clave}` : "Pack a medida"}</td>
                    <td className="px-1 py-2 text-right tabular-nums">{formatoCup(aCup(p.monto, tasa))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
