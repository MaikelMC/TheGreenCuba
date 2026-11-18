"use client";

import { useEffect, useState } from "react";
import type { MonedaVista } from "@/lib/precios";
import { etiquetaPago } from "@/lib/ficha/pagos";
import { cn, currencyStyles } from "@/lib/utils";

const CHAPITA =
  "inline-flex items-center gap-[5px] rounded-full px-[10px] py-[3px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.10em] ring-1 ring-inset";

/**
 * Las chapitas «Acepta …» de la carta online. Las de las monedas con tasa son
 * botones: escriben `data-moneda` en `<html>` y el CSS enseña los precios que
 * `PrecioMonedas` dejó pintados para esa moneda. Tocar otra vez la quita.
 *
 * El atributo se borra al desmontar: si no, al volver a la carta desde otra
 * página los precios saldrían convertidos con la chapita sin marcar.
 */
export function SelectorMonedas({
  payments,
  convertibles,
}: {
  payments: string[];
  convertibles: MonedaVista[];
}) {
  const [moneda, setMoneda] = useState<MonedaVista | null>(null);

  useEffect(() => {
    const html = document.documentElement;
    if (moneda) html.dataset.moneda = moneda;
    else delete html.dataset.moneda;
    return () => {
      delete html.dataset.moneda;
    };
  }, [moneda]);

  return (
    <>
      {payments.map((c) => {
        const estilo = currencyStyles[c] ?? "bg-sand-deep text-ink-soft ring-ink/10";
        const contenido = (
          <>
            <span
              aria-hidden
              className="size-[5px] shrink-0 rounded-full bg-current opacity-60"
            />
            {etiquetaPago(c)}
          </>
        );
        const m = convertibles.find((x) => x === c);
        if (!m) {
          return (
            <span key={c} className={cn(CHAPITA, estilo)}>
              {contenido}
            </span>
          );
        }
        const activa = moneda === m;
        return (
          <button
            key={c}
            type="button"
            aria-pressed={activa}
            onClick={() => setMoneda(activa ? null : m)}
            className={cn(
              CHAPITA,
              "cursor-pointer transition duration-500 ease-outquint active:scale-[0.98]",
              activa ? "bg-verde-400 text-verde-950 ring-verde-400" : estilo,
            )}
          >
            {contenido}
          </button>
        );
      })}
      {convertibles.length > 0 && (
        <span className="basis-full text-meta text-ink-soft/75">
          {moneda
            ? "Precios con la tasa del negocio. Toca otra vez para volver."
            : "Toca una moneda para ver los precios en ella."}
        </span>
      )}
    </>
  );
}
