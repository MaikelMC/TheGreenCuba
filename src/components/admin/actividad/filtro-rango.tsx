"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { RangoActividad } from "@/lib/admin-actividad";
import { ControlSegmentado } from "@/components/admin/ui/segmentado";

const OPCIONES: { valor: RangoActividad; etiqueta: string }[] = [
  { valor: "24h", etiqueta: "24 h" },
  { valor: "7d", etiqueta: "7 días" },
  { valor: "todo", etiqueta: "Todo" },
];

const SELECT =
  "h-11 max-w-full rounded-xl border border-ink/10 bg-white px-3 text-meta font-medium text-ink outline-none focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";

/**
 * Rango, administrador y tipo de acción viven en la URL. Así el atrás devuelve
 * al filtro anterior y el enlace se puede compartir con el otro administrador.
 */
export function FiltrosActividad({
  admins,
  acciones,
}: {
  admins: { id: string | null; nombre: string }[];
  acciones: { valor: string; etiqueta: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const crudo = searchParams.get("rango");
  const rango: RangoActividad =
    crudo === "7d" || crudo === "todo" ? crudo : "24h";

  function cambiar(clave: string, valor: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (valor) next.set(clave, valor);
    else next.delete(clave);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-gap-xs">
      <ControlSegmentado
        etiqueta="Rango de actividad"
        opciones={OPCIONES}
        valor={rango}
        onCambio={(valor) => cambiar("rango", valor)}
      />
      <select
        aria-label="Filtrar por administrador"
        value={searchParams.get("admin") ?? ""}
        onChange={(event) => cambiar("admin", event.target.value)}
        className={SELECT}
      >
        <option value="">Todos los admins</option>
        {admins.map((admin) => (
          <option key={admin.id ?? admin.nombre} value={admin.id ?? ""}>
            {admin.nombre}
          </option>
        ))}
      </select>
      <select
        aria-label="Filtrar por tipo de acción"
        value={searchParams.get("accion") ?? ""}
        onChange={(event) => cambiar("accion", event.target.value)}
        className={SELECT}
      >
        <option value="">Todas las acciones</option>
        {acciones.map((accion) => (
          <option key={accion.valor} value={accion.valor}>
            {accion.etiqueta}
          </option>
        ))}
      </select>
    </div>
  );
}
