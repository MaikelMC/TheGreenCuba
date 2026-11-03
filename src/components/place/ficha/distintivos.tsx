import { etiquetaAtributo, iconoAtributo } from "@/lib/ficha/atributos";
import type { EnergiaRespaldo } from "@/lib/energia";
import { cn } from "@/lib/utils";
import { EnergiaBadge } from "../energia-badge";
import { SelloVerificado } from "../sello-verificado";
import { TopDelMes } from "../top-del-mes";
import { iconoDeAtributo } from "./iconos-atributos";

/**
 * La fila de distintivos: atributos del catálogo, planta eléctrica, sello y top.
 *
 * Todo sale de datos que el dueño eligió o que la administración verificó. La
 * planta no se repite como atributo porque se deriva de `energia_respaldo`; si
 * se pudiera marcar aparte habría dos verdades que podrían contradecirse. Sin
 * ningún distintivo no se pinta la fila, ni siquiera vacía.
 */
export function Distintivos({
  atributos,
  energiaRespaldo,
  notaApagon,
  selloVerificado,
  topDelMes,
  className,
}: {
  atributos: string[];
  energiaRespaldo?: EnergiaRespaldo | null;
  notaApagon?: string;
  selloVerificado?: boolean;
  topDelMes?: boolean;
  className?: string;
}) {
  const items = atributos
    .map((clave) => {
      const label = etiquetaAtributo(clave);
      if (!label) return null;
      return { clave, label, Icono: iconoDeAtributo(iconoAtributo(clave)) };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const vacio =
    items.length === 0 && !energiaRespaldo && !selloVerificado && !topDelMes;
  if (vacio) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-[6px]", className)}>
      {items.map(({ clave, label, Icono }) => (
        <span
          key={clave}
          className="inline-flex items-center gap-[4px] rounded-full border border-ink/10 bg-white px-[10px] py-[3px] font-lv-display text-xs font-semibold uppercase tracking-[0.05em] text-ink"
        >
          {Icono && (
            <Icono
              size={12}
              strokeWidth={2}
              className="shrink-0 text-verde-600"
            />
          )}
          {label}
        </span>
      ))}

      {/* `EnergiaBadge` ya se calla cuando no hay nada que anunciar. */}
      <EnergiaBadge energia={energiaRespaldo} nota={notaApagon} />

      {selloVerificado && <SelloVerificado />}
      {topDelMes && <TopDelMes />}
    </div>
  );
}
