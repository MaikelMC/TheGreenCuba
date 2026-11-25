import type { ReactNode } from "react";
import { clsx } from "clsx";
import {
  CHAPITA_ADMIN,
  PUNTO_CHAPITA_ADMIN,
  TONO_CHAPITA_ADMIN,
  type TonoChapitaAdmin,
} from "./clases";

/**
 * Chapita de estado del panel: ok, aviso, error, info o neutra.
 *
 * Lleva un punto de color además del texto para que el estado no dependa solo
 * del tono —y para quien no distingue colores siga leyendo la palabra—.
 */
export function ChapitaEstado({
  tono,
  children,
  className,
  punto = true,
}: {
  tono: TonoChapitaAdmin;
  children: ReactNode;
  className?: string;
  punto?: boolean;
}) {
  return (
    <span className={clsx(CHAPITA_ADMIN, TONO_CHAPITA_ADMIN[tono], className)}>
      {punto && (
        <span
          aria-hidden
          className={clsx(
            "size-[6px] shrink-0 rounded-full",
            PUNTO_CHAPITA_ADMIN[tono],
          )}
        />
      )}
      {children}
    </span>
  );
}
