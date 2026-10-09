import type { UserPlaceOferta } from "@/lib/places-store";

/**
 * Ofertas flash: la rebaja de un producto de la carta, con fecha de caducidad.
 *
 * Módulo **puro** —lo leen el servidor y el navegador— y aquí está la única
 * regla que importa: una oferta está viva mientras `inicia <= ahora < termina`.
 * No hay columna `vigente` ni cron que apague nada: la comparación se hace al
 * leer, que es el único momento en que el «ahora» significa algo. La misma idea
 * que `estaAgotado` en `disponibilidad.ts`.
 *
 * El precio de la carta es **texto libre** («150», «2.50», «3–5 USD»), así que
 * una rebaja por porcentaje solo se puede calcular cuando ese texto es una cifra
 * pelada. `parsePrecio` decide eso, y cuando no lo es el tachado simplemente no
 * se pinta: mejor no enseñar nada que enseñar un número inventado.
 */

/** Lo mínimo para saber si algo está vivo. Compartido con `UserPlaceOferta`. */
type ConFechas = Pick<UserPlaceOferta, "inicia" | "termina">;

/**
 * ¿Está vigente ahora mismo?
 *
 * El final es **exclusivo**: en el instante exacto de `termina` la oferta ya no
 * vale. El principio también es inclusivo —`inicia` en punto ya cuenta—, que es
 * lo que se espera de una hora de inicio escrita por el dueño.
 */
export function estaVigente(oferta: ConFechas, ahora: number = Date.now()): boolean {
  return oferta.inicia <= ahora && ahora < oferta.termina;
}

/**
 * Las que están vivas, la que antes caduca delante.
 *
 * El orden es el del cartel de la ficha: lo que se acaba primero es lo que más
 * urge, y así no cambia de sitio entre recargas.
 */
export function ofertasVigentes(
  ofertas: UserPlaceOferta[] | undefined,
  ahora: number = Date.now(),
): UserPlaceOferta[] {
  if (!ofertas?.length) return [];
  return ofertas
    .filter((oferta) => estaVigente(oferta, ahora))
    .sort((a, b) => a.termina - b.termina);
}

/** ¿Hay alguna viva? Es lo que decide la chapita «Oferta» en la tarjeta y el pin. */
export function hayOferta(
  ofertas: UserPlaceOferta[] | undefined,
  ahora: number = Date.now(),
): boolean {
  return ofertas?.some((oferta) => estaVigente(oferta, ahora)) ?? false;
}

/**
 * La oferta viva que apunta a este producto, si hay alguna.
 *
 * Una sola: dos ofertas sobre el mismo plato a la vez dejarían dos precios
 * tachados distintos en la misma fila. Gana la que antes caduca, que es la que
 * enseña el precio más urgente.
 */
export function ofertaDe(
  ofertas: UserPlaceOferta[] | undefined,
  productoId: string,
  ahora: number = Date.now(),
): UserPlaceOferta | undefined {
  return ofertasVigentes(ofertas, ahora).find(
    (oferta) => oferta.productoId === productoId,
  );
}

/**
 * El precio de la carta como número, o `null` si no es una cifra.
 *
 * Estricto a propósito, y no `parseFloat`: la carta admite texto libre y
 * `parseFloat("3–5 USD")` devuelve `3` sin avisar, que aplicaría la rebaja al
 * extremo barato de un rango. Aquí o el texto entero es un número o no hay
 * número.
 */
export function parsePrecio(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(limpio)) return null;
  return Number(limpio);
}

/** Aplica un porcentaje y redondea a dos decimales, que es lo que ve el cliente. */
export function precioRebajado(original: number, pct: number): number {
  return Math.round(original * (1 - pct / 100) * 100) / 100;
}

/**
 * El par de precios que se pinta en la carta: el de antes y el de ahora.
 *
 * Devuelve `null` cuando no hay nada que tachar —un porcentaje sobre un precio
 * que no es una cifra—, y quien llama simplemente pinta el precio de siempre.
 * El texto que sale es solo el número: la moneda la añade quien pinta, que es
 * quien la tiene.
 */
