import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { formatoCup, METODOS_COBRO, notasAfiliado, REGLAS_AFILIADOS as R, resumenAfiliado, tasaUsdCup } from "@/lib/afiliados";
import { NuevaNota, QuitarAfiliacion } from "@/components/afiliados/acciones-admin";
import { Barra, Dinero, TablaNegocios, fecha, rotulo, tarjeta, textoMeta } from "@/components/afiliados/piezas";

export const dynamic = "force-dynamic";

/** Ficha de un afiliado: todo lo que ha traído, su dinero, sus metas, sus cobros y las notas internas. */
export default async function AdminAfiliadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [a] = await db
    .select({ id: users.id, nombre: users.name, email: users.email, phone: users.phone, ciudad: users.locationCity, codigo: users.referralCode, creado: users.createdAt })
    .from(users)
    .where(and(eq(users.id, id), isNotNull(users.referralCode)))
    .limit(1);
  if (!a) notFound();

  const [resumen, notas] = await Promise.all([resumenAfiliado(a.id), notasAfiliado(a.id)]);
  const tasa = tasaUsdCup();
  const { dinero } = resumen;
  const datos: [string, string][] = [
    ["Correo", a.email],
    ["Teléfono", a.phone ?? "—"],
    ["Código", a.codigo ?? "—"],
    ["Afiliado desde", a.creado.toLocaleDateString("es-CU")],
    ["Último negocio pagado", fecha(resumen.ultimoNegocio)],
    ["Cuentas por su enlace", String(resumen.personasRegistradas)],
  ];

  return (
    <div className="flex flex-col gap-gap-lg p-gap-md font-lv text-ink">
      <div className="flex items-center gap-gap-md">
        <Link href="/admin/afiliados" className="text-small font-semibold text-verde-700 underline">
          ← Todos los afiliados
        </Link>
      </div>

      <section className={`${tarjeta} flex flex-col gap-gap-sm`}>
        <header className="flex flex-wrap items-start justify-between gap-gap-sm">
          <div>
            <span className={rotulo}>{a.ciudad ?? "Sin ciudad"}</span>
            <h1 className="font-lv-display text-h2 font-bold">{a.nombre ?? a.email}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-gap-sm">
            <span className="rounded-full border border-verde-200 bg-verde-50 px-3 py-1 text-meta font-semibold text-verde-700">
              {Math.round(resumen.porcentajeRecurrente * 100)}% mensual · {resumen.pagando} pagando
            </span>
            <QuitarAfiliacion afiliadoId={a.id} nombre={a.nombre ?? a.email} />
          </div>
        </header>
        <dl className="grid gap-x-gap-md gap-y-2 text-small sm:grid-cols-3">
          {datos.map(([k, v]) => (
            <div key={k}><dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-soft/70">{k}</dt><dd className="break-words">{v}</dd></div>
          ))}
        </dl>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Dinero etiqueta="Generado" usd={dinero.generado} tasa={tasa} />
          <Dinero etiqueta="Pendiente" usd={dinero.pendiente} tasa={tasa} />
          <Dinero etiqueta="Por cobrar" usd={dinero.disponible + dinero.pedido} tasa={tasa} destacado />
          <Dinero etiqueta="Ya cobrado" usd={dinero.cobrado} tasa={tasa} />
        </div>
        <div className="grid gap-gap-sm sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <p className="text-small"><b className="tabular-nums">{resumen.nuevosEsteMes}</b> negocios nuevos pagaron este mes. {textoMeta(resumen.nuevosEsteMes, R.metaBono, R.metaRecarga)}</p>
            <Barra valor={resumen.nuevosEsteMes} max={R.metaRecarga} />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-small"><b className="tabular-nums">{resumen.totalPagados}</b> de {R.metaEquipo} pagados en todo el programa (equipo de marketing).</p>
            <Barra valor={resumen.totalPagados} max={R.metaEquipo} />
          </div>
        </div>
      </section>

      <section className={`${tarjeta} flex flex-col gap-gap-sm`}>
        <h2 className="font-lv-display text-[18px] font-bold">Negocios que ha traído</h2>
        <TablaNegocios negocios={resumen.negocios} tasa={tasa} conPagos conAcciones />
      </section>

      <div className="grid gap-gap-md lg:grid-cols-2">
        <section className={`${tarjeta} flex flex-col gap-gap-sm`}>
          <h2 className="font-lv-display text-[18px] font-bold">Cobros</h2>
          {resumen.cobros.length === 0 && <p className="text-small text-ink-soft/75">Sin cobros todavía.</p>}
          {resumen.cobros.map((c) => (
            <p key={c.id} className="border-t border-ink/5 pt-2 text-small first:border-none first:pt-0">
              {fecha(c.createdAt)} · <b>{formatoCup(c.montoCupCentavos / 100)}</b> · {METODOS_COBRO[c.metodo]} · {c.estado === "pagado" ? "Pagado" : c.estado === "rechazado" ? "Rechazado" : "Pedido"}
              {c.nota && <span className="block text-meta text-ink-soft/70">{c.nota}</span>}
            </p>
          ))}
        </section>
        <section className={`${tarjeta} flex flex-col gap-gap-sm`}>
          <h2 className="font-lv-display text-[18px] font-bold">Notas internas</h2>
          <p className="text-meta text-ink-soft/70">Solo las ven los administradores.</p>
          <ul className="flex flex-col gap-2">
            {notas.map((n) => (
              <li key={n.id} className="rounded-xl bg-sand p-2.5 text-small">
                <span className="block text-meta text-ink-soft/70">{n.createdAt.toLocaleDateString("es-CU")} · {n.autor ?? "Admin"}</span>
                {n.texto}
              </li>
            ))}
          </ul>
          <NuevaNota afiliadoId={a.id} />
        </section>
      </div>
    </div>
  );
}
