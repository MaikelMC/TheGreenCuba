import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Clock,
  CreditCard,
  SearchX,
} from "lucide-react";
import { getAppUser } from "@/lib/auth/user";
import { cargarBandejaAdmin } from "@/lib/admin-pendientes";
import { BandejaPendientes } from "@/components/admin/pendientes/bandeja-pendientes";
import { TarjetaAdmin, TarjetaKpi } from "@/components/admin/ui/tarjeta";
import { CambioCupWidget } from "@/components/admin/cambiocup-widget";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pendientes · Administración",
  robots: { index: false, follow: false },
};

const numero = (valor: number) =>
  valor.toLocaleString("es-CU", { maximumFractionDigits: 2 });

/**
 * La portada del panel: lo que hay que resolver hoy, no un mapa del sistema.
 *
 * El saludo, la fecha y el número de pendientes se calculan en el servidor con
 * la zona de La Habana. La bandeja llega ordenada por urgencia; resolver una
 * fila ahí mismo la quita de la lista y deja su entrada en Actividad.
 *
 * Las cifras enlazan a su sección. Ingresos y pagos tendrá su propia pantalla en
 * la Fase 8; hasta entonces, el dinero enlaza a la lista de negocios, que es
 * donde hoy se ve el plan de cada uno.
 */
export default async function AdminPendientesPage() {
  const [user, bandeja] = await Promise.all([
    getAppUser(),
    cargarBandejaAdmin(),
  ]);

  const ahora = new Date();
  const hora = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: "America/Havana",
    }).format(ahora),
  );
  const saludo =
    hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
  const nombre = user?.name ?? "administración";

  const fecha = new Intl.DateTimeFormat("es-CU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Havana",
  }).format(ahora);
  const fechaCapitalizada = fecha.charAt(0).toUpperCase() + fecha.slice(1);

  const { cifras, erroresMapa } = bandeja;
  const tasa = cifras.tasaUsdCup ? numero(cifras.tasaUsdCup) : null;

  return (
    <>
      <div className="mb-gap-md">
        <h1 className="font-lv-display text-h3 font-bold tracking-[-0.02em] text-ink">
          {saludo}, {nombre}
        </h1>
        <p className="mt-gap-xs text-small text-ink-soft/75">
          {fechaCapitalizada} ·{" "}
          {bandeja.total === 0
            ? "Todo al día"
            : `${bandeja.total} ${bandeja.total === 1 ? "pendiente" : "pendientes"}`}
        </p>
      </div>

      <div className="mb-gap-md grid grid-cols-2 gap-gap-sm xl:grid-cols-4">
        <Link
          href="/admin/negocios"
          className="rounded-2xl transition duration-300 ease-outquint hover:-translate-y-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40"
        >
          <TarjetaKpi
            etiqueta="Ingreso del mes"
            valor={`${numero(cifras.ingresoUsd)} USD`}
            detalle={
              cifras.ingresoCup !== null
                ? `≈ ${numero(cifras.ingresoCup)} CUP · tasa ${tasa}`
                : "Sin tasa disponible: solo USD"
            }
            icono={BadgeDollarSign}
            className="h-full"
          />
        </Link>
        <Link
          href="/admin/negocios"
          className="rounded-2xl transition duration-300 ease-outquint hover:-translate-y-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40"
        >
          <TarjetaKpi
            etiqueta="Negocios que pagan"
            valor={numero(cifras.negociosPagando)}
            detalle="Con plan o módulo vigente"
            icono={CreditCard}
            className="h-full"
          />
        </Link>
        <Link
          href="/admin/negocios"
          className="rounded-2xl transition duration-300 ease-outquint hover:-translate-y-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40"
        >
          <TarjetaKpi
            etiqueta="Pruebas que vencen"
            valor={numero(cifras.pruebasPorVencer)}
            detalle="En los próximos 7 días"
            icono={Clock}
            className="h-full"
          />
        </Link>
        <Link
          href="/admin/analytics"
          className="rounded-2xl transition duration-300 ease-outquint hover:-translate-y-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40"
        >
          <TarjetaKpi
            etiqueta="Búsquedas sin resultado"
            valor={numero(cifras.busquedasSinResultado)}
            detalle="Últimos 30 días"
            icono={SearchX}
            className="h-full"
          />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-gap-md lg:grid-cols-3">
        <div className="lg:col-span-2">
          <BandejaPendientes
            pendientes={bandeja.pendientes}
            total={bandeja.total}
          />
        </div>

        <div className="flex flex-col gap-gap-md">
          <TarjetaAdmin>
            <h2 className="font-lv-display text-body font-semibold text-ink">
              Sistema
            </h2>
            {erroresMapa > 0 ? (
              <Link
                href="/admin/diagnostico"
                className="mt-gap-sm flex items-start gap-gap-sm rounded-xl border border-destructive/25 bg-destructive/10 p-gap-sm transition-colors duration-300 hover:border-destructive/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40"
              >
                <AlertTriangle
                  size={18}
                  strokeWidth={1.8}
                  className="mt-[1px] shrink-0 text-destructive-ink"
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-lv-display text-small font-semibold text-ink">
                    Errores de Diagnóstico
                  </span>
                  <span className="block text-meta text-ink-soft/75">
                    {erroresMapa} en los últimos 7 días, mapa e hidratación. Míralos en Diagnóstico.
                  </span>
                </span>
                <ArrowRight
                  size={16}
                  strokeWidth={1.8}
                  className="mt-[2px] shrink-0 text-ink-soft/60"
                  aria-hidden
                />
              </Link>
            ) : (
              <p className="mt-gap-xs text-small text-ink-soft/75">
                Sin avisos activos. El mapa, los pagos y los envíos no han
                reportado problemas esta semana.
              </p>
            )}
          </TarjetaAdmin>

          <CambioCupWidget />
        </div>
      </div>
    </>
  );
}
