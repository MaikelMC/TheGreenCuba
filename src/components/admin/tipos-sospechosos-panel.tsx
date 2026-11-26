import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldQuestion } from "lucide-react";
import type { SospechaTipo } from "@/lib/admin-tipos-sospechosos";

/**
 * La lista de fichas cuya categoría no encaja con su nombre o su carta.
 *
 * Es solo lectura: la categoría no se cambia sola. Cada fila lleva a la ficha
 * del negocio para que una persona decida. La fuente es la misma que la del
 * endpoint `/api/admin/tipos-sospechosos`, así que el informe y el panel no
 * pueden discrepar.
 */
export function TiposSospechososPanel({
  sospechosos,
}: {
  sospechosos: SospechaTipo[];
}) {
  return (
    <div className="flex flex-col gap-gap-md">
      <div className="flex flex-wrap items-start justify-between gap-gap-sm">
        <div className="min-w-0">
          <p className="lv-mono text-[11px] uppercase tracking-[0.2em] text-verde-700">
            Negocios
          </p>
          <h1 className="mt-1 font-lv-display text-h3 font-bold tracking-[-0.02em] text-ink">
            Tipos sospechosos
          </h1>
          <p className="mt-1 max-w-2xl text-small leading-relaxed text-ink-soft/75">
            Fichas cuyo nombre o cuya carta apuntan a otra categoría. No se
            cambia nada automáticamente: cada una se revisa en su ficha.
          </p>
        </div>
        <Link
          href="/admin/negocios"
          className="inline-flex min-h-11 items-center gap-[6px] rounded-full border border-ink/10 bg-white px-4 font-lv-display text-small font-semibold text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50"
        >
          <ArrowLeft size={15} strokeWidth={1.8} aria-hidden />
          Volver a negocios
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink/5 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-gap-xs border-b border-ink/5 px-4 py-3">
          <p className="font-lv-display text-small font-semibold text-ink">
            {sospechosos.length}{" "}
            {sospechosos.length === 1 ? "ficha" : "fichas"}
          </p>
          <p className="text-meta text-ink-soft/75">
            Sugerencia para revisar, no un cambio hecho.
          </p>
        </div>

        {sospechosos.length === 0 ? (
          <div className="flex flex-col items-center gap-gap-xs px-4 py-10 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-verde-50 text-verde-700">
              <ShieldQuestion size={22} strokeWidth={1.8} aria-hidden />
            </span>
            <p className="font-lv-display text-small font-semibold text-ink">
              No hay tipos sospechosos
            </p>
            <p className="max-w-[46ch] text-meta leading-relaxed text-ink-soft/75">
              Las categorías actuales encajan con los nombres y las cartas
              revisadas.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-ink/5">
            {sospechosos.map((sospecha) => (
              <li
                key={sospecha.id}
                className="flex flex-col gap-gap-sm px-4 py-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-lv-display text-small font-semibold text-ink">
                    {sospecha.name}
                  </p>
                  <p className="mt-[2px] flex flex-wrap items-center gap-x-[6px] gap-y-[2px] text-meta text-ink-soft/75">
                    <span>{sospecha.category}</span>
                    <ArrowRight
                      size={12}
                      strokeWidth={1.8}
                      aria-hidden
                      className="text-verde-600"
                    />
                    <span className="font-semibold text-verde-700">
                      {sospecha.sugerida}
                    </span>
                    <span className="text-ink-soft/50">·</span>
                    <span>{sospecha.motivo}</span>
                  </p>
                  {sospecha.coincidencias.length > 0 && (
                    <div className="mt-[6px] flex flex-wrap gap-[4px]">
                      {sospecha.coincidencias.map((coincidencia) => (
                        <span
                          key={coincidencia}
                          className="inline-flex h-[22px] items-center rounded-full bg-sand-deep px-2 font-lv-display text-[12px] font-medium leading-none text-ink-soft/75"
                        >
                          {coincidencia}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-gap-xs">
                  <span
                    className={
                      sospecha.confianza === 2
                        ? "inline-flex h-[22px] items-center rounded-full bg-amber-100 px-2 font-lv-display text-[12px] font-semibold leading-none text-amber-800"
                        : "inline-flex h-[22px] items-center rounded-full bg-sand-deep px-2 font-lv-display text-[12px] font-semibold leading-none text-ink-soft/75"
                    }
                  >
                    {sospecha.confianza === 2 ? "Nombre o carta" : "Solo carta"}
                  </span>
                  <Link
                    href={`/admin/negocios/${encodeURIComponent(sospecha.id)}/editar`}
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-verde-300 bg-verde-50 px-4 font-lv-display text-small font-semibold text-verde-700 transition-colors duration-500 ease-outquint hover:bg-verde-100"
                  >
                    Revisar ficha
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
