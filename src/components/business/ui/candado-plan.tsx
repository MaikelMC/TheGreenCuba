import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { BotonPrimario } from "./botones";

/**
 * Lo que se pinta cuando una función no entra en el plan: «Ver los planes» y
 * una línea que dice qué se pierde.
 *
 * El texto de qué lo abre (`bloqueoDe`) va en la `Chapita` de la cabecera de la
 * tarjeta; aquí va la salida. `onVerPlanes` ya decide a quién se le dice qué:
 * al dueño lo lleva a «Planes» y a un trabajador le explica con un aviso que
 * eso lo gestiona el dueño (`business-panel.tsx`). Sin `onVerPlanes` no se
 * pinta el botón: un botón que no lleva a ningún sitio es peor que ninguno.
 */
export function CandadoPlan({
  onVerPlanes,
  texto,
  iconoEnBoton = false,
  candadoEnTexto = false,
}: {
  onVerPlanes?: () => void;
  texto: ReactNode;
  /** Candado dentro del botón, delante de «Ver los planes». */
  iconoEnBoton?: boolean;
  /** Candado delante del texto, cuando el texto es el propio `bloqueoDe`. */
  candadoEnTexto?: boolean;
}) {
  return (
    <div className="mt-gap-md flex flex-wrap items-center gap-gap-sm">
      {onVerPlanes && (
        <BotonPrimario onClick={onVerPlanes}>
          {iconoEnBoton && <Lock size={15} strokeWidth={1.8} />}
          Ver los planes
        </BotonPrimario>
      )}
      {candadoEnTexto ? (
        <p className="inline-flex items-center gap-[6px] text-meta text-ink-soft/75">
          <Lock size={13} strokeWidth={2} className="shrink-0" aria-hidden />
          {texto}
        </p>
      ) : (
        <p className="text-meta text-ink-soft/75">{texto}</p>
      )}
    </div>
  );
}
