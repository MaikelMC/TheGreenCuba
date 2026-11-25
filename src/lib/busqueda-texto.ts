/**
 * La normalización del buscador del panel, en funciones puras.
 *
 * La misma regla se aplica al texto que escribe la persona y al que se compara
 * en la base: sin tildes, sin mayúsculas y con los espacios repetidos
 * colapsados. Así «café» encuentra «Cafe» y «La  Habana» encuentra «La Habana».
 *
 * En SQL se replica con `translate(lower(...))`; aquí se usa `normalize("NFD")`
 * porque el navegador y Node ya saben descomponer los acentos.
 */

/** «  CAFÉ   del   Mar » → «cafe del mar». */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * El teléfono como dígitos: «+53 555 1234» → «535551234».
 *
 * Se usa para comparar con `regexp_replace(telefono, '\D', '', 'g')`, de modo
 * que el país, los espacios y los guiones no cambien el resultado.
 */
export function digitosDeTelefono(texto: string): string {
  return texto.replace(/\D/g, "");
}
