import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAppUser } from "@/lib/auth/user";
import { siteConfig } from "@/config/site";
import { REFERRAL_PARAM } from "@/lib/referral";
import { aCup, formatoCup, METODOS_COBRO, REGLAS_AFILIADOS as R, resumenAfiliado, tasaUsdCup } from "@/lib/afiliados";
import { UserMenu } from "@/components/layout/user-menu";
import { CopyLink } from "@/components/profile/copy-link";
import { PedirCobro } from "@/components/afiliados/pedir-cobro";
import { Barra, Dinero, TablaNegocios, fecha, rotulo, tarjeta, textoMeta } from "@/components/afiliados/piezas";

/* Dinámico por la misma razón que antes: lee la sesión. */
export const dynamic = "force-dynamic";

/**
 * El panel del afiliado.
 *
 * Se entra con sesión (el proxy cierra `/enlaces`) y además hay que tener código:
 * ser afiliado lo concede un administrador. Lo que gana se calcula en
 * `src/lib/afiliados.ts` a partir de los pagos de los negocios cuyo dueño se
 * registró con su enlace; aquí solo se pinta, en CUP.
 */
export default async function LinksPage() {
  const user = await getAppUser();
  if (!user) redirect("/login?next=/enlaces");
  if (!user.referralCode) redirect("/profile");

  const resumen = await resumenAfiliado(user.id);
  const tasa = tasaUsdCup();
  const { dinero } = resumen;
  const url = `${siteConfig.url.replace(/\/+$/, "")}/register?${REFERRAL_PARAM}=${user.referralCode}`;
  const avisos = resumen.negocios.filter((n) => n.estado === "vence" || n.estado === "registrado");
  const pct = Math.round(resumen.porcentajeRecurrente * 100);

  return (
    <div className="min-h-dvh bg-sand font-lv text-ink">
      <header className="safe-top sticky top-0 z-50 flex h-header items-center gap-2 border-b border-ink/5 bg-sand-warm/90 px-3 backdrop-blur-[16px] sm:gap-gap-sm sm:px-gap-md">
        <Link
          href="/home"
          className="grid size-9 shrink-0 place-items-center rounded-full text-ink-soft/75 transition-colors duration-500 ease-outquint hover:bg-verde-50 hover:text-verde-600"
          aria-label="Volver al inicio"
        >
          <ArrowLeft size={18} strokeWidth={1.8} />
        </Link>
        <h1 className="truncate font-lv-display text-[18px] font-bold tracking-[-0.02em] text-ink">Panel de afiliado</h1>
        <div className="min-w-0 flex-1" />
        <UserMenu initial={user.name.charAt(0)} />
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-gap-lg px-gap-sm pt-gap-lg pb-gap-xl sm:px-gap-md">
        <header className="flex flex-wrap items-end justify-between gap-gap-sm">
          <div className="flex flex-col gap-gap-2xs">
            <span className={rotulo}>Programa de afiliados</span>
            <h2 className="font-lv-display text-h2 font-bold leading-tight tracking-[-0.02em]">Hola, {user.name.split(" ")[0]} 👋</h2>
          </div>
          <span className="rounded-full border border-verde-200 bg-verde-50 px-3 py-1 font-lv-display text-meta font-semibold text-verde-700">
            {pct}% mensual · {resumen.pagando} pagando{pct < 12 ? ` (12% desde ${R.negociosParaSubir})` : ""}
          </span>
        </header>

        <section className={`${tarjeta} flex flex-col gap-gap-sm`}>
          <h2 className="font-lv-display text-[18px] font-bold">Tu dinero</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Dinero etiqueta="Total generado" usd={dinero.generado} tasa={tasa} nota={dinero.generado > 0 ? `≈ $${(dinero.generado / 100).toFixed(2)} USD` : undefined} />
            <Dinero etiqueta="Pendiente" usd={dinero.pendiente} tasa={tasa} nota={`Se libera a los ${R.diasRetencion} días`} />
            <Dinero etiqueta="Disponible" usd={dinero.disponible} tasa={tasa} destacado nota={dinero.disponible > 0 ? `≈ $${(dinero.disponible / 100).toFixed(2)} USD` : "Para cobrar"} />
            <Dinero etiqueta="Ya cobrado" usd={dinero.cobrado} tasa={tasa} nota={dinero.cobrado > 0 ? `≈ $${(dinero.cobrado / 100).toFixed(2)} USD` : "Desde que empezaste"} />
          </div>
          <PedirCobro disponibleCup={aCup(dinero.disponible, tasa)} minimoCup={R.cobroMinimoCup} hayPedido={dinero.pedido > 0} />
        </section>

        <section className="grid gap-gap-sm sm:grid-cols-2">
          <div className={`${tarjeta} flex flex-col gap-2`}>
            <h2 className="font-lv-display text-[16px] font-bold">Tu meta de este mes</h2>
            <p className="text-small"><b className="tabular-nums">{resumen.nuevosEsteMes}</b> negocios nuevos pagaron este mes</p>
            <Barra valor={resumen.nuevosEsteMes} max={R.metaRecarga} />
            <p className="flex justify-between gap-2 text-meta text-ink-soft/70">
              <span className={resumen.nuevosEsteMes >= R.metaBono ? "font-bold text-verde-700" : ""}>{R.metaBono} → bono</span>
              <span className={resumen.nuevosEsteMes >= R.metaRecarga ? "font-bold text-verde-700" : ""}>{R.metaRecarga} → recarga internacional</span>
            </p>
            <p className="text-meta text-ink-soft/75">{textoMeta(resumen.nuevosEsteMes, R.metaBono, R.metaRecarga)}</p>
          </div>
          <div className={`${tarjeta} flex flex-col gap-2`}>
            <h2 className="font-lv-display text-[16px] font-bold">Camino al equipo de marketing</h2>
            <p className="text-small"><b className="tabular-nums">{resumen.totalPagados}</b> de {R.metaEquipo} negocios pagados desde que empezaste</p>
            <Barra valor={resumen.totalPagados} max={R.metaEquipo} />
            <p className="text-meta text-ink-soft/75">Al llegar a {R.metaEquipo} contamos contigo para el futuro equipo de marketing.</p>
          </div>
        </section>

        <section className={`${tarjeta} flex flex-col gap-gap-sm`}>
          <header className="flex flex-wrap items-baseline justify-between gap-gap-sm">
            <h2 className="font-lv-display text-[18px] font-bold">Tus negocios</h2>
            <span className="text-meta text-ink-soft/70">
              {resumen.negocios.length} registrados · {resumen.pagando} pagando · {resumen.personasRegistradas} cuentas por tu enlace
            </span>
          </header>
          {avisos.map((n) => (
            <p key={n.id} className="rounded-xl bg-amber-50 px-3 py-2 text-small text-amber-900">
              {n.estado === "vence"
                ? `⏰ ${n.nombre} vence el ${fecha(n.venceEn)}. Recuérdale renovar para seguir ganando tu ${pct}%.`
                : `💬 ${n.nombre} se registró pero no ha pagado. Todavía no suma comisión.`}
            </p>
          ))}
          <TablaNegocios negocios={resumen.negocios} tasa={tasa} conPagos />
        </section>

        {resumen.historialMeses.length > 0 && (
          <section className={`${tarjeta} flex flex-col gap-gap-sm`}>
            <h2 className="font-lv-display text-[18px] font-bold">Historial por mes</h2>
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full text-small">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-ink-soft/70 border-b border-ink/5">
                    <th className="px-2 py-2.5">Mes</th>
                    <th className="px-2 py-2.5 text-right">Negocios nuevos</th>
                    <th className="px-2 py-2.5 text-right">Comisión (CUP)</th>
                    <th className="px-2 py-2.5 text-right">≈ USD</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.historialMeses.map((h) => {
                    const [anio, m] = h.mes.split("-");
                    const etiqueta = new Date(Number(anio), Number(m) - 1).toLocaleDateString("es-CU", { month: "short", year: "numeric" });
                    return (
                      <tr key={h.mes} className="border-t border-ink/5">
                        <td className="px-2 py-2.5 capitalize font-medium">{etiqueta}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums">
                          {h.nuevosNegocios > 0 ? (
                            <span className="font-semibold text-verde-700">{h.nuevosNegocios}</span>
                          ) : (
                            <span className="text-ink-soft/50">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums font-semibold">
                          {h.comisionUsdCentavos > 0 ? formatoCup(aCup(h.comisionUsdCentavos, tasa)) : <span className="font-normal text-ink-soft/50">—</span>}
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-ink-soft/70">
                          {h.comisionUsdCentavos > 0 ? `$${(h.comisionUsdCentavos / 100).toFixed(2)}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className={`${tarjeta} flex flex-col gap-gap-sm`}>
          <h2 className="font-lv-display text-[18px] font-bold">Tu enlace</h2>
          <p className="text-small text-ink-soft/75">
            El dueño del negocio tiene que registrarse entrando por aquí. Así su negocio queda a tu nombre.
          </p>
          <CopyLink url={url} />
          <p className="text-small text-ink-soft/80">
            <b>Para presentarla:</b> «La Verde junta en un solo lugar el menú, los pedidos, las reservas y la gestión de tu
            negocio, y además te pone en el mapa para que la gente te encuentre. Pagas solo lo que usas, y el primer mes que
            pagas te llevas otro gratis.»
          </p>
        </section>

        <section className={`${tarjeta} flex flex-col gap-gap-sm`}>
          <h2 className="font-lv-display text-[18px] font-bold">Tus cobros</h2>
          {resumen.cobros.length === 0 ? (
            <p className="text-small text-ink-soft/75">Todavía no has pedido ningún cobro.</p>
          ) : (
            <ul className="flex flex-col">
              {resumen.cobros.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 border-t border-ink/5 py-2 text-small first:border-none">
                  <span>{fecha(c.createdAt)} · {METODOS_COBRO[c.metodo]}</span>
                  <span className="flex items-center gap-2">
                    <b className="tabular-nums">{formatoCup(c.montoCupCentavos / 100)}</b>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${c.estado === "pagado" ? "bg-verde-50 text-verde-700" : c.estado === "rechazado" ? "bg-red-50 text-red-700" : "bg-amber-100 text-amber-800"}`}>
                      {c.estado === "pagado" ? "Pagado" : c.estado === "rechazado" ? "Rechazado" : "Pedido"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <details className={`${tarjeta} text-small`}>
          <summary className="cursor-pointer font-lv-display font-bold">Reglas del programa</summary>
          <ul className="mt-gap-sm list-disc space-y-1 pl-5 text-ink-soft/85">
            <li>Ganas el {R.primerPago * 100}% del primer pago de cada negocio que traigas.</li>
            <li>Después, el {R.recurrente * 100}% de cada pago mensual durante {R.mesesRecurrente} meses ({R.recurrenteAlto * 100}% si tienes {R.negociosParaSubir} o más negocios pagando a la vez).</li>
            <li>Solo cuentan los negocios que pagaron. Registrarse sin pagar no suma.</li>
            <li>La comisión queda disponible a los {R.diasRetencion} días del pago. Si devolvemos el dinero a un negocio, se descuenta.</li>
            <li>Cobro mínimo {R.cobroMinimoCup} CUP, por saldo, transferencia en CUP o CubaPay, del día 1 al 5 de cada mes.</li>
            <li>No está permitido pagar el plan por el negocio, prometer cosas que La Verde no hace ni registrar negocios falsos.</li>
          </ul>
        </details>
      </main>
    </div>
  );
}
