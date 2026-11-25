"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { RangoActividad } from "@/lib/admin-actividad";
import { ControlSegmentado } from "@/components/admin/ui/segmentado";

const OPCIONES: { valor: RangoActividad; etiqueta: string }[] = [
  { valor: "24h", etiqueta: "24 h" },
  { valor: "7d", etiqueta: "7 días" },
  { valor: "todo", etiqueta: "Todo" },
];

/**
 * El rango vive en la URL (`?rango=`), así que el atrás del navegador devuelve
 * al filtro anterior y el enlace se puede compartir con el otro administrador.
 */
export function FiltroRangoActividad() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const crudo = searchParams.get("rango");
  const actual: RangoActividad =
    crudo === "7d" || crudo === "todo" ? crudo : "24h";

  return (
    <ControlSegmentado
      etiqueta="Rango de actividad"
      opciones={OPCIONES}
      valor={actual}
      onCambio={(valor) => {
        const next = new URLSearchParams(searchParams.toString());
        next.set("rango", valor);
        router.push(`${pathname}?${next.toString()}`, { scroll: false });
      }}
    />
  );
}
