"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Stamp } from "lucide-react";

interface Resumen {
  token: string;
  sellos: number;
  meta: number;
  premio: string | null;
  /** ISO de cuándo se guardó esta copia. La píldora no la enseña: la tarjeta sí. */
  fecha?: string;
}

function leer(clave: string): Resumen | null {
  try {
    const crudo = window.localStorage.getItem(clave);
    if (!crudo) return null;
    const datos = JSON.parse(crudo) as Partial<Resumen>;
    if (
      typeof datos.token !== "string" ||
      typeof datos.sellos !== "number" ||
      typeof datos.meta !== "number"
    ) {
      return null;
    }
    return {
      token: datos.token,
      sellos: datos.sellos,
      meta: datos.meta,
      premio: typeof datos.premio === "string" ? datos.premio : null,
      fecha: typeof datos.fecha === "string" ? datos.fecha : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * La píldora «Llevas 4 de 5 sellos» de la carta.
 *
 * Solo aparece si este dispositivo abrió una vez la tarjeta del negocio: el
 * enlace de WhatsApp deja el token en `localStorage`. La píldora pinta lo
 * último que se guardó y pregunta al servidor al montar, para no enseñar un
 * saldo de antes del último pedido.
 *
 * Si el token ya no vale —cliente borrado, negocio sin la tarjeta— se olvida y
 * la píldora no se pinta.
 */
export function PildoraTarjeta({
  placeId,
  slug,
}: {
  placeId: string;
  slug: string;
}) {
  const clave = `la-verde:tarjeta:${placeId}`;
  const [resumen, setResumen] = useState<Resumen | null>(null);

  useEffect(() => {
    const guardado = leer(clave);
    if (!guardado) return;
    setResumen(guardado);

    const control = new AbortController();
    fetch(`/api/tarjeta/${encodeURIComponent(guardado.token)}`, {
      signal: control.signal,
      cache: "no-store",
    })
      .then((res) => {
        if (res.status === 404) {
          try {
            window.localStorage.removeItem(clave);
          } catch {
            /* Sin almacenamiento no hay nada que olvidar. */
          }
          setResumen(null);
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((datos: unknown) => {
        if (!datos || typeof datos !== "object") return;
        const d = datos as { sellos?: unknown; meta?: unknown; premio?: unknown };
        if (typeof d.sellos !== "number" || typeof d.meta !== "number") return;
        const fresco: Resumen = {
          token: guardado.token,
          sellos: d.sellos,
          meta: d.meta,
          premio: typeof d.premio === "string" ? d.premio : null,
          fecha: new Date().toISOString(),
        };
        setResumen(fresco);
        try {
          window.localStorage.setItem(clave, JSON.stringify(fresco));
        } catch {
          /* Si no cabe, la píldora de esta visita ya está pintada. */
        }
      })
      .catch(() => {
        /* Sin red se queda lo guardado: es mejor que nada. */
      });

    return () => control.abort();
  }, [clave]);

  if (!resumen) return null;

  return (
    <div className="mx-auto w-full max-w-[680px] px-gutter pt-gap-sm">
      <Link
        href={`/m/${slug}/tarjeta/${resumen.token}`}
        className="inline-flex max-w-full items-center gap-[6px] rounded-full border border-verde-200 bg-verde-50 py-[6px] pl-[10px] pr-gap-xs font-lv-display text-meta font-semibold text-verde-700 transition-colors duration-300 ease-outquint hover:border-verde-400 hover:bg-verde-100"
      >
        <Stamp size={13} strokeWidth={2} aria-hidden="true" />
        <span className="truncate">
          Llevas {resumen.sellos} de {resumen.meta} sellos
        </span>
        {resumen.premio && (
          <span className="hidden truncate text-verde-600/80 sm:inline">
            · {resumen.premio}
          </span>
        )}
        <ChevronRight size={13} strokeWidth={2} aria-hidden="true" />
      </Link>
    </div>
  );
}
