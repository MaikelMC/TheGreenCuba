"use client";

import { useId, type ReactNode } from "react";
import { Check } from "lucide-react";
import { clsx } from "clsx";

/**
 * La casilla de selección del panel.
 *
 * El `<input>` real sigue ahí —teclado, lectores de pantalla, formularios— pero
 * invisible; lo que se ve es un cuadrado de 20 px con el check. La etiqueta
 * envuelve todo y mide al menos 44 px de alto, que es lo que se toca en móvil.
 */
export function CasillaSeleccion({
  checked,
  onChange,
  children,
  disabled,
  className,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: ReactNode;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const id = useId();

  return (
    <label
      htmlFor={id}
      className={clsx(
        "inline-flex min-h-11 cursor-pointer select-none items-center gap-gap-xs",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={clsx(
          "grid size-5 shrink-0 place-items-center rounded-[6px] border border-ink/15 bg-white text-verde-950",
          "transition-colors duration-300 ease-outquint",
          "peer-checked:border-verde-500 peer-checked:bg-verde-400",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-verde-400/40 peer-focus-visible:ring-offset-2",
          "[&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100",
        )}
      >
        <Check size={14} strokeWidth={3} />
      </span>
      {children && <span className="text-small text-ink">{children}</span>}
    </label>
  );
}
