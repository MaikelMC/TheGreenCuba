import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Trophy, MapPin } from "lucide-react";
import {
  leerRanking,
  ultimoPeriodo,
  type PuestoPublico,
} from "@/lib/ranking-server";

/**
 * El ranking público: quién ganó el «Top del mes», por categoría y municipio.
 *
 * Es una página **de servidor** —no cliente— por lo mismo que la ficha
 * (`place/[id]/page.tsx`): los buscadores tienen que poder leerla sin ejecutar
 * JavaScript, y un podio es justo el contenido que se comparte por enlace.
 *
 * Lee el **último periodo calculado**, el que dejó el job mensual, no el mes en
 * curso: el mes en curso todavía no tiene podio, y enseñar uno a medias que
 * luego cambia sería peor que no enseñar ninguno.
 *
 * `force-dynamic` para que la consulta no ocurra en el build: desde esta red,
 * tocar Neon al compilar es lo que tumba un despliegue. La página es de bajo
 * tráfico —un podio mensual— así que una lectura por visita es asumible;
 * `ponytail:` si algún día pesa, envolver `leerRanking` en `unstable_cache` con
 * `CATALOG_TAG`, que el job ya revalida.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Top del mes · La Verde",
  description:
    "Los negocios más visitados de su categoría en cada municipio de Cuba, según La Verde. El podio se renueva cada mes.",
  alternates: { canonical: "/ranking" },
};

/** «2026-09» → «septiembre de 2026». */
function mes(periodo: string): string {
  /* Valores por defecto para el compilador: `periodo` siempre es «YYYY-MM». */
  const [anio = 0, mesNum = 1] = periodo.split("-").map(Number);
  const nombre = new Date(Date.UTC(anio, mesNum - 1, 1)).toLocaleDateString(
    "es-ES",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

const MEDALLAS = ["🥇", "🥈", "🥉"];

function Fila({ puesto }: { puesto: PuestoPublico }) {
  return (
    <li>
      <Link
        href={`/place/${puesto.negocioId}`}
        className="flex items-center gap-gap-sm rounded-xl border border-ink/5 bg-white p-gap-sm transition-colors duration-500 ease-outquint hover:border-verde-300"
      >
        <span
          className="grid size-8 shrink-0 place-items-center text-lg"
          aria-hidden
        >
          {MEDALLAS[puesto.posicion - 1] ?? puesto.posicion}
        </span>
        <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-verde-50 to-verde-100">
          {puesto.logoUrl ? (
            <Image src={puesto.logoUrl} alt="" fill sizes="40px" className="object-cover" />
          ) : (
            <span className="grid size-full place-items-center text-verde-600">
              <Trophy size={16} strokeWidth={1.8} />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-lv-display text-body font-semibold text-ink">
            {puesto.nombre}
          </div>
          <div className="font-lv-display text-meta text-ink-soft/75">
            {puesto.visitas}{" "}
            {puesto.visitas === 1 ? "visita única" : "visitas únicas"}
          </div>
        </div>
      </Link>
    </li>
  );
}

export default async function RankingPage() {
  const periodo = await ultimoPeriodo();
  const puestos = periodo ? await leerRanking(periodo) : [];

  /* Agrupado en el servidor, que es donde están los datos: categoría →
     municipio → los tres puestos. El orden ya viene resuelto de la consulta. */
  const porCategoria = new Map<
    string,
    { nombre: string; municipios: Map<string, PuestoPublico[]> }
  >();
  for (const puesto of puestos) {
    const grupo = porCategoria.get(puesto.categoria) ?? {
      nombre: puesto.categoriaNombre,
      municipios: new Map<string, PuestoPublico[]>(),
    };
    const lista = grupo.municipios.get(puesto.municipio) ?? [];
    lista.push(puesto);
    grupo.municipios.set(puesto.municipio, lista);
    porCategoria.set(puesto.categoria, grupo);
  }

  return (
    <div className="mx-auto max-w-3xl px-gap-md py-gap-xl">
      <header className="mb-gap-lg">
        <span className="inline-flex items-center gap-[6px] font-lv-display text-meta font-semibold uppercase tracking-[0.08em] text-verde-700">
          <Trophy size={14} strokeWidth={2.2} />
          Top del mes
        </span>
        <h1 className="mt-gap-xs font-lv-display text-h2 font-bold tracking-[-0.02em] text-ink">
          Los más visitados de La Verde
        </h1>
        <p className="mt-gap-xs text-small leading-[1.7] text-ink-soft">
          {periodo
            ? `El podio de ${mes(periodo)}, por categoría y municipio. Se renueva cada mes.`
            : "El podio se publica a principios de cada mes."}
        </p>
      </header>

      {porCategoria.size === 0 ? (
        <p className="rounded-xl border border-ink/5 bg-white p-gap-md text-small text-ink-soft">
          Todavía no hay podio. Vuelve a principios del mes que viene.
        </p>
      ) : (
        <div className="flex flex-col gap-gap-xl">
          {[...porCategoria.entries()].map(([categoria, grupo]) => (
            <section key={categoria}>
              <h2 className="mb-gap-sm font-lv-display text-h3 font-bold tracking-[-0.02em] text-ink">
                {grupo.nombre}
              </h2>
              <div className="flex flex-col gap-gap-md">
                {[...grupo.municipios.entries()].map(([municipio, lista]) => (
                  <div key={municipio}>
                    <h3 className="mb-gap-xs inline-flex items-center gap-[4px] font-lv-display text-meta font-semibold uppercase tracking-[0.06em] text-ink-soft/75">
                      <MapPin size={12} strokeWidth={2} />
                      {municipio}
                    </h3>
                    <ol className="flex flex-col gap-gap-xs">
                      {lista.map((puesto) => (
                        <Fila key={puesto.negocioId} puesto={puesto} />
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
