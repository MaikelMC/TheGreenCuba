"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { textoCup, type Catalogo, type ClaveModulo } from "@/lib/plans";

const MODULO_A_SERVICIO: Partial<Record<ClaveModulo, string>> = {
  menu_pro: "carta-y-qr",
  pedidos_reservas: "flujo-atencion-pedidos",
  pedidos_programados: "pedidos-programados",
  cliente_frecuente: "cliente-frecuente",
};
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** «3,5» en vez de «3.5», igual que en las tarjetas de plan. */
function precioUsd(usd: number) {
  return usd % 1 === 0 ? String(usd) : usd.toFixed(1).replace(".", ",");
}

/**
 * «¿Solo necesitas una cosa?»: la llamada de la portada para armar un plan con
 * los servicios sueltos.
 *
 * No cobra aquí: la elección viaja en la URL hasta el alta y el onboarding la
 * arrastra a la sección de planes, que es donde se paga. Así el servicio
 * elegido en la portada sigue marcado después de registrarse, con el mismo
 * camino que un pack.
 */
export function ServicesPicker({ catalogo }: { catalogo: Catalogo }) {
  const [abierto, setAbierto] = useState(false);
  const [elegidos, setElegidos] = useState<ClaveModulo[]>([]);
  const claves = Object.keys(catalogo.modulos) as ClaveModulo[];

  function alternar(clave: ClaveModulo) {
    setElegidos((prev) =>
      prev.includes(clave) ? prev.filter((c) => c !== clave) : [...prev, clave],
    );
  }

  const total = elegidos.reduce(
    (suma, clave) => suma + catalogo.modulos[clave].usd,
    0,
  );
  const href = `/register?next=${encodeURIComponent(
    `/onboarding?modulos=${elegidos.join(",")}`,
  )}`;

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <div className="mt-4 flex flex-col gap-4 rounded-3xl border border-dashed border-ink/15 bg-sand/40 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div>
          <p className="font-lv-display text-lg font-bold tracking-[-0.02em] text-ink">
            ¿Solo necesitas una cosa?
          </p>
          <p className="mt-1 text-sm text-ink-soft/75">
            Arma tu plan con los servicios que de verdad uses, uno a uno.
          </p>
        </div>
        <DialogTrigger asChild>
          <button
            type="button"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-ink/15 px-5 py-3 text-sm font-semibold text-ink transition duration-300 ease-outquint hover:border-ink/30 hover:bg-white active:scale-[0.98]"
          >
            <SlidersHorizontal size={15} strokeWidth={2.2} aria-hidden />
            Elegir servicios
          </button>
        </DialogTrigger>
      </div>

      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-h-[85dvh]">
        <DialogHeader className="shrink-0 px-6 pb-4 pt-6">
          <DialogTitle className="font-lv-display text-xl font-bold tracking-[-0.02em]">
            Arma tu plan
          </DialogTitle>
          <DialogDescription className="text-sm text-ink-soft/75">
            Elige solo lo que necesitas. Pagas por mes y cambias cuando quieras.
          </DialogDescription>
        </DialogHeader>

        {/* Lista con scroll, con fade inferior para indicar que hay más */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div className="flex h-full flex-col gap-2 overflow-y-auto touch-pan-y px-6 pb-2">
            {claves.map((clave) => {
              const modulo = catalogo.modulos[clave];
              const activo = elegidos.includes(clave);
              return (
                <label
                  key={clave}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all duration-200 ease-outquint focus-within:ring-2 focus-within:ring-verde-400/40 active:scale-[0.99]",
                    activo
                      ? "border-verde-400 bg-verde-50 shadow-sm shadow-verde-200/60"
                      : "border-ink/10 bg-white hover:border-ink/25 hover:bg-sand/30",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={activo}
                    onChange={() => alternar(clave)}
                    className="sr-only"
                  />
                  {/* Checkbox visual */}
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition-all duration-200",
                      activo
                        ? "border-verde-500 bg-verde-400 text-verde-950"
                        : "border-ink/20 bg-white",
                    )}
                  >
                    {activo && <Check size={12} strokeWidth={3.5} />}
                  </span>

                  <span className="min-w-0 flex-1">
                    {/* Nombre + precio: precio prominente */}
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-lv-display text-sm font-bold leading-snug text-ink">
                        {modulo.nombre}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-bold text-ink">
                          {precioUsd(modulo.usd)}{" "}
                          <span className="text-xs font-semibold text-ink-soft">USD</span>
                        </span>
                        <span className="block text-[10px] leading-tight text-ink-soft/60">
                          /mes
                        </span>
                      </span>
                    </span>

                    <span className="mt-1 block text-xs leading-snug text-ink-soft/70">
                      {modulo.lema}
                    </span>

                    <div className="mt-1.5 flex items-center gap-3">
                      <span className="text-[11px] text-ink-soft/50">
                        {textoCup(modulo.usd, catalogo)} / mes
                      </span>
                      {MODULO_A_SERVICIO[clave] && (
                        <Link
                          href={`/servicios/${MODULO_A_SERVICIO[clave]}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-0.5 text-[11px] font-medium text-verde-600 hover:text-verde-700"
                        >
                          Ver cómo funciona
                          <ArrowUpRight size={11} strokeWidth={2.5} />
                        </Link>
                      )}
                    </div>
                  </span>
                </label>
              );
            })}
            {/* Espacio para que el último ítem no quede pegado al fade */}
            <div className="h-2 shrink-0" />
          </div>
          {/* Fade inferior */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white/80 to-transparent" />
        </div>

        {/* Footer pegado */}
        <div className="shrink-0 border-t border-ink/10 px-6 pb-6 pt-4">
          {elegidos.length > 0 && (
            <div className="mb-3 flex items-baseline justify-between">
              <p className="text-sm text-ink-soft/75" aria-live="polite">
                {elegidos.length === 1 ? "1 servicio" : `${elegidos.length} servicios`}
              </p>
              <p className="font-lv-display text-base font-bold text-ink">
                {precioUsd(total)}{" "}
                <span className="text-sm font-semibold text-ink-soft">USD/mes</span>
              </p>
            </div>
          )}

          {elegidos.length === 0 ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-ink-soft/60" aria-live="polite">
                Elige al menos un servicio.
              </p>
              <span className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-full bg-ink/8 px-5 py-3 text-sm font-semibold text-ink-soft/50 opacity-60">
                Continuar
                <ArrowRight size={15} strokeWidth={2.2} aria-hidden />
              </span>
            </div>
          ) : (
            <Link
              href={href}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-verde-400 px-5 py-3.5 text-sm font-semibold text-verde-950 transition duration-300 ease-outquint hover:bg-verde-300 active:scale-[0.98]"
            >
              Continuar con {elegidos.length === 1 ? "1 servicio" : `${elegidos.length} servicios`}
              <ArrowRight size={15} strokeWidth={2.5} aria-hidden />
            </Link>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
