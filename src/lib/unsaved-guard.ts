/**
 * Aviso de cambios sin guardar.
 *
 * Una pantalla que edita cosas largas —el catálogo, la ficha— registra aquí su
 * guardia, y el armazón del panel la consulta **antes** de cambiar de sección,
 * de negocio o de volver atrás. Vive en un módulo y no en un contexto de React
 * porque el que pregunta (`PanelShell`) es padre del que edita y no puede leer
 * su estado sin subir medio panel al contexto por una sola pregunta.
 *
 * Es un **registro de varias guardias**: una pantalla puede tener dos tarjetas
 * con trabajo pendiente a la vez (Ajustes de pedidos: zonas y horario de
 * cocina). Antes guardaba una sola función y la segunda pisaba a la primera; al
 * desmontarse, una borraba la de la otra.
 *
 * Cada guardia devuelve `true` cuando se puede salir. Quien la registra decide
 * qué hacer cuando no: aquí se usa un `confirm` del navegador, que es la única
 * confirmación que también sirve para el botón «atrás» y para el cierre de
 * pestaña sin duplicar la lógica en tres sitios.
 */

type Guardia = () => boolean;

const guardias = new Set<Guardia>();

/**
 * Registra una guardia y devuelve la función que la retira.
 *
 * `registrarGuarda(null)` se mantiene por compatibilidad y las retira todas;
 * los usos nuevos llaman a la función que devuelve el registro.
 */
export function registrarGuarda(fn: Guardia | null): () => void {
  if (!fn) {
    guardias.clear();
    return () => {};
  }
  guardias.add(fn);
  return () => {
    guardias.delete(fn);
  };
}

/** `true` si se puede salir; `false` si alguna guardia lo impidió. */
export function puedeSalir(): boolean {
  for (const guardia of guardias) {
    if (!guardia()) return false;
  }
  return true;
}
