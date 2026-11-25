import { ArrowDown, Sparkles } from "lucide-react";
import { getFunnels, type FunnelStage } from "@/lib/analytics/queries";
import { normalizePeriod } from "@/lib/analytics/period";
import { TarjetaAdmin } from "@/components/admin/ui/tarjeta";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Onboarding · Administración",
  robots: { index: false, follow: false },
};

function Embudo({ titulo, etapas }: { titulo: string; etapas: FunnelStage[] }) {
  if (etapas.length === 0) {
    return (
      <TarjetaAdmin>
        <h2 className="font-lv-display text-body font-semibold text-ink">{titulo}</h2>
        <p className="mt-2 text-small text-ink-soft/75">
          Sin datos en este periodo. No se pinta un embudo vacío.
        </p>
      </TarjetaAdmin>
    );
  }

  const mayorCaida = etapas.reduce(
    (peor, etapa) =>
      etapa.conversion < peor.conversion || peor.conversion === 100
        ? etapa
        : peor,
    etapas[0]!,
  );
  const base = etapas[0]?.count ?? 0;

  return (
    <TarjetaAdmin>
      <h2 className="font-lv-display text-body font-semibold text-ink">{titulo}</h2>
      <p className="mt-1 text-meta text-ink-soft/75">
        La caída mayor está marcada: es donde más gente se pierde.
      </p>
      <ol className="mt-4 flex flex-col gap-2">
        {etapas.map((etapa, i) => {
          const ancho = base > 0 ? Math.max((etapa.count / base) * 100, 4) : 4;
          const peor = etapa === mayorCaida && i > 0;
          return (
            <li key={etapa.label} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3 text-small">
                <span className="text-ink">{etapa.label}</span>
                <span className="font-lv-display font-semibold text-ink">
                  {etapa.count.toLocaleString("es-CU")}
                  <span className="ml-1 font-normal text-ink-soft/75">
                    · {etapa.conversion}%
                  </span>
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-sand">
                <div
                  className={`h-full rounded-full ${peor ? "bg-amber-500" : "bg-verde-500"}`}
                  style={{ width: `${ancho}%` }}
                />
              </div>
              {peor ? (
                <p className="flex items-center gap-1 text-meta font-semibold text-amber-700">
                  <ArrowDown size={12} aria-hidden /> Caída mayor: {etapa.label}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </TarjetaAdmin>
  );
}

export default async function OnboardingAdminPage() {
  const { from, to } = normalizePeriod(null, null);
  const embudos = await getFunnels({ from, to });

  return (
    <>
      <div className="mb-gap-md">
        <p className="flex items-center gap-1 font-lv-display text-[10px] font-semibold uppercase tracking-[0.18em] text-verde-600">
          <Sparkles size={12} /> Crecimiento
        </p>
        <h1 className="font-lv-display text-h3 font-bold text-ink">Onboarding</h1>
        <p className="mt-1 text-small text-ink-soft/75">
          Últimos 30 días · datos reales de las etapas registradas.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-gap-md xl:grid-cols-2">
        <Embudo titulo="Embudo de usuarios" etapas={embudos.users} />
        <Embudo titulo="Embudo de negocios" etapas={embudos.businesses} />
      </div>
    </>
  );
}
