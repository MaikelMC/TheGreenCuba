/**
 * Bandera de activación de la PWA.
 *
 * `NEXT_PUBLIC_*` se incrusta en el bundle en tiempo de build, así que cambiarla
 * en Vercel exige un despliegue nuevo. Es a propósito: el service worker cambia
 * el comportamiento de toda la app y no conviene que un preview lo active sin
 * querer.
 *
 * En `next dev` siempre está apagada. Un service worker en desarrollo se queda
 * con chunks que el HMR ya borró y produce errores imposibles de reproducir en
 * producción.
 */
export const PWA_ENABLED = process.env.NEXT_PUBLIC_PWA_ENABLED === "true";

/** Si el navegador debe registrar el service worker en este build. */
export function pwaActiva(): boolean {
  return PWA_ENABLED && process.env.NODE_ENV === "production";
}
