"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODULOS, type ClaveModulo } from "@/lib/plans";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const CLAVES = Object.keys(MODULOS) as ClaveModulo[];

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
export function ServicesPicker() {
  const [abierto, setAbierto] = useState(false);
  const [elegidos, setElegidos] = useState<ClaveModulo[]>([]);

  function alternar(clave: ClaveModulo) {
    setElegidos((prev) =>
      prev.includes(clave) ? prev.filter((c) => c !== clave) : [...prev, clave],
    );
  }

  const total = elegidos.reduce((suma, clave) => suma + MODULOS[clave].usd, 0);
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

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Arma tu plan</DialogTitle>
          <DialogDescription>
            Se contratan por separado y se pagan al mes. Puedes cambiar la
            elección cuando quieras.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto">
          {CLAVES.map((clave) => {
            const modulo = MODULOS[clave];
            const activo = elegidos.includes(clave);
            return (
              <label
                key={clave}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-colors duration-300 focus-within:ring-2 focus-within:ring-verde-400/40",
                  activo
                    ? "border-verde-400 bg-verde-50/70"
                    : "border-ink/10 hover:border-ink/25",
                )}
              >
                <input
                  type="checkbox"
                  checked={activo}
                  onChange={() => alternar(clave)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-colors duration-300",
                    activo
                      ? "border-verde-500 bg-verde-400 text-verde-950"
                      : "border-ink/20 bg-white",
                  )}
                >
                  {activo && <Check size={13} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-lv-display text-sm font-semibold text-ink">
                      {modulo.nombre}
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-ink">
                      {precioUsd(modulo.usd)} USD/mes
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-ink-soft/75">
                    {modulo.lema}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 border-t border-ink/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-soft/75" aria-live="polite">
            {elegidos.length === 0
              ? "Elige al menos un servicio."
              : `${elegidos.length} ${elegidos.length === 1 ? "servicio" : "servicios"} · ${precioUsd(total)} USD/mes`}
          </p>
          {elegidos.length === 0 ? (
            <span className="inline-flex cursor-not-allowed items-center justify-center rounded-full bg-verde-400/40 px-5 py-3 text-sm font-semibold text-verde-950/60">
              Continuar
            </span>
          ) : (
            <Link
              href={href}
              className="inline-flex items-center justify-center rounded-full bg-verde-400 px-5 py-3 text-sm font-semibold text-verde-950 transition duration-300 ease-outquint hover:bg-verde-300 active:scale-[0.98]"
            >
              Continuar con {elegidos.length === 1 ? "1 servicio" : `${elegidos.length} servicios`}
            </Link>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