export function precioConOferta(
  precioCarta: string,
  oferta: UserPlaceOferta,
): { de: string; por: string } | null {
  if (oferta.precioOferta) {
    return { de: precioCarta, por: oferta.precioOferta };
  }
  if (oferta.descuentoPct == null) return null;

  const original = parsePrecio(precioCarta);
  if (original === null) return null;
  return { de: precioCarta, por: String(precioRebajado(original, oferta.descuentoPct)) };
}

/**
 * ¿Vale este inicio para guardarlo?
 *
 * No se puede empezar una oferta en el pasado... salvo que sea el inicio que la
 * oferta **ya tenía**: una que va en curso —empezó a las 9 y son las 12— se
 * tiene que poder editar para bajarle el precio sin moverle la hora.
 *
 * El minuto y no el segundo: el `<input type="datetime-local">` no llega más
 * fino, así que redondear «ahora» al minuto es lo único que no rechaza el valor
 * que el propio formulario acaba de proponer.
 *
 * Vive fuera de `validarOferta` a propósito. Aquella corre también sobre las
 * ofertas que el panel **reenvía enteras en cada guardado**, y con esta regla
 * dentro tumbaría el guardado del horario de cualquier negocio que tenga una
 * oferta ya empezada. Una fecha vacía tampoco es asunto de aquí: de eso avisa
 * `validarOferta`, con su propia frase.
 */
export function inicioValido(
  inicia: string,
  iniciaOriginal: string,
  ahora: number = Date.now(),
): boolean {
  if (!inicia || inicia === iniciaOriginal) return true;
  return new Date(inicia).getTime() >= Math.floor(ahora / 60_000) * 60_000;
}

/**
 * Comprueba y normaliza una oferta que llega del navegador.
 *
 * Devuelve la oferta lista para guardar, o **el error en texto**. Las mismas
 * reglas que imponen los `check` de la tabla, pero aquí para poder contestar un
 * 400 con una frase: dejar que las rechace Postgres da un 500 y un mensaje en
 * inglés sobre una restricción, que no le dice nada al dueño.
 *
 * El cuerpo llega como `unknown` y no como `UserPlaceOferta`: es un dato sin
 * comprobar, y afirmar su forma con un `as` es justo lo que esta función viene a
 * no hacer.
 */
export function validarOferta(entrada: unknown): UserPlaceOferta | string {
  if (!entrada || typeof entrada !== "object") {
    return "La oferta no tiene el formato esperado.";
  }
  const o = entrada as Partial<UserPlaceOferta>;

  const id = o.id?.trim();
  const titulo = o.titulo?.trim();
  const productoId = o.productoId?.trim();
  if (!id) return "La oferta necesita un identificador.";
  if (!titulo) return "La oferta necesita un título.";
  if (!productoId) return "Elige a qué producto de la carta apunta la oferta.";

  if (!Number.isFinite(o.inicia) || !Number.isFinite(o.termina)) {
    return "La oferta necesita fecha de inicio y de fin.";
  }
  if ((o.termina as number) <= (o.inicia as number)) {
    return "La oferta tiene que terminar después de empezar.";
  }

  const precio = o.precioOferta?.trim();
  const pct = o.descuentoPct;
  const hayPct = pct != null;
  if (Boolean(precio) === hayPct) {
    return "La oferta lleva un precio rebajado o un descuento, pero no los dos.";
  }
  if (hayPct && (pct < 1 || pct > 99 || !Number.isInteger(pct))) {
    return "El descuento tiene que ser un número entero entre 1 y 99.";
  }

  return {
    id,
    productoId,
    titulo,
    descripcion: o.descripcion?.trim() || undefined,
    precioOferta: precio || undefined,
    descuentoPct: hayPct ? pct : undefined,
    inicia: o.inicia as number,
    termina: o.termina as number,
  };
}
