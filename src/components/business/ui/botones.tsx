import { forwardRef, type ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";
import {
  ALTO_BOTON,
  BOTON_ICONO,
  BOTON_PRIMARIO,
  BOTON_SECUNDARIO,
  BOTON_TEXTO,
  type AltoBoton,
} from "./clases";

/**
 * Los botones del panel del negocio.
 *
 * No son `ui/button.tsx`: su variante por defecto pone texto blanco sobre el
 * verde del sistema (≈ 3.6:1) y sus colores no tienen versión oscura dentro del
 * panel. Estos llevan las clases que el panel ya usaba, sacadas a
 * `./clases.ts`. `className` se **suma** (con `clsx`, sin `tailwind-merge`):
 * sirve para colocar el botón (`self-start`, `w-full`, `mt-*`), no para
 * cambiarle el color.
 */

type Props = ButtonHTMLAttributes<HTMLButtonElement>;

export const BotonPrimario = forwardRef<HTMLButtonElement, Props & { alto?: AltoBoton }>(
  function BotonPrimario({ alto = "md", className, type = "button", ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={clsx(BOTON_PRIMARIO, ALTO_BOTON[alto], className)}
        {...props}
      />
    );
  },
);

export const BotonSecundario = forwardRef<HTMLButtonElement, Props & { alto?: AltoBoton }>(
  function BotonSecundario({ alto = "md", className, type = "button", ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={clsx(BOTON_SECUNDARIO, ALTO_BOTON[alto], className)}
        {...props}
      />
    );
  },
);

export const BotonTexto = forwardRef<HTMLButtonElement, Props>(function BotonTexto(
  { className, type = "button", ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} className={clsx(BOTON_TEXTO, className)} {...props} />
  );
});

/** Solo icono: el `aria-label` es obligatorio, no hay texto que lo nombre. */
export const BotonIcono = forwardRef<HTMLButtonElement, Props & { "aria-label": string }>(
  function BotonIcono({ className, type = "button", ...props }, ref) {
    return (
      <button ref={ref} type={type} className={clsx(BOTON_ICONO, className)} {...props} />
    );
  },
);
