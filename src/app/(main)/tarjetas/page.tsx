"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/loading";

const PREFIJO = "la-verde:tarjeta:";

interface TarjetaGuardada {
  token: string;
  nombre: string;
  slug: string;
  sellos: number;
  meta: number;
  premio: string | null;
}

/**
 * Las tarjetas de cliente frecuente que este dispositivo abrió alguna vez.
 *
 * El token vive en `localStorage` (`la-verde:tarjeta:<placeId>`), que es lo que
 * deja el enlace de WhatsApp. La página pide cada tarjeta al servidor porque el
 * resumen local no guarda el nombre del negocio; si el token ya no vale, la
 * fila desaparece y se olvida la clave.
 *
 * Es pública **a propósito**. No expone datos de otras cuentas: solo lee los
 * tokens de este navegador y consulta la API que ya es pública por token. Cerrar
 * sesión no borra esas claves porque el token es la única credencial de la
 * tarjeta: quien vuelve a entrar en el mismo equipo tiene que seguir viéndola.
 * Quien comparte un dispositivo puede ver los sellos de la última persona; es
 * el mismo compromiso que acepta el enlace de WhatsApp, y se resuelve borrando
 * los datos del navegador, no ocultando la página.
 */
export default function TarjetasPage() {
  const [tarjetas, setTarjetas] = useState<TarjetaGuardada[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let vivo = true;

    async function cargar() {
      const claves: string[] = [];
      try {
        for (let i = 0; i < window.localStorage.length; i += 1) {
          const clave = window.localStorage.key(i);
          if (clave?.startsWith(PREFIJO)) claves.push(clave);
        }
      } catch {
        if (vivo) setCargando(false);
        return;
      }

      const resultados = await Promise.all(
        claves.map(async (clave) => {
          let token = "";
          try {
            const guardado = JSON.parse(
              window.localStorage.getItem(clave) ?? "{}",
            ) as { token?: unknown };
            token = typeof guardado.token === "string" ? guardado.token : "";
          } catch {
            /* Clave ilegible: se olvida abajo. */
          }
          if (!token) {
            try {
              window.localStorage.removeItem(clave);
            } catch {
              /* Sin almacenamiento no hay nada que limpiar. */
            }
            return null;
          }

          try {
            const respuesta = await fetch(
              `/api/tarjeta/${encodeURIComponent(token)}`,
              { signal: controller.signal },
            );
            if (!respuesta.ok) {
              try {
                window.localStorage.removeItem(clave);
              } catch {
                /* nada */
              }
              return null;
            }
            const datos = (await respuesta.json()) as {
              negocio?: { nombre?: string; slug?: string };
              tarjeta?: {
                sellos?: number;
                metaFinal?: { sellos?: number };
                listas?: { premio?: string }[];
              };
            };
            const nombre = datos.negocio?.nombre?.trim();
            const slug = datos.negocio?.slug?.trim();
            if (!nombre || !slug) return null;
            return {
              token,
              nombre,
              slug,
              sellos: datos.tarjeta?.sellos ?? 0,
              meta: datos.tarjeta?.metaFinal?.sellos ?? 0,
              premio: datos.tarjeta?.listas?.[0]?.premio ?? null,
            } satisfies TarjetaGuardada;
          } catch {
            return null;
          }
        }),
      );

      if (!vivo) return;
      setTarjetas(
        resultados.filter((item): item is TarjetaGuardada => item !== null),
      );
      setCargando(false);
    }

    void cargar();
    return () => {
      vivo = false;
      controller.abort();
    };
  }, []);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-2xl px-gutter pb-gutter pt-gap-lg font-lv text-ink lg:px-gutter-lg">
      <div className="mb-gap-md">
        <p className="lv-mono text-[11px] uppercase tracking-[0.2em] text-verde-700">
          Lo mío
        </p>
        <h1 className="mt-1 font-lv-display text-h2 font-bold tracking-[-0.03em]">
          Mis tarjetas
        </h1>
        <p className="mt-2 max-w-[55ch] text-body leading-relaxed text-ink-soft/75">
          Las tarjetas de cliente frecuente que abriste desde el enlace de un
          negocio en este dispositivo.
        </p>
      </div>

      {cargando ? (
        <div className="flex flex-col gap-gap-xs" aria-busy="true">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-[92px] rounded-2xl" />
          ))}
        </div>
      ) : tarjetas.length === 0 ? (
        <div className="rounded-2xl border border-ink/5 bg-white px-gap-md py-10 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-verde-50 text-verde-700">
            <CreditCard size={22} strokeWidth={1.8} aria-hidden />
          </span>
          <p className="mt-gap-sm font-lv-display text-small font-semibold text-ink">
            Todavía no tienes tarjetas aquí
          </p>
          <p className="mx-auto mt-1 max-w-[46ch] text-meta leading-relaxed text-ink-soft/75">
            Abre el enlace de WhatsApp de un negocio que tenga tarjeta de
            cliente frecuente y aparecerá en esta lista.
          </p>
          <Link
            href="/home"
            className="mt-gap-sm inline-flex min-h-11 items-center justify-center rounded-full bg-verde-400 px-5 font-lv-display text-small font-semibold text-verde-950 transition-colors duration-300 hover:bg-verde-300"
          >
            Explorar el mapa
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-gap-xs">
          {tarjetas.map((tarjeta) => (
            <li key={tarjeta.token}>
              <Link
                href={`/m/${tarjeta.slug}/tarjeta/${tarjeta.token}`}
                className="flex min-h-[92px] items-center gap-gap-sm rounded-2xl border border-ink/5 bg-white p-3 transition-colors duration-300 hover:border-verde-300 hover:bg-verde-50"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-50 text-verde-700">
                  <CreditCard size={22} strokeWidth={1.8} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-lv-display text-small font-semibold text-ink">
                    {tarjeta.nombre}
                  </span>
                  <span className="mt-[2px] block text-meta text-ink-soft/75">
                    {tarjeta.sellos} de {tarjeta.meta} sellos
                    {tarjeta.premio ? ` · ${tarjeta.premio}` : ""}
                  </span>
                </span>
                <ArrowRight
                  size={17}
                  strokeWidth={1.8}
                  aria-hidden
                  className="shrink-0 text-verde-700"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
