/**
 * Aviso de cambios sin guardar.
 *
 * Una pantalla que edita cosas largas —el catálogo— registra aquí su guardia,
 * y el armazón del panel la consulta **antes** de cambiar de sección. Vive en un
 * módulo y no en un contexto de React porque el que pregunta (`PanelShell`) es
 * padre del que edita y no puede leer su estado sin subir medio panel al
 * contexto por una sola pregunta.
 *
 * La guardia devuelve `true` cuando se puede salir. Quien la registra decide qué
 * hacer cuando no: aquí se usa un `confirm` del navegador, que es la única
 * confirmación que también sirve para el botón «atrás» y para el cierre de
 * pestaña sin duplicar la lógica en tres sitios.
 */

type Guardia = () => boolean;

let guardia: Guardia | null = null;

/** Registra (o retira, con `null`) la guardia de la pantalla montada. */
export function registrarGuarda(fn: Guardia | null): void {
  guardia = fn;
}

/** `true` si se puede cambiar de sección; `false` si la guardia lo impidió. */
export function puedeSalir(): boolean {
  return guardia ? guardia() : true;
}
