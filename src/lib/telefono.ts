/**
 * Teléfonos cubanos: normalizar y enmascarar.
 *
 * El número es la identidad del cliente frecuente, así que se guarda siempre
 * igual: `+53` y los ocho dígitos nacionales. Acepta lo que la gente escribe
 * de verdad —«+53 5 123 4567», «53 51234567», «51234567»— con espacios o
 * guiones. Lo que no tenga ocho dígitos nacionales se rechaza; no se intenta
 * arreglar un número incompleto.
 *
 * Para enseñarlo fuera del panel se enmascara: `+53 5••• ••67`. El teléfono
 * completo solo lo ve el equipo del negocio.
 */

const PREFIJO = "+53";
const LARGO_NACIONAL = 8;

/**
 * El número normalizado, o `null` si no es un cubano de ocho dígitos.
 *
 * Solo se aceptan dígitos, `+`, espacios y guiones. Un número con paréntesis,
 * letras o extensiones es más probable que sea otra cosa que un teléfono mal
 * tecleado; rechazarlo evita guardar basura como identidad.
 */
export function normalizarTelefono(valor: string): string | null {
  const limpio = valor.trim();
  if (!limpio) return null;
  if (!/^[+\d\s-]+$/.test(limpio)) return null;

  const digitos = limpio.replace(/\D/g, "");
  let nacional: string;

  if (digitos.length === LARGO_NACIONAL) {
    nacional = digitos;
  } else if (digitos.length === LARGO_NACIONAL + 2 && digitos.startsWith("53")) {
    nacional = digitos.slice(2);
  } else {
    return null;
  }

  if (!new RegExp(`^\\d{${LARGO_NACIONAL}}$`).test(nacional)) return null;
  return `${PREFIJO}${nacional}`;
}

/** Si el número se puede guardar. */
export function telefonoValido(valor: string): boolean {
  return normalizarTelefono(valor) !== null;
}

/**
 * `+53 5••• ••67`, o `null` si el número no se puede normalizar.
 *
 * Deja el primer dígito y los dos últimos: suficiente para que el cliente
 * reconozca su número y para que el equipo sepa a quién le habla, sin enseñar
 * el número entero en una pantalla que puede estar mirando otra persona.
 */
export function enmascararTelefono(valor: string): string | null {
  const normalizado = normalizarTelefono(valor);
  if (!normalizado) return null;

  const nacional = normalizado.slice(PREFIJO.length);
  return `${PREFIJO} ${nacional.charAt(0)}••• ••${nacional.slice(-2)}`;
}
