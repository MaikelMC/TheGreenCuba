"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Un negocio que se puede abrir en el panel.
 *
 * `esPrueba` distingue el negocio de prueba de los reales. No es decoración: el
 * fixture no está en `places` y sus datos no son de nadie, así que confundirlo
 * con un negocio propio al editar sería escribir en la ficha equivocada.
 */
export interface NegocioPanel {
  id: string;
  nombre: string;
  esPrueba: boolean;
}

/**
 * El selector de negocio del panel.
 *
 * Existe porque una misma cuenta puede tener más de uno abierto: el negocio que
 * reclama en `business_owners` y el negocio de prueba, que no vive en la tabla
 * pero cuenta como suyo para quien puede verlo. Antes el panel resolvía
 * `ownId ?? fixture` y elegía uno para siempre — quien tenía negocio propio se
 * quedaba sin ver el de prueba, sin manera de llegar a él.
 *
 * Con **uno solo** devuelve `null`: un selector de una opción no se elige, solo
 * ocupa sitio.
 *
 * La elección viaja en `?negocio=`, no en un estado de React, por dos motivos:
 * sobrevive al `router.refresh()` que disparan los guardados y el cambio de
 * plan, y deja el negocio señalado en un marcador o en un enlace que se comparte.
 */
export function BusinessSwitcher({
  negocios,
  seleccionado,
}: {
  negocios: NegocioPanel[];
  /** El `id` del negocio que se está enseñando ahora. */
  seleccionado: string;
}) {
  if (negocios.length < 2) return null;

  return (
    <div className="mb-gap-lg">
      <p className="mb-gap-xs font-lv-display text-meta font-semibold uppercase tracking-[0.1em] text-ink-soft/75">
        Estás en
      </p>
      <div className="flex flex-wrap gap-gap-xs">
        {negocios.map((negocio) => {
          const activo = negocio.id === seleccionado;
          return (
            <Link
              key={negocio.id}
              href={`/business?negocio=${encodeURIComponent(negocio.id)}`}
              aria-current={activo ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-gap-xs rounded-full border px-gap-md py-[8px] font-lv-display text-small transition-colors duration-500 ease-outquint",
                activo
                  ? "border-verde-300 bg-verde-50 font-semibold text-verde-700"
                  : "border-ink/10 bg-white text-ink-soft/75 hover:border-verde-300 hover:text-verde-700",
              )}
            >
              {activo && <Check size={14} strokeWidth={2.4} />}
              {negocio.nombre}
              {negocio.esPrueba && (
                <span className="rounded-full bg-ink/5 px-[7px] py-[2px] text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-soft/75">
                  Prueba
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
