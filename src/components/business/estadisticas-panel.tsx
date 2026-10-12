"use client";

import { Lock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { MiniChart } from "@/components/business/mini-chart";
import type { VisitasPanel } from "@/lib/eventos";
import { textoBloqueo, type Feature, type Plan } from "@/lib/plans";

/**
 * Las estadísticas del negocio, por plan.
 *
 * El recorte lo decide el **servidor** (`statsVisitas` solo rellena las partes
 * que el plan incluye); esto solo pinta lo que llega y, cuando falta, enseña el
 * candado. La razón de que el corte no se haga aquí es que un número que viaja
 * al navegador ya se puede leer aunque no se pinte: si el plan es Gratis, la
 * serie del gráfico no sale de Neon.
 *
 * Gratis tiene una cifra y dos puertas; Básico, la fila de visitas y llamadas;
 * Pro, el gráfico y los productos. Cada bloque bloqueado dice **qué plan lo
 * abre** y lleva al dueño a la sección de planes, que es donde puede hacer algo
 * al respecto.
 */
export function EstadisticasPanel({
  plan,
  visitas,
  onVerPlanes,
}: {
  plan: Plan;
  /** Ya recortado por plan en el servidor. */
  visitas: VisitasPanel;
  onVerPlanes: () => void;
}) {
  const basicas = visitas.basicas;
  const completas = visitas.completas;

  return (
    <section className="mt-gap-lg flex flex-col gap-gap-md">
      <div>
        <h2 className="font-lv-display text-body font-semibold text-ink">
          Estadísticas
        </h2>
        <p className="mt-[2px] text-small text-ink-soft/75">
          Lo que pasa con tu ficha en La Verde. Sin datos de nadie: solo
          cuántos.
        </p>
      </div>

      {/* La cifra que ve todo el mundo, también el plan Gratis. */}
      <div className="flex items-center gap-gap-md rounded-2xl border border-verde-200 bg-verde-50/50 p-gap-md shadow-soft">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-verde-100 text-verde-700">
          <TrendingUp size={20} strokeWidth={1.8} />
        </span>
        <p className="text-body text-ink">
          Tu ficha y tu carta tuvieron{" "}
          <span className="font-lv-display text-h3 font-bold tabular-nums text-verde-700">
            {visitas.resumen.mes.toLocaleString("es-CU")}
          </span>{" "}
          {visitas.resumen.mes === 1 ? "visita" : "visitas"} este mes.
        </p>
      </div>

      {/* Visitas y llamadas a 7 y 30 días. Básico y superiores.

          En fila de cifras y no en tarjetas: el dashboard ya enseña cuatro
          tarjetas de la ficha justo arriba, y ocho cuadrados idénticos seguidos
          convertían la pantalla en un tablero donde no se distinguía una cosa de
          otra. Cuatro números no necesitan cuatro marcos. */}
      {basicas ? (
        <Cifras
          titulo="Visitas y llamadas"
          nota="Últimos 7 y 30 días"
          cifras={[
            { label: "Visitas · 7 días", valor: basicas.visitas7 },
            { label: "Llamadas · 7 días", valor: basicas.llamadas7 },
            { label: "Visitas · 30 días", valor: basicas.visitas30 },
            { label: "Llamadas · 30 días", valor: basicas.llamadas30 },
          ]}
        />
      ) : (
        <Bloqueado
          feature="stats_basicas"
          plan={plan}
          onVerPlanes={onVerPlanes}
        >
          Visitas y llamadas de los últimos 7 y 30 días.
        </Bloqueado>
      )}

      {/* Gráfico, productos y reservas. Pro. */}
      {completas ? (
        <div className="flex flex-col gap-gap-md">
          <Cifras
            titulo="Reservas por WhatsApp"
            nota="Toques al botón"
            cifras={[
              { label: "Últimos 7 días", valor: completas.reservas.corto },
              { label: "Últimos 30 días", valor: completas.reservas.largo },
            ]}
            pie="Son los que abrieron el formulario y pasaron a WhatsApp. La reserva la cierras tú por ahí: esto no cuenta las que se confirmaron."
          />
          <div className="grid grid-cols-1 gap-gap-md lg:grid-cols-2">
            <MiniChart
              data={completas.serie.map((d) => d.conteo)}
              title="Visitas por día"
              period="Últimos 14 días"
              unit="visitas"
            />
            <TopProductos productos={completas.topProductos} />
          </div>
        </div>
      ) : (
        <Bloqueado
          feature="stats_completas"
          plan={plan}
          onVerPlanes={onVerPlanes}
        >
          El gráfico día a día, tus 5 productos más vistos y las reservas.
        </Bloqueado>
      )}
    </section>
  );
}

/**
 * Una fila de cifras bajo un título: dos o cuatro números con su etiqueta.
 *
 * Dos columnas en el móvil y cuatro de 640 px para arriba. La forma la usaban
 * las reservas —dos cifras sueltas— y las visitas básicas —cuatro tarjetas
 * enteras—; son la misma cosa, así que ahora hay un solo componente. Cuando el
 * pie no hace falta, no se pasa.
 */
function Cifras({
  titulo,
  nota,
  cifras,
  pie,
}: {
  titulo: string;
  /** La pastilla de la derecha: qué mide la fila. */
  nota: string;
  cifras: { label: string; valor: number }[];
  pie?: string;
}) {
  return (
    <div className="rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-gap-sm">
        <span className="font-lv-display text-small font-semibold text-ink">
          {titulo}
        </span>
        <span className="rounded-full bg-sand-deep px-[10px] py-[3px] font-lv-display text-meta text-ink-soft/75">
          {nota}
        </span>
      </div>

      <dl className="mt-gap-sm grid grid-cols-2 gap-gap-sm sm:grid-cols-4">
        {cifras.map(({ label, valor }) => (
          <div key={label} className="flex flex-col gap-[2px]">
            <dt className="text-meta text-ink-soft/75">{label}</dt>
            <dd className="font-lv-display text-h3 font-bold tabular-nums leading-none text-ink">
              {valor.toLocaleString("es-CU")}
            </dd>
          </div>
        ))}
      </dl>

      {pie && <p className="mt-gap-sm text-meta text-ink-soft/75">{pie}</p>}
    </div>
  );
}

/** Los cinco productos que más se han visto, con su barra para compararlos. */
function TopProductos({
  productos,
}: {
  productos: { nombre: string; conteo: number }[];
}) {
  const max = Math.max(...productos.map((p) => p.conteo), 1);

  return (
    <div className="rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft">
      <div className="mb-gap-md flex items-center justify-between">
        <span className="font-lv-display text-small font-semibold text-ink">
          Productos más vistos
        </span>
        <span className="rounded-full bg-sand-deep px-[10px] py-[3px] font-lv-display text-meta text-ink-soft/75">
          30 días
        </span>
      </div>

      {productos.length === 0 ? (
        <p className="text-small text-ink-soft/75">
          Todavía no hay productos vistos. Aparecen cuando alguien entra a tu
          carta y baja por ella.
        </p>
      ) : (
        <ul className="flex flex-col gap-gap-sm">
          {productos.map((p) => (
            <li key={p.nombre} className="flex flex-col gap-[5px]">
              <div className="flex items-baseline justify-between gap-gap-sm">
                <span className="truncate text-small text-ink">{p.nombre}</span>
                <span className="shrink-0 font-lv-display text-small font-semibold tabular-nums text-ink">
                  {p.conteo.toLocaleString("es-CU")}
                </span>
              </div>
              <div className="h-[6px] overflow-hidden rounded-full bg-sand-deep">
                <div
                  className="h-full rounded-full bg-verde-400"
                  style={{ width: `${(p.conteo / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Un bloque que el plan no incluye.
 *
 * Dice **qué** te pierdes y **en qué plan** entra, y lleva a la sección donde se
 * cambia. Un candado sin puerta solo informa de que no puedes.
 */
function Bloqueado({
  feature,
  plan,
  onVerPlanes,
  children,
}: {
  feature: Feature;
  plan: Plan;
  onVerPlanes: () => void;
  children: React.ReactNode;
}) {
  /* `textoBloqueo` devuelve `null` cuando el plan ya lo incluye; aquí nunca pasa,
     porque este bloque solo se pinta cuando falta. El respaldo evita un hueco. */
  const texto = textoBloqueo(feature, plan) ?? "Disponible en un plan superior";

  return (
    <div className="flex items-center gap-gap-md rounded-2xl border border-dashed border-ink/15 bg-sand/60 p-gap-md">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-sand-deep text-ink-soft/75">
        <Lock size={19} strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-small text-ink">{children}</p>
        <p className="mt-[2px] font-lv-display text-meta font-semibold text-ink-soft/75">
          {texto}
        </p>
      </div>
      <button
        type="button"
        onClick={onVerPlanes}
        className={cn(
          "inline-flex h-10 shrink-0 cursor-pointer items-center rounded-full border border-ink/10 bg-white px-gap-md font-lv-display text-small font-semibold text-ink transition-colors duration-500 ease-outquint",
          "hover:border-verde-300 hover:text-verde-700 active:scale-[0.98]",
        )}
      >
        Ver planes
      </button>
    </div>
  );
}
