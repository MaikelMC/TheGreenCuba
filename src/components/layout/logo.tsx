/**
 * Marca de La Verde: pin de mapa con una hoja dentro.
 *
 * Es el logo que usa el sitio de La Verde en el repo Landing_LaVerde (antes
 * DemaDeploy, `historias/assets/logo.svg` y la barra de navegación).
 *
 * Monocromo a propósito: en la app la marca siempre va dentro de un cuadrado
 * accent o sobre el degradado del splash. Los verdes propios del logo original
 * desaparecerían sobre esos fondos, así que hereda el color con `currentColor`.
 */

// Cuerpo del pin.
const PIN = "M32 3C20.4 3 11 12.4 11 24c0 17.4 21 36.4 21 36.4S53 41.4 53 24C53 12.4 43.6 3 32 3Z";
// Hoja interior. Va al 45% para que se lea sobre el pin blanco a tamaños
// pequeños, donde un hueco calado se cerraría y embarraría la silueta.
const LEAF = "M32 20.6c-5.6 4.4-8.6 8.6-8.6 14a8.6 8.6 0 0 0 17.2 0c0-5.4-3-9.6-8.6-14Z";

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      <path d={PIN} fill="currentColor" />
      <path d={LEAF} fill="currentColor" opacity="0.45" />
    </svg>
  );
}
