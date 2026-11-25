import { forwardRef, type ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";
import {
  BOTON_ADMIN_BASE,
  BOTON_ADMIN_VARIANTE,
  BOTON_ICONO_ADMIN,
  TAMANO_BOTON_ADMIN,
  type TamanoBotonAdmin,
  type VarianteBotonAdmin,
} from "./clases";

/**
 * Los botones del panel de administración.
 *
 * No son `ui/button.tsx`: su variante por defecto pone texto blanco sobre el
 * verde del sistema (≈ 3.6:1) y sus colores no tienen versión oscura dentro del
 * panel. Estos usan las clases de `./clases.ts`, que sí.
 *
 * `className` se suma con `clsx`: sirve para colocar el botón, no para cambiar
 * su color.
 */
type Props = ButtonHTMLAttributes<HTMLButtonElement>;

export const BotonAdmin = forwardRef<
  HTMLButtonElement,
  Props & { variante?: VarianteBotonAdmin; tamano?: TamanoBotonAdmin }
>(function BotonAdmin(
  {
    variante = "secundario",
    tamano = "md",
    className,
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx(
        BOTON_ADMIN_BASE,
        BOTON_ADMIN_VARIANTE[variante],
        TAMANO_BOTON_ADMIN[tamano],
        className,
      )}
      {...props}
    />
  );
});

/** Solo icono: el `aria-label` es obligatorio, no hay texto que lo nombre. */
export const BotonIconoAdmin = forwardRef<
  HTMLButtonElement,
  Props & { "aria-label": string }
>(function BotonIconoAdmin({ className, type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx(BOTON_ICONO_ADMIN, className)}
      {...props}
    />
  );
});
