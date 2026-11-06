"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingState } from "@/components/ui/loading";

interface PackSolicitud {
  id: string;
  negocioId: string;
  negocioNombre: string;
  estado: string;
  serviciosSolicitados: string[];
  creadoEn: string;
  actualizadoEn: string;
}

const ESTADO_LABEL: Record<string, string> = {
  solicitado: "Solicitado",
  borrador: "Borrador",
  enviado: "Enviado",
};

const ESTADO_CLASE: Record<string, string> = {
  solicitado: "border-amber-200 bg-amber-50 text-amber-700",
  borrador: "border-blue-200 bg-blue-50 text-blue-700",
  enviado: "border-verde-200 bg-verde-50 text-verde-700",
};

const PILDORA =
  "inline-flex shrink-0 items-center rounded-full border px-[9px] py-[3px] font-lv-display text-[10px] font-extrabold uppercase tracking-[0.09em]";

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Lista de packs a medida en tramitación, para administración.
 *
 * Carga la cola pendiente (solicitado|borrador|enviado) de todos los negocios
 * y muestra un enlace a la página de edición de cada negocio.
 */
export function PackMedidaSolicitudes() {
  const [packs, setPacks] = useState<PackSolicitud[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/packs-medida")
      .then((r) => r.json())
      .then((d: { packs?: PackSolicitud[]; error?: string }) => {
        if (d.packs) setPacks(d.packs);
        else setError(d.error ?? "Error inesperado");
      })
      .catch(() => setError("No se pudo cargar la cola."));
  }, []);

  if (packs === null && !error) return <LoadingState className="py-20" />;

  if (error) {
    return (
      <p className="py-10 text-center text-small text-ink-soft/75">{error}</p>
    );
  }

  if (packs!.length === 0) {
    return (
      <div className="flex flex-col items-center gap-gap-sm py-20 text-center">
        <Package size={40} className="text-ink-soft/30" strokeWidth={1.3} />
        <p className="text-body font-semibold text-ink">Sin solicitudes</p>
        <p className="text-small text-ink-soft/60">
          No hay packs en tramitación ahora mismo.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-ink/5">
      {packs!.map((pack) => (
        <li key={pack.id}>
          <Link
            href={`/admin/negocios/${pack.negocioId}/editar`}
            className="flex flex-wrap items-start justify-between gap-gap-sm px-gap-sm py-gap-md transition-colors hover:bg-sand"
          >
            <div className="flex flex-col gap-gap-2xs">
              <div className="flex flex-wrap items-center gap-gap-xs">
                <span className="font-lv-display text-body font-semibold text-ink">
                  {pack.negocioNombre}
                </span>
                <span className={cn(PILDORA, ESTADO_CLASE[pack.estado] ?? "border-ink/10 bg-sand text-ink-soft/75")}>
                  {ESTADO_LABEL[pack.estado] ?? pack.estado}
                </span>
              </div>
              {pack.serviciosSolicitados.length > 0 && (
                <p className="text-meta text-ink-soft/60">
                  Pide: {pack.serviciosSolicitados.join(", ")}
                </p>
              )}
            </div>
            <span className="flex shrink-0 items-center gap-[4px] text-meta text-ink-soft/60">
              <Clock size={12} strokeWidth={1.8} />
              {fecha(pack.creadoEn)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
