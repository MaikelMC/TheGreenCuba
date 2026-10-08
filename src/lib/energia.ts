/**
 * La energía de respaldo de un negocio.
 *
 * En Cuba un apagón no es una avería: es el clima. Saber si un sitio tiene
 * planta o inversor es, para mucha gente, la diferencia entre ir o no ir —y hoy
 * eso se pregunta por WhatsApp, negocio por negocio—. Aquí se guarda una vez y
 * lo leen la ficha, el mapa y el buscador.
 *
 * **Cuatro valores y no un booleano.** «Tiene respaldo» y «tiene planta» no son
 * lo mismo: un inversor aguanta las luces y el ventilador, una planta mueve la
 * cocina y el aire. Quien pregunta por «corriente» quiere cualquiera de los dos;
 * quien pregunta por «planta» quiere el segundo, y colapsarlos en `true` haría
 * que esa segunda pregunta no se pudiera contestar.
 *
 * Este archivo es puro a propósito —no importa la base ni React— porque lo leen
 * el servidor, el navegador y el pin, que se dibuja fuera de React.
 */

/** Los cuatro valores, de menos a más. El orden se usa para comparar. */
export const ENERGIA_ORDER = ["ninguna", "planta", "inversor", "ambas"] as const;

export type EnergiaRespaldo = (typeof ENERGIA_ORDER)[number];

/** Cómo lo llama el dueño en el panel. */
export const ENERGIA_LABEL: Record<EnergiaRespaldo, string> = {
  ninguna: "Ninguna",
  planta: "Planta eléctrica",
  inversor: "Inversor",
  ambas: "Planta e inversor",
};

/**
 * La etiqueta corta que se pinta en la ficha, en la tarjeta del mapa y bajo el
 * pin. Dice el respaldo, no el campo: «Con planta» es lo que busca quien mira.
 */
export const ENERGIA_BADGE: Record<EnergiaRespaldo, string> = {
  ninguna: "Sin respaldo",
  planta: "Con planta",
  inversor: "Con inversor",
  ambas: "Con planta e inversor",
};

/**
 * Lo que se le cuenta al buscador con IA, o `null` para no contarle nada.
 *
 * `ninguna` calla a propósito: es una decisión del dueño, pero decirle al modelo
 * «este lugar NO tiene corriente» en una consulta que busca sitios con corriente
 * solo sirve para que lo descarte dos veces —y para que lo nombre en el resumen,
 * que es peor—. Lo que no tiene respaldo se queda sin el campo, igual que no lo
 * tiene quien no lo rellenó.
 */
export const ENERGIA_IA: Record<EnergiaRespaldo, string | null> = {
  ninguna: null,
  planta: "planta eléctrica",
  inversor: "inversor",
  ambas: "planta eléctrica e inversor",
};

/** Un valor cualquiera es uno de los cuatro. Para validar en la frontera. */
export function esEnergia(value: unknown): value is EnergiaRespaldo {
  return (
    typeof value === "string" &&
    (ENERGIA_ORDER as readonly string[]).includes(value)
  );
}

/**
 * ¿Este negocio tiene de dónde tirar cuando se va la luz?
 *
 * `ninguna` es un «no» dicho a propósito y lo ausente es «no lo dijo»: los dos
 * se responden igual —no hay respaldo—, y por eso esto es lo que decide si se
 * pinta la etiqueta y si el negocio entra en el filtro.
 */
export function tieneRespaldo(
  energia: EnergiaRespaldo | null | undefined,
): boolean {
  return energia === "planta" || energia === "inversor" || energia === "ambas";
}

/** La etiqueta que se pinta, o `null` si no hay nada que anunciar. */
export function etiquetaEnergia(
  energia: EnergiaRespaldo | null | undefined,
): string | null {
  return tieneRespaldo(energia) ? ENERGIA_BADGE[energia as EnergiaRespaldo] : null;
}

/** Lo que viaja al buscador con IA. `null` si no hay nada que contar. */
export function energiaParaIA(
  energia: EnergiaRespaldo | null | undefined,
): string | null {
  return energia ? ENERGIA_IA[energia] : null;
}
