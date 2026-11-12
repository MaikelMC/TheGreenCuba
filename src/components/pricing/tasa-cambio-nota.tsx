import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Catalogo } from "@/lib/plans";

/**
 * La tasa con la que se están calculando los precios en CUP.
 *
 * No es decoración: el dueño compara el precio en dólares con la transferencia
 * en CUP y necesita saber **de dónde** sale el segundo número y **de cuándo**
 * es. Se pinta junto a los planes y en el catálogo de servicios, que son los
 * dos sitios donde se cobra.
 *
 * La fecha se formatea a mano y en ISO: `toLocaleString` depende del ICU del
 * servidor y del navegador, y aquí el texto se renderiza en los dos lados.
 */

/** «1083.3211» → «1.083,32». Sin `Intl`, para que SSR y cliente coincidan. */
function tasaTexto(valor: number): string {
  const [entera = "0", decimales = "00"] = valor.toFixed(2).split(".");
  const miles = entera.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${miles},${decimales}`;
}

/** «2026-11-10» → «10/11/2026». */
function fechaTexto(iso: string): string {
  const [anio = "", mes = "", dia = ""] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${anio}`;
}

export function TasaCambioNota({
  catalogo,
  className,
  variante = "compacta",
}: {
  catalogo: Catalogo;
  className?: string;
  /** `destacada` es la tarjeta de la portada; el resto de páginas usa la píldora. */
  variante?: "compacta" | "destacada";
}) {
  const viva = catalogo.tasaCupFuente === "cambiocup";
  const fecha =
    viva && catalogo.tasaCupActualizadaEn
      ? fechaTexto(catalogo.tasaCupActualizadaEn)
      : null;

  if (variante === "destacada") {
    return (
      <div
        className={cn(
          "inline-flex max-w-full items-center gap-gap-sm rounded-2xl border border-ink/10 bg-white/80 px-4 py-2.5 text-left shadow-soft ring-1 ring-inset ring-white/70 backdrop-blur-sm",
          className,
        )}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-verde-50 text-verde-700 ring-1 ring-inset ring-verde-200/70">
          <Coins size={16} strokeWidth={1.9} aria-hidden />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-small leading-tight text-ink-soft/70">
            1 USD ={" "}
            <strong className="font-lv-display text-base font-semibold tabular-nums text-ink">
              {tasaTexto(catalogo.tasaCup)} CUP
            </strong>
          </span>
          <span className="mt-[2px] flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-meta leading-tight text-ink-soft/55">
            <span
              aria-hidden
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                viva ? "bg-verde-400" : "bg-amber-400",
              )}
            />
            <span>
              {viva ? "Tasa de QvaPay (CambioCUP)" : "Tasa de respaldo"}
              {fecha && ` · ${fecha}`}
            </span>
          </span>
        </span>
      </div>
    );
  }

  return (
    <p
      className={cn(
        "inline-flex flex-wrap items-center gap-x-gap-2xs gap-y-[2px] rounded-full border border-ink/10 bg-white/70 px-gap-sm py-[6px] text-meta text-ink-soft/75",
        className,
      )}
    >
      <Coins
        size={13}
        strokeWidth={1.8}
        className="shrink-0 text-verde-600"
        aria-hidden
      />
      <span>
        1 USD ={" "}
        <strong className="font-semibold text-ink">
          {tasaTexto(catalogo.tasaCup)} CUP
        </strong>
      </span>
      <span aria-hidden className="text-ink-soft/35">
        ·
      </span>
      <span>{viva ? "tasa de QvaPay (CambioCUP)" : "tasa de respaldo"}</span>
      {fecha && (
        <>
          <span aria-hidden className="text-ink-soft/35">
            ·
          </span>
          <span>{fecha}</span>
        </>
      )}
    </p>
  );
}
