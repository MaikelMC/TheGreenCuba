import { cn } from "@/lib/utils";

/**
 * Las iniciales del negocio, para cuando no hay logo.
 *
 * Es el respaldo de la marca: sobre `color_marca` blanco, y sobre arena el verde
 * de la casa. No se pinta el icono de la categoría en el círculo porque el
 * icono ya está en la portada y en el chip de categoría; las iniciales dicen
 * «este negocio», que es lo que el logo diría.
 */
export function inicialesDe(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = palabras
    .slice(0, 2)
    .map((palabra) => palabra[0]?.toUpperCase() ?? "")
    .join("");
  return letras || "?";
}

export function Monograma({
  nombre,
  colorMarca,
  className,
}: {
  nombre: string;
  colorMarca?: string | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={
        colorMarca ? { backgroundColor: colorMarca, color: "#fff" } : undefined
      }
      className={cn(
        "grid shrink-0 place-items-center rounded-full border font-lv-display font-bold tracking-[-0.02em]",
        colorMarca
          ? "border-black/10"
          : "border-verde-200 bg-verde-50 text-verde-700",
        className,
      )}
    >
      {inicialesDe(nombre)}
    </span>
  );
}
