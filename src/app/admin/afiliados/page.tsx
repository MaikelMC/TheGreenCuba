import Link from "next/link";
import { and, desc, eq, gte } from "drizzle-orm";
import { Users, TrendingUp, Wallet, AlertCircle, Store, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { pagos, places } from "@/lib/db/schema";
import {
  aCup,
  formatoCup,
  listarAfiliados,
  METODOS_COBRO,
  REGLAS_AFILIADOS as R,
  tasaUsdCup,
} from "@/lib/afiliados";
import { EntregarPremio, QuitarAfiliacion, ResolverCobro } from "@/components/afiliados/acciones-admin";
import { fecha, rotulo, tarjeta } from "@/components/afiliados/piezas";

export const dynamic = "force-dynamic";

export default async function AdminAfiliadosPage() {
  const tasa = tasaUsdCup();
  const inicioMes = new Date(`${new Date().toISOString().slice(0, 7)}-01T00:00:00Z`);
  const [afiliados, pagosMes] = await Promise.all([
    listarAfiliados(),
    db
      .select({
        id: pagos.id,
        negocio: places.name,
        monto: pagos.montoCentavos,
        tipo: pagos.tipo,
        clave: pagos.clave,
        pagadoEn: pagos.pagadoEn,
      })
      .from(pagos)
      .innerJoin(places, eq(places.id, pagos.negocioId))
      .where(
        and(eq(pagos.estado, "pagado"), eq(pagos.metodo, "qvapay"), gte(pagos.pagadoEn, inicioMes)),
      )
      .orderBy(desc(pagos.pagadoEn))
      .limit(50),
  ]);

  const cobrosPedidos = afiliados.flatMap((a) =>
    a.resumen.cobros
      .filter((c) => c.estado === "pedido")
      .map((c) => ({ ...c, afiliado: a })),
  );
  const premios = afiliados.flatMap((a) =>
    a.resumen.premiosGanados
      .filter((p) => !p.entregado)
      .map((p) => ({ ...p, afiliado: a })),
  );
  const sesenta = Date.now() - 60 * 86_400_000;
  const inactivos = afiliados.filter(
    (a) => (a.resumen.ultimoNegocio?.getTime() ?? a.creado.getTime()) < sesenta,
  );
  const suma = (f: (a: (typeof afiliados)[number]) => number) =>
    afiliados.reduce((s, a) => s + f(a), 0);

  /* ---- KPIs globales ---- */
  const kpis = [
    {
      icono: Users,
      etiqueta: "Afiliados activos",
      valor: String(afiliados.length),
      sub: `${inactivos.length} sin actividad en 60 d`,
      alerta: inactivos.length > 0,
    },
    {
      icono: Store,
      etiqueta: "Negocios pagando",
      valor: String(suma((a) => a.resumen.pagando)),
      sub: `${suma((a) => a.resumen.negocios.length)} registrados en total`,
      alerta: false,
    },
    {
      icono: TrendingUp,
      etiqueta: "Comisiones generadas",
      valor: formatoCup(aCup(suma((a) => a.resumen.dinero.generado), tasa)),
      sub: `${formatoCup(aCup(suma((a) => a.resumen.dinero.disponible + a.resumen.dinero.pedido), tasa))} por pagar`,
      alerta: false,
    },
    {
      icono: Wallet,
      etiqueta: "Cobros pedidos",
      valor: String(cobrosPedidos.length),
      sub: `${premios.length} premios por entregar`,
      alerta: cobrosPedidos.length > 0 || premios.length > 0,
    },
  ];

  return (
    <div className="flex flex-col gap-gap-lg">
      {/* Cabecera */}
      <header className="flex flex-wrap items-end justify-between gap-gap-sm">
        <div>
          <span className={rotulo}>Programa de afiliados</span>
          <h1 className="font-lv-display text-h2 font-bold text-ink">Afiliados</h1>
        </div>
        <p className="text-meta text-ink-soft/70">
          Importes en CUP a {tasa} CUP/USD ·{" "}
          <Link href="/admin/usuarios" className="font-semibold text-verde-700 underline">
            Dar de alta en Usuarios
          </Link>
        </p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-gap-sm xl:grid-cols-4">
        {kpis.map(({ icono: Icono, etiqueta, valor, sub, alerta }) => (
          <div
            key={etiqueta}
            className={`flex flex-col gap-1 rounded-2xl border p-gap-md ${
              alerta ? "border-amber-200 bg-amber-50" : "border-ink/5 bg-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <Icono
                size={16}
                strokeWidth={1.8}
                className={alerta ? "text-amber-600" : "text-verde-600"}
                aria-hidden="true"
              />
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-soft/70">
                {etiqueta}
              </span>
            </div>
            <b className="font-lv-display text-[22px] tabular-nums text-ink leading-tight">{valor}</b>
            <span className={`text-meta ${alerta ? "text-amber-700" : "text-ink-soft/70"}`}>{sub}</span>
          </div>
        ))}
      </div>

      {/* Tabla de afiliados */}
      <section className={`${tarjeta} flex flex-col gap-gap-sm`}>
        <h2 className="font-lv-display text-body font-bold text-ink">
          Afiliados registrados{" "}
          <span className="ml-1 inline-flex items-center rounded-full bg-verde-50 px-2 py-0.5 font-lv-display text-meta font-semibold text-verde-700 border border-verde-200">
            {afiliados.length}
          </span>
        </h2>

        {afiliados.length === 0 ? (
          <p className="text-small text-ink-soft/75">
            Todavía no hay afiliados. Actívalos desde{" "}
            <Link href="/admin/usuarios" className="font-semibold text-verde-700 underline">
              Usuarios
            </Link>
            .
          </p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full text-small">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-ink-soft/70 border-b border-ink/5">
                  <th className="px-2 py-2.5">Afiliado</th>
                  <th className="px-2 py-2.5 text-right">Traídos</th>
                  <th className="px-2 py-2.5 text-right">Pagando</th>
                  <th className="px-2 py-2.5 text-right">Nuevos/mes</th>
                  <th className="px-2 py-2.5 text-right">Comisiones</th>
                  <th className="px-2 py-2.5 text-right">Por cobrar</th>
                  <th className="px-2 py-2.5 text-right">Retiros</th>
                  <th className="px-2 py-2.5">Último neg.</th>
                  <th className="px-2 py-2.5">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {afiliados.map((a) => {
                  const viejo =
                    (a.resumen.ultimoNegocio?.getTime() ?? a.creado.getTime()) < sesenta;
                  const retirosPendientes = a.resumen.cobros.filter(
                    (c) => c.estado === "pedido",
                  ).length;
                  return (
                    <tr key={a.id} className="border-t border-ink/5 align-middle">
                      <td className="px-2 py-3">
                        <div className="flex flex-col gap-0.5">
                          <Link
                            href={`/admin/afiliados/${a.id}`}
                            className="font-semibold text-verde-700 hover:underline"
                          >
                            {a.nombre ?? a.email}
                          </Link>
                          {a.ciudad && (
                            <span className="text-meta text-ink-soft/70">{a.ciudad}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-right tabular-nums">
                        {a.resumen.negocios.length}
                      </td>
                      <td className="px-2 py-3 text-right tabular-nums">
                        <span
                          className={
                            a.resumen.pagando > 0
                              ? "font-semibold text-verde-700"
                              : "text-ink-soft/60"
                          }
                        >
                          {a.resumen.pagando}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-right tabular-nums">
                        {a.resumen.nuevosEsteMes > 0 ? (
                          <span className="font-semibold text-verde-700">
                            {a.resumen.nuevosEsteMes}
                          </span>
                        ) : (
                          <span className="text-ink-soft/60">0</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-right tabular-nums">
                        {a.resumen.dinero.generado > 0
                          ? formatoCup(aCup(a.resumen.dinero.generado, tasa))
                          : <span className="text-ink-soft/60">—</span>}
                      </td>
                      <td className="px-2 py-3 text-right tabular-nums">
                        {a.resumen.dinero.disponible + a.resumen.dinero.pedido > 0 ? (
                          <span className="font-semibold text-amber-700">
                            {formatoCup(
                              aCup(
                                a.resumen.dinero.disponible + a.resumen.dinero.pedido,
                                tasa,
                              ),
                            )}
                          </span>
                        ) : (
                          <span className="text-ink-soft/60">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-right">
                        {retirosPendientes > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                            <AlertCircle size={11} strokeWidth={2} aria-hidden="true" />
                            {retirosPendientes}
                          </span>
                        ) : (
                          <span className="text-ink-soft/60">—</span>
                        )}
                      </td>
                      <td
                        className={`px-2 py-3 tabular-nums ${viejo ? "font-bold text-red-700" : "text-ink-soft/70"}`}
                      >
                        {fecha(a.resumen.ultimoNegocio)}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link
                            href={`/admin/afiliados/${a.id}`}
                            className="inline-flex h-8 items-center gap-1 rounded-full border border-ink/10 bg-sand px-3 font-lv-display text-meta font-semibold text-ink hover:bg-sand-deep transition-colors duration-300"
                          >
                            <ExternalLink size={12} strokeWidth={2} aria-hidden="true" />
                            Ver
                          </Link>
                          <QuitarAfiliacion
                            afiliadoId={a.id}
                            nombre={a.nombre ?? a.email}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Cobros y premios pendientes */}
      {(cobrosPedidos.length > 0 || premios.length > 0) && (
        <div className="grid gap-gap-md lg:grid-cols-2">
          {cobrosPedidos.length > 0 && (
            <section className={`${tarjeta} flex flex-col gap-gap-sm`}>
              <h2 className="font-lv-display text-body font-bold text-ink">
                Retiros pendientes
                <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-lv-display text-meta font-semibold text-amber-800 border border-amber-200">
                  {cobrosPedidos.length}
                </span>
              </h2>
              {cobrosPedidos.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col gap-2 border-t border-ink/5 pt-gap-sm first:border-none first:pt-0"
                >
                  <div>
                    <p className="text-small font-semibold text-ink">
                      {c.afiliado.nombre ?? c.afiliado.email}
                    </p>
                    <p className="text-meta text-ink-soft/70">
                      {formatoCup(c.montoCupCentavos / 100)} · {METODOS_COBRO[c.metodo]} →{" "}
                      <span className="tabular-nums">{c.destino}</span>
                    </p>
                    <p className="text-meta text-ink-soft/60">
                      Pedido el {fecha(c.createdAt)} · tasa {c.tasaUsdCup} CUP/USD
                    </p>
                  </div>
                  <ResolverCobro id={c.id} />
                </div>
              ))}
            </section>
          )}

          {premios.length > 0 && (
            <section className={`${tarjeta} flex flex-col gap-gap-sm`}>
              <h2 className="font-lv-display text-body font-bold text-ink">
                Premios por entregar
                <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-lv-display text-meta font-semibold text-amber-800 border border-amber-200">
                  {premios.length}
                </span>
              </h2>
              {premios.map((p) => (
                <div
                  key={`${p.afiliado.id}-${p.tipo}`}
                  className="flex items-center justify-between gap-gap-sm border-t border-ink/5 pt-gap-sm first:border-none first:pt-0"
                >
                  <div>
                    <p className="text-small font-semibold text-ink">
                      {p.afiliado.nombre ?? p.afiliado.email}
                    </p>
                    <p className="text-meta text-ink-soft/70">
                      {p.tipo === "bono"
                        ? `Bono (${R.metaBono} negocios en el mes)`
                        : `Recarga internacional (${R.metaRecarga} negocios en el mes)`}
                    </p>
                  </div>
                  <EntregarPremio afiliadoId={p.afiliado.id} tipo={p.tipo} />
                </div>
              ))}
            </section>
          )}
        </div>
      )}

      {/* Pagos del mes */}
      <section className={`${tarjeta} flex flex-col gap-gap-sm`}>
        <div className="flex flex-wrap items-baseline justify-between gap-gap-sm">
          <h2 className="font-lv-display text-body font-bold text-ink">
            Pagos de negocios este mes
          </h2>
          <p className="text-meta text-ink-soft/70">
            Todos los confirmados por QvaPay
          </p>
        </div>
        {pagosMes.length === 0 ? (
          <p className="text-small text-ink-soft/75">Todavía no hay pagos este mes.</p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full text-small">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-ink-soft/70 border-b border-ink/5">
                  <th className="px-2 py-2.5">Fecha</th>
                  <th className="px-2 py-2.5">Negocio</th>
                  <th className="px-2 py-2.5">Concepto</th>
                  <th className="px-2 py-2.5 text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {pagosMes.map((p) => (
                  <tr key={p.id} className="border-t border-ink/5">
                    <td className="px-2 py-2.5 tabular-nums text-ink-soft/70">
                      {fecha(p.pagadoEn)}
                    </td>
                    <td className="px-2 py-2.5 font-semibold text-ink">{p.negocio}</td>
                    <td className="px-2 py-2.5 text-ink-soft/70">
                      {p.tipo === "plan"
                        ? `Plan ${p.clave}`
                        : p.tipo === "modulo"
                          ? `Módulo ${p.clave}`
                          : "Pack a medida"}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums font-semibold text-ink">
                      {formatoCup(aCup(p.monto, tasa))}
                    </td>
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
