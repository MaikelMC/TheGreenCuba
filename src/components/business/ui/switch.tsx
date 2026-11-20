import { clsx } from "clsx";

/**
 * El interruptor del panel. Uno solo: había cinco copias, con tres tamaños,
 * dos verdes, tres sombras y uno que no se podía alcanzar con el teclado (un
 * `<span>` con `role="switch"`).
 *
 * Dos tamaños, los que ya existían:
 * - `md` (48 × 28): el de las tarjetas de ajustes.
 * - `sm` (44 × 24): el de las filas dentro de un formulario.
 * En los dos el área tocable llega a 44 px de alto con un pseudoelemento, sin
 * engordar el dibujo.
 *
 * El pulgar lleva `panel-switch-thumb`: es blanco en los dos temas (el track
 * cambia de color, no el pulgar, como en iOS). Sin esa clase, el override
 * oscuro de `.bg-white` dentro del panel lo pintaba del color del fondo y
 * desaparecía.
 */
export function Switch({
  checked,
  onToggle,
  label,
  labelledBy,
  describedBy,
  disabled,
  tamano = "md",
  id,
}: {
  checked: boolean;
  onToggle: () => void;
  /** Nombre accesible. Si la fila ya tiene un título con id, usa `labelledBy`. */
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  disabled?: boolean;
  tamano?: "md" | "sm";
  id?: string;
}) {
  const md = tamano === "md";
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={onToggle}
      className={clsx(
        "relative shrink-0 cursor-pointer rounded-full transition-colors ease-outquint motion-reduce:transition-none after:absolute after:inset-x-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40 disabled:pointer-events-none disabled:opacity-50",
        md
          ? "h-[28px] w-[48px] border-none p-0 duration-500 after:-inset-y-2"
          : "inline-flex h-6 w-11 items-center border-2 border-transparent duration-300 after:-inset-y-[10px]",
        checked ? "bg-verde-400" : md ? "bg-ink/10" : "bg-ink/15",
      )}
    >
      <span
        aria-hidden
        className={clsx(
          "panel-switch-thumb pointer-events-none rounded-full bg-white transition-transform ease-outquint motion-reduce:transition-none",
          md
            ? "absolute left-[3px] top-[3px] size-[22px] shadow-soft duration-500"
            : "block size-5 shadow-md duration-300",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}
