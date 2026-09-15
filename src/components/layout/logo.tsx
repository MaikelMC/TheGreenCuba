import Image from "next/image";

/**
 * Marca de La Verde: corazón con destello.
 *
 * Vive en `public/logo.png` — 256×267, con transparencia y ya a color. Antes
 * era un SVG monocromo que heredaba `currentColor` para poder meterse dentro
 * del círculo con degradado `verde-400 → verde-600`. Con el PNG esa corona
 * sobra: el verde del propio logo se embarullaba contra ella, así que ninguna
 * de las cuatro cabeceras la pinta ya.
 *
 * `width`/`height` solo dejan fijada la proporción del archivo; el tamaño real
 * lo pone la clase `h-*` de cada sitio, siempre con `w-auto` para no deformar
 * el dibujo.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt=""
      width={256}
      height={267}
      aria-hidden
      className={className}
    />
  );
}
