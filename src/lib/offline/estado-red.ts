/**
 * Estado de conexión compartido entre EstadoConexion y NavOffline.
 *
 * `navigator.onLine` puede mentir en redes cautivas y en algunas redes móviles
 * cubanas donde el dispositivo tiene IP pero no hay internet. Este módulo combina
 * dos señales: el evento online/offline del navegador y los fallos reales de la
 * cola de envíos. Si el último intento de red falló, se considera sin red hasta
 * el siguiente éxito o el evento online.
 *
 * No usa Zustand: un módulo con variable + evento personalizado es suficiente
 * para un booleano compartido entre dos componentes del mismo árbol.
 */

let _sinRed = false;

/** Estado actual. */
export function sinRed(): boolean {
  return _sinRed;
}

/** Actualiza el estado y dispara el evento `lv:estado-red` si cambió. */
export function setSinRed(val: boolean): void {
  if (typeof window === "undefined") return;
  if (_sinRed === val) return;
  _sinRed = val;
  window.dispatchEvent(new CustomEvent("lv:estado-red", { detail: { sinRed: val } }));
}
